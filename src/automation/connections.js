import { SELECTORS } from '../config/constants.js';
import { delay } from '../utils/delay.js';
import { normalizeProfileUrl } from '../utils/url.js';
import { readJson } from '../utils/fileSystem.js';
import { AppError } from '../browser/launcher.js';

async function scrollConnectionsList(page, amount = 800) {
  await page.evaluate((px) => {
    const targets = [
      document.querySelector('.scaffold-finite-scroll__content'),
      document.querySelector('[data-finite-scroll-hotkey]'),
      document.querySelector('main .scaffold-layout__list'),
      document.querySelector('main'),
    ].filter(Boolean);

    for (const el of targets) {
      el.scrollTop += px;
    }
    window.scrollBy(0, px);
  }, amount);
}

async function readConnectionsFromPage(page) {
  return page.evaluate(({ profileLinkSelector }) => {
    const results = [];
    const seen = new Set();

    function add(link) {
      const href = link.href?.split('?')[0];
      if (!href?.includes('/in/') || seen.has(href)) return;
      const name = link.textContent?.replace(/\s+/g, ' ').trim().split(/\s+/).slice(0, 2).join(' ');
      if (!name) return;
      seen.add(href);
      results.push({ name, profileUrl: href });
    }

    for (const item of document.querySelectorAll('main ul li')) {
      const link = item.querySelector('a[href*="/in/"]');
      if (link) add(link);
    }
    if (results.length === 0) {
      for (const link of document.querySelectorAll(profileLinkSelector)) add(link);
    }
    return results;
  }, { profileLinkSelector: SELECTORS.connections.profileLink });
}

function mergeOrderedConnections(ordered, batch) {
  const known = new Set(ordered.map((c) => normalizeProfileUrl(c.profileUrl)));
  for (const conn of batch) {
    const key = normalizeProfileUrl(conn.profileUrl);
    if (!known.has(key)) {
      known.add(key);
      ordered.push(conn);
    }
  }
}

function findAnchorIndex(ordered, anchorUrl) {
  if (!anchorUrl) return -1;
  const key = normalizeProfileUrl(anchorUrl);
  return ordered.findIndex((c) => normalizeProfileUrl(c.profileUrl) === key);
}

/** Deepest person in list order who was already messaged — bootstrap when no anchor saved */
function findVirtualAnchorIndex(ordered, sentSet) {
  let index = -1;
  for (let i = 0; i < ordered.length; i += 1) {
    if (sentSet.has(normalizeProfileUrl(ordered[i].profileUrl))) {
      index = i;
    }
  }
  return index;
}

/**
 * Anchor strategy: find last-processed person in list, message everyone BELOW them only.
 * List order = top (recent) → bottom (older). No re-visiting people above the anchor.
 */
export async function extractConnectionsFromPage(
  page,
  maxConnections,
  scrollPauseMs,
  maxScrollAttempts,
  sentUrls,
  lastAnchorUrl,
  logger
) {
  await page.waitForSelector(SELECTORS.connections.mainContent, { timeout: 30000 });

  const sentSet = new Set(sentUrls.map(normalizeProfileUrl));
  const ordered = [];
  let staleScrolls = 0;
  let lastTotalOnPage = 0;
  let scrollCount = 0;
  let anchorIndex = -1;

  logger.info('Building connections list in order (top → bottom)...', {
    maxConnections,
    lastAnchor: lastAnchorUrl || '(none — will use sent registry)',
    alreadyMessaged: sentSet.size,
  });

  /** Few connections → stop scrolling quickly instead of 180 attempts */
  const stallLimit = Math.min(maxScrollAttempts, 12);

  while (staleScrolls < maxScrollAttempts) {
    const batch = await readConnectionsFromPage(page);
    mergeOrderedConnections(ordered, batch);

    anchorIndex = findAnchorIndex(ordered, lastAnchorUrl);
    if (anchorIndex < 0 && !lastAnchorUrl) {
      anchorIndex = findVirtualAnchorIndex(ordered, sentSet);
    }

    const belowAnchor = anchorIndex >= 0 ? ordered.length - anchorIndex - 1 : ordered.length;

    if (anchorIndex >= 0 && belowAnchor >= maxConnections) {
      logger.info(`Anchor found at #${anchorIndex + 1}, enough people below (${belowAnchor})`);
      break;
    }

    if (batch.length === 0 && ordered.length > 0 && anchorIndex >= 0) break;

    // List stopped growing — don't scroll forever (critical for accounts with 1–5 connections)
    if (ordered.length > 0 && staleScrolls >= stallLimit) {
      if (anchorIndex < 0) {
        logger.info(`List complete: ${ordered.length} connection(s), messaging from top`);
        break;
      }
      if (belowAnchor > 0) {
        logger.info(`List complete: ${belowAnchor} connection(s) below anchor #${anchorIndex + 1}`);
        break;
      }
      logger.warn(`List complete but nobody below anchor "${ordered[anchorIndex]?.name}"`);
      break;
    }

    // Small list already loaded — skip long scroll phase
    if (anchorIndex < 0 && ordered.length > 0 && ordered.length >= maxConnections) {
      logger.info(`Loaded ${ordered.length} connections (no anchor) — enough to start`);
      break;
    }

    await scrollConnectionsList(page, 900);
    scrollCount += 1;
    await delay(Math.max(scrollPauseMs, 500));

    const totalOnPage = ordered.length;
    if (totalOnPage > lastTotalOnPage) {
      staleScrolls = 0;
      lastTotalOnPage = totalOnPage;
    } else {
      staleScrolls += 1;
    }

    if (scrollCount % 5 === 0) {
      logger.info(`Scroll ${scrollCount}: ${ordered.length} in list, anchor at #${anchorIndex + 1 || '?'}`);
    }
  }

  if (anchorIndex < 0) {
    anchorIndex = findAnchorIndex(ordered, lastAnchorUrl);
    if (anchorIndex < 0) {
      anchorIndex = findVirtualAnchorIndex(ordered, sentSet);
    }
  }

  const startIndex = anchorIndex + 1;
  let connections = ordered.slice(startIndex, startIndex + maxConnections);

  // Fresh account / no anchor: message from top of list (including when only 1 connection)
  if (connections.length === 0 && anchorIndex < 0 && ordered.length > 0) {
    connections = ordered.slice(0, maxConnections);
    logger.info('No anchor — targeting from start of connections list', {
      count: connections.length,
      first: connections[0]?.name,
    });
  }

  if (connections.length === 0) {
    const anchorName = anchorIndex >= 0 ? ordered[anchorIndex]?.name : 'none';
    throw new AppError(
      `No connections below anchor "${anchorName}" (index ${anchorIndex + 1} of ${ordered.length})`,
      'NO_CONNECTIONS_FOUND'
    );
  }

  const anchorName = anchorIndex >= 0 ? ordered[anchorIndex]?.name : '(start of list)';
  logger.success(`Messaging ${connections.length} person(s) BELOW anchor`, {
    anchor: anchorName,
    anchorPosition: anchorIndex + 1,
    firstTarget: connections[0].name,
    lastTarget: connections[connections.length - 1].name,
    listSize: ordered.length,
    scrollSteps: scrollCount,
  });

  return { connections, anchorIndex, ordered, anchorName };
}

export async function navigateToConnections(page, connectionsUrl, logger) {
  logger.info('Navigating to connections page', { url: connectionsUrl });
  await page.goto(connectionsUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await delay(1000);
}
