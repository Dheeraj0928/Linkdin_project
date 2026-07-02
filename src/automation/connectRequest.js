import { SELECTORS } from '../config/constants.js';
import { delay, humanDelay } from '../utils/delay.js';
import { checkDailyLimit, incrementDailyUsage } from '../utils/dailyLimit.js';
import { normalizeProfileUrl } from '../utils/url.js';
import { AppError } from '../browser/launcher.js';

function profileSlug(profileUrl) {
  return normalizeProfileUrl(profileUrl).split('/in/')[1] || '';
}

export function buildPeopleSearchUrl(role, location) {
  const keywords = [role, location].filter((s) => s?.trim()).join(' ').trim();
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}&origin=GLOBAL_SEARCH_HEADER`;
}

/**
 * LinkedIn 2025+ search UI uses <a aria-label="Invite X to connect"> instead of <button>.
 * All in-page DOM logic lives in one evaluate() block — no eval(), no fragile class names.
 */
function scanPeopleOnPage() {
  function isProfileLink(a) {
    if (!a?.href?.includes('/in/')) return false;
    const aria = (a.getAttribute('aria-label') || '').toLowerCase();
    if (aria.includes('invite') && aria.includes('connect')) return false;
    return true;
  }

  function isConnectControl(el) {
    if (!el) return false;
    const tag = el.tagName;
    if (tag !== 'BUTTON' && tag !== 'A') return false;
    if (el.disabled) return false;

    const aria = (el.getAttribute('aria-label') || '').toLowerCase();
    const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();

    if (aria.includes('pending') || text === 'pending') return false;
    if (aria.includes('invite') && aria.includes('connect')) return true;
    if (/\bconnect\b/.test(text) && !/\bmessage\b/.test(text) && tag === 'A') return true;
    if (/\bconnect\b/.test(text) && tag === 'BUTTON') return true;
    return false;
  }

  function inviteNameFromConnect(connectEl) {
    const aria = connectEl.getAttribute('aria-label') || '';
    return aria.match(/Invite\s+(.+?)\s+to connect/i)?.[1]?.trim() || '';
  }

  function matchProfileToInvite(profileLink, inviteName) {
    if (!inviteName) return false;
    const text = (profileLink.innerText || profileLink.textContent || '').replace(/\s+/g, ' ').trim();
    const short = text.split('•')[0].trim();
    return short.includes(inviteName) || inviteName.includes(short) || text.includes(inviteName);
  }

  function findProfileForConnect(connectEl) {
    const inviteName = inviteNameFromConnect(connectEl);
    let node = connectEl.parentElement;

    for (let depth = 0; depth < 12 && node; depth++) {
      const connects = [...node.querySelectorAll('a, button')].filter(isConnectControl);
      const profiles = [...node.querySelectorAll('a[href*="/in/"]')].filter(isProfileLink);

      if (connects.length === 1 && profiles.length > 0) {
        if (inviteName) {
          const matched = profiles.find((p) => matchProfileToInvite(p, inviteName));
          if (matched) return matched;
        }
        return profiles[0];
      }
      node = node.parentElement;
    }
    return null;
  }

  function extractName(profileLink, connectEl) {
    const fromInvite = inviteNameFromConnect(connectEl);
    if (fromInvite) return fromInvite;

    const hidden = profileLink.closest('div, li, article')?.querySelector('span[aria-hidden="true"]');
    const fromHidden = hidden?.textContent?.replace(/\s+/g, ' ').trim();
    if (fromHidden) return fromHidden.split('•')[0].trim();

    return (profileLink.innerText || profileLink.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .split('•')[0]
      .split('\n')[0]
      .trim();
  }

  const results = [];
  const seen = new Set();

  const connectEls = [...document.querySelectorAll(
    'main a[aria-label*="Invite"][aria-label*="connect" i], main button[aria-label*="Invite"][aria-label*="connect" i]'
  )];

  for (const connectEl of connectEls) {
    const profileLink = findProfileForConnect(connectEl);
    if (!profileLink) continue;

    const profileUrl = profileLink.href.split('?')[0].replace(/\/$/, '');
    const key = profileUrl.toLowerCase();
    if (seen.has(key)) continue;

    const slug = key.split('/in/')[1] || '';
    if (!slug) continue;

    seen.add(key);
    results.push({
      name: extractName(profileLink, connectEl),
      profileUrl,
      headline: '',
      slug,
      connectAria: connectEl.getAttribute('aria-label') || '',
    });
  }

  return results;
}

async function waitForSearchResults(page, logger) {
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    const stats = await page.evaluate(() => ({
      profiles: document.querySelectorAll('main a[href*="/in/"]').length,
      connects: document.querySelectorAll('main a[aria-label*="Invite"][aria-label*="connect" i]').length,
    })).catch(() => ({ profiles: 0, connects: 0 }));

    if (stats.connects > 0 || stats.profiles >= 3) {
      logger.info('Search results loaded', stats);
      return stats;
    }
    await delay(800);
  }
  logger.warn('Search results slow to load — continuing anyway');
  return { profiles: 0, connects: 0 };
}

async function primeSearchResults(page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await delay(400);
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(0, 500);
    await delay(500);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await delay(600);
}

/** Open People search directly */
export async function navigateToPeopleSearch(page, role, location, logger) {
  const keywords = [role, location].filter((s) => s?.trim()).join(' ').trim();
  const peopleUrl = buildPeopleSearchUrl(role, location);

  logger.info('Opening People search', { keywords, url: peopleUrl });
  await page.goto(peopleUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await delay(2000);

  await waitForSearchResults(page, logger);
  await primeSearchResults(page);

  await page.waitForSelector(SELECTORS.connect.searchResults, { timeout: 10000 }).catch(() => {});

  const people = await readPeopleFromSearch(page);
  logger.success('People search ready', { keywords, connectableOnPage: people.length, sample: people.slice(0, 3).map((p) => p.name) });
  return people;
}

async function scrollSearchResults(page, amount = 900) {
  await page.evaluate((px) => {
    const targets = [
      document.querySelector('.scaffold-finite-scroll__content'),
      document.querySelector('[data-finite-scroll-hotkey]'),
      document.querySelector('main'),
    ].filter(Boolean);
    for (const el of targets) el.scrollTop += px;
    window.scrollBy(0, px);
  }, amount);
}

async function readPeopleFromSearch(page) {
  return page.evaluate(scanPeopleOnPage);
}

async function closeAnyModal(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await delay(300);
  await page.locator('[role="dialog"] button[aria-label="Dismiss"]').click({ timeout: 1000 }).catch(() => {});
  await page.locator('button[aria-label="Dismiss"]').click({ timeout: 1000 }).catch(() => {});
}

/** LinkedIn free accounts: max 200 chars for personalized notes; unlimited without note */
const FREE_NOTE_CHAR_LIMIT = 200;

async function clickEnabledSendInDialog(page) {
  const dialog = page.locator('[role="dialog"]').last();
  const buttons = dialog.getByRole('button', { name: /^Send$/i });
  const count = await buttons.count();
  for (let i = count - 1; i >= 0; i -= 1) {
    const btn = buttons.nth(i);
    const visible = await btn.isVisible().catch(() => false);
    const disabled = await btn.isDisabled().catch(() => true);
    if (visible && !disabled) {
      await btn.click({ timeout: 5000 });
      await delay(1500);
      await closeAnyModal(page);
      return true;
    }
  }
  return false;
}

/** Free / normal account — no personalized note (unlimited invites) */
async function sendWithoutNote(page, logger) {
  const dialog = page.locator('[role="dialog"]').last();
  await dialog.waitFor({ state: 'visible', timeout: 12000 });
  await delay(400);

  // If note editor is open, go back first
  const textarea = dialog.locator('textarea');
  if (await textarea.isVisible({ timeout: 1000 }).catch(() => false)) {
    const back = dialog.getByRole('button', { name: /^(Cancel|Back)$/i });
    if (await back.isVisible({ timeout: 2000 }).catch(() => false)) {
      await back.click();
      await delay(800);
      logger.info('Left note editor — will send without note');
    }
  }

  const withoutBtn = dialog.getByRole('button', { name: /Send without a note/i });
  if (await withoutBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await withoutBtn.click();
    await delay(1500);
    await closeAnyModal(page);
    logger.info('Sent without note (Send without a note)');
    return;
  }

  const withoutAny = dialog.locator('button, a').filter({ hasText: /Send without a note/i }).first();
  if (await withoutAny.isVisible({ timeout: 2000 }).catch(() => false)) {
    await withoutAny.click();
    await delay(1500);
    await closeAnyModal(page);
    logger.info('Sent without note');
    return;
  }

  // Some UIs show enabled Send on first screen without opening note editor
  if (await clickEnabledSendInDialog(page)) {
    logger.info('Sent without note (direct Send)');
    return;
  }

  throw new AppError('Could not send without note — try CONNECT_SEND_NOTE=false', 'CONNECT_SEND_WITHOUT_NOTE_FAILED');
}

/** Premium / short note (≤200 chars on free) */
async function sendWithNote(page, note, logger) {
  const dialog = page.locator('[role="dialog"]').last();
  await dialog.waitFor({ state: 'visible', timeout: 12000 });

  const trimmed = note.trim();
  if (!trimmed) return false;

  const text = trimmed.slice(0, FREE_NOTE_CHAR_LIMIT);
  if (trimmed.length > FREE_NOTE_CHAR_LIMIT) {
    logger.warn(`Note is ${trimmed.length} chars — LinkedIn free max is ${FREE_NOTE_CHAR_LIMIT}`);
    return false;
  }

  const textareaOpen = await dialog.locator('textarea').isVisible({ timeout: 1000 }).catch(() => false);
  if (!textareaOpen) {
    const addNote = dialog.getByRole('button', { name: /^Add a note$/i });
    if (!(await addNote.isVisible({ timeout: 5000 }).catch(() => false))) return false;
    await addNote.click();
    await delay(1200);
  }

  const textarea = dialog.locator('textarea').first();
  if (!(await textarea.isVisible({ timeout: 8000 }).catch(() => false))) return false;

  await textarea.click();
  await textarea.fill('');
  await page.keyboard.insertText(text);
  await delay(1000);

  if (await clickEnabledSendInDialog(page)) {
    logger.info('Sent with personalized note');
    return true;
  }
  return false;
}

/**
 * Complete connect modal — supports free accounts (no note) and optional short note.
 */
async function completeConnectModal(page, note, { sendNote, noteFallback }, logger) {
  if (!sendNote) {
    await sendWithoutNote(page, logger);
    return { sentWithNote: false };
  }

  const canUseNote = note.trim().length > 0 && note.trim().length <= FREE_NOTE_CHAR_LIMIT;
  if (canUseNote) {
    const ok = await sendWithNote(page, note, logger);
    if (ok) return { sentWithNote: true };
  }

  if (noteFallback) {
    logger.warn('Falling back to send without note (free account / note too long / Send disabled)');
    await sendWithoutNote(page, logger);
    return { sentWithNote: false };
  }

  throw new AppError('Connect note could not be sent', 'CONNECT_SEND_FAILED');
}

/** Click Connect on search card — LinkedIn 2025 uses <a aria-label="Invite X to connect"> */
export async function sendConnectFromSearchCard(page, person, note, logger, connectOptions = {}) {
  const sendNote = connectOptions.sendNote === true;
  const noteFallback = connectOptions.noteFallback !== false;
  const slug = person.slug || profileSlug(person.profileUrl);
  if (!slug) throw new AppError('Invalid profile URL', 'INVALID_PROFILE');

  const connectLabel = person.connectAria || `Invite ${person.name} to connect`;
  logger.info(`Connect: ${person.name}`, { slug, connectLabel });

  const connectLink = page.getByRole('link', { name: connectLabel, exact: true });
  if (!(await connectLink.isVisible({ timeout: 5000 }).catch(() => false))) {
    return { skipped: true, reason: 'card_not_visible' };
  }

  await connectLink.scrollIntoViewIfNeeded().catch(() => {});
  await delay(400);
  await connectLink.click({ timeout: 10000 });

  logger.info('Clicked Connect', { name: person.name });
  await delay(500);
  const result = await completeConnectModal(page, note, { sendNote, noteFallback }, logger);
  logger.success(`Invitation sent to ${person.name}`, { withNote: result.sentWithNote });
  return { sent: true, withNote: result.sentWithNote };
}

export async function collectPeopleFromSearch(page, role, location, maxPeople, scrollPauseMs, maxScrollAttempts, excludeUrls, logger) {
  await navigateToPeopleSearch(page, role, location, logger);

  const excludeSet = new Set(excludeUrls.map(normalizeProfileUrl));
  const people = [];
  const found = new Set();
  let staleScrolls = 0;
  let lastCount = 0;

  while (people.length < maxPeople && staleScrolls < maxScrollAttempts) {
    const batch = await readPeopleFromSearch(page);

    for (const person of batch) {
      const key = normalizeProfileUrl(person.profileUrl);
      if (excludeSet.has(key) || found.has(key) || people.length >= maxPeople) continue;
      found.add(key);
      people.push(person);
    }

    if (people.length >= maxPeople) break;

    await scrollSearchResults(page);
    await delay(Math.max(scrollPauseMs, 800));

    if (people.length > lastCount) {
      staleScrolls = 0;
      lastCount = people.length;
      logger.info(`Search scroll: ${people.length}/${maxPeople} candidates`);
    } else {
      staleScrolls += 1;
    }
  }

  if (people.length === 0) {
    throw new AppError(`No people with Connect button for "${role}" in "${location || 'anywhere'}"`, 'NO_PEOPLE_FOUND');
  }

  logger.success(`Found ${people.length} people to invite`, { count: people.length });
  return people;
}

export async function runConnectCampaign(page, config, note, sentUrlSet, excludeUrls, logger, onRequestSent) {
  const { role, location, maxPerRun } = config.connect;
  const scrollPauseMs = config.automation.scrollPauseMs;
  const maxStaleScrolls = Math.min(config.automation.maxScrollAttempts, 25);

  await navigateToPeopleSearch(page, role, location, logger);

  const results = { success: [], failed: [], skipped: [] };
  let sentCount = 0;
  let staleScrolls = 0;
  const processed = new Set();

  while (sentCount < maxPerRun && staleScrolls < maxStaleScrolls) {
    const batch = await readPeopleFromSearch(page);
    logger.info(`Scan: ${batch.length} connectable on screen`, { sentSoFar: sentCount, maxPerRun });
    let newThisPass = 0;

    for (const person of batch) {
      if (sentCount >= maxPerRun) break;

      const dailyCheck = await checkDailyLimit(
        config.paths.data,
        'connects',
        config.connect.dailyConnectLimit,
        logger
      );
      if (!dailyCheck.allowed) {
        logger.warn('Daily connect limit reached — stopping campaign');
        return results;
      }

      const key = normalizeProfileUrl(person.profileUrl);
      if (processed.has(key) || sentUrlSet.has(key)) continue;

      processed.add(key);
      const label = `${sentCount + 1}/${maxPerRun}`;
      logger.info(`Processing ${label}`, person);

      try {
        if (!config.connect.sendEnabled) {
          results.success.push({ ...person, sent: false });
          sentCount += 1;
          newThisPass += 1;
          continue;
        }

        const outcome = await sendConnectFromSearchCard(page, person, note, logger, {
          sendNote: config.connect.sendNote,
          noteFallback: config.connect.noteFallback,
        });

        if (outcome.skipped) {
          results.skipped.push({ ...person, reason: outcome.reason });
          if (onRequestSent) await onRequestSent(person, outcome.reason);
          continue;
        }

        if (outcome.sent) {
          sentUrlSet.add(key);
          results.success.push({ ...person, sent: true });
          sentCount += 1;
          newThisPass += 1;
          await incrementDailyUsage(config.paths.data, 'connects');
          if (onRequestSent) await onRequestSent(person, 'sent');
          logger.success(`Done ${label}`, { name: person.name });
        }
      } catch (error) {
        await closeAnyModal(page);
        const reason = error instanceof AppError ? error.message : error.message || 'Unknown';
        results.failed.push({ ...person, error: reason });
        logger.error(`Failed ${label}`, { name: person.name, reason });
      }

      if (sentCount < maxPerRun) {
        await humanDelay(
          config.connect.delayBetweenMinMs,
          config.connect.delayBetweenMaxMs,
          logger,
          'next connect'
        );
      }
    }

    if (sentCount >= maxPerRun) break;

    await scrollSearchResults(page);
    await delay(Math.max(scrollPauseMs, 800));

    if (newThisPass > 0) {
      staleScrolls = 0;
    } else {
      staleScrolls += 1;
      logger.info('No new connects this pass — scrolling', { staleScrolls, maxStaleScrolls });
    }
  }

  if (results.success.length === 0 && results.skipped.length === 0 && results.failed.length === 0) {
    throw new AppError(
      `No connectable people found for "${role}" in "${location}". LinkedIn UI may have changed — check logs.`,
      'NO_PEOPLE_FOUND'
    );
  }

  return results;
}

export async function sendConnectRequest(page, person, note, logger) {
  return sendConnectFromSearchCard(page, person, note, logger);
}
