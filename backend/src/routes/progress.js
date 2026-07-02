/**
 * PROGRESS ROUTE — anchor position + outreach summary (account-aware)
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const { queryOne, queryAll, run } = require('../database/db');
const { importSentRegistry } = require('../services/dataImporter');
const { getActivePaths } = require('../utils/accountPaths');

function readJsonSafe(filePath, fallback = {}) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

router.get('/', (req, res) => {
  try {
    const paths = getActivePaths();
    const progress = readJsonSafe(paths.progressState, {});
    const sentFile = readJsonSafe(paths.sentConnections, { sentProfiles: [], count: 0 });

    importSentRegistry(paths.accountId);

    const sentProfiles = sentFile.sentProfiles || [];
    const messaged = sentProfiles.filter((p) => !p.status || p.status === 'sent');
    const skippedThreads = sentProfiles.filter((p) => p.status === 'skipped_thread').length;

    // Use active account's file as source of truth (not mixed SQLite from other accounts)
    const totalSent = messaged.length || sentFile.count || 0;

    const repliedFromFile = messaged.filter((p) => p.reply_status === 'replied').length;
    const replyStats = queryOne(`
      SELECT
        SUM(CASE WHEN reply_status = 'replied' THEN 1 ELSE 0 END) as replied,
        SUM(CASE WHEN reply_status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN reply_status = 'no_reply' THEN 1 ELSE 0 END) as no_reply
      FROM sent_registry
    `);

    const replied = repliedFromFile || replyStats?.replied || 0;
    const replyRate = totalSent > 0 ? Math.round((replied / totalSent) * 1000) / 10 : 0;

    const recentSent = messaged
      .slice()
      .sort((a, b) => new Date(b.sentAt || 0) - new Date(a.sentAt || 0))
      .slice(0, 8)
      .map((p) => ({
        name: p.name,
        profile_url: p.profileUrl,
        sent_at: p.sentAt,
        reply_status: p.reply_status || 'pending',
        replied_at: p.replied_at || null,
      }));

    const settings = queryAll("SELECT key, value FROM settings WHERE key IN ('MAX_CONNECTIONS', 'SEND_ENABLED', 'RESUME_URL', 'LINKEDIN_ACCOUNT_ID', 'DAILY_MESSAGE_LIMIT')");
    const cfg = Object.fromEntries((settings || []).map((r) => [r.key, r.value]));

    let dailyMessages = 0;
    const dailyFile = require('path').join(paths.dataDir, 'daily_usage.json');
    if (fs.existsSync(dailyFile)) {
      try {
        const d = JSON.parse(fs.readFileSync(dailyFile, 'utf-8'));
        const today = new Date().toISOString().slice(0, 10);
        dailyMessages = d.days?.[today]?.messages || 0;
      } catch { /* ignore */ }
    }

    res.json({
      accountId: paths.accountId,
      anchor: {
        name: progress.lastAnchorName || null,
        url: progress.lastAnchorUrl || null,
        updatedAt: progress.updatedAt || null,
      },
      outreach: {
        totalSent,
        skippedThreads,
        replied,
        pending: Math.max(0, totalSent - replied),
        noReply: replyStats?.no_reply || 0,
        replyRate,
        maxPerRun: parseInt(cfg.MAX_CONNECTIONS || '20', 10),
        dailyLimit: parseInt(cfg.DAILY_MESSAGE_LIMIT || '25', 10),
        dailyUsed: dailyMessages,
        sendEnabled: cfg.SEND_ENABLED === 'true',
        resumeUrl: cfg.RESUME_URL || null,
      },
      recentSent,
      sentFileCount: totalSent,
      connectionCountHint: totalSent === 0 && !progress.lastAnchorUrl
        ? 'New account — will message from top of connections list'
        : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reset-anchor', (req, res) => {
  try {
    const { progressState } = getActivePaths();
    if (fs.existsSync(progressState)) fs.unlinkSync(progressState);
    res.json({ success: true, message: 'Anchor reset — next run starts from list top' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sync', (req, res) => {
  try {
    const paths = getActivePaths();
    const count = importSentRegistry(paths.accountId);
    res.json({ success: true, imported: count, accountId: paths.accountId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
