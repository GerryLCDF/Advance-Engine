import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { HierarchyPanel, type HierarchySection } from '../HierarchyPanel';
import { InspectorPanel, type InspectorSection } from '../InspectorPanel';
import { ResizableEditorLayout } from '../ResizableEditorLayout';
import type { Scene, SplashScreen } from '../../../types/editor';

const SCREEN_W = 240;
const SCREEN_H = 160;

const GBA_W = 240;
const GBA_H = 160;

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;

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
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [exportLog.length]);
  const splashScreen = useAppStore((s) => s.splashScreen);
  const updateSplashScreen = useAppStore((s) => s.updateSplashScreen);

  const [tool, setTool] = useState<'select' | 'add' | 'connect' | 'remove' | 'collision' | 'move'>('move');
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [splashImgSize, setSplashImgSize] = useState<{w: number, h: number} | null>(null);
  const [sceneAnimPaused, setSceneAnimPaused] = useState<Record<string, boolean>>({});

  // ── Context menu ──
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; sceneId: string } | null>(null);

  // ── Grid ──
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize, setGridSize] = useState(16);
  const [gridMenuOpen, setGridMenuOpen] = useState(false);
  const gridMenuRef = useRef<HTMLDivElement | null>(null);

  // Detect splash image dimensions for warning conditions
  useEffect(() => {
    if (!splashScreen.backgroundImage) { setSplashImgSize(null); return; }
    let cancelled = false;
    (async () => {
      const api = window.advanceAPI;
      if (!api) return;
      const result = await api.file.readImage(splashScreen.backgroundImage!);
      if (!cancelled && result.success && result.dataUrl) {
        const img = new Image();
        img.onload = () => { if (!cancelled) setSplashImgSize({ w: img.naturalWidth, h: img.naturalHeight }); };
        img.onerror = () => { if (!cancelled) setSplashImgSize(null); };
        img.src = result.dataUrl;
      }
    })();
    return () => { cancelled = true; };
  }, [splashScreen.backgroundImage]);

  const splashMatchingLayer = useMemo(() => {
    return backgrounds.flatMap((bg) => bg.layers).find((l) => l.imagePath === splashScreen.backgroundImage);
  }, [backgrounds, splashScreen.backgroundImage]);

  const isSplashLargeImage = !!(splashImgSize && (splashImgSize.w > 240 || splashImgSize.h > 160) && (!splashMatchingLayer || !splashMatchingLayer.rescale));

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

  // Keep latest scene list and selection for wheel handler
  const scenesRef = useRef(scenes);
  scenesRef.current = scenes;
  const selectedRef = useRef(selectedNodeId);
  selectedRef.current = selectedNodeId;

  // Attach wheel listener with { passive: false } so preventDefault works
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const delta = -e.deltaY * 0.001;
        setZoom((z) => {
          const newZ = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta));
          const sid = selectedRef.current;
          if (sid) {
            const sc = scenesRef.current.find((s) => s.id === sid);
            if (sc) {
              const cx = sc.x + 200;
              const cy = sc.y + 50;
              setPanX((px) => mx - (mx - px) * (newZ / z));
              setPanY((py) => my - (my - py) * (newZ / z));
            }
          }
          return newZ;
        });
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
      hasMoved.current = false;
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
      id: 'splashScreen',
      title: 'SplashScreen',
      items: [{
        id: splashScreen.id, label: splashScreen.name, icon: '🏠',
        subtitle: `${splashScreen.duration}s`,
        actions: isSplashLargeImage ? (
          <span
            title="La imagen de fondo del SplashScreen se ajusta automaticamente al tamaño de la imagen"
            style={{ cursor: 'help', fontSize: 11, color: '#f0ad4e' }}
          >
            ⚠
          </span>
        ) : undefined,
      }],
      onAdd: undefined,
    },
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
  const selectedSplash = selectedNodeId === splashScreen.id ? splashScreen : null;
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

  // Cerrar menú de grid al hacer clic fuera
  useEffect(() => {
    if (!gridMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (gridMenuRef.current && !gridMenuRef.current.contains(e.target as Node)) {
        setGridMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [gridMenuOpen]);

  // Cerrar menú contextual con Escape
  useEffect(() => {
    if (!ctxMenu) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCtxMenu(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [ctxMenu]);

  const inspectorSections: InspectorSection[] = [];
  if (selectedScene) {
    inspectorSections.push({
      title: 'Escena',
      fields: selectedScene.backgroundImage
        ? [
            { label: 'Nombre', type: 'text', value: selectedScene.name, onChange: (v) => updateScene(selectedScene.id, { name: v as string }) },
          ]
        : [
            { label: 'Nombre', type: 'text', value: selectedScene.name, onChange: (v) => updateScene(selectedScene.id, { name: v as string }) },
            { label: 'Ancho (px)', type: 'number', value: selectedScene.width, min: 240, step: 1, onChange: (v) => updateScene(selectedScene.id, { width: v as number, height: Math.round((v as number) * 2 / 3) }) },
            { label: 'Alto (px)', type: 'number', value: selectedScene.height, min: 160, step: 1, onChange: (v) => updateScene(selectedScene.id, { height: v as number, width: Math.round((v as number) * 3 / 2) }) },
          ],
    });
    // Show read-only dimensions when background image is set
    if (selectedScene.backgroundImage) {
      inspectorSections.push({
        title: 'Dimensiones',
        content: (
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '2px 0' }}>
            {selectedScene.width} × {selectedScene.height} px
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
              Definido automáticamente por la imagen de fondo
            </div>
          </div>
        ),
      });
    }
    // Imagen de fondo
    const sceneBgImg = imageOptions.find((img) => img.value === selectedScene.backgroundImage);
    inspectorSections.push({
      title: 'Imagen de fondo',
      content: (
        <div>
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
              <span>{sceneBgImg?.label ?? 'Ninguna'}</span>
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
                      onClick={async () => {
                        const api = window.advanceAPI;
                        if (!api) return;
                        const result = await api.file.readImage(img.value);
                        const patch: Partial<Scene> = { backgroundImage: img.value };
                        if (result.success && result.width && result.height) {
                          patch.width = result.width;
                          patch.height = result.height;
                        }
                        updateScene(selectedScene.id, patch);
                        setImgDropdownOpen(false);
                        setImgSearch('');
                      }}
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
        </div>
      ),
    });
    // Animación de fondo
    const sceneBgLayer = imageOptions.find((img) => img.value === selectedScene.backgroundImage);
    const sceneBgMatching = sceneBgLayer ? backgrounds.flatMap((bg) => bg.layers).find((l) => l.imagePath === selectedScene.backgroundImage) : null;
    if (sceneBgMatching?.animated && sceneBgMatching.animationFramesX && sceneBgMatching.animationFramesY) {
      inspectorSections.push({
        title: 'Animación de fondo',
        content: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {sceneBgMatching.animationFramesX}x{sceneBgMatching.animationFramesY} frames
              </span>
              <button
                onClick={() => setSceneAnimPaused((prev) => ({ ...prev, [selectedScene.id]: !prev[selectedScene.id] }))}
                style={{
                  background: sceneAnimPaused[selectedScene.id] ? 'var(--bg-raised)' : 'var(--accent)',
                  border: 'none', borderRadius: 4, padding: '4px 10px',
                  color: sceneAnimPaused[selectedScene.id] ? 'var(--text-secondary)' : '#fff',
                  fontSize: 10, cursor: 'pointer',
                }}
              >
                {sceneAnimPaused[selectedScene.id] ? '▶ Reproducir' : '⏸ Pausar'}
              </button>
            </div>
          </div>
        ),
      });
    }

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

  // ── SplashScreen inspector ─────────────────────────────────────────────
  const [videoFileName, setVideoFileName] = useState('');
  useEffect(() => {
    if (selectedSplash?.videoPath) {
      setVideoFileName(selectedSplash.videoPath.split(/[\\/]/).pop() ?? '');
    } else {
      setVideoFileName('');
    }
  }, [selectedSplash?.videoPath]);

  if (selectedSplash) {
    inspectorSections.push({
      title: 'SplashScreen',
      fields: [
        {
          label: 'Duración (s)', type: 'number', value: selectedSplash.duration,
          min: 1, max: 5, step: 1,
          onChange: (v) => updateSplashScreen({ duration: v as number }),
        },
        {
          label: 'FPS video', type: 'number', value: selectedSplash.videoFps ?? 15,
          min: 1, max: 30, step: 1,
          onChange: (v) => updateSplashScreen({ videoFps: v as number }),
        },
      ],
    });
    const splashBgSong = songs.find((so) => so.id === selectedSplash.backgroundSong);
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
              borderRadius: 4, color: selectedSplash.backgroundSong ? '#fff' : 'var(--text-muted)',
            }}
          >
            <span>{splashBgSong?.name ?? 'Ninguna'}</span>
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
                  onClick={() => { updateSplashScreen({ backgroundSong: '' }); setDropdownOpen(false); setSongSearch(''); }}
                  style={{
                    padding: '4px 6px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                    background: !selectedSplash.backgroundSong ? 'var(--accent)' : 'transparent',
                    color: !selectedSplash.backgroundSong ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  Ninguna
                </div>
                {filteredSongs.map((so) => (
                  <div
                    key={so.id}
                    onClick={() => { updateSplashScreen({ backgroundSong: so.id }); setDropdownOpen(false); setSongSearch(''); }}
                    style={{
                      padding: '4px 6px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                      background: selectedSplash.backgroundSong === so.id ? 'var(--accent)' : 'transparent',
                      color: selectedSplash.backgroundSong === so.id ? '#fff' : 'var(--text-secondary)',
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
    const splashBgImg = imageOptions.find((img) => img.value === selectedSplash.backgroundImage);
    inspectorSections.push({
      title: 'Imagen de fondo',
      content: (
        <div>
          <div ref={imgDropdownRef} style={{ position: 'relative' }}>
            <div
              onClick={() => setImgDropdownOpen(!imgDropdownOpen)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '4px 8px', fontSize: 11, cursor: 'pointer',
                background: 'var(--bg-canvas)', border: '1px solid var(--border-color)',
                borderRadius: 4, color: selectedSplash.backgroundImage ? '#fff' : 'var(--text-muted)',
              }}
            >
              <span>{splashBgImg?.label ?? 'Ninguna'}</span>
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
                    onClick={() => { updateSplashScreen({ backgroundImage: '' }); setImgDropdownOpen(false); setImgSearch(''); }}
                    style={{
                      padding: '4px 6px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                      background: !selectedSplash.backgroundImage ? 'var(--accent)' : 'transparent',
                      color: !selectedSplash.backgroundImage ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    Ninguna
                  </div>
                  {filteredImages.map((img) => (
                    <div
                      key={img.value}
                      onClick={() => { updateSplashScreen({ backgroundImage: img.value }); setImgDropdownOpen(false); setImgSearch(''); }}
                      style={{
                        padding: '4px 6px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                        background: selectedSplash.backgroundImage === img.value ? 'var(--accent)' : 'transparent',
                        color: selectedSplash.backgroundImage === img.value ? '#fff' : 'var(--text-secondary)',
                      }}
                    >
                      {img.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {isSplashLargeImage && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 6,
              padding: '6px 8px', fontSize: 10, color: '#f0ad4e',
              background: 'rgba(240, 173, 78, 0.1)', border: '1px solid rgba(240, 173, 78, 0.3)',
              borderRadius: 4,
            }}>
              <span style={{ fontSize: 12, flexShrink: 0, marginTop: 1 }}>⚠</span>
              <span>La imagen de fondo del SplashScreen se ajusta automaticamente al tamano de la imagen.</span>
            </div>
          )}
        </div>
      ),
    });
    inspectorSections.push({
      title: 'Video',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={async () => {
                const api = window.advanceAPI;
                if (!api) return;
                const result = await api.dialog.openVideo();
                if (result.path) {
                  updateSplashScreen({ videoPath: result.path });
                }
              }}
              style={{
                padding: '4px 8px', fontSize: 10, cursor: 'pointer',
                background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4,
              }}
            >
              Seleccionar video
            </button>
            {selectedSplash.videoPath && (
              <button
                onClick={() => updateSplashScreen({ videoPath: '' })}
                style={{
                  padding: '4px 8px', fontSize: 10, cursor: 'pointer',
                  background: '#8b0000', color: '#fff', border: 'none', borderRadius: 4,
                }}
              >
                Quitar
              </button>
            )}
          </div>
          {videoFileName && (
            <div style={{ fontSize: 10, color: '#aaa' }}>
              {videoFileName}
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
    if (sceneId === splashScreen.id) {
      setSelectedNodeId(sceneId);
      return;
    }
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
    if (id === splashScreen.id) return;
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
          onContextMenu={(id, x, y) => {
            if (id === splashScreen.id) return;
            setCtxMenu({ x, y, sceneId: id });
          }}
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
              <ToolBtn active={tool === 'move'} onClick={() => { setTool('move'); setConnectFrom(null); }} title="Mover">✥</ToolBtn>
              <div style={{ width: 1, height: 14, background: 'var(--bg-raised)', margin: '0 2px' }} />
              <ToolBtn active={tool === 'add'} onClick={() => { setTool('add'); setConnectFrom(null); }} title="Agregar escena">+</ToolBtn>
              <div style={{ width: 1, height: 14, background: 'var(--bg-raised)', margin: '0 2px' }} />
              <ToolBtn active={tool === 'remove'} onClick={() => { setTool('remove'); setConnectFrom(null); }} title="Eliminar escena">−</ToolBtn>
              <div style={{ width: 1, height: 14, background: 'var(--bg-raised)', margin: '0 2px' }} />
              <ToolBtn active={tool === 'connect'} onClick={() => { setTool('connect'); setConnectFrom(null); }} title="Conectar escenas">
                {connectFrom ? '→' : '🔗'}
              </ToolBtn>
              <div style={{ width: 1, height: 14, background: 'var(--bg-raised)', margin: '0 2px' }} />
              <ToolBtn active={tool === 'collision'} onClick={() => { setTool('collision'); setConnectFrom(null); }} title="Pintar colisión">▦</ToolBtn>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <ToolBtn
                active={showGrid}
                onClick={() => setShowGrid((v) => !v)}
                title="Mostrar grid"
                style={{ opacity: showGrid ? 1 : 0.5 }}
              >
                #
              </ToolBtn>
              <div ref={gridMenuRef} style={{ position: 'relative' }}>
                <ToolBtn onClick={() => setGridMenuOpen((v) => !v)} title="Tamaño del grid">
                  ⋮
                </ToolBtn>
                {gridMenuOpen && (
                  <div style={{
                    position: 'absolute', left: 0, top: '100%', marginTop: 4,
                    background: 'var(--bg-panel)', border: '1px solid var(--border-color)',
                    borderRadius: 6, padding: 4, zIndex: 200,
                    display: 'flex', flexDirection: 'column', gap: 2,
                    minWidth: 80,
                  }}>
                    {[1, 2, 4, 8, 16, 32, 64].map((s) => (
                      <div
                        key={s}
                        onClick={() => { setGridSize(s); setGridMenuOpen(false); }}
                        style={{
                          padding: '4px 8px', fontSize: 11, borderRadius: 4, cursor: 'pointer',
                          background: gridSize === s ? 'var(--accent)' : 'transparent',
                          color: gridSize === s ? '#fff' : 'var(--text-secondary)',
                        }}
                      >
                        {s}×{s}
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
              setCtxMenu(null);
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
              {/* SplashScreen card */}
                    <SplashCard
                      splash={splashScreen}
                      selected={selectedNodeId === splashScreen.id}
                      onSelect={() => { if (!hasMoved.current) setSelectedNodeId(splashScreen.id); }}
                      updateSplashScreen={updateSplashScreen}
                      dragZoom={zoom}
                    />
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
                      onContextMenu={(e, id) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setCtxMenu({ x: e.clientX, y: e.clientY, sceneId: id });
                      }}
                      updateScene={updateScene}
                      dragZoom={zoom}
                      showGrid={showGrid}
                      gridSize={gridSize}
                      animPaused={!!sceneAnimPaused[sc.id]}
                    />
                );
              })}
            </div>

            {/* Grid menu (no scaling) */}
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
            {/* Context menu */}
            {ctxMenu && (
              <>
                <div style={{
                  position: 'fixed', left: 0, top: 0, right: 0, bottom: 0,
                  zIndex: 999, background: 'transparent',
                }} onMouseDown={() => setCtxMenu(null)} />
                <div style={{
                  position: 'fixed', left: ctxMenu.x, top: ctxMenu.y,
                  zIndex: 1000, background: 'var(--bg-panel)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 6, padding: 4,
                  display: 'flex', flexDirection: 'column', gap: 2,
                  minWidth: 120, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                }}>
                  <div
                    onClick={() => {
                      const sc = scenes.find((s) => s.id === ctxMenu.sceneId);
                      if (sc) {
                        const name = prompt('Renombrar escena:', sc.name);
                        if (name && name.trim()) updateScene(ctxMenu.sceneId, { name: name.trim() });
                      }
                      setCtxMenu(null);
                    }}
                    style={{ padding: '6px 12px', fontSize: 12, borderRadius: 4, cursor: 'pointer', color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-raised)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    Renombrar
                  </div>
                  <div
                    onClick={() => {
                      handleRemove(ctxMenu.sceneId);
                      setCtxMenu(null);
                    }}
                    style={{ padding: '6px 12px', fontSize: 12, borderRadius: 4, cursor: 'pointer', color: '#ef4444' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-raised)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    Eliminar
                  </div>
                </div>
              </>
            )}
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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Toolbar con botones sobre la terminal */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '2px 12px', flexShrink: 0,
            background: 'var(--bg-terminal)', borderBottom: '1px solid var(--border-color)',
          }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 9, textTransform: 'uppercase' }}>
              Terminal — Pipeline
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => navigator.clipboard.writeText(exportLog.join('\n'))} style={{
                background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 4,
                color: 'var(--text-secondary)', fontSize: 10, cursor: 'pointer', padding: '2px 6px',
              }}>Copiar</button>
              <button onClick={() => useAppStore.getState().clearExportLog()} style={{
                background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 4,
                color: 'var(--text-secondary)', fontSize: 10, cursor: 'pointer', padding: '2px 6px',
              }}>Limpiar</button>
            </div>
          </div>
          {/* Contenido scrolleable de la terminal */}
          <div ref={terminalRef} style={{
            flex: 1, overflow: 'auto',
            padding: '6px 12px',
            fontFamily: 'monospace', fontSize: 11,
            color: 'var(--terminal-green)',
            userSelect: 'text',
            background: 'var(--bg-terminal)',
          }}>
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
          </div>
        </div>
      }
    />
  );
}

function ToolBtn({ children, active, onClick, title, style }: { children: React.ReactNode; active?: boolean; onClick?: () => void; title?: string; style?: React.CSSProperties }) {
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
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function SceneCard({ scene, selected, isConnecting, tool, connectFrom, onSelect, onContextMenu, updateScene, dragZoom, showGrid, gridSize, animPaused }: {
  scene: Scene; selected: boolean; isConnecting: boolean;
  tool: string; connectFrom: string | null;
  onSelect: (id: string) => void;
  onContextMenu?: (e: React.MouseEvent, id: string) => void;
  updateScene: (id: string, patch: Partial<Scene>) => void;
  dragZoom: number;
  showGrid: boolean;
  gridSize: number;
  animPaused: boolean;
}) {
  const imageSmoothing = useAppStore((s) => s.imageSmoothing);
  const backgrounds = useAppStore((s) => s.backgrounds);
  const songs = useAppStore((s) => s.songs);
  const clickAnimation = useAppStore((s) => s.clickAnimation);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0 });
  const [bgImageUrl, setBgImageUrl] = useState('');
  const [animFrame, setAnimFrame] = useState(0);
  const animDirRef = useRef(1);

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

  // Find matching layer to check rescale setting
  const matchingLayer = useMemo(() => {
    return backgrounds.flatMap((bg) => bg.layers).find((l) => l.imagePath === scene.backgroundImage);
  }, [backgrounds, scene.backgroundImage]);

  const isAnimated = matchingLayer?.animated && !!matchingLayer.animationFramesX && !!matchingLayer.animationFramesY;
  const totalFrames = isAnimated ? (matchingLayer!.animationFramesX! * matchingLayer!.animationFramesY!) : 0;
  // rescale=false → aggressive GBA fill (fill); rescale=true → keep image's natural scale (contain)
  const imageFit: React.CSSProperties['objectFit'] = matchingLayer ? (matchingLayer.rescale ? 'contain' : 'fill') : 'cover';

  // Reset frame on layer/image change
  useEffect(() => { setAnimFrame(0); animDirRef.current = 1; }, [scene.backgroundImage, isAnimated]);

  // Animation timer for SceneCard preview
  useEffect(() => {
    if (!isAnimated || animPaused) { setAnimFrame(0); animDirRef.current = 1; return; }
    const fps = matchingLayer!.animationSpeed ?? 5;
    const loop = matchingLayer!.animationLoop || 'loop';
    const ms = Math.max(50, Math.round(500 / fps));
    const timer = setInterval(() => {
      setAnimFrame((prev) => {
        if (loop === 'loop') return (prev + 1) % totalFrames;
        if (loop === 'once') return prev < totalFrames - 1 ? prev + 1 : totalFrames - 1;
        if (loop === 'pingpong') {
          const next = prev + animDirRef.current;
          if (next >= totalFrames || next < 0) { animDirRef.current *= -1; return prev + animDirRef.current; }
          return next;
        }
        let r: number;
        do { r = Math.floor(Math.random() * totalFrames); } while (r === prev && totalFrames > 1);
        return r;
      });
    }, ms);
    return () => clearInterval(timer);
  }, [isAnimated, animPaused, matchingLayer?.animationSpeed, matchingLayer?.animationLoop, totalFrames]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(scene.id);
    if (tool !== 'move') return;
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    const handleMove = (ev: MouseEvent) => {
      ev.preventDefault();
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        moved = true;
        setDragging(true);
        dragRef.current = { startX: ev.clientX, startY: ev.clientY, origX: scene.x, origY: scene.y };
      }
      if (moved) {
        updateScene(scene.id, {
          x: dragRef.current.origX + (ev.clientX - dragRef.current.startX) / dragZoom,
          y: dragRef.current.origY + (ev.clientY - dragRef.current.startY) / dragZoom,
        });
      }
    };
    const handleUp = () => {
      setDragging(false);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [scene.id, scene.x, scene.y, onSelect, updateScene, dragZoom, tool]);

  const bgSongObj = useMemo(() => songs.find((so) => so.id === scene.backgroundSong), [songs, scene.backgroundSong]);

  return (
    <div
      style={{
        position: 'absolute',
        left: 0, top: 0,
        transform: `translate(${scene.x}px, ${scene.y}px)`,
        willChange: dragging ? 'transform' : 'auto',
        width: 400,
        background: clickAnimation && selected ? 'var(--bg-panel)' : 'transparent',
        border: selected ? `2px solid var(--accent-light)` : '2px solid transparent',
        borderRadius: clickAnimation && selected ? 0 : 8,
        overflow: 'hidden',
        padding: clickAnimation && selected ? 10 : 0,
        cursor: tool === 'connect' ? 'crosshair' : dragging ? 'grabbing' : 'grab',
        zIndex: dragging ? 10 : 1,
        userSelect: 'none',
        transition: clickAnimation ? 'border-color 0.15s, background 0.15s, border-radius 0.15s, padding 0.15s' : 'none',
        opacity: clickAnimation && selected ? 1 : 0.85,
      }}
      onMouseDown={handleMouseDown}
      onClick={() => onSelect(scene.id)}
      onContextMenu={(e) => onContextMenu?.(e, scene.id)}
      onMouseEnter={(e) => {
        if (clickAnimation && !selected) e.currentTarget.style.background = 'var(--bg-raised)';
      }}
      onMouseLeave={(e) => {
        if (clickAnimation && !selected) e.currentTarget.style.background = 'transparent';
      }}
    >
      <div style={{
        fontSize: 14, fontWeight: 600, color: '#ccc',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        display: 'flex', alignItems: 'center', gap: 6,
        marginBottom: 4,
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scene.name}</span>
        {bgSongObj && selected && (
          <span style={{ fontSize: 10, color: '#6b8cff', flexShrink: 0 }}>🎵 {bgSongObj.name}</span>
        )}
      </div>
      {/* Mini-map */}
      <div style={{
        width: clickAnimation && selected ? '100%' : '360px',
        paddingBottom: `${(scene.height / scene.width) * 100}%`,
        position: 'relative',
        borderRadius: clickAnimation && selected ? 0 : 4,
        overflow: 'hidden',
        margin: '0 auto',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: bgImageUrl ? 'transparent' : scene.backgroundColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, color: '#ffffff88',
        }}>
          {bgImageUrl && (
            isAnimated ? (
              <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
                <img src={bgImageUrl} alt="" draggable={false} onDragStart={(e) => e.preventDefault()}
                  style={{
                    position: 'absolute',
                    left: `${-(animFrame % matchingLayer!.animationFramesX!) * 100}%`,
                    top: `${-Math.floor(animFrame / matchingLayer!.animationFramesX!) * 100}%`,
                    width: `${matchingLayer!.animationFramesX! * 100}%`,
                    height: `${matchingLayer!.animationFramesY! * 100}%`,
                    maxWidth: 'none',
                    imageRendering: imageSmoothing ? 'auto' : 'pixelated',
                  }}
                />
              </div>
            ) : (
              <img src={bgImageUrl} alt="" draggable={false} onDragStart={(e) => e.preventDefault()}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: imageFit, imageRendering: imageSmoothing ? 'auto' : 'pixelated' }}
              />
            )
          )}
          {showGrid && (
            <svg style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              pointerEvents: 'none', zIndex: 2,
            }}
              viewBox={`0 0 ${scene.width} ${scene.height}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {Array.from({ length: Math.floor(scene.width / gridSize) + 1 }, (_, i) => (
                <line key={`gv${i}`} x1={i * gridSize} y1={0} x2={i * gridSize} y2={scene.height} stroke="rgba(255,255,255,0.12)" strokeWidth={0.5} />
              ))}
              {Array.from({ length: Math.floor(scene.height / gridSize) + 1 }, (_, i) => (
                <line key={`gh${i}`} x1={0} y1={i * gridSize} x2={scene.width} y2={i * gridSize} stroke="rgba(255,255,255,0.12)" strokeWidth={0.5} />
              ))}
            </svg>
          )}
          {selected && (
            <div style={{
              position: 'absolute', inset: 0,
              border: '2px solid rgba(255,255,255,0.15)',
              pointerEvents: 'none',
            }} />
          )}
        </div>
      </div>
      {!selected && (
        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, textAlign: 'center' }}>
          {scene.type}
        </div>
      )}
    </div>
  );
}

function SplashCard({ splash, selected, onSelect, updateSplashScreen, dragZoom }: {
  splash: SplashScreen; selected: boolean;
  onSelect: () => void;
  updateSplashScreen: (patch: Partial<SplashScreen>) => void;
  dragZoom: number;
}) {
  const imageSmoothing = useAppStore((s) => s.imageSmoothing);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0 });
  const [bgImageUrl, setBgImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!splash.backgroundImage) { setBgImageUrl(''); return; }
    let cancelled = false;
    (async () => {
      const api = window.advanceAPI;
      if (!api) return;
      const result = await api.file.readImage(splash.backgroundImage!);
      if (!cancelled && result.success && result.dataUrl) {
        setBgImageUrl(result.dataUrl);
      }
    })();
    return () => { cancelled = true; };
  }, [splash.backgroundImage]);

  useEffect(() => {
    if (!splash.videoPath) { setVideoUrl(''); return; }
    let cancelled = false;
    (async () => {
      const api = window.advanceAPI;
      if (!api) return;
      const result = await api.file.readVideo(splash.videoPath!);
      if (!cancelled && result.success && result.dataUrl) {
        setVideoUrl(result.dataUrl);
      }
    })();
    return () => { cancelled = true; };
  }, [splash.videoPath]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    setDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: splash.x, origY: splash.y };
    const handleMove = (ev: MouseEvent) => {
      ev.preventDefault();
      updateSplashScreen({
        x: dragRef.current.origX + (ev.clientX - dragRef.current.startX) / dragZoom,
        y: dragRef.current.origY + (ev.clientY - dragRef.current.startY) / dragZoom,
      });
    };
    const handleUp = () => {
      setDragging(false);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [splash.x, splash.y, onSelect, updateSplashScreen, dragZoom]);

  return (
    <div
      style={{
        position: 'absolute',
        left: 0, top: 0,
        transform: `translate(${splash.x}px, ${splash.y}px)`,
        willChange: dragging ? 'transform' : 'auto',
        width: 400,
        background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
        border: `2px solid ${selected ? 'var(--accent-light)' : '#3a3a5a'}`,
        borderRadius: 8, padding: 10,
        cursor: dragging ? 'grabbing' : 'grab',
        zIndex: dragging ? 10 : 1,
        userSelect: 'none',
      }}
      onMouseDown={handleMouseDown}
      onClick={onSelect}
    >
      <div style={{
        fontSize: 14, fontWeight: 600, color: '#f0c040',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        marginBottom: 4,
      }}>
        {splash.name}
      </div>
      <div style={{
        width: '100%', paddingBottom: '66.67%', position: 'relative',
        borderRadius: 4, marginBottom: 4, overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: '#0d0d1a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, color: '#ffffff88',
        }}>
          {videoUrl && (
            <video ref={videoRef} src={videoUrl} autoPlay loop muted playsInline
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
            />
          )}
          {bgImageUrl && !videoUrl && (
            <img src={bgImageUrl} alt="" draggable={false} onDragStart={(e) => e.preventDefault()}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', imageRendering: imageSmoothing ? 'auto' : 'pixelated' }}
            />
          )}
          <span style={{ position: 'relative', zIndex: 1, background: '#00000066', padding: '2px 6px', borderRadius: 4 }}>
            Splash — {splash.duration}s{videoUrl ? ' 🎬' : ''}
          </span>
          <div style={{
            position: 'absolute', inset: 0,
            border: '2px solid rgba(255,255,255,0.1)', borderRadius: 2, pointerEvents: 'none',
          }} />
        </div>
      </div>
      {splash.backgroundSong && (
        <div style={{ fontSize: 9, color: '#6b8cff', marginTop: 2 }}>
          🎵 {splash.backgroundSong}
        </div>
      )}
    </div>
  );
}
