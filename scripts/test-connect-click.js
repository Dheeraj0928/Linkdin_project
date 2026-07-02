/** Test Connect click + modal (does NOT press Send). Run: node scripts/test-connect-click.js */
import dotenv from 'dotenv';
import { chromium } from 'playwright';
import { navigateToPeopleSearch, sendConnectFromSearchCard } from '../src/automation/connectRequest.js';
import { createLogger } from '../src/logger/index.js';
import { loadConnectNoteTemplate, personalizeConnectNote } from '../src/services/connectRequestService.js';
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
  if (!people.length) throw new Error('No people found');

  const person = people[0];
  const template = await loadConnectNoteTemplate(config.paths.templates);
  const note = personalizeConnectNote(template, config.connect.role);

  // Override: click connect only, verify modal
  const slug = person.slug;
  await page.locator(`main a[href*="/in/${slug}"]:not([aria-label*="Invite"])`).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  const clicked = await page.evaluate(({ s }) => {
    const profileLink = [...document.querySelectorAll(`main a[href*="/in/${s}"]`)]
      .find((a) => !(a.getAttribute('aria-label') || '').toLowerCase().includes('invite'));
    let node = profileLink?.parentElement;
    for (let i = 0; i < 12 && node; i++) {
      const connects = [...node.querySelectorAll('a[aria-label*="Invite"][aria-label*="connect" i]')];
      if (connects.length === 1) {
        connects[0].click();
        return true;
      }
      node = node.parentElement;
    }
    return false;
  }, { s: slug });

  if (!clicked) throw new Error('Connect click failed');
  console.log('Connect clicked for', person.name);

  const dialog = page.locator('[role="dialog"], .artdeco-modal').last();
  await dialog.waitFor({ state: 'visible', timeout: 12000 });
  console.log('Modal opened ✓');

  const addNote = page.locator('[role="dialog"] button, [role="dialog"] a').filter({ hasText: /Add a note/i }).first();
  if (await addNote.isVisible({ timeout: 3000 }).catch(() => false)) {
    await addNote.click();
    await page.waitForTimeout(800);
    console.log('Add a note clicked ✓');
  }

  const textarea = page.locator('[role="dialog"] textarea').first();
  const hasTa = await textarea.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('Textarea visible:', hasTa);

  const sendBtn = page.locator('[role="dialog"] button').filter({ hasText: /^Send$/i }).last();
  const hasSend = await sendBtn.isVisible({ timeout: 3000 }).catch(() => false);
  console.log('Send button visible:', hasSend);

  await page.keyboard.press('Escape');
  console.log('\nTest passed — modal flow works. Closed without sending.');

  await context.close();
}

main().catch((e) => {
  console.error('TEST FAILED:', e.message);
  process.exit(1);
});
