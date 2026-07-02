import dotenv from 'dotenv';
import { chromium } from 'playwright';
import { navigateToPeopleSearch } from '../src/automation/connectRequest.js';
import { createLogger } from '../src/logger/index.js';
import config from '../src/config/index.js';
dotenv.config();

async function main() {
  const logger = createLogger(config.paths.logs);
  const context = await chromium.launchPersistentContext(config.paths.browserProfile, { channel: 'chrome', headless: false, viewport: { width: 1280, height: 900 } });
  const page = context.pages()[0] || (await context.newPage());
  const people = await navigateToPeopleSearch(page, config.connect.role, config.connect.location, logger);
  const person = people[0];

  const connectLink = page.locator(`main a[aria-label="${person.connectAria}"]`).first();
  await connectLink.scrollIntoViewIfNeeded();
  await connectLink.click({ timeout: 10000 });
  await page.waitForTimeout(2500);

  const snap = await page.evaluate(() => ({
    textareas: [...document.querySelectorAll('textarea')].length,
    dialogs: [...document.querySelectorAll('[role="dialog"]')].map((d) => d.innerText.slice(0, 200)),
    modals: [...document.querySelectorAll('.artdeco-modal')].map((d) => d.innerText.slice(0, 200)),
    sendButtons: [...document.querySelectorAll('button, a')].filter((b) => /send/i.test(b.innerText || b.getAttribute('aria-label') || '')).map((b) => ({
      text: b.innerText, aria: b.getAttribute('aria-label'),
    })).slice(0, 10),
    pageText: document.body.innerText.includes('Add a note'),
  }));

  console.log(JSON.stringify(snap, null, 2));
  await context.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
