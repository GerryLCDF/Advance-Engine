import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  background?: string;
}

export function EmptyState({ icon, title, hint, action, background = 'var(--bg-canvas)' }: EmptyStateProps) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 10, background, color: 'var(--text-muted)', minHeight: 0, minWidth: 0,
    }}>
      <div style={{ color: 'var(--text-muted)' }}>{icon}</div>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
      {hint && (
        <span style={{ fontSize: 11, maxWidth: 400, textAlign: 'center', lineHeight: 1.5 }}>{hint}</span>
      )}
      {action}
    </div>
  );
}
