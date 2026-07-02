/**
 * CONNECT ROUTE — connection request campaigns (account-aware)
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { queryAll, run } = require('../database/db');
const { writeEnvFromDb } = require('../utils/writeEnv');
const { getActivePaths, PROJECT_ROOT } = require('../utils/accountPaths');
const runManager = require('../services/runManager');

const NOTE_FILE = path.join(PROJECT_ROOT, 'src/templates/connect-note.txt');

const CONNECT_SETTINGS = [
  'CONNECT_ROLE', 'CONNECT_LOCATION', 'CONNECT_MAX_PER_RUN',
  'CONNECT_DELAY_MS', 'CONNECT_DELAY_MIN_MS', 'CONNECT_DELAY_MAX_MS',
  'CONNECT_SEND_ENABLED', 'CONNECT_SEND_NOTE', 'CONNECT_NOTE_FALLBACK',
  'DAILY_CONNECT_LIMIT',
];

function readSentFile() {
  const { sentConnectRequests } = getActivePaths();
  try {
    if (!fs.existsSync(sentConnectRequests)) return { sentProfiles: [], count: 0, sentUrls: [] };
    return JSON.parse(fs.readFileSync(sentConnectRequests, 'utf-8'));
  } catch {
    return { sentProfiles: [], count: 0, sentUrls: [] };
  }
}

router.get('/settings', (req, res) => {
  try {
    const rows = queryAll(`SELECT key, value FROM settings WHERE key IN (${CONNECT_SETTINGS.map(() => '?').join(',')})`, CONNECT_SETTINGS);
    const settings = Object.fromEntries((rows || []).map((r) => [r.key, r.value]));
    let noteTemplate = '';
    try { noteTemplate = fs.readFileSync(NOTE_FILE, 'utf-8'); } catch {}
    res.json({ settings, noteTemplate, accountId: getActivePaths().accountId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/settings', (req, res) => {
  try {
    const { settings = {}, noteTemplate } = req.body;

    for (const [key, value] of Object.entries(settings)) {
      if (CONNECT_SETTINGS.includes(key)) {
        run(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
          [key, String(value)]);
      }
    }

    if (typeof noteTemplate === 'string') {
      fs.mkdirSync(path.dirname(NOTE_FILE), { recursive: true });
      fs.writeFileSync(NOTE_FILE, noteTemplate, 'utf-8');
    }

    writeEnvFromDb();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sent', (req, res) => {
  try {
    const data = readSentFile();
    const { page = 1, limit = 30, search = '' } = req.query;
    let profiles = data.sentProfiles || [];

    if (search) {
      const q = search.toLowerCase();
      profiles = profiles.filter((p) =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.profileUrl || '').toLowerCase().includes(q) ||
        (p.location || '').toLowerCase().includes(q)
      );
    }

    profiles.sort((a, b) => new Date(b.sentAt || 0) - new Date(a.sentAt || 0));
    const total = profiles.length;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const rows = profiles.slice(offset, offset + parseInt(limit, 10));

    res.json({
      rows,
      total,
      count: data.count || total,
      searchRole: data.searchRole,
      searchLocation: data.searchLocation,
      accountId: getActivePaths().accountId,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stats', (req, res) => {
  try {
    const data = readSentFile();
    const profiles = data.sentProfiles || [];
    const sent = profiles.filter((p) => p.status === 'sent').length;
    const skipped = profiles.filter((p) => p.status !== 'sent').length;
    res.json({
      total: data.count || profiles.length,
      sent,
      skipped,
      searchRole: data.searchRole || '',
      searchLocation: data.searchLocation || '',
      accountId: getActivePaths().accountId,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/start', (req, res) => {
  try {
    if (runManager.isRunning) return res.status(409).json({ error: 'Automation is already running' });
    const runKey = runManager.startConnectRun();
    res.json({ success: true, runKey, message: 'Connect request campaign started' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
