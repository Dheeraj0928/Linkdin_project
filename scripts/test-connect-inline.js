import dotenv from 'dotenv';
import { chromium } from 'playwright';
import { navigateToPeopleSearch } from '../src/automation/connectRequest.js';
import { loadConnectNoteTemplate, personalizeConnectNote } from '../src/services/connectRequestService.js';
import { createLogger } from '../src/logger/index.js';
import { delay } from '../src/utils/delay.js';
import config from '../src/config/index.js';
dotenv.config();

async function main() {
  const logger = createLogger(config.paths.logs);
  const context = await chromium.launchPersistentContext(config.paths.browserProfile, { channel: 'chrome', headless: false, viewport: { width: 1280, height: 900 } });
  const page = context.pages()[0] || (await context.newPage());
  const people = await navigateToPeopleSearch(page, config.connect.role, config.connect.location, logger);
  const person = people.find((p) => p.name.includes('Vaibhav')) || people[3];
  const template = await loadConnectNoteTemplate(config.paths.templates);
  const note = personalizeConnectNote(template, config.connect.role);

  console.log('Target:', person.name);
  await page.getByRole('link', { name: person.connectAria, exact: true }).click();
  await delay(1500);
  await page.getByRole('button', { name: /^Add a note$/i }).click();
  await delay(1500);
  const textarea = page.locator('textarea').first();
  await textarea.click();
  await textarea.fill('');
  await page.keyboard.insertText(note.slice(0, 300));
  await delay(1500);

  const sendBtn = page.getByRole('button', { name: /^Send$/i });
  console.log('Send count:', await sendBtn.count());
  for (let i = 0; i < await sendBtn.count(); i++) {
    console.log(i, 'visible', await sendBtn.nth(i).isVisible());
  }
  await sendBtn.first().click();
  console.log('SENT OK');
  await delay(2000);
  await context.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
