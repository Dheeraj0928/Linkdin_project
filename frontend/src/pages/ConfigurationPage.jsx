import { useState, useEffect } from 'react';
import { Save, Loader } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../contexts/ToastContext';

const FIELDS = [
  { key: 'LINKEDIN_ACCOUNT_ID', label: 'Account ID', type: 'text', help: 'default = main account. Use account2, account3 for other logins (separate browser profile + data).' },
  { key: 'MAX_CONNECTIONS', label: 'Max Connections', type: 'number', help: 'Max profiles per run (keep low: 10–20/day)' },
  { key: 'MAX_SCROLL_ATTEMPTS', label: 'Max Scroll Attempts', type: 'number', help: 'How many times to scroll to load more connections' },
  { key: 'DELAY_BETWEEN_PROFILES_MIN_MS', label: 'Delay Min (ms)', type: 'number', help: 'Random pause minimum between people (e.g. 3000 = 3 sec)' },
  { key: 'DELAY_BETWEEN_PROFILES_MAX_MS', label: 'Delay Max (ms)', type: 'number', help: 'Random pause maximum (e.g. 12000 = 12 sec) — varies each time' },
  { key: 'DELAY_BETWEEN_PROFILES_MS', label: 'Delay Base (ms)', type: 'number', help: 'Fallback base delay if min/max not set' },
  { key: 'ACTION_DELAY_MS', label: 'Action Delay (ms)', type: 'number', help: 'Delay between UI interactions' },
  { key: 'TYPE_FALLBACK_DELAY_MS', label: 'Typing Delay (ms)', type: 'number', help: 'Keep at 2–5 for reliable Send button (LinkedIn Draft.js)' },
  { key: 'PAGE_TIMEOUT_MS', label: 'Page Timeout (ms)', type: 'number', help: 'Max time to wait for profile page load' },
  { key: 'SCROLL_PAUSE_MS', label: 'Scroll Pause (ms)', type: 'number', help: 'Wait after each scroll on connections page' },
  { key: 'DAILY_MESSAGE_LIMIT', label: 'Daily Message Limit', type: 'number', help: 'Max messages per day (0 = unlimited). Protects account from LinkedIn flags.' },
  { key: 'DAILY_CONNECT_LIMIT', label: 'Daily Connect Limit', type: 'number', help: 'Max connect invites per day (0 = unlimited)' },
  { key: 'SEND_ENABLED', label: 'Send Enabled', type: 'boolean', help: '⚠️ If true, messages are actually sent. If false, draft only.' },
  { key: 'HEADLESS', label: 'Headless Mode', type: 'boolean', help: 'Run browser without visible window' },
  { key: 'BROWSER_PROFILE_DIR', label: 'Browser Profile Dir', type: 'text', help: 'Leave empty to auto-use .browser-profile-{accountId}' },
  { key: 'LINKEDIN_CONNECTIONS_URL', label: 'Connections URL', type: 'text', help: 'LinkedIn connections page URL' },
  { key: 'RESUME_URL', label: 'Resume Link', type: 'text', help: 'Public Google Drive / portfolio URL — used in {ResumeLink} in messages' },
];

export default function ConfigurationPage() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.getSettings().then(s => { setSettings(s); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await api.saveSettings(settings);
      toast('Configuration saved! .env file updated. Changes apply on next run.', 'success');
    } catch (err) { toast(err.message, 'error'); }
    setSaving(false);
  }

  function update(key, value) {
    setSettings(s => ({ ...s, [key]: value }));
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Configuration</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
          Edit automation settings. Changes are saved to .env and apply on the next run.
        </p>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
        ) : (
          <div style={{ padding: '8px 0' }}>
            {FIELDS.map((f, i) => (
              <div key={f.key} style={{
                display: 'flex', alignItems: 'flex-start', gap: 20,
                padding: '14px 20px', borderBottom: i < FIELDS.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                transition: 'background 0.1s'
              }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{f.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.help}</div>
                  <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent)', marginTop: 2 }}>{f.key}</div>
                </div>
                <div style={{ flexShrink: 0, minWidth: 180 }}>
                  {f.type === 'boolean' ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      {['true', 'false'].map(v => (
                        <button key={v} onClick={() => update(f.key, v)}
                          style={{
                            padding: '6px 16px', borderRadius: 6, border: '1px solid',
                            borderColor: settings[f.key] === v ? (v === 'true' ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)') : 'var(--border)',
                            background: settings[f.key] === v ? (v === 'true' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)') : 'transparent',
                            color: settings[f.key] === v ? (v === 'true' ? 'var(--success)' : 'var(--error)') : 'var(--text-muted)',
                            cursor: 'pointer', fontSize: 12, fontWeight: 600,
                          }}>
                          {v}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input className="input" type={f.type === 'number' ? 'number' : 'text'}
                      value={settings[f.key] || ''}
                      onChange={e => update(f.key, e.target.value)}
                      style={{ padding: '6px 10px', fontSize: 13 }} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || loading}>
          {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}
