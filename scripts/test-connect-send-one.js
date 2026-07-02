/** Full E2E: scan + click + note + send for ONE person. Run: node scripts/test-connect-send-one.js */
import dotenv from 'dotenv';
import { chromium } from 'playwright';
import { navigateToPeopleSearch, sendConnectFromSearchCard } from '../src/automation/connectRequest.js';
import { loadConnectNoteTemplate, personalizeConnectNote } from '../src/services/connectRequestService.js';
import { createLogger } from '../src/logger/index.js';
import config from '../src/config/index.js';

dotenv.config();

async function main() {
  const logger = createLogger(config.paths.logs);
  const context = await chromium.launchPersistentContext(config.paths.browserProfile, {
    channel: 'chrome',
    headless: false,
    viewport: { width: 1280, height: 900 },
  });
  const page = context.pages()[0] || (await context.newPage());
  const people = await navigateToPeopleSearch(page, config.connect.role, config.connect.location, logger);

  const template = await loadConnectNoteTemplate(config.paths.templates);
  const note = personalizeConnectNote(template, config.connect.role);

  // Pick last person to avoid ones already clicked in prior debug runs
  const person = people.find((p) => p.name.includes('Vaibhav')) || people[3];
  console.log('Sending to:', person.name, person.profileUrl);

  const result = await sendConnectFromSearchCard(page, person, note, logger);
  console.log('Result:', result);

  await page.waitForTimeout(2000);
  await context.close();
  process.exit(result.sent ? 0 : 1);
}

main().catch((e) => {
  console.error('E2E FAILED:', e.message);
  process.exit(1);
});
