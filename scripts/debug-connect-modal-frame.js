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
  const person = people[1]; // use second person to avoid pending from prior test

  await page.getByRole('link', { name: person.connectAria, exact: true }).click();
  await page.waitForTimeout(2000);

  const frames = page.frames();
  console.log('Frame count:', frames.length);
  for (const frame of frames) {
    const text = await frame.locator('body').innerText().catch(() => '');
    if (/add a note|invitation/i.test(text)) {
      console.log('FOUND MODAL IN FRAME:', frame.url());
      console.log(text.slice(0, 400));
      const buttons = await frame.locator('button, a').allTextContents().catch(() => []);
      console.log('Buttons:', buttons.filter((b) => b.trim()).slice(0, 15));
    }
  }

  const mainText = await page.locator('body').innerText();
  console.log('Main has Add a note:', mainText.includes('Add a note'));
  console.log('Main snippet:', mainText.slice(0, 300));

  // try playwright locators on main page
  const addNote = page.getByRole('button', { name: /Add a note/i });
  const addNoteCount = await addNote.count();
  console.log('getByRole Add a note count:', addNoteCount);
  if (addNoteCount) console.log('visible:', await addNote.first().isVisible());

  await context.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
