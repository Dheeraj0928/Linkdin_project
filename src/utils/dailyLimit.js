import { readJson, saveJson } from './fileSystem.js';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function loadDailyUsage(dataDir, type = 'messages') {
  const filePath = `${dataDir}/daily_usage.json`;
  const data = await readJson(filePath, { days: {} });
  const today = data.days?.[todayKey()] || { messages: 0, connects: 0 };
  return { filePath, data, today, count: today[type] || 0 };
}

export async function checkDailyLimit(dataDir, type, limit, logger) {
  if (!limit || limit <= 0) return { allowed: true, count: 0, limit: 0 };

  const { count } = await loadDailyUsage(dataDir, type);
  if (count >= limit) {
    logger?.warn(`Daily ${type} limit reached (${count}/${limit}) — stopping to protect account`);
    return { allowed: false, count, limit };
  }
  return { allowed: true, count, limit, remaining: limit - count };
}

export async function incrementDailyUsage(dataDir, type, amount = 1) {
  const { filePath, data } = await loadDailyUsage(dataDir, type);
  const key = todayKey();
  if (!data.days) data.days = {};
  if (!data.days[key]) data.days[key] = { messages: 0, connects: 0 };
  data.days[key][type] = (data.days[key][type] || 0) + amount;
  data.updatedAt = new Date().toISOString();
  await saveJson(filePath, data);
  return data.days[key][type];
}
