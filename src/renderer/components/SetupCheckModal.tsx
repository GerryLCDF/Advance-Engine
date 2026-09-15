import React, { useCallback, useEffect, useState } from 'react';
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
  const [installing, setInstalling] = useState(false);
  const [installLog, setInstallLog] = useState<string[]>([]);
  const [installError, setInstallError] = useState<string | null>(null);

  const runCheck = useCallback(async () => {
    setChecking(true);
    try {
      const api = window.advanceAPI;
      const arm = await api.system.checkDevkitARM();
      setResults([
        {
          name: 'devkitARM (compilador GBA)',
          ok: arm.found,
          detail: arm.found
            ? `Encontrado: ${arm.path}${arm.version ? ` (${arm.version})` : ''}`
            : 'No esta instalado. Necesitas devkitPro para compilar ROMs GBA.',
        },
      ]);
    } catch {
      setResults([
        { name: 'devkitARM (compilador GBA)', ok: false, detail: 'Error al verificar' },
      ]);
    }
    setChecking(false);
  }, []);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  const handleInstall = useCallback(async () => {
    if (installing) return;
    setInstalling(true);
    setInstallError(null);
    setInstallLog([]);
    const off = window.advanceAPI.system.onDevkitInstallProgress((payload) => {
      setInstallLog((prev) => [...prev, payload.line]);
    });
    try {
      const res = await window.advanceAPI.system.installDevkitPro();
      if (res.success) {
        await runCheck();
        setInstallLog((prev) => [...prev, 'devkitARM instalado correctamente.']);
      } else {
        setInstallError(res.cancelled ? 'Instalacion cancelada.' : (res.reason || 'No se pudo instalar.'));
      }
    } catch (err) {
      setInstallError(String(err));
    } finally {
      off();
      setInstalling(false);
    }
  }, [installing, runCheck]);

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
            <strong>Algunas herramientas no estan instaladas.</strong>
            <div style={{ marginTop: 6, color: '#ccc' }}>
              La exportacion GBA requiere devkitPro.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <button
                onClick={handleInstall}
                disabled={installing}
                style={{
                  background: installing ? 'var(--bg-raised)' : 'var(--accent)',
                  border: 'none', borderRadius: 6,
                  color: installing ? '#888' : '#fff', fontSize: 12, fontWeight: 600,
                  padding: '8px 16px', cursor: installing ? 'default' : 'pointer',
                }}
              >
                {installing ? 'Instalando...' : 'Instalar devkitPro'}
              </button>
              <span
                style={{ color: '#60a5fa', cursor: 'pointer', textDecoration: 'underline', fontSize: 11 }}
                onClick={() => window.advanceAPI.shell.openExternal('https://devkitpro.org/wiki/Getting_Started')}
              >
                o descargar manualmente
              </span>
            </div>
            {installing && (
              <div style={{ marginTop: 10, fontSize: 11, color: '#60a5fa' }}>
                {window.advanceAPI.platform === 'linux' ? (
                  'Puede aparecer una ventana del sistema para escribir tu contrasena (pkexec).'
                ) : (
                  'Descargando e instalando, esto puede tardar varios minutos.'
                )}
              </div>
            )}
            {installLog.length > 0 && (
              <pre style={{
                marginTop: 10, padding: 8, maxHeight: 140, overflow: 'auto',
                background: 'var(--bg-dark)', borderRadius: 6,
                color: '#a8f0a8', fontSize: 10, lineHeight: 1.4, whiteSpace: 'pre-wrap',
              }}>
                {installLog.join('\n')}
              </pre>
            )}
            {installError && (
              <div style={{ marginTop: 10, fontSize: 11, color: '#f87171', lineHeight: 1.5 }}>
                {installError}
              </div>
            )}
            <div style={{ marginTop: 8, color: '#888', fontSize: 11 }}>
              Despues de instalar, reinicia la aplicacion.
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
              Puedes seguir editando, la exportacion requerira las herramientas faltantes.
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