import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { HierarchyPanel, type HierarchySection } from '../HierarchyPanel';
import { InspectorPanel, type InspectorSection } from '../InspectorPanel';
import { ResizableEditorLayout } from '../ResizableEditorLayout';

export function SpriteTab() {
  const spriteSheets = useAppStore((s) => s.spriteSheets);
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useAppStore((s) => s.setSelectedNodeId);
  const addSpriteSheet = useAppStore((s) => s.addSpriteSheet);
  const removeSpriteSheet = useAppStore((s) => s.removeSpriteSheet);
  const updateSpriteSheet = useAppStore((s) => s.updateSpriteSheet);
  const addAnimation = useAppStore((s) => s.addAnimation);
  const removeAnimation = useAppStore((s) => s.removeAnimation);
  const updateAnimation = useAppStore((s) => s.updateAnimation);
  const addFrame = useAppStore((s) => s.addFrame);
  const updateFrame = useAppStore((s) => s.updateFrame);
  const hierarchyWidth = useAppStore((s) => s.hierarchyWidth);
  const inspectorWidth = useAppStore((s) => s.inspectorWidth);
  const setHierarchyWidth = useAppStore((s) => s.setHierarchyWidth);
  const setInspectorWidth = useAppStore((s) => s.setInspectorWidth);
  const spriteZoom = useAppStore((s) => s.spriteZoom);
  const setSpriteZoom = useAppStore((s) => s.setSpriteZoom);

  const zoomFactor = spriteZoom / 100;
  const [tilePage, setTilePage] = useState(0);
  const [brushTile, setBrushTile] = useState<number | null>(null);

  // ── Pan ─────────────────────────────────────────────────────────────────
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const hasMoved = useRef(false);

  // ── Center canvas on mount / sprite change / zoom change ──────────────
  const centerCanvas = useCallback(() => {
    const el = canvasContainerRef.current;
    const sprite = spriteSheets.find((sp) => sp.id === selectedNodeId);
    if (!el || !sprite) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    const sw = sprite.cols * sprite.tileWidth * zoomFactor;
    const sh = sprite.rows * sprite.tileHeight * zoomFactor;
    setPanX((cw - sw) / 2);
    setPanY((ch - sh) / 2);
  }, [spriteSheets, selectedNodeId, zoomFactor]);

  useEffect(() => {
    centerCanvas();
  }, [centerCanvas]);

  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => centerCanvas());
    ro.observe(el);
    return () => ro.disconnect();
  }, [centerCanvas]);

  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.5;
        setSpriteZoom(Math.min(400, Math.max(25, spriteZoom + delta)));
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
  }, [spriteZoom, setSpriteZoom]);

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

  const selectedSprite = useMemo(
    () => spriteSheets.find((sp) => sp.id === selectedNodeId) ?? null,
    [spriteSheets, selectedNodeId],
  );

  const selectedAnim = useMemo(
    () => spriteSheets.flatMap((sp) => sp.animations).find((a) => a.id === selectedNodeId) ?? null,
    [spriteSheets, selectedNodeId],
  );

  const parentSprite = selectedAnim
    ? spriteSheets.find((sp) => sp.animations.some((a) => a.id === selectedAnim.id)) ?? null
    : selectedSprite;

  const filteredAnimations = selectedSprite
    ? selectedSprite.animations
    : [];

  const hierarchySections: HierarchySection[] = [
    {
      id: 'sprites',
      title: 'Sprites',
      items: spriteSheets.map((sp) => ({
        id: sp.id, label: sp.name, icon: '🎨',
        subtitle: `${sp.cols}x${sp.rows}`,
      })),
      onAdd: addSpriteSheet,
    },
    {
      id: 'animations',
      title: 'Animaciones',
      collapsed: !selectedSprite,
      items: (selectedSprite ? selectedSprite.animations : []).map((anim) => ({
        id: anim.id, label: anim.name, icon: '▶',
        subtitle: `${anim.frames.length}f`,
      })),
      onAdd: selectedSprite ? () => addAnimation(selectedSprite.id) : undefined,
    },
  ];

  const inspectorSections: InspectorSection[] = [];

  if (selectedSprite && !selectedAnim) {
    const sp = selectedSprite;
    inspectorSections.push({
      title: 'Sprite',
      fields: [
        { label: 'Nombre', type: 'text', value: sp.name, onChange: (v) => updateSpriteSheet(sp.id, { name: v as string }) },
        { label: 'Tile W', type: 'number', value: sp.tileWidth, onChange: (v) => updateSpriteSheet(sp.id, { tileWidth: v as number }) },
        { label: 'Tile H', type: 'number', value: sp.tileHeight, onChange: (v) => updateSpriteSheet(sp.id, { tileHeight: v as number }) },
        { label: 'Columnas', type: 'number', value: sp.cols, onChange: (v) => updateSpriteSheet(sp.id, { cols: v as number }) },
        { label: 'Filas', type: 'number', value: sp.rows, onChange: (v) => updateSpriteSheet(sp.id, { rows: v as number }) },
        { label: 'Set size', type: 'text', value: `${sp.cols}x${sp.rows}`, onChange: () => {} },
        { label: 'Tile size', type: 'text', value: `${sp.tileWidth}x${sp.tileHeight}`, onChange: () => {} },
      ],
    });
  }

  if (selectedAnim) {
    inspectorSections.push({
      title: 'Animación',
      fields: [
        { label: 'Nombre', type: 'text', value: selectedAnim.name, onChange: (v) => parentSprite && updateAnimation(parentSprite.id, selectedAnim.id, { name: v as string }) },
        { label: 'Loop', type: 'toggle', value: selectedAnim.loop, onChange: (v) => parentSprite && updateAnimation(parentSprite.id, selectedAnim.id, { loop: v as boolean }) },
      ],
    });
    if (selectedAnim.frames.length > 0) {
      inspectorSections.push({
        title: 'Frames',
        fields: selectedAnim.frames.map((f, i) => ({
          label: `#${i + 1} tile`,
          type: 'number' as const,
          value: f.tileIndex,
          onChange: (v) => parentSprite && updateFrame(parentSprite.id, selectedAnim.id, i, { tileIndex: v as number }),
        })),
      });
    }
  }

  const totalTiles = selectedSprite ? selectedSprite.cols * selectedSprite.rows : 0;
  const tilesPerPage = 20;
  const totalPages = Math.max(1, Math.ceil(totalTiles / tilesPerPage));
  const clampedPage = Math.min(tilePage, totalPages - 1);
  const pageTiles = selectedSprite
    ? Array.from({ length: totalTiles }, (_, i) => i).slice(clampedPage * tilesPerPage, (clampedPage + 1) * tilesPerPage)
    : [];

  const handleRemove = (id: string) => {
    const isSprite = spriteSheets.some((sp) => sp.id === id);
    if (isSprite) removeSpriteSheet(id);
    else {
      for (const sp of spriteSheets) {
        if (sp.animations.some((a) => a.id === id)) {
          removeAnimation(sp.id, id);
          break;
        }
      }
    }
    if (selectedNodeId === id) setSelectedNodeId('');
  };

  const handleDropTile = (tileIdx: number) => {
    if (selectedAnim && parentSprite) {
      addFrame(parentSprite.id, selectedAnim.id);
      const newLen = parentSprite.animations.find((a) => a.id === selectedAnim.id)?.frames.length ?? 0;
      updateFrame(parentSprite.id, selectedAnim.id, newLen - 1, { tileIndex: tileIdx });
    }
  };

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
          {/* Canvas with zoom/pan */}
          <div
            ref={canvasContainerRef}
            style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: isPanning ? 'grabbing' : 'grab' }}
            onMouseDown={handleMouseDownCanvas}
          >
            {selectedSprite ? (
              <div style={{
                transform: `translate(${panX}px, ${panY}px) scale(${zoomFactor})`,
                transformOrigin: '0 0',
                position: 'absolute', top: 0, left: 0,
                width: 0, height: 0,
              }}>
                <div
                  style={{
                    width: selectedSprite.cols * selectedSprite.tileWidth,
                    height: selectedSprite.rows * selectedSprite.tileHeight,
                    background: 'var(--bg-dark)',
                    border: '1px solid var(--bg-raised)',
                    borderRadius: 4,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: 'linear-gradient(#ffffff11 1px, transparent 1px), linear-gradient(90deg, #ffffff11 1px, transparent 1px)',
                    backgroundSize: `${selectedSprite.tileWidth}px ${selectedSprite.tileHeight}px`,
                    pointerEvents: 'none',
                  }} />
                  {selectedAnim?.frames.map((f, i) => {
                    const tx = (f.tileIndex % selectedSprite.cols);
                    const ty = Math.floor(f.tileIndex / selectedSprite.cols);
                    return (
                      <div key={i} style={{
                        position: 'absolute',
                        left: tx * selectedSprite.tileWidth,
                        top: ty * selectedSprite.tileHeight,
                        width: selectedSprite.tileWidth,
                        height: selectedSprite.tileHeight,
                        border: '1px solid #a78bfa55',
                        background: 'rgba(167,139,250,0.12)',
                        pointerEvents: 'none',
                      }} />
                    );
                  })}
                </div>
              </div>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: 13, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>Selecciona un sprite</span>
            )}

            {/* Zoom controls */}
            <div style={{
              position: 'absolute', top: 8, right: 8,
              display: 'flex', alignItems: 'center', gap: 2,
              background: 'var(--bg-panel)', borderRadius: 6,
              padding: '3px 6px', border: '1px solid var(--bg-raised)',
              zIndex: 10,
            }}>
              <button onClick={() => setSpriteZoom(Math.max(25, spriteZoom - 10))} style={zoomBtnStyle}>−</button>
              <span style={{ color: 'var(--text-secondary)', fontSize: 11, minWidth: 32, textAlign: 'center' }}>{spriteZoom}%</span>
              <button onClick={() => setSpriteZoom(Math.min(400, spriteZoom + 10))} style={zoomBtnStyle}>+</button>
            </div>

            {/* Zoom indicator */}
            <div style={{
              position: 'absolute', bottom: 8, right: 8,
              background: '#2d2d33cc', borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11, color: '#aaa',
              pointerEvents: 'none', zIndex: 10,
            }}>
              {spriteZoom}%
            </div>
          </div>

          {/* Tileset panel */}
          {selectedSprite && (
            <div style={{
              height: 80,
              background: 'var(--bg-panel)',
              borderTop: '1px solid var(--border-color)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px',
              overflowX: 'auto',
              flexShrink: 0,
            }}>
              {/* Pagination */}
              <button onClick={() => setTilePage(0)} style={pageBtnStyle} title="Primero">|&#60;</button>
              <button onClick={() => setTilePage((p) => Math.max(0, p - 1))} style={pageBtnStyle} title="Anterior">&#60;</button>
              <span style={{ color: 'var(--text-muted)', fontSize: 10, minWidth: 30, textAlign: 'center' }}>
                {clampedPage + 1}/{totalPages}
              </span>
              <button onClick={() => setTilePage((p) => Math.min(totalPages - 1, p + 1))} style={pageBtnStyle} title="Siguiente">&gt;</button>
              <button onClick={() => setTilePage(totalPages - 1)} style={pageBtnStyle} title="Último">&gt;|</button>

              <div style={{ width: 1, height: 30, background: 'var(--bg-raised)', margin: '0 8px' }} />

              {/* Tiles */}
              <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                {pageTiles.map((tileIdx) => (
                  <div
                    key={tileIdx}
                    onClick={() => { setBrushTile(tileIdx); }}
                    onDoubleClick={() => handleDropTile(tileIdx)}
                    style={{
                      width: 28,
                      height: 28,
                      background: brushTile === tileIdx ? 'var(--accent)' : 'var(--bg-dark)',
                      border: `1px solid ${brushTile === tileIdx ? 'var(--accent-light)' : 'var(--bg-raised)'}`,
                      borderRadius: 3,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-muted)',
                      fontSize: 9,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                    title={`Tile ${tileIdx} (doble clic para añadir a frames)`}
                  >
                    {tileIdx}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Frames timeline */}
          {selectedAnim && (
            <div style={{
              height: 64,
              background: 'var(--bg-panel)',
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px',
              overflowX: 'auto',
              flexShrink: 0,
            }}>
              <span style={{ color: 'var(--accent)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', marginRight: 6 }}>
                Frames
              </span>
              {selectedAnim.frames.map((f, i) => (
                <div
                  key={i}
                  style={{
                    width: 44, height: 44,
                    background: 'var(--bg-dark)',
                    border: '1px solid var(--bg-raised)',
                    borderRadius: 4,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, fontSize: 9, color: 'var(--text-muted)',
                  }}
                >
                  <span>{f.tileIndex}</span>
                  <span style={{ fontSize: 8, color: '#666' }}>{f.duration}ms</span>
                </div>
              ))}
              <button
                onClick={() => parentSprite && addFrame(parentSprite.id, selectedAnim.id)}
                style={{
                  background: 'var(--accent)',
                  border: 'none', borderRadius: 4,
                  color: '#fff', width: 32, height: 32,
                  fontSize: 18, fontWeight: 700, cursor: 'pointer',
                  flexShrink: 0, lineHeight: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                title="Añadir frame"
              >
                +
              </button>
            </div>
          )}
        </>
      }
      right={
        <InspectorPanel
          title="Inspector"
          sections={inspectorSections}
          emptyMessage="Selecciona un sprite o animación"
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

const pageBtnStyle: React.CSSProperties = {
  background: 'var(--bg-raised)',
  border: 'none', borderRadius: 3,
  color: 'var(--text-secondary)', fontSize: 10,
  padding: '3px 6px', cursor: 'pointer',
  height: 24,
};
