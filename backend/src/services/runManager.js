/**
 * RUN MANAGER SERVICE
 * ====================
 * Responsibility: Manage the lifecycle of the Playwright automation process.
 *
 * Architecture decision: We DON'T run the automation inside Express.
 * Instead, we spawn it as a child process (child_process.spawn).
 *
 * Why? → The automation is a standalone script with its own module system
 * ("type":"module"). Running it as a child process means:
 *   1. Complete isolation — a crash in automation can't crash the dashboard
 *   2. No module system conflicts (ESM vs CommonJS)
 *   3. We can kill it cleanly, capture stdout/stderr, pipe stdin
 *   4. The original code is completely untouched
 *
 * The RunManager uses EventEmitter so any route handler can subscribe
 * to real-time events without polling.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');
const { getDb } = require('../database/db');
const { importSingleRunSummary, importSingleLogFile, getActivePaths } = require('./dataImporter');
const { readFreshEnv } = require('../utils/syncEnv');

const PROJECT_ROOT = path.resolve(__dirname, '../../../');

/**
 * Re-read the .env file and return a merged env object.
 * This ensures changes to .env (like SEND_ENABLED) are picked up
 * without restarting the backend server.
 */
function getFreshEnv() {
  return readFreshEnv();
}

class RunManager extends EventEmitter {
  constructor() {
    super();
    this._process = null;
    this._currentRunKey = null;
    this._startTime = null;
    this._logBuffer = [];
    this._status = 'idle';
    this._progress = { current: 0, total: 0, name: '', phase: 'idle' };
    this._runMode = 'messages'; // 'messages' | 'connect'
  }

  get isRunning() {
    return this._status === 'running';
  }

  get status() {
    return this._status;
  }

  get runMode() {
    return this._runMode;
  }

  get currentRunInfo() {
    if (!this.isRunning) return null;
    return {
      runKey: this._currentRunKey,
      startTime: this._startTime,
      elapsedMs: Date.now() - this._startTime,
      pid: this._process?.pid,
      progress: this._progress,
      runMode: this._runMode,
      recentLogs: this._logBuffer.slice(-100),
    };
  }

  /**
   * Start the automation as a child process.
   * Returns the run key (timestamp) for tracking.
   */
  startRun(mode = 'messages') {
    if (this.isRunning) {
      throw new Error('Automation is already running');
    }

    this._runMode = mode === 'connect' ? 'connect' : 'messages';
    const script = this._runMode === 'connect' ? 'src/connect.js' : 'src/index.js';

    this._startTime = Date.now();
    this._currentRunKey = new Date().toISOString().replace(/[:.]/g, '-');
    this._logBuffer = [];
    this._status = 'running';
    this._progress = { current: 0, total: 0, name: '', phase: 'starting' };

    console.log(`[RunManager] Starting ${this._runMode} run: ${this._currentRunKey}`);

    this._process = spawn('node', [script], {
      cwd: PROJECT_ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      // Inherit env + any overrides we want to apply
      env: { ...getFreshEnv() },
    });

    // ── stdout handling ────────────────────────────────────────────────────
    let stdoutBuffer = '';
    this._process.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop(); // Keep incomplete last line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;
        this._handleLogLine(line);
      }
    });

    // ── stderr handling ────────────────────────────────────────────────────
    let stderrBuffer = '';
    this._process.stderr.on('data', (chunk) => {
      stderrBuffer += chunk.toString();
      const lines = stderrBuffer.split('\n');
      stderrBuffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        const entry = { level: 'ERROR', message: line, logged_at: new Date().toISOString() };
        this._logBuffer.push(entry);
        this.emit('log', entry);
      }
    });

    // ── process exit handling ───────────────────────────────────────────────
    this._process.on('close', (code) => {
      console.log(`[RunManager] Process exited with code ${code}`);
      this._status = 'idle';
      this._process = null;

      // Import the new data files that automation created
      setTimeout(() => this._importNewData(), 2000);

      this.emit('complete', {
        runKey: this._currentRunKey,
        exitCode: code,
        durationMs: Date.now() - this._startTime,
      });

      this._currentRunKey = null;
      this._startTime = null;
      this._runMode = 'messages';
    });

    // ── Auto-send stdin when automation asks "Press Enter to close..." ─────
    // Your automation waits for stdin before closing the browser.
    // We automatically send Enter so it closes cleanly without user interaction.
    this._process.on('spawn', () => {
      console.log(`[RunManager] Process spawned (PID: ${this._process.pid})`);
      this.emit('started', { runKey: this._currentRunKey, pid: this._process.pid });
    });

    // Watch for the "Press Enter" prompt and auto-respond
    this._process.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('Press Enter to close')) {
        console.log('[RunManager] Auto-sending Enter to close browser...');
        this._process.stdin.write('\n');
      }
    });

    return this._currentRunKey;
  }

  startConnectRun() {
    return this.startRun('connect');
  }

  /**
   * Stop the running automation gracefully.
   */
  stopRun() {
    if (!this.isRunning || !this._process) {
      throw new Error('No automation is currently running');
    }

    console.log('[RunManager] Stopping automation...');
    this._status = 'stopping';

    // Try graceful SIGTERM first, then force kill after 5 seconds
    this._process.kill('SIGTERM');
    setTimeout(() => {
      if (this._process) {
        console.log('[RunManager] Force killing automation process');
        this._process.kill('SIGKILL');
      }
    }, 5000);
  }

  /**
   * Parse a log line and emit it as a structured event.
   */
  _parseProgress(message, meta) {
    const proc = message.match(/Processing (\d+)\/(\d+)/);
    if (proc) {
      this._progress = {
        current: parseInt(proc[1], 10),
        total: parseInt(proc[2], 10),
        name: meta?.name || this._progress.name,
        phase: 'processing',
      };
      this.emit('progress', this._progress);
      return;
    }

    const done = message.match(/Done (\d+)\/(\d+)/);
    if (done) {
      this._progress = {
        current: parseInt(done[1], 10),
        total: parseInt(done[2], 10),
        name: meta?.name || this._progress.name,
        phase: 'done',
      };
      this.emit('progress', this._progress);
      return;
    }

    if (message.includes('Messaging') && message.includes('BELOW anchor')) {
      this._progress.phase = 'collecting';
      this.emit('progress', this._progress);
    }
  }

  _handleLogLine(line) {
    const match = line.match(/^\[(.+?)\]\s+\[(\w+)\]\s+(.+?)(?:\s+(\{.+\}))?$/);
    let entry;
    let metaObj = null;

    if (match) {
      if (match[4]) {
        try { metaObj = JSON.parse(match[4]); } catch { metaObj = null; }
      }
      entry = {
        level: match[2],
        message: match[3].trim(),
        meta: match[4] || null,
        logged_at: match[1],
      };
      this._parseProgress(entry.message, metaObj);
    } else {
      entry = {
        level: 'INFO',
        message: line,
        meta: null,
        logged_at: new Date().toISOString(),
      };
    }

    this._logBuffer.push(entry);
    if (this._logBuffer.length > 1000) this._logBuffer.shift();

    this.emit('log', entry);
  }

  /**
   * After automation finishes, import the new data files it created.
   */
  _importNewData() {
    try {
      const paths = getActivePaths();

      if (fs.existsSync(paths.dataDir)) {
        const files = fs.readdirSync(paths.dataDir)
          .filter((f) => (f.startsWith('run-summary-') || f.startsWith('connect-summary-')) && f.endsWith('.json'))
          .sort()
          .reverse()
          .slice(0, 5);

        for (const file of files) {
          importSingleRunSummary(path.join(paths.dataDir, file));
        }
      }

      if (fs.existsSync(paths.logsDir)) {
        const files = fs.readdirSync(paths.logsDir)
          .filter((f) => f.startsWith('run-') && f.endsWith('.log'))
          .sort()
          .reverse()
          .slice(0, 3);

        for (const file of files) {
          importSingleLogFile(path.join(paths.logsDir, file));
        }
      }

      console.log(`[RunManager] Imported data for account "${paths.accountId}"`);
    } catch (err) {
      console.error('[RunManager] Failed to import new data:', err.message);
    }
  }
}

// Export a singleton instance
const runManager = new RunManager();
module.exports = runManager;
