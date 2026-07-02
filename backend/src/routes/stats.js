/**
 * STATS ROUTE — GET /api/stats?period=daily|weekly|monthly
 * Time-series data for Analytics charts using SQLite strftime().
 */

const express = require('express');
const router = express.Router();
const { queryOne, queryAll } = require('../database/db');

router.get('/', (req, res) => {
  try {
    const { period = 'daily' } = req.query;

    const dateFormat = period === 'monthly' ? '%Y-%m' : period === 'weekly' ? '%Y-W%W' : '%Y-%m-%d';
    const daysBack = period === 'monthly' ? 365 : period === 'weekly' ? 90 : 30;
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - daysBack);
    const fromIso = fromDate.toISOString();

    const profilesPerPeriod = queryAll(`
      SELECT strftime(?, r.started_at) as period,
             COUNT(c.id) as total,
             SUM(CASE WHEN c.status = 'success' THEN 1 ELSE 0 END) as success,
             SUM(CASE WHEN c.status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM connections c
      JOIN runs r ON c.run_id = r.id
      WHERE r.started_at >= ?
      GROUP BY period ORDER BY period ASC
    `, [dateFormat, fromIso]);

    const runsPerPeriod = queryAll(`
      SELECT strftime(?, started_at) as period,
             COUNT(*) as count,
             AVG(duration_ms) as avg_duration_ms
      FROM runs WHERE started_at >= ?
      GROUP BY period ORDER BY period ASC
    `, [dateFormat, fromIso]);

    const topErrors = queryAll(`
      SELECT error_code, COUNT(*) as count FROM connections
      WHERE status = 'failed' AND error_code IS NOT NULL
      GROUP BY error_code ORDER BY count DESC LIMIT 10
    `);

    const successRateTrend = (profilesPerPeriod || []).map(row => ({
      period: row.period,
      rate: row.total > 0 ? Math.round((row.success / row.total) * 100) : 0,
    }));

    const repliedPerPeriod = queryAll(`
      SELECT strftime(?, replied_at) as period, COUNT(*) as count
      FROM sent_registry
      WHERE reply_status = 'replied' AND replied_at >= ?
      GROUP BY period ORDER BY period ASC
    `, [dateFormat, fromIso]);

    const replyTotals = queryOne(`
      SELECT
        COUNT(*) as total_sent,
        SUM(CASE WHEN reply_status = 'replied' THEN 1 ELSE 0 END) as replied,
        SUM(CASE WHEN reply_status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN reply_status = 'no_reply' THEN 1 ELSE 0 END) as no_reply
      FROM sent_registry
    `);

    const totals = queryOne(`
      SELECT COUNT(*) as totalConnections,
             SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as totalSuccess,
             SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as totalFailed
      FROM connections
    `);

    res.json({
      period,
      profilesPerPeriod,
      runsPerPeriod,
      successRateTrend,
      topErrors,
      repliedPerPeriod,
      replyTotals,
      totals,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
