import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { LINKEDIN_URLS } from './constants.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

function parseBoolean(value, defaultValue) {
  if (value === undefined || value === '') return defaultValue;
  return value.toLowerCase() === 'true';
}

function parseInteger(value, defaultValue) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

function sanitizeAccountId(raw) {
  const id = (raw || 'default').trim() || 'default';
  return id.replace(/[^a-zA-Z0-9_-]/g, '') || 'default';
}

function resolveBrowserProfile(id) {
  const envDir = (process.env.BROWSER_PROFILE_DIR || '').trim();
  const defaultProfile = '.browser-profile';
  if (id !== 'default') {
    if (!envDir || envDir === defaultProfile) {
      return `.browser-profile-${id}`;
    }
    return envDir;
  }
  return envDir || defaultProfile;
}

const accountId = sanitizeAccountId(process.env.LINKEDIN_ACCOUNT_ID);

const dataDir = accountId === 'default'
  ? path.join(projectRoot, 'data')
  : path.join(projectRoot, 'data', 'accounts', accountId);

const logsDir = accountId === 'default'
  ? path.join(projectRoot, 'logs')
  : path.join(projectRoot, 'logs', 'accounts', accountId);

const browserProfileRel = resolveBrowserProfile(accountId);

const fixedProfileDelay = parseInteger(process.env.DELAY_BETWEEN_PROFILES_MS, 5000);
const connectFixedDelay = parseInteger(process.env.CONNECT_DELAY_MS, 8000);

export const config = {
  projectRoot,
  accountId,
  paths: {
    data: dataDir,
    logs: logsDir,
    templates: path.join(projectRoot, 'src/templates'),
    browserProfile: path.join(projectRoot, browserProfileRel),
  },
  browser: {
    headless: parseBoolean(process.env.HEADLESS, false),
    channel: 'chrome',
  },
  linkedin: {
    connectionsUrl:
      process.env.LINKEDIN_CONNECTIONS_URL || LINKEDIN_URLS.connections,
    resumeUrl:
      process.env.RESUME_URL ||
      'https://drive.google.com/file/d/1G_qTw4hwmWoY9QvmH1935kC4t5iltl32/view?usp=drivesdk',
  },
  automation: {
    maxConnections: parseInteger(process.env.MAX_CONNECTIONS, 20),
    maxScrollAttempts: parseInteger(process.env.MAX_SCROLL_ATTEMPTS, 80),
    delayBetweenProfilesMs: fixedProfileDelay,
    delayBetweenProfilesMinMs: parseInteger(
      process.env.DELAY_BETWEEN_PROFILES_MIN_MS,
      fixedProfileDelay
    ),
    delayBetweenProfilesMaxMs: parseInteger(
      process.env.DELAY_BETWEEN_PROFILES_MAX_MS,
      Math.max(fixedProfileDelay * 3, fixedProfileDelay + 4000)
    ),
    actionDelayMs: parseInteger(process.env.ACTION_DELAY_MS, 200),
    typeFallbackDelayMs: parseInteger(process.env.TYPE_FALLBACK_DELAY_MS, 3),
    pageTimeoutMs: parseInteger(process.env.PAGE_TIMEOUT_MS, 20000),
    scrollPauseMs: parseInteger(process.env.SCROLL_PAUSE_MS, 600),
    sendEnabled: parseBoolean(process.env.SEND_ENABLED, false),
    dailyMessageLimit: parseInteger(process.env.DAILY_MESSAGE_LIMIT, 25),
  },
  connect: {
    role: process.env.CONNECT_ROLE || 'Software Engineer',
    location: process.env.CONNECT_LOCATION || '',
    maxPerRun: parseInteger(process.env.CONNECT_MAX_PER_RUN, 10),
    delayBetweenMs: connectFixedDelay,
    delayBetweenMinMs: parseInteger(process.env.CONNECT_DELAY_MIN_MS, connectFixedDelay),
    delayBetweenMaxMs: parseInteger(
      process.env.CONNECT_DELAY_MAX_MS,
      Math.max(connectFixedDelay * 2, connectFixedDelay + 5000)
    ),
    sendEnabled: parseBoolean(process.env.CONNECT_SEND_ENABLED, true),
    dailyConnectLimit: parseInteger(process.env.DAILY_CONNECT_LIMIT, 15),
    /** false = send without note (free LinkedIn — unlimited). true = try personalized note (≤200 chars). */
    sendNote: parseBoolean(process.env.CONNECT_SEND_NOTE, false),
    /** If note fails (too long / disabled), send without note anyway */
    noteFallback: parseBoolean(process.env.CONNECT_NOTE_FALLBACK, true),
  },
};

export default config;
