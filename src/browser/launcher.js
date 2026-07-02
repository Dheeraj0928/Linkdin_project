import { chromium } from 'playwright';
import { SELECTORS } from '../config/constants.js';
import { delay } from '../utils/delay.js';

export class AppError extends Error {
  constructor(message, code = 'UNKNOWN', cause = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.cause = cause;
  }
}

export async function launchBrowser(config, logger) {
  logger.info('Launching Chrome with persistent profile', {
    profileDir: config.paths.browserProfile,
    headless: config.browser.headless,
  });

  try {
    const context = await chromium.launchPersistentContext(
      config.paths.browserProfile,
      {
        channel: config.browser.channel,
        headless: config.browser.headless,
        viewport: { width: 1280, height: 900 },
        args: ['--disable-blink-features=AutomationControlled'],
      }
    );

    const page = context.pages()[0] || (await context.newPage());
    return { context, page };
  } catch (error) {
    throw new AppError(
      'Failed to launch Chrome. Is Google Chrome installed?',
      'BROWSER_LAUNCH_FAILED',
      error
    );
  }
}

export async function ensureLoggedIn(page, logger) {
  let success = false;
  let attempts = 0;
  while (!success && attempts < 3) {
    attempts++;
    try {
      await page.goto('https://www.linkedin.com/feed/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      success = true;
    } catch (error) {
      if (attempts >= 3) {
        throw error;
      }
      logger.warn(`Initial page load failed (attempt ${attempts}), retrying...`, { reason: error.message });
      await delay(1500);
    }
  }

  const loginVisible = await page
    .locator(SELECTORS.auth.loginForm)
    .first()
    .isVisible({ timeout: 5000 })
    .catch(() => false);

  if (loginVisible) {
    throw new AppError(
      'LinkedIn session is not active. Run `npm run login` (or `npm run login:account -- account2`) and sign in manually.',
      'NOT_LOGGED_IN'
    );
  }

  const complianceBlock = await page
    .getByText(/automation tool|Agree to comply/i)
    .first()
    .isVisible({ timeout: 2000 })
    .catch(() => false);

  if (complianceBlock) {
    throw new AppError(
      'LinkedIn showed an automation warning on this account. Stop runs, use the account manually for a few days, then retry with lower volume and random delays.',
      'LINKEDIN_COMPLIANCE_BLOCK'
    );
  }

  logger.info('LinkedIn session verified');
}

export async function waitForManualLogin(page, logger) {
  logger.info('Opening LinkedIn login page — please sign in manually in the browser');

  await page.goto('https://www.linkedin.com/login', {
    waitUntil: 'domcontentloaded',
  });

  console.log('\n>>> Log in to LinkedIn in the browser window.');
  console.log('>>> When you see your feed, press Enter here to continue...\n');

  await new Promise((resolve) => {
    process.stdin.once('data', resolve);
  });

  await ensureLoggedIn(page, logger);
  logger.success('Login saved to browser profile for future runs');
}

export async function closeBrowser(context, logger) {
  if (context) {
    await context.close();
    logger.info('Browser closed');
  }
}
