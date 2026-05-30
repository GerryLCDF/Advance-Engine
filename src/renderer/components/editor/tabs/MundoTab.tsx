import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { HierarchyPanel, type HierarchySection } from '../HierarchyPanel';
import { InspectorPanel, type InspectorSection } from '../InspectorPanel';
import { ResizableEditorLayout } from '../ResizableEditorLayout';
import type { Scene } from '../../../types/editor';

const GBA_W = 240;
const GBA_H = 160;

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

export function MundoTab() {
  const scenes = useAppStore((s) => s.scenes);
  const connections = useAppStore((s) => s.sceneConnections);
  const songs = useAppStore((s) => s.songs);
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useAppStore((s) => s.setSelectedNodeId);
  const hierarchyWidth = useAppStore((s) => s.hierarchyWidth);
  const inspectorWidth = useAppStore((s) => s.inspectorWidth);
  const terminalHeight = useAppStore((s) => s.terminalHeight);
  const setHierarchyWidth = useAppStore((s) => s.setHierarchyWidth);
  const setInspectorWidth = useAppStore((s) => s.setInspectorWidth);
  const setTerminalHeight = useAppStore((s) => s.setTerminalHeight);
  const addScene = useAppStore((s) => s.addScene);
  const removeScene = useAppStore((s) => s.removeScene);
  const updateScene = useAppStore((s) => s.updateScene);
  const addConnection = useAppStore((s) => s.addConnection);
  const backgrounds = useAppStore((s) => s.backgrounds);
  const exportLog = useAppStore((s) => s.exportLog);

  const [tool, setTool] = useState<'select' | 'add' | 'connect' | 'remove' | 'collision' | 'move'>('select');
  const [connectFrom, setConnectFrom] = useState<string | null>(null);

  // ── Pan / Zoom ──────────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const hasMoved = useRef(false);
  const mouseCanvasPos = useRef({ x: 0, y: 0 });

  // ── Panel resize is managed by ResizableEditorLayout ────────────────────

  // Attach wheel listener with { passive: false } so preventDefault works
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.001;
        setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta)));
      } else if (e.shiftKey) {
        e.preventDefault();
        setPanX((px) => px - e.deltaY);
      } else {
        e.preventDefault();
        setPanY((py) => py - e.deltaY);
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 'z') { e.preventDefault(); useAppStore.getState().mundoUndo(); }
      if (ctrl && e.key === 'y') { e.preventDefault(); useAppStore.getState().mundoRedo(); }
      if (ctrl && e.key === 'c' && selectedNodeId && scenes.some((s) => s.id === selectedNodeId)) {
        e.preventDefault(); useAppStore.getState().copyScene(selectedNodeId);
      }
      if (ctrl && e.key === 'v') {
        e.preventDefault();
        const wX = (mouseCanvasPos.current.x - panX) / zoom;
        const wY = (mouseCanvasPos.current.y - panY) / zoom;
        useAppStore.getState().pasteScene(wX, wY);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedNodeId, scenes, panX, panY, zoom]);

  const handleMouseDownCanvas = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    e.preventDefault();
    setIsPanning(true);
    hasMoved.current = false;
    panStart.current = { x: e.clientX, y: e.clientY, panX, panY };

    const handleMove = (ev: MouseEvent) => {
      const dx = ev.clientX - panStart.current.x;
      const dy = ev.clientY - panStart.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved.current = true;
      setPanX(panStart.current.panX + dx);
      setPanY(panStart.current.panY + dy);
    };

    const handleUp = () => {
      setIsPanning(false);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panX, panY]);

  const addSceneAtCursor = useCallback(() => {
    const wX = (mouseCanvasPos.current.x - panX) / zoom;
    const wY = (mouseCanvasPos.current.y - panY) / zoom;
    addScene(wX, wY);
  }, [addScene, panX, panY, zoom]);

  const hierarchySections: HierarchySection[] = [
    {
      id: 'scenes',
      title: 'Escenas',
      items: scenes.map((sc) => ({
        id: sc.id, label: sc.name, icon: '🌍',
        subtitle: `${sc.width}x${sc.height}`,
      })),
      onAdd: addSceneAtCursor,
    },
    {
      id: 'connections',
      title: 'Conexiones',
      collapsed: true,
      items: connections.map((c) => {
        const from = scenes.find((s) => s.id === c.fromSceneId);
        const to = scenes.find((s) => s.id === c.toSceneId);
        return { id: c.id, label: `${from?.name ?? '?'} → ${to?.name ?? '?'}`, icon: '🔗' };
      }),
    },
  ];

  const selectedScene = scenes.find((sc) => sc.id === selectedNodeId);
  const [songSearch, setSongSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [imgDropdownOpen, setImgDropdownOpen] = useState(false);
  const [imgSearch, setImgSearch] = useState('');
  const imgDropdownRef = useRef<HTMLDivElement | null>(null);
  const [tipoDropdownOpen, setTipoDropdownOpen] = useState(false);
  const [tipoSearch, setTipoSearch] = useState('');
  const tipoDropdownRef = useRef<HTMLDivElement | null>(null);

  const filteredSongs = useMemo(() => {
    if (!songSearch) return songs;
    const q = songSearch.toLowerCase();
    return songs.filter((so) => so.name.toLowerCase().includes(q));
  }, [songs, songSearch]);

  const imageOptions = useMemo(() => {
    return backgrounds.flatMap((bg) =>
      bg.layers.filter((l) => l.imagePath).map((l) => ({ value: l.imagePath, label: l.imagePath.split('/').pop() ?? l.imagePath }))
    );
  }, [backgrounds]);

  const filteredImages = useMemo(() => {
    if (!imgSearch) return imageOptions;
    const q = imgSearch.toLowerCase();
    return imageOptions.filter((img) => img.label.toLowerCase().includes(q));
  }, [imageOptions, imgSearch]);

  const TIPO_OPTIONS = [
    { value: 'platformer', label: 'Platformer' },
    { value: 'topdown', label: 'Top-Down' },
    { value: 'rpg', label: 'RPG' },
    { value: 'fighting', label: 'Fighting' },
  ];

  const filteredTipos = useMemo(() => {
    if (!tipoSearch) return TIPO_OPTIONS;
    const q = tipoSearch.toLowerCase();
    return TIPO_OPTIONS.filter((t) => t.label.toLowerCase().includes(q));
  }, [tipoSearch]);

  // Cerrar dropdown de canciones al hacer clic fuera
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setSongSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  // Cerrar dropdown de imágenes al hacer clic fuera
  useEffect(() => {
    if (!imgDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (imgDropdownRef.current && !imgDropdownRef.current.contains(e.target as Node)) {
        setImgDropdownOpen(false);
        setImgSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [imgDropdownOpen]);

  // Cerrar dropdown de tipo al hacer clic fuera
  useEffect(() => {
    if (!tipoDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (tipoDropdownRef.current && !tipoDropdownRef.current.contains(e.target as Node)) {
        setTipoDropdownOpen(false);
        setTipoSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [tipoDropdownOpen]);

  const inspectorSections: InspectorSection[] = [];
  if (selectedScene) {
    inspectorSections.push({
      title: 'Escena',
      fields: [
        { label: 'Nombre', type: 'text', value: selectedScene.name, onChange: (v) => updateScene(selectedScene.id, { name: v as string }) },
      ],
    });
    // Canción de fondo
    const selectedBgSong = songs.find((so) => so.id === selectedScene.backgroundSong);
    inspectorSections.push({
      title: 'Canción de fondo',
      content: (
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <div
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '4px 8px', fontSize: 11, cursor: 'pointer',
              background: 'var(--bg-canvas)', border: '1px solid var(--border-color)',
              borderRadius: 4, color: selectedScene.backgroundSong ? '#fff' : 'var(--text-muted)',
            }}
          >
            <span>{selectedBgSong?.name ?? 'Ninguna'}</span>
            <span style={{ fontSize: 8, opacity: 0.6 }}>{dropdownOpen ? '▲' : '▼'}</span>
          </div>
          {dropdownOpen && (
            <div style={{
              position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 2,
              background: 'var(--bg-panel)', border: '1px solid var(--border-color)',
              borderRadius: 4, padding: 4, zIndex: 100, maxHeight: 200, overflow: 'hidden',
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <input
                type="text"
                value={songSearch}
                onChange={(e) => setSongSearch(e.target.value)}
                placeholder="Buscar canción..."
                onClick={(e) => e.stopPropagation()}
                autoFocus
                style={{
                  width: '100%', padding: '4px 6px', fontSize: 11, boxSizing: 'border-box',
                  background: 'var(--bg-canvas)', border: '1px solid var(--border-color)',
                  borderRadius: 4, color: '#fff', outline: 'none',
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto', maxHeight: 140 }}>
                <div
                  onClick={() => { updateScene(selectedScene.id, { backgroundSong: '' }); setDropdownOpen(false); setSongSearch(''); }}
                  style={{
                    padding: '4px 6px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                    background: !selectedScene.backgroundSong ? 'var(--accent)' : 'transparent',
                    color: !selectedScene.backgroundSong ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  Ninguna
                </div>
                {filteredSongs.map((so) => (
                  <div
                    key={so.id}
                    onClick={() => { updateScene(selectedScene.id, { backgroundSong: so.id }); setDropdownOpen(false); setSongSearch(''); }}
                    style={{
                      padding: '4px 6px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                      background: selectedScene.backgroundSong === so.id ? 'var(--accent)' : 'transparent',
                      color: selectedScene.backgroundSong === so.id ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {so.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ),
    });
    // Imagen de fondo
    const selectedBgImg = imageOptions.find((img) => img.value === selectedScene.backgroundImage);
    inspectorSections.push({
      title: 'Imagen de fondo',
      content: (
        <div ref={imgDropdownRef} style={{ position: 'relative' }}>
          <div
            onClick={() => setImgDropdownOpen(!imgDropdownOpen)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '4px 8px', fontSize: 11, cursor: 'pointer',
              background: 'var(--bg-canvas)', border: '1px solid var(--border-color)',
              borderRadius: 4, color: selectedScene.backgroundImage ? '#fff' : 'var(--text-muted)',
            }}
          >
            <span>{selectedBgImg?.label ?? 'Ninguna'}</span>
            <span style={{ fontSize: 8, opacity: 0.6 }}>{imgDropdownOpen ? '▲' : '▼'}</span>
          </div>
          {imgDropdownOpen && (
            <div style={{
              position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 2,
              background: 'var(--bg-panel)', border: '1px solid var(--border-color)',
              borderRadius: 4, padding: 4, zIndex: 100, maxHeight: 200, overflow: 'hidden',
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <input
                type="text"
                value={imgSearch}
                onChange={(e) => setImgSearch(e.target.value)}
                placeholder="Buscar imagen..."
                onClick={(e) => e.stopPropagation()}
                autoFocus
                style={{
                  width: '100%', padding: '4px 6px', fontSize: 11, boxSizing: 'border-box',
                  background: 'var(--bg-canvas)', border: '1px solid var(--border-color)',
                  borderRadius: 4, color: '#fff', outline: 'none',
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto', maxHeight: 140 }}>
                <div
                  onClick={() => { updateScene(selectedScene.id, { backgroundImage: '' }); setImgDropdownOpen(false); setImgSearch(''); }}
                  style={{
                    padding: '4px 6px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                    background: !selectedScene.backgroundImage ? 'var(--accent)' : 'transparent',
                    color: !selectedScene.backgroundImage ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  Ninguna
                </div>
                {filteredImages.map((img) => (
                  <div
                    key={img.value}
                    onClick={() => { updateScene(selectedScene.id, { backgroundImage: img.value }); setImgDropdownOpen(false); setImgSearch(''); }}
                    style={{
                      padding: '4px 6px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                      background: selectedScene.backgroundImage === img.value ? 'var(--accent)' : 'transparent',
                      color: selectedScene.backgroundImage === img.value ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {img.label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ),
    });
    // Tipo
    const selectedTipo = TIPO_OPTIONS.find((t) => t.value === selectedScene.type);
    inspectorSections.push({
      title: 'Tipo',
      content: (
        <div ref={tipoDropdownRef} style={{ position: 'relative' }}>
          <div
            onClick={() => setTipoDropdownOpen(!tipoDropdownOpen)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '4px 8px', fontSize: 11, cursor: 'pointer',
              background: 'var(--bg-canvas)', border: '1px solid var(--border-color)',
              borderRadius: 4, color: '#fff',
            }}
          >
            <span>{selectedTipo?.label ?? selectedScene.type}</span>
            <span style={{ fontSize: 8, opacity: 0.6 }}>{tipoDropdownOpen ? '▲' : '▼'}</span>
          </div>
          {tipoDropdownOpen && (
            <div style={{
              position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 2,
              background: 'var(--bg-panel)', border: '1px solid var(--border-color)',
              borderRadius: 4, padding: 4, zIndex: 100, maxHeight: 200, overflow: 'hidden',
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <input
                type="text"
                value={tipoSearch}
                onChange={(e) => setTipoSearch(e.target.value)}
                placeholder="Buscar tipo..."
                onClick={(e) => e.stopPropagation()}
                autoFocus
                style={{
                  width: '100%', padding: '4px 6px', fontSize: 11, boxSizing: 'border-box',
                  background: 'var(--bg-canvas)', border: '1px solid var(--border-color)',
                  borderRadius: 4, color: '#fff', outline: 'none',
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto', maxHeight: 140 }}>
                {filteredTipos.map((t) => (
                  <div
                    key={t.value}
                    onClick={() => { updateScene(selectedScene.id, { type: t.value as Scene['type'] }); setTipoDropdownOpen(false); setTipoSearch(''); }}
                    style={{
                      padding: '4px 6px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                      background: selectedScene.type === t.value ? 'var(--accent)' : 'transparent',
                      color: selectedScene.type === t.value ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {t.label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ),
    });
  }

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (tool === 'add') {
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const wX = (mx - panX) / zoom;
      const wY = (my - panY) / zoom;
      addScene(wX, wY);
    }
  };

  const handleSceneBoxClick = (sceneId: string) => {
    if (tool === 'connect') {
      if (connectFrom === null) {
        setConnectFrom(sceneId);
      } else if (connectFrom !== sceneId) {
        addConnection(connectFrom, sceneId);
        setConnectFrom(null);
      }
    } else if (tool === 'remove') {
      removeScene(sceneId);
      if (selectedNodeId === sceneId) setSelectedNodeId('');
    } else {
      setSelectedNodeId(sceneId);
    }
  };

  const handleRemove = (id: string) => {
    removeScene(id);
    if (selectedNodeId === id) setSelectedNodeId('');
  };

  return (
    <ResizableEditorLayout
      leftWidth={hierarchyWidth}
      rightWidth={inspectorWidth}
      bottomHeight={terminalHeight}
      onLeftWidthChange={setHierarchyWidth}
      onRightWidthChange={setInspectorWidth}
      onBottomHeightChange={setTerminalHeight}
      left={
        <HierarchyPanel
          sections={hierarchySections}
          selectedId={selectedNodeId}
          onSelect={setSelectedNodeId}
        />
      }
      center={
        <>
          {/* Toolbar — estilo cápsula */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 2,
            padding: '4px 10px', background: 'var(--bg-panel)',
            borderBottom: '1px solid var(--border-color)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 2,
              background: 'var(--bg-canvas)', borderRadius: 20,
              padding: '3px 4px',
            }}>
              <ToolBtn active={tool === 'add'} onClick={() => { setTool('add'); setConnectFrom(null); }} title="Agregar escena">+</ToolBtn>
              <div style={{ width: 1, height: 14, background: 'var(--bg-raised)', margin: '0 2px' }} />
              <ToolBtn active={tool === 'remove'} onClick={() => { setTool('remove'); setConnectFrom(null); }} title="Eliminar escena">−</ToolBtn>
              <div style={{ width: 1, height: 14, background: 'var(--bg-raised)', margin: '0 2px' }} />
              <ToolBtn active={tool === 'connect'} onClick={() => { setTool('connect'); setConnectFrom(null); }} title="Conectar escenas">
                {connectFrom ? '→' : '🔗'}
              </ToolBtn>
              <div style={{ width: 1, height: 14, background: 'var(--bg-raised)', margin: '0 2px' }} />
              <ToolBtn active={tool === 'collision'} onClick={() => { setTool('collision'); setConnectFrom(null); }} title="Pintar colisión">▦</ToolBtn>
              <div style={{ width: 1, height: 14, background: 'var(--bg-raised)', margin: '0 2px' }} />
              <ToolBtn active={tool === 'move'} onClick={() => { setTool('move'); setConnectFrom(null); }} title="Mover">✥</ToolBtn>
            </div>
            {connectFrom && (
              <button
                onClick={() => setConnectFrom(null)}
                style={{
                  background: 'var(--red)', border: 'none', borderRadius: 12,
                  color: '#fff', fontSize: 10, padding: '3px 10px', cursor: 'pointer', marginLeft: 8,
                }}
              >
                Cancelar conexión
              </button>
            )}
          </div>

          {/* Flow canvas con zoom/pan (Godot-style) */}
          <div
            ref={canvasContainerRef}
            style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: isPanning ? 'grabbing' : 'grab', minHeight: 0 }}
            onMouseDown={(e) => {
              if (e.button === 1 || tool === 'select' || tool === 'add') {
                handleMouseDownCanvas(e);
              }
            }}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              mouseCanvasPos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            }}
            onClick={(e) => {
              if (hasMoved.current) return;
              if (tool === 'add') {
                const wX = (mouseCanvasPos.current.x - panX) / zoom;
                const wY = (mouseCanvasPos.current.y - panY) / zoom;
                addScene(wX, wY);
              }
            }}
          >
            {/* Transform wrapper */}
            <div style={{
              transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
              transformOrigin: '0 0',
              position: 'absolute',
              top: 0, left: 0,
              width: 0, height: 0,
            }}>
              {/* Connection lines */}
              <svg style={{
                position: 'absolute', left: 0, top: 0,
                width: 8000, height: 8000,
                pointerEvents: 'none', zIndex: 0,
              }}>
                {connections.map((c) => {
                  const fromSc = scenes.find((s) => s.id === c.fromSceneId);
                  const toSc = scenes.find((s) => s.id === c.toSceneId);
                  if (!fromSc || !toSc) return null;
                  return (
                    <line
                      key={c.id}
                      x1={fromSc.x + 80} y1={fromSc.y + 50}
                      x2={toSc.x + 80} y2={toSc.y + 50}
                      stroke="#3b82f6"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      opacity={0.6}
                    />
                  );
                })}
              </svg>
              {/* Scene cards */}
              {scenes.map((sc) => {
                const isConnecting = connectFrom === sc.id;
                return (
                  <SceneCard
                    key={sc.id}
                    scene={sc}
                    selected={selectedNodeId === sc.id}
                    isConnecting={isConnecting}
                    tool={tool}
                    connectFrom={connectFrom}
                    onSelect={(id) => { if (!hasMoved.current) handleSceneBoxClick(id); }}
                    updateScene={updateScene}
                  />
                );
              })}
            </div>

            {/* Zoom indicator */}
            <div style={{
              position: 'absolute', bottom: 8, right: 8,
              background: '#2d2d33cc', borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11, color: '#aaa',
              pointerEvents: 'none',
              zIndex: 10,
            }}>
              {Math.round(zoom * 100)}%
            </div>
          </div>
        </>
      }
      right={
        <InspectorPanel
          title="Inspector"
          sections={inspectorSections}
          emptyMessage="Selecciona una escena"
        />
      }
      bottom={
        <div style={{
          background: 'var(--bg-terminal)',
          borderTop: '1px solid var(--border-color)',
          padding: '6px 12px',
          fontFamily: 'monospace', fontSize: 11,
          color: 'var(--terminal-green)',
          height: '100%',
          overflow: 'auto',
        }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 9, textTransform: 'uppercase', marginBottom: 4 }}>
            Terminal — Pipeline
          </div>
          {exportLog.length === 0 ? (
            <div style={{ color: 'var(--text-dim)' }}>{'>'} Listo para compilar</div>
          ) : (
            exportLog.map((msg, i) => (
              <div key={i} style={{
                color: msg.startsWith('[ERROR]') ? 'var(--red)' : msg.startsWith('[OK]') ? 'var(--green)' : 'var(--terminal-green)',
              }}>
                {`${'>'} ${msg}`}
              </div>
            ))
          )}
          <div style={{ color: 'var(--text-dim)' }}>_</div>
        </div>
      }
    />
  );
}

function ToolBtn({ children, active, onClick, title }: { children: React.ReactNode; active?: boolean; onClick?: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: active ? 'var(--accent)' : 'transparent',
        border: 'none', borderRadius: 16,
        color: active ? '#fff' : 'var(--text-secondary)',
        width: 26, height: 24, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s',
      }}
    >
      {children}
    </button>
  );
}

function SceneCard({ scene, selected, isConnecting, tool, connectFrom, onSelect, updateScene }: {
  scene: Scene; selected: boolean; isConnecting: boolean;
  tool: string; connectFrom: string | null;
  onSelect: (id: string) => void;
  updateScene: (id: string, patch: Partial<Scene>) => void;
}) {
  const imageSmoothing = useAppStore((s) => s.imageSmoothing);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0 });
  const [bgImageUrl, setBgImageUrl] = useState('');

  useEffect(() => {
    if (!scene.backgroundImage) { setBgImageUrl(''); return; }
    let cancelled = false;
    (async () => {
      const api = window.advanceAPI;
      if (!api) return;
      const result = await api.file.readImage(scene.backgroundImage!);
      if (!cancelled && result.success && result.dataUrl) {
        setBgImageUrl(result.dataUrl);
      }
    })();
    return () => { cancelled = true; };
  }, [scene.backgroundImage]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    onSelect(scene.id);
    setDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: scene.x, origY: scene.y };
    const handleMove = (ev: MouseEvent) => {
      ev.preventDefault();
      updateScene(scene.id, {
        x: dragRef.current.origX + (ev.clientX - dragRef.current.startX),
        y: dragRef.current.origY + (ev.clientY - dragRef.current.startY),
      });
    };
    const handleUp = () => {
      setDragging(false);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [scene.id, scene.x, scene.y, onSelect, updateScene]);

  return (
    <div
      style={{
        position: 'absolute',
        left: 0, top: 0,
        transform: `translate(${scene.x}px, ${scene.y}px)`,
        willChange: dragging ? 'transform' : 'auto',
        width: 400,
        background: isConnecting ? '#3a2a6a' : 'var(--bg-panel)',
        border: `2px solid ${selected ? 'var(--accent-light)' : isConnecting ? 'var(--accent-light)' : 'var(--bg-raised)'}`,
        borderRadius: 8, padding: 10,
        cursor: tool === 'connect' ? 'crosshair' : dragging ? 'grabbing' : 'grab',
        zIndex: dragging ? 10 : 1,
        userSelect: 'none',
      }}
      onMouseDown={handleMouseDown}
      onClick={() => onSelect(scene.id)}
    >
      <div style={{
        fontSize: 11, fontWeight: 600, color: '#ccc',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        marginBottom: 4,
      }}>
        {scene.name}
      </div>
      {/* Mini-map con proporción GBA (3:2) */}
      <div style={{
        width: '100%', paddingBottom: '66.67%', position: 'relative',
        borderRadius: 4, marginBottom: 4, overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: scene.backgroundColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, color: '#ffffff88',
        }}>
          {bgImageUrl && (
            <img src={bgImageUrl} alt="" draggable={false} onDragStart={(e) => e.preventDefault()}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', imageRendering: imageSmoothing ? 'auto' : 'pixelated' }}
            />
          )}
          <span style={{ position: 'relative', zIndex: 1 }}>{scene.width}×{scene.height}</span>
          <div style={{
            position: 'absolute', inset: 0,
            border: '2px solid rgba(255,255,255,0.1)', borderRadius: 2, pointerEvents: 'none',
          }} />
        </div>
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
        {scene.type}
      </div>
      {scene.backgroundSong && (
        <div style={{ fontSize: 9, color: '#6b8cff', marginTop: 2 }}>
          🎵 {scene.backgroundSong}
        </div>
      )}
    </div>
  );
}
