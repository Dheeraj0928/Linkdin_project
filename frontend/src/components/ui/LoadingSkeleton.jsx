export default function LoadingSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 16, padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="skeleton" style={{ height: 14, flex: j === 0 ? 1.5 : 1, borderRadius: 4 }} />
          ))}
        </div>
      ))}
    </div>
  );
}
