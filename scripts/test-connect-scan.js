/** Quick scan test — no invites sent. Run: node scripts/test-connect-scan.js */
import dotenv from 'dotenv';
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { navigateToPeopleSearch } from '../src/automation/connectRequest.js';
import { createLogger } from '../src/logger/index.js';
import config from '../src/config/index.js';

dotenv.config();

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const logger = createLogger(config.paths.logs);
  const context = await chromium.launchPersistentContext(config.paths.browserProfile, {
    channel: 'chrome',
    headless: false,
    viewport: { width: 1280, height: 900 },
  });
  const page = context.pages()[0] || (await context.newPage());

  const people = await navigateToPeopleSearch(
    page,
    config.connect.role,
    config.connect.location,
    logger
  );

  console.log('\n=== SCAN RESULT ===');
  console.log(`Found ${people.length} connectable people`);
  people.slice(0, 10).forEach((p, i) => {
    console.log(`${i + 1}. ${p.name} — ${p.profileUrl}`);
    console.log(`   connect: ${p.connectAria}`);
  });

  await context.close();
  process.exit(people.length > 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
