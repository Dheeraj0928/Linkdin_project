/**
 * DATA IMPORTER SERVICE — account-aware JSON/log → SQLite
 */
const fs = require('fs');
const path = require('path');
const { queryOne, run } = require('../database/db');
const { getActivePaths, getPathsForAccount, sanitizeAccountId } = require('../utils/accountPaths');

function extractRunKey(filename) {
  const match = filename.match(/(\d{4}-\d{2}-\d{2}T[\d-]+Z)/);
  return match ? match[1] : null;
}

function runKeyToIso(runKey) {
  if (!runKey) return null;
  return runKey.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/, 'T$1:$2:$3.$4Z');
}

function parseLogLine(line) {
  const match = line.match(/^\[(.+?)\]\s+\[(\w+)\]\s+(.+?)(?:\s+(\{.+\}))?$/);
  if (!match) return null;
  return {
    logged_at: match[1],
    level: match[2],
    message: match[3].trim(),
    meta: match[4] || null,
  };
}

function importSentRegistryForAccount(accountId) {
  const { sentConnections, dataDir } = getPathsForAccount(accountId);
  if (!fs.existsSync(sentConnections)) return 0;

  let data;
  try {
    data = JSON.parse(fs.readFileSync(sentConnections, 'utf-8'));
  } catch {
    return 0;
  }

  let count = 0;
  for (const p of (data.sentProfiles || [])) {
    if (!p.profileUrl) continue;
  const status = p.status || 'sent';
    if (status === 'skipped_thread') continue;
    try {
      run(
        `INSERT OR IGNORE INTO sent_registry (name, profile_url, sent_at, reply_status)
         VALUES (?, ?, ?, 'pending')`,
        [p.name || '', p.profileUrl.toLowerCase().replace(/\/$/, ''), p.sentAt || null]
      );
      count++;
    } catch { /* ignore dupes */ }
  }
  return count;
}

function importSentRegistry(accountId) {
  const id = accountId || getActivePaths().accountId;
  return importSentRegistryForAccount(id);
}

function importRunSummary(filePath, runType = 'messages') {
  const filename = path.basename(filePath);
  const runKey = extractRunKey(filename);
  if (!runKey) return null;

  const uniqueKey = `${runType}:${runKey}`;
  const existing = queryOne('SELECT id FROM runs WHERE run_key = ?', [uniqueKey]);
  if (existing) return existing.id;

  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }

  const startedIso = runKeyToIso(runKey);
  const completedIso = data.completedAt || startedIso;
  const startedMs = startedIso ? new Date(startedIso).getTime() : null;
  const completedMs = completedIso ? new Date(completedIso).getTime() : null;
  const durationMs = (startedMs && completedMs) ? completedMs - startedMs : null;

  const successCount = data.successCount ?? (data.success || []).length;
  const failedCount = data.failedCount ?? (data.failed || []).length;

  run(
    `INSERT OR IGNORE INTO runs
      (run_key, status, started_at, completed_at, duration_ms,
       success_count, failed_count, skipped_count, send_enabled, connections_file)
    VALUES (?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uniqueKey, startedIso, completedIso, durationMs,
      successCount, failedCount,
      data.skippedAlreadySent || data.skippedCount || 0,
      data.sendEnabled !== false ? 1 : 0,
      data.connectionsFile || data.candidatesFile || null,
    ]
  );

  const runRow = queryOne('SELECT id FROM runs WHERE run_key = ?', [uniqueKey]);
  if (!runRow) return null;
  const runId = runRow.id;

  for (const item of (data.success || [])) {
    try {
      run(
        `INSERT OR IGNORE INTO connections
          (run_id, name, profile_url, status, message_preview, sent, sent_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          runId, item.name || '',
          (item.profileUrl || '').toLowerCase().replace(/\/$/, ''),
          item.sent === false ? 'skipped' : 'success',
          item.messagePreview || item.notePreview || null,
          item.sent !== false && data.sendEnabled !== false ? 1 : 0,
          data.completedAt || item.sentAt || null,
        ]
      );
    } catch { /* ignore */ }
  }

  for (const item of (data.failed || [])) {
    try {
      run(
        `INSERT OR IGNORE INTO connections
          (run_id, name, profile_url, status, error_message, error_code, sent)
        VALUES (?, ?, ?, 'failed', ?, ?, 0)`,
        [
          runId, item.name || '',
          (item.profileUrl || '').toLowerCase().replace(/\/$/, ''),
          item.error || item.reason || '', item.code || 'UNKNOWN',
        ]
      );
    } catch { /* ignore */ }
  }

  return runId;
}

function importLogFile(filePath) {
  const filename = path.basename(filePath);
  const runKey = extractRunKey(filename);
  if (!runKey) return 0;

  const existing = queryOne('SELECT COUNT(*) as c FROM logs WHERE run_key = ?', [runKey]);
  if (existing && existing.c > 0) return 0;

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return 0;
  }

  let runRow = queryOne('SELECT id FROM runs WHERE run_key LIKE ?', [`%${runKey}`]);
  if (!runRow) {
    const startedIso = runKeyToIso(runKey);
    run(`INSERT OR IGNORE INTO runs (run_key, status, started_at) VALUES (?, 'completed', ?)`,
      [`messages:${runKey}`, startedIso]);
    runRow = queryOne('SELECT id FROM runs WHERE run_key = ?', [`messages:${runKey}`]);
  }

  const runId = runRow?.id || null;
  let count = 0;

  for (const line of content.split('\n')) {
    if (!line.trim() || line.startsWith('===')) continue;
    const parsed = parseLogLine(line);
    if (!parsed) continue;
    try {
      run(
        'INSERT INTO logs (run_id, run_key, level, message, meta, logged_at) VALUES (?, ?, ?, ?, ?, ?)',
        [runId, runKey, parsed.level, parsed.message, parsed.meta, parsed.logged_at]
      );
      count++;
    } catch { /* ignore */ }
  }

  return count;
}

function importFromDirectory(paths) {
  let runCount = 0;
  let logCount = 0;

  if (fs.existsSync(paths.dataDir)) {
    const files = fs.readdirSync(paths.dataDir);
    for (const file of files) {
      if (file.startsWith('run-summary-') && file.endsWith('.json')) {
        if (importRunSummary(path.join(paths.dataDir, file), 'messages')) runCount++;
      }
      if (file.startsWith('connect-summary-') && file.endsWith('.json')) {
        if (importRunSummary(path.join(paths.dataDir, file), 'connect')) runCount++;
      }
    }
  }

  if (fs.existsSync(paths.logsDir)) {
    for (const file of fs.readdirSync(paths.logsDir)) {
      if (file.startsWith('run-') && file.endsWith('.log')) {
        logCount += importLogFile(path.join(paths.logsDir, file));
      }
    }
  }

  const sentCount = importSentRegistryForAccount(paths.accountId);
  return { runCount, logCount, sentCount };
}

function runInitialImport() {
  console.log('[Importer] Starting account-aware data import...');
  const active = getActivePaths();
  const result = importFromDirectory(active);
  console.log(`[Importer] Account "${active.accountId}": ${result.sentCount} sent, ${result.runCount} runs, ${result.logCount} log lines`);
  console.log('[Importer] Import complete ✓');
}

function importAccountData(accountId) {
  const paths = getPathsForAccount(sanitizeAccountId(accountId));
  return importFromDirectory(paths);
}

function importSingleRunSummary(filePath) {
  const base = path.basename(filePath);
  const type = base.startsWith('connect-summary') ? 'connect' : 'messages';
  importRunSummary(filePath, type);
  importSentRegistry();
}

function importSingleLogFile(filePath) {
  importLogFile(filePath);
}

module.exports = {
  runInitialImport,
  importAccountData,
  importSingleRunSummary,
  importSingleLogFile,
  importSentRegistry,
  getActivePaths,
};
