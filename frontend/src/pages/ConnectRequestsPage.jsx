import { useState, useEffect, useCallback } from 'react';
import {
  UserPlus, MapPin, Briefcase, Play, Square, Save, Loader,
  ExternalLink, Sparkles, Send, Users
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../contexts/ToastContext';

const PRESETS = [
  { role: 'Software Engineer', location: 'Dubai', label: 'Software Engineer · Dubai' },
  { role: 'Software Engineer', location: 'Germany', label: 'Software Engineer · Germany' },
  { role: 'Software Engineer', location: 'India', label: 'Software Engineer · India' },
  { role: 'Marketing', location: 'Germany', label: 'Marketing · Germany' },
  { role: 'Data Analyst', location: 'UAE', label: 'Data Analyst · UAE' },
  { role: 'Full Stack Developer', location: 'Remote', label: 'Full Stack · Remote' },
];

const DEFAULT_NOTE = `Hi! I'm Dheeraj, a CS (AI/ML) grad seeking {Role} roles. Would appreciate your guidance. Thanks!`;

const FREE_NOTE_LIMIT = 200;

function previewNote(template, role) {
  return (template || DEFAULT_NOTE)
    .replace(/\{\s*role\s*\}/gi, role || 'Software Engineer')
    .trim();
}

export default function ConnectRequestsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState({
    CONNECT_ROLE: 'Software Engineer',
    CONNECT_LOCATION: 'Dubai',
    CONNECT_MAX_PER_RUN: '15',
    CONNECT_DELAY_MS: '8000',
    CONNECT_DELAY_MIN_MS: '6000',
    CONNECT_DELAY_MAX_MS: '18000',
    CONNECT_SEND_ENABLED: 'true',
    CONNECT_SEND_NOTE: 'false',
    CONNECT_NOTE_FALLBACK: 'true',
  });
  const [noteTemplate, setNoteTemplate] = useState(DEFAULT_NOTE);
  const [stats, setStats] = useState(null);
  const [sent, setSent] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [cfg, st, list, active] = await Promise.all([
        api.getConnectSettings(),
        api.getConnectStats().catch(() => null),
        api.getConnectSent({ limit: 20 }).catch(() => ({ rows: [] })),
        api.getActiveRun().catch(() => ({ isRunning: false })),
      ]);
      if (cfg.settings) setSettings((s) => ({ ...s, ...cfg.settings }));
      if (cfg.noteTemplate) setNoteTemplate(cfg.noteTemplate);
      setStats(st);
      setSent(list.rows || []);
      setIsRunning(active.isRunning && (active.runMode === 'connect' || active.currentRun?.runMode === 'connect'));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 8000);
    return () => clearInterval(id);
  }, [fetchAll]);

  async function handleSave() {
    setSaving(true);
    try {
      await api.saveConnectSettings({ settings, noteTemplate });
      toast('Connect settings saved!', 'success');
    } catch (err) { toast(err.message, 'error'); }
    setSaving(false);
  }

  async function handleStart() {
    setStarting(true);
    try {
      await api.saveConnectSettings({ settings, noteTemplate });
      await api.startConnectRun();
      toast('Connect campaign started! Check Live Activity.', 'success');
      setIsRunning(true);
    } catch (err) { toast(err.message, 'error'); }
    setStarting(false);
  }

  async function handleStop() {
    try {
      await api.stopRun();
      toast('Stop signal sent', 'warning');
      setIsRunning(false);
    } catch (err) { toast(err.message, 'error'); }
  }

  function applyPreset(p) {
    setSettings((s) => ({ ...s, CONNECT_ROLE: p.role, CONNECT_LOCATION: p.location }));
    toast(`Preset: ${p.label}`, 'info');
  }

  const notePreview = previewNote(noteTemplate, settings.CONNECT_ROLE);

  return (
    <div className="animate-fade-in">
      <div className="hero-banner" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <UserPlus size={20} color="var(--accent)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>Premium — with note</span>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800 }}>New Connection Requests</h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, maxWidth: 520 }}>
              Search people by role + location, send connection invites with your personalized note.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isRunning ? (
              <button className="btn btn-danger" onClick={handleStop}><Square size={14} /> Stop</button>
            ) : (
              <button className="btn btn-primary" onClick={handleStart} disabled={starting || loading}>
                {starting ? <Loader size={14} className="animate-spin" /> : <Play size={14} />}
                Start Connect Campaign
              </button>
            )}
            <Link to="/activity" className="btn btn-ghost">Live Activity</Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <StatCard label="Invites Sent" value={stats?.sent ?? '—'} icon={Send} color="var(--success)" />
        <StatCard label="Total Tracked" value={stats?.total ?? '—'} icon={Users} color="var(--accent)" />
        <StatCard label="Skipped" value={stats?.skipped ?? '—'} color="var(--text-muted)" />
        <StatCard label="Last Search" value={`${stats?.searchRole || settings.CONNECT_ROLE || '—'}`} sub={stats?.searchLocation || settings.CONNECT_LOCATION} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Search config */}
        <div className="card" style={{ padding: 20 }}>
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Briefcase size={12} /> Search Target
          </div>

          <Field label="Role / Job Title" icon={Briefcase}>
            <input className="input" value={settings.CONNECT_ROLE || ''}
              onChange={(e) => setSettings((s) => ({ ...s, CONNECT_ROLE: e.target.value }))}
              placeholder="Software Engineer" />
          </Field>

          <Field label="Location" icon={MapPin}>
            <input className="input" value={settings.CONNECT_LOCATION || ''}
              onChange={(e) => setSettings((s) => ({ ...s, CONNECT_LOCATION: e.target.value }))}
              placeholder="Dubai, Germany, India..." />
          </Field>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>QUICK PRESETS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PRESETS.map((p) => (
                <button key={p.label} className="btn btn-ghost" onClick={() => applyPreset(p)}
                  style={{ fontSize: 11, padding: '5px 10px' }}>
                  <Sparkles size={10} /> {p.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Field label="Max per run">
              <input className="input" type="number" value={settings.CONNECT_MAX_PER_RUN || '15'}
                onChange={(e) => setSettings((s) => ({ ...s, CONNECT_MAX_PER_RUN: e.target.value }))} />
            </Field>
            <Field label="Delay min (ms)">
              <input className="input" type="number" value={settings.CONNECT_DELAY_MIN_MS || '6000'}
                onChange={(e) => setSettings((s) => ({ ...s, CONNECT_DELAY_MIN_MS: e.target.value }))} />
            </Field>
            <Field label="Delay max (ms)">
              <input className="input" type="number" value={settings.CONNECT_DELAY_MAX_MS || '18000'}
                onChange={(e) => setSettings((s) => ({ ...s, CONNECT_DELAY_MAX_MS: e.target.value }))} />
            </Field>
          </div>

          <Field label="Send Invites">
            <div style={{ display: 'flex', gap: 6 }}>
              {['true', 'false'].map((v) => (
                <button key={v} onClick={() => setSettings((s) => ({ ...s, CONNECT_SEND_ENABLED: v }))}
                  className={`btn ${settings.CONNECT_SEND_ENABLED === v ? (v === 'true' ? 'btn-success' : 'btn-ghost') : 'btn-ghost'}`}
                  style={{ fontSize: 12, padding: '6px 14px' }}>
                  {v === 'true' ? 'ON — send invites' : 'OFF — dry run'}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Personalized Note">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['false', 'true'].map((v) => (
                <button key={v} onClick={() => setSettings((s) => ({ ...s, CONNECT_SEND_NOTE: v }))}
                  className={`btn ${settings.CONNECT_SEND_NOTE === v ? (v === 'false' ? 'btn-success' : 'btn-ghost') : 'btn-ghost'}`}
                  style={{ fontSize: 12, padding: '6px 14px' }}>
                  {v === 'false' ? 'OFF — without note (free account)' : 'ON — with note (≤200 chars)'}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
              Free LinkedIn: only 3 notes/month + 200 char max. Without note = unlimited connects.
            </div>
          </Field>

          {settings.CONNECT_SEND_NOTE === 'true' && (
            <Field label="Note fallback (if Send disabled)">
              <div style={{ display: 'flex', gap: 6 }}>
                {['true', 'false'].map((v) => (
                  <button key={v} onClick={() => setSettings((s) => ({ ...s, CONNECT_NOTE_FALLBACK: v }))}
                    className={`btn ${settings.CONNECT_NOTE_FALLBACK === v ? 'btn-success' : 'btn-ghost'}`}
                    style={{ fontSize: 12, padding: '6px 14px' }}>
                    {v === 'true' ? 'Send without note if note fails' : 'Fail instead'}
                  </button>
                ))}
              </div>
            </Field>
          )}

          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ width: '100%', marginTop: 8 }}>
            {saving ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
            Save Settings
          </button>
        </div>

        {/* Note */}
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
          <div className="section-title">Invitation Note (only if Personalized Note is ON)</div>
          <textarea className="input" value={noteTemplate} onChange={(e) => setNoteTemplate(e.target.value)}
            style={{ flex: 1, minHeight: 160, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, marginBottom: 12 }}
            placeholder="Your connect note..." />
          <div style={{ fontSize: 10, color: notePreview.length > FREE_NOTE_LIMIT ? 'var(--error)' : 'var(--text-muted)', marginBottom: 8 }}>
            Use <code style={{ color: 'var(--accent)' }}>{'{Role}'}</code> · {notePreview.length}/{FREE_NOTE_LIMIT} chars (LinkedIn free limit)
            {notePreview.length > FREE_NOTE_LIMIT && ' — too long, will use fallback without note'}
          </div>
          <div className="glass-card" style={{ padding: 14, fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>PREVIEW</div>
            {notePreview}
          </div>
        </div>
      </div>

      {/* Sent list */}
      <div className="section-title">Recent Invites Sent</div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Role Search</th><th>Location</th><th>Status</th><th>Date</th><th></th></tr>
          </thead>
          <tbody>
            {sent.map((p, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{p.name}</td>
                <td style={{ fontSize: 12 }}>{p.role || '—'}</td>
                <td style={{ fontSize: 12 }}>{p.location || '—'}</td>
                <td>
                  <span className={`pill ${p.status === 'sent' ? 'pill-replied' : 'pill-pending'}`}>
                    {p.status === 'sent' ? 'Invited' : p.status || '—'}
                  </span>
                </td>
                <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {p.sentAt ? new Date(p.sentAt).toLocaleDateString('en-IN') : '—'}
                </td>
                <td>
                  <a href={p.profileUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                    <ExternalLink size={12} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!sent.length && !loading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No invites sent yet. Configure role + location and click Start.
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        {Icon && <Icon size={12} />} {label}
      </div>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, color = 'var(--accent)' }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
        </div>
        {Icon && <Icon size={18} color={color} style={{ opacity: 0.6 }} />}
      </div>
    </div>
  );
}
