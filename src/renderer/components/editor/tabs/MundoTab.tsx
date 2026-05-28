import React, { useState, useCallback, useRef, useEffect } from 'react';
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

  const [tool, setTool] = useState<'select' | 'add' | 'delete' | 'collision' | 'connect'>('select');
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
    },//hello
  ];

  const selectedScene = scenes.find((sc) => sc.id === selectedNodeId);

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
    } else if (tool === 'delete') {
      handleRemove(sceneId);
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
          {/* Toolbar — cápsula de herramientas */}
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
              {([
                { id: 'select', icon: MouseIcon, title: 'Seleccionar' },
                { id: 'add', icon: PlusIcon, title: 'Agregar' },
                { id: 'delete', icon: EraserIcon, title: 'Borrar' },
                { id: 'collision', icon: CollisionIcon, title: 'Colisión' },
                { id: 'connect', icon: ConnectIcon, title: 'Conectar' },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setTool(t.id); if (t.id !== 'connect') setConnectFrom(null); }}
                  style={{
                    background: tool === t.id ? 'var(--accent)' : 'transparent',
                    border: 'none', borderRadius: 16,
                    color: tool === t.id ? '#fff' : 'var(--text-secondary)',
                    width: 30, height: 28, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.15s',
                  }}
                  title={t.title}
                >
                  <t.icon size={16} />
                </button>
              ))}
            </div>
            {connectFrom && (
              <button
                onClick={() => setConnectFrom(null)}
                style={{
                  background: 'var(--red)', border: 'none', borderRadius: 12,
                  color: '#fff', fontSize: 10, padding: '3px 10px', cursor: 'pointer',
                  marginLeft: 8,
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

            {/* Zoom controls */}
            <div style={{
              position: 'absolute', top: 8, right: 8,
              display: 'flex', alignItems: 'center', gap: 2,
              background: 'var(--bg-panel)', borderRadius: 6,
              padding: '3px 6px', border: '1px solid var(--bg-raised)',
              zIndex: 10,
            }}>
              <button onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.1).toFixed(2)))} style={zoomBtnStyle}>−</button>
              <span style={{ color: 'var(--text-secondary)', fontSize: 11, minWidth: 36, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.1).toFixed(2)))} style={zoomBtnStyle}>+</button>
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

const zoomBtnStyle: React.CSSProperties = {
  background: 'var(--bg-raised)',
  border: 'none', borderRadius: 3,
  color: 'var(--text-secondary)', fontSize: 13,
  width: 22, height: 20, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

// ── Iconos SVG ─────────────────────────────────────────────────────────

function MouseIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
      <path d="M13 13l6 6" />
    </svg>
  );
}

function PlusIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function EraserIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8L14.6 1.6c.8-.8 2-.8 2.8 0L21 5.4c.8.8.8 2 0 2.8L12 17" />
      <path d="M6 11l7 7" />
    </svg>
  );
}

function CollisionIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="4" height="4" rx="1" />
      <rect x="10" y="2" width="4" height="4" rx="1" />
      <rect x="18" y="2" width="4" height="4" rx="1" />
      <rect x="2" y="10" width="4" height="4" rx="1" />
      <rect x="10" y="10" width="4" height="4" rx="1" />
      <rect x="18" y="10" width="4" height="4" rx="1" />
      <rect x="2" y="18" width="4" height="4" rx="1" />
      <rect x="10" y="18" width="4" height="4" rx="1" />
      <rect x="18" y="18" width="4" height="4" rx="1" />
    </svg>
  );
}

function ConnectIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  );
}
