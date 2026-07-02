import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react';
import { api } from '../lib/api';
import StatusBadge from '../components/ui/StatusBadge';
import RunControls from '../components/ui/RunControls';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';

function formatDuration(ms) {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
}

function RunRow({ run }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState(null);

  async function toggle() {
    if (!expanded && !detail) {
      const d = await api.getRun(run.id).catch(() => null);
      setDetail(d);
    }
    setExpanded(e => !e);
  }

  const successPct = run.success_count + run.failed_count > 0
    ? Math.round((run.success_count / (run.success_count + run.failed_count)) * 100)
    : 0;

  return (
    <>
      <tr style={{ cursor: 'pointer' }} onClick={toggle}>
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {expanded ? <ChevronDown size={12} color="var(--accent)" /> : <ChevronRight size={12} color="var(--text-muted)" />}
            <span className="mono" style={{ color: 'var(--accent)', fontSize: 11 }}>#{run.id}</span>
          </div>
        </td>
        <td style={{ fontSize: 12 }}>{formatTime(run.started_at)}</td>
        <td style={{ fontSize: 12 }}>{formatTime(run.completed_at)}</td>
        <td style={{ fontSize: 12 }}>{formatDuration(run.duration_ms)}</td>
        <td style={{ color: 'var(--success)', fontWeight: 600 }}>{run.success_count}</td>
        <td style={{ color: run.failed_count > 0 ? 'var(--error)' : 'var(--text-secondary)', fontWeight: 600 }}>{run.failed_count}</td>
        <td style={{ color: 'var(--text-muted)' }}>{run.skipped_count}</td>
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="progress-bar" style={{ width: 60 }}>
              <div className="progress-fill" style={{ width: `${successPct}%`, background: successPct > 70 ? 'var(--success)' : successPct > 40 ? 'var(--warning)' : 'var(--error)' }} />
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{successPct}%</span>
          </div>
        </td>
        <td><StatusBadge status={run.status} /></td>
      </tr>
      {expanded && detail && (
        <tr>
          <td colSpan={9} style={{ padding: 0, background: 'var(--bg-base)' }}>
            <div style={{ padding: '12px 32px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Connections ({detail.connections?.length || 0})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(detail.connections || []).slice(0, 30).map((c, i) => (
                  <span key={i} style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 4,
                    background: c.status === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    color: c.status === 'success' ? 'var(--success)' : 'var(--error)',
                    border: `1px solid ${c.status === 'success' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`
                  }}>
                    {c.name?.split(' ')[0] || '?'}
                  </span>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function RunsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [activeInfo, setActiveInfo] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [runs, active] = await Promise.all([
      api.getRuns({ page, limit: 15 }).catch(() => null),
      api.getActiveRun().catch(() => null),
    ]);
    setData(runs);
    setActiveInfo(active);
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = data ? Math.ceil((data.total || 0) / 15) : 1;

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Run History</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>All automation runs — click a row to expand details</p>
        </div>
        <RunControls isRunning={activeInfo?.isRunning} onStatusChange={fetchData} />
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? <LoadingSkeleton rows={8} cols={7} /> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th><th>Started</th><th>Completed</th><th>Duration</th>
                  <th>Success</th><th>Failed</th><th>Skipped</th><th>Rate</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(data?.runs || []).map(run => <RunRow key={run.id} run={run} />)}
              </tbody>
            </table>
            {!data?.runs?.length && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No runs found.</div>
            )}
          </div>
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
