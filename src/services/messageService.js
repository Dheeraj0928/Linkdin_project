import path from 'node:path';
import {
  openProfile,
  openMessageCompose,
  closeMessageOverlay,
  closeAllMessageOverlays,
  extractCompanyFromProfile,
  extractNameFromProfile,
} from '../automation/profile.js';
import { draftMessage, hasExistingConversation } from '../automation/message.js';
import { loadMessageTemplate, personalizeMessage } from '../utils/template.js';
import { normalizeProfileUrl } from '../utils/url.js';
import { humanDelay } from '../utils/delay.js';
import { checkDailyLimit, incrementDailyUsage } from '../utils/dailyLimit.js';
import { AppError } from '../browser/launcher.js';

export async function processConnectionMessages(
  page,
  connections,
  config,
  logger,
  { onMessageSent, onSkippedThread, onAnchorAdvance },
  sentUrlSet
) {
  const template = await loadMessageTemplate(path.join(config.paths.templates, 'message.txt'));
  const results = { success: [], skipped: [], failed: [] };
  const dailyLimit = config.automation.dailyMessageLimit;

  for (let index = 0; index < connections.length; index += 1) {
    const limitCheck = await checkDailyLimit(config.paths.data, 'messages', dailyLimit, logger);
    if (!limitCheck.allowed) {
      logger.warn('Stopping run — daily message limit reached');
      break;
    }

    const connection = connections[index];
    const label = `${index + 1}/${connections.length}`;
    const profileKey = normalizeProfileUrl(connection.profileUrl);

    if (sentUrlSet?.has(profileKey)) continue;

    logger.info(`Processing ${label}`, connection);

    try {
      await openProfile(page, connection.profileUrl, logger);
      const profileName = (await extractNameFromProfile(page)) || connection.name;
      const company = await extractCompanyFromProfile(page, logger);
      await openMessageCompose(page, { ...connection, name: profileName }, logger);

      if (await hasExistingConversation(page)) {
        logger.info(`Skip ${connection.name} — already has messages in thread`);
        sentUrlSet.add(profileKey);
        if (onSkippedThread) await onSkippedThread(connection);
        if (onAnchorAdvance) await onAnchorAdvance(connection);
        results.skipped.push({ ...connection, reason: 'existing_thread' });
        await closeMessageOverlay(page);
        if (index < connections.length - 1) {
          await humanDelay(
            config.automation.delayBetweenProfilesMinMs,
            config.automation.delayBetweenProfilesMaxMs,
            logger,
            'next profile'
          );
        }
        continue;
      }

      const messageText = personalizeMessage(template, {
        name: profileName,
        company,
        resumeUrl: config.linkedin.resumeUrl,
      });
      logger.info('Personalized message', {
        name: profileName,
        preview: messageText.slice(0, 40),
      });
      const outcome = await draftMessage(page, messageText, config.automation.sendEnabled, logger);

      if (config.automation.sendEnabled && !outcome.sent) {
        throw new AppError('Message was not sent', 'SEND_FAILED');
      }

      if (outcome.sent) {
        sentUrlSet.add(profileKey);
        if (onMessageSent) await onMessageSent(connection);
        if (onAnchorAdvance) await onAnchorAdvance(connection);
        await incrementDailyUsage(config.paths.data, 'messages');
        results.success.push({ ...connection, messagePreview: messageText.slice(0, 120), sent: true });
        logger.success(`Done ${label}`, { name: connection.name });
      } else {
        results.skipped.push({ ...connection, messagePreview: messageText.slice(0, 120), sent: false, reason: 'draft_only' });
        logger.info(`Drafted ${label} (send disabled)`, { name: connection.name });
      }

      await closeMessageOverlay(page);
    } catch (error) {
      const reason = error instanceof AppError ? error.message : error.message || 'Unknown';
      results.failed.push({ ...connection, error: reason, code: error instanceof AppError ? error.code : 'UNKNOWN' });
      logger.error(`Failed ${label}`, { name: connection.name, reason });
      await closeAllMessageOverlays(page).catch(() => {});
    }

    if (index < connections.length - 1) {
      await humanDelay(
        config.automation.delayBetweenProfilesMinMs,
        config.automation.delayBetweenProfilesMaxMs,
        logger,
        'next profile'
      );
    }
  }

  return results;
}
