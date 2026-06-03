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
  const removeFrame = useAppStore((s) => s.removeFrame);
  const hierarchyWidth = useAppStore((s) => s.hierarchyWidth);
  const inspectorWidth = useAppStore((s) => s.inspectorWidth);
  const setHierarchyWidth = useAppStore((s) => s.setHierarchyWidth);
  const setInspectorWidth = useAppStore((s) => s.setInspectorWidth);
  const spriteZoom = useAppStore((s) => s.spriteZoom);
  const setSpriteZoom = useAppStore((s) => s.setSpriteZoom);

  const zoomFactor = spriteZoom / 100;
  const imageSmoothing = useAppStore((s) => s.imageSmoothing);

  // ── Frame selection ─────────────────────────────────────────────────────
  const [currentSpriteFrame, setCurrentSpriteFrame] = useState(0);

  // ── Animation preview (separate from hierarchy selection) ─────────────
  const [previewAnimId, setPreviewAnimId] = useState<string | null>(null);
  const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [onionSkin, setOnionSkin] = useState(false);
  const [showGrid, setShowGrid] = useState(true);

  // ── Context menu ───────────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  // ── Drag state (handler defined after selectedSprite) ────────────────────
  const [dragOver, setDragOver] = useState(false);
  const projectDir = useAppStore((s) => s.projectDir);

  // ── Pan ─────────────────────────────────────────────────────────────────
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const hasMoved = useRef(false);

  // ── Derived state ───────────────────────────────────────────────────────
  const selectedSprite = useMemo(
    () => spriteSheets.find((sp) => sp.id === selectedNodeId) ?? null,
    [spriteSheets, selectedNodeId],
  );

  const previewAnim = useMemo(() => {
    if (!previewAnimId || !selectedSprite) return null;
    return selectedSprite.animations.find((a) => a.id === previewAnimId) ?? null;
  }, [previewAnimId, selectedSprite]);

  // Reset preview when sprite changes or animation is deleted
  useEffect(() => {
    if (previewAnimId && (!selectedSprite || !selectedSprite.animations.some((a) => a.id === previewAnimId))) {
      setPreviewAnimId(null);
    }
  }, [selectedSprite, previewAnimId]);

  // ── Center canvas on mount / sprite change / zoom change ──────────────
  const centerCanvas = useCallback(() => {
    const el = canvasContainerRef.current;
    const sprite = spriteSheets.find((sp) => sp.id === selectedNodeId);
    if (!el || !sprite) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    const sw = sprite.tileWidth * zoomFactor;
    const sh = sprite.tileHeight * zoomFactor;
    setPanX((cw - sw) / 2);
    setPanY((ch - sh) / 2);
  }, [spriteSheets, selectedNodeId, zoomFactor]);

  const totalSpriteFrames = selectedSprite ? selectedSprite.cols * selectedSprite.rows : 0;

  // ── Tileset image loading ───────────────────────────────────────────────
  const [tilesetUrl, setTilesetUrl] = useState('');
  const [spriteImgSize, setSpriteImgSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!selectedSprite?.tilesetPath) { setTilesetUrl(''); setSpriteImgSize(null); return; }
    let cancelled = false;
    (async () => {
      const api = window.advanceAPI;
      if (!api) return;
      const result = await api.file.readImage(selectedSprite.tilesetPath!);
      if (!cancelled && result.success && result.dataUrl) {
        setTilesetUrl(result.dataUrl);
        if (result.width && result.height) {
          setSpriteImgSize({ w: result.width, h: result.height });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [selectedSprite?.tilesetPath]);

  // Auto-calculate tile size from image dimensions ÷ H/V frames
  useEffect(() => {
    if (!selectedSprite || !spriteImgSize) return;
    const tileW = Math.round(spriteImgSize.w / selectedSprite.cols);
    const tileH = Math.round(spriteImgSize.h / selectedSprite.rows);
    if (tileW !== selectedSprite.tileWidth || tileH !== selectedSprite.tileHeight) {
      updateSpriteSheet(selectedSprite.id, { tileWidth: tileW, tileHeight: tileH });
    }
  }, [selectedSprite?.id, selectedSprite?.cols, selectedSprite?.rows, spriteImgSize]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const filePath = (file as any).path;
    if (!filePath) return;
    const api = window.advanceAPI;
    if (!api) return;
    const result = await api.file.readImage(filePath);
    if (!result.success || !result.dataUrl) return;
    const st = useAppStore.getState();

    let sprite = selectedSprite;
    if (!sprite) {
      st.addSpriteSheet();
      const sheets = useAppStore.getState().spriteSheets;
      sprite = sheets[sheets.length - 1];
      if (sprite) setSelectedNodeId(sprite.id);
    }
    if (!sprite) return;

    const destPath = projectDir ? `${projectDir}/sprites/${file.name}` : filePath;
    if (projectDir) {
      await api.dir.create(`${projectDir}/sprites`);
      await api.file.copy(filePath, destPath);
    }

    // Auto-detect grid from image dimensions
    const imgW = result.width ?? 0;
    const imgH = result.height ?? 0;
    const detectedCols = imgW > 0 && imgW % 240 === 0 ? Math.round(imgW / 240) : 1;
    const detectedRows = imgH > 0 && imgH % 160 === 0 ? Math.round(imgH / 160) : 1;

    updateSpriteSheet(sprite.id, {
      tilesetPath: destPath,
      cols: detectedCols,
      rows: detectedRows,
    });
  }, [selectedSprite, projectDir]);

  useEffect(() => { centerCanvas(); }, [centerCanvas]);

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

  // ── Animation playback timer ───────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying) return;
    if (previewAnim && previewAnim.frames.length > 0) {
      const dur = previewAnim.frames[currentFrameIdx]?.duration ?? 100;
      const animId = previewAnim.id;
      const id = window.setTimeout(() => {
        setCurrentFrameIdx((prev) => {
          const freshAnim = useAppStore.getState().spriteSheets
            .flatMap((s) => s.animations)
            .find((a) => a.id === animId);
          if (!freshAnim || freshAnim.frames.length === 0) return prev;
          const next = prev + 1;
          if (next >= freshAnim.frames.length) {
            if (freshAnim.loop) return 0;
            setIsPlaying(false);
            return prev;
          }
          return next;
        });
      }, dur);
      return () => window.clearTimeout(id);
    }
    if (!previewAnim && selectedSprite && totalSpriteFrames > 0) {
      const id = window.setTimeout(() => {
        setCurrentSpriteFrame((prev) => (prev + 1) % totalSpriteFrames);
      }, 100);
      return () => window.clearTimeout(id);
    }
  }, [isPlaying, previewAnim?.id, previewAnim?.frames.length, currentFrameIdx, currentSpriteFrame, selectedSprite?.id, totalSpriteFrames]);

  // ── Hierarchy selection handler ───────────────────────────────────────
  function handleHierarchySelect(id: string) {
    const isSprite = spriteSheets.some((sp) => sp.id === id);
    if (isSprite) {
      setSelectedNodeId(id);
      setPreviewAnimId(null);
      setCurrentFrameIdx(0);
      setCurrentSpriteFrame(0);
      setIsPlaying(false);
    } else {
      setPreviewAnimId(id);
      setCurrentFrameIdx(0);
      setIsPlaying(false);
    }
  }

  function handleAddAnimation() {
    if (!selectedSprite) return;
    addAnimation(selectedSprite.id);
    const sprite = useAppStore.getState().spriteSheets.find((s) => s.id === selectedSprite.id);
    const newAnim = sprite?.animations[sprite.animations.length - 1];
    if (newAnim) setPreviewAnimId(newAnim.id);
  }

  // ── Sections ────────────────────────────────────────────────────────────
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
        id: anim.id, label: anim.name,
        icon: previewAnimId === anim.id ? '▶▶' : '▶',
        subtitle: `${anim.frames.length}f`,
      })),
      onAdd: handleAddAnimation,
    },
  ];

  const selectedAnim = useMemo(
    () => spriteSheets.flatMap((sp) => sp.animations).find((a) => a.id === previewAnimId) ?? null,
    [spriteSheets, previewAnimId],
  );

  const parentSprite = selectedAnim
    ? spriteSheets.find((sp) => sp.animations.some((a) => a.id === selectedAnim.id)) ?? null
    : selectedSprite;

  const inspectorSections: InspectorSection[] = [];

  if (selectedSprite && !selectedAnim) {
    const sp = selectedSprite;
    inspectorSections.push({
      title: 'Sprite',
      fields: [
        { label: 'Nombre', type: 'text', value: sp.name, onChange: (v) => updateSpriteSheet(sp.id, { name: v as string }) },
        { label: 'Ruta', type: 'text', value: sp.tilesetPath, onChange: (v) => updateSpriteSheet(sp.id, { tilesetPath: v as string }) },
      ],
    });
    inspectorSections.push({
      title: 'Cargar imagen',
      content: (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={async () => {
              const api = window.advanceAPI;
              if (!api) return;
              const result = await api.dialog.openImage();
              if (result.path) {
                updateSpriteSheet(sp.id, { tilesetPath: result.path });
              }
            }}
            style={{
              padding: '4px 8px', fontSize: 10, cursor: 'pointer',
              background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4,
            }}
          >
            Seleccionar imagen
          </button>
          {sp.tilesetPath && (
            <button
              onClick={() => updateSpriteSheet(sp.id, { tilesetPath: '' })}
              style={{
                padding: '4px 8px', fontSize: 10, cursor: 'pointer',
                background: '#8b0000', color: '#fff', border: 'none', borderRadius: 4,
              }}
            >
              Quitar
            </button>
          )}
        </div>
      ),
    });
    inspectorSections.push({
      title: 'Grilla',
      fields: [
        { label: 'H frames', type: 'number', value: sp.cols, min: 1, onChange: (v) => { updateSpriteSheet(sp.id, { cols: v as number }); setCurrentSpriteFrame(0); } },
        { label: 'V frames', type: 'number', value: sp.rows, min: 1, onChange: (v) => { updateSpriteSheet(sp.id, { rows: v as number }); setCurrentSpriteFrame(0); } },
        { label: 'Tile size', type: 'text', value: spriteImgSize ? `${Math.round(spriteImgSize.w / sp.cols)}×${Math.round(spriteImgSize.h / sp.rows)}` : `${sp.tileWidth}×${sp.tileHeight}`, onChange: () => {} },
        { label: 'Frame', type: 'number', value: currentSpriteFrame, min: 0, max: Math.max(0, totalSpriteFrames - 1), onChange: (v) => setCurrentSpriteFrame(v as number) },
      ],
    });
    inspectorSections.push({
      title: 'Previsualización',
      content: (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0',
        }}>
          <button onClick={() => {
            setIsPlaying(false);
            setCurrentSpriteFrame((p) => (p - 1 + totalSpriteFrames) % totalSpriteFrames);
          }} style={transportBtnStyle} title="Anterior"><SkipBackIcon size={13} /></button>
          <button onClick={() => {
            if (isPlaying) { setIsPlaying(false); return; }
            setCurrentFrameIdx(0);
            setCurrentSpriteFrame(0);
            setIsPlaying(true);
          }} style={{ ...transportBtnStyle, background: isPlaying ? 'var(--accent)' : 'var(--bg-raised)' }} title={isPlaying ? 'Detener' : 'Reproducir'}>
            {isPlaying ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
          </button>
          <button onClick={() => {
            setIsPlaying(false);
            setCurrentSpriteFrame((p) => (p + 1) % totalSpriteFrames);
          }} style={transportBtnStyle} title="Siguiente"><SkipForwardIcon size={13} /></button>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {currentSpriteFrame + 1}/{totalSpriteFrames}
          </span>
        </div>
      ),
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
      const curFrame = selectedAnim.frames[currentFrameIdx];
      inspectorSections.push({
        title: 'Frames',
        fields: [
          { label: 'Total', type: 'text', value: `${selectedAnim.frames.length} frames`, onChange: () => {} },
          { label: 'Frame actual', type: 'number', value: currentFrameIdx, min: 0, max: Math.max(0, selectedAnim.frames.length - 1), onChange: (v) => { setIsPlaying(false); setCurrentFrameIdx(v as number); } },
          ...(curFrame ? [{
            label: 'Sprite frame', type: 'number' as const,
            value: curFrame.tileIndex,
            min: 0, max: Math.max(0, (parentSprite ? parentSprite.cols * parentSprite.rows : 0) - 1),
            onChange: (v: string | number | boolean) => parentSprite && updateFrame(parentSprite.id, selectedAnim.id, currentFrameIdx, { tileIndex: v as number }),
          }] : []),
        ],
      });
    }
  }

  const handleRemove = (id: string) => {
    const isSprite = spriteSheets.some((sp) => sp.id === id);
    if (isSprite) {
      removeSpriteSheet(id);
      if (selectedNodeId === id) setSelectedNodeId('');
    } else {
      for (const sp of spriteSheets) {
        if (sp.animations.some((a) => a.id === id)) {
          removeAnimation(sp.id, id);
          break;
        }
      }
      if (previewAnimId === id) setPreviewAnimId(null);
    }
  };

  // ── Context menu handlers ─────────────────────────────────────────────
  function handleContextMenu(id: string, x: number, y: number) {
    setCtxMenu({ id, x, y });
  }

  function doRename(id: string) {
    const isSprite = spriteSheets.some((sp) => sp.id === id);
    const item = isSprite
      ? spriteSheets.find((sp) => sp.id === id)
      : spriteSheets.flatMap((sp) => sp.animations).find((a) => a.id === id);
    if (!item) return;
    const name = prompt('Nuevo nombre:', item.name);
    if (name && name.trim()) {
      if (isSprite) updateSpriteSheet(id, { name: name.trim() });
      else {
        const parent = spriteSheets.find((sp) => sp.animations.some((a) => a.id === id));
        if (parent) updateAnimation(parent.id, id, { name: name.trim() });
      }
    }
    setCtxMenu(null);
  }

  function doDelete(id: string) {
    handleRemove(id);
    setCtxMenu(null);
  }

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [ctxMenu]);

  const anim = previewAnim;

  return (
    <>
    <style>{`
      .sprite-frame-thumb:hover .sprite-frame-del { display: block !important; }
    `}</style>
    <ResizableEditorLayout
      leftWidth={hierarchyWidth}
      rightWidth={inspectorWidth}
      onLeftWidthChange={setHierarchyWidth}
      onRightWidthChange={setInspectorWidth}
      left={
        <HierarchyPanel
          sections={hierarchySections}
          selectedId={selectedNodeId}
          onSelect={handleHierarchySelect}
          onRemove={handleRemove}
          onContextMenu={handleContextMenu}
        />
      }
      center={
        <>
          {/* Canvas with zoom/pan */}
          <div
            ref={canvasContainerRef}
            style={{
              flex: 1, position: 'relative', overflow: 'hidden',
              cursor: isPanning ? 'grabbing' : 'grab',
              outline: dragOver ? '2px dashed var(--accent-light)' : 'none',
            }}
            onMouseDown={handleMouseDownCanvas}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {selectedSprite ? (() => {
              // Determine which tile index to display
              const tileIndex = anim && anim.frames[currentFrameIdx]
                ? anim.frames[currentFrameIdx].tileIndex
                : currentSpriteFrame;
              const tw = selectedSprite.tileWidth;
              const th = selectedSprite.tileHeight;
              const fullW = selectedSprite.cols * tw;
              const fullH = selectedSprite.rows * th;
              const tx = tileIndex % selectedSprite.cols;
              const ty = Math.floor(tileIndex / selectedSprite.cols);
              return (
              <div style={{
                transform: `translate(${panX}px, ${panY}px) scale(${zoomFactor})`,
                transformOrigin: '0 0',
                position: 'absolute', top: 0, left: 0,
                width: 0, height: 0,
              }}>
                <div
                  style={{
                    width: tw,
                    height: th,
                    background: tilesetUrl ? 'transparent' : 'var(--bg-dark)',
                    border: '1px solid var(--bg-raised)',
                    borderRadius: 2,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {tilesetUrl && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      backgroundImage: `url(${tilesetUrl})`,
                      backgroundPosition: `${-tx * tw}px ${-ty * th}px`,
                      backgroundSize: `${fullW}px ${fullH}px`,
                      backgroundRepeat: 'no-repeat',
                      imageRendering: imageSmoothing ? 'auto' : 'pixelated',
                      pointerEvents: 'none',
                    }} />
                  )}
                  <div style={{
                    position: 'absolute', inset: 0,
                    border: '2px solid var(--accent-light)',
                    pointerEvents: 'none',
                  }} />
                </div>
              </div>
              );
            })() : (
              <span style={{ color: 'var(--text-muted)', fontSize: 13, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', lineHeight: 1.6 }}>
                {dragOver ? 'Suelta la imagen aquí' : 'Selecciona un sprite o arrastra una imagen'}
              </span>
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

          {/* Frame grid (when sprite selected, no animation) */}
          {selectedSprite && !anim && (
            <div style={{
              height: 80,
              background: 'var(--bg-panel)',
              borderTop: '1px solid var(--border-color)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex', alignItems: 'center', gap: 3,
              padding: '4px 10px',
              overflowX: 'auto',
              flexShrink: 0,
            }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 10, whiteSpace: 'nowrap', marginRight: 4 }}>
                Frames ({totalSpriteFrames}):
              </span>
              <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                {Array.from({ length: totalSpriteFrames }, (_, i) => i).map((frameIdx) => (
                  <div
                    key={frameIdx}
                    onClick={() => { setIsPlaying(false); setCurrentSpriteFrame(frameIdx); }}
                    style={{
                      width: 32, height: 32,
                      background: currentSpriteFrame === frameIdx ? 'var(--accent)' : 'var(--bg-dark)',
                      border: `1px solid ${currentSpriteFrame === frameIdx ? 'var(--accent-light)' : 'var(--bg-raised)'}`,
                      borderRadius: 3,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: currentSpriteFrame === frameIdx ? '#fff' : 'var(--text-muted)',
                      fontSize: 9, fontWeight: currentSpriteFrame === frameIdx ? 700 : 400,
                      cursor: 'pointer', flexShrink: 0,
                    }}
                    title={`Frame ${frameIdx}`}
                  >
                    {frameIdx}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom frames bar */}
          {anim && (
            <div style={{
              background: 'var(--bg-panel)',
              borderTop: '1px solid var(--border-color)',
              display: 'flex', flexDirection: 'column',
              flexShrink: 0,
            }}>
              {/* Transport controls */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                padding: '4px 12px',
                borderBottom: '1px solid var(--border-color)',
              }}>
                <button onClick={() => { setIsPlaying(false); setCurrentFrameIdx((p) => Math.max(0, p - 1)); }} style={transportBtnStyle} title="Frame anterior"><SkipBackIcon size={13} /></button>
                <button onClick={() => {
                  if (isPlaying) { setIsPlaying(false); }
                  else { setCurrentFrameIdx(0); setIsPlaying(true); }
                }} style={{ ...transportBtnStyle, background: isPlaying ? 'var(--accent)' : 'var(--bg-raised)' }} title={isPlaying ? 'Detener' : 'Reproducir'}>
                  {isPlaying ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
                </button>
                <button onClick={() => { setIsPlaying(false); setCurrentFrameIdx((p) => Math.min(anim.frames.length - 1, p + 1)); }} style={transportBtnStyle} title="Frame siguiente"><SkipForwardIcon size={13} /></button>

                <div style={{ width: 1, height: 16, background: 'var(--bg-raised)', margin: '0 6px' }} />

                <button onClick={() => setOnionSkin((p) => !p)}
                  style={{ ...transportBtnStyle, background: onionSkin ? 'var(--accent)' : 'var(--bg-raised)' }}
                  title="Papel cebolla"><OnionSkinIcon size={13} /></button>
                <button onClick={() => setShowGrid((p) => !p)}
                  style={{ ...transportBtnStyle, background: showGrid ? 'var(--accent)' : 'var(--bg-raised)' }}
                  title="Mostrar cuadrícula"><GridIcon size={13} /></button>

                <span style={{ color: 'var(--text-dim)', fontSize: 10, marginLeft: 8 }}>
                  {Math.min(currentFrameIdx + 1, anim.frames.length)}/{anim.frames.length}
                </span>
              </div>

              {/* Frame thumbnails */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 12px', overflowX: 'auto',
              }}>
                {anim.frames.map((f, i) => (
                  <div
                    key={i}
                    className="sprite-frame-thumb"
                    onClick={() => { setIsPlaying(false); setCurrentFrameIdx(i); }}
                    style={{
                      width: 44, height: 44,
                      background: i === currentFrameIdx ? 'var(--accent-dark)' : 'var(--bg-dark)',
                      border: i === currentFrameIdx ? '1px solid var(--accent-light)' : '1px solid var(--bg-raised)',
                      borderRadius: 4, cursor: 'pointer',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, fontSize: 9, color: i === currentFrameIdx ? 'var(--accent-lighter)' : 'var(--text-muted)',
                      position: 'relative',
                    }}
                    title={`Frame ${i + 1}`}
                  >
                    <span>{f.tileIndex}</span>
                    <span style={{ fontSize: 8, color: i === currentFrameIdx ? 'var(--accent-light)' : '#666' }}>{f.duration}ms</span>
                    <span
                      onClick={(e) => { e.stopPropagation(); parentSprite && removeFrame(parentSprite.id, anim.id, i); }}
                      className="sprite-frame-del"
                      style={{
                        position: 'absolute', top: -4, right: -4,
                        width: 14, height: 14, borderRadius: '50%',
                        background: '#8b0000', color: '#fff',
                        fontSize: 9, lineHeight: '14px', textAlign: 'center',
                        cursor: 'pointer', display: 'none',
                      }}
                    >✕</span>
                  </div>
                ))}
                <button
                  onClick={() => { parentSprite && addFrame(parentSprite.id, anim.id); }}
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
            </div>
          )}
        </>
      }
      right={
        <InspectorPanel
          title="Inspector"
          sections={inspectorSections}
          emptyMessage="Selecciona un sprite"
        />
      }
    >
    </ResizableEditorLayout>

      {/* Context menu */}
      {ctxMenu && (
        <div style={{
          position: 'fixed', zIndex: 99999,
          left: ctxMenu.x, top: ctxMenu.y,
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-color)',
          borderRadius: 6,
          padding: '4px 0',
          minWidth: 140,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          <div onClick={() => doRename(ctxMenu.id)} style={ctxItemStyle}>
            <PencilIcon size={13} /> Renombrar
          </div>
          <div onClick={() => doDelete(ctxMenu.id)} style={{ ...ctxItemStyle, color: '#f87171' }}>
            <TrashIcon size={13} /> Eliminar
          </div>
        </div>
      )}
    </>
  );
}

const ctxItemStyle: React.CSSProperties = {
  padding: '6px 14px',
  fontSize: 12,
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};
// ── Iconos SVG ─────────────────────────────────────────────────────────
function PlayIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}
function PauseIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}
function SkipBackIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="19 3 11 12 19 21 19 3" />
      <rect x="5" y="4" width="3" height="16" rx="1" />
    </svg>
  );
}
function SkipForwardIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="5 3 13 12 5 21 5 3" />
      <rect x="16" y="4" width="3" height="16" rx="1" />
    </svg>
  );
}
function SkipStartIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="17 4 9 12 17 20 17 4" />
      <rect x="6" y="4" width="2" height="16" rx="1" />
    </svg>
  );
}
function SkipEndIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="7 4 15 12 7 20 7 4" />
      <rect x="16" y="4" width="2" height="16" rx="1" />
    </svg>
  );
}
function ChevronLeftIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
function ChevronRightIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
function OnionSkinIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" opacity="0.4" />
      <rect x="6" y="6" width="12" height="12" rx="1.5" opacity="0.7" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  );
}
function GridIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  );
}
function PencilIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}
function TrashIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

const zoomBtnStyle: React.CSSProperties = {
  background: 'var(--bg-raised)',
  border: 'none', borderRadius: 3,
  color: 'var(--text-secondary)', fontSize: 13,
  width: 22, height: 20, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const transportBtnStyle: React.CSSProperties = {
  background: 'var(--bg-raised)',
  border: 'none', borderRadius: 3,
  color: 'var(--text-secondary)', fontSize: 11,
  width: 24, height: 22, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  lineHeight: 1,
};
