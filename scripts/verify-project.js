/**
 * Project verification — run: node scripts/verify-project.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;

function ok(name) { passed++; console.log(`  ✓ ${name}`); }
function fail(name, err) { failed++; console.error(`  ✗ ${name}: ${err}`); }

async function checkModule(rel) {
  try {
    const url = pathToFileURL(path.join(root, rel)).href;
    await import(url);
    ok(`import ${rel}`);
  } catch (e) {
    fail(`import ${rel}`, e.message);
  }
}

console.log('\n=== LinkedIn Automation Verification ===\n');

console.log('Core modules:');
await checkModule('src/config/index.js');
await checkModule('src/utils/delay.js');
await checkModule('src/utils/dailyLimit.js');
await checkModule('src/services/messageService.js');

console.log('\nRequired files:');
const required = [
  'src/index.js', 'src/connect.js', 'backend/src/server.js',
  'backend/src/utils/accountPaths.js', 'backend/src/routes/accounts.js',
  'frontend/src/pages/AccountsPage.jsx',
];
for (const f of required) {
  if (fs.existsSync(path.join(root, f))) ok(f);
  else fail(f, 'missing');
}

console.log('\nData files (default account):');
const dataFiles = ['data/sent_connections.json', 'data/progress_state.json'];
for (const f of dataFiles) {
  if (fs.existsSync(path.join(root, f))) ok(f);
  else fail(f, 'missing (ok if first run)');
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
