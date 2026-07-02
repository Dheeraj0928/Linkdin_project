import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
dotenv.config();

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profileDir = path.join(projectRoot, process.env.BROWSER_PROFILE_DIR || '.browser-profile');
const keywords = [process.env.CONNECT_ROLE || 'Software Engineer', process.env.CONNECT_LOCATION || 'Dubai'].filter(Boolean).join(' ');
const peopleUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;

async function main() {
  const context = await chromium.launchPersistentContext(profileDir, { channel: 'chrome', headless: false, viewport: { width: 1280, height: 900 } });
  const page = context.pages()[0] || (await context.newPage());
  await page.goto(peopleUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(6000);

  // scroll to load lazy content
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(800);
  }

  const diag = await page.evaluate(() => {
    const inviteEls = [...document.querySelectorAll('main *')].filter((el) => {
      const aria = (el.getAttribute?.('aria-label') || '').toLowerCase();
      const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      return aria.includes('invite') || aria.includes('connect') || text === 'connect' || text === '+ connect' || text.endsWith(' connect');
    }).slice(0, 40).map((el) => ({
      tag: el.tagName,
      role: el.getAttribute('role'),
      text: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
      aria: (el.getAttribute('aria-label') || '').slice(0, 80),
      clickable: el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button',
    }));

    const allMainButtons = [...document.querySelectorAll('main button')].map((b) => ({
      text: (b.innerText || '').replace(/\s+/g, ' ').trim(),
      aria: (b.getAttribute('aria-label') || '').slice(0, 80),
    })).filter((b) => b.text || b.aria);

    return {
      inviteEls,
      actionButtons: allMainButtons.filter((b) => /connect|follow|message|pending|invite/i.test(b.text + b.aria)).slice(0, 25),
      totalButtons: allMainButtons.length,
    };
  });

  console.log(JSON.stringify(diag, null, 2));
  await context.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
