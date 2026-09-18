import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { VERSION } from '../../version';
import { ThemeModal } from './editor/ThemeModal';

export function AppHeader() {
  const setActiveScreen = useAppStore((s) => s.setActiveScreen);
  const window_ = (window as any).advanceAPI?.window;
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px',
        background: 'var(--accent-light)',
        flexShrink: 0,
        // drag region for frameless window
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
    >
      {/* Logo */}
      <div
        style={{
          width: 56,
          height: 56,
          background: 'var(--bg-raised)',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 900,
          fontSize: 11,
          color: 'var(--text)',
          flexShrink: 0,
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
      >
        <img src="/icon.png" alt="Logo" style={{ width: '100%', height: '100%', borderRadius: 10, objectFit: 'cover' }} />
      </div>

      {/* Title block */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent-dark)', lineHeight: 1.1 }}>
          Advance Studio
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--accent)',
            textAlign: 'right',
            marginTop: 2,
          }}
        >
          V alfa {VERSION}
        </div>
        {/* Sub-nav */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginTop: 4,
            WebkitAppRegion: 'no-drag',
          } as React.CSSProperties}
        >
          <div style={{ display: 'flex', gap: 4 }}>
            <NavPill label="Documentacion" onClick={() => {}} />
            <NavPill
              label="Creditos"
              onClick={() => setActiveScreen({ type: 'creditos' })}
            />
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ position: 'relative' }}>
            <NavPill
              label="Opciones"
              onClick={() => setShowOptionsMenu((v) => !v)}
            />
            {showOptionsMenu && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 998 }}
                  onClick={() => setShowOptionsMenu(false)}
                />
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 999,
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8, minWidth: 160, padding: 4,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
                  display: 'flex', flexDirection: 'column', gap: 2,
                }}>
                  <OptionRow label="Idioma" upcoming onClick={() => setShowOptionsMenu(false)} />
                  <OptionRow
                    label="Aspecto"
                    onClick={() => { setShowThemeModal(true); setShowOptionsMenu(false); }}
                  />
                  <OptionRow label="Escala" upcoming onClick={() => setShowOptionsMenu(false)} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Window controls — solo cerrar en el launcher */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignSelf: 'flex-start',
          gap: 3,
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
      >
        <WinBtn label="✕" title="Cerrar" onClick={() => window_?.close()} danger />
      </div>

      {showThemeModal && <ThemeModal onClose={() => setShowThemeModal(false)} />}
    </div>
  );
}

function OptionRow({
  label,
  onClick,
  upcoming,
}: {
  label: string;
  onClick: () => void;
  upcoming?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent', border: 'none', borderRadius: 5,
        color: upcoming ? 'var(--text-dim)' : 'var(--text-secondary)',
        fontSize: 12, fontWeight: 600, padding: '7px 10px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        fontFamily: 'inherit', textAlign: 'left',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-raised)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {label}
      {upcoming && <span style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 400 }}>próximamente</span>}
    </button>
  );
}

function NavPill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--accent)',
        border: 'none',
        borderRadius: 4,
        color: '#fff',
        fontSize: 11,
        padding: '2px 8px',
        cursor: 'pointer',
        fontWeight: 600,
      }}
    >
      {label}
    </button>
  );
}

function WinBtn({
  label,
  title,
  onClick,
  danger,
}: {
  label: string;
  title: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        background: danger ? 'rgba(180,30,30,0.8)' : 'rgba(0,0,0,0.2)',
        border: 'none',
        borderRadius: 3,
        color: '#fff',
        fontSize: 11,
        width: 22,
        height: 18,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {label}
    </button>
  );
}
