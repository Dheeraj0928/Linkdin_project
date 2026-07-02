/**
 * CENTRALIZED API CLIENT
 */

const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  getDashboard: () => request('/dashboard'),
  getProgress: () => request('/progress'),
  resetAnchor: () => request('/progress/reset-anchor', { method: 'POST' }),
  syncSentRegistry: () => request('/progress/sync', { method: 'POST' }),

  getConnections: (params = {}) => request('/connections?' + new URLSearchParams(params)),
  getSentConnections: (params = {}) => request('/connections/sent?' + new URLSearchParams(params)),
  getConnectionStats: () => request('/connections/stats'),
  markReply: (id, reply_status) => request(`/connections/sent/${id}/reply`, {
    method: 'PATCH',
    body: JSON.stringify({ reply_status }),
  }),

  getRuns: (params = {}) => request('/runs?' + new URLSearchParams(params)),
  getRun: (id) => request(`/runs/${id}`),
  getActiveRun: () => request('/runs/active'),
  startRun: () => request('/runs/start', { method: 'POST' }),
  stopRun: () => request('/runs/stop', { method: 'POST' }),

  getLogs: (params = {}) => request('/logs?' + new URLSearchParams(params)),
  getLogRuns: () => request('/logs/runs'),

  getTemplates: () => request('/templates'),
  getTemplate: (id) => request(`/templates/${id}`),
  createTemplate: (data) => request('/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateTemplate: (id, data) => request(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTemplate: (id) => request(`/templates/${id}`, { method: 'DELETE' }),
  activateTemplate: (id) => request(`/templates/${id}/activate`, { method: 'POST' }),

  getSettings: () => request('/settings'),
  saveSettings: (data) => request('/settings', { method: 'POST', body: JSON.stringify(data) }),

  getStats: (period = 'daily') => request(`/stats?period=${period}`),

  // Connect requests
  getConnectSettings: () => request('/connect/settings'),
  saveConnectSettings: (data) => request('/connect/settings', { method: 'POST', body: JSON.stringify(data) }),
  getConnectSent: (params = {}) => request('/connect/sent?' + new URLSearchParams(params)),
  getConnectStats: () => request('/connect/stats'),
  startConnectRun: () => request('/connect/start', { method: 'POST' }),

  getAccounts: () => request('/accounts'),
  switchAccount: (accountId) => request('/accounts/switch', { method: 'POST', body: JSON.stringify({ accountId }) }),
  loginAccount: (accountId) => request('/accounts/login', { method: 'POST', body: JSON.stringify({ accountId }) }),
  getAccountHealth: () => request('/accounts/health'),
};

/** SSE stream for live logs + progress */
export function createLogStream(onLog, onComplete, onProgress) {
  const es = new EventSource('/api/runs/stream');
  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.type === 'COMPLETE') { onComplete?.(data); es.close(); return; }
      if (data.type === 'PROGRESS') { onProgress?.(data); return; }
      onLog(data);
    } catch {}
  };
  es.onerror = () => es.close();
  return () => es.close();
}
