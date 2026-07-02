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
  const slug = people[0].slug;

  await page.evaluate(({ s }) => {
    const profileLink = [...document.querySelectorAll(`main a[href*="/in/${s}"]`)].find((a) => !(a.getAttribute('aria-label') || '').includes('Invite'));
    let node = profileLink?.parentElement;
    for (let i = 0; i < 12 && node; i++) {
      const c = [...node.querySelectorAll('a[aria-label*="Invite"][aria-label*="connect" i]')];
      if (c.length === 1) { c[0].click(); return; }
      node = node.parentElement;
    }
  }, { s: slug });

  await page.waitForTimeout(2000);

  const snap = await page.evaluate(() => {
    const textareas = [...document.querySelectorAll('textarea')].map((t) => ({
      id: t.id,
      name: t.name,
      placeholder: t.placeholder,
      visible: t.offsetParent !== null,
      parentText: t.parentElement?.innerText?.slice(0, 200),
    }));

    const overlays = [...document.querySelectorAll('[class*="modal"], [class*="overlay"], [data-test-modal], div[role="dialog"], div[role="alertdialog"]')]
      .filter((el) => el.offsetParent !== null || getComputedStyle(el).display !== 'none')
      .slice(0, 8)
      .map((el) => ({
        tag: el.tagName,
        role: el.getAttribute('role'),
        class: (el.className || '').toString().slice(0, 80),
        text: (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 250),
        buttons: [...el.querySelectorAll('button, a')].slice(0, 8).map((b) => ({
          text: (b.innerText || '').replace(/\s+/g, ' ').trim(),
          aria: b.getAttribute('aria-label') || '',
        })),
      }));

    const allVisibleButtons = [...document.querySelectorAll('button, a')]
      .filter((b) => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })
      .filter((b) => /send|note|invite|connect|dismiss|cancel/i.test((b.innerText || '') + (b.getAttribute('aria-label') || '')))
      .slice(0, 20)
      .map((b) => ({
        tag: b.tagName,
        text: (b.innerText || '').replace(/\s+/g, ' ').trim(),
        aria: b.getAttribute('aria-label') || '',
      }));

    return { textareas, overlays, allVisibleButtons, bodySnippet: document.body.innerText.slice(0, 500) };
  });

  console.log(JSON.stringify(snap, null, 2));
  await context.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
