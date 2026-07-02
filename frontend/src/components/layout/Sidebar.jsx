import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Activity, Play, FileText,
  ScrollText, Layers, Settings2, BarChart3, Settings, UserPlus, UserCircle,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/accounts', icon: UserCircle, label: 'Accounts' },
  { to: '/connect', icon: UserPlus, label: 'Connect Requests' },
  { to: '/connections', icon: Users, label: 'Connections' },
  { to: '/activity', icon: Activity, label: 'Activity' },
  { to: '/runs', icon: Play, label: 'Runs' },
  { to: '/drafts', icon: FileText, label: 'Sent Messages' },
  { to: '/logs', icon: ScrollText, label: 'Logs' },
  { to: '/templates', icon: Layers, label: 'Templates' },
  { to: '/configuration', icon: Settings2, label: 'Configuration' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  return (
    <div className="sidebar">
      {/* Logo */}
      <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--accent), #5b50e0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 12px var(--accent-glow)',
            fontSize: 14, fontWeight: 800, color: '#fff', fontFamily: 'Inter, sans-serif'
          }}>
            in
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>LinkedAuto</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>Outreach Dashboard</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
        <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Navigation
        </div>
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={15} />
            <span style={{ flex: 1 }}>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          LinkedIn Automation v1.0
        </div>
      </div>
    </div>
  );
}
