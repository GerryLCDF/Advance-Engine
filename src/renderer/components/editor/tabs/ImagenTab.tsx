import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { HierarchyPanel, type HierarchySection } from '../HierarchyPanel';
import { InspectorPanel, type InspectorSection } from '../InspectorPanel';
import { ResizableEditorLayout } from '../ResizableEditorLayout';

export function ImagenTab() {
  const backgrounds = useAppStore((s) => s.backgrounds);
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useAppStore((s) => s.setSelectedNodeId);
  const addBackground = useAppStore((s) => s.addBackground);
  const removeBackground = useAppStore((s) => s.removeBackground);
  const updateBackground = useAppStore((s) => s.updateBackground);
  const addLayer = useAppStore((s) => s.addLayer);
  const removeLayer = useAppStore((s) => s.removeLayer);
  const updateLayer = useAppStore((s) => s.updateLayer);
  const hierarchyWidth = useAppStore((s) => s.hierarchyWidth);
  const inspectorWidth = useAppStore((s) => s.inspectorWidth);
  const setHierarchyWidth = useAppStore((s) => s.setHierarchyWidth);
  const setInspectorWidth = useAppStore((s) => s.setInspectorWidth);

  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const hasMoved = useRef(false);

  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.001;
        setZoom((z) => Math.min(4, Math.max(0.25, z + delta)));
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

  const [animTab, setAnimTab] = useState<'view' | 'anim'>('view');

  const hierarchySections: HierarchySection[] = [
    {
      id: 'bgs',
      title: 'Imágenes de fondo',
      items: backgrounds.map((bg) => ({
        id: bg.id,
        label: bg.name,
        icon: '🖼',
        subtitle: `${bg.layers.length} capas`,
        children: bg.layers.map((l) => ({
          id: l.id,
          label: l.imagePath ? l.imagePath.split('/').pop() || '(sin nombre)' : '(vacío)',
          icon: l.visible ? '👁' : '👁‍🗨',
        })),
      })),
      onAdd: addBackground,
    },
  ];

  const selectedBg = backgrounds.find((bg) => bg.id === selectedNodeId)
    ?? (selectedNodeId ? backgrounds.find((bg) => bg.layers.some((l) => l.id === selectedNodeId)) : null);

  const selectedLayer = backgrounds.flatMap((bg) => bg.layers).find((l) => l.id === selectedNodeId);
  const parentBg = selectedLayer
    ? backgrounds.find((bg) => bg.layers.some((l) => l.id === selectedLayer.id))
    : selectedBg;

  const inspectorSections: InspectorSection[] = [];

  if (selectedBg && !selectedLayer) {
    inspectorSections.push({
      title: 'Fondo',
      fields: [
        { label: 'Nombre', type: 'text', value: selectedBg.name, onChange: (v) => updateBackground(selectedBg.id, { name: v as string }) },
      ],
    });
  }

  if (selectedLayer) {
    inspectorSections.push({
      title: 'Capa',
      fields: [
        { label: 'Visible', type: 'toggle', value: selectedLayer.visible, onChange: (v) => parentBg && updateLayer(parentBg.id, selectedLayer.id, { visible: v as boolean }) },
        { label: 'Parallax X', type: 'number', value: selectedLayer.parallaxX, onChange: (v) => parentBg && updateLayer(parentBg.id, selectedLayer.id, { parallaxX: v as number }) },
        { label: 'Parallax Y', type: 'number', value: selectedLayer.parallaxY, onChange: (v) => parentBg && updateLayer(parentBg.id, selectedLayer.id, { parallaxY: v as number }) },
        { label: 'Velocidad', type: 'number', value: selectedLayer.speed, onChange: (v) => parentBg && updateLayer(parentBg.id, selectedLayer.id, { speed: v as number }) },
        { label: 'Ruta', type: 'text', value: selectedLayer.imagePath, onChange: (v) => parentBg && updateLayer(parentBg.id, selectedLayer.id, { imagePath: v as string }) },
      ],
    });
  }

  const handleRemove = (id: string) => {
    const isBg = backgrounds.some((bg) => bg.id === id);
    if (isBg) removeBackground(id);
    else {
      for (const bg of backgrounds) {
        if (bg.layers.some((l) => l.id === id)) { removeLayer(bg.id, id); break; }
      }
    }
    if (selectedNodeId === id) setSelectedNodeId('');
  };

  const preview = selectedBg || backgrounds[0];

  return (
    <ResizableEditorLayout
      leftWidth={hierarchyWidth}
      rightWidth={inspectorWidth}
      onLeftWidthChange={setHierarchyWidth}
      onRightWidthChange={setInspectorWidth}
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
          {/* Viewer with zoom/pan */}
          <div
            ref={canvasContainerRef}
            style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: isPanning ? 'grabbing' : 'grab' }}
            onMouseDown={handleMouseDownCanvas}
          >
            {preview ? (
              <div style={{
                transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
                transformOrigin: '0 0',
                position: 'absolute', top: 0, left: 0,
                width: 0, height: 0,
              }}>
                <div
                  style={{
                    width: 320,
                    height: 200,
                    background: 'var(--bg-dark)',
                    border: '1px solid var(--bg-raised)',
                    borderRadius: 4,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {preview.layers.length === 0 && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                      Sin capas
                    </div>
                  )}
                  {[...preview.layers].reverse().map((l, i) => (
                    <div
                      key={l.id}
                      style={{
                        position: 'absolute', inset: 0,
                        background: l.visible
                          ? `linear-gradient(135deg, hsl(${(i * 60 + 200) % 360}, 30%, 25%), hsl(${(i * 60 + 260) % 360}, 30%, 15%))`
                          : 'transparent',
                        opacity: l.visible ? 1 : 0.15,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#ffffff66', fontSize: 9,
                        borderBottom: '1px dashed #ffffff22',
                      }}
                    >
                      {l.imagePath ? `📄 ${l.imagePath.split('/').pop()}` : `Capa ${i + 1}`}
                      {l.parallaxX !== 1 || l.parallaxY !== 1 ? ` [p:${l.parallaxX},${l.parallaxY}]` : ''}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: 13, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>Agrega un fondo</span>
            )}

            {/* Zoom controls */}
            <div style={{
              position: 'absolute', top: 8, right: 8,
              display: 'flex', alignItems: 'center', gap: 2,
              background: 'var(--bg-panel)', borderRadius: 6,
              padding: '3px 6px', border: '1px solid var(--bg-raised)',
              zIndex: 10,
            }}>
              <button onClick={() => setZoom((z) => Math.max(0.25, +(z - 0.1).toFixed(2)))} style={zoomBtnStyle}>−</button>
              <span style={{ color: 'var(--text-secondary)', fontSize: 11, minWidth: 36, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(4, +(z + 0.1).toFixed(2)))} style={zoomBtnStyle}>+</button>
            </div>

            {/* Zoom indicator */}
            <div style={{
              position: 'absolute', bottom: 8, right: 8,
              background: '#2d2d33cc', borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11, color: '#aaa',
              pointerEvents: 'none', zIndex: 10,
            }}>
              {Math.round(zoom * 100)}%
            </div>
          </div>

          {/* Bottom: Animation tab */}
          {preview && (
            <div style={{
              height: 80,
              background: 'var(--bg-panel)',
              borderTop: '1px solid var(--border-color)',
              display: 'flex', flexDirection: 'column',
              flexShrink: 0,
            }}>
              {/* Sub-tabs */}
              <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border-color)' }}>
                {(['view', 'anim'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setAnimTab(t)}
                    style={{
                      background: animTab === t ? 'var(--bg-canvas)' : 'transparent',
                      border: 'none',
                      color: animTab === t ? 'var(--accent-lighter)' : 'var(--text-muted)',
                      fontSize: 11, fontWeight: animTab === t ? 600 : 400,
                      padding: '4px 16px',
                      cursor: 'pointer',
                      borderBottom: animTab === t ? '2px solid var(--accent-light)' : '2px solid transparent',
                    }}
                  >
                    {t === 'view' ? 'Vista previa' : 'Animación'}
                  </button>
                ))}
              </div>
              {/* Content */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 12 }}>
                {animTab === 'view' ? (
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                    {preview.layers.length} capa(s) · {preview.layers.filter((l) => l.visible).length} visible(s)
                  </span>
                ) : (
                  <>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Animación de fondo:</span>
                    <label style={{ color: '#aaa', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input type="checkbox" style={{ accentColor: 'var(--accent)' }} />
                      Activar animación
                    </label>
                    <label style={{ color: '#aaa', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                      Velocidad:
                      <input type="range" min={1} max={10} defaultValue={5}
                        style={{ width: 80, accentColor: 'var(--accent)' }} />
                    </label>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      }
      right={
        <InspectorPanel
          title="Inspector"
          sections={inspectorSections}
          emptyMessage="Selecciona un fondo o capa"
        />
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