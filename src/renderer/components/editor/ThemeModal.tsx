import React from 'react';
import { useAppStore } from '../../store/useAppStore';

interface Props {
  onClose: () => void;
}

export function ThemeModal({ onClose }: Props) {
  const themeBgPanel = useAppStore((s) => s.themeBgPanel);
  const themeAccent = useAppStore((s) => s.themeAccent);
  const fontSize = useAppStore((s) => s.fontSize);
  const setTheme = useAppStore((s) => s.setTheme);
  const setFontSize = useAppStore((s) => s.setFontSize);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
          padding: 24,
          width: 360,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text)', fontSize: 14, fontWeight: 700 }}>Personalizar Tema</span>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg-raised)', border: 'none', borderRadius: 4,
              color: 'var(--text-muted)', width: 24, height: 24,
              cursor: 'pointer', fontSize: 14, lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Color: Panel background */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ color: 'var(--text-muted)', fontSize: 11 }}>Fondo paneles</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="color"
              value={themeBgPanel}
              onChange={(e) => setTheme(e.target.value, themeAccent)}
              style={{
                width: 40, height: 32, padding: 0, border: 'none',
                borderRadius: 4, cursor: 'pointer', background: 'transparent',
              }}
            />
            <input
              value={themeBgPanel}
              onChange={(e) => setTheme(e.target.value, themeAccent)}
              style={{
                flex: 1, background: 'var(--bg-dark)', border: '1px solid var(--bg-raised)',
                borderRadius: 4, color: 'var(--text)', fontSize: 11,
                padding: '5px 8px', outline: 'none', fontFamily: 'monospace',
              }}
            />
          </div>
        </div>

        {/* Color: Accent */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ color: 'var(--text-muted)', fontSize: 11 }}>Acento morado</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="color"
              value={themeAccent}
              onChange={(e) => setTheme(themeBgPanel, e.target.value)}
              style={{
                width: 40, height: 32, padding: 0, border: 'none',
                borderRadius: 4, cursor: 'pointer', background: 'transparent',
              }}
            />
            <input
              value={themeAccent}
              onChange={(e) => setTheme(themeBgPanel, e.target.value)}
              style={{
                flex: 1, background: 'var(--bg-dark)', border: '1px solid var(--bg-raised)',
                borderRadius: 4, color: 'var(--text)', fontSize: 11,
                padding: '5px 8px', outline: 'none', fontFamily: 'monospace',
              }}
            />
          </div>
        </div>

        {/* Font size slider */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ color: 'var(--text-muted)', fontSize: 11 }}>Tamaño de texto</label>
            <span style={{ color: 'var(--text)', fontSize: 11, fontFamily: 'monospace' }}>{fontSize}px</span>
          </div>
          <input
            type="range"
            min={10}
            max={20}
            step={1}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-dim)' }}>
            <span>10px</span>
            <span>20px</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <button
            onClick={() => { setTheme('#2d2d33', '#5a3fa0'); setFontSize(13); }}
            style={{
              background: 'var(--bg-raised)', border: 'none', borderRadius: 6,
              color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600,
              padding: '6px 16px', cursor: 'pointer',
            }}
          >
            Restaurar predeterminado
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'var(--accent)', border: 'none', borderRadius: 6,
              color: '#fff', fontSize: 12, fontWeight: 600,
              padding: '6px 20px', cursor: 'pointer',
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}