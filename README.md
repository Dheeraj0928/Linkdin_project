# LinkedIn Connection Message Assistant

A personal productivity tool built with **Node.js** and **Playwright**. It uses your existing LinkedIn session to collect connection info and **draft** personalized messages — sending is **disabled by default** so you review every message before it goes out.

> **Not a bulk automation or spam tool.** Designed for low-volume, human-in-the-loop workflows.

---

## Project Brief

| Field | Value |
|-------|-------|
| **Purpose** | Personal LinkedIn connection message drafting |
| **Stack** | Node.js, Playwright, ES modules |
| **Default mode** | Draft only (`sendEnabled: false`) |
| **Data** | JSON in `data/`, logs in `logs/` |
| **Ethics** | No bulk spam, no bypassing platform protections |

### One-sentence goal

> A local Node.js + Playwright tool that uses your existing Chrome LinkedIn session, collects connection info, opens profiles, **drafts** personalized messages (send disabled by default), and **logs** what it did.

---

## What This Tool Does

1. Opens Chrome with a persistent profile (your login is saved locally)
2. Navigates to your LinkedIn connections
3. Collects connection names and profile URLs
4. Opens each selected profile
5. Opens the Message dialog
6. Fills a personalized message template using the person's name
7. Logs successful operations and handles failures gracefully

## What This Tool Does NOT Do

- Bulk-spam thousands of people
- Bypass captchas or anti-bot systems
- Auto-send messages by default
- Scrape data for resale or commercial use

---

## Architecture

```
linkedin-automation/
├── src/
│   ├── browser/       # Browser launch & session persistence
│   ├── services/      # Business logic (connections, messages)
│   ├── automation/    # Page interactions & DOM locators
│   ├── utils/         # Reusable helpers (delay, file I/O)
│   ├── config/        # Settings & constants
│   ├── templates/     # Message templates
│   ├── logger/        # File + console logging
│   └── index.js       # Entry point
├── data/              # Exported connection JSON
├── logs/              # Run logs
├── package.json
└── README.md
```

### Data flow

1. You run `npm start`
2. **Config** loads settings (template, dry-run mode, limits)
3. **Browser layer** launches Chrome with your saved session
4. **Automation layer** navigates LinkedIn and interacts with the DOM
5. **Services layer** extracts connections, personalizes messages, saves JSON
6. **Logger** writes human-readable logs to `logs/`
7. You review drafts in the browser before sending manually

---

## Safety Defaults

| Setting | Default | Why |
|---------|---------|-----|
| `sendEnabled` | `false` | Draft-only; you send manually after review |
| `maxConnections` | `5` | Small batches for personal use |
| `delayBetweenProfilesMs` | `4000` | Human-like pacing between profiles |

---

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- Google Chrome installed
- A LinkedIn account

---

## Setup

### 1. Install dependencies

```bash
npm install
npx playwright install chrome
```

### 2. Configure environment

Copy the example env file and adjust if needed:

```bash
copy .env.example .env
```

### 3. First run — log in to LinkedIn

On the first run, the browser opens with an empty profile. **Log in to LinkedIn manually**, then press Enter in the terminal when prompted. Your session is saved in `.browser-profile/` for future runs.

### 4. Run the tool

```bash
npm start
```

---

## Configuration

Edit `.env` or `src/config/index.js`:

| Variable | Description |
|----------|-------------|
| `SEND_ENABLED` | `true` to click Send (default: `false`) |
| `MAX_CONNECTIONS` | Max profiles to process per run |
| `DELAY_BETWEEN_PROFILES_MS` | Pause between profiles |
| `HEADLESS` | `true` for headless mode (not recommended for login) |
| `BROWSER_PROFILE_DIR` | Where Chrome stores your session |

Message template: edit `src/templates/message.txt`. Use `{{name}}` as the placeholder for the connection's first name.

---

## Output

- **Connections JSON:** `data/connections-<timestamp>.json`
- **Run logs:** `logs/run-<timestamp>.log`

---

## Troubleshooting

| Issue | What to do |
|-------|------------|
| Not logged in | Delete `.browser-profile/`, run again, log in manually |
| Selectors broken | LinkedIn updates their UI often — update `src/config/constants.js` |
| Message box not found | Open DevTools on LinkedIn, inspect the element, update locators |
| Rate limited | Increase `DELAY_BETWEEN_PROFILES_MS`, reduce `MAX_CONNECTIONS` |

---

## Principles Used

- **Separation of Concerns** — browser, automation, services, config are separate
- **DRY** — shared utilities for delay, file I/O, logging
- **KISS** — JSON files instead of a database for v1
- **Fail safe** — draft mode default, per-profile error handling, continue on failure

---

## License

Personal use only. Respect [LinkedIn's User Agreement](https://www.linkedin.com/legal/user-agreement).
"# Linkdin_project" 
