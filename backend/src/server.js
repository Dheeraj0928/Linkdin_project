/**
 * EXPRESS SERVER — Entry Point
 * Uses sql.js (WebAssembly SQLite) — no native compilation required.
 * initDb() is async because sql.js loads a WASM binary.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

// Load .env from project root
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { initDb } = require('./database/db');
const { runInitialImport } = require('./services/dataImporter');

const dashboardRouter = require('./routes/dashboard');
const connectionsRouter = require('./routes/connections');
const runsRouter = require('./routes/runs');
const logsRouter = require('./routes/logs');
const templatesRouter = require('./routes/templates');
const settingsRouter = require('./routes/settings');
const statsRouter = require('./routes/stats');
const progressRouter = require('./routes/progress');
const connectRouter = require('./routes/connect');
const accountsRouter = require('./routes/accounts');
const { syncEnvToDb } = require('./utils/syncEnv');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3001;

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.path}`);
  next();
});

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/dashboard', dashboardRouter);
app.use('/api/connections', connectionsRouter);
app.use('/api/runs', runsRouter);
app.use('/api/logs', logsRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/progress', progressRouter);
app.use('/api/connect', connectRouter);
app.use('/api/accounts', accountsRouter);

app.get('/api/health', (req, res) => {
  const { getActiveAccountId } = require('./utils/accountPaths');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeAccount: getActiveAccountId(),
    automationRunning: require('./services/runManager').isRunning,
  });
});

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ── Startup: init DB first (async), then start server ─────────────────────────
async function start() {
  try {
    console.log('[Server] Initializing database (sql.js WebAssembly)...');
    await initDb();
    const synced = syncEnvToDb();
    console.log(`[Server] Synced ${synced} settings from .env ✓`);
    console.log('[Server] Database ready ✓');

    app.listen(PORT, () => {
      console.log(`\n🚀 LinkedIn Dashboard Backend running at http://localhost:${PORT}`);
      console.log(`📊 API available at http://localhost:${PORT}/api`);
      console.log(`❤️  Health: http://localhost:${PORT}/api/health\n`);

      // Import existing data after server is up
      setImmediate(() => {
        try {
          runInitialImport();
        } catch (err) {
          console.error('[Server] Data import failed:', err.message);
        }
      });
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
}

start();
module.exports = app;
