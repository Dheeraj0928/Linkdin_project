/**
 * Debug script: inspect LinkedIn People search DOM structure.
 * Run: node scripts/debug-connect-search.js
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profileDir = path.join(projectRoot, process.env.BROWSER_PROFILE_DIR || '.browser-profile');

const role = process.env.CONNECT_ROLE || 'Software Engineer';
const location = process.env.CONNECT_LOCATION || 'Dubai';
const keywords = [role, location].filter(Boolean).join(' ');
const peopleUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;

async function main() {
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chrome',
    headless: false,
    viewport: { width: 1280, height: 900 },
  });
  const page = context.pages()[0] || (await context.newPage());

  console.log('Navigating to:', peopleUrl);
  await page.goto(peopleUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(5000);

  const diag = await page.evaluate(() => {
    const allInLinks = [...document.querySelectorAll('a[href*="/in/"]')];
    const mainInLinks = allInLinks.filter((a) => a.closest('main') && !a.closest('nav, header, aside'));

    const buttons = [...document.querySelectorAll('main button')].slice(0, 30).map((b) => ({
      text: (b.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60),
      aria: (b.getAttribute('aria-label') || '').slice(0, 80),
      classes: (b.className || '').slice(0, 60),
    }));

    const listSelectors = {
      entityList: document.querySelectorAll('ul.reusable-search__entity-result-list > li').length,
      resultContainer: document.querySelectorAll('.reusable-search__result-container').length,
      chameleon: document.querySelectorAll('[data-chameleon-result-urn]').length,
      entityResult: document.querySelectorAll('.entity-result').length,
      mainLi: document.querySelectorAll('main li').length,
    };

    const sampleCards = mainInLinks.slice(0, 5).map((link) => {
      const item = link.closest(
        'li.reusable-search__result-container, .reusable-search__result-container, [data-chameleon-result-urn], .entity-result, li'
      );
      const cardButtons = item
        ? [...item.querySelectorAll('button')].map((b) => ({
            text: (b.innerText || '').replace(/\s+/g, ' ').trim(),
            aria: b.getAttribute('aria-label') || '',
          }))
        : [];
      return {
        href: link.href.split('?')[0],
        cardTag: item?.tagName,
        cardClass: (item?.className || '').slice(0, 80),
        buttons: cardButtons,
      };
    });

    return {
      url: location.href,
      title: document.title,
      allInLinks: allInLinks.length,
      mainInLinks: mainInLinks.length,
      listSelectors,
      buttonsSample: buttons,
      sampleCards,
    };
  });

  console.log(JSON.stringify(diag, null, 2));

  const outPath = path.join(projectRoot, 'data', 'connect-debug-dom.json');
  await import('node:fs/promises').then((fs) => fs.writeFile(outPath, JSON.stringify(diag, null, 2)));
  console.log('\nSaved to', outPath);
  await context.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
