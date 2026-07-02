import { useState, useEffect } from 'react';
import { Send, MessageCircle, ExternalLink } from 'lucide-react';
import { api } from '../lib/api';
import LoadingSkeleton from '../components/ui/LoadingSkeleton';

function getInitials(name) {
  return (name || '??').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
}

export default function DraftsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSentConnections({ limit: 50 })
      .then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const rc = data?.replyCounts;

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Sent Messages</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
          All messages sent via automation — track replies in Connections tab
        </p>
      </div>

      {rc && (
        <div className="stat-grid" style={{ marginBottom: 20, gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <Stat label="Total Sent" value={rc.total} icon={Send} color="var(--accent)" />
          <Stat label="Replied" value={rc.replied} icon={MessageCircle} color="var(--success)" />
          <Stat label="Pending" value={rc.pending} color="var(--warning)" />
          <Stat label="No Reply" value={rc.no_reply} color="var(--text-muted)" />
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? <LoadingSkeleton rows={8} cols={4} /> : (
          <table className="table">
            <thead>
              <tr><th>Profile</th><th>Reply</th><th>Sent At</th><th>Link</th></tr>
            </thead>
            <tbody>
              {(data?.rows || []).map((c, i) => (
                <tr key={c.id || i}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: `hsl(${(c.name?.charCodeAt(0) || 0) * 17 % 360}, 40%, 30%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>
                        {getInitials(c.name)}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`pill pill-${c.reply_status === 'replied' ? 'replied' : c.reply_status === 'no_reply' ? 'noreply' : 'pending'}`}>
                      {c.reply_status === 'replied' ? 'Replied' : c.reply_status === 'no_reply' ? 'No Reply' : 'Pending'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatTime(c.sent_at)}</td>
                  <td>
                    <a href={c.profile_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                      <ExternalLink size={12} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && !data?.rows?.length && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No sent messages yet</div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, color }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color }}>{value ?? 0}</div>
        </div>
        {Icon && <Icon size={18} color={color} style={{ opacity: 0.7 }} />}
      </div>
    </div>
  );
}
