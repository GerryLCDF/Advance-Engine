import React from 'react';

export function ComingSoonTab({ label }: { label: string }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-canvas)',
      gap: 16,
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        background: 'var(--bg-raised)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32, color: 'var(--accent)',
      }}>
        🚧
      </div>
      <div style={{ color: 'var(--text-secondary)', fontSize: 20, fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
        Coming soon
      </div>
    </div>
  );
}
