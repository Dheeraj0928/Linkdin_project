import { useState, useEffect, useCallback } from 'react';
import { User, LogIn, RefreshCw, Shield, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../contexts/ToastContext';

export default function AccountsPage() {
  const [data, setData] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(null);
  const [newAccountId, setNewAccountId] = useState('');
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const [accounts, h] = await Promise.all([
        api.getAccounts(),
        api.getAccountHealth(),
      ]);
      setData(accounts);
      setHealth(h);
    } catch (err) {
      toast(err.message, 'error');
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function handleSwitch(id) {
    setSwitching(id);
    try {
      const res = await api.switchAccount(id);
      toast(`Switched to ${id}`, 'success');
      await load();
    } catch (err) {
      toast(err.message, 'error');
    }
    setSwitching(null);
  }

  async function handleLogin(id) {
    try {
      await api.loginAccount(id);
      toast(`Login window opened for "${id}". Sign in in Chrome, then press Enter in terminal.`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function handleAddAccount() {
    const id = newAccountId.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    if (!id) return toast('Enter a valid account ID (letters, numbers, underscore)', 'error');
    await handleSwitch(id);
    setNewAccountId('');
    handleLogin(id);
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading accounts...</div>;
  }

  const accounts = data?.accounts || [];

  return (
    <div className="animate-fade-in" style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>LinkedIn Accounts</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Each account has its own Chrome profile and data folder. Switch accounts without mixing sessions.
        </p>
      </div>

      {health && (
        <div className="card" style={{ padding: 16, marginBottom: 20, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Active Account</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>{health.accountId}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Today Messages</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{health.dailyUsage?.messages || 0} / {health.dailyLimits?.messages || 25}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Today Connects</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{health.dailyUsage?.connects || 0} / {health.dailyLimits?.connects || 15}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {health.ready ? (
              <><CheckCircle size={16} color="var(--success)" /><span style={{ fontSize: 12, color: 'var(--success)' }}>Profile ready</span></>
            ) : (
              <><AlertCircle size={16} color="var(--warning)" /><span style={{ fontSize: 12, color: 'var(--warning)' }}>Login required</span></>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden', marginBottom: 20 }}>
        {accounts.map((acc, i) => (
          <div key={acc.id} style={{
            display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px',
            borderBottom: i < accounts.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            background: acc.isActive ? 'rgba(99,102,241,0.06)' : 'transparent',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: 'var(--bg-elevated)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <User size={18} color={acc.isActive ? 'var(--accent)' : 'var(--text-muted)'} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{acc.id}</span>
                {acc.isActive && <span className="pill pill-replied">Active</span>}
                {acc.isLoggedIn && <Shield size={12} color="var(--success)" />}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {acc.sentCount} tracked · {acc.dataDir}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {!acc.isActive && (
                <button className="btn btn-ghost" onClick={() => handleSwitch(acc.id)} disabled={!!switching}>
                  {switching === acc.id ? '...' : 'Switch'}
                </button>
              )}
              <button className="btn btn-ghost" onClick={() => handleLogin(acc.id)} title="Open login browser">
                <LogIn size={14} /> Login
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Add New Account</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          <input className="input" placeholder="e.g. account2, work, personal"
            value={newAccountId} onChange={(e) => setNewAccountId(e.target.value)}
            style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={handleAddAccount}>Add & Login</button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
          Or run in terminal: <code>npm run login:account -- account2</code>
        </p>
      </div>

      <button className="btn btn-ghost" onClick={load} style={{ marginTop: 16 }}>
        <RefreshCw size={14} /> Refresh
      </button>
    </div>
  );
}
