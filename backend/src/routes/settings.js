/**
 * SETTINGS ROUTE
 * GET  /api/settings  — all settings
 * POST /api/settings  — update settings + write .env
 */

const express = require('express');
const router = express.Router();
const { queryAll, run } = require('../database/db');
const { writeEnvFromDb } = require('../utils/writeEnv');

const ALLOWED_SETTINGS = [
  'LINKEDIN_ACCOUNT_ID',
  'MAX_CONNECTIONS', 'MAX_SCROLL_ATTEMPTS', 'DELAY_BETWEEN_PROFILES_MS',
  'DELAY_BETWEEN_PROFILES_MIN_MS', 'DELAY_BETWEEN_PROFILES_MAX_MS',
  'ACTION_DELAY_MS', 'TYPE_FALLBACK_DELAY_MS', 'PAGE_TIMEOUT_MS',
  'SCROLL_PAUSE_MS', 'SEND_ENABLED', 'HEADLESS', 'BROWSER_PROFILE_DIR',
  'LINKEDIN_CONNECTIONS_URL', 'RESUME_URL',
  'DAILY_MESSAGE_LIMIT', 'DAILY_CONNECT_LIMIT',
];

router.get('/', (req, res) => {
  try {
    const rows = queryAll('SELECT key, value FROM settings');
    const settings = {};
    for (const row of (rows || [])) { settings[row.key] = row.value; }
    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', (req, res) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      if (ALLOWED_SETTINGS.includes(key)) {
        run(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
          [key, String(value)]);
      }
    }

    writeEnvFromDb();

    res.json({ success: true, message: '.env updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
