import { useState, useEffect, useRef, useCallback } from 'react';
import { Terminal, Pause, Play, Trash2, User } from 'lucide-react';
import { api, createLogStream } from '../lib/api';
import RunControls from '../components/ui/RunControls';

const LEVEL_COLORS = {
  INFO: '#60a5fa', SUCCESS: '#4ade80', WARN: '#fbbf24', WARNING: '#fbbf24', ERROR: '#f87171'
};

function LogLine({ log }) {
  const color = LEVEL_COLORS[log.level] || 'var(--text-secondary)';
  return (
    <div className="animate-slide-in" style={{ display: 'flex', gap: 10, padding: '3px 0', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, lineHeight: 1.6 }}>
      <span style={{ color: 'var(--text-muted)', minWidth: 80, flexShrink: 0 }}>
        {log.logged_at ? new Date(log.logged_at).toLocaleTimeString('en-IN') : ''}
      </span>
      <span style={{ color, minWidth: 60, fontWeight: 600 }}>[{log.level}]</span>
      <span style={{ color: 'var(--text-primary)', flex: 1, wordBreak: 'break-word' }}>{log.message}</span>
    </div>
  );
}

export default function ActivityPage() {
  const [activeInfo, setActiveInfo] = useState(null);
  const [liveLogs, setLiveLogs] = useState([]);
  const [progress, setProgress] = useState({ current: 0, total: 0, name: '', phase: 'idle' });
  const [autoScroll, setAutoScroll] = useState(true);
  const logRef = useRef(null);

  const fetchStatus = useCallback(async () => {
    const d = await api.getActiveRun().catch(() => null);
    setActiveInfo(d);
    if (d?.currentRun?.progress) setProgress(d.currentRun.progress);
  }, []);

  useEffect(() => {
    setLiveLogs([]);
    const close = createLogStream(
      (log) => setLiveLogs(prev => [...prev.slice(-500), log]),
      () => fetchStatus(),
      (p) => setProgress(p)
    );
    fetchStatus();
    const id = setInterval(fetchStatus, 3000);
    return () => { close(); clearInterval(id); };
  }, [fetchStatus]);

  useEffect(() => {
    if (autoScroll && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [liveLogs, autoScroll]);

  const isRunning = activeInfo?.isRunning;
  const elapsed = activeInfo?.currentRun?.elapsedMs;
  const elapsedFmt = elapsed ? `${Math.floor(elapsed / 60000)}m ${Math.floor((elapsed % 60000) / 1000)}s` : '—';
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="animate-fade-in" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Live Activity</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            {isRunning ? `Running · ${elapsedFmt}` : 'Idle — start a run to see live progress'}
          </p>
        </div>
        <RunControls isRunning={isRunning} onStatusChange={fetchStatus} />
      </div>

      {/* Progress card */}
      {isRunning && progress.total > 0 && (
        <div className="hero-banner" style={{ marginBottom: 12, padding: '16px 20px', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={16} color="var(--accent)" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>
                {progress.phase === 'done' ? 'Completed' : 'Messaging'} {progress.current}/{progress.total}
              </span>
              {progress.name && <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}> - {progress.name}</span>}
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{pct}%</span>
          </div>
          <div className="progress-bar" style={{ height: 8 }}>
            <div className="progress-fill" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--accent), #22c55e)' }} />
          </div>
        </div>
      )}

      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius)', padding: '10px 16px', marginBottom: 12,
        display: 'flex', gap: 24, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap'
      }}>
        <Stat label="Status" value={isRunning ? 'Running' : 'Idle'} highlight={isRunning} />
        <Stat label="PID" value={activeInfo?.currentRun?.pid || '—'} />
        <Stat label="Elapsed" value={elapsedFmt} />
        <Stat label="Log Lines" value={liveLogs.length} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost" onClick={() => setAutoScroll(a => !a)} style={{ padding: '4px 10px', fontSize: 11 }}>
            {autoScroll ? <Pause size={12} /> : <Play size={12} />}
            {autoScroll ? 'Pause Scroll' : 'Resume'}
          </button>
          <button className="btn btn-ghost" onClick={() => setLiveLogs([])} style={{ padding: '4px 10px', fontSize: 11 }}>
            <Trash2 size={12} /> Clear
          </button>
        </div>
      </div>

      <div ref={logRef} className="card" style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', background: 'var(--bg-base)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>
          <Terminal size={14} color="var(--accent)" />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>stdout stream</span>
        </div>
        {liveLogs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
            {isRunning ? '// Waiting for output...' : '// Start automation to see logs'}
          </div>
        ) : liveLogs.map((log, i) => <LogLine key={i} log={log} />)}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: highlight ? 'var(--success)' : 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}
