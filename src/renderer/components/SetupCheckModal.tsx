import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface ToolResult {
  name: string;
  ok: boolean;
  detail?: string;
}

export function SetupCheckModal({ onClose }: { onClose: () => void }) {
  const [results, setResults] = useState<ToolResult[]>([
    { name: 'devkitARM (compilador GBA)', ok: false },
  ]);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const api = window.advanceAPI;
        const arm = await api.system.checkDevkitARM();
        setResults([
          {
            name: 'devkitARM (compilador GBA)',
            ok: arm.found,
            detail: arm.found
              ? `Encontrado: ${arm.path}${arm.version ? ` (${arm.version})` : ''}`
              : 'No instalado. Necesitas devkitPro para compilar ROMs GBA.',
          },
        ]);
      } catch {
        setResults([
          { name: 'devkitARM (compilador GBA)', ok: false, detail: 'Error al verificar' },
        ]);
      }
      setChecking(false);
    })();
  }, []);

  const missing = results.filter(r => !r.ok);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--bg-raised)',
          borderRadius: 12, padding: 28, minWidth: 420,
          maxWidth: 520, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: 18, color: '#fff', fontWeight: 700 }}>
          {checking ? 'Verificando herramientas...' : 'Estado del entorno'}
        </h2>

        {results.map((r) => (
          <div key={r.name} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '10px 12px', marginBottom: 8,
            background: r.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
            borderRadius: 8, border: `1px solid ${r.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}>
            <span style={{ fontSize: 16, marginTop: 1 }}>
              {checking ? '⏳' : r.ok ? '✓' : '✗'}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: r.ok ? '#4ade80' : '#f87171', fontSize: 13 }}>
                {r.name}
              </div>
              {r.detail && (
                <div style={{ color: '#aaa', fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>
                  {r.detail}
                </div>
              )}
            </div>
          </div>
        ))}

        {!checking && missing.length > 0 && (
          <div style={{
            marginTop: 16, padding: 12,
            background: 'rgba(251,191,36,0.08)', borderRadius: 8,
            border: '1px solid rgba(251,191,36,0.2)',
            fontSize: 12, color: '#fbbf24', lineHeight: 1.5,
          }}>
            <strong>⚠ Algunas herramientas no están instaladas.</strong>
            <div style={{ marginTop: 6, color: '#ccc' }}>
              La exportación GBA requiere devkitPro.{' '}
              <span
                style={{ color: '#60a5fa', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => window.advanceAPI.shell.openExternal('https://devkitpro.org/wiki/Getting_Started')}
              >
                Descargar devkitPro
              </span>
            </div>
            <div style={{ marginTop: 4, color: '#888', fontSize: 11 }}>
              Después de instalar, reinicia la aplicación.
            </div>
          </div>
        )}

        {!checking && missing.length === 0 && (
          <div style={{
            marginTop: 16, padding: 12,
            background: 'rgba(34,197,94,0.08)', borderRadius: 8,
            border: '1px solid rgba(34,197,94,0.2)',
            fontSize: 12, color: '#4ade80',
          }}>
            ✓ Todo listo para exportar ROMs GBA.
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, gap: 8 }}>
          {missing.length > 0 && (
            <div style={{ fontSize: 11, color: '#888', alignSelf: 'center' }}>
              Puedes seguir editando, la exportación requerirá las herramientas faltantes.
            </div>
          )}
          <button
            onClick={onClose}
            style={{
              background: 'var(--accent)', border: 'none', borderRadius: 6,
              color: '#fff', fontSize: 13, fontWeight: 600,
              padding: '8px 20px', cursor: 'pointer',
            }}
          >
            {checking ? 'Esperando...' : 'Comenzar'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
