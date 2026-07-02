import { DEFAULT_MESSAGE_TEMPLATE } from '../config/constants.js';
import { readTextFile } from '../utils/fileSystem.js';

/** First word from profile/list name — fallback "there" if empty */
export function parseFirstName(fullName) {
  if (!fullName?.trim()) return 'there';
  return fullName.replace(/\s+/g, ' ').trim().split(/\s+/)[0] || 'there';
}

/**
 * Replaces name/company placeholders in the message template.
 * Supports: {{name}}, {Name}, {name}, {{company}}, {Company}, {company}
 */
export function personalizeMessage(template, { name, company = '', resumeUrl = '' }) {
  const firstName = parseFirstName(name);
  const companyName = company.trim() || 'your company';
  const resume = resumeUrl.trim() || 'https://drive.google.com/file/d/1G_qTw4hwmWoY9QvmH1935kC4t5iltl32/view';

  return template
    .replace(/\{\{\s*name\s*\}\}/gi, firstName)
    .replace(/\{\s*name\s*\}/gi, firstName)
    .replace(/\{\{\s*company\s*\}\}/gi, companyName)
    .replace(/\{\s*company\s*\}/gi, companyName)
    .replace(/\{\{\s*resumelink\s*\}\}/gi, resume)
    .replace(/\{\s*resumelink\s*\}/gi, resume);
}

export async function loadMessageTemplate(templatePath) {
  const content = await readTextFile(templatePath, DEFAULT_MESSAGE_TEMPLATE);
  return content.trim() || DEFAULT_MESSAGE_TEMPLATE;
}
