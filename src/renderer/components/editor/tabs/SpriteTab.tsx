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
  const previewAnimId = useAppStore((s) => s.previewAnimId);
  const setPreviewAnimId = useAppStore((s) => s.setPreviewAnimId);
  const currentFrameIdx = useAppStore((s) => s.currentFrameIdx);
  const setCurrentFrameIdx = useAppStore((s) => s.setCurrentFrameIdx);
  const [isPlaying, setIsPlaying] = useState(false);
  // 0=off, 1=prev (rojo), 2=next (azul), 3=both
  const [onionSkinMode, setOnionSkinMode] = useState(0);
  const [showGrid, setShowGrid] = useState(true);

  // ── Skip frames modal ──────────────────────────────────────────────────
  const [showSkipModal, setShowSkipModal] = useState(false);

  // ── Tile picker for animation frames ──────────────────────────────────
  const [pickingTileForFrame, setPickingTileForFrame] = useState<number | null>(null);
  const [pickerSelectedTiles, setPickerSelectedTiles] = useState<number[]>([]);
  // Reset multi-selection when picker opens/closes
  useEffect(() => {
    if (pickingTileForFrame === null) setPickerSelectedTiles([]);
  }, [pickingTileForFrame]);

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

  // Clamp currentFrameIdx when frames are removed
  useEffect(() => {
    const a = previewAnim;
    if (a && currentFrameIdx >= a.frames.length) {
      setCurrentFrameIdx(Math.max(0, a.frames.length - 1));
    }
  }, [previewAnim?.frames.length, currentFrameIdx]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const ctrl = e.ctrlKey || e.metaKey;
      const a = previewAnim;
      const total = a ? a.frames.length : (selectedSprite ? selectedSprite.cols * selectedSprite.rows : 0);
      const s = useAppStore.getState();

      if (ctrl && e.key === 'z') { e.preventDefault(); s.spriteUndo(); return; }
      if (ctrl && e.key === 'y') { e.preventDefault(); s.spriteRedo(); return; }

      if (ctrl && e.key === 'x') {
        e.preventDefault();
        if (a && previewAnimId && selectedSprite) {
          if (a.frames.length > 0) { s.cutFrame(selectedSprite.id, previewAnimId, currentFrameIdx); }
          else { s.cutAnimation(selectedSprite.id, previewAnimId); }
        }
        return;
      }
      if (ctrl && e.key === 'c') {
        e.preventDefault();
        if (a && previewAnimId && selectedSprite) {
          if (a.frames.length > 0) { s.copyFrame(selectedSprite.id, previewAnimId, currentFrameIdx); }
          else { s.copyAnimation(selectedSprite.id, previewAnimId); }
        }
        return;
      }
      if (ctrl && e.key === 'v') {
        e.preventDefault();
        if (previewAnimId && selectedSprite) {
          if (s.pasteAnimation) s.pasteAnimation(selectedSprite.id);
        }
        return;
      }
      if (e.key === 'Delete' || e.key === 'Del') {
        e.preventDefault();
        if (a && previewAnimId && selectedSprite) {
          if (currentFrameIdx >= 0 && currentFrameIdx < a.frames.length) {
            s.deleteFrame(selectedSprite.id, previewAnimId, currentFrameIdx);
          }
        }
        return;
      }

      if ((!a || a.frames.length === 0) && total === 0) return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (isPlaying) { setIsPlaying(false); return; }
          if (a) { setCurrentFrameIdx(0); setIsPlaying(true); }
          else { setCurrentSpriteFrame(0); setIsPlaying(true); }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (isPlaying) setIsPlaying(false);
          if (a && a.frames.length > 0) {
            setCurrentFrameIdx((currentFrameIdx - 1 + a.frames.length) % a.frames.length);
          } else if (total > 0) {
            setCurrentSpriteFrame((currentSpriteFrame - 1 + total) % total);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (isPlaying) setIsPlaying(false);
          if (a && a.frames.length > 0) {
            setCurrentFrameIdx((currentFrameIdx + 1) % a.frames.length);
          } else if (total > 0) {
            setCurrentSpriteFrame((currentSpriteFrame + 1) % total);
          }
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [previewAnim, previewAnimId, isPlaying, selectedSprite, currentFrameIdx]);

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

  // Calculate tile size ONCE from image dimensions (not when H/V changes)
  useEffect(() => {
    if (!spriteImgSize) return;
    const sp = spriteSheets.find((s) => s.id === selectedNodeId);
    if (!sp) return;
    const tileW = Math.floor(spriteImgSize.w / sp.cols);
    const tileH = Math.floor(spriteImgSize.h / sp.rows);
    if (tileW > 0 && tileH > 0 && (tileW !== sp.tileWidth || tileH !== sp.tileHeight)) {
      updateSpriteSheet(sp.id, { tileWidth: tileW, tileHeight: tileH });
    }
  }, [spriteImgSize]);

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
        setSpriteZoom(Math.min(1500, Math.max(25, spriteZoom + delta)));
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
  const playDirRef = useRef(1); // 1 = forward, -1 = backward (pingpong)
  useEffect(() => {
    if (!isPlaying) return;
    if (previewAnim && previewAnim.frames.length > 0) {
      const rawDur = previewAnim.frames[currentFrameIdx]?.duration ?? 100;
      const speed = previewAnim.speed || 1;
      const dur = Math.max(16, rawDur / speed);
      const animId = previewAnim.id;
      const id = window.setTimeout(() => {
        const state = useAppStore.getState();
        const prev = state.currentFrameIdx;
        const freshAnim = state.spriteSheets
          .flatMap((s) => s.animations)
          .find((a) => a.id === animId);
        if (!freshAnim || freshAnim.frames.length === 0) return;
        const len = freshAnim.frames.length;
        const mode = freshAnim.mode || 'loop';
        if (mode === 'once') {
          const next = prev + 1;
          if (next >= len) { setIsPlaying(false); return; }
          state.setCurrentFrameIdx(next);
        } else if (mode === 'loop') {
          state.setCurrentFrameIdx((prev + 1) % len);
        } else {
          // pingpong
          const dir = playDirRef.current;
          const next = prev + dir;
          if (next >= len) { playDirRef.current = -1; state.setCurrentFrameIdx(len - 2); }
          else if (next < 0) { playDirRef.current = 1; state.setCurrentFrameIdx(1); }
          else { state.setCurrentFrameIdx(next); }
        }
      }, dur);
      return () => window.clearTimeout(id);
    }
    if (!previewAnim && selectedSprite && totalSpriteFrames > 0) {
      const skipped = selectedSprite.skippedFrames ?? [];
      const nonSkipped = Array.from({ length: totalSpriteFrames }, (_, i) => i).filter((i) => !skipped.includes(i));
      if (nonSkipped.length === 0) return;
      const id = window.setTimeout(() => {
        setCurrentSpriteFrame((prev) => {
          const curIdx = nonSkipped.indexOf(prev);
          return nonSkipped[(curIdx + 1) % nonSkipped.length];
        });
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
        { label: 'Frame', type: 'number', value: currentSpriteFrame, min: 0, max: Math.max(0, totalSpriteFrames - 1), onChange: (v) => {
          const val = v as number;
          if ((sp.skippedFrames ?? []).includes(val)) {
            const candidates = Array.from({ length: totalSpriteFrames }, (_, i) => i).filter((i) => !(sp.skippedFrames ?? []).includes(i));
            if (candidates.length > 0) setCurrentSpriteFrame(candidates.reduce((a, b) => Math.abs(b - val) < Math.abs(a - val) ? b : a));
          } else {
            setCurrentSpriteFrame(val);
          }
        } },
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
        { label: 'Modo', type: 'select', value: selectedAnim.mode, options: [{ value: 'once', label: 'Una vez' }, { value: 'loop', label: 'Loop' }, { value: 'pingpong', label: 'Ping pong' }], onChange: (v) => parentSprite && updateAnimation(parentSprite.id, selectedAnim.id, { mode: v as 'once' | 'loop' | 'pingpong' }) },
        { label: 'Velocidad', type: 'number', value: selectedAnim.speed, min: 0.25, max: 4, step: 0.25, onChange: (v) => parentSprite && updateAnimation(parentSprite.id, selectedAnim.id, { speed: Math.max(0.25, Math.min(4, v as number)) }) },
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
            onChange: (v: string | number | boolean) => {
              if (!parentSprite) return;
              const idx = v as number;
              const skipped = parentSprite.skippedFrames ?? [];
              const total = parentSprite.cols * parentSprite.rows;
              if (!skipped.includes(idx)) {
                updateFrame(parentSprite.id, selectedAnim.id, currentFrameIdx, { tileIndex: idx });
              } else {
                // advance in the direction the user was going
                const cur = curFrame.tileIndex;
                const dir = idx > cur ? 1 : -1;
                let candidate = cur;
                for (let offset = 1; offset < total; offset++) {
                  const next = idx + dir * offset;
                  if (next >= 0 && next < total && !skipped.includes(next)) { candidate = next; break; }
                }
                updateFrame(parentSprite.id, selectedAnim.id, currentFrameIdx, { tileIndex: candidate });
              }
            },
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

  // ── Auto-detect empty frames from tileset image ──────────────────────
  const autoDetectEmpty = useCallback(async () => {
    if (!selectedSprite || !tilesetUrl) return;
    const img = new Image();
    img.src = tilesetUrl;
    await img.decode();
    const tw = selectedSprite.tileWidth;
    const th = selectedSprite.tileHeight;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    const empty: number[] = [];
    for (let row = 0; row < selectedSprite.rows; row++) {
      for (let col = 0; col < selectedSprite.cols; col++) {
        const x = col * tw;
        const y = row * th;
        const data = ctx.getImageData(x, y, tw, th).data;
        let hasPixel = false;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] > 0) { hasPixel = true; break; }
        }
        if (!hasPixel) empty.push(row * selectedSprite.cols + col);
      }
    }
    updateSpriteSheet(selectedSprite.id, { skippedFrames: empty });
  }, [selectedSprite, tilesetUrl]);

  const toggleSkipped = useCallback((tileIdx: number) => {
    if (!selectedSprite) return;
    const current = selectedSprite.skippedFrames || [];
    const next = current.includes(tileIdx)
      ? current.filter((f) => f !== tileIdx)
      : [...current, tileIdx];
    updateSpriteSheet(selectedSprite.id, { skippedFrames: next });
    if (previewAnim && previewAnim.frames[currentFrameIdx]?.tileIndex === tileIdx) {
      setIsPlaying(false);
    }
  }, [selectedSprite, previewAnim, currentFrameIdx]);

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
              const sp = selectedSprite;
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

              // Onion skin: resolve prev/next tile indices
              let onPrevTile: number | null = null;
              let onNextTile: number | null = null;
              if (onionSkinMode > 0 && anim && anim.frames.length > 1) {
                const wraps = anim.mode !== 'once';
                if (onionSkinMode === 1 || onionSkinMode === 3) {
                  const prevIdx = currentFrameIdx > 0 ? currentFrameIdx - 1 : (wraps ? anim.frames.length - 1 : null);
                  if (prevIdx !== null) onPrevTile = anim.frames[prevIdx].tileIndex;
                }
                if (onionSkinMode === 2 || onionSkinMode === 3) {
                  const nextIdx = currentFrameIdx < anim.frames.length - 1 ? currentFrameIdx + 1 : (wraps ? 0 : null);
                  if (nextIdx !== null) onNextTile = anim.frames[nextIdx].tileIndex;
                }
              }

              function onionTileDiv(tileIdx: number, tint: string) {
                const otx = tileIdx % sp.cols;
                const oty = Math.floor(tileIdx / sp.cols);
                const maskPos = `${-otx * tw}px ${-oty * th}px`;
                const maskSize = `${fullW}px ${fullH}px`;
                return (
                  <div style={{
                    position: 'absolute', left: 0, top: 0,
                    width: tw, height: th,
                    opacity: 0.4,
                    pointerEvents: 'none',
                    background: tint,
                    maskImage: `url(${tilesetUrl})`,
                    maskPosition: maskPos,
                    maskSize: maskSize,
                    maskRepeat: 'no-repeat',
                    WebkitMaskImage: `url(${tilesetUrl})`,
                    WebkitMaskPosition: maskPos,
                    WebkitMaskSize: maskSize,
                    WebkitMaskRepeat: 'no-repeat',
                  }} />
                );
              }

              return (
              <div style={{
                transform: `translate(${panX}px, ${panY}px) scale(${zoomFactor})`,
                transformOrigin: '0 0',
                position: 'absolute', top: 0, left: 0,
                width: 0, height: 0,
              }}>
                {/* Onion skin layers */}
                {onionSkinMode > 0 && tilesetUrl && onPrevTile !== null && onionTileDiv(onPrevTile, '#ff3333')}
                {onionSkinMode > 0 && tilesetUrl && onNextTile !== null && onionTileDiv(onNextTile, '#3388ff')}
                <div
                  style={{
                    width: tw,
                    height: th,
                    background: tilesetUrl ? 'transparent' : 'var(--bg-dark)',
                    border: '1px solid var(--bg-raised)',
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
                  {/* Pixel grid overlay */}
                  {showGrid && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      pointerEvents: 'none',
                      opacity: 0.3,
                      backgroundImage: `
                        linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)
                      `,
                      backgroundSize: '1px 1px',
                    }} />
                  )}
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
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'var(--bg-panel)', borderRadius: 6,
              padding: '3px 6px', border: '1px solid var(--bg-raised)',
              zIndex: 10,
            }}>
              <button onClick={() => setSpriteZoom(Math.max(25, spriteZoom - 10))} style={zoomBtnStyle}>−</button>
              <span style={{ color: 'var(--text-secondary)', fontSize: 11, minWidth: 32, textAlign: 'center' }}>{spriteZoom}%</span>
              <button onClick={() => setSpriteZoom(Math.min(1500, spriteZoom + 10))} style={zoomBtnStyle}>+</button>
            </div>

            <div style={{
              position: 'absolute', bottom: 8, right: 8,
              display: 'flex', alignItems: 'center', gap: 4,
              background: '#2d2d33cc', borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11, color: '#aaa',
              zIndex: 10,
            }}>
              {selectedSprite && (
                <button onClick={() => setShowSkipModal(true)} style={{
                  background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 3,
                  cursor: 'pointer', fontSize: 10, padding: '1px 6px', marginRight: 2,
                }} title="Saltar frames vacíos">Skip</button>
              )}
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
                {Array.from({ length: totalSpriteFrames }, (_, i) => i).map((frameIdx) => {
                  const isSkipped = selectedSprite?.skippedFrames?.includes(frameIdx) ?? false;
                  return (
                  <div
                    key={frameIdx}
                    onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); toggleSkipped(frameIdx); } }}
                    onClick={() => { if (!isSkipped) { setIsPlaying(false); setCurrentSpriteFrame(frameIdx); } }}
                    style={{
                      width: 32, height: 32,
                      background: currentSpriteFrame === frameIdx ? 'var(--accent)' : (isSkipped ? '#440000' : 'var(--bg-dark)'),
                      border: `1px solid ${isSkipped ? '#8b0000' : (currentSpriteFrame === frameIdx ? 'var(--accent-light)' : 'var(--bg-raised)')}`,
                      borderRadius: 3,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: currentSpriteFrame === frameIdx ? '#fff' : (isSkipped ? '#884444' : 'var(--text-muted)'),
                      fontSize: 9, fontWeight: currentSpriteFrame === frameIdx ? 700 : 400,
                      cursor: isSkipped ? 'not-allowed' : 'pointer', flexShrink: 0,
                    }}
                    title={`Frame ${frameIdx}${isSkipped ? ' (omitido)' : ''}`}
                  >
                    {frameIdx}
                  </div>
                  );
                })}
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
                <button onClick={() => { setIsPlaying(false); setCurrentFrameIdx(Math.max(0, currentFrameIdx - 1)); }} style={transportBtnStyle} title="Frame anterior"><SkipBackIcon size={13} /></button>
                <button onClick={() => {
                  if (isPlaying) { setIsPlaying(false); }
                  else { setCurrentFrameIdx(0); setIsPlaying(true); }
                }} style={{ ...transportBtnStyle, background: isPlaying ? 'var(--accent)' : 'var(--bg-raised)' }} title={isPlaying ? 'Detener' : 'Reproducir'}>
                  {isPlaying ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
                </button>
                <button onClick={() => { setIsPlaying(false); setCurrentFrameIdx(Math.min(anim.frames.length - 1, currentFrameIdx + 1)); }} style={transportBtnStyle} title="Frame siguiente"><SkipForwardIcon size={13} /></button>

                <div style={{ width: 1, height: 16, background: 'var(--bg-raised)', margin: '0 6px' }} />

                <button onClick={() => setOnionSkinMode((p) => (p + 1) % 4)}
                  style={{
                    ...transportBtnStyle,
                    background: onionSkinMode > 0 ? 'var(--accent)' : 'var(--bg-raised)',
                    color: onionSkinMode === 1 ? '#ff6666' : onionSkinMode === 2 ? '#66aaff' : onionSkinMode === 3 ? '#cc88ff' : undefined,
                  }}
                  title={['Papel cebolla: off', 'Papel cebolla: anterior', 'Papel cebolla: siguiente', 'Papel cebolla: ambos'][onionSkinMode]}
                ><OnionSkinIcon size={13} /></button>
                <button onClick={() => setShowGrid((p) => !p)}
                  style={{ ...transportBtnStyle, background: showGrid ? 'var(--accent)' : 'var(--bg-raised)' }}
                  title="Mostrar cuadrícula"><GridIcon size={13} /></button>

                <span style={{ color: 'var(--text-dim)', fontSize: 10, marginLeft: 8 }}>
                  {Math.min(currentFrameIdx + 1, anim.frames.length)}/{anim.frames.length}
                </span>
              </div>

              {/* ── Tile picker (multi-select, appears above thumbnails) ── */}
              {pickingTileForFrame !== null && parentSprite && (() => {
                const ps = parentSprite;
                const availTiles = Array.from(
                  { length: ps.cols * ps.rows },
                  (_, i) => i
                ).filter((t) => !(ps.skippedFrames ?? []).includes(t));
                const pickerCols = Math.min(ps.cols, 8);
                const toggleTile = (t: number) => {
                  setPickerSelectedTiles((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
                };
                const handleOk = () => {
                  if (pickerSelectedTiles.length === 1) {
                    updateFrame(ps.id, anim.id, pickingTileForFrame, { tileIndex: pickerSelectedTiles[0] });
                  } else if (pickerSelectedTiles.length > 1) {
                    pickerSelectedTiles.forEach((tileIdx) => {
                      addFrame(ps.id, anim.id);
                      const sprite = useAppStore.getState().spriteSheets.find((s) => s.id === ps.id);
                      const a = sprite?.animations.find((an) => an.id === anim.id);
                      if (a) {
                        const lastIdx = a.frames.length - 1;
                        useAppStore.getState().updateFrame(ps.id, anim.id, lastIdx, { tileIndex: tileIdx });
                      }
                    });
                  }
                  setPickingTileForFrame(null);
                };
                return (
                  <div style={{
                    borderBottom: '1px solid var(--border-color)',
                    padding: '8px 12px',
                    background: 'var(--bg-panel)',
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      marginBottom: 6,
                    }}>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        Tiles disponibles ({pickerSelectedTiles.length} seleccionados):
                      </span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={handleOk}
                          style={{
                            padding: '3px 10px', fontSize: 10, cursor: 'pointer',
                            background: pickerSelectedTiles.length > 0 ? 'var(--accent)' : 'var(--bg-raised)',
                            color: '#fff', border: 'none', borderRadius: 4,
                            opacity: pickerSelectedTiles.length > 0 ? 1 : 0.5,
                          }}
                        >OK</button>
                        <button
                          onClick={() => setPickingTileForFrame(null)}
                          style={{
                            padding: '3px 8px', fontSize: 10, cursor: 'pointer',
                            background: 'var(--bg-raised)', color: 'var(--text-secondary)',
                            border: 'none', borderRadius: 4,
                          }}
                        >✕</button>
                      </div>
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${pickerCols}, 36px)`,
                      gap: 3,
                    }}>
                      {availTiles.map((tileIdx) => {
                        const tx = tileIdx % ps.cols;
                        const ty = Math.floor(tileIdx / ps.cols);
                        const isSel = pickerSelectedTiles.includes(tileIdx);
                        return (
                          <div
                            key={tileIdx}
                            onClick={() => toggleTile(tileIdx)}
                            style={{
                              width: 36, height: 36,
                              background: isSel ? 'var(--accent-dark)' : 'var(--bg-dark)',
                              border: isSel ? '2px solid var(--accent-light)' : '1px solid var(--bg-raised)',
                              borderRadius: 3, cursor: 'pointer',
                              position: 'relative', overflow: 'hidden',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                            title={`Tile ${tileIdx}`}
                          >
                            {tilesetUrl && (
                              <div style={{
                                position: 'absolute', inset: 0,
                                backgroundImage: `url(${tilesetUrl})`,
                                backgroundPosition: `${-tx * ps.tileWidth}px ${-ty * ps.tileHeight}px`,
                                backgroundSize: `${ps.cols * ps.tileWidth}px ${ps.rows * ps.tileHeight}px`,
                                backgroundRepeat: 'no-repeat',
                                imageRendering: 'pixelated',
                              }} />
                            )}
                            <span style={{
                              position: 'absolute', bottom: 0, right: 1,
                              fontSize: 7, color: '#aaa',
                              background: 'rgba(0,0,0,0.5)', padding: '0 2px', borderRadius: 2,
                            }}>
                              {tileIdx}
                            </span>
                            {isSel && <span style={{
                              position: 'absolute', top: 0, left: 1,
                              fontSize: 8, color: 'var(--accent-light)',
                            }}>✓</span>}
                          </div>
                        );
                      })}
                      {availTiles.length === 0 && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
                          No hay tiles disponibles
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

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
                      opacity: parentSprite && (parentSprite.skippedFrames ?? []).includes(f.tileIndex) ? 0.35 : 1,
                    }}
                    title={`Frame ${i + 1}${parentSprite && (parentSprite.skippedFrames ?? []).includes(f.tileIndex) ? ' (omitido)' : ''}`}
                  >
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        if (parentSprite) setPickingTileForFrame(i);
                      }}
                      style={{
                        cursor: 'pointer', textDecoration: 'underline',
                        textDecorationColor: 'var(--accent-light)',
                      }}
                      title="Cambiar tile"
                    >{f.tileIndex}</span>
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

      {/* Skip frames modal */}
      {showSkipModal && selectedSprite && (
        <div
          onClick={() => setShowSkipModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 99998,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: 16,
              maxWidth: '90vw', maxHeight: '90vh',
              overflow: 'auto',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 8, marginBottom: 12,
            }}>
              <span style={{ color: '#f0c040', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>
                Saltar frames vacíos
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>H:</label>
                <input
                  type="number"
                  min={1}
                  value={selectedSprite.cols}
                  onChange={(e) => {
                    const v = Math.max(1, parseInt(e.target.value) || 1);
                    updateSpriteSheet(selectedSprite.id, { cols: v });
                    setCurrentSpriteFrame(0);
                  }}
                  style={{
                    width: 40, padding: '2px 4px', fontSize: 10,
                    background: 'var(--bg-dark)', color: 'var(--text-primary)',
                    border: '1px solid var(--bg-raised)', borderRadius: 3,
                  }}
                />
                <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>V:</label>
                <input
                  type="number"
                  min={1}
                  value={selectedSprite.rows}
                  onChange={(e) => {
                    const v = Math.max(1, parseInt(e.target.value) || 1);
                    updateSpriteSheet(selectedSprite.id, { rows: v });
                    setCurrentSpriteFrame(0);
                  }}
                  style={{
                    width: 40, padding: '2px 4px', fontSize: 10,
                    background: 'var(--bg-dark)', color: 'var(--text-primary)',
                    border: '1px solid var(--bg-raised)', borderRadius: 3,
                  }}
                />
                <button
                  onClick={autoDetectEmpty}
                  style={{
                    padding: '4px 10px', fontSize: 10, cursor: 'pointer',
                    background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4,
                  }}
                >
                  Auto
                </button>
                <button
                  onClick={() => setShowSkipModal(false)}
                  style={{
                    padding: '4px 8px', fontSize: 10, cursor: 'pointer',
                    background: 'var(--bg-raised)', color: 'var(--text-secondary)', border: 'none', borderRadius: 4,
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${selectedSprite.cols}, ${Math.max(40, Math.min(80, 480 / selectedSprite.cols))}px)`,
              gap: 2,
            }}>
              {Array.from({ length: totalSpriteFrames }, (_, i) => i).map((tileIdx) => {
                const isSkipped = (selectedSprite.skippedFrames ?? []).includes(tileIdx);
                const tx = tileIdx % selectedSprite.cols;
                const ty = Math.floor(tileIdx / selectedSprite.cols);
                const cellW = Math.max(40, Math.min(80, 480 / selectedSprite.cols));
                const cellH = selectedSprite.tileWidth > 0 ? cellW * (selectedSprite.tileHeight / selectedSprite.tileWidth) : cellW;
                return (
                  <div
                    key={tileIdx}
                    onClick={() => toggleSkipped(tileIdx)}
                    style={{
                      width: cellW,
                      height: cellH,
                      background: isSkipped ? '#8b0000' : 'var(--bg-dark)',
                      border: `1px solid ${isSkipped ? '#ff0000' : 'var(--bg-raised)'}`,
                      borderRadius: 3,
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                    title={`Tile ${tileIdx}${isSkipped ? ' (omitido)' : ''}`}
                  >
                    {tilesetUrl && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        backgroundImage: `url(${tilesetUrl})`,
                        backgroundPosition: `${-tx * selectedSprite.tileWidth}px ${-ty * selectedSprite.tileHeight}px`,
                        backgroundSize: `${selectedSprite.cols * selectedSprite.tileWidth}px ${selectedSprite.rows * selectedSprite.tileHeight}px`,
                        backgroundRepeat: 'no-repeat',
                        imageRendering: 'pixelated',
                      }} />
                    )}
                    <span style={{
                      position: 'absolute', bottom: 1, right: 2,
                      fontSize: 8, color: isSkipped ? '#ff8888' : '#aaa',
                      background: 'rgba(0,0,0,0.5)', padding: '0 2px', borderRadius: 2,
                    }}>
                      {tileIdx}
                    </span>
                  </div>
                );
              })}
            </div>
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
