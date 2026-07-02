/**
 * DATABASE CONNECTION — sql.js wrapper
 * =====================================
 * sql.js is a WebAssembly port of SQLite — 100% pure JavaScript,
 * zero native dependencies. Works on any platform without build tools.
 *
 * Tradeoff vs better-sqlite3:
 *  + No Visual Studio / node-gyp required (works everywhere)
 *  + Same SQL API (still SQLite)
 *  - Database lives in memory; we explicitly save to disk after writes
 *
 * We wrap it so all route code uses the same simple API.
 */

const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const { CREATE_TABLES, DEFAULT_SETTINGS } = require('./schema');

const PROJECT_ROOT = path.resolve(__dirname, '../../../');
const DB_DIR = path.join(PROJECT_ROOT, 'database');
const DB_PATH = path.join(DB_DIR, 'linkedin_automation.db');

let _db = null;
let _SQL = null;
let _saveTimer = null;

/**
 * Persist the in-memory database to disk.
 * We debounce this — if many writes happen quickly, we only save once.
 */
function scheduleSave() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try {
      const data = _db.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));
    } catch (err) {
      console.error('[DB] Failed to save database:', err.message);
    }
  }, 500); // 500ms debounce
}

/**
 * Initialize and return the database.
 * Creates tables and default settings on first run.
 */
async function initDb() {
  if (_db) return _db;

  // Ensure the database directory exists
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  // Initialize sql.js WebAssembly
  _SQL = await initSqlJs();

  // Load existing database from disk, or create fresh
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    _db = new _SQL.Database(fileBuffer);
    console.log(`[DB] Loaded existing database from ${DB_PATH}`);
  } else {
    _db = new _SQL.Database();
    console.log(`[DB] Created new database at ${DB_PATH}`);
  }

  // Run schema (IF NOT EXISTS — safe to re-run)
  _db.run(CREATE_TABLES);

  // Lightweight migrations for existing databases
  try {
    const cols = _db.exec('PRAGMA table_info(sent_registry)');
    const names = (cols[0]?.values || []).map((row) => row[1]);
    if (!names.includes('reply_status')) {
      _db.run("ALTER TABLE sent_registry ADD COLUMN reply_status TEXT DEFAULT 'pending'");
    }
    if (!names.includes('replied_at')) {
      _db.run('ALTER TABLE sent_registry ADD COLUMN replied_at TEXT');
    }
  } catch (err) {
    console.warn('[DB] Migration warning:', err.message);
  }

  // Insert default settings (INSERT OR IGNORE)
  for (const { key, value } of DEFAULT_SETTINGS) {
    _db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }

  scheduleSave();
  return _db;
}

/**
 * Synchronous getter — throws if DB isn't initialized yet.
 * Always call initDb() at server startup before using getDb().
 */
function getDb() {
  if (!_db) throw new Error('Database not initialized. Call initDb() first.');
  return _db;
}

/**
 * sql.js returns results differently from better-sqlite3.
 * These helpers normalize the API to match what our routes expect.
 *
 * sql.js .exec() returns: [{ columns: [...], values: [[...], ...] }]
 * We convert this to: [{ col1: val1, col2: val2, ... }]
 */
function execQuery(sql, params = []) {
  const db = getDb();
  const results = db.exec(sql, params);
  if (!results.length) return [];

  const { columns, values } = results[0];
  return values.map(row =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  );
}

/**
 * Get a single row (like better-sqlite3's .get())
 */
function queryOne(sql, params = []) {
  const rows = execQuery(sql, params);
  return rows[0] || null;
}

/**
 * Get all rows (like better-sqlite3's .all())
 */
function queryAll(sql, params = []) {
  return execQuery(sql, params);
}

/**
 * Run a statement that doesn't return rows (INSERT, UPDATE, DELETE).
 * Returns { lastInsertRowid, changes }
 */
function run(sql, params = []) {
  const db = getDb();
  db.run(sql, params);
  const lastId = db.exec('SELECT last_insert_rowid() as id');
  const changes = db.exec('SELECT changes() as n');
  scheduleSave();
  return {
    lastInsertRowid: lastId[0]?.values[0]?.[0] ?? null,
    changes: changes[0]?.values[0]?.[0] ?? 0,
  };
}

/**
 * Run multiple statements in a transaction.
 * fn receives { run, queryOne, queryAll } helpers.
 */
function transaction(fn) {
  const db = getDb();
  db.run('BEGIN');
  try {
    const result = fn({ run, queryOne, queryAll });
    db.run('COMMIT');
    scheduleSave();
    return result;
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  }
}

module.exports = { initDb, getDb, queryOne, queryAll, run, transaction, DB_PATH };
