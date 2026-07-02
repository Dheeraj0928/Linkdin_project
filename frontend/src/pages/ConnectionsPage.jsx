import { useState, useEffect, useCallback } from 'react';
import { Search, ExternalLink, ChevronLeft, ChevronRight, MessageCircle, Check, X, Clock } from 'lucide-react';
import { api } from '../lib/api';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';
import { useToast } from '../contexts/ToastContext';

function getInitials(name) {
  return (name || '??').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
}

export default function ConnectionsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [replyFilter, setReplyFilter] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('created_at');
  const [order, setOrder] = useState('desc');
  const [tab, setTab] = useState('sent');
  const toast = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'sent') {
        const d = await api.getSentConnections({ search, page, limit: 20, reply_status: replyFilter });
        setData(d);
      } else {
        const d = await api.getConnections({ search, status, page, limit: 20, sort, order });
        setData(d);
      }
    } catch {}
    setLoading(false);
  }, [search, status, page, sort, order, tab, replyFilter]);

  useEffect(() => { setPage(1); }, [search, status, tab, replyFilter]);
  useEffect(() => { fetchData(); }, [fetchData]);

  async function setReply(id, reply_status) {
    try {
      await api.markReply(id, reply_status);
      toast(reply_status === 'replied' ? 'Marked as replied!' : 'Status updated', 'success');
      fetchData();
    } catch (err) { toast(err.message, 'error'); }
  }

  const totalPages = data ? Math.ceil((data.total || 0) / 20) : 1;
  const rc = data?.replyCounts;

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Connections</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
          Track sent messages and mark who replied
        </p>
      </div>

      {/* Reply summary */}
      {tab === 'sent' && rc && (
        <div className="stat-grid" style={{ marginBottom: 16, gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <MiniStat label="Total Sent" value={rc.total} color="var(--accent)" onClick={() => setReplyFilter('')} active={!replyFilter} />
          <MiniStat label="Replied" value={rc.replied} color="var(--success)" onClick={() => setReplyFilter('replied')} active={replyFilter === 'replied'} />
          <MiniStat label="Pending" value={rc.pending} color="var(--warning)" onClick={() => setReplyFilter('pending')} active={replyFilter === 'pending'} />
          <MiniStat label="No Reply" value={rc.no_reply} color="var(--text-muted)" onClick={() => setReplyFilter('no_reply')} active={replyFilter === 'no_reply'} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content' }}>
        {[['sent', 'Sent & Replies'], ['all', 'All Processed']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: tab === key ? 'var(--accent)' : 'transparent',
              color: tab === key ? '#fff' : 'var(--text-muted)',
            }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="input" placeholder="Search name or URL..." value={search}
            onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32 }} />
        </div>
        {tab === 'all' && (
          <select className="input" value={status} onChange={e => setStatus(e.target.value)} style={{ width: 140 }}>
            <option value="">All Statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
        )}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? <LoadingSkeleton rows={8} cols={5} /> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Profile</th>
                  {tab === 'all' && <th>Status</th>}
                  {tab === 'sent' && <th>Reply Status</th>}
                  {tab === 'sent' && <th>Mark Reply</th>}
                  <th>{tab === 'sent' ? 'Sent At' : 'Date'}</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {(data?.rows || []).map((c, i) => (
                  <tr key={c.id || i}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={c.name} />
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{c.name || '—'}</div>
                      </div>
                    </td>
                    {tab === 'all' && <td><StatusBadge status={c.status} /></td>}
                    {tab === 'sent' && (
                      <td>
                        <ReplyPill status={c.reply_status || 'pending'} />
                        {c.replied_at && c.reply_status === 'replied' && (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{formatTime(c.replied_at)}</div>
                        )}
                      </td>
                    )}
                    {tab === 'sent' && (
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className={`reply-btn ${c.reply_status === 'replied' ? 'active-replied' : ''}`}
                            onClick={() => setReply(c.id, 'replied')} title="They replied">
                            <Check size={10} /> Replied
                          </button>
                          <button className={`reply-btn ${c.reply_status === 'pending' ? 'active-pending' : ''}`}
                            onClick={() => setReply(c.id, 'pending')} title="Waiting">
                            <Clock size={10} />
                          </button>
                          <button className={`reply-btn ${c.reply_status === 'no_reply' ? 'active-noreply' : ''}`}
                            onClick={() => setReply(c.id, 'no_reply')} title="No reply">
                            <X size={10} />
                          </button>
                        </div>
                      </td>
                    )}
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {formatTime(tab === 'sent' ? c.sent_at : c.created_at)}
                    </td>
                    <td>
                      <a href={c.profile_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                        <ExternalLink size={12} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data?.rows?.length && (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                <MessageCircle size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                No connections found. Run automation to send messages.
              </div>
            )}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16, alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '6px 10px' }}>
            <ChevronLeft size={14} />
          </button>
          <span style={{ fontSize: 13 }}>Page {page} of {totalPages}</span>
          <button className="btn btn-ghost" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '6px 10px' }}>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function Avatar({ name }) {
  return (
    <div style={{
      width: 34, height: 34, borderRadius: '50%',
      background: `hsl(${(name?.charCodeAt(0) || 0) * 17 % 360}, 45%, 35%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
    }}>
      {getInitials(name)}
    </div>
  );
}

function ReplyPill({ status }) {
  const m = { replied: ['pill-replied', 'Replied'], pending: ['pill-pending', 'Pending'], no_reply: ['pill-noreply', 'No Reply'] };
  const [cls, label] = m[status] || m.pending;
  return <span className={`pill ${cls}`}>{label}</span>;
}

function MiniStat({ label, value, color, onClick, active }) {
  return (
    <button onClick={onClick} className="card" style={{
      padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
      borderColor: active ? color : undefined,
      background: active ? `${color}10` : undefined,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value ?? 0}</div>
    </button>
  );
}
