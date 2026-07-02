export default function StatusBadge({ status }) {
  const map = {
    success:   { cls: 'badge-success', label: 'Success' },
    failed:    { cls: 'badge-error',   label: 'Failed' },
    error:     { cls: 'badge-error',   label: 'Error' },
    completed: { cls: 'badge-success', label: 'Completed' },
    running:   { cls: 'badge-accent',  label: 'Running' },
    stopping:  { cls: 'badge-warning', label: 'Stopping' },
    idle:      { cls: 'badge-muted',   label: 'Idle' },
    pending:   { cls: 'badge-warning', label: 'Pending' },
    unknown:   { cls: 'badge-muted',   label: 'Unknown' },
    sent:      { cls: 'badge-info',    label: 'Sent' },
    drafted:   { cls: 'badge-accent',  label: 'Drafted' },
  };

  const s = status?.toLowerCase();
  const { cls, label } = map[s] || { cls: 'badge-muted', label: status || 'Unknown' };

  return (
    <span className={`badge ${cls}`}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
      {label}
    </span>
  );
}
