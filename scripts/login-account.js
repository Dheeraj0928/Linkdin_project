/**
 * Log in a separate LinkedIn account (own Chrome profile + data folder).
 * Usage: node scripts/login-account.js account2
 *        npm run login:account -- account2
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const account = process.argv[2];
if (!account) {
  console.error('Usage: node scripts/login-account.js <account-id>');
  console.error('Example: node scripts/login-account.js account2');
  process.exit(1);
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

console.log(`\n>>> Account: ${account}`);
console.log(`>>> Profile: .browser-profile-${account.replace(/[^a-zA-Z0-9_-]/g, '')}`);
console.log(`>>> Data:    data/accounts/${account.replace(/[^a-zA-Z0-9_-]/g, '')}/\n`);

const child = spawn('node', ['src/index.js', '--login-only'], {
  cwd: projectRoot,
  env: { ...process.env, LINKEDIN_ACCOUNT_ID: account },
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', (code) => process.exit(code ?? 0));
