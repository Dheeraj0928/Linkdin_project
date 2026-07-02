/** One canonical URL key — trailing slash + query stripped, lowercased */
export function normalizeProfileUrl(url) {
  return url.split('?')[0].replace(/\/$/, '').toLowerCase();
}

// ponytail: self-check — upgrade path: move to a test file if this grows
if (normalizeProfileUrl('https://www.linkedin.com/in/Foo/') !== 'https://www.linkedin.com/in/foo') {
  throw new Error('normalizeProfileUrl regression');
}
