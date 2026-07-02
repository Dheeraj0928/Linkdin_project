import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { api } from '../lib/api';

const COLORS = ['#7c6af5', '#22c55e', '#ef4444', '#f59e0b', '#3b82f6', '#ec4899'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const [stats, setStats] = useState(null);
  const [period, setPeriod] = useState('daily');
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    const d = await api.getStats(period).catch(() => null);
    setStats(d);
    setLoading(false);
  }, [period]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const ChartCard = ({ title, children }) => (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16 }}>{title}</div>
      {loading ? (
        <div className="skeleton" style={{ height: 200, borderRadius: 8 }} />
      ) : children}
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Analytics</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Charts and trends from your automation history</p>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius)', padding: 4 }}>
          {['daily', 'weekly', 'monthly'].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{
                padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: period === p ? 'var(--accent)' : 'transparent',
                color: period === p ? '#fff' : 'var(--text-muted)', textTransform: 'capitalize',
              }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Summary totals */}
      {stats?.replyTotals && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Messages Sent', value: stats.replyTotals.total_sent, color: 'var(--accent)' },
            { label: 'Replies', value: stats.replyTotals.replied, color: 'var(--success)' },
            { label: 'Pending', value: stats.replyTotals.pending, color: 'var(--warning)' },
            { label: 'No Reply', value: stats.replyTotals.no_reply, color: 'var(--text-muted)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card" style={{ padding: '14px 20px', flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color }}>{value || 0}</div>
            </div>
          ))}
        </div>
      )}

      {stats?.totals && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Connections', value: stats.totals.totalConnections, color: 'var(--accent)' },
            { label: 'Total Success', value: stats.totals.totalSuccess, color: 'var(--success)' },
            { label: 'Total Failed', value: stats.totals.totalFailed, color: 'var(--error)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card" style={{ padding: '14px 20px', flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color }}>{value || 0}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Profiles per period */}
        <ChartCard title="Profiles Processed">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats?.profilesPerPeriod || []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="period" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="success" fill="#22c55e" name="Success" radius={[3,3,0,0]} />
              <Bar dataKey="failed" fill="#ef4444" name="Failed" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Success rate trend */}
        <ChartCard title="Success Rate %">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={stats?.successRateTrend || []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="period" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="rate" stroke="#7c6af5" strokeWidth={2} dot={{ fill: '#7c6af5', r: 3 }} name="Rate %" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Most common errors */}
        <ChartCard title="Most Common Errors">
          {!stats?.topErrors?.length ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No errors recorded 🎉
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={stats.topErrors} dataKey="count" nameKey="error_code" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}
                  style={{ fontSize: 10, fill: 'var(--text-muted)' }}>
                  {(stats.topErrors || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Replies over time */}
        <ChartCard title="Replies Received">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats?.repliedPerPeriod || []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="period" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="#ec4899" name="Replies" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Avg run duration */}
        <ChartCard title="Avg Run Duration (ms)">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats?.runsPerPeriod || []} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="period" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="avg_duration_ms" fill="#7c6af5" name="Avg Duration ms" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
