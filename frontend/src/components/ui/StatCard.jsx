import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function StatCard({ label, value, icon: Icon, color = 'var(--accent)', sublabel, trend }) {
  return (
    <div className="card animate-fade-in" style={{ padding: '20px', position: 'relative', overflow: 'hidden' }}>
      {/* Subtle background glow */}
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 80, height: 80, borderRadius: '50%',
        background: color, opacity: 0.06, filter: 'blur(20px)'
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            {label}
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>
            {value ?? <span className="skeleton" style={{ display: 'inline-block', width: 60, height: 28 }} />}
          </div>
          {sublabel && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{sublabel}</div>
          )}
        </div>
        {Icon && (
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `${color}18`, border: `1px solid ${color}28`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Icon size={18} color={color} />
          </div>
        )}
      </div>

      {trend !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 10 }}>
          {trend > 0
            ? <TrendingUp size={12} color="var(--success)" />
            : trend < 0
            ? <TrendingDown size={12} color="var(--error)" />
            : <Minus size={12} color="var(--text-muted)" />}
          <span style={{ fontSize: 11, color: trend > 0 ? 'var(--success)' : trend < 0 ? 'var(--error)' : 'var(--text-muted)' }}>
            {trend > 0 ? '+' : ''}{trend}% from yesterday
          </span>
        </div>
      )}
    </div>
  );
}
