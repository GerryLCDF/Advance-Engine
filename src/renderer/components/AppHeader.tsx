import React from 'react';
import { useAppStore } from '../store/useAppStore';

const VERSION = 'V alfa 0.0.05';

export function AppHeader() {
  const setActiveScreen = useAppStore((s) => s.setActiveScreen);
  const window_ = (window as any).advanceAPI?.window;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px',
        background: '#c4a0f0',
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
          background: '#fff',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 900,
          fontSize: 11,
          color: '#333',
          flexShrink: 0,
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
      >
        LOGO
      </div>

      {/* Title block */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#1a0a3a', lineHeight: 1.1 }}>
          Advance Studio
        </div>
        <div
          style={{
            fontSize: 13,
            color: '#3a1a7a',
            textAlign: 'right',
            marginTop: 2,
          }}
        >
          {VERSION}
        </div>
        {/* Sub-nav */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            marginTop: 4,
            WebkitAppRegion: 'no-drag',
          } as React.CSSProperties}
        >
          <NavPill label="Documentacion" onClick={() => {}} />
          <NavPill
            label="Creditos"
            onClick={() => setActiveScreen({ type: 'creditos' })}
          />
        </div>
      </div>

      {/* Window controls */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignSelf: 'flex-start',
          gap: 3,
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
      >
        <WinBtn label="─" title="Minimizar" onClick={() => window_?.minimize()} />
        <WinBtn label="✕" title="Cerrar" onClick={() => window_?.close()} danger />
      </div>
    </div>
  );
}

function NavPill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: '#7c3aed',
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
