/**
 * CONNECTIONS ROUTE
 * GET  /api/connections       — processed profiles
 * GET  /api/connections/sent    — sent registry + reply status
 * GET  /api/connections/stats   — outreach summary
 * PATCH /api/connections/sent/:id/reply — mark reply status
 */

const express = require('express');
const router = express.Router();
const { queryOne, queryAll, run } = require('../database/db');

router.get('/stats', (req, res) => {
  try {
    const stats = queryOne(`
      SELECT
        COUNT(*) as total_sent,
        SUM(CASE WHEN reply_status = 'replied' THEN 1 ELSE 0 END) as replied,
        SUM(CASE WHEN reply_status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN reply_status = 'no_reply' THEN 1 ELSE 0 END) as no_reply
      FROM sent_registry
    `);
    const total = stats?.total_sent || 0;
    res.json({
      ...stats,
      reply_rate: total > 0 ? Math.round((stats.replied / total) * 1000) / 10 : 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/sent/:id/reply', (req, res) => {
  try {
    const { reply_status } = req.body;
    const allowed = ['pending', 'replied', 'no_reply'];
    if (!allowed.includes(reply_status)) {
      return res.status(400).json({ error: 'reply_status must be pending, replied, or no_reply' });
    }

    const existing = queryOne('SELECT * FROM sent_registry WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const repliedAt = reply_status === 'replied' ? new Date().toISOString() : null;
    run(
      'UPDATE sent_registry SET reply_status = ?, replied_at = ? WHERE id = ?',
      [reply_status, repliedAt, req.params.id]
    );

    const updated = queryOne('SELECT * FROM sent_registry WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sent', (req, res) => {
  try {
    const { search, page = 1, limit = 20, reply_status = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    const conditions = [];

    if (search) {
      conditions.push('(name LIKE ? OR profile_url LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (reply_status) {
      conditions.push('reply_status = ?');
      params.push(reply_status);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = queryAll(
      `SELECT * FROM sent_registry ${whereClause} ORDER BY sent_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    const total = queryOne(`SELECT COUNT(*) as count FROM sent_registry ${whereClause}`, params);

    const replyCounts = queryOne(`
      SELECT
        SUM(CASE WHEN reply_status = 'replied' THEN 1 ELSE 0 END) as replied,
        SUM(CASE WHEN reply_status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN reply_status = 'no_reply' THEN 1 ELSE 0 END) as no_reply,
        COUNT(*) as total
      FROM sent_registry
    `);

    res.json({
      rows,
      total: total?.count || 0,
      page: parseInt(page),
      limit: parseInt(limit),
      replyCounts,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', (req, res) => {
  try {
    const { search = '', status = '', page = 1, limit = 20, sort = 'created_at', order = 'desc' } = req.query;

    const allowedSort = ['name', 'status', 'created_at', 'sent_at', 'profile_url'];
    const allowedOrder = ['asc', 'desc'];
    const safeSort = allowedSort.includes(sort) ? sort : 'created_at';
    const safeOrder = allowedOrder.includes(order) ? order : 'desc';

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];

    if (search) {
      conditions.push('(c.name LIKE ? OR c.profile_url LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (status) {
      conditions.push('c.status = ?');
      params.push(status);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = queryAll(`
      SELECT c.id, c.name, c.profile_url, c.company, c.status,
             c.message_preview, c.error_message, c.error_code,
             c.sent, c.sent_at, c.created_at,
             r.run_key, r.started_at as run_started_at
      FROM connections c
      LEFT JOIN runs r ON c.run_id = r.id
      ${whereClause}
      ORDER BY c.${safeSort} ${safeOrder}
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    const total = queryOne(`SELECT COUNT(*) as count FROM connections c ${whereClause}`, params);
    const statusCounts = queryAll('SELECT status, COUNT(*) as count FROM connections GROUP BY status');

    res.json({
      rows,
      total: total?.count || 0,
      page: parseInt(page),
      limit: parseInt(limit),
      statusCounts: (statusCounts || []).reduce((acc, s) => { acc[s.status] = s.count; return acc; }, {}),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
