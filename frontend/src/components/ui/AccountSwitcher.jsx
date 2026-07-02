import { useState, useEffect } from 'react';
import { ChevronDown, User } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { Link } from 'react-router-dom';

export default function AccountSwitcher() {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [activeId, setActiveId] = useState('default');
  const toast = useToast();

  useEffect(() => {
    api.getAccounts().then((d) => {
      setAccounts(d.accounts || []);
      setActiveId(d.activeAccountId || 'default');
    }).catch(() => {});
  }, []);

  async function switchTo(id) {
    if (id === activeId) { setOpen(false); return; }
    try {
      await api.switchAccount(id);
      setActiveId(id);
      setOpen(false);
      toast(`Switched to ${id}`, 'success');
      window.location.reload();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} className="btn btn-ghost" style={{
        display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 10px',
      }}>
        <User size={14} />
        <span style={{ fontWeight: 600, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeId}</span>
        <ChevronDown size={12} />
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 50,
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 8, minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            overflow: 'hidden',
          }}>
            {accounts.map((a) => (
              <button key={a.id} onClick={() => switchTo(a.id)} style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
                background: a.id === activeId ? 'rgba(99,102,241,0.1)' : 'transparent',
                border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13,
              }}>
                <span style={{ fontWeight: a.id === activeId ? 700 : 500 }}>{a.id}</span>
                {a.isLoggedIn && <span style={{ fontSize: 10, color: 'var(--success)', marginLeft: 6 }}>●</span>}
              </button>
            ))}
            <Link to="/accounts" onClick={() => setOpen(false)} style={{
              display: 'block', padding: '10px 14px', fontSize: 12, color: 'var(--accent)',
              borderTop: '1px solid var(--border-subtle)', textDecoration: 'none',
            }}>
              Manage accounts →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
