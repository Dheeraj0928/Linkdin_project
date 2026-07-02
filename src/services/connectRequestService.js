import path from 'node:path';
import { runConnectCampaign } from '../automation/connectRequest.js';
import { readTextFile, saveJson, createTimestampedFilename } from '../utils/fileSystem.js';

const DEFAULT_NOTE = `Hi, I'm Dheeraj, a final-year Computer Science (AI/ML) student looking for Software Engineer opportunities. I admire your team's work and would appreciate any guidance or consideration for relevant openings. Thank you!`;

export function personalizeConnectNote(template, role) {
  const roleText = role?.trim() || 'Software Engineer';
  return template
    .replace(/\{\{\s*role\s*\}\}/gi, roleText)
    .replace(/\{\s*role\s*\}/gi, roleText)
    .trim()
    .slice(0, 300);
}

export async function loadConnectNoteTemplate(templatesPath) {
  const content = await readTextFile(path.join(templatesPath, 'connect-note.txt'), DEFAULT_NOTE);
  return content.trim() || DEFAULT_NOTE;
}

export async function processConnectRequests(page, config, logger, sentUrlSet, onRequestSent) {
  const template = await loadConnectNoteTemplate(config.paths.templates);
  const note = personalizeConnectNote(template, config.connect.role);
  const excludeUrls = Array.from(sentUrlSet);

  const results = await runConnectCampaign(
    page,
    config,
    note,
    sentUrlSet,
    excludeUrls,
    logger,
    onRequestSent
  );

  const outputPath = path.join(
    config.paths.data,
    createTimestampedFilename('connect-candidates', 'json')
  );

  await saveJson(outputPath, {
    exportedAt: new Date().toISOString(),
    role: config.connect.role,
    location: config.connect.location,
    notePreview: note.slice(0, 200),
    successCount: results.success.filter((r) => r.sent).length,
    skippedCount: results.skipped.length,
    failedCount: results.failed.length,
  });

  return { results, outputPath, note };
}
