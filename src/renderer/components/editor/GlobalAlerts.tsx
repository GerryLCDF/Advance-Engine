import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';
import { TriangleAlertIcon, XIcon } from './tabs/icons';

/**
 * Avisos de error globales.
 *
 * Antes el log de exportación solo se pintaba en MundoTab, así que un fallo del
 * emulador (o de la compilación) podía Arobarse sin que nadie lo viera desde
 * otra pestaña. Aquí sale un aviso en cualquier pestaña, y el log completo sigue
 * donde estaba (MundoTab), para consultarlo entero.
 */
const DURACION_MS = 7000;

export function GlobalAlerts() {
  const exportLog = useAppStore((s) => s.exportLog);

  const [avisos, setAvisos] = useState<number[]>([]);
  // Índices ya mostrados, para no volver a sacar el mismo error.
  const vistosRef = useRef<Set<number>>(new Set());
  const vistoMaxRef = useRef(-1);

  useEffect(() => {
    // Al cargar el store puede venir log de antes (proyecto recién abierto):
    // se marca como visto para no saltar avisos de cosas ya pasadas.
    if (vistoMaxRef.current === -1 && exportLog.length > 0) {
      vistoMaxRef.current = exportLog.length - 1;
    }

    const nuevos: number[] = [];
    for (let i = Math.max(0, vistoMaxRef.current + 1); i < exportLog.length; i++) {
      if (exportLog[i].startsWith('[ERROR]') && !vistosRef.current.has(i)) {
        vistosRef.current.add(i);
        nuevos.push(i);
      }
    }
    if (nuevos.length === 0) return;

    vistoMaxRef.current = exportLog.length - 1;
    setAvisos((prev) => [...prev, ...nuevos]);

    const timers = nuevos.map((idx) =>
      setTimeout(() => setAvisos((prev) => prev.filter((i) => i !== idx)), DURACION_MS)
    );
    return () => timers.forEach(clearTimeout);
  }, [exportLog]);

  const cerrar = (idx: number) => setAvisos((prev) => prev.filter((i) => i !== idx));

  if (avisos.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 18,
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 300,
        pointerEvents: 'none',
        maxWidth: 560,
      }}
    >
      <AnimatePresence>
        {avisos.map((idx) => (
          <motion.div
            key={idx}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 8,
              background: 'var(--bg-panel)',
              border: '1px solid #7f1d1d',
              boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
              color: 'var(--text)',
            }}
          >
            <TriangleAlertIcon size={16} style={{ color: '#f87171', flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12, lineHeight: 1.45, wordBreak: 'break-word' }}>
              {exportLog[idx].replace(/^\[ERROR\]\s*/, '')}
            </div>
            <button
              onClick={() => cerrar(idx)}
              title="Cerrar"
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <XIcon size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}