import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';
import type { EditorTab } from '../../types/editor';
import { SettingsModal } from './SettingsModal';

const TABS: { key: EditorTab; label: string }[] = [
  { key: 'mundo',     label: 'Mundo' },
  { key: 'scripting', label: 'Scripting' },
  { key: 'sprite',    label: 'Sprite' },
  { key: 'imagen',    label: 'Imagen' },
  { key: 'music',     label: 'Music' },
  { key: 'sound',     label: 'Sound' },
  { key: 'dialogo',   label: 'Dialogo' },
];

type MenuItemDef = { label: string; shortcut?: string; onClick?: () => void; divider?: boolean };

const MENU_ITEMS: Record<string, MenuItemDef[]> = {
  Archivos: [
    { label: 'Nuevo proyecto', onClick: () => {} },
    { label: 'Abrir' },
    { label: 'Guardar', shortcut: 'Ctrl+S' },
    { label: 'Guardar como...', divider: true },
    { label: 'Salir a la lista de proyectos', onClick: () => {} },
    { label: 'Recargar' },
    { label: 'Cerrar' },
  ],
  Editar: [
    { label: 'Deshacer', shortcut: 'Ctrl+Z' },
    { label: 'Rehacer', shortcut: 'Ctrl+Y' },
    { label: 'Cortar', shortcut: 'Ctrl+X' },
    { label: 'Copiar', shortcut: 'Ctrl+C' },
    { label: 'Pegar', shortcut: 'Ctrl+V' },
    { label: 'Eliminar', shortcut: 'Del' },
    { label: 'Seleccionar todo', shortcut: 'Ctrl+A', divider: true },
    { label: 'Settings' },
  ],
  Juego: [
    { label: 'Iniciar (Play)', onClick: () => useAppStore.getState().playEmulator() },
    { label: 'Detener (Stop)', onClick: () => useAppStore.getState().stopEmulator() },
    { label: 'Exportar ROM GBA', divider: true, onClick: () => {} },
  ],
  Plugin: [
    { label: 'Plugin Manager' },
    { label: 'Add Plugin' },
  ],
  Help: [
    { label: 'Mundo', onClick: () => {} },
    { label: 'Scripting', onClick: () => {} },
    { label: 'Sprite', onClick: () => {} },
    { label: 'Imagen', onClick: () => {} },
    { label: 'Music', onClick: () => {} },
    { label: 'Sound', onClick: () => {} },
    { label: 'Dialog', onClick: () => {}, divider: true },
    { label: 'General' },
    { label: 'Tema', divider: true },
    { label: 'Idioma' },
    { label: 'Mostrar colisiones' },
    { label: 'Mostrar conexiones' },
  ],
};

export function EditorTopBar() {
  const editorTab = useAppStore((s) => s.editorTab);
  const setEditorTab = useAppStore((s) => s.setEditorTab);
  const setActiveScreen = useAppStore((s) => s.setActiveScreen);
  const resetDraft = useAppStore((s) => s.resetDraft);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const projects = useAppStore((s) => s.projects);
  const editorProjectId = useAppStore((s) => s.editorProjectId);
  const dirty = useAppStore((s) => s.dirty);
  const setDirty = useAppStore((s) => s.setDirty);
  const win = (window as any).advanceAPI?.window;
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<string>('general');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [pendingExit, setPendingExit] = useState<(() => void) | null>(null);
  const exportLog = useAppStore((s) => s.exportLog);
  const saveProject = useAppStore((s) => s.saveProject);
  const exportGBA = useAppStore((s) => s.exportGBA);
  const projectDir = useAppStore((s) => s.projectDir);
  const currentProject = projects.find((p) => p.id === editorProjectId);

  const openProjectFolder = async () => {
    if (projectDir) {
      const api = (window as any).advanceAPI;
      await api?.shell?.openPath(projectDir);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 's') { e.preventDefault(); useAppStore.getState().saveProject(); return; }
      if (ctrl && e.key === 'z') { e.preventDefault(); useAppStore.getState().undo(); return; }
      if (ctrl && e.key === 'y') { e.preventDefault(); useAppStore.getState().redo(); return; }
      if (ctrl && e.key === 'x') { e.preventDefault(); /* cortar */ return; }
      if (ctrl && e.key === 'c') { e.preventDefault(); /* copiar */ return; }
      if (ctrl && e.key === 'v') { e.preventDefault(); /* pegar */ return; }
      if (ctrl && e.key === 'a') { e.preventDefault(); /* seleccionar todo */ return; }
      if (e.key === 'Delete' || e.key === 'Del') { e.preventDefault(); /* eliminar */ return; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Auto-detect unsaved changes
  useEffect(() => {
    const watchKeys = ['scenes', 'spriteSheets', 'backgrounds', 'songs', 'dialogues', 'sounds', 'scripts', 'sceneConnections'] as const;
    let prev = watchKeys.map(k => JSON.stringify(useAppStore.getState()[k as keyof typeof useAppStore.getState]));
    const unsub = useAppStore.subscribe((state) => {
      const curr = watchKeys.map(k => JSON.stringify((state as any)[k]));
      if (curr.some((v, i) => v !== prev[i])) {
        if (!state.dirty) state.setDirty(true);
        prev = curr;
      }
    });
    return unsub;
  }, [editorProjectId]);

  const handleAction = (action: string) => {
    setOpenMenu(null);

    const confirmExit = (cb: () => void) => {
      if (!dirty) { cb(); return; }
      setPendingExit(() => cb);
    };

    switch (action) {
      case 'Guardar':
        useAppStore.getState().saveProject();
        break;
      case 'Deshacer':
        useAppStore.getState().undo();
        break;
      case 'Rehacer':
        useAppStore.getState().redo();
        break;
      case 'Nuevo proyecto':
        resetDraft();
        setActiveTab('crear');
        win?.restore();
        setActiveScreen({ type: 'launcher' });
        break;
      case 'Cerrar':
      case 'Salir a la lista de proyectos':
        confirmExit(() => {
          win?.restore();
          setActiveScreen({ type: 'launcher' });
        });
        break;
      case 'Mundo': setEditorTab('mundo'); setSettingsInitialTab('mundo'); setShowSettingsModal(true); break;
      case 'Scripting': setEditorTab('scripting'); setSettingsInitialTab('scripting'); setShowSettingsModal(true); break;
      case 'Sprite': setEditorTab('sprite'); setSettingsInitialTab('sprite'); setShowSettingsModal(true); break;
      case 'Imagen': setEditorTab('imagen'); setSettingsInitialTab('imagen'); setShowSettingsModal(true); break;
      case 'Music': setEditorTab('music'); setSettingsInitialTab('music'); setShowSettingsModal(true); break;
      case 'Sound': setEditorTab('sound'); setSettingsInitialTab('sound'); setShowSettingsModal(true); break;
      case 'Dialog': setEditorTab('dialogo'); setSettingsInitialTab('dialogo'); setShowSettingsModal(true); break;
      case 'General': setSettingsInitialTab('general'); setShowSettingsModal(true); break;
      case 'Tema': setSettingsInitialTab('general'); setShowSettingsModal(true); break;
    }
  };

  return (
    <>
    <div
      style={{
        background: 'var(--bg-panel)',
        borderBottom: '1px solid var(--border-color)',
        flexShrink: 0,
        userSelect: 'none',
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
    >
      {/* Row 1: Menus + Window controls */}
      <div style={{ display: 'flex', alignItems: 'center', height: 32 }}>
        <div style={{ display: 'flex', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {Object.keys(MENU_ITEMS).map((m) => (
            <div key={m} style={{ position: 'relative' }}>
              <button
                onClick={() => setOpenMenu(openMenu === m ? null : m)}
                onMouseEnter={() => openMenu && setOpenMenu(m)}
                style={{
                  background: openMenu === m ? 'var(--bg-raised)' : 'transparent',
                  border: 'none',
                  color: openMenu === m ? '#fff' : '#bbb',
                  fontSize: 12,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  height: 32,
                  fontWeight: 500,
                }}
              >
                {m}
              </button>
              {openMenu === m && (
                <div
                  style={{
                    position: 'absolute', top: '100%', left: 0,
                    background: 'var(--bg-panel)', border: '1px solid var(--bg-raised)',
                    borderRadius: '0 0 6px 6px', minWidth: 180,
                    zIndex: 200, padding: 4,
                  }}
                  onMouseEnter={() => setOpenMenu(m)}
                  onMouseLeave={() => setOpenMenu(null)}
                >
                  {MENU_ITEMS[m].map((item, i) => (
                    <MenuItem
                      key={i}
                      label={item.label}
                      shortcut={item.shortcut}
                      divider={item.divider}
                      onClick={() => {
                        if (item.onClick) item.onClick();
                        handleAction(item.label);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Project title */}
        <div style={{
          flex: 1, textAlign: 'center', fontSize: 12, color: '#888',
          fontWeight: 500, letterSpacing: 0.3, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 8px',
          WebkitAppRegion: 'drag',
        } as React.CSSProperties}>
          {currentProject?.name ?? ''}{dirty ? ' *' : ''}
        </div>

        {/* Window controls */}
        <div style={{ display: 'flex', gap: 2, paddingRight: 6, WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <WinBtn label="─" onClick={() => win?.minimize()} />
          <WinBtn label="□" onClick={() => win?.maximize()} />
          <WinBtn label="✕" onClick={() => win?.close()} danger />
        </div>
      </div>

      {/* Row 2: Tabs (centered) + EXPORT / PLAY */}
      <div style={{
        display: 'flex', alignItems: 'center', height: 30,
        borderTop: '1px solid var(--border-color)',
        position: 'relative',
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}>
        {/* Spacer left so EXPORT/PLAY stays right */}
        <div style={{ flex: 1 }} />

        {/* Tabs absolutely centered */}
        <div style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 1, height: 30, alignItems: 'flex-end',
        }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setEditorTab(t.key)}
              style={{
                background: editorTab === t.key ? 'var(--bg-canvas)' : 'transparent',
                border: 'none',
                borderRadius: '4px 4px 0 0',
                color: editorTab === t.key ? 'var(--accent-lighter)' : 'var(--text-muted)',
                fontSize: 12,
                fontWeight: editorTab === t.key ? 700 : 500,
                padding: '4px 14px',
                cursor: 'pointer',
                height: 28,
                borderTop: editorTab === t.key ? '2px solid var(--accent-light)' : '2px solid transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Spacer right */}
        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', alignItems: 'center', paddingRight: 8 }}>
          <motion.button
            whileHover={{ scale: 1.04 }}
            style={{
              background: 'transparent',
              border: '1px solid var(--yellow)',
              borderRadius: 4,
              color: 'var(--yellow)',
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 12px',
              cursor: 'pointer',
              marginRight: 6,
            }}
          >
            IMPORTAR
          </motion.button>
          <div style={{ position: 'relative', marginRight: 6 }}>
            <motion.button
              whileHover={{ scale: 1.04 }}
              onClick={() => setShowExportMenu(!showExportMenu)}
              style={{
                background: showExportMenu ? 'var(--orange)' : 'transparent',
                border: '1px solid var(--orange)',
                borderRadius: 4,
                color: showExportMenu ? '#000' : 'var(--orange)',
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 12px',
                cursor: 'pointer',
              }}
            >
              EXPORT
            </motion.button>
            {showExportMenu && (
              <div
                style={{
                  position: 'absolute', top: 24, right: 0,
                  background: 'var(--bg-panel)', border: '1px solid var(--bg-raised)',
                  borderRadius: 6, minWidth: 200, zIndex: 200, padding: 4,
                }}
                onMouseLeave={() => setShowExportMenu(false)}
              >
                <ExportMenuItem label="Guardar proyecto" onClick={async () => { setShowExportMenu(false); await saveProject(); }} />
                <ExportMenuItem label="Exportar ROM GBA" onClick={async () => { setShowExportMenu(false); await saveProject(); await exportGBA(); openProjectFolder(); }} />
                <ExportMenuItem label="Exportar canciones" divider />
                <ExportMenuItem label="Exportar sprites" />
                <ExportMenuItem label="Exportar fondos" />
                <ExportMenuItem label="Exportar scripts" divider />
                <ExportMenuItem label="Abrir carpeta del proyecto" onClick={() => { setShowExportMenu(false); openProjectFolder(); }} />
              </div>
            )}
          </div>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => useAppStore.getState().playEmulator()}
            style={{
              background: 'rgba(80,200,80,0.15)',
              border: '1px solid var(--green)',
              borderRadius: 4,
              color: 'var(--green)',
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 12px',
              cursor: 'pointer',
              marginRight: 4,
            }}
          >
            ▶ PLAY
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => useAppStore.getState().stopEmulator()}
            style={{
              background: 'rgba(200,80,80,0.15)',
              border: '1px solid var(--red)',
              borderRadius: 4,
              color: 'var(--red)',
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 12px',
              cursor: 'pointer',
            }}
          >
            ■ STOP
          </motion.button>
        </div>
      </div>
    </div>
      {showSettingsModal && <SettingsModal onClose={() => setShowSettingsModal(false)} initialTab={settingsInitialTab} />}
      {pendingExit && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onClick={() => setPendingExit(null)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            borderRadius: 10, padding: 24, minWidth: 300,
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>Cambios sin guardar</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>¿Qué deseas hacer?</span>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setPendingExit(null)}
                style={{ background: 'var(--bg-raised)', border: 'none', borderRadius: 6, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, padding: '7px 16px', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={() => { const cb = pendingExit; setPendingExit(null); cb(); }}
                style={{ background: 'var(--bg-raised)', border: 'none', borderRadius: 6, color: 'var(--red)', fontSize: 12, fontWeight: 600, padding: '7px 16px', cursor: 'pointer' }}>
                Salir sin guardar
              </button>
              <button onClick={() => { const cb = pendingExit; setPendingExit(null); useAppStore.getState().saveProject().finally(() => cb()); }}
                style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 600, padding: '7px 16px', cursor: 'pointer' }}>
                Guardar y salir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MenuItem({ label, shortcut, divider, onClick }: MenuItemDef & { onClick?: () => void }) {
  return (
    <>
      <div
        onClick={onClick}
        style={{
          padding: '5px 12px',
          color: 'var(--text-secondary)',
          fontSize: 12,
          cursor: 'pointer',
          borderRadius: 4,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-raised)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <span>{label}</span>
        {shortcut && <span style={{ color: '#666', fontSize: 10, marginLeft: 'auto' }}>{shortcut}</span>}
      </div>
      {divider && <div style={{ height: 1, background: 'var(--bg-raised)', margin: '4px 8px' }} />}
    </>
  );
}

function ExportMenuItem({ label, onClick, divider }: { label: string; onClick?: () => void; divider?: boolean }) {
  return (
    <>
      <div
        onClick={onClick}
        style={{
          padding: '5px 12px', color: 'var(--text-secondary)', fontSize: 11,
          cursor: onClick ? 'pointer' : 'default', borderRadius: 4,
        }}
        onMouseEnter={(e) => { if (onClick) e.currentTarget.style.background = 'var(--bg-raised)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        {label}
      </div>
      {divider && <div style={{ height: 1, background: 'var(--bg-raised)', margin: '4px 8px' }} />}
    </>
  );
}

function WinBtn({ label, onClick, danger }: { label: string; onClick?: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: danger ? 'rgba(180,30,30,0.7)' : 'rgba(255,255,255,0.06)',
        border: 'none',
        borderRadius: 3,
        color: '#aaa',
        fontSize: 10,
        width: 22,
        height: 18,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
      }}
    >
      {label}
    </button>
  );
}
