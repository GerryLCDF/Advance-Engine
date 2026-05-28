import React, { useEffect, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';

interface Props {
  onClose: () => void;
}

const THEME_PRESETS: { name: string; bgPanel: string; accent: string }[] = [
  { name: 'Advance Studio', bgPanel: '#2d2d33', accent: '#5a3fa0' },
  { name: 'GBStudio',       bgPanel: '#2a2d3e', accent: '#6888ff' },
  { name: 'Godot',          bgPanel: '#3d3d48', accent: '#478cbf' },
  { name: 'Unity',          bgPanel: '#38383d', accent: '#2196F3' },
  { name: 'White',          bgPanel: '#ececec', accent: '#7c3aed' },
  { name: 'Green',          bgPanel: '#1a2e1a', accent: '#4caf50' },
  { name: 'Gray',           bgPanel: '#2a2a2a', accent: '#888888' },
];

export function ThemeModal({ onClose }: Props) {
  const storeBg = useAppStore((s) => s.themeBgPanel);
  const storeAccent = useAppStore((s) => s.themeAccent);
  const storeFontSize = useAppStore((s) => s.fontSize);
  const setTheme = useAppStore((s) => s.setTheme);
  const setFontSize = useAppStore((s) => s.setFontSize);

  const snapshot = useRef({ bg: storeBg, accent: storeAccent, fontSize: storeFontSize });

  function presetName(): string {
    const match = THEME_PRESETS.find(
      (p) => p.bgPanel === storeBg.toLowerCase() && p.accent === storeAccent.toLowerCase()
    );
    return match ? match.name : 'Custom';
  }

  function handleBgChange(val: string) {
    setTheme(val, storeAccent);
  }

  function handleAccentChange(val: string) {
    setTheme(storeBg, val);
  }

  function pickPreset(p: typeof THEME_PRESETS[0]) {
    setTheme(p.bgPanel, p.accent);
  }

  function restoreDefaults() {
    setTheme('#2d2d33', '#5a3fa0');
    setFontSize(13);
  }

  function cancel() {
    setTheme(snapshot.current.bg, snapshot.current.accent);
    setFontSize(snapshot.current.fontSize);
    onClose();
  }

  function apply() {
    onClose();
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={cancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
          padding: 24,
          width: 380,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text)', fontSize: 14, fontWeight: 700 }}>
            Personalizar Tema
            <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 11, marginLeft: 8 }}>
              ({presetName()})
            </span>
          </span>
          <button
            onClick={cancel}
            style={{
              background: 'var(--bg-raised)', border: 'none', borderRadius: 4,
              color: 'var(--text-muted)', width: 24, height: 24,
              cursor: 'pointer', fontSize: 14, lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Theme Presets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ color: 'var(--text-muted)', fontSize: 11 }}>Temas predefinidos</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {THEME_PRESETS.map((p) => {
              const active = storeBg === p.bgPanel && storeAccent === p.accent;
              return (
                <button
                  key={p.name}
                  onClick={() => pickPreset(p)}
                  title={p.name}
                  style={{
                    width: 36, height: 36, borderRadius: 8,
                    border: active ? '2px solid var(--accent-light)' : '2px solid transparent',
                    background: `linear-gradient(135deg, ${p.bgPanel} 50%, ${p.accent} 50%)`,
                    cursor: 'pointer', outline: 'none',
                    transition: 'border-color 0.15s',
                  }}
                />
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {THEME_PRESETS.map((p) => (
              <span
                key={p.name}
                style={{
                  fontSize: 9,
                  color: storeBg === p.bgPanel && storeAccent === p.accent ? 'var(--accent-light)' : 'var(--text-dim)',
                  fontWeight: storeBg === p.bgPanel && storeAccent === p.accent ? 600 : 400,
                  cursor: 'default',
                }}
              >
                {p.name}
              </span>
            ))}
          </div>
        </div>

        {/* Color: Panel background */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ color: 'var(--text-muted)', fontSize: 11 }}>Fondo paneles</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="color"
              value={storeBg}
              onChange={(e) => handleBgChange(e.target.value)}
              style={{
                width: 40, height: 32, padding: 0, border: 'none',
                borderRadius: 4, cursor: 'pointer', background: 'transparent',
              }}
            />
            <input
              value={storeBg}
              onChange={(e) => handleBgChange(e.target.value)}
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
          <label style={{ color: 'var(--text-muted)', fontSize: 11 }}>Acento</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="color"
              value={storeAccent}
              onChange={(e) => handleAccentChange(e.target.value)}
              style={{
                width: 40, height: 32, padding: 0, border: 'none',
                borderRadius: 4, cursor: 'pointer', background: 'transparent',
              }}
            />
            <input
              value={storeAccent}
              onChange={(e) => handleAccentChange(e.target.value)}
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
            <span style={{ color: 'var(--text)', fontSize: 11, fontFamily: 'monospace' }}>{storeFontSize}px</span>
          </div>
          <input
            type="range"
            min={10}
            max={20}
            step={1}
            value={storeFontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-dim)' }}>
            <span>10px</span>
            <span>20px</span>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <button
            onClick={restoreDefaults}
            style={{
              background: 'var(--bg-raised)', border: 'none', borderRadius: 6,
              color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600,
              padding: '6px 16px', cursor: 'pointer',
            }}
          >
            Restaurar predeterminado
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={cancel}
              style={{
                background: 'var(--bg-raised)', border: 'none', borderRadius: 6,
                color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600,
                padding: '7px 20px', cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              onClick={apply}
              style={{
                background: 'var(--accent)', border: 'none', borderRadius: 6,
                color: '#fff', fontSize: 12, fontWeight: 600,
                padding: '7px 20px', cursor: 'pointer',
              }}
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
