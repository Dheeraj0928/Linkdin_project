import { useState } from 'react';
import { Download, Upload, Trash2, RotateCcw, Moon, Sun } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { api } from '../lib/api';

export default function SettingsPage() {
  const [theme, setTheme] = useState('dark');
  const toast = useToast();

  async function exportData() {
    try {
      const [connections, runs, templates] = await Promise.all([
        api.getConnections({ limit: 9999 }),
        api.getRuns({ limit: 9999 }),
        api.getTemplates(),
      ]);
      const data = { exportedAt: new Date().toISOString(), connections: connections.rows, runs: runs.runs, templates };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `linkedin-automation-export-${new Date().toISOString().slice(0,10)}.json`;
      a.click(); URL.revokeObjectURL(url);
      toast('Data exported!', 'success');
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Settings</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Appearance and data management</p>
      </div>

      {/* Appearance */}
      <Section title="Appearance">
        <Row label="Theme" desc="Choose your preferred color scheme">
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { key: 'dark', Icon: Moon, label: 'Dark' },
              { key: 'light', Icon: Sun, label: 'Light (coming soon)' },
            ].map(({ key, Icon, label }) => (
              <button key={key} onClick={() => { setTheme(key); if (key !== 'dark') toast('Light mode coming soon!', 'info'); }}
                className={`btn ${theme === key ? 'btn-primary' : 'btn-ghost'}`} style={{ fontSize: 12, padding: '6px 14px' }} disabled={key === 'light'}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        </Row>
      </Section>

      {/* Data Management */}
      <Section title="Data Management" style={{ marginTop: 20 }}>
        <Row label="Export Data" desc="Download all connections, runs, and templates as JSON">
          <button className="btn btn-ghost" onClick={exportData} style={{ fontSize: 12 }}>
            <Download size={13} /> Export JSON
          </button>
        </Row>
        <Row label="Clear Logs" desc="Remove all log entries from the database (files are kept)">
          <button className="btn btn-danger" style={{ fontSize: 12 }}
            onClick={() => toast('Clear logs coming soon', 'info')}>
            <Trash2 size={13} /> Clear Logs
          </button>
        </Row>
        <Row label="Reset Statistics" desc="Clear all run statistics. This cannot be undone.">
          <button className="btn btn-danger" style={{ fontSize: 12 }}
            onClick={() => toast('Reset coming soon', 'info')}>
            <RotateCcw size={13} /> Reset Stats
          </button>
        </Row>
      </Section>

      {/* About */}
      <Section title="About" style={{ marginTop: 20 }}>
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: 12 }}>
            {[
              ['App', 'LinkedIn Automation Dashboard'],
              ['Version', '1.0.0'],
              ['Backend', 'Express + sql.js'],
              ['Frontend', 'React + Vite + Tailwind'],
              ['Automation', 'Playwright + Node.js'],
            ].map(([k, v]) => (
              <>
                <span key={k+'-k'} style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{k}</span>
                <span key={k+'-v'} style={{ color: 'var(--text-primary)' }}>{v}</span>
              </>
            ))}
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children, style }) {
  return (
    <div className="card" style={{ overflow: 'hidden', ...style }}>
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, desc, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', gap: 16 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
      </div>
      {children}
    </div>
  );
}
