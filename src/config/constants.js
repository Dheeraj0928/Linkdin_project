/**
 * Centralized selectors and fixed values.
 * When LinkedIn changes their UI, update this file — not every module.
 */
export const LINKEDIN_URLS = {
  connections: 'https://www.linkedin.com/mynetwork/invite-connect/connections/',
  login: 'https://www.linkedin.com/login',
};

export const SELECTORS = {
  connections: {
    mainContent: 'main',
    listItem: 'li[class*="connection"], li.mn-connection-card, ul li',
    profileLink: 'a[href*="/in/"]',
  },
  profile: {
    messageButton:
      'button:has-text("Message"), a[href*="/messaging/compose"]:has-text("Message")',
  },
  message: {
    composeBox:
      'div.msg-form__contenteditable, div.msg-form__msg-content-container div[contenteditable="true"], div.msg-overlay-conversation-bubble div[contenteditable="true"], div[role="textbox"][contenteditable="true"], div[contenteditable="true"][aria-label*="Write" i], div[contenteditable="true"][aria-label*="message" i]',
    sendButton:
      'button.msg-form__send-button, button[type="submit"]:has-text("Send"), button:has-text("Send"):not([disabled])',
  },
  auth: {
    loginForm: 'form.login__form, #username, input[name="session_key"]',
  },
  connect: {
    searchResults: 'main ul.reusable-search__entity-result-list, main .search-results-container, main',
    connectButton: 'button[aria-label*="Invite"], button:has-text("Connect")',
    noteTextarea: 'textarea#custom-message, textarea[name="message"]',
    sendInviteButton: 'button[aria-label*="Send invitation"], button[aria-label*="Send"]',
  },
};

export const DEFAULT_MESSAGE_TEMPLATE = `Hi {{name}},

Hope you're doing well! I wanted to reach out and reconnect.

Best regards`;
