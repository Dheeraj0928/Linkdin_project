import { AppError } from '../browser/launcher.js';
import { delay } from '../utils/delay.js';
import config from '../config/index.js';

const { pageTimeoutMs } = config.automation;

function firstName(name) {
  return name.trim().split(/\s+/)[0].toLowerCase();
}

export async function openProfile(page, profileUrl, logger) {
  logger.info('Opening profile', { profileUrl });
  await closeAllMessageOverlays(page);
  await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: pageTimeoutMs });
  const ok = await page.locator('main a[href*="/messaging/compose"]').first()
    .waitFor({ state: 'visible', timeout: 12000 }).then(() => true).catch(() => false);
  if (!ok) throw new AppError(`Could not open profile: ${profileUrl}`, 'PROFILE_OPEN_FAILED');
}

export async function closeAllMessageOverlays(page) {
  for (let round = 0; round < 6; round++) {
    await page.keyboard.press('Escape').catch(() => {});
    const closes = page.locator('button.msg-overlay-bubble-header__control--close');
    const n = await closes.count().catch(() => 0);
    for (let j = n - 1; j >= 0; j--) {
      await closes.nth(j).click({ force: true, timeout: 500 }).catch(() => {});
    }
    await delay(300);
    const left = await page.locator('.msg-overlay-conversation-bubble').count().catch(() => 0);
    if (left === 0) return;
  }
}

async function readOverlayHeader(page) {
  return page.locator(
    '.msg-convo-wrapper h2, .msg-overlay-bubble-header__title, .msg-overlay-conversation-bubble h2, .msg-overlay-bubble-header h2'
  ).last().textContent().catch(() => '');
}

function headerMatchesName(header, name) {
  const h = header.toLowerCase().trim();
  if (!h || h.includes('new message')) return true;
  const first = firstName(name);
  return h.includes(first);
}

/** Open compose for THIS profile only — uses compose URL to avoid wrong overlay */
export async function openMessageCompose(page, connection, logger) {
  await closeAllMessageOverlays(page);
  await delay(400);

  const link = page.locator('main a[href*="/messaging/compose"]').first();
  if (!(await link.isVisible({ timeout: 5000 }).catch(() => false))) {
    throw new AppError('Message button not found', 'MESSAGE_BUTTON_NOT_FOUND');
  }

  const href = await link.getAttribute('href');
  const composeUrl = href.startsWith('http') ? href : `https://www.linkedin.com${href}`;

  await page.goto(composeUrl, { waitUntil: 'domcontentloaded', timeout: pageTimeoutMs });
  await delay(1500);

  const compose = page.locator(
    '.msg-convo-wrapper form.msg-form .msg-form__contenteditable, form.msg-form .msg-form__contenteditable'
  ).last();
  await compose.waitFor({ state: 'visible', timeout: 15000 });
  await compose.click().catch(() => {});

  const header = await readOverlayHeader(page);
  if (!headerMatchesName(header, connection.name)) {
    throw new AppError(
      `Wrong chat opened (header: "${header?.trim()}", expected: ${connection.name})`,
      'WRONG_CHAT'
    );
  }

  logger.info('Compose ready', { name: connection.name });
}

export async function closeMessageOverlay(page) {
  await closeAllMessageOverlays(page);
  await delay(300);
}

export async function extractNameFromProfile(page) {
  return page.evaluate(() => {
    const selectors = [
      'h1.text-heading-xlarge',
      'main h1',
      'h1.inline',
      '.pv-text-details__left-panel h1',
    ];
    for (const sel of selectors) {
      const t = document.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim();
      if (t) return t;
    }
    return '';
  });
}

export async function extractCompanyFromProfile(page, logger) {
  const company = await page.evaluate(() => {
    const t = document.querySelector('.text-body-medium.break-words, div[data-generated-suggestion-target]')?.textContent?.replace(/\s+/g, ' ').trim() || '';
    if (t.includes(' at ')) return t.split(' at ').pop().trim();
    if (t.includes(' @')) return t.split(' @').pop().split('|')[0].trim();
    return '';
  });
  if (company) logger.info('Company detected', { company });
  return company;
}
