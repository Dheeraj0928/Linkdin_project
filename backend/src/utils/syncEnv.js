/**
 * Sync .env ↔ database settings on startup.
 * .env wins for keys that exist in both (user may edit .env directly).
 */
const fs = require('fs');
const path = require('path');
const { queryAll, run } = require('../database/db');
const { ENV_KEYS } = require('./writeEnv');
const { PROJECT_ROOT } = require('./accountPaths');

const ENV_FILE = path.join(PROJECT_ROOT, '.env');

function parseEnvFile() {
  const vars = {};
  if (!fs.existsSync(ENV_FILE)) return vars;
  const content = fs.readFileSync(ENV_FILE, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (ENV_KEYS.includes(key)) vars[key] = value;
  }
  return vars;
}

function syncEnvToDb() {
  const fromEnv = parseEnvFile();
  let updated = 0;
  for (const [key, value] of Object.entries(fromEnv)) {
    run(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, value]
    );
    updated++;
  }
  return updated;
}

function readFreshEnv() {
  const env = { ...process.env };
  const fromFile = parseEnvFile();
  return { ...env, ...fromFile };
}

module.exports = { syncEnvToDb, parseEnvFile, readFreshEnv, ENV_FILE };
