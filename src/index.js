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
import { fetchAndSaveConnections, saveProgressAnchor } from './services/connectionsService.js';
import { processConnectionMessages } from './services/messageService.js';
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
  const sentFilePath = path.join(config.paths.data, 'sent_connections.json');
  const progressPath = path.join(config.paths.data, 'progress_state.json');

  logger.info('LinkedIn automation started', {
    accountId: config.accountId,
    sendEnabled: config.automation.sendEnabled,
    maxConnections: config.automation.maxConnections,
    dailyMessageLimit: config.automation.dailyMessageLimit,
    delayRangeMs: [
      config.automation.delayBetweenProfilesMinMs,
      config.automation.delayBetweenProfilesMaxMs,
    ],
    maxScrollAttempts: config.automation.maxScrollAttempts,
    loginOnly,
  });

  if (config.automation.sendEnabled) {
    logger.warn('SEND_ENABLED is true — messages will be sent automatically');
  } else {
    logger.info('Draft mode active — messages will NOT be sent automatically');
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
    const excludeUrls = Array.from(sentUrlSet);

    logger.info('Loaded sent registry', {
      alreadySentCount: excludeUrls.length,
      sentFilePath,
    });

    const { connections, outputPath } = await fetchAndSaveConnections(
      page,
      config,
      excludeUrls,
      logger
    );

    const sentProfiles = [...(sentData.sentProfiles || [])];

    async function persistRegistry() {
      await saveJson(sentFilePath, {
        updatedAt: new Date().toISOString(),
        accountId: config.accountId,
        count: sentUrlSet.size,
        sentUrls: Array.from(sentUrlSet),
        sentProfiles,
      });
    }

    async function onMessageSent(connection) {
      sentProfiles.push({
        name: connection.name,
        profileUrl: connection.profileUrl,
        status: 'sent',
        sentAt: new Date().toISOString(),
      });
      await persistRegistry();
      logger.info('Message sent & saved', { name: connection.name, totalTracked: sentUrlSet.size });
    }

    async function onSkippedThread(connection) {
      sentProfiles.push({
        name: connection.name,
        profileUrl: connection.profileUrl,
        status: 'skipped_thread',
        sentAt: new Date().toISOString(),
      });
      await persistRegistry();
      logger.info('Skipped existing thread — marked to avoid retry', { name: connection.name });
    }

    async function onAnchorAdvance(connection) {
      await saveProgressAnchor(progressPath, connection);
      logger.info('Anchor moved down', { name: connection.name });
    }

    const results = await processConnectionMessages(
      page,
      connections,
      config,
      logger,
      { onMessageSent, onSkippedThread, onAnchorAdvance },
      sentUrlSet
    );

    const summaryPath = path.join(
      config.paths.data,
      createTimestampedFilename('run-summary', 'json')
    );

    await saveJson(summaryPath, {
      completedAt: new Date().toISOString(),
      accountId: config.accountId,
      connectionsFile: outputPath,
      sendEnabled: config.automation.sendEnabled,
      skippedAlreadySent: excludeUrls.length,
      successCount: results.success.length,
      skippedCount: results.skipped.length,
      failedCount: results.failed.length,
      totalSentAllTime: sentUrlSet.size,
      success: results.success,
      skipped: results.skipped,
      failed: results.failed,
    });

    logger.success('Run completed', {
      successCount: results.success.length,
      skippedCount: results.skipped.length,
      failedCount: results.failed.length,
      skippedAlreadySent: excludeUrls.length,
      totalSentAllTime: sentUrlSet.size,
      summaryPath,
    });

    if (results.failed.length > 0) {
      logger.warn('Some connections failed — check the summary JSON and logs');
    }

    console.log('\n>>> Run finished. Press Enter to close the browser...\n');

    await new Promise((resolve) => {
      process.stdin.once('data', resolve);
    });
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
