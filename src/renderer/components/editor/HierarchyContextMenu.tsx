import React from 'react';

interface Props {
  x: number;
  y: number;
  onRename?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  onClose: () => void;
}

const itemStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: 12,
  borderRadius: 4,
  cursor: 'pointer',
  color: 'var(--text-secondary)',
  background: 'none',
  border: 'none',
  textAlign: 'left',
};

/** Menú contextual (clic derecho) de las jerarquías: Renombrar / Eliminar. */
export function HierarchyContextMenu({ x, y, onRename, onDelete, deleteLabel, onClose }: Props) {
  return (
    <>
      <div
        style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, zIndex: 999, background: 'transparent' }}
        onMouseDown={onClose}
      />
      <div style={{
        position: 'fixed', left: x, top: y, zIndex: 1000,
        background: 'var(--bg-panel)', border: '1px solid var(--border-color)',
        borderRadius: 6, padding: 4, display: 'flex', flexDirection: 'column', gap: 2,
        minWidth: 130, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}>
        {onRename && (
          <button
            onClick={() => { onRename(); onClose(); }}
            style={itemStyle}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-raised)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            Renombrar
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => { onDelete(); onClose(); }}
            style={{ ...itemStyle, color: '#ef4444' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-raised)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {deleteLabel ?? 'Eliminar'}
          </button>
        )}
      </div>
    </>
  );
}
