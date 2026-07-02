import path from 'node:path';
import config from './config/index.js';
import { createLogger } from './logger/index.js';
import {
  launchBrowser,
  ensureLoggedIn,
  waitForManualLogin,
  closeBrowser,
  AppError,
} from './browser/launcher.js';
import { processConnectRequests } from './services/connectRequestService.js';
import { saveJson, readJson, createTimestampedFilename } from './utils/fileSystem.js';
import { normalizeProfileUrl } from './utils/url.js';

async function loadSentRegistry(sentFilePath) {
  const data = await readJson(sentFilePath, { sentUrls: [], sentProfiles: [] });
  const urls = new Set([
    ...(data.sentUrls || []),
    ...(data.sentProfiles || []).map((e) => e.profileUrl).filter(Boolean),
  ].map(normalizeProfileUrl));
  return { data, urls };
}

async function main() {
  const logger = createLogger(config.paths.logs);
  const loginOnly = process.argv.includes('--login-only');
  const sentFilePath = path.join(config.paths.data, 'sent_connect_requests.json');

  logger.info('LinkedIn CONNECT request automation started', {
    accountId: config.accountId,
    role: config.connect.role,
    location: config.connect.location,
    maxPerRun: config.connect.maxPerRun,
    delayRangeMs: [config.connect.delayBetweenMinMs, config.connect.delayBetweenMaxMs],
    sendEnabled: config.connect.sendEnabled,
    sendNote: config.connect.sendNote,
    noteFallback: config.connect.noteFallback,
    loginOnly,
  });

  if (config.connect.sendEnabled) {
    if (config.connect.sendNote) {
      logger.warn('CONNECT_SEND_NOTE is true — personalized notes (max 200 chars on free LinkedIn)');
    } else {
      logger.info('Sending connects WITHOUT note (free account mode — unlimited invites)');
    }
  }

  let context;

  try {
    const launched = await launchBrowser(config, logger);
    context = launched.context;
    const { page } = launched;

    if (loginOnly) {
      await waitForManualLogin(page, logger);
      return;
    }

    await ensureLoggedIn(page, logger);

    const { data: sentData, urls: sentUrlSet } = await loadSentRegistry(sentFilePath);
    const sentProfiles = [...(sentData.sentProfiles || [])];

    logger.info('Loaded connect request registry', { alreadySentCount: sentUrlSet.size });

    async function onRequestSent(person, status) {
      sentProfiles.push({
        name: person.name,
        profileUrl: person.profileUrl,
        headline: person.headline || '',
        role: config.connect.role,
        location: config.connect.location,
        status,
        sentAt: new Date().toISOString(),
      });

      await saveJson(sentFilePath, {
        updatedAt: new Date().toISOString(),
        count: sentUrlSet.size,
        searchRole: config.connect.role,
        searchLocation: config.connect.location,
        sentUrls: Array.from(sentUrlSet),
        sentProfiles,
      });

      logger.info('Connect progress saved', { name: person.name, totalSent: sentUrlSet.size });
    }

    const { results, outputPath, note } = await processConnectRequests(
      page,
      config,
      logger,
      sentUrlSet,
      onRequestSent
    );

    const summaryPath = path.join(
      config.paths.data,
      createTimestampedFilename('connect-summary', 'json')
    );

    await saveJson(summaryPath, {
      completedAt: new Date().toISOString(),
      mode: 'connect',
      role: config.connect.role,
      location: config.connect.location,
      notePreview: note.slice(0, 200),
      candidatesFile: outputPath,
      sendEnabled: config.connect.sendEnabled,
      successCount: results.success.filter((r) => r.sent).length,
      skippedCount: results.skipped.length,
      failedCount: results.failed.length,
      totalSentAllTime: sentUrlSet.size,
      success: results.success,
      skipped: results.skipped,
      failed: results.failed,
    });

    logger.success('Connect run completed', {
      sent: results.success.filter((r) => r.sent).length,
      skipped: results.skipped.length,
      failed: results.failed.length,
      totalAllTime: sentUrlSet.size,
      summaryPath,
    });

    console.log('\n>>> Connect run finished. Press Enter to close the browser...\n');
    await new Promise((resolve) => process.stdin.once('data', resolve));
  } catch (error) {
    if (error instanceof AppError) {
      logger.error(error.message, { code: error.code });
    } else {
      logger.error('Unexpected error', { message: error.message, stack: error.stack });
    }
    process.exitCode = 1;
  } finally {
    await closeBrowser(context, logger);
  }
}

main();
