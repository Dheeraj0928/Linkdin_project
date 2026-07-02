import { useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Circle } from 'lucide-react';
import { api } from '../../lib/api';
import AccountSwitcher from '../ui/AccountSwitcher';

const BREADCRUMB_MAP = {
  '/': 'Dashboard',
  '/connect': 'Connect Requests',
  '/accounts': 'Accounts',
  '/connections': 'Connections',
  '/activity': 'Live Activity',
  '/runs': 'Run History',
  '/drafts': 'Sent Messages',
  '/logs': 'Log Viewer',
  '/templates': 'Templates',
  '/configuration': 'Configuration',
  '/analytics': 'Analytics',
  '/settings': 'Settings',
};

export default function Navbar() {
  const location = useLocation();
  const [isRunning, setIsRunning] = useState(false);
  const page = BREADCRUMB_MAP[location.pathname] || 'Dashboard';

  useEffect(() => {
    const check = () => api.getActiveRun().then(d => setIsRunning(d.isRunning)).catch(() => {});
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <header style={{
      height: 56, background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', position: 'sticky', top: 0, zIndex: 40,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>LinkedAuto</span>
        <span style={{ color: 'var(--border)', fontSize: 14 }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{page}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <AccountSwitcher />
        {isRunning ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', animation: 'pulse-glow 1.5s infinite' }} />
            <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>Automation Running</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--border)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Idle</span>
          </div>
        )}
      </div>
    </header>
  );
}
