import dotenv from 'dotenv';
import { chromium } from 'playwright';
import { navigateToPeopleSearch } from '../src/automation/connectRequest.js';
import { loadConnectNoteTemplate, personalizeConnectNote } from '../src/services/connectRequestService.js';
import { createLogger } from '../src/logger/index.js';
import config from '../src/config/index.js';
dotenv.config();

async function main() {
  const logger = createLogger(config.paths.logs);
  const context = await chromium.launchPersistentContext(config.paths.browserProfile, { channel: 'chrome', headless: false, viewport: { width: 1280, height: 900 } });
  const page = context.pages()[0] || (await context.newPage());
  const people = await navigateToPeopleSearch(page, config.connect.role, config.connect.location, logger);
  const person = people[2]; // Yogesh

  await page.getByRole('link', { name: person.connectAria, exact: true }).click();
  await page.getByRole('button', { name: /^Add a note$/i }).waitFor({ state: 'visible', timeout: 10000 });
  console.log('Step 1: invitation modal ✓');

  await page.getByRole('button', { name: /^Add a note$/i }).click();
  await page.waitForTimeout(1000);

  const textarea = page.locator('textarea').first();
  await textarea.waitFor({ state: 'visible', timeout: 8000 });
  const template = await loadConnectNoteTemplate(config.paths.templates);
  const note = personalizeConnectNote(template, config.connect.role);
  await textarea.fill(note.slice(0, 300));
  console.log('Step 2: note filled ✓', note.slice(0, 60));

  const send = page.getByRole('button', { name: /^Send$/i });
  await send.waitFor({ state: 'visible', timeout: 5000 });
  console.log('Step 3: Send button visible ✓ — NOT clicking (dry run)');
  await page.keyboard.press('Escape');
  await context.close();
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
