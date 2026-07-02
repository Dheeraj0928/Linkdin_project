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
  const person = people[3];

  await page.getByRole('link', { name: person.connectAria, exact: true }).click();
  await page.getByRole('button', { name: /^Add a note$/i }).click();
  await page.waitForTimeout(1000);
  const template = await loadConnectNoteTemplate(config.paths.templates);
  const note = personalizeConnectNote(template, config.connect.role);
  await page.locator('textarea').first().fill(note.slice(0, 300));
  await page.waitForTimeout(1000);

  const buttons = await page.evaluate(() =>
    [...document.querySelectorAll('button, a[role="button"]')]
      .filter((b) => b.getBoundingClientRect().width > 0)
      .map((b) => ({
        text: (b.innerText || '').replace(/\s+/g, ' ').trim(),
        aria: b.getAttribute('aria-label') || '',
        disabled: b.disabled,
      }))
      .filter((b) => /send|cancel|dismiss|note/i.test(b.text + b.aria))
  );
  console.log(JSON.stringify(buttons, null, 2));

  const pwButtons = await page.getByRole('button').allTextContents();
  console.log('All visible buttons:', pwButtons.filter((t) => t.trim()).slice(0, 20));
  await context.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
