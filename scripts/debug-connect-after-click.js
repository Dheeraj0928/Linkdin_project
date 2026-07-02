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
  const urlBefore = page.url();

  const connectLink = page.getByRole('link', { name: person.connectAria, exact: true });
  await connectLink.scrollIntoViewIfNeeded();
  console.log('Clicking:', person.connectAria);
  await connectLink.click({ timeout: 10000 });
  
  for (const wait of [1000, 2000, 3000, 5000]) {
    await page.waitForTimeout(wait);
    const state = await page.evaluate((aria) => {
      const connectStill = document.querySelector(`a[aria-label="${aria}"]`);
      const pendingNear = [...document.querySelectorAll('main *')].some((el) => (el.innerText || '').trim() === 'Pending');
      return {
        url: location.href,
        connectStillVisible: !!connectStill,
        pendingOnPage: pendingNear,
        addNoteText: document.body.innerText.includes('Add a note'),
        invitationText: document.body.innerText.includes('invitation'),
        allRoles: [...document.querySelectorAll('[role="dialog"], [role="alertdialog"], [aria-modal="true"]')].map((e) => e.innerText.slice(0, 150)),
        iframes: document.querySelectorAll('iframe').length,
      };
    }, person.connectAria);
    console.log(`After ${wait}ms:`, JSON.stringify(state));
    if (state.addNoteText || state.allRoles.length) break;
  }

  await page.screenshot({ path: 'data/connect-after-click.png', fullPage: false });
  console.log('Screenshot saved data/connect-after-click.png');
  console.log('URL before:', urlBefore, 'after:', page.url());
  await context.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
