import { useState, useEffect } from 'react';
import { Plus, Trash2, Check, Edit2, X, Eye } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../contexts/ToastContext';

const VARIABLES = ['{Name}', '{Company}', '{ResumeLink}'];

function personalizePreview(template, name = 'Rahul', company = 'Google', resume = 'https://drive.google.com/...') {
  return template
    .replace(/\{\{\s*name\s*\}\}/gi, name).replace(/\{\s*name\s*\}/gi, name)
    .replace(/\{\{\s*company\s*\}\}/gi, company).replace(/\{\s*company\s*\}/gi, company)
    .replace(/\{\{\s*resumelink\s*\}\}/gi, resume).replace(/\{\s*resumelink\s*\}/gi, resume);
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editContent, setEditContent] = useState('');
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState(false);
  const toast = useToast();

  useEffect(() => { fetchTemplates(); }, []);

  async function fetchTemplates() {
    const t = await api.getTemplates().catch(() => []);
    setTemplates(t);
    if (!selected && t.length) setSelected(t[0]);
  }

  function startEdit(t) {
    setEditing(true); setCreating(false);
    setEditName(t.name); setEditContent(t.content); setSelected(t);
  }

  function startCreate() {
    setCreating(true); setEditing(false); setSelected(null);
    setEditName('New Template'); setEditContent('Hi {Name},\n\n\n\nBest regards');
  }

  async function save() {
    try {
      if (creating) {
        const t = await api.createTemplate({ name: editName, content: editContent });
        toast('Template created!', 'success');
        setCreating(false); setSelected(t);
      } else {
        const t = await api.updateTemplate(selected.id, { name: editName, content: editContent });
        toast('Template saved!', 'success');
        setEditing(false); setSelected(t);
      }
      fetchTemplates();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function activate(id) {
    try {
      await api.activateTemplate(id);
      toast('Template activated! message.txt updated.', 'success');
      fetchTemplates();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function deleteTemplate(id) {
    if (!confirm('Delete this template?')) return;
    try {
      await api.deleteTemplate(id);
      toast('Deleted', 'info');
      setSelected(null); fetchTemplates();
    } catch (err) { toast(err.message, 'error'); }
  }

  const activeContent = editing || creating ? editContent : selected?.content || '';

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Templates</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Manage message templates. Activate to use in next run.</p>
        </div>
        <button className="btn btn-primary" onClick={startCreate}><Plus size={14} /> New Template</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, height: 'calc(100vh - 200px)' }}>
        {/* Template list */}
        <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Templates
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {templates.map(t => (
              <div key={t.id} onClick={() => { setSelected(t); setEditing(false); setCreating(false); }}
                style={{
                  padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)',
                  background: selected?.id === t.id && !creating ? 'var(--accent-glow)' : 'transparent',
                  transition: 'background 0.15s'
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {t.is_active ? <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} /> : <div style={{ width: 6 }} />}
                  <span style={{ fontSize: 13, fontWeight: 500, color: selected?.id === t.id ? 'var(--accent)' : 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.name}
                  </span>
                </div>
                {t.is_active && <div style={{ fontSize: 10, color: 'var(--success)', marginTop: 2, marginLeft: 12 }}>Active</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Editor + Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
          {(selected || creating) ? (
            <>
              {/* Toolbar */}
              <div className="card" style={{ padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
                {editing || creating ? (
                  <>
                    <input className="input" value={editName} onChange={e => setEditName(e.target.value)} style={{ width: 200, padding: '6px 10px', fontSize: 13 }} placeholder="Template name" />
                    <button className="btn btn-primary" onClick={save} style={{ fontSize: 12, padding: '6px 14px' }}><Check size={13} /> Save</button>
                    <button className="btn btn-ghost" onClick={() => { setEditing(false); setCreating(false); }} style={{ fontSize: 12, padding: '6px 10px' }}><X size={13} /></button>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{selected?.name}</span>
                    {selected?.is_active && <span className="badge badge-success">Active</span>}
                    <button className="btn btn-ghost" onClick={() => startEdit(selected)} style={{ fontSize: 12, padding: '6px 10px' }}><Edit2 size={12} /> Edit</button>
                    {!selected?.is_active && <button className="btn btn-success" onClick={() => activate(selected.id)} style={{ fontSize: 12, padding: '6px 12px' }}><Check size={12} /> Activate</button>}
                    <button className="btn btn-ghost" onClick={() => setPreview(p => !p)} style={{ fontSize: 12, padding: '6px 10px' }}><Eye size={12} /> {preview ? 'Edit' : 'Preview'}</button>
                    {!selected?.is_active && <button className="btn btn-danger" onClick={() => deleteTemplate(selected.id)} style={{ fontSize: 12, padding: '6px 10px' }}><Trash2 size={12} /></button>}
                  </>
                )}
              </div>

              {/* Variables */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>Variables:</span>
                {VARIABLES.map(v => (
                  <span key={v} className="badge badge-accent" style={{ cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}
                    onClick={() => editing || creating ? setEditContent(c => c + v) : null}>
                    {v}
                  </span>
                ))}
              </div>

              {/* Content */}
              <div style={{ display: 'grid', gridTemplateColumns: preview || editing || creating ? '1fr 1fr' : '1fr', gap: 12, flex: 1, overflow: 'hidden', minHeight: 0 }}>
                {(editing || creating) && (
                  <textarea className="input" value={editContent} onChange={e => setEditContent(e.target.value)}
                    style={{ resize: 'none', flex: 1, fontFamily: 'JetBrains Mono, monospace', fontSize: 13, lineHeight: 1.7, height: '100%' }} />
                )}
                <div className="card" style={{ padding: 16, overflow: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'Inter, sans-serif', fontSize: 14, lineHeight: 1.8, color: 'var(--text-primary)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12, letterSpacing: '0.05em' }}>
                    Preview — Rahul @ Google
                  </div>
                  <div style={{ color: 'var(--text-primary)', lineHeight: 1.8 }}>
                    {personalizePreview(activeContent)}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="card" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Select a template or create a new one
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
