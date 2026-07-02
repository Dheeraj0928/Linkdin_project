import { useState, useEffect, useCallback } from 'react';
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';

const LEVELS = ['INFO', 'SUCCESS', 'WARN', 'ERROR'];
const LEVEL_COLORS = { INFO: '#60a5fa', SUCCESS: '#4ade80', WARN: '#fbbf24', WARNING: '#fbbf24', ERROR: '#f87171' };

function LogEntry({ log }) {
  const color = LEVEL_COLORS[log.level] || 'var(--text-secondary)';
  return (
    <div style={{
      display: 'flex', gap: 12, padding: '6px 16px', borderBottom: '1px solid var(--border-subtle)',
      fontFamily: 'JetBrains Mono, monospace', fontSize: 12, lineHeight: 1.6,
      transition: 'background 0.1s'
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontSize: 10, paddingTop: 1 }}>
        {log.logged_at ? new Date(log.logged_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'medium' }) : ''}
      </span>
      <span style={{ color, fontWeight: 700, minWidth: 56 }}>[{log.level}]</span>
      <span style={{ color: 'var(--text-primary)', flex: 1, wordBreak: 'break-word' }}>{log.message}</span>
      {log.meta && (
        <span style={{ color: 'var(--text-muted)', fontSize: 10, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {log.meta}
        </span>
      )}
      {log.run_key && (
        <span style={{ color: 'var(--accent)', fontSize: 10, flexShrink: 0 }}>
          run-{log.run_key?.slice(0, 10)}
        </span>
      )}
    </div>
  );
}

export default function LogsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('');
  const [runKey, setRunKey] = useState('');
  const [runKeys, setRunKeys] = useState([]);
  const [page, setPage] = useState(1);

  useEffect(() => { api.getLogRuns().then(setRunKeys).catch(() => {}); }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.getLogs({ search, level, run_key: runKey, page, limit: 100 });
      setData(d);
    } catch {}
    setLoading(false);
  }, [search, level, runKey, page]);

  useEffect(() => { setPage(1); }, [search, level, runKey]);
  useEffect(() => { fetchData(); }, [fetchData]);

  function downloadLogs() {
    const text = (data?.rows || []).map(l =>
      `[${l.logged_at}] [${l.level}] ${l.message}${l.meta ? ' ' + l.meta : ''}`
    ).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `logs-${new Date().toISOString().slice(0,10)}.log`;
    a.click(); URL.revokeObjectURL(url);
  }

  const totalPages = data ? Math.ceil((data.total || 0) / 100) : 1;

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Log Viewer</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Structured logs from all automation runs</p>
        </div>
        <button className="btn btn-ghost" onClick={downloadLogs} style={{ fontSize: 12 }}>
          <Download size={13} /> Download
        </button>
      </div>

      {/* Level count badges */}
      {data?.levelCounts && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {LEVELS.map(l => data.levelCounts[l] ? (
            <button key={l} onClick={() => setLevel(level === l ? '' : l)}
              style={{
                padding: '2px 10px', borderRadius: 100, border: `1px solid ${LEVEL_COLORS[l]}33`,
                background: level === l ? `${LEVEL_COLORS[l]}22` : 'transparent',
                color: LEVEL_COLORS[l], fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em'
              }}>
              {l} {data.levelCounts[l]}
            </button>
          ) : null)}
          <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>Total: {data?.total || 0}</span>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="input" placeholder="Search messages..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 30 }} />
        </div>
        <select className="input" value={runKey} onChange={e => setRunKey(e.target.value)} style={{ width: 200 }}>
          <option value="">All Runs</option>
          {runKeys.map(k => <option key={k} value={k}>{k?.slice(0,24)}</option>)}
        </select>
      </div>

      {/* Log display */}
      <div className="card" style={{ overflow: 'hidden', background: 'var(--bg-base)' }}>
        {loading ? <LoadingSkeleton rows={12} cols={4} /> : (
          <>
            {(data?.rows || []).map((log, i) => <LogEntry key={log.id || i} log={log} />)}
            {!data?.rows?.length && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}>
                // No logs found
              </div>
            )}
          </>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16, alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '6px 10px' }}>
            <ChevronLeft size={14} />
          </button>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Page {page} of {totalPages}</span>
          <button className="btn btn-ghost" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '6px 10px' }}>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
