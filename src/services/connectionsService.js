import path from 'node:path';
import {
  extractConnectionsFromPage,
  navigateToConnections,
} from '../automation/connections.js';
import { saveJson, createTimestampedFilename, readJson } from '../utils/fileSystem.js';
import { normalizeProfileUrl } from '../utils/url.js';

export async function loadProgressState(progressPath) {
  return readJson(progressPath, { lastAnchorUrl: null, lastAnchorName: null });
}

export async function saveProgressAnchor(progressPath, connection) {
  await saveJson(progressPath, {
    updatedAt: new Date().toISOString(),
    lastAnchorUrl: normalizeProfileUrl(connection.profileUrl),
    lastAnchorName: connection.name,
  });
}

export async function fetchAndSaveConnections(page, config, sentUrls, logger) {
  await navigateToConnections(page, config.linkedin.connectionsUrl, logger);

  const progressPath = path.join(config.paths.data, 'progress_state.json');
  const progress = await loadProgressState(progressPath);

  if (progress.lastAnchorUrl) {
    logger.info('Resuming from saved anchor', {
      anchor: progress.lastAnchorName || progress.lastAnchorUrl,
    });
  } else {
    logger.info('No anchor yet — will find deepest already-messaged person in list order');
  }

  const { connections, anchorName, ordered, anchorIndex } = await extractConnectionsFromPage(
    page,
    config.automation.maxConnections,
    config.automation.scrollPauseMs,
    config.automation.maxScrollAttempts,
    sentUrls,
    progress.lastAnchorUrl,
    logger
  );

  const filename = createTimestampedFilename('connections', 'json');
  const outputPath = path.join(config.paths.data, filename);

  await saveJson(outputPath, {
    exportedAt: new Date().toISOString(),
    strategy: 'below-anchor',
    anchor: anchorName,
    anchorIndex,
    count: connections.length,
    connections,
    listSnapshotSize: ordered.length,
  });

  logger.success('Connections saved to file', { outputPath });

  return { connections, outputPath, progressPath };
}
