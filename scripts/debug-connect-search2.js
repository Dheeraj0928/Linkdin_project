/**
 * Deep DOM probe for new LinkedIn search UI.
 */
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
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chrome',
    headless: false,
    viewport: { width: 1280, height: 900 },
  });
  const page = context.pages()[0] || (await context.newPage());
  await page.goto(peopleUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(5000);

  const diag = await page.evaluate(() => {
    const connectButtons = [...document.querySelectorAll('main button, main a[role="button"]')]
      .filter((el) => {
        const label = (el.getAttribute('aria-label') || '').toLowerCase();
        const text = (el.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
        return (label.includes('invite') && label.includes('connect')) || text === 'connect' || text.includes('connect');
      })
      .map((el) => ({
        tag: el.tagName,
        text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
        aria: el.getAttribute('aria-label') || '',
        parentChain: (() => {
          const chain = [];
          let n = el.parentElement;
          for (let i = 0; i < 8 && n; i++) {
            chain.push(`${n.tagName}.${(n.className || '').toString().slice(0, 40)}`);
            n = n.parentElement;
          }
          return chain;
        })(),
        nearestProfileLink: (() => {
          let root = el.closest('li, article, div[data-view-name], div[data-chameleon-result-urn]') || el.parentElement?.parentElement?.parentElement;
          if (!root) root = el.parentElement;
          for (let up = 0; up < 12 && root; up++) {
            const link = root.querySelector('a[href*="/in/"]');
            if (link) return link.href.split('?')[0];
            root = root.parentElement;
          }
          return null;
        })(),
      }));

    const profileLinks = [...document.querySelectorAll('main a[href*="/in/"]')]
      .filter((a) => !a.closest('nav, header, aside'))
      .slice(0, 8)
      .map((link) => {
        let root = link;
        for (let i = 0; i < 12; i++) {
          root = root.parentElement;
          if (!root) break;
          const btns = [...root.querySelectorAll('button')].map((b) => ({
            text: (b.innerText || '').replace(/\s+/g, ' ').trim(),
            aria: (b.getAttribute('aria-label') || '').slice(0, 60),
          }));
          if (btns.some((b) => /connect|follow|message|pending/i.test(b.text + b.aria))) {
            return {
              href: link.href.split('?')[0],
              depth: i,
              rootTag: root.tagName,
              rootClass: (root.className || '').toString().slice(0, 80),
              rootDataView: root.getAttribute('data-view-name'),
              buttons: btns.filter((b) => b.text || b.aria),
            };
          }
        }
        return { href: link.href.split('?')[0], depth: -1, buttons: [] };
      });

    const dataViewNames = [...new Set(
      [...document.querySelectorAll('main [data-view-name]')].map((el) => el.getAttribute('data-view-name'))
    )].slice(0, 30);

    return { connectButtons, profileLinks, dataViewNames, connectCount: connectButtons.length };
  });

  console.log(JSON.stringify(diag, null, 2));
  const outPath = path.join(projectRoot, 'data', 'connect-debug-dom2.json');
  await import('node:fs/promises').then((fs) => fs.writeFile(outPath, JSON.stringify(diag, null, 2)));
  console.log('Saved', outPath);
  await context.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
