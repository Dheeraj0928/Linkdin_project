/**
 * Run automation for a specific LinkedIn account (separate profile + data).
 * Usage: node scripts/run-account.js account2 start
 *        node scripts/run-account.js account2 connect
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const account = process.argv[2];
const mode = process.argv[3] || 'start';

if (!account) {
  console.error('Usage: node scripts/run-account.js <account-id> [start|connect]');
  process.exit(1);
}

const script = mode === 'connect' ? 'src/connect.js' : 'src/index.js';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

console.log(`\n>>> Running ${mode} for account: ${account}\n`);

const child = spawn('node', [script], {
  cwd: projectRoot,
  env: { ...process.env, LINKEDIN_ACCOUNT_ID: account },
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', (code) => process.exit(code ?? 0));
