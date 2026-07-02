/**
 * DASHBOARD ROUTE — GET /api/dashboard
 * Returns aggregated summary stats for the home page cards.
 */

const express = require('express');
const router = express.Router();
const { queryOne, queryAll } = require('../database/db');
const runManager = require('../services/runManager');

router.get('/', (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayStartIso = todayStart.toISOString();

    const todayRuns = queryOne(`SELECT COUNT(*) as count FROM runs WHERE started_at >= ?`, [todayStartIso]);
    const todayConnections = queryOne(`SELECT COUNT(*) as count FROM connections c JOIN runs r ON c.run_id = r.id WHERE r.started_at >= ?`, [todayStartIso]);
    const todaySuccess = queryOne(`SELECT COUNT(*) as count FROM connections c JOIN runs r ON c.run_id = r.id WHERE c.status = 'success' AND r.started_at >= ?`, [todayStartIso]);
    const todayFailed = queryOne(`SELECT COUNT(*) as count FROM connections c JOIN runs r ON c.run_id = r.id WHERE c.status = 'failed' AND r.started_at >= ?`, [todayStartIso]);
    const todayRuntime = queryOne(`SELECT SUM(duration_ms) as total FROM runs WHERE started_at >= ? AND duration_ms IS NOT NULL`, [todayStartIso]);
    const totalSent = queryOne(`SELECT COUNT(*) as count FROM sent_registry`);
    const replyStats = queryOne(`
      SELECT
        SUM(CASE WHEN reply_status = 'replied' THEN 1 ELSE 0 END) as replied,
        SUM(CASE WHEN reply_status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN reply_status = 'no_reply' THEN 1 ELSE 0 END) as no_reply
      FROM sent_registry
    `);
    const totalRuns = queryOne(`SELECT COUNT(*) as count FROM runs`);
    const lastRun = queryOne(`SELECT * FROM runs ORDER BY created_at DESC LIMIT 1`);
    const avgDuration = queryOne(`SELECT AVG(duration_ms) as avg FROM runs WHERE duration_ms IS NOT NULL`);
    const successRate = queryOne(`
      SELECT ROUND(CAST(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS FLOAT) / MAX(COUNT(*), 1) * 100, 1) as rate
      FROM connections
    `);
    const pending = queryOne(`SELECT COUNT(*) as count FROM connections WHERE status = 'success' AND sent = 0`);
    const recentRuns = queryAll(`SELECT id, run_key, status, started_at, completed_at, duration_ms, success_count, failed_count, skipped_count FROM runs ORDER BY created_at DESC LIMIT 5`);

    res.json({
      automationRunning: runManager.isRunning,
      currentRun: runManager.currentRunInfo,
      today: {
        runs: todayRuns?.count || 0,
        connectionsProcessed: todayConnections?.count || 0,
        successful: todaySuccess?.count || 0,
        failed: todayFailed?.count || 0,
        runtimeMs: todayRuntime?.total || 0,
      },
      allTime: {
        totalSent: totalSent?.count || 0,
        totalReplied: replyStats?.replied || 0,
        pendingReplies: replyStats?.pending || 0,
        noReply: replyStats?.no_reply || 0,
        replyRate: totalSent?.count > 0
          ? Math.round((replyStats.replied / totalSent.count) * 1000) / 10
          : 0,
        totalRuns: totalRuns?.count || 0,
        successRate: successRate?.rate || 0,
        avgDurationMs: Math.round(avgDuration?.avg || 0),
        pendingReview: pending?.count || 0,
      },
      lastRun: lastRun || null,
      recentRuns: recentRuns || [],
    });
  } catch (err) {
    console.error('[Dashboard] Error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data', message: err.message });
  }
});

module.exports = router;
