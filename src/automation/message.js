import { SELECTORS } from '../config/constants.js';
import { AppError } from '../browser/launcher.js';
import { delay } from '../utils/delay.js';

/** Active compose box — avoid sidebar/hidden editors on full /messaging/compose/ page */
async function getComposeBox(page) {
  const selectors = [
    '.msg-convo-wrapper form.msg-form .msg-form__contenteditable',
    'form.msg-form .msg-form__contenteditable',
    '.msg-form__msg-content-container .msg-form__contenteditable',
    '.msg-overlay-conversation-bubble .msg-form__contenteditable',
    'div[role="textbox"][aria-label*="Write a message" i]',
    SELECTORS.message.composeBox,
  ];

  for (const selector of selectors) {
    const loc = page.locator(selector);
    const count = await loc.count().catch(() => 0);

    for (let i = count - 1; i >= 0; i -= 1) {
      const box = loc.nth(i);
      if (!(await box.isVisible({ timeout: 1500 }).catch(() => false))) continue;

      const inActivePanel = await box.evaluate((el) => {
        const panel = el.closest('.msg-convo-wrapper, .msg-overlay-conversation-bubble, form.msg-form');
        if (!panel) return true;
        const rect = el.getBoundingClientRect();
        return rect.width > 80 && rect.height > 20;
      }).catch(() => false);

      if (inActivePanel) return box;
    }
  }

  const fallback = page.locator('form.msg-form .msg-form__contenteditable').last();
  return (await fallback.isVisible({ timeout: 3000 }).catch(() => false)) ? fallback : null;
}

/** Skip if thread already has any messages (prevents duplicate sends) */
export async function hasExistingConversation(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('.msg-convo-wrapper, .msg-overlay-conversation-bubble');
    const list = panel?.querySelector('.msg-s-message-list, .msg-s-message-list-content');
    if (!list) return false;
    return list.querySelectorAll('.msg-s-event-listitem, .msg-s-message-list__event').length > 0;
  });
}

async function readComposeText(composeBox) {
  return composeBox.evaluate((el) => el.innerText?.trim() || '').catch(() => '');
}

async function fillComposeBox(page, composeBox, text) {
  await composeBox.scrollIntoViewIfNeeded().catch(() => {});
  await composeBox.click({ timeout: 8000 });
  await delay(500);

  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  await delay(200);

  await page.keyboard.insertText(text);
  await delay(600);

  let filled = await readComposeText(composeBox);

  if (filled.length < 20) {
    await composeBox.click();
    await delay(200);
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      if (i > 0) await page.keyboard.press('Enter');
      if (lines[i].length > 0) await page.keyboard.insertText(lines[i]);
      await delay(30);
    }
    await delay(400);
    filled = await readComposeText(composeBox);
  }

  if (filled.length < 10) {
    throw new AppError(
      `Could not fill compose box (got: "${filled.slice(0, 40)}")`,
      'COMPOSE_TYPE_FAILED'
    );
  }

  const firstLine = text.split('\n')[0].trim();
  if (!filled.startsWith(firstLine.slice(0, Math.min(firstLine.length, 10)))) {
    throw new AppError(
      `Name missing in message — expected "${firstLine}", got "${filled.slice(0, 40)}"`,
      'COMPOSE_NAME_MISSING'
    );
  }
}

async function trySend(page, composeBox) {
  await composeBox.evaluate((el) => {
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
  });
  await delay(400);

  await composeBox.evaluate((el) => {
    const form = el.closest('form.msg-form') || el.closest('.msg-form');
    const btn = form?.querySelector('button.msg-form__send-button')
      || document.querySelector('.msg-convo-wrapper button.msg-form__send-button');
    if (!btn) return;

    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      if (btn.getAttribute('aria-disabled') !== 'true' && !btn.disabled) {
        btn.click();
        return;
      }
    }
    btn.click();
  });

  await delay(1200);

  let remaining = await readComposeText(composeBox);
  if (remaining.length <= 20) return;

  await composeBox.click();
  await page.keyboard.press('Control+Enter').catch(() => page.keyboard.press('Meta+Enter'));
  await delay(1200);

  remaining = await readComposeText(composeBox);
  if (remaining.length > 20) {
    throw new AppError('Send did not complete', 'SEND_FAILED');
  }
}

export async function draftMessage(page, messageText, sendEnabled, logger) {
  const composeBox = await getComposeBox(page);
  if (!composeBox) throw new AppError('Compose box not found', 'COMPOSE_BOX_NOT_FOUND');

  const text = messageText.replace(/\r\n/g, '\n');
  await fillComposeBox(page, composeBox, text);

  const visible = await readComposeText(composeBox);
  logger.success('Message drafted', {
    preview: visible.slice(0, 60),
    sendEnabled,
  });

  if (!sendEnabled) return { drafted: true, sent: false };

  await trySend(page, composeBox);
  logger.success('Message sent');
  return { drafted: true, sent: true };
}
