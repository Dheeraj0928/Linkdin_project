/**
 * DATABASE SCHEMA
 * ===============
 * Why SQLite? → Perfect for a local personal tool. No server to manage,
 * single file, zero config. When you outgrow it, swap db.js for pg (PostgreSQL)
 * and the rest of the code stays the same.
 *
 * Design principle: Every table has an `id` INTEGER PRIMARY KEY (auto-increment)
 * and timestamps. This is standard practice — always know when rows were created.
 */

const CREATE_TABLES = `
  -- ─────────────────────────────────────────────────────────
  -- RUNS TABLE
  -- One row per automation execution.
  -- run_key = the timestamp from the filename (e.g., "2026-06-27T08-09-51-055Z")
  -- This is our stable unique identifier for deduplication during import.
  -- ─────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS runs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    run_key       TEXT    UNIQUE NOT NULL,
    status        TEXT    NOT NULL DEFAULT 'completed',
    started_at    TEXT,
    completed_at  TEXT,
    duration_ms   INTEGER,
    success_count INTEGER DEFAULT 0,
    failed_count  INTEGER DEFAULT 0,
    skipped_count INTEGER DEFAULT 0,
    send_enabled  INTEGER DEFAULT 0,
    connections_file TEXT,
    created_at    TEXT    DEFAULT (datetime('now'))
  );

  -- ─────────────────────────────────────────────────────────
  -- CONNECTIONS TABLE
  -- One row per LinkedIn profile that was processed in any run.
  -- profile_url is NOT unique — the same person can appear in multiple runs.
  -- The combo (run_id, profile_url) is what's unique.
  -- ─────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS connections (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id          INTEGER REFERENCES runs(id) ON DELETE CASCADE,
    name            TEXT,
    profile_url     TEXT,
    company         TEXT,
    status          TEXT    DEFAULT 'unknown',
    message_preview TEXT,
    error_message   TEXT,
    error_code      TEXT,
    sent            INTEGER DEFAULT 0,
    sent_at         TEXT,
    created_at      TEXT    DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_connections_run_id    ON connections(run_id);
  CREATE INDEX IF NOT EXISTS idx_connections_profile   ON connections(profile_url);
  CREATE INDEX IF NOT EXISTS idx_connections_status    ON connections(status);

  -- ─────────────────────────────────────────────────────────
  -- SENT REGISTRY TABLE
  -- Mirrors data/sent_connections.json for fast queries.
  -- profile_url is UNIQUE — you only ever send one message per person.
  -- ─────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS sent_registry (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT,
    profile_url TEXT UNIQUE NOT NULL,
    sent_at     TEXT,
    reply_status TEXT DEFAULT 'pending',
    replied_at  TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_sent_registry_url ON sent_registry(profile_url);

  -- ─────────────────────────────────────────────────────────
  -- LOGS TABLE
  -- Parsed lines from logs/*.log files.
  -- Structured so we can filter by level, run, date.
  -- ─────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id     INTEGER REFERENCES runs(id) ON DELETE CASCADE,
    run_key    TEXT,
    level      TEXT,
    message    TEXT,
    meta       TEXT,
    logged_at  TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_logs_run_id   ON logs(run_id);
  CREATE INDEX IF NOT EXISTS idx_logs_level    ON logs(level);
  CREATE INDEX IF NOT EXISTS idx_logs_logged_at ON logs(logged_at);

  -- ─────────────────────────────────────────────────────────
  -- TEMPLATES TABLE
  -- Saved message templates. Supports multiple named templates.
  -- The "active" template is what the automation uses.
  -- ─────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS templates (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL DEFAULT 'Default',
    content    TEXT    NOT NULL,
    is_active  INTEGER DEFAULT 0,
    created_at TEXT    DEFAULT (datetime('now')),
    updated_at TEXT    DEFAULT (datetime('now'))
  );

  -- ─────────────────────────────────────────────────────────
  -- SETTINGS TABLE
  -- Key/value store for configuration. Maps 1:1 to .env variables.
  -- Stored in DB so we can edit them from the dashboard UI.
  -- ─────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );
`;

/**
 * Default settings that mirror .env values.
 * These are inserted only if the key doesn't already exist.
 */
const DEFAULT_SETTINGS = [
  { key: 'LINKEDIN_ACCOUNT_ID', value: 'default' },
  { key: 'MAX_CONNECTIONS', value: '20' },
  { key: 'MAX_SCROLL_ATTEMPTS', value: '80' },
  { key: 'DELAY_BETWEEN_PROFILES_MS', value: '5000' },
  { key: 'DELAY_BETWEEN_PROFILES_MIN_MS', value: '3000' },
  { key: 'DELAY_BETWEEN_PROFILES_MAX_MS', value: '12000' },
  { key: 'ACTION_DELAY_MS', value: '200' },
  { key: 'TYPE_FALLBACK_DELAY_MS', value: '5' },
  { key: 'PAGE_TIMEOUT_MS', value: '20000' },
  { key: 'SCROLL_PAUSE_MS', value: '800' },
  { key: 'SEND_ENABLED', value: 'false' },
  { key: 'HEADLESS', value: 'false' },
  { key: 'BROWSER_PROFILE_DIR', value: '.browser-profile' },
  { key: 'LINKEDIN_CONNECTIONS_URL', value: 'https://www.linkedin.com/mynetwork/invite-connect/connections/' },
  { key: 'RESUME_URL', value: 'https://drive.google.com/file/d/1G_qTw4hwmWoY9QvmH1935kC4t5iltl32/view?usp=drivesdk' },
  { key: 'CONNECT_ROLE', value: 'Software Engineer' },
  { key: 'CONNECT_LOCATION', value: 'Dubai' },
  { key: 'CONNECT_MAX_PER_RUN', value: '10' },
  { key: 'CONNECT_DELAY_MS', value: '8000' },
  { key: 'CONNECT_DELAY_MIN_MS', value: '6000' },
  { key: 'CONNECT_DELAY_MAX_MS', value: '18000' },
  { key: 'CONNECT_SEND_ENABLED', value: 'true' },
  { key: 'CONNECT_SEND_NOTE', value: 'false' },
  { key: 'CONNECT_NOTE_FALLBACK', value: 'true' },
  { key: 'DAILY_MESSAGE_LIMIT', value: '25' },
  { key: 'DAILY_CONNECT_LIMIT', value: '15' },
];

module.exports = { CREATE_TABLES, DEFAULT_SETTINGS };
