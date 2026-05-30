import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../../../store/useAppStore';
import { HierarchyPanel, type HierarchySection } from '../HierarchyPanel';
import { InspectorPanel, type InspectorSection } from '../InspectorPanel';
import { ResizableEditorLayout } from '../ResizableEditorLayout';

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

  const [tool, setTool] = useState<'select' | 'add' | 'connect'>('select');
  const [connectFrom, setConnectFrom] = useState<string | null>(null);

  // ── Pan / Zoom ──────────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const hasMoved = useRef(false);

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

  const handleMouseDownCanvas = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
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

  const hierarchySections: HierarchySection[] = [
    {
      id: 'scenes',
      title: 'Escenas',
      items: scenes.map((sc) => ({
        id: sc.id, label: sc.name, icon: '🌍',
        subtitle: `${sc.width}x${sc.height}`,
      })),
      onAdd: addScene,
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

  const filteredSongs = useMemo(() => {
    if (!songSearch) return songs;
    const q = songSearch.toLowerCase();
    return songs.filter((so) => so.name.toLowerCase().includes(q));
  }, [songs, songSearch]);

  // Cerrar dropdown al hacer clic fuera
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

  const inspectorSections: InspectorSection[] = [];
  if (selectedScene) {
    inspectorSections.push({
      title: 'Escena',
      fields: [
        { label: 'Nombre', type: 'text', value: selectedScene.name, onChange: (v) => updateScene(selectedScene.id, { name: v as string }) },
        { label: 'Ancho', type: 'number', value: selectedScene.width, onChange: (v) => updateScene(selectedScene.id, { width: v as number }) },
        { label: 'Alto', type: 'number', value: selectedScene.height, onChange: (v) => updateScene(selectedScene.id, { height: v as number }) },
        { label: 'Fondo', type: 'color', value: selectedScene.backgroundColor, onChange: (v) => updateScene(selectedScene.id, { backgroundColor: v as string }) },
        {
          label: 'Tipo', type: 'select', value: selectedScene.type,
          options: [
            { value: 'platformer', label: 'Platformer' },
            { value: 'topdown', label: 'Top-Down' },
            { value: 'rpg', label: 'RPG' },
            { value: 'fighting', label: 'Fighting' },
          ],
          onChange: (v) => updateScene(selectedScene.id, { type: v as 'platformer' | 'topdown' | 'rpg' | 'fighting' }),
        },
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
  }

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (tool === 'add') {
      addScene();
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
    } else {
      setSelectedNodeId(sceneId);
    }
  };

  const handleRemove = (id: string) => {
    removeScene(id);
    if (selectedNodeId === id) setSelectedNodeId('');
  };

  const handleResizeStart = useCallback((e: React.MouseEvent, sceneId: string, startW: number, startH: number) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;

    const handleMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const newW = Math.max(16, startW + dx);
      const newH = Math.max(16, startH + dy);
      updateScene(sceneId, { width: Math.round(newW), height: Math.round(newH) });
    };

    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [updateScene]);

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
          onRemove={handleRemove}
        />
      }
      center={
        <>
          {/* Toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 10px', background: 'var(--bg-panel)',
            borderBottom: '1px solid var(--border-color)',
          }}>
            {([
              { id: 'select', label: '⬚' },
              { id: 'add', label: '+' },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => { setTool(t.id); setConnectFrom(null); }}
                style={{
                  background: tool === t.id ? 'var(--accent)' : 'var(--bg-raised)',
                  border: 'none', borderRadius: 4,
                  color: '#fff', fontSize: 13,
                  width: 28, height: 26, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                title={t.id === 'select' ? 'Seleccionar' : 'Agregar escena'}
              >
                {t.label}
              </button>
            ))}
            <div style={{ width: 1, height: 20, background: 'var(--bg-raised)', margin: '0 6px' }} />
            <button
              onClick={() => { setTool('connect'); setConnectFrom(null); }}
              style={{
                background: tool === 'connect' ? 'var(--accent)' : 'var(--bg-raised)',
                border: 'none', borderRadius: 4,
                color: '#fff', fontSize: 11,
                padding: '3px 10px', cursor: 'pointer',
              }}
            >
              {connectFrom ? '→ Conectar a...' : '🔗 Conectar'}
            </button>
            {connectFrom && (
              <button
                onClick={() => setConnectFrom(null)}
                style={{
                  background: 'var(--red)', border: 'none', borderRadius: 4,
                  color: '#fff', fontSize: 10, padding: '2px 8px', cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            )}
          </div>

          {/* Flow canvas con zoom/pan (Godot-style) */}
          <div
            ref={canvasContainerRef}
            style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: isPanning ? 'grabbing' : 'grab', minHeight: 0 }}
            onMouseDown={(e) => {
              if (tool === 'select' || tool === 'add') {
                handleMouseDownCanvas(e);
              }
            }}
            onClick={(e) => {
              if (hasMoved.current) return;
              if (tool === 'add') addScene();
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
                width: 2000, height: 2000,
                pointerEvents: 'none', zIndex: 0,
              }}>
                {connections.map((c) => {
                  const from = scenes.findIndex((s) => s.id === c.fromSceneId);
                  const to = scenes.findIndex((s) => s.id === c.toSceneId);
                  if (from === -1 || to === -1) return null;
                  const x1 = 60 + (from % 3) * 180;
                  const y1 = 20 + Math.floor(from / 3) * 130;
                  const x2 = 60 + (to % 3) * 180;
                  const y2 = 20 + Math.floor(to / 3) * 130;
                  return (
                    <line
                      key={c.id}
                      x1={x1 + 80} y1={y1 + 50}
                      x2={x2 + 80} y2={y2 + 50}
                      stroke="#3b82f6"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      opacity={0.6}
                    />
                  );
                })}
              </svg>
              {/* Scene cards */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, position: 'relative', zIndex: 1, padding: 24 }}>
                {scenes.map((sc) => {
                  const isConnecting = connectFrom === sc.id;
                  return (
                    <motion.div
                      key={sc.id}
                      onClick={(e) => { e.stopPropagation(); if (!hasMoved.current) handleSceneBoxClick(sc.id); }}
                      whileHover={{ scale: 1.03 }}
                      style={{
                        width: 160,
                        background: isConnecting ? '#3a2a6a' : 'var(--bg-panel)',
                        border: `2px solid ${selectedNodeId === sc.id ? 'var(--accent-light)' : isConnecting ? 'var(--accent-light)' : 'var(--bg-raised)'}`,
                        borderRadius: 8,
                        padding: 10,
                        cursor: tool === 'connect' ? 'crosshair' : 'pointer',
                        position: 'relative',
                      }}
                    >
                      {/* Mini-map thumbnail con resize handle */}
                      <div style={{
                        width: '100%', height: 60,
                        background: sc.backgroundColor,
                        borderRadius: 4, marginBottom: 6,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, color: '#ffffff88',
                        position: 'relative',
                        overflow: 'hidden',
                      }}>
                        <span>{sc.width}×{sc.height}</span>
                        {/* Resize handle (Godot-style) */}
                        <div
                          onMouseDown={(ev) => { ev.stopPropagation(); handleResizeStart(ev, sc.id, sc.width, sc.height); }}
                          style={{
                            position: 'absolute', bottom: 0, right: 0,
                            width: 14, height: 14,
                            cursor: 'nwse-resize',
                            opacity: selectedNodeId === sc.id ? 0.8 : 0.3,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10">
                            <line x1="3" y1="10" x2="10" y2="3" stroke="#fff" strokeWidth="1.5" />
                            <line x1="6" y1="10" x2="10" y2="6" stroke="#fff" strokeWidth="1.5" />
                          </svg>
                        </div>
                      </div>
                      <div style={{ color: 'var(--text)', fontSize: 12, fontWeight: 600 }}>{sc.name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>{sc.type}</div>
                    </motion.div>
                  );
                })}
              </div>
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
            Terminal — GBA Build
          </div>
          <div>{'>'} Listo para compilar</div>
          <div style={{ color: 'var(--text-dim)' }}>_</div>
        </div>
      }
    />
  );
}
