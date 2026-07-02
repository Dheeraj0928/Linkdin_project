/**
 * LOGS ROUTE
 * GET /api/logs — filtered, paginated log viewer
 * GET /api/logs/runs — list run_keys for filter dropdown
 */

const express = require('express');
const router = express.Router();
const { queryOne, queryAll } = require('../database/db');

router.get('/runs', (req, res) => {
  try {
    const rows = queryAll(`SELECT DISTINCT run_key FROM logs WHERE run_key IS NOT NULL ORDER BY run_key DESC LIMIT 50`);
    res.json((rows || []).map(r => r.run_key));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', (req, res) => {
  try {
    const { level, run_key, search, from, to, page = 1, limit = 100 } = req.query;
    const conditions = [];
    const params = [];

    if (level) { conditions.push('level = ?'); params.push(level); }
    if (run_key) { conditions.push('run_key = ?'); params.push(run_key); }
    if (search) { conditions.push('message LIKE ?'); params.push(`%${search}%`); }
    if (from) { conditions.push('logged_at >= ?'); params.push(from); }
    if (to) { conditions.push('logged_at <= ?'); params.push(to); }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const rows = queryAll(`SELECT id, run_key, level, message, meta, logged_at FROM logs ${whereClause} ORDER BY logged_at DESC LIMIT ? OFFSET ?`, [...params, parseInt(limit), offset]);
    const total = queryOne(`SELECT COUNT(*) as count FROM logs ${whereClause}`, params);
    const levelCounts = queryAll(`SELECT level, COUNT(*) as count FROM logs GROUP BY level`);

    res.json({
      rows,
      total: total?.count || 0,
      page: parseInt(page),
      limit: parseInt(limit),
      levelCounts: (levelCounts || []).reduce((acc, l) => { acc[l.level] = l.count; return acc; }, {}),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
