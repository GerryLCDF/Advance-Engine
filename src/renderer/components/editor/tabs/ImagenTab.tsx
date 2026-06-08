import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { HierarchyPanel, type HierarchySection } from '../HierarchyPanel';
import { InspectorPanel, type InspectorSection, type InspectorField } from '../InspectorPanel';
import { ResizableEditorLayout } from '../ResizableEditorLayout';
import type { AnimationLoop } from '../../../types/editor';

const PREVIEW_W = 320;
const PREVIEW_H = 200;
const SCREEN_W = 240;
const SCREEN_H = 160;

function imgBasename(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || '(sin nombre)';
}

export function ImagenTab() {
  const backgrounds = useAppStore((s) => s.backgrounds);
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useAppStore((s) => s.setSelectedNodeId);
  const removeBackground = useAppStore((s) => s.removeBackground);
  const updateBackground = useAppStore((s) => s.updateBackground);
  const addLayer = useAppStore((s) => s.addLayer);
  const removeLayer = useAppStore((s) => s.removeLayer);
  const updateLayer = useAppStore((s) => s.updateLayer);
  const hierarchyWidth = useAppStore((s) => s.hierarchyWidth);
  const inspectorWidth = useAppStore((s) => s.inspectorWidth);
  const setHierarchyWidth = useAppStore((s) => s.setHierarchyWidth);
  const setInspectorWidth = useAppStore((s) => s.setInspectorWidth);
  const imagenZoom = useAppStore((s) => s.imagenZoom);
  const setImagenZoom = useAppStore((s) => s.setImagenZoom);
  const projectDir = useAppStore((s) => s.projectDir);
  const imageSmoothing = useAppStore((s) => s.imageSmoothing);

  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const hasMoved = useRef(false);
  const [imageDataUrls, setImageDataUrls] = useState<Record<string, string>>({});
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const directionRef = useRef(1);

  const frameCols = imgSize && imgSize.w % SCREEN_W === 0 ? Math.round(imgSize.w / SCREEN_W) : 0;
  const frameRows = imgSize && imgSize.h % SCREEN_H === 0 ? Math.round(imgSize.h / SCREEN_H) : 0;
  const canAnimate = imgSize !== null && frameCols > 0 && frameRows > 0 && (frameCols > 1 || frameRows > 1);

  const allLayers = backgrounds.flatMap((bg) => bg.layers);
  const selectedLayer = allLayers.find((l) => l.id === selectedNodeId);
  const parentBg = selectedLayer
    ? backgrounds.find((bg) => bg.layers.some((l) => l.id === selectedLayer.id))
    : null;

  const centerCanvas = useCallback(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    setPanX((cw - PREVIEW_W * imagenZoom) / 2);
    setPanY((ch - PREVIEW_H * imagenZoom) / 2);
  }, [imagenZoom]);

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
        const delta = -e.deltaY * 0.001;
        setImagenZoom(Math.min(4, Math.max(0.25, +(imagenZoom + delta).toFixed(2))));
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
  }, [imagenZoom, setImagenZoom]);

  // Load images for all layers and clean up removed ones
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const api = window.advanceAPI;
      if (!api) return;
      const activePaths = new Set<string>();
      backgrounds.forEach((bg) => bg.layers.forEach((l) => { if (l.imagePath) activePaths.add(l.imagePath); }));
      // Remove stale URLs (e.g. when a layer is deleted)
      setImageDataUrls((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (!activePaths.has(key)) delete next[key];
        }
        return next;
      });
      // Load current images
      const newUrls: Record<string, string> = {};
      for (const p of activePaths) {
        const r = await api.file.readImage(p);
        if (!cancelled && r.success && r.dataUrl) newUrls[p] = r.dataUrl;
      }
      if (!cancelled && Object.keys(newUrls).length > 0) setImageDataUrls((prev) => ({ ...prev, ...newUrls }));
    })();
    return () => { cancelled = true; };
  }, [backgrounds]);

  // Detectar dimensiones de la imagen seleccionada
  useEffect(() => {
    if (!selectedLayer?.imagePath) { setImgSize(null); return; }
    const url = imageDataUrls[selectedLayer.imagePath];
    if (!url) { setImgSize(null); return; }
    const img = new Image();
    let cancelled = false;
    img.onload = () => { if (!cancelled) setImgSize({ w: img.naturalWidth, h: img.naturalHeight }); };
    img.onerror = () => { if (!cancelled) setImgSize(null); };
    img.src = url;
    return () => { cancelled = true; img.src = ''; };
  }, [selectedNodeId, imageDataUrls, backgrounds]);

  // Reset frame al cambiar de capa o imagen
  useEffect(() => {
    setCurrentFrame(0);
    directionRef.current = 1;
  }, [selectedNodeId, selectedLayer?.imagePath]);

  // Timer de animación
  useEffect(() => {
    if (!selectedLayer?.animated || !selectedLayer.animationFramesX || !selectedLayer.animationFramesY) return;
    const totalFrames = selectedLayer.animationFramesX * selectedLayer.animationFramesY;
    const speed = selectedLayer.animationSpeed ?? 5;
    const loop = selectedLayer.animationLoop || 'loop';
    const ms = Math.max(50, Math.round(500 / speed));
    const timer = setInterval(() => {
      setCurrentFrame((prev) => {
        if (loop === 'loop') return (prev + 1) % totalFrames;
        if (loop === 'once') return prev < totalFrames - 1 ? prev + 1 : totalFrames - 1;
        if (loop === 'pingpong') {
          const next = prev + directionRef.current;
          if (next >= totalFrames || next < 0) { directionRef.current *= -1; return prev + directionRef.current; }
          return next;
        }
        let r: number;
        do { r = Math.floor(Math.random() * totalFrames); } while (r === prev && totalFrames > 1);
        return r;
      });
    }, ms);
    return () => clearInterval(timer);
  }, [selectedLayer?.animated, selectedLayer?.animationSpeed, selectedLayer?.animationLoop, selectedLayer?.animationFramesX, selectedLayer?.animationFramesY]);

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

  // Auto-create Assets background if none exists
  const ensureAssetsBg = useCallback(() => {
    const st = useAppStore.getState();
    if (st.backgrounds.length === 0) {
      st.addBackground();
      const newBg = useAppStore.getState().backgrounds[0];
      if (newBg) st.updateBackground(newBg.id, { name: 'Assets' });
    }
  }, []);

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
    const pd = st.projectDir;

    // Find or create target layer
    let targetBgId: string;
    let targetLayerId: string | null = null;

    if (selectedLayer && parentBg && !selectedLayer.imagePath) {
      targetBgId = parentBg.id;
      targetLayerId = selectedLayer.id;
    } else {
      // Ensure a background exists
      if (!st.backgrounds[0]) {
        st.addBackground();
        const nb = useAppStore.getState().backgrounds[0];
        if (nb) st.updateBackground(nb.id, { name: 'Assets' });
      }
      const bg = useAppStore.getState().backgrounds[0];
      if (!bg) return;
      targetBgId = bg.id;
      addLayer(targetBgId);
      const updatedBg = useAppStore.getState().backgrounds.find((b) => b.id === targetBgId);
      const newLayers = updatedBg?.layers ?? [];
      const lastLayer = newLayers[newLayers.length - 1];
      if (lastLayer) targetLayerId = lastLayer.id;
    }

    const destPath = pd ? `${pd}/backgrounds/${file.name}` : filePath;
    if (pd) {
      await api.dir.create(`${pd}/backgrounds`);
      await api.file.copy(filePath, destPath);
      try {
        const bitmapPath = destPath.replace(/\.\w+$/, '.gba.raw');
        await api.file.convertImageToGbaBitmap(destPath, bitmapPath);
      } catch {
        // Error en conversión GBA no debe bloquear la importación
      }
    }

    if (targetLayerId) {
      updateLayer(targetBgId, targetLayerId, { imagePath: destPath });
    }
    setImageDataUrls((prev) => ({ ...prev, [destPath]: result.dataUrl! }));
    if (!selectedLayer && targetLayerId) setSelectedNodeId(targetLayerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLayer, parentBg, projectDir]);

  // Flat hierarchy — layers only, no background nesting
  const hierarchySections: HierarchySection[] = [
    {
      id: 'bgs',
      title: 'Imágenes',
      items: allLayers.map((l) => ({
        id: l.id,
        label: l.imagePath ? imgBasename(l.imagePath) : '(sin imagen)',
        icon: l.visible ? '👁' : '👁‍🗨',
        subtitle: l.imagePath ? '' : 'vacío',
      })),
    },
  ];

  const inspectorSections: InspectorSection[] = [];

  if (selectedLayer) {
    const fields: InspectorField[] = [
      { label: 'Visible', type: 'toggle', value: selectedLayer.visible, onChange: (v) => parentBg && updateLayer(parentBg.id, selectedLayer.id, { visible: v as boolean }) },
      { label: 'Parallax X', type: 'number', value: selectedLayer.parallaxX, onChange: (v) => parentBg && updateLayer(parentBg.id, selectedLayer.id, { parallaxX: v as number }) },
      { label: 'Parallax Y', type: 'number', value: selectedLayer.parallaxY, onChange: (v) => parentBg && updateLayer(parentBg.id, selectedLayer.id, { parallaxY: v as number }) },
      { label: 'Velocidad', type: 'number', value: selectedLayer.speed, onChange: (v) => parentBg && updateLayer(parentBg.id, selectedLayer.id, { speed: v as number }) },
      { label: 'Ruta', type: 'text', value: selectedLayer.imagePath, onChange: (v) => parentBg && updateLayer(parentBg.id, selectedLayer.id, { imagePath: v as string }) },
    ];
    if (selectedLayer.imagePath) {
      fields.push({ label: 'Reescalar', type: 'toggle', value: !!selectedLayer.rescale, onChange: (v) => parentBg && updateLayer(parentBg.id, selectedLayer.id, { rescale: v as boolean }) });
      if (imgSize) {
        fields.push({ label: 'Resolución', type: 'text', value: `${imgSize.w} × ${imgSize.h} px`, readonly: true, onChange: () => {} });
      }
    }
    if (canAnimate) {
      fields.push({ label: 'Animación', type: 'toggle', value: !!selectedLayer.animated, onChange: (v) => parentBg && updateLayer(parentBg.id, selectedLayer.id, { animated: v as boolean, animationSpeed: v ? (selectedLayer.animationSpeed || 5) : undefined, animationFramesX: v ? frameCols : undefined, animationFramesY: v ? frameRows : undefined, animationLoop: v ? (selectedLayer.animationLoop || 'loop') : undefined }) });
    }
    if (selectedLayer.animated) {
      fields.push({ label: 'Vel. animación', type: 'number', value: selectedLayer.animationSpeed ?? 5, onChange: (v) => parentBg && updateLayer(parentBg.id, selectedLayer.id, { animationSpeed: v as number }) });
    }
    if (imgSize && (imgSize.w < 240 || imgSize.h < 160)) {
      fields.push({ label: 'Fondo', type: 'color', value: selectedLayer.fillColor || '#000000', onChange: (v) => parentBg && updateLayer(parentBg.id, selectedLayer.id, { fillColor: v as string }) });
    }
    inspectorSections.push({
      title: 'Capa',
      fields,
    });
  }

  const handleRemove = async (id: string) => {
    const api = window.advanceAPI;
    for (const bg of backgrounds) {
      const layer = bg.layers.find((l) => l.id === id);
      if (layer) {
        if (layer.imagePath && api) {
          await api.file.delete(layer.imagePath);
        }
        removeLayer(bg.id, id);
        break;
      }
    }
    if (selectedNodeId === id) setSelectedNodeId('');
  };

  const previewLayers = selectedLayer
    ? [selectedLayer]
    : backgrounds.length > 0
      ? backgrounds[0].layers
      : [];

  // Dynamic preview size: when rescale=false and image known, match image dimensions
  const singleLayer = selectedLayer;
  const useActualSize = singleLayer && !singleLayer.rescale && imgSize && singleLayer.imagePath;
  const isAnimated = singleLayer?.animated && singleLayer.animationFramesX && singleLayer.animationFramesY;
  const previewW = isAnimated ? SCREEN_W : (useActualSize ? imgSize!.w : PREVIEW_W);
  const previewH = isAnimated ? SCREEN_H : (useActualSize ? imgSize!.h : PREVIEW_H);

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
          <div
            ref={canvasContainerRef}
            style={{
              flex: 1, position: 'relative', overflow: 'hidden',
              cursor: isPanning ? 'grabbing' : 'grab',
              outline: dragOver ? '2px dashed var(--accent-light)' : 'none',
              outlineOffset: -2,
            }}
            onMouseDown={handleMouseDownCanvas}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {previewLayers.length > 0 ? (
              <div style={{
                transform: `translate(${panX}px, ${panY}px) scale(${imagenZoom})`,
                transformOrigin: '0 0',
                position: 'absolute', top: 0, left: 0,
                width: 0, height: 0,
              }}>
                <div
                  style={{
                    width: previewW,
                    height: previewH,
                    background: 'var(--bg-dark)',
                    border: '1px solid var(--bg-raised)',
                    borderRadius: 4,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {[...previewLayers].reverse().map((l, i) => (
                    <div
                      key={l.id}
                      style={{
                        position: 'absolute', inset: 0,
                        background: l.fillColor
                          ? l.fillColor
                          : l.visible
                            ? `linear-gradient(135deg, hsl(${(i * 60 + 200) % 360}, 30%, 25%), hsl(${(i * 60 + 260) % 360}, 30%, 15%))`
                            : 'transparent',
                        opacity: l.visible ? 1 : 0.15,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#ffffff66', fontSize: 9,
                        borderBottom: '1px dashed #ffffff22',
                      }}
                    >
                      {imageDataUrls[l.imagePath] ? (
                        l.animated && l.animationFramesX && l.animationFramesY ? (
                          <div style={{
                            width: SCREEN_W,
                            height: SCREEN_H,
                            overflow: 'hidden',
                            position: 'relative',
                            flexShrink: 0,
                          }}>
                            <img src={imageDataUrls[l.imagePath]} alt=""
                              style={{
                                position: 'absolute',
                                left: -(currentFrame % l.animationFramesX) * SCREEN_W,
                                top: -Math.floor(currentFrame / l.animationFramesX) * SCREEN_H,
                                width: imgSize?.w ?? l.animationFramesX * SCREEN_W,
                                height: imgSize?.h ?? l.animationFramesY * SCREEN_H,
                                maxWidth: 'none',
                                imageRendering: imageSmoothing ? 'auto' : 'pixelated',
                              }}
                            />
                          </div>
                        ) : (
                          <img src={imageDataUrls[l.imagePath]} alt=""
                            style={{
                              maxWidth: useActualSize && l.id === singleLayer?.id ? 'none' : '100%',
                              maxHeight: useActualSize && l.id === singleLayer?.id ? 'none' : '100%',
                              width: useActualSize && l.id === singleLayer?.id ? imgSize!.w : undefined,
                              height: useActualSize && l.id === singleLayer?.id ? imgSize!.h : undefined,
                              objectFit: useActualSize && l.id === singleLayer?.id ? 'none' : 'contain',
                              imageRendering: imageSmoothing ? 'auto' : 'pixelated',
                            }}
                          />
                        )
                      ) : l.imagePath ? (
                        `📄 ${imgBasename(l.imagePath)}`
                      ) : `Capa ${i + 1}`}
                      {l.parallaxX !== 1 || l.parallaxY !== 1 ? ` [p:${l.parallaxX},${l.parallaxY}]` : ''}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 8,
                color: 'var(--text-muted)', fontSize: 13,
              }}>
                <span style={{ fontSize: 32, opacity: 0.5 }}>🖼</span>
                <span>Arrastra una imagen aquí</span>
              </div>
            )}

            {/* Zoom controls */}
            <div style={{
              position: 'absolute', top: 8, right: 8,
              display: 'flex', alignItems: 'center', gap: 2,
              background: 'var(--bg-panel)', borderRadius: 6,
              padding: '3px 6px', border: '1px solid var(--bg-raised)',
              zIndex: 10,
            }}>
              <button onClick={() => setImagenZoom(Math.max(0.25, +(imagenZoom - 0.1).toFixed(2)))} style={zoomBtnStyle}>−</button>
              <span style={{ color: 'var(--text-secondary)', fontSize: 11, minWidth: 36, textAlign: 'center' }}>{Math.round(imagenZoom * 100)}%</span>
              <button onClick={() => setImagenZoom(Math.min(4, +(imagenZoom + 0.1).toFixed(2)))} style={zoomBtnStyle}>+</button>
            </div>

            <div style={{
              position: 'absolute', bottom: 8, right: 8,
              background: '#2d2d33cc', borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11, color: '#aaa',
              pointerEvents: 'none', zIndex: 10,
            }}>
              {Math.round(imagenZoom * 100)}%
            </div>
          </div>

          {/* Bottom: Animation controls (only when selected layer has animation enabled) */}
          {selectedLayer?.animated && parentBg && (
            <div style={{
              height: 56,
              background: 'var(--bg-panel)',
              borderTop: '1px solid var(--border-color)',
              display: 'flex', alignItems: 'center', gap: 20,
              padding: '0 16px',
              flexShrink: 0,
            }}>
              <span style={{ color: 'var(--accent-lighter)', fontSize: 11, fontWeight: 600 }}>
                Animación ({selectedLayer.animationFramesX ?? frameCols}x{selectedLayer.animationFramesY ?? frameRows} frames)
              </span>
              <label style={{ color: '#aaa', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                Velocidad:
                <input type="range" min={1} max={10}
                  value={selectedLayer.animationSpeed ?? 5}
                  onChange={(e) => updateLayer(parentBg.id, selectedLayer.id, { animationSpeed: Number(e.target.value) })}
                  style={{ width: 80, accentColor: 'var(--accent)' }} />
                <span style={{ color: 'var(--text-muted)', fontSize: 10, minWidth: 14 }}>{selectedLayer.animationSpeed ?? 5}</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {(['loop', 'once', 'pingpong', 'random'] as AnimationLoop[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => updateLayer(parentBg.id, selectedLayer.id, { animationLoop: mode })}
                    style={{
                      background: (selectedLayer.animationLoop || 'loop') === mode ? 'var(--accent)' : 'var(--bg-raised)',
                      border: 'none', borderRadius: 4,
                      color: (selectedLayer.animationLoop || 'loop') === mode ? '#fff' : 'var(--text-secondary)',
                      fontSize: 10, padding: '3px 8px',
                      cursor: 'pointer', fontWeight: (selectedLayer.animationLoop || 'loop') === mode ? 600 : 400,
                    }}
                  >
                    {mode === 'loop' ? 'Repetición' : mode === 'once' ? 'Una vez' : mode === 'pingpong' ? 'Ping-pong' : 'Aleatorio'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      }
      right={
        <InspectorPanel
          title="Inspector"
          sections={inspectorSections}
          emptyMessage="Selecciona una imagen"
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
