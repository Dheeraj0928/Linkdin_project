import { useState, useEffect, useCallback } from 'react';
import {
  Users, CheckCircle2, XCircle, Clock, Zap, Send, MessageCircle,
  TrendingUp, MapPin, Link2, RotateCcw, ExternalLink, Mail
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import RunControls from '../components/ui/RunControls';
import { useToast } from '../contexts/ToastContext';

function formatDuration(ms) {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetchData = useCallback(async () => {
    try {
      const [d, p] = await Promise.all([
        api.getDashboard(),
        api.getProgress().catch(() => null),
      ]);
      setData(d);
      setProgress(p);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 8000);
    return () => clearInterval(id);
  }, [fetchData]);

  async function handleResetAnchor() {
    if (!confirm('Reset anchor? Next run will start from top of connections list.')) return;
    try {
      await api.resetAnchor();
      toast('Anchor reset!', 'success');
      fetchData();
    } catch (err) { toast(err.message, 'error'); }
  }

  const isRunning = data?.automationRunning;
  const outreach = progress?.outreach || {};
  const anchor = progress?.anchor || {};
  const replyPct = outreach.replyRate || data?.allTime?.replyRate || 0;

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <div className="hero-banner" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: isRunning ? 'var(--success)' : 'var(--text-muted)' }}
                className={isRunning ? 'animate-pulse-glow' : ''} />
              <span style={{ fontSize: 12, fontWeight: 600, color: isRunning ? 'var(--success)' : 'var(--text-muted)' }}>
                {isRunning ? 'Automation Running' : 'Ready to Start'}
              </span>
              {outreach.sendEnabled && <span className="pill pill-replied">Auto-Send ON</span>}
              {progress?.accountId && (
                <Link to="/accounts" className="pill" style={{ textDecoration: 'none' }}>
                  Account: {progress.accountId}
                </Link>
              )}
              {outreach.dailyLimit > 0 && (
                <span className="pill" style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent)' }}>
                  Today: {outreach.dailyUsed || 0}/{outreach.dailyLimit} msgs
                </span>
              )}
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              LinkedIn Outreach Hub
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 6, maxWidth: 520 }}>
              Track messages sent, replies received, and where your next batch starts.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <RunControls isRunning={isRunning} onStatusChange={fetchData} />
            <Link to="/activity" className="btn btn-ghost" style={{ fontSize: 13 }}>Live Activity →</Link>
          </div>
        </div>
      </div>

      {/* Main metrics */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <StatCard label="Messages Sent" value={outreach.totalSent ?? data?.allTime?.totalSent ?? '—'}
          icon={Send} color="var(--success)" sublabel="All time" />
        <StatCard label="Replies Received" value={outreach.replied ?? data?.allTime?.totalReplied ?? '—'}
          icon={MessageCircle} color="#ec4899" sublabel={`${replyPct}% reply rate`} />
        <StatCard label="Awaiting Reply" value={outreach.pending ?? data?.allTime?.pendingReplies ?? '—'}
          icon={Mail} color="var(--warning)" sublabel="Mark when they respond" />
        <StatCard label="No Reply" value={outreach.noReply ?? data?.allTime?.noReply ?? '—'}
          icon={XCircle} color="var(--text-muted)" sublabel="Marked as no response" />
        <StatCard label="Per Run Limit" value={outreach.maxPerRun ?? '—'}
          icon={Users} color="var(--accent)" sublabel="Max connections / run" />
        <StatCard label="Today's Runs" value={data?.today?.runs ?? '—'}
          icon={Zap} color="var(--info)" sublabel={`${data?.today?.successful ?? 0} sent today`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, marginBottom: 20 }}>
        {/* Reply rate + today */}
        <div className="glass-card" style={{ padding: 24 }}>
          <div className="section-title">Outreach Performance</div>
          <div style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="ring-chart" style={{ '--pct': replyPct }}>
              <span style={{ color: 'var(--success)' }}>{replyPct}%</span>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Reply Rate</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Bar label="Replied" value={outreach.replied || 0} total={outreach.totalSent || 1} color="var(--success)" />
                <Bar label="Pending" value={outreach.pending || 0} total={outreach.totalSent || 1} color="var(--warning)" />
                <Bar label="No Reply" value={outreach.noReply || 0} total={outreach.totalSent || 1} color="var(--text-muted)" />
              </div>
              <Link to="/connections" style={{ fontSize: 12, color: 'var(--accent)', marginTop: 12, display: 'inline-block' }}>
                Manage replies in Connections →
              </Link>
            </div>
          </div>
        </div>

        {/* Anchor panel */}
        <div className="glass-card" style={{ padding: 20 }}>
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={12} /> Message Anchor
          </div>
          {anchor.name ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{anchor.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                Next run messages everyone <strong style={{ color: 'var(--accent)' }}>below</strong> this person
              </div>
              {anchor.updatedAt && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 12 }}>Updated {formatTime(anchor.updatedAt)}</div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              {progress?.connectionCountHint || 'No anchor — will message from the top of your connections list (best for new accounts).'}
            </div>
          )}
          <button className="btn btn-ghost" onClick={handleResetAnchor} style={{ width: '100%', fontSize: 12, justifyContent: 'center' }}>
            <RotateCcw size={12} /> Reset Anchor
          </button>
        </div>
      </div>

      {/* Resume + recent sent */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="card" style={{ padding: 18 }}>
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Link2 size={12} /> Resume Link
          </div>
          {outreach.resumeUrl ? (
            <a href={outreach.resumeUrl} target="_blank" rel="noreferrer"
              style={{ fontSize: 12, color: 'var(--accent)', wordBreak: 'break-all', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <ExternalLink size={12} style={{ flexShrink: 0, marginTop: 2 }} />
              {outreach.resumeUrl}
            </a>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Not set — add in Configuration</span>
          )}
          <Link to="/configuration" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, display: 'block' }}>Edit in Configuration →</Link>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div className="section-title">Recently Sent</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(progress?.recentSent || []).slice(0, 5).map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{p.name?.split(' ').slice(0, 2).join(' ')}</span>
                <ReplyPill status={p.reply_status} />
              </div>
            ))}
            {!progress?.recentSent?.length && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No messages sent yet</span>
            )}
          </div>
        </div>
      </div>

      {/* Today + runs table */}
      <div className="section-title">Today</div>
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <StatCard label="Processed" value={data?.today?.connectionsProcessed ?? '—'} icon={Users} color="var(--accent)" />
        <StatCard label="Sent OK" value={data?.today?.successful ?? '—'} icon={CheckCircle2} color="var(--success)" />
        <StatCard label="Failed" value={data?.today?.failed ?? '—'} icon={XCircle} color="var(--error)" />
        <StatCard label="Runtime" value={formatDuration(data?.today?.runtimeMs)} icon={Clock} color="var(--info)" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>Recent Runs</div>
        <Link to="/runs" style={{ fontSize: 12, color: 'var(--accent)' }}>View all →</Link>
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
        ) : !data?.recentRuns?.length ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            No runs yet. Click <strong>Start Automation</strong> to begin.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Run</th><th>Started</th><th>Duration</th>
                <th>Sent</th><th>Failed</th><th>Skipped</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recentRuns.map(run => (
                <tr key={run.id}>
                  <td><span className="mono" style={{ color: 'var(--accent)', fontSize: 11 }}>#{run.id}</span></td>
                  <td>{formatTime(run.started_at)}</td>
                  <td>{formatDuration(run.duration_ms)}</td>
                  <td style={{ color: 'var(--success)' }}>{run.success_count}</td>
                  <td style={{ color: run.failed_count > 0 ? 'var(--error)' : 'var(--text-secondary)' }}>{run.failed_count}</td>
                  <td>{run.skipped_count}</td>
                  <td><StatusBadge status={run.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Bar({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
        <span style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{value} ({pct}%)</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function ReplyPill({ status }) {
  const map = {
    replied: { cls: 'pill-replied', label: 'Replied' },
    pending: { cls: 'pill-pending', label: 'Pending' },
    no_reply: { cls: 'pill-noreply', label: 'No Reply' },
  };
  const m = map[status] || map.pending;
  return <span className={`pill ${m.cls}`}>{m.label}</span>;
}
