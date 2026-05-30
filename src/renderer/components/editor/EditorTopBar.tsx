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
    { label: 'Guardar' },
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
    { label: 'Iniciar' },
    { label: 'Exportar como' },
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
  const win = (window as any).advanceAPI?.window;
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<string>('general');

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
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

  const handleAction = (action: string) => {
    setOpenMenu(null);
    switch (action) {
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
        win?.restore();
        setActiveScreen({ type: 'launcher' });
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
                    position: 'absolute', top: 32, left: 0,
                    background: 'var(--bg-panel)', border: '1px solid var(--bg-raised)',
                    borderRadius: '0 0 6px 6px', minWidth: 180,
                    zIndex: 200, padding: 4,
                  }}
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

        <div style={{ flex: 1 }} />

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
          <motion.button
            whileHover={{ scale: 1.04 }}
            style={{
              background: 'transparent',
              border: '1px solid var(--orange)',
              borderRadius: 4,
              color: 'var(--orange)',
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 12px',
              cursor: 'pointer',
              marginRight: 6,
            }}
          >
            EXPORT
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.04 }}
            style={{
              background: 'transparent',
              border: '1px solid var(--green)',
              borderRadius: 4,
              color: 'var(--green)',
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 12px',
              cursor: 'pointer',
            }}
          >
            PLAY
          </motion.button>
        </div>
      </div>
    </div>
      {showSettingsModal && <SettingsModal onClose={() => setShowSettingsModal(false)} initialTab={settingsInitialTab} />}
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
