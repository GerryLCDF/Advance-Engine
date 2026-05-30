/**
 * CreditosScreen
 * ─────────────────────────────────────────────────────────────
 * Pantalla de créditos con:
 *  - Fondo degradado azul cielo
 *  - Lista de créditos que se desplaza de abajo hacia arriba con Framer Motion
 *  - Hover: glow/iluminación en el nombre
 *  - Click: abre URL si linkEnabled === true
 */

import React, { useRef } from 'react';
import { motion, useAnimationFrame } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';

export function CreditosScreen() {
  const credits = useAppStore((s) => s.credits);
  const setActiveScreen = useAppStore((s) => s.setActiveScreen);
  const api = (window as any).advanceAPI;

  const handleClick = (url: string, linkEnabled: boolean) => {
    if (!linkEnabled || !url) return;
    if (api) {
      api.shell.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <motion.div
      key="creditos"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflow: 'hidden',
        borderRadius: 8,
        zIndex: 10,
      }}
    >
      {/* Fondo animado de nubes */}
      <iframe
        src="/nubes.html"
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          border: 'none', pointerEvents: 'none', zIndex: 0,
        }}
        title="fondo"
      />

      {/* Capa semitransparente para mejorar legibilidad */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'linear-gradient(180deg, rgba(21,101,160,0.5) 0%, rgba(0,0,0,0.2) 100%)',
      }} />

      {/* Botón volver */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          zIndex: 20,
        }}
      >
        <motion.button
          onClick={() => setActiveScreen({ type: 'launcher' })}
          whileHover={{ scale: 1.1 }}
          style={{
            background: 'rgba(0,0,0,0.35)',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            fontSize: 18,
            width: 34,
            height: 30,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
          }}
          title="Volver"
        >
          ←
        </motion.button>
      </div>

      {/* Título */}
      <div
        style={{
          padding: '10px 0 4px',
          color: '#fff',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textShadow: '0 1px 8px rgba(0,0,0,0.6)',
          flexShrink: 0,
          zIndex: 2,
        }}
      >
        Advance Studio:
      </div>

      {/* Créditos scrolling */}
      <div style={{ flex: 1, width: '100%', position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column' }}>
        <ScrollingCredits credits={credits} onClickEntry={handleClick} />
      </div>
    </motion.div>
  );
}

// ── Componente de scroll automático ─────────────────────────────────────────

interface CreditEntry {
  id: string;
  name: string;
  role?: string;
  url?: string;
  linkEnabled: boolean;
}

function ScrollingCredits({
  credits,
  onClickEntry,
}: {
  credits: CreditEntry[];
  onClickEntry: (url: string, linkEnabled: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const yRef = useRef(0);
  const offsetRef = useRef(0);
  const pausedRef = useRef(false);
  const SPEED = 0.5;

  useAnimationFrame(() => {
    if (pausedRef.current) return;
    const el = containerRef.current;
    if (!el) return;

    const parent = el.parentElement;
    if (!parent) return;

    if (offsetRef.current === 0) {
      offsetRef.current = parent.clientHeight;
      yRef.current = offsetRef.current;
    }

    yRef.current -= SPEED;
    el.style.transform = `translateY(${yRef.current}px)`;
  });

  return (
    <div
      style={{
        flex: 1,
        overflow: 'hidden',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        maskImage: 'linear-gradient(transparent 0%, black 12%, black 88%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(transparent 0%, black 12%, black 88%, transparent 100%)',
      }}
    >
      <div ref={containerRef} style={{ willChange: 'transform' }}>
        {credits.map((c, i) => (
          <CreditItem
            key={c.id}
            entry={c}
            onClick={onClickEntry}
            onHover={(h) => { pausedRef.current = h; }}
          />
        ))}
      </div>
    </div>
  );
}

function CreditItem({
  entry,
  onClick,
  onHover,
}: {
  entry: CreditEntry;
  onClick: (url: string, linkEnabled: boolean) => void;
  onHover: (hovering: boolean) => void;
}) {
  const isClickable = entry.linkEnabled && !!entry.url;

  return (
    <motion.div
      onClick={() => onClick(entry.url ?? '', entry.linkEnabled)}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      whileHover={{
        textShadow: '0 0 16px rgba(255,255,180,0.9), 0 0 32px rgba(255,220,80,0.5)',
        color: '#fffde0',
        scale: 1.04,
      }}
      transition={{ duration: 0.15 }}
      style={{
        textAlign: 'center',
        padding: '10px 20px',
        cursor: isClickable ? 'pointer' : 'default',
        color: '#1a2a4a',
        userSelect: 'none',
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{entry.name}</div>
      {entry.role && (
        <div style={{ fontSize: 14, opacity: 0.75, marginTop: 2 }}>{entry.role}</div>
      )}
    </motion.div>
  );
}


