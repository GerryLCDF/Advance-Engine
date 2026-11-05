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
const MAX_VISIBLES = 3;

export function GlobalAlerts() {
  const exportLog = useAppStore((s) => s.exportLog);
  const toasts = useAppStore((s) => s.toasts);
  const dismissToast = useAppStore((s) => s.dismissToast);

  // El aviso guarda su texto, no el índice: si el log se vacía a mitad de la
  // animación, un índice se quedaría apuntando a otra línea (o a ninguna).
  const [avisos, setAvisos] = useState<{ id: number; msg: string }[]>([]);
  const idSeq = useRef(0);
  // Índices ya mostrados, para no volver a sacar el mismo error.
  const vistosRef = useRef<Set<number>>(new Set());
  const vistoMaxRef = useRef(-1);

useEffect(() => {
    // El log se vacía al empezar cada exportación o Play (beginExportRun), así
    // que los índices se reinician. Si el log se ha encogido, es que hubo un
    // vaciado: hay que olvidar el rastreo o los errores siguientes pasarían
    // desapercibidos por estar en índices "ya vistos".
    if (exportLog.length < vistoMaxRef.current) {
      vistosRef.current = new Set();
      vistoMaxRef.current = -1;
    }

    // Al montar puede venir log de antes (proyecto recién abierto): se marca
    // como visto para no saltar avisos de cosas ya pasadas.
    if (vistoMaxRef.current === -1 && exportLog.length > 0) {
      vistoMaxRef.current = exportLog.length - 1;
    }

    const nuevos: { id: number; msg: string }[] = [];
    for (let i = Math.max(0, vistoMaxRef.current + 1); i < exportLog.length; i++) {
      // Tolera el prefijo [INFO] delante: los errores que se emiten con
      // `add('[ERROR] …')` (no con `error()`) salían como "[INFO] [ERROR] …" y
      // con startsWith no avisaban nunca.
      const m = /^\s*(?:\[INFO\]\s*)?\[ERROR\]\s*(.+)$/.exec(exportLog[i]);
      if (m && !vistosRef.current.has(i)) {
        vistosRef.current.add(i);
        nuevos.push({ id: idSeq.current++, msg: m[1] });
      }
    }
    if (nuevos.length === 0) return;

    vistoMaxRef.current = exportLog.length - 1;
    // Una exportación fallida puede escupir decenas de errores (p.ej. un script
    // de AdvanceCode con 20 fallos). Apilar 20 toasts tapa la pantalla: se
    // enseñan los primeros y el resto sigue íntegro en la terminal.
    setAvisos((prev) => [...prev, ...nuevos].slice(-MAX_VISIBLES));

    const timers = nuevos.map((n) =>
      setTimeout(() => setAvisos((prev) => prev.filter((a) => a.id !== n.id)), DURACION_MS)
    );
    return () => timers.forEach(clearTimeout);
  }, [exportLog]);

  const cerrar = (id: number) => setAvisos((prev) => prev.filter((a) => a.id !== id));

  if (avisos.length === 0 && toasts.length === 0) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
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
        {avisos.map((aviso) => (
          <motion.div
            key={aviso.id}
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
              {aviso.msg}
            </div>
            <button
              onClick={() => cerrar(aviso.id)}
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
        {toasts.map((t) => (
          <motion.div
            key={t.id}
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
              border: '1px solid var(--border-color)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
              color: 'var(--text)',
            }}
          >
            <TriangleAlertIcon size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12, lineHeight: 1.45, wordBreak: 'break-word' }}>
              {t.msg}
            </div>
            <button
              onClick={() => dismissToast(t.id)}
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