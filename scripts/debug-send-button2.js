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
  const person = people.find((p) => p.name.includes('Vaibhav')) || people[3];
  console.log('Target:', person.name, person.connectAria);

  await page.getByRole('link', { name: person.connectAria, exact: true }).click();
  await page.waitForTimeout(1500);

  const step1 = await page.getByRole('button').allTextContents();
  console.log('After connect click buttons:', step1.filter((t) => /note|send/i.test(t)));

  await page.getByRole('button', { name: /^Add a note$/i }).click();
  await page.waitForTimeout(1500);

  const taCount = await page.locator('textarea').count();
  console.log('Textarea count:', taCount);

  const step2 = await page.getByRole('button').allTextContents();
  console.log('After add note buttons:', step2.filter((t) => t.trim()));

  const textarea = page.locator('textarea').first();
  await textarea.click();
  const template = await loadConnectNoteTemplate(config.paths.templates);
  const note = personalizeConnectNote(template, config.connect.role);
  await textarea.fill('');
  await page.keyboard.insertText(note.slice(0, 300));
  await page.waitForTimeout(1500);

  const step3 = await page.getByRole('button').allTextContents();
  console.log('After typing buttons:', step3.filter((t) => /send|cancel|back/i.test(t)));

  const sendInvite = page.getByRole('button', { name: /send/i });
  console.log('Send* count:', await sendInvite.count());
  for (let i = 0; i < await sendInvite.count(); i++) {
    console.log(i, await sendInvite.nth(i).innerText(), await sendInvite.nth(i).isVisible());
  }

  await page.screenshot({ path: 'data/connect-note-filled.png' });
  await context.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
