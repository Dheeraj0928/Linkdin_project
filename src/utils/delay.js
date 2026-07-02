/**
 * Promise-based pause and human-like random delays.
 */
export function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Random integer in [min, max] inclusive */
export function randomBetween(min, max) {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

/**
 * Wait a random duration between min and max ms (e.g. 1s–3s varies each time).
 */
export async function humanDelay(minMs, maxMs, logger, context = '') {
  const ms = randomBetween(minMs, maxMs);
  if (logger?.info) {
    const secs = (ms / 1000).toFixed(1);
    const label = context ? `before ${context}` : 'next step';
    logger.info(`Random pause ${secs}s ${label}`, { minMs, maxMs, actualMs: ms });
  }
  await delay(ms);
  return ms;
}
