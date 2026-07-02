import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Simple file + console logger.
 * Separation of Concerns: logging logic lives here, not scattered across modules.
 */
export function createLogger(logDir) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFilePath = path.join(logDir, `run-${timestamp}.log`);
  let initialized = false;

  async function ensureLogFile() {
    if (initialized) return;
    await fs.mkdir(logDir, { recursive: true });
    await fs.writeFile(logFilePath, `=== Run started at ${new Date().toISOString()} ===\n`);
    initialized = true;
  }

  async function write(level, message, meta = null) {
    await ensureLogFile();
    const line = meta
      ? `[${new Date().toISOString()}] [${level}] ${message} ${JSON.stringify(meta)}\n`
      : `[${new Date().toISOString()}] [${level}] ${message}\n`;

    await fs.appendFile(logFilePath, line);

    const consoleMessage = meta ? `${message} ${JSON.stringify(meta)}` : message;
    if (level === 'ERROR') {
      console.error(`[${level}] ${consoleMessage}`);
    } else if (level === 'WARN') {
      console.warn(`[${level}] ${consoleMessage}`);
    } else {
      console.log(`[${level}] ${consoleMessage}`);
    }
  }

  return {
    logFilePath,
    info: (message, meta) => write('INFO', message, meta),
    warn: (message, meta) => write('WARN', message, meta),
    error: (message, meta) => write('ERROR', message, meta),
    success: (message, meta) => write('SUCCESS', message, meta),
  };
}
