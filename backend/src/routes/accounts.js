/**
 * ACCOUNTS ROUTE — multi-account management
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const { spawn } = require('child_process');
const { run, queryOne } = require('../database/db');
const { listAccounts, getActiveAccountId, getPathsForAccount, sanitizeAccountId, PROJECT_ROOT } = require('../utils/accountPaths');
const { writeEnvFromDb } = require('../utils/writeEnv');
const { importAccountData } = require('../services/dataImporter');
const runManager = require('../services/runManager');

router.get('/', (req, res) => {
  try {
    const activeId = getActiveAccountId();
    const accounts = listAccounts().map((a) => ({
      id: a.id,
      label: a.label || a.id,
      isActive: a.id === activeId,
      hasProfile: a.hasProfile,
      isLoggedIn: a.isLoggedIn,
      sentCount: a.sentCount,
      lastActive: a.lastActive,
      browserProfile: a.browserProfileRel,
      dataDir: a.dataDir.replace(PROJECT_ROOT, '.').replace(/\\/g, '/'),
    }));
    res.json({ activeAccountId: activeId, accounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/switch', (req, res) => {
  try {
    if (runManager.isRunning) {
      return res.status(409).json({ error: 'Stop the running automation before switching accounts' });
    }
    const { accountId } = req.body;
    if (!accountId) return res.status(400).json({ error: 'accountId is required' });

    const id = sanitizeAccountId(accountId);
    run(
      `INSERT INTO settings (key, value, updated_at) VALUES ('LINKEDIN_ACCOUNT_ID', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [id]
    );
    writeEnvFromDb();
    const imported = importAccountData(id);
    const paths = getPathsForAccount(id);

    res.json({
      success: true,
      accountId: id,
      message: `Switched to account "${id}"`,
      imported,
      paths: {
        dataDir: paths.dataDir,
        browserProfile: paths.browserProfileRel,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', (req, res) => {
  try {
    if (runManager.isRunning) {
      return res.status(409).json({ error: 'Stop automation before login' });
    }
    const id = sanitizeAccountId(req.body.accountId || getActiveAccountId());
    run(
      `INSERT INTO settings (key, value, updated_at) VALUES ('LINKEDIN_ACCOUNT_ID', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [id]
    );
    writeEnvFromDb();

    const child = spawn('node', ['src/index.js', '--login-only'], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, LINKEDIN_ACCOUNT_ID: id },
      detached: true,
      stdio: 'ignore',
      shell: process.platform === 'win32',
    });
    child.unref();

    res.json({
      success: true,
      accountId: id,
      message: `Login window opened for "${id}". Sign in to LinkedIn in the browser, then press Enter in the terminal.`,
      pid: child.pid,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/health', (req, res) => {
  try {
    const activeId = getActiveAccountId();
    const paths = getPathsForAccount(activeId);
    const dailyFile = require('path').join(paths.dataDir, 'daily_usage.json');
    let daily = { messages: 0, connects: 0 };
    if (fs.existsSync(dailyFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(dailyFile, 'utf-8'));
        const today = new Date().toISOString().slice(0, 10);
        daily = data.days?.[today] || daily;
      } catch { /* ignore */ }
    }

    const limits = {
      messages: parseInt(queryOne("SELECT value FROM settings WHERE key = 'DAILY_MESSAGE_LIMIT'")?.value || '25', 10),
      connects: parseInt(queryOne("SELECT value FROM settings WHERE key = 'DAILY_CONNECT_LIMIT'")?.value || '15', 10),
    };

    res.json({
      accountId: activeId,
      hasBrowserProfile: fs.existsSync(paths.browserProfile),
      hasDataDir: fs.existsSync(paths.dataDir),
      sentFileExists: fs.existsSync(paths.sentConnections),
      progressExists: fs.existsSync(paths.progressState),
      dailyUsage: daily,
      dailyLimits: limits,
      automationRunning: runManager.isRunning,
      ready: fs.existsSync(paths.browserProfile),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
