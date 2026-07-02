/**
 * Account-aware paths — mirrors src/config/index.js for the backend.
 */
const fs = require('fs');
const path = require('path');
const { queryOne } = require('../database/db');

const PROJECT_ROOT = path.resolve(__dirname, '../../../');

function sanitizeAccountId(raw) {
  const id = (raw || 'default').trim() || 'default';
  return id.replace(/[^a-zA-Z0-9_-]/g, '') || 'default';
}

function resolveBrowserProfileRel(accountId) {
  const envDir = (process.env.BROWSER_PROFILE_DIR || '').trim();
  const defaultProfile = '.browser-profile';
  if (accountId !== 'default') {
    if (!envDir || envDir === defaultProfile) {
      return `.browser-profile-${accountId}`;
    }
    return envDir;
  }
  return envDir || defaultProfile;
}

function getPathsForAccount(accountId) {
  const id = sanitizeAccountId(accountId);
  const dataDir = id === 'default'
    ? path.join(PROJECT_ROOT, 'data')
    : path.join(PROJECT_ROOT, 'data', 'accounts', id);
  const logsDir = id === 'default'
    ? path.join(PROJECT_ROOT, 'logs')
    : path.join(PROJECT_ROOT, 'logs', 'accounts', id);
  const profileRel = resolveBrowserProfileRel(id);
  return {
    accountId: id,
    projectRoot: PROJECT_ROOT,
    dataDir,
    logsDir,
    browserProfile: path.join(PROJECT_ROOT, profileRel),
    browserProfileRel: profileRel,
    sentConnections: path.join(dataDir, 'sent_connections.json'),
    sentConnectRequests: path.join(dataDir, 'sent_connect_requests.json'),
    progressState: path.join(dataDir, 'progress_state.json'),
  };
}

function getActiveAccountId() {
  const row = queryOne("SELECT value FROM settings WHERE key = 'LINKEDIN_ACCOUNT_ID'");
  if (row?.value) return sanitizeAccountId(row.value);
  return sanitizeAccountId(process.env.LINKEDIN_ACCOUNT_ID);
}

function getActivePaths() {
  return getPathsForAccount(getActiveAccountId());
}

function listAccounts() {
  const accounts = new Map();

  function addAccount(id, meta = {}) {
    const paths = getPathsForAccount(id);
    const hasProfile = fs.existsSync(paths.browserProfile);
    const hasData = fs.existsSync(paths.dataDir);
    const sentFile = paths.sentConnections;
    let sentCount = 0;
    let lastActive = null;
    if (fs.existsSync(sentFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(sentFile, 'utf-8'));
        sentCount = data.count || (data.sentProfiles || []).length;
        lastActive = data.updatedAt || null;
      } catch { /* ignore */ }
    }
    accounts.set(id, {
      id,
      ...paths,
      hasProfile,
      hasData,
      sentCount,
      lastActive,
      isLoggedIn: hasProfile && fs.existsSync(path.join(paths.browserProfile, 'Default')),
      ...meta,
    });
  }

  addAccount('default', { label: 'Main Account' });

  const accountsRoot = path.join(PROJECT_ROOT, 'data', 'accounts');
  if (fs.existsSync(accountsRoot)) {
    for (const name of fs.readdirSync(accountsRoot)) {
      const full = path.join(accountsRoot, name);
      if (fs.statSync(full).isDirectory()) {
        addAccount(name, { label: name });
      }
    }
  }

  const profilesRoot = PROJECT_ROOT;
  try {
    for (const name of fs.readdirSync(profilesRoot)) {
      if (name.startsWith('.browser-profile-')) {
        const id = name.replace('.browser-profile-', '');
        if (!accounts.has(id)) {
          addAccount(id, { label: id });
        }
      }
    }
  } catch { /* ignore */ }

  return Array.from(accounts.values()).sort((a, b) => {
    if (a.id === 'default') return -1;
    if (b.id === 'default') return 1;
    return a.id.localeCompare(b.id);
  });
}

module.exports = {
  sanitizeAccountId,
  getPathsForAccount,
  getActiveAccountId,
  getActivePaths,
  listAccounts,
  PROJECT_ROOT,
};
