import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { EditorTab } from '../../types/editor';

interface Props {
  onClose: () => void;
  initialTab?: string;
}

type SettingsTab = 'mundo' | 'scripting' | 'sprite' | 'imagen' | 'music' | 'sound' | 'dialogo' | 'general';
type GeneralSection = 'theme' | 'idioma' | 'general';

const EDITOR_TAB_OPTIONS: { key: EditorTab; label: string }[] = [
  { key: 'mundo', label: 'Mundo' },
  { key: 'scripting', label: 'Scripting' },
  { key: 'sprite', label: 'Sprite' },
  { key: 'imagen', label: 'Imagen' },
  { key: 'music', label: 'Music' },
  { key: 'sound', label: 'Sound' },
  { key: 'dialogo', label: 'Dialogo' },
];

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'mundo', label: 'Mundo' },
  { key: 'scripting', label: 'Scripting' },
  { key: 'sprite', label: 'Sprite' },
  { key: 'imagen', label: 'Imagen' },
  { key: 'music', label: 'Music' },
  { key: 'sound', label: 'Sound' },
  { key: 'dialogo', label: 'Dialogo' },
  { key: 'general', label: 'General' },
];

const SIDEBAR_ITEMS: { key: GeneralSection; label: string; icon: string }[] = [
  { key: 'general', label: 'General', icon: '⚙' },
  { key: 'theme', label: 'Apariencia', icon: '🎨' },
  { key: 'idioma', label: 'Idioma', icon: '🌐' },
];

const THEME_PRESETS: { name: string; bgPanel: string; accent: string }[] = [
  { name: 'Advance Studio', bgPanel: '#2d2d33', accent: '#5a3fa0' },
  { name: 'GBStudio',       bgPanel: '#222222', accent: '#c92c61' },
  { name: 'Godot',          bgPanel: '#3d3d48', accent: '#478cbf' },
  { name: 'Unity',          bgPanel: '#38383d', accent: '#2196F3' },
  { name: 'White',          bgPanel: '#ececec', accent: '#7c3aed' },
  { name: 'Green',          bgPanel: '#1a2e1a', accent: '#4caf50' },
  { name: 'Gray',           bgPanel: '#2a2a2a', accent: '#888888' },
];

export function SettingsModal({ onClose, initialTab }: Props) {
  const setEditorTab = useAppStore((s) => s.setEditorTab);
  const storeBg = useAppStore((s) => s.themeBgPanel);
  const storeAccent = useAppStore((s) => s.themeAccent);
  const storeFontSize = useAppStore((s) => s.fontSize);
  const setTheme = useAppStore((s) => s.setTheme);
  const setFontSize = useAppStore((s) => s.setFontSize);
  const defaultEditorTab = useAppStore((s) => s.defaultEditorTab);
  const setDefaultEditorTab = useAppStore((s) => s.setDefaultEditorTab);
  const pianoRollBg = useAppStore((s) => s.pianoRollBg);
  const setPianoRollBg = useAppStore((s) => s.setPianoRollBg);
  const defaultMusicView = useAppStore((s) => s.defaultMusicView);
  const setDefaultMusicView = useAppStore((s) => s.setDefaultMusicView);
  const keyWhiteColor = useAppStore((s) => s.keyWhiteColor);
  const keyBlackColor = useAppStore((s) => s.keyBlackColor);
  const setKeyColors = useAppStore((s) => s.setKeyColors);
  const chunkCols = useAppStore((s) => s.chunkCols);
  const setChunkCols = useAppStore((s) => s.setChunkCols);
  const chunkRows = useAppStore((s) => s.chunkRows);
  const setChunkRows = useAppStore((s) => s.setChunkRows);
  const showGrid = useAppStore((s) => s.showGrid);
  const setShowGrid = useAppStore((s) => s.setShowGrid);
  const gridLineOpacity = useAppStore((s) => s.gridLineOpacity);
  const setGridLineOpacity = useAppStore((s) => s.setGridLineOpacity);
  const imageSmoothing = useAppStore((s) => s.imageSmoothing);
  const setImageSmoothing = useAppStore((s) => s.setImageSmoothing);
  const setMundoShowGrid = useAppStore((s) => s.setMundoShowGrid);
  const setMundoGridSize = useAppStore((s) => s.setMundoGridSize);
  const setMundoGridOpacity = useAppStore((s) => s.setMundoGridOpacity);

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab === 'general' ? 'general' : (initialTab as SettingsTab) || 'general');
  const [activeSection, setActiveSection] = useState<GeneralSection>('theme');
  const [localPianoRollBg, setLocalPianoRollBg] = useState<'lines' | 'checkerboard'>(pianoRollBg);
  const [localDefaultView, setLocalDefaultView] = useState<'tracker' | 'piano'>(defaultMusicView);
  const [localKeyWhite, setLocalKeyWhite] = useState(keyWhiteColor);
  const [localKeyBlack, setLocalKeyBlack] = useState(keyBlackColor);
  const [localChunkCols, setLocalChunkCols] = useState(chunkCols);
  const [localChunkRows, setLocalChunkRows] = useState(chunkRows);
  const [localShowGrid, setLocalShowGrid] = useState(showGrid);
  const [localGridLineOpacity, setLocalGridLineOpacity] = useState(gridLineOpacity);
  const [localImageSmoothing, setLocalImageSmoothing] = useState(imageSmoothing);
  const [localMundoShowGrid, setLocalMundoShowGrid] = useState(false);
  const [localMundoGridSize, setLocalMundoGridSize] = useState(16);
  const [localMundoGridOpacity, setLocalMundoGridOpacity] = useState(0.15);

  // Initialize local Mundo grid settings from store
  useEffect(() => {
    setLocalMundoShowGrid(useAppStore.getState().mundoShowGrid);
    setLocalMundoGridSize(useAppStore.getState().mundoGridSize);
    setLocalMundoGridOpacity(useAppStore.getState().mundoGridOpacity);
  }, []);

  const snapshot = useRef({ bg: storeBg, accent: storeAccent, fontSize: storeFontSize });

  function handleTabClick(key: SettingsTab) {
    if (key !== 'general') {
      setEditorTab(key as any);
      setActiveTab(key);
    } else {
      setActiveTab('general');
    }
  }

  function presetName(): string {
    const match = THEME_PRESETS.find(
      (p) => p.bgPanel === storeBg.toLowerCase() && p.accent === storeAccent.toLowerCase()
    );
    return match ? match.name : 'Custom';
  }

  function handleBgChange(val: string) { setTheme(val, storeAccent); }
  function handleAccentChange(val: string) { setTheme(storeBg, val); }
  function pickPreset(p: typeof THEME_PRESETS[0]) { setTheme(p.bgPanel, p.accent); }

  function restoreDefaults() {
    setTheme('#2d2d33', '#5a3fa0');
    setFontSize(13);
  }

  function cancel() {
    setTheme(snapshot.current.bg, snapshot.current.accent);
    setFontSize(snapshot.current.fontSize);
    onClose();
  }

  function applyTheme() {
    onClose();
  }

  function applyIdioma() {
    onClose();
  }

  function applyGeneral() {
    setImageSmoothing(localImageSmoothing);
    applyMundo();
  }

  function apply() {
    switch (activeSection) {
      case 'theme':
        applyTheme();
        break;
      case 'idioma':
        applyIdioma();
        break;
      case 'general':
        applyGeneral();
        break;
      case 'mundo':
        applyMundo();
        break;
    }
  }

  function applyMusic() {
    setPianoRollBg(localPianoRollBg);
    setDefaultMusicView(localDefaultView);
    setKeyColors(localKeyWhite, localKeyBlack);
    setChunkCols(localChunkCols);
    setChunkRows(localChunkRows);
    setShowGrid(localShowGrid);
    setGridLineOpacity(localGridLineOpacity);
    onClose();
  }

  function applyMundo() {
    setMundoShowGrid(localMundoShowGrid);
    setMundoGridSize(localMundoGridSize);
    setMundoGridOpacity(localMundoGridOpacity);
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
          width: 580,
          height: 420,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 1, padding: '8px 12px 0',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
        }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => handleTabClick(t.key)}
              style={{
                background: activeTab === t.key ? 'var(--bg-canvas)' : 'transparent',
                border: 'none',
                borderRadius: '6px 6px 0 0',
                color: activeTab === t.key ? 'var(--accent-lighter)' : 'var(--text-muted)',
                fontSize: 11,
                fontWeight: activeTab === t.key ? 700 : 500,
                padding: '5px 14px',
                cursor: 'pointer',
                borderTop: activeTab === t.key ? '2px solid var(--accent-light)' : '2px solid transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {activeTab === 'general' ? (
            <>
              {/* Left sidebar */}
              <div style={{
                width: 140, flexShrink: 0,
                borderRight: '1px solid var(--border-color)',
                padding: '8px 0',
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                {SIDEBAR_ITEMS.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setActiveSection(item.key)}
                    style={{
                      background: activeSection === item.key ? 'var(--bg-raised)' : 'transparent',
                      border: 'none', borderRadius: 0,
                      color: activeSection === item.key ? '#fff' : 'var(--text-secondary)',
                      fontSize: 12, fontWeight: activeSection === item.key ? 600 : 400,
                      padding: '7px 16px', cursor: 'pointer', textAlign: 'left',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Content area */}
              <div style={{ flex: 1, padding: 20, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {activeSection === 'theme' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text)', fontSize: 14, fontWeight: 700 }}>
                        Apariencia
                        <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 11, marginLeft: 8 }}>
                          ({presetName()})
                        </span>
                      </span>
                    </div>

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
                            }}
                          >
                            {p.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ color: 'var(--text-muted)', fontSize: 11 }}>Fondo paneles</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="color" value={storeBg} onChange={(e) => handleBgChange(e.target.value)}
                          style={{ width: 40, height: 32, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'transparent' }} />
                        <input value={storeBg} onChange={(e) => handleBgChange(e.target.value)}
                          style={{ flex: 1, background: 'var(--bg-dark)', border: '1px solid var(--bg-raised)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '5px 8px', outline: 'none', fontFamily: 'monospace' }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ color: 'var(--text-muted)', fontSize: 11 }}>Acento</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="color" value={storeAccent} onChange={(e) => handleAccentChange(e.target.value)}
                          style={{ width: 40, height: 32, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'transparent' }} />
                        <input value={storeAccent} onChange={(e) => handleAccentChange(e.target.value)}
                          style={{ flex: 1, background: 'var(--bg-dark)', border: '1px solid var(--bg-raised)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '5px 8px', outline: 'none', fontFamily: 'monospace' }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <label style={{ color: 'var(--text-muted)', fontSize: 11 }}>Tamaño de texto</label>
                        <span style={{ color: 'var(--text)', fontSize: 11, fontFamily: 'monospace' }}>{storeFontSize}px</span>
                      </div>
                      <input type="range" min={10} max={20} step={1} value={storeFontSize}
                        onChange={(e) => setFontSize(Number(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
                      <button onClick={restoreDefaults}
                        style={{ background: 'var(--bg-raised)', border: 'none', borderRadius: 6, color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600, padding: '6px 16px', cursor: 'pointer' }}>
                        Restaurar predeterminado
                      </button>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={cancel}
                          style={{ background: 'var(--bg-raised)', border: 'none', borderRadius: 6, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, padding: '7px 20px', cursor: 'pointer' }}>
                          Cancelar
                        </button>
                        <button onClick={apply}
                          style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 600, padding: '7px 20px', cursor: 'pointer' }}>
                          Aplicar
                        </button>
                      </div>
                    </div>
                  </>
                )}

                  {activeSection === 'general' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <span style={{ color: 'var(--text)', fontSize: 14, fontWeight: 700 }}>General</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ color: 'var(--text-muted)', fontSize: 11 }}>Pestaña al iniciar motor</label>
                      <select
                        value={defaultEditorTab}
                        onChange={(e) => setDefaultEditorTab(e.target.value as EditorTab)}
                        style={{
                          background: 'var(--bg-dark)', border: '1px solid var(--bg-raised)',
                          borderRadius: 6, color: 'var(--text)', fontSize: 12,
                          padding: '6px 10px', cursor: 'pointer', width: 180,
                        }}
                      >
                        {EDITOR_TAB_OPTIONS.map((opt) => (
                          <option key={opt.key} value={opt.key}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ color: 'var(--text-muted)', fontSize: 11 }}>Suavizar imágenes</label>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', height: 28 }}>
                        <button
                          onClick={() => setLocalImageSmoothing(!localImageSmoothing)}
                          style={{
                            width: 44, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', position: 'relative',
                            background: localImageSmoothing ? 'var(--accent)' : 'var(--bg-raised)', transition: 'background 0.15s',
                          }}
                        >
                          <div style={{
                            position: 'absolute', top: 2, width: 18, height: 18, borderRadius: '50%',
                            background: '#fff', transition: 'left 0.15s',
                            left: localImageSmoothing ? 24 : 2,
                          }} />
                        </button>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>{localImageSmoothing ? 'Sí' : 'No'}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ color: 'var(--text-muted)', fontSize: 11 }}>Mostrar cuadrícula</label>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', height: 28 }}>
                        <button
                          onClick={() => setLocalMundoShowGrid(!localMundoShowGrid)}
                          style={{
                            width: 44, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', position: 'relative',
                            background: localMundoShowGrid ? 'var(--accent)' : 'var(--bg-raised)', transition: 'background 0.15s',
                          }}
                        >
                          <div style={{
                            position: 'absolute', top: 2, width: 18, height: 18, borderRadius: '50%',
                            background: '#fff', transition: 'left 0.15s',
                            left: localMundoShowGrid ? 24 : 2,
                          }} />
                        </button>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>{localMundoShowGrid ? 'Sí' : 'No'}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ color: 'var(--text-muted)', fontSize: 11 }}>Tamaño de celda</label>
                      <input
                        type="number"
                        value={localMundoGridSize}
                        onChange={(e) => setLocalMundoGridSize(parseInt(e.target.value) || 1)}
                        min={1}
                        max={64}
                        style={{
                          width: 60, height: 24, borderRadius: 4, border: '1px solid var(--border-color)',
                          background: 'var(--bg-dark)', color: 'var(--text)', padding: '0 6px',
                          fontSize: 12, textAlign: 'center',
                        }}
                      />
                      <span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>píxeles</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ color: 'var(--text-muted)', fontSize: 11 }}>Opacidad de líneas</label>
                      <input
                        type="range"
                        value={localMundoGridOpacity}
                        onChange={(e) => setLocalMundoGridOpacity(parseFloat(e.target.value))}
                        min={0}
                        max={1}
                        step={0.01}
                        style={{ width: '100%' }}
                      />
                      <span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>
                        {Math.round(localMundoGridOpacity * 100)}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                      <button onClick={cancel}
                        style={{ background: 'var(--bg-raised)', border: 'none', borderRadius: 6, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, padding: '7px 20px', cursor: 'pointer' }}>
                        Cancelar
                      </button>
                      <button onClick={apply}
                        style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 600, padding: '7px 20px', cursor: 'pointer' }}>
                        Aplicar
                      </button>
                    </div>
                  </div>
                )}

                {activeSection === 'idioma' && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                    <p>Opciones de idioma próximamente.</p>
                  </div>
                )}
              </div>
            </>
          ) : activeTab === 'music' ? (
            <div style={{ flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <span style={{ color: 'var(--text)', fontSize: 14, fontWeight: 700 }}>Music</span>
              <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: 11 }}>Tipo de fondo para el piano roll</label>
                  <select
                    value={localPianoRollBg}
                    onChange={(e) => setLocalPianoRollBg(e.target.value as 'lines' | 'checkerboard')}
                    style={{
                      background: 'var(--bg-dark)', border: '1px solid var(--bg-raised)',
                      borderRadius: 6, color: 'var(--text)', fontSize: 12,
                      padding: '6px 10px', cursor: 'pointer', width: 160,
                    }}
                  >
                    <option value="lines">Cuadrícula</option>
                    <option value="checkerboard">Ajedrez</option>
                  </select>
                </div>
                {/* Preview */}
                <div style={{
                  width: 120, height: 80,
                  borderRadius: 6, overflow: 'hidden',
                  border: '1px solid var(--border-color)',
                  position: 'relative',
                  background: localPianoRollBg === 'checkerboard'
                    ? 'repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.06) 75%, rgba(255,255,255,0.06)), repeating-linear-gradient(-45deg, rgba(255,255,255,0.06) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.06) 75%, rgba(255,255,255,0.06))'
                    : 'repeating-linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px, transparent 12px), repeating-linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px, transparent 12px)',
                  backgroundSize: localPianoRollBg === 'checkerboard' ? '16px 16px, 16px 16px' : '12px 12px, 12px 12px',
                  backgroundPosition: localPianoRollBg === 'checkerboard' ? '0 0, 0 8px, 8px -8px, -8px 0' : '0 0, 0 0',
                }}>
                  {/* Mini piano keys preview */}
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0, width: 16,
                    background: '#1a1a20', borderRight: '1px solid #333',
                  }}>
                    <div style={{ height: 10, background: localKeyWhite, borderBottom: '1px solid #ccc' }} />
                    <div style={{ height: 10, background: localKeyWhite, borderBottom: '1px solid #ccc' }} />
                    <div style={{ height: 10, background: localKeyBlack, width: 8, marginLeft: 8, borderBottom: '1px solid #111' }} />
                    <div style={{ height: 10, background: localKeyWhite, borderBottom: '1px solid #ccc' }} />
                    <div style={{ height: 10, background: localKeyWhite, borderBottom: '1px solid #ccc' }} />
                    <div style={{ height: 10, background: localKeyBlack, width: 8, marginLeft: 8, borderBottom: '1px solid #111' }} />
                    <div style={{ height: 10, background: localKeyWhite, borderBottom: '1px solid #ccc' }} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ color: 'var(--text-muted)', fontSize: 11 }}>Vista predeterminada</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => setLocalDefaultView('tracker')}
                    style={{
                      background: localDefaultView === 'tracker' ? 'var(--accent)' : 'var(--bg-raised)',
                      border: 'none', borderRadius: 6,
                      color: localDefaultView === 'tracker' ? '#fff' : 'var(--text-secondary)',
                      fontSize: 11, fontWeight: 600, padding: '5px 14px', cursor: 'pointer',
                    }}
                  >Tracker</button>
                  <button
                    onClick={() => setLocalDefaultView('piano')}
                    style={{
                      background: localDefaultView === 'piano' ? 'var(--accent)' : 'var(--bg-raised)',
                      border: 'none', borderRadius: 6,
                      color: localDefaultView === 'piano' ? '#fff' : 'var(--text-secondary)',
                      fontSize: 11, fontWeight: 600, padding: '5px 14px', cursor: 'pointer',
                    }}
                  >Piano</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 24 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: 11 }}>Color teclas blancas</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="color" value={localKeyWhite} onChange={(e) => setLocalKeyWhite(e.target.value)}
                      style={{ width: 36, height: 28, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'transparent' }} />
                    <input value={localKeyWhite} onChange={(e) => setLocalKeyWhite(e.target.value)}
                      style={{ width: 80, background: 'var(--bg-dark)', border: '1px solid var(--bg-raised)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '4px 6px', outline: 'none', fontFamily: 'monospace' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: 11 }}>Color teclas negras</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="color" value={localKeyBlack} onChange={(e) => setLocalKeyBlack(e.target.value)}
                      style={{ width: 36, height: 28, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'transparent' }} />
                    <input value={localKeyBlack} onChange={(e) => setLocalKeyBlack(e.target.value)}
                      style={{ width: 80, background: 'var(--bg-dark)', border: '1px solid var(--bg-raised)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '4px 6px', outline: 'none', fontFamily: 'monospace' }} />
                  </div>
                </div>
              </div>
              {/* Board settings */}
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: 11 }}>Chunk columnas (steps)</label>
                  <input type="number" min={1} max={64} value={localChunkCols}
                    onChange={(e) => setLocalChunkCols(Math.max(1, Number(e.target.value)))}
                    title="los valores se multiplican por 2"
                    style={{ width: 60, background: 'var(--bg-dark)', border: '1px solid var(--bg-raised)', borderRadius: 4, color: 'var(--text)', fontSize: 12, padding: '4px 6px', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: 11 }}>Chunk filas (notas)</label>
                  <input type="number" min={1} max={72} value={localChunkRows}
                    onChange={(e) => setLocalChunkRows(Math.max(1, Number(e.target.value)))}
                    title="los valores se multiplican por 2"
                    style={{ width: 60, background: 'var(--bg-dark)', border: '1px solid var(--bg-raised)', borderRadius: 4, color: 'var(--text)', fontSize: 12, padding: '4px 6px', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: 11 }}>Mostrar cuadricula</label>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', height: 28 }}>
                    <button
                      onClick={() => setLocalShowGrid(!localShowGrid)}
                      style={{
                        width: 44, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', position: 'relative',
                        background: localShowGrid ? 'var(--accent)' : 'var(--bg-raised)', transition: 'background 0.15s',
                      }}
                    >
                      <div style={{
                        position: 'absolute', top: 2, width: 18, height: 18, borderRadius: '50%',
                        background: '#fff', transition: 'left 0.15s',
                        left: localShowGrid ? 24 : 2,
                      }} />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: 11 }}>Opacidad cuadricula</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 28 }}>
                    <input type="range" min={0} max={0.5} step={0.01} value={localGridLineOpacity}
                      onChange={(e) => setLocalGridLineOpacity(Number(e.target.value))}
                      style={{ width: 80, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                    <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontFamily: 'monospace', minWidth: 32 }}>{localGridLineOpacity.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 'auto' }}>
                <button onClick={cancel}
                  style={{ background: 'var(--bg-raised)', border: 'none', borderRadius: 6, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, padding: '7px 20px', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={applyMusic}
                  style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 600, padding: '7px 20px', cursor: 'pointer' }}>
                  Aplicar
                </button>
              </div>
            </div>
          ) : (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', fontSize: 14, fontWeight: 600,
              flexDirection: 'column', gap: 8,
            }}>
              <span style={{ fontSize: 32, opacity: 0.3 }}>
                {{ mundo: '🌍', scripting: '💻', sprite: '🎨', imagen: '🖼', music: '🎵', sound: '🔊', dialogo: '💬' }[activeTab]}</span>
              <span>
                {{ mundo: 'test Mundo', scripting: 'test Scripting', sprite: 'test Sprite', imagen: 'test Imagen', music: 'test Music', sound: 'test Sound', dialogo: 'test Dialogo' }[activeTab]}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
