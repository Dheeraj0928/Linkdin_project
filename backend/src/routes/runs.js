/**
 * RUNS ROUTE
 * GET  /api/runs           — paginated run history
 * GET  /api/runs/active    — current run info
 * GET  /api/runs/stream    — SSE live log stream
 * GET  /api/runs/:id       — single run detail
 * POST /api/runs/start     — start automation
 * POST /api/runs/stop      — stop automation
 */

const express = require('express');
const router = express.Router();
const { queryOne, queryAll } = require('../database/db');
const runManager = require('../services/runManager');

router.get('/active', (req, res) => {
  res.json({
    isRunning: runManager.isRunning,
    status: runManager.status,
    runMode: runManager.runMode || 'messages',
    currentRun: runManager.currentRunInfo,
  });
});

router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send buffered logs first
  const currentInfo = runManager.currentRunInfo;
  if (currentInfo?.recentLogs) {
    for (const log of currentInfo.recentLogs) {
      res.write(`data: ${JSON.stringify(log)}\n\n`);
    }
  }
  if (currentInfo?.progress) {
    res.write(`data: ${JSON.stringify({ type: 'PROGRESS', ...currentInfo.progress })}\n\n`);
  }

  const onLog = (entry) => res.write(`data: ${JSON.stringify(entry)}\n\n`);
  const onProgress = (progress) => res.write(`data: ${JSON.stringify({ type: 'PROGRESS', ...progress })}\n\n`);
  const onComplete = (info) => { res.write(`data: ${JSON.stringify({ type: 'COMPLETE', ...info })}\n\n`); res.end(); };

  runManager.on('log', onLog);
  runManager.on('progress', onProgress);
  runManager.on('complete', onComplete);
  req.on('close', () => {
    runManager.off('log', onLog);
    runManager.off('progress', onProgress);
    runManager.off('complete', onComplete);
  });
});

router.get('/', (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let whereClause = '';
    if (status) { whereClause = 'WHERE status = ?'; params.push(status); }

    const runs = queryAll(`SELECT * FROM runs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, parseInt(limit), offset]);
    const total = queryOne(`SELECT COUNT(*) as count FROM runs ${whereClause}`, params);

    res.json({ runs, total: total?.count || 0, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const run = queryOne('SELECT * FROM runs WHERE id = ?', [req.params.id]);
    if (!run) return res.status(404).json({ error: 'Run not found' });

    const connections = queryAll('SELECT * FROM connections WHERE run_id = ? ORDER BY created_at ASC', [req.params.id]);
    const logs = queryAll('SELECT * FROM logs WHERE run_id = ? ORDER BY logged_at ASC', [req.params.id]);

    res.json({ run, connections, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/start', (req, res) => {
  try {
    if (runManager.isRunning) return res.status(409).json({ error: 'Automation is already running' });
    const runKey = runManager.startRun('messages');
    res.json({ success: true, runKey, message: 'Automation started' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/stop', (req, res) => {
  try {
    if (!runManager.isRunning) return res.status(409).json({ error: 'No automation is currently running' });
    runManager.stopRun();
    res.json({ success: true, message: 'Stop signal sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
