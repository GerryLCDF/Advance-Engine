import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../../store/useAppStore';
import { HierarchyPanel, type HierarchySection } from '../HierarchyPanel';
import { InspectorPanel, type InspectorSection, type InspectorField } from '../InspectorPanel';
import { ResizableEditorLayout } from '../ResizableEditorLayout';
import type { Scene, SplashScreen, SceneConnection, TransitionConfig, FxAsset, TilesetAnimDirection, SoundEffect, TransitionType } from '../../../types/editor';
import { COLLISION_EMPTY, COLLISION_SOLID, COLLISION_SLOPE, COLLISION_SLOPE_INV, COLLISION_SLOPE_26, COLLISION_SLOPE_MIRROR, COLLISION_SLOPE_INV_MIRROR, COLLISION_PALETTE, type CollisionBrush } from '../../../types/editor';
import { imageDataUrlToTransitionHeader } from '../../../utils/transitionHeader';
import { imageDataUrlToGradientHeader } from '../../../utils/transitionGradientHeader';
import { MoveIcon, PlusIcon, MinusIcon, Link2Icon, Grid3x3Icon, Grid2x2Icon, PencilIcon, SquareIcon, WandIcon, HomeIcon, GlobeIcon, MoreVerticalIcon, ArrowRightIcon, PaintBucketIcon } from './icons';
import RadialMenu, { type RadialMenuItem } from './RadialMenu';
import { MapPin, User, Link2, Shield } from 'lucide-react';

// ── Slope helpers ──────────────────────────────────────────────────────
const SLOPE_DEFS: Record<number, number[]> = {
  [COLLISION_SLOPE]:    [1,2,3,4,5,6,7,8],
  [COLLISION_SLOPE_INV]: [8,7,6,5,4,3,2,1],
  [COLLISION_SLOPE_26]: [0,0,0,0,2,4,6,8],
  [COLLISION_SLOPE_MIRROR]: [1,2,3,4,5,6,7,8],
  [COLLISION_SLOPE_INV_MIRROR]: [8,7,6,5,4,3,2,1],
};
const SLOPE_ENCODE_BASE = 100;

// ── Collision type swatches (shared by toolbar + radial sub-panel) ─────
const COLLISION_TYPES = [
  { value: 1, color: '#ff4444', icon: <rect x={0} y={0} width={16} height={16} fill="#ff4444" rx={1} />, title: 'Sólido' },
  { value: 2, color: '#ffdd44', icon: <><rect x={0} y={0} width={16} height={8} fill="#ffdd44" rx={1} /><rect x={0} y={8} width={16} height={8} fill="#ffdd4444" rx={1} /></>, title: 'One-way ↑' },
  { value: 3, color: '#ff8844', icon: <><rect x={0} y={8} width={16} height={8} fill="#ff8844" rx={1} /><rect x={0} y={0} width={16} height={8} fill="#ff884444" rx={1} /></>, title: 'One-way ↓' },
  { value: 4, color: '#4488ff', icon: <><rect x={0} y={0} width={8} height={16} fill="#4488ff" rx={1} /><rect x={8} y={0} width={8} height={16} fill="#4488ff44" rx={1} /></>, title: 'One-way ←' },
  { value: 5, color: '#44ddff', icon: <><rect x={8} y={0} width={8} height={16} fill="#44ddff" rx={1} /><rect x={0} y={0} width={8} height={16} fill="#44ddff44" rx={1} /></>, title: 'One-way →' },
  { value: 6, color: '#44cc44', icon: <><rect x={0} y={0} width={16} height={16} fill="#44cc44" rx={1} /><line x1={3} y1={4} x2={13} y2={4} stroke="#fff" strokeWidth={1.5} /><line x1={3} y1={8} x2={13} y2={8} stroke="#fff" strokeWidth={1.5} /><line x1={3} y1={12} x2={13} y2={12} stroke="#fff" strokeWidth={1.5} /></>, title: 'Escalera' },
  { value: 7, color: '#ff66bb', icon: <polygon points="0,16 16,16 16,0" fill="#ff66bb" />, title: 'Rampa ↘' },
  { value: 10, color: '#66ffbb', icon: <polygon points="0,0 16,16 0,16" fill="#66ffbb" />, title: 'Rampa ↙' },
  { value: 11, color: '#ffbb66', icon: <polygon points="0,0 16,16 16,0" fill="#ffbb66" />, title: 'Rampa ↗' },
  { value: 8, color: '#bb66ff', icon: <polygon points="0,0 16,0 0,16" fill="#bb66ff" />, title: 'Rampa ↖' },
];

function decodeSlope(value: number): { counts: number[]; forward: boolean; mirror: boolean } | null {
  if (value < SLOPE_ENCODE_BASE) return null;
  const code = value - SLOPE_ENCODE_BASE;
  const forward = Math.floor(code / 4294967296) % 2 === 0; // bit 32 = forward flag
  const mirror = Math.floor(code / 8589934592) % 2 === 1; // bit 33 = mirror flag
  const counts: number[] = [];
  for (let i = 0; i < 8; i++)
    counts.push(Math.floor(code / Math.pow(2, i * 4)) % 16);
  return { counts, forward, mirror };
}

function encodeSlope(counts: number[], forward: boolean, mirror?: boolean): number {
  let code = forward ? 0 : 4294967296; // bit 32 = forward flag
  if (mirror) code += 8589934592; // bit 33 = mirror flag
  for (let i = 0; i < 8; i++)
    code += (counts[i] & 0xF) * Math.pow(2, i * 4);
  return SLOPE_ENCODE_BASE + code;
}

function tilePixelCounts(
  sx: number, sy: number, ex: number, ey: number,
  col: number, row: number, ts: number, isBelow: boolean,
  forceBackslash?: boolean,
): number[] {
  const isBackslash = forceBackslash !== undefined ? forceBackslash : ((ex > sx && ey < sy) || (ex < sx && ey > sy));
  const tx = col * ts;
  const ty = row * ts;
  const rampRows = 8;
  const ppRamp = ts / rampRows;
  const counts: number[] = [];
  let hasFill = false;
  for (let rr = 0; rr < rampRows; rr++) {
    const gy = ty + rr * ppRamp + ppRamp / 2;
    let n = 0;
    if (isBelow) {
      if (!isBackslash) { // / below → right-aligned, count from right
        for (let rc = rampRows - 1; rc >= 0; rc--) {
          const gx = tx + rc * ppRamp + ppRamp / 2;
          let ly = sy;
          if (ex !== sx) ly = sy + (ey - sy) * (gx - sx) / (ex - sx);
          if (gy >= ly) n++; else break;
        }
      } else { // \ below → left-aligned, count from left
        for (let rc = 0; rc < rampRows; rc++) {
          const gx = tx + rc * ppRamp + ppRamp / 2;
          let ly = sy;
          if (ex !== sx) ly = sy + (ey - sy) * (gx - sx) / (ex - sx);
          if (gy >= ly) n++; else break;
        }
      }
    } else {
      if (!isBackslash) { // / above → left-aligned, count from left
        for (let rc = 0; rc < rampRows; rc++) {
          const gx = tx + rc * ppRamp + ppRamp / 2;
          let ly = sy;
          if (ex !== sx) ly = sy + (ey - sy) * (gx - sx) / (ex - sx);
          if (gy < ly) n++; else break;
        }
      } else { // \ above → right-aligned, count from right
        for (let rc = rampRows - 1; rc >= 0; rc--) {
          const gx = tx + rc * ppRamp + ppRamp / 2;
          let ly = sy;
          if (ex !== sx) ly = sy + (ey - sy) * (gx - sx) / (ex - sx);
          if (gy < ly) n++; else break;
        }
      }
    }
    counts.push(n);
    if (n > 0 && n < rampRows) hasFill = true;
  }
  if (!hasFill) return [];
  return counts;
}

function bresenhamLine(x0: number, y0: number, x1: number, y1: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const ix0 = Math.round(x0), iy0 = Math.round(y0), ix1 = Math.round(x1), iy1 = Math.round(y1);
  const dx = Math.abs(ix1 - ix0), dy = -Math.abs(iy1 - iy0);
  const sx = ix0 < ix1 ? 1 : -1, sy = iy0 < iy1 ? 1 : -1;
  let err = dx + dy, x = ix0, y = iy0;
  while (true) {
    pts.push({ x, y });
    if (x === ix1 && y === iy1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
  return pts;
}

const SCREEN_W = 240;
const SCREEN_H = 160;

const GBA_W = 240;
const GBA_H = 160;

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 32;

// ── Transition inspector builder ──────────────────────────────────────
function TilesetSelector({
  value, fxAssets, onChange, projectDir,
}: {
  value: string | undefined;
  fxAssets: FxAsset[];
  onChange: (id: string) => void;
  projectDir: string | null;
}) {
  const tilesets = fxAssets.filter((a) => a.type === 'tileset');
  const [count, setCount] = useState(0);

  const importAsset = async (filePath: string) => {
    const api = window.advanceAPI;
    if (!api) return;
    const fileName = filePath.split(/[\\/]/).pop() ?? 'tileset.png';
    const destPath = projectDir ? `${projectDir}/fx/${fileName}` : filePath;
    let cols = 1, rows = 1;
    let dataUrl: string | undefined;
    const read = await api.file.readImage(filePath);
    if (read.success && read.dataUrl) {
      dataUrl = read.dataUrl;
      const img = new Image();
      img.src = read.dataUrl;
      await img.decode();
      cols = Math.max(1, Math.floor(img.naturalWidth / 8));
      rows = Math.max(1, Math.floor(img.naturalHeight / 8));
    }
    if (projectDir) {
      await api.dir.create(`${projectDir}/fx`);
      await api.file.copy(filePath, destPath);
    }
    let hFilePath: string | undefined;
    if (projectDir && dataUrl) {
      try {
        const hName = (fileName.replace(/\.[^.]+$/, '') + '.h');
        hFilePath = `${projectDir}/fx/${hName}`;
        const { header } = await imageDataUrlToTransitionHeader(dataUrl, cols, rows, 5);
        await api.file.writeText(hFilePath, header);
      } catch { /* .h file generation failed silently */ }
    }
    const asset: FxAsset = {
      id: `fx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: fileName, type: 'tileset',
      filePath: destPath, hFilePath,
      cols, rows, animSpeed: 5, animDirection: 'forward',
      startColor: '#000000', endColor: '#ffffff',
    };
    useAppStore.getState().addFxAsset(asset);
    setCount((c) => c + 1);
  };

  const handleImport = async () => {
    const api = window.advanceAPI;
    if (!api) return;
    const result = await api.dialog.openAnyImage();
    if (result.path) importAsset(result.path);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const filePath = (file as any).path;
    if (filePath) importAsset(filePath);
  };

  const btnStyle: React.CSSProperties = {
    padding: '4px 8px', fontSize: 10, cursor: 'pointer',
    background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4,
  };

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600 }}>Tileset</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} ref={ref}>
        <div style={{ position: 'relative', flex: 1 }}>
          <div onClick={() => setOpen(!open)}
            style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-color)', borderRadius: 4, color: '#fff', fontSize: 10, padding: '4px 6px', cursor: 'pointer', userSelect: 'none' }}>
            {value ? (tilesets.find((t) => t.id === value)?.name ?? 'Seleccionar...') : '-- Ninguno --'}
          </div>
          {open && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--bg-canvas)', border: '1px solid var(--border-color)', borderRadius: 4, marginTop: 2, maxHeight: 160, overflowY: 'auto' }}>
              <div onClick={() => { onChange(''); setOpen(false); }}
                style={{ padding: '4px 6px', fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}>
                -- Ninguno --
              </div>
              {tilesets.map((t) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', cursor: 'pointer' }}
                  onClick={() => { onChange(t.id); setOpen(false); }}>
                  <span style={{ flex: 1, fontSize: 10, color: 'var(--text)' }}>{t.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); useAppStore.getState().removeFxAsset(t.id); }}
                    style={{ padding: 0, width: 16, height: 16, background: 'transparent', color: '#ef4444', border: 'none', borderRadius: 2, fontSize: 11, lineHeight: '16px', textAlign: 'center', cursor: 'pointer' }}
                    title="Eliminar tileset">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <button onClick={handleImport} style={btnStyle}>+</button>
      </div>
      <div onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}
        style={{ border: '1px dashed var(--border-color)', borderRadius: 4, padding: '6px', textAlign: 'center', fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
        Arrastra imagen aquí
      </div>
    </div>
  );
}

function TilesetOptions({
  tilesetId, fxAssets, tileSize,
}: {
  tilesetId: string | undefined;
  fxAssets: FxAsset[];
  tileSize: number;
}) {
  const sel = tilesetId ? fxAssets.find((a) => a.id === tilesetId) : null;
  const [tilesetUrl, setTilesetUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!sel) { setTilesetUrl(null); return; }
    const api = window.advanceAPI;
    if (!api) return;
    api.file.readImage(sel.filePath).then((r) => { if (r.success && r.dataUrl) setTilesetUrl(r.dataUrl); });
  }, [sel?.filePath]);

  const upd = (patch: Partial<FxAsset>) => {
    if (sel) useAppStore.getState().updateFxAsset(sel.id, patch);
  };

  if (!sel) return null;
  const STYLE = { fontSize: 10, color: 'var(--text-secondary)' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {tilesetUrl && <TilesetAnimPreview asset={sel} tilesetUrl={tilesetUrl} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 4, background: 'var(--bg-canvas)', borderRadius: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={STYLE}>Dirección:</span>
          <select value={sel.animDirection}
            onChange={(e) => upd({ animDirection: e.target.value as TilesetAnimDirection })}
            style={{ flex: 1, background: 'var(--bg-canvas)', border: '1px solid var(--border-color)', borderRadius: 4, color: '#fff', fontSize: 10, padding: '4px 6px' }}>
            <option value="forward">Adelante</option>
            <option value="reverse">Atrás</option>
          </select>
        </div>
      </div>
    </div>
  );
}

/** Make white pixels transparent in place on a canvas context */
function makeWhiteTransparent(ctx: CanvasRenderingContext2D) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const bright = d[i] + d[i + 1] + d[i + 2];
    if (bright >= 384) d[i + 3] = 0;
  }
  ctx.putImageData(imgData, 0, 0);
}

function TilesetAnimPreview({ asset, tilesetUrl }: { asset: FxAsset; tilesetUrl: string }) {
  const animRef = useRef<HTMLCanvasElement>(null);
  const sheetRef = useRef<HTMLCanvasElement>(null);
  const [frame, setFrame] = useState(0);
  const totalFrames = asset.cols * asset.rows;

  // ── Animation timer (bucle adelante) ──
  useEffect(() => {
    const tick = asset.animSpeed > 0 ? Math.max(16, 1000 / asset.animSpeed) : 100;
    const id = setTimeout(() => {
      setFrame((prev) => (prev + 1) % totalFrames);
    }, tick);
    return () => clearTimeout(id);
  }, [frame, asset.animSpeed, totalFrames]);

  // ── Draw current frame on canvas ──
  useEffect(() => {
    const ac = animRef.current;
    const sc = sheetRef.current;
    if (!ac || !sc) return;
    const aCtx = ac.getContext('2d');
    const sCtx = sc.getContext('2d');
    if (!aCtx || !sCtx) return;

    const img = new Image();
    img.onload = () => {
      const fw = img.naturalWidth / asset.cols;
      const fh = img.naturalHeight / asset.rows;
      const sheetRatio = img.naturalWidth / img.naturalHeight;
      const frameRatio = fw / fh;
      const nAw = Math.min(160, Math.round(160));
      const nAh = Math.min(240, Math.round(nAw / frameRatio));
      const nSw = Math.min(160, Math.round(160));
      const nSh = Math.min(240, Math.round(nSw / sheetRatio));
      ac.width = nAw; ac.height = nAh;
      sc.width = nSw; sc.height = nSh;
      ac.style.width = nAw + 'px';
      ac.style.height = nAh + 'px';
      sc.style.width = nSw + 'px';
      sc.style.height = nSh + 'px';

      aCtx.imageSmoothingEnabled = false;
      sCtx.imageSmoothingEnabled = false;

      // ── Render animation canvas (white → transparent) ──
      const tmpA = document.createElement('canvas');
      tmpA.width = fw; tmpA.height = fh;
      const tmpACtx = tmpA.getContext('2d')!;
      const col = frame % asset.cols;
      const row = Math.floor(frame / asset.cols);
      tmpACtx.drawImage(img, col * fw, row * fh, fw, fh, 0, 0, fw, fh);
      makeWhiteTransparent(tmpACtx);

      const cs = 6;
      const drawChecker = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
        for (let y = 0; y < h; y += cs) {
          for (let x = 0; x < w; x += cs) {
            ctx.fillStyle = (Math.floor(x / cs) + Math.floor(y / cs)) % 2 === 0 ? '#666' : '#444';
            ctx.fillRect(x, y, cs, cs);
          }
        }
      };
      drawChecker(aCtx, nAw, nAh);
      aCtx.drawImage(tmpA, 0, 0, nAw, nAh);

      // ── Render sheet preview (white → transparent) ──
      const tmpS = document.createElement('canvas');
      tmpS.width = img.naturalWidth; tmpS.height = img.naturalHeight;
      const tmpSCtx = tmpS.getContext('2d')!;
      tmpSCtx.drawImage(img, 0, 0);
      makeWhiteTransparent(tmpSCtx);

      drawChecker(sCtx, nSw, nSh);
      sCtx.drawImage(tmpS, 0, 0, nSw, nSh);
    };
    img.src = tilesetUrl;
  }, [frame, asset, tilesetUrl]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <canvas ref={animRef}
        style={{ borderRadius: 4, border: '1px solid var(--border-color)', display: 'block', imageRendering: 'pixelated' }}
      />
      <canvas ref={sheetRef}
        style={{ borderRadius: 4, border: '1px solid var(--border-color)', display: 'block', imageRendering: 'pixelated' }}
      />
    </div>
  );
}

function GradientSelector({
  value, fxAssets, onChange, projectDir,
}: {
  value: string | undefined;
  fxAssets: FxAsset[];
  onChange: (id: string) => void;
  projectDir: string | null;
}) {
  const gradients = fxAssets.filter((a) => a.type === 'gradient');
  const [, setCount] = useState(0);

  const importAsset = async (filePath: string) => {
    const api = window.advanceAPI;
    if (!api) return;
    const fileName = filePath.split(/[\\/]/).pop() ?? 'gradient.png';
    const destPath = projectDir ? `${projectDir}/fx/${fileName}` : filePath;
    let dataUrl: string | undefined;
    const read = await api.file.readImage(filePath);
    if (read.success && read.dataUrl) {
      dataUrl = read.dataUrl;
    }
    if (projectDir) {
      await api.dir.create(`${projectDir}/fx`);
      await api.file.copy(filePath, destPath);
    }
    let hFilePath: string | undefined;
    if (projectDir && dataUrl) {
      try {
        const hName = (fileName.replace(/\.[^.]+$/, '') + '.h');
        hFilePath = `${projectDir}/fx/${hName}`;
        const { header } = await imageDataUrlToGradientHeader(dataUrl);
        await api.file.writeText(hFilePath, header);
      } catch { /* .h file generation failed silently */ }
    }
    const asset: FxAsset = {
      id: `fx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: fileName, type: 'gradient',
      filePath: destPath, hFilePath,
      cols: 1, rows: 1, animSpeed: 5, animDirection: 'forward',
      startColor: '#000000', endColor: '#ffffff',
    };
    useAppStore.getState().addFxAsset(asset);
    setCount((c) => c + 1);
  };

  const handleImport = async () => {
    const api = window.advanceAPI;
    if (!api) return;
    const result = await api.dialog.openAnyImage();
    if (result.path) importAsset(result.path);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const filePath = (file as any).path;
    if (filePath) importAsset(filePath);
  };

  const btnStyle: React.CSSProperties = {
    padding: '4px 8px', fontSize: 10, cursor: 'pointer',
    background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4,
  };

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600 }}>Degradado</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} ref={ref}>
        <div style={{ position: 'relative', flex: 1 }}>
          <div onClick={() => setOpen(!open)}
            style={{ background: 'var(--bg-canvas)', border: '1px solid var(--border-color)', borderRadius: 4, color: '#fff', fontSize: 10, padding: '4px 6px', cursor: 'pointer', userSelect: 'none' }}>
            {value ? (gradients.find((g) => g.id === value)?.name ?? 'Seleccionar...') : '-- Ninguno --'}
          </div>
          {open && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--bg-canvas)', border: '1px solid var(--border-color)', borderRadius: 4, marginTop: 2, maxHeight: 160, overflowY: 'auto' }}>
              <div onClick={() => { onChange(''); setOpen(false); }}
                style={{ padding: '4px 6px', fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}>
                -- Ninguno --
              </div>
              {gradients.map((g) => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', cursor: 'pointer' }}
                  onClick={() => { onChange(g.id); setOpen(false); }}>
                  <span style={{ flex: 1, fontSize: 10, color: 'var(--text)' }}>{g.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); useAppStore.getState().removeFxAsset(g.id); }}
                    style={{ padding: 0, width: 16, height: 16, background: 'transparent', color: '#ef4444', border: 'none', borderRadius: 2, fontSize: 11, lineHeight: '16px', textAlign: 'center', cursor: 'pointer' }}
                    title="Eliminar degradado">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <button onClick={handleImport} style={btnStyle}>+</button>
      </div>
      <div onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}
        style={{ border: '1px dashed var(--border-color)', borderRadius: 4, padding: '6px', textAlign: 'center', fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>
        Arrastra imagen aquí
      </div>
    </div>
  );
}

function TransitionPreview({
  entry, fxAssets, mode = 'entry', bgColor = '#4488cc', bgLabel = 'A',
}: {
  entry: TransitionConfig;
  fxAssets: FxAsset[];
  mode?: 'entry' | 'exit';
  bgColor?: string;
  bgLabel?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tilesetUrl, setTilesetUrl] = useState('');
  const [frame, setFrame] = useState(0);
  const [paused, setPaused] = useState(mode === 'exit');
  const [frames, setFrames] = useState<HTMLCanvasElement[]>([]);
  const [gradientData, setGradientData] = useState<Uint8ClampedArray | null>(null);
  const [gradientW, setGradientW] = useState(1);
  const [gradientH, setGradientH] = useState(1);
  const [numGradientLevels, setNumGradientLevels] = useState(0);
  const W = 240, H = 160;
  const tileSize = entry.tileSize || 8;
  const asset = entry.tilesetId ? fxAssets.find((a) => a.id === entry.tilesetId) : null;
  const gradientAsset = entry.gradientId ? fxAssets.find((a) => a.id === entry.gradientId) : null;
  const totalFrames = asset ? asset.cols * asset.rows : 0;

  // ── Load tileset image URL ──
  useEffect(() => {
    setTilesetUrl('');
    setFrame(0);
    setPaused(mode === 'exit');
    setFrames([]);
    if (!asset) return;
    const api = window.advanceAPI;
    if (!api) return;
    api.file.readImage(asset.filePath).then((r) => {
      if (r.success && r.dataUrl) setTilesetUrl(r.dataUrl);
    });
  }, [asset, mode]);

  // ── Pre-render all frames as canvases (white → transparent) ──
  useEffect(() => {
    if (!asset || !tilesetUrl) return;
    const img = new Image();
    img.onload = () => {
      const fw = img.naturalWidth / asset.cols;
      const fh = img.naturalHeight / asset.rows;
      const total = asset.cols * asset.rows;
      const out: HTMLCanvasElement[] = [];
      for (let f = 0; f < total; f++) {
        const col = f % asset.cols;
        const row = Math.floor(f / asset.cols);
        const c = document.createElement('canvas');
        c.width = fw; c.height = fh;
        const cx = c.getContext('2d')!;
        cx.imageSmoothingEnabled = false;
        cx.drawImage(img, col * fw, row * fh, fw, fh, 0, 0, fw, fh);
        makeWhiteTransparent(cx);
        out.push(c);
      }
      setFrames(out);
      if (mode === 'exit') {
        setFrame(Math.max(maxFrameSafe - 1, 0));
        setPaused(true);
      }
    };
    img.src = tilesetUrl;
  }, [asset, tilesetUrl, mode]);

  // ── Load gradient image data ──
  useEffect(() => {
    setGradientData(null);
    if (!gradientAsset) return;
    const api = window.advanceAPI;
    if (!api) return;
    api.file.readImage(gradientAsset.filePath).then((r) => {
      if (!r.success || !r.dataUrl) return;
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const cx = c.getContext('2d')!;
        cx.drawImage(img, 0, 0);
        const d = cx.getImageData(0, 0, img.naturalWidth, img.naturalHeight).data;
        setGradientData(d);
        setGradientW(img.naturalWidth);
        setGradientH(img.naturalHeight);
        // Contar niveles únicos de brillo
        const seen = new Set<number>();
        for (let i = 0; i < d.length; i += 4) {
          const b = Math.round((d[i] + d[i + 1] + d[i + 2]) / 3);
          seen.add(b);
        }
        setNumGradientLevels(seen.size);
      };
      img.src = r.dataUrl;
    });
  }, [gradientAsset]);

  // ── Cada nivel de brillo del degradado = un paso de animaci├│n ──
  const hasGradient = gradientData && gradientW > 0 && gradientH > 0 && numGradientLevels > 1;
  const extraFrames = hasGradient ? totalFrames : 0;
  const maxFrame = hasGradient ? numGradientLevels + extraFrames : (totalFrames > 1 ? totalFrames : 1);
  const fadeFrames = entry.type === 'fade' ? Math.max(2, Math.round((entry.animSpeed || 5) * 10)) : 1;
  const actualMaxFrame = entry.type === 'fade' ? fadeFrames : maxFrame;
  const maxFrameSafe = actualMaxFrame > 1 ? actualMaxFrame : 1;

  useEffect(() => {
    if (entry.type === 'instant') return;
    if (entry.type !== 'fade' && (!asset || totalFrames <= 1 || frames.length === 0)) return;
    const totalMs = (entry.animSpeed || 5) * 1000;
    const steps = Math.max(1, maxFrameSafe);
    const tick = Math.max(16, totalMs / steps);

    if (paused) {
      const id = setTimeout(() => {
        setPaused(false);
        setFrame(mode === 'exit' ? maxFrameSafe - 1 : 0);
      }, 2000);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => {
      setFrame((prev) => {
        if (mode === 'exit') {
          if (prev <= 0) { setPaused(true); return 0; }
          return prev - 1;
        }
        if (prev >= maxFrameSafe - 1) { setPaused(true); return prev; }
        return prev + 1;
      });
    }, tick);
    return () => clearTimeout(id);
  }, [frame, asset, totalFrames, frames.length, paused, mode, maxFrameSafe, entry]);

  // ── Draw ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = W;
    canvas.height = H;
    ctx.imageSmoothingEnabled = false;

    if (entry.type === 'instant') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 40px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(bgLabel, W / 2, H / 2);
      return;
    }

    if (entry.type === 'fade') {
      const progress = maxFrameSafe > 1
        ? Math.min(1, Math.max(0, (mode === 'exit' ? (maxFrameSafe - 1 - frame) : frame) / (maxFrameSafe - 1)))
        : 0;
      // Entry: black → scene (alpha goes 1→0). Exit: scene → black (alpha goes 0→1)
      const alpha = mode === 'exit' ? progress : 1 - progress;
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 40px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(bgLabel, W / 2, H / 2);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      return;
    }

    // Scene background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bgLabel, W / 2, H / 2);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    for (let x = tileSize; x < W; x += tileSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = tileSize; y < H; y += tileSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Cada tile: aparece seg├║n su brillo, anima totalFrames pasos, luego se queda negro
    const tilesX = Math.ceil(W / tileSize);
    const tilesY = Math.ceil(H / tileSize);
    if (frames.length > 0 && totalFrames > 1 && frame >= 0 && frame < maxFrameSafe) {
      for (let ty = 0; ty < tilesY; ty++) {
        for (let tx = 0; tx < tilesX; tx++) {
          let age = totalFrames; // sin gradiente: siempre visible
          if (hasGradient) {
            const gx = tx % gradientW;
            const gy = ty % gradientH;
            const gi = (gy * gradientW + gx) * 4;
            const brightness = (gradientData![gi] + gradientData![gi + 1] + gradientData![gi + 2]) / (255 * 3);
            const firstPhase = Math.round((1 - brightness) * (numGradientLevels - 1));
            age = frame - firstPhase;
          }
          if (age < 0) continue; // a├║n no visible → fondo de escena
          if (age >= totalFrames) {
            ctx.fillStyle = '#000000';
            ctx.fillRect(tx * tileSize, ty * tileSize, tileSize, tileSize);
          } else {
            const fc = frames[age % totalFrames];
            if (fc) ctx.drawImage(fc, tx * tileSize, ty * tileSize, tileSize, tileSize);
          }
        }
      }
    }
  }, [tileSize, frames, frame, paused, bgColor, bgLabel, gradientData, gradientW, gradientH, totalFrames, maxFrameSafe, hasGradient, numGradientLevels]);

  return (
    <canvas ref={canvasRef}
      style={{
        width: '100%', aspectRatio: '3 / 2', maxWidth: 360,
        background: '#000', borderRadius: 0,
        border: '1px solid var(--border-color)',
        imageRendering: 'pixelated',
      }}
    />
  );
}

function TransitionSectionContent({
  config, onChange, otherConfig, onOtherChange, fxAssets, projectDir, label, color,
}: {
  config: TransitionConfig;
  onChange: (patch: Partial<TransitionConfig>) => void;
  otherConfig?: TransitionConfig;
  onOtherChange?: (patch: Partial<TransitionConfig>) => void;
  fxAssets: FxAsset[];
  projectDir: string | null;
  label: string;
  color: string;
}) {
  const STYLE = { fontSize: 10, color: 'var(--text-secondary)' };
  const selType = config.type || 'fade';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <label style={STYLE}>Tipo:</label>
        <select value={selType}
          onChange={(e) => {
            const newType = e.target.value as TransitionType;
            onChange({ type: newType });
            if (newType === 'instant' && otherConfig && onOtherChange) {
              onOtherChange({ type: 'instant' });
            }
          }}
          style={{ flex: 1, background: 'var(--bg-canvas)', border: '1px solid var(--border-color)', borderRadius: 4, color: '#fff', fontSize: 10, padding: '4px 6px' }}>
          <option value="fade">Degradado</option>
          <option value="instant">Instantánea</option>
          <option value="custom">Personalizada</option>
        </select>
      </div>
      {selType === 'custom' ? (
        <>
          <TransitionPreview entry={config} fxAssets={fxAssets} mode={label === 'Entrada' ? 'entry' : 'exit'} bgColor={color} bgLabel={label === 'Entrada' ? 'A' : 'B'} />
          <TilesetSelector
            value={config.tilesetId}
            fxAssets={fxAssets}
            onChange={(id) => onChange({ tilesetId: id })}
            projectDir={projectDir}
          />
          <TilesetOptions
            tilesetId={config.tilesetId}
            fxAssets={fxAssets}
            tileSize={config.tileSize}
          />
          <GradientSelector
            value={config.gradientId}
            fxAssets={fxAssets}
            onChange={(id) => onChange({ gradientId: id })}
            projectDir={projectDir}
          />
        </>
      ) : selType === 'fade' ? (
        <TransitionPreview entry={config} fxAssets={fxAssets} mode={label === 'Entrada' ? 'entry' : 'exit'} bgColor={color} bgLabel={label === 'Entrada' ? 'A' : 'B'} />
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <label style={STYLE}>Duración:</label>
        <input type="number" value={config.animSpeed || 5} min={0.1} max={60} step={0.1}
          onChange={(e) => {
            const sec = Math.max(0.1, Math.min(60, parseFloat(e.target.value) || 5));
            onChange({ animSpeed: sec, duration: sec });
          }}
          style={{ width: 50, background: 'var(--bg-canvas)', border: '1px solid var(--border-color)', borderRadius: 4, color: '#fff', fontSize: 10, padding: '2px 4px' }}
        />
        <span style={STYLE}>seg</span>
      </div>
    </div>
  );
}

function buildTransitionSections(
  entry: TransitionConfig,
  fxAssets: FxAsset[],
  onChangeEntry: (patch: Partial<TransitionConfig>) => void,
  projectDir: string | null,
  exit?: TransitionConfig,
  onChangeExit?: (patch: Partial<TransitionConfig>) => void,
): InspectorSection[] {
  return [
    {
      title: 'Transición (entrada)',
      content: <TransitionSectionContent config={entry} onChange={onChangeEntry} otherConfig={exit} onOtherChange={onChangeExit} fxAssets={fxAssets} projectDir={projectDir} label="Entrada" color="#4488cc" />,
    },
    ...(exit && onChangeExit ? [{
      title: 'Transición (salida)',
      content: <TransitionSectionContent config={exit} onChange={onChangeExit} otherConfig={entry} onOtherChange={onChangeEntry} fxAssets={fxAssets} projectDir={projectDir} label="Salida" color="#88cc66" />,
    }] : []),
  ];
}

export function MundoTab() {
  const scenes = useAppStore((s) => s.scenes);
  const connections = useAppStore((s) => s.sceneConnections);
  const songs = useAppStore((s) => s.songs);
  const sounds = useAppStore((s) => s.sounds);
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
  const setCollisionTile = useAppStore((s) => s.setCollisionTile);
  const clearCollisionMap = useAppStore((s) => s.clearCollisionMap);
  const updateScene = useAppStore((s) => s.updateScene);
  const addConnection = useAppStore((s) => s.addConnection);
  const removeConnection = useAppStore((s) => s.removeConnection);
  const updateConnection = useAppStore((s) => s.updateConnection);
  const backgrounds = useAppStore((s) => s.backgrounds);
  const exportLog = useAppStore((s) => s.exportLog);
  const fxAssets = useAppStore((s) => s.fxAssets);
  const projectDir = useAppStore((s) => s.projectDir);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [exportLog.length]);
  const splashScreen = useAppStore((s) => s.splashScreen);
  const updateSplashScreen = useAppStore((s) => s.updateSplashScreen);

  const [tool, setTool] = useState<'select' | 'add' | 'connect' | 'remove' | 'collision' | 'move' | 'actor'>('move');
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [splashImgSize, setSplashImgSize] = useState<{w: number, h: number} | null>(null);
  const [sceneAnimPaused, setSceneAnimPaused] = useState<Record<string, boolean>>({});
  const themeAccent = useAppStore((s) => s.themeAccent);
  const [radialPick, setRadialPick] = useState('');
  const [radialOpen, setRadialOpen] = useState(false);
  const [radialCollisionsOpen, setRadialCollisionsOpen] = useState(false);
  const radialTimer = useRef<number>(0);
  useEffect(() => () => window.clearTimeout(radialTimer.current), []);

  const radialItems = useMemo<RadialMenuItem[]>(() => [
    { label: 'Escena', Icon: MapPin, iconName: 'MapPin', color: themeAccent },
    { label: 'Actor', Icon: User, iconName: 'User', color: themeAccent },
    { label: 'Link', Icon: Link2, iconName: 'Link2', color: themeAccent },
    { label: 'Colisiones', Icon: Shield, iconName: 'Shield', color: themeAccent },
  ], [themeAccent]);

  const onRadialPick = (item: RadialMenuItem) => {
    setRadialCollisionsOpen(false);
    if (item.iconName === 'Shield') {
      setCollisionBrush('draw');
      setTool('collision');
      setRadialPick('');
      setRadialCollisionsOpen(true);
      return;
    }
    if (item.iconName === 'MapPin') {
      const el = canvasContainerRef.current;
      const wX = el ? (el.clientWidth / 2 - panX) / zoom : 240;
      const wY = el ? (el.clientHeight / 2 - panY) / zoom : 80;
      addScene(wX, wY);
      setRadialPick('Escena creada');
    } else if (item.iconName === 'Link2') {
      setTool('connect');
      setConnectFrom(null);
      setRadialPick('Selecciona dos escenas para conectar');
    } else {
      setRadialPick(`${item.label} seleccionado`);
    }
    window.clearTimeout(radialTimer.current);
    radialTimer.current = window.setTimeout(() => setRadialPick(''), 2200);
  };

  // Menú cerrado sin operación activa → se comporta como "Mover"
  const effectiveTool: 'select' | 'add' | 'connect' | 'remove' | 'collision' | 'move' | 'actor' =
    (tool === 'add' || tool === 'connect' || tool === 'collision' || tool === 'actor')
      ? tool
      : radialOpen
        ? tool
        : 'move';

  // ── Context menu ──
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; sceneId?: string; connectionId?: string } | null>(null);

  // ── Grid ──
  const mundoShowGrid = useAppStore((s) => s.mundoShowGrid);
  const setMundoShowGrid = useAppStore((s) => s.setMundoShowGrid);
  const mundoGridSize = useAppStore((s) => s.mundoGridSize);
  const setMundoGridSize = useAppStore((s) => s.setMundoGridSize);
  const mundoGridOpacity = useAppStore((s) => s.mundoGridOpacity);
  const mundoGridStrokeWidth = useAppStore((s) => s.mundoGridStrokeWidth);
  const mundoGridColor = useAppStore((s) => s.mundoGridColor);
  const connColorOut = useAppStore((s) => s.connColorOut);
  const connColorIn = useAppStore((s) => s.connColorIn);
  const connStrokeWidth = useAppStore((s) => s.connStrokeWidth);
  const [gridMenuOpen, setGridMenuOpen] = useState(false);
  const gridMenuRef = useRef<HTMLDivElement | null>(null);
  const [collisionBrush, setCollisionBrush] = useState<CollisionBrush>('block');
  const [collisionPaintValue, setCollisionPaintValue] = useState(COLLISION_SOLID);
  const [collisionBlockSize, setCollisionBlockSize] = useState(1);

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
        img.onload = () => { if (!cancelled) setSplashImgSize({ w: img.naturalWidth, h: img.naturalHeight     });
    const splashNextScene = scenes.find((s) => s.id === splashScreen.nextSceneId);
    inspectorSections.push({
      title: 'Siguiente escena',
      content: (
        <div ref={sceneDropdownRef} style={{ position: 'relative' }}>
          <div
            onClick={() => setSceneDropdownOpen(!sceneDropdownOpen)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '4px 8px', fontSize: 11, cursor: 'pointer',
              background: 'var(--bg-canvas)', border: '1px solid var(--border-color)',
              borderRadius: 4, color: splashScreen.nextSceneId ? '#fff' : 'var(--text-muted)',
            }}
          >
            <span>{splashNextScene?.name ?? 'Ninguna'}</span>
            <span style={{ fontSize: 8, opacity: 0.6 }}>{sceneDropdownOpen ? '▲' : '▼'}</span>
          </div>
          {sceneDropdownOpen && (
            <div style={{
              position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 2,
              background: 'var(--bg-panel)', border: '1px solid var(--border-color)',
              borderRadius: 4, padding: 4, zIndex: 100, maxHeight: 200, overflow: 'hidden',
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <input
                type="text"
                value={sceneSearch}
                onChange={(e) => setSceneSearch(e.target.value)}
                placeholder="Buscar escena..."
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
                  onClick={() => { updateSplashScreen({ nextSceneId: '' }); setSceneDropdownOpen(false); setSceneSearch(''); }}
                  style={{
                    padding: '4px 6px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                    background: !splashScreen.nextSceneId ? 'var(--accent)' : 'transparent',
                    color: !splashScreen.nextSceneId ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  Ninguna
                </div>
                {filteredScenes.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => { updateSplashScreen({ nextSceneId: s.id }); setSceneDropdownOpen(false); setSceneSearch(''); }}
                    style={{
                      padding: '4px 6px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                      background: splashScreen.nextSceneId === s.id ? 'var(--accent)' : 'transparent',
                      color: splashScreen.nextSceneId === s.id ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {s.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ),
    });
  };
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
  const zoomRef = useRef(1);
  const panXRef = useRef(0);
  const panYRef = useRef(0);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const hasMoved = useRef(false);
  const mouseCanvasPos = useRef({ x: 0, y: 0 });
  const [mouseWorld, setMouseWorld] = useState({ x: 0, y: 0 });
  const [highlightedConnId, setHighlightedConnId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const splashConnection = useMemo(() => {
    if (!splashScreen.nextSceneId) return null;
    return {
      id: '__splash_conn__', fromSceneId: splashScreen.id, toSceneId: splashScreen.nextSceneId, label: '',
      usePauseScreen: splashScreen.usePauseScreen,
      pauseColor: splashScreen.pauseColor,
      entryTransition: splashScreen.entryTransition,
      exitTransition: splashScreen.exitTransition,
    };
  }, [splashScreen.nextSceneId, splashScreen.id, splashScreen.usePauseScreen, splashScreen.pauseColor, splashScreen.entryTransition, splashScreen.exitTransition]);

  const visibleConnections = useMemo(() => {
    if (!selectedNodeId) return [];
    const storeConns = connections.filter(
      (c) => c.fromSceneId === selectedNodeId || c.toSceneId === selectedNodeId
    );
    const result = [...storeConns];
    if (splashConnection && (splashConnection.fromSceneId === selectedNodeId || splashConnection.toSceneId === selectedNodeId)) {
      result.push(splashConnection);
    }
    return result;
  }, [connections, selectedNodeId, splashConnection]);

  const svgBounds = useMemo(() => {
    if (scenes.length === 0) return { x: -500, y: -500, w: 1000, h: 1000 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const sc of scenes) {
      const r = sc.x + sc.width;
      const b = sc.y + 18 + sc.height;
      if (sc.x < minX) minX = sc.x;
      if (sc.y < minY) minY = sc.y;
      if (r > maxX) maxX = r;
      if (b > maxY) maxY = b;
    }
    // Include splash screen in bounds
    const sp = splashScreen;
    const spR = sp.x + 260;
    const spB = sp.y + 200;
    if (sp.x < minX) minX = sp.x;
    if (sp.y < minY) minY = sp.y;
    if (spR > maxX) maxX = spR;
    if (spB > maxY) maxY = spB;
    // Also include connections endpoint (splash center)
    const pad = 300;
    return { x: minX - pad, y: minY - pad, w: (maxX - minX) + pad * 2, h: (maxY - minY) + pad * 2 };
  }, [scenes, splashScreen.x, splashScreen.y]);

  // Recalc mouseWorld when pan/zoom change (e.g. after wheel zoom)
  useEffect(() => {
    setMouseWorld((prev) => {
      const mx = mouseCanvasPos.current.x;
      const my = mouseCanvasPos.current.y;
      const newX = (mx - panX) / zoom;
      const newY = (my - panY) / zoom;
      if (Math.abs(newX - prev.x) < 0.01 && Math.abs(newY - prev.y) < 0.01) return prev;
      return { x: newX, y: newY };
    });
  }, [panX, panY, zoom]);

  // Keep refs in sync with state for the wheel handler
  useEffect(() => {
    zoomRef.current = zoom;
    panXRef.current = panX;
    panYRef.current = panY;
  }, [zoom, panX, panY]);

  // ── Panel resize is managed by ResizableEditorLayout ────────────────────

  // Keep latest scene list and selection for wheel handler
  // (reserved for future use)

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
        const z = zoomRef.current;
        const newZ = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z - e.deltaY * 0.001));
        const k = newZ / z;
        // Mantener el punto del mundo bajo el cursor fijo
        panXRef.current = mx - (mx - panXRef.current) * k;
        panYRef.current = my - (my - panYRef.current) * k;
        zoomRef.current = newZ;
        setZoom(newZ);
        setPanX(panXRef.current);
        setPanY(panYRef.current);
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
      items: visibleConnections.map((c) => {
        const from = scenes.find((s) => s.id === c.fromSceneId) ?? (c.fromSceneId === splashScreen.id ? splashScreen : undefined);
        const to = scenes.find((s) => s.id === c.toSceneId) ?? (c.toSceneId === splashScreen.id ? splashScreen : undefined);
        const isFrom = c.fromSceneId === selectedNodeId;
        return { id: c.id, label: `${from?.name ?? '?'} → ${to?.name ?? '?'}`, color: isFrom ? connColorOut : connColorIn };
      }),
    },
  ];

  const selectedScene = scenes.find((sc) => sc.id === selectedNodeId);
  const selectedSplash = selectedNodeId === splashScreen.id ? splashScreen : null;
  const selectedConnection = useMemo(() => {
    const connId = highlightedConnId || selectedNodeId;
    if (connId === '__splash_conn__') return splashConnection;
    return connections.find((c) => c.id === connId) ?? null;
  }, [connections, selectedNodeId, highlightedConnId, splashConnection]);
  const [songSearch, setSongSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [imgDropdownOpen, setImgDropdownOpen] = useState(false);
  const [imgSearch, setImgSearch] = useState('');
  const imgDropdownRef = useRef<HTMLDivElement | null>(null);
  const [tipoDropdownOpen, setTipoDropdownOpen] = useState(false);
  const [tipoSearch, setTipoSearch] = useState('');
  const tipoDropdownRef = useRef<HTMLDivElement | null>(null);
  const [sceneDropdownOpen, setSceneDropdownOpen] = useState(false);
  const [sceneSearch, setSceneSearch] = useState('');
  const sceneDropdownRef = useRef<HTMLDivElement | null>(null);

  const musicSounds = useMemo(() => sounds.filter((sd) => sd.usage === 'music'), [sounds]);

  const filteredSongs = useMemo(() => {
    if (!songSearch) return songs;
    const q = songSearch.toLowerCase();
    return songs.filter((so) => so.name.toLowerCase().includes(q));
  }, [songs, songSearch]);

  const filteredMusicSounds = useMemo(() => {
    if (!songSearch) return musicSounds;
    const q = songSearch.toLowerCase();
    return musicSounds.filter((sd) => sd.name.toLowerCase().includes(q));
  }, [musicSounds, songSearch]);

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

  const filteredScenes = useMemo(() => {
    if (!sceneSearch) return scenes;
    const q = sceneSearch.toLowerCase();
    return scenes.filter((s) => s.name.toLowerCase().includes(q));
  }, [scenes, sceneSearch]);

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

  // Reaccionar a cambios de rescale en capas de imagen: si una escena usa una capa con rescale=true, forzar 240×160
  useEffect(() => {
    const st = useAppStore.getState();
    for (const sc of st.scenes) {
      if (!sc.backgroundImage) continue;
      const layer = st.backgrounds.flatMap((bg) => bg.layers).find((l) => l.imagePath === sc.backgroundImage);
      if (!layer) continue;
      if (layer.rescale && (sc.width !== 240 || sc.height !== 160)) {
        st.updateScene(sc.id, { width: 240, height: 160 });
      }
    }
  }, [backgrounds]);

  const inspectorSections: InspectorSection[] = [];
  if (selectedScene && !selectedConnection) {
    inspectorSections.push({
      title: 'Escena',
      fields: selectedScene.backgroundImage
        ? [
            { label: 'Nombre', type: 'text', value: selectedScene.name, onChange: (v) => updateScene(selectedScene.id, { name: v as string }) },
          ]
        : [
            { label: 'Nombre', type: 'text', value: selectedScene.name, onChange: (v) => updateScene(selectedScene.id, { name: v as string }) },
            { label: 'Ancho (px)', type: 'number', value: selectedScene.width, min: 240, step: 1, onChange: (v) => updateScene(selectedScene.id, { width: v as number }) },
            { label: 'Alto (px)', type: 'number', value: selectedScene.height, min: 160, step: 1, onChange: (v) => updateScene(selectedScene.id, { height: v as number }) },
          ],
    });
    // Show read-only dimensions when background image is set
    if (selectedScene.backgroundImage) {
      const dLayer = backgrounds.flatMap((bg) => bg.layers).find((l) => l.imagePath === selectedScene.backgroundImage);
      inspectorSections.push({
        title: 'Dimensiones',
        content: (
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '2px 0' }}>
            {selectedScene.width} × {selectedScene.height} px
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
              {dLayer?.rescale ? 'Reescalada a GBA (240×160)' : 'Tamaño original de la imagen'}
            </div>
          </div>
        ),
      });
    }
    // Camara (viewport) — solo si la escena es mas grande que la pantalla GBA
    if (selectedScene.width > 240 || selectedScene.height > 160) {
      inspectorSections.push({
        title: 'Camara',
        fields: [
          {
            label: 'Camara X', type: 'number', value: selectedScene.cameraX,
            min: 0, max: selectedScene.width - 240, step: 1,
            onChange: (v) => updateScene(selectedScene.id, { cameraX: Math.min(Math.max(v as number, 0), selectedScene.width - 240) as number }),
          },
          {
            label: 'Camara Y', type: 'number', value: selectedScene.cameraY,
            min: 0, max: selectedScene.height - 160, step: 1,
            onChange: (v) => updateScene(selectedScene.id, { cameraY: Math.min(Math.max(v as number, 0), selectedScene.height - 160) as number }),
          },
        ],
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
                        const matchingBgLayer = backgrounds.flatMap((bg) => bg.layers).find((l) => l.imagePath === img.value);
                        const result = await api.file.readImage(img.value);
                        const patch: Partial<Scene> = { backgroundImage: img.value };
                        if (matchingBgLayer?.rescale) {
                          patch.width = 240;
                          patch.height = 160;
                        } else if (result.success && result.width && result.height) {
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
    const selectedBgSound = sounds.find((sd) => sd.id === selectedScene.backgroundSoundId);
    const hasBgm = !!(selectedScene.backgroundSong || selectedScene.backgroundSoundId);
    const displayBgmName = selectedBgSong?.name ?? selectedBgSound?.name ?? 'Ninguna';
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
              borderRadius: 4, color: hasBgm ? '#fff' : 'var(--text-muted)',
            }}
          >
            <span>{displayBgmName}</span>
            <span style={{ fontSize: 8, opacity: 0.6 }}>{dropdownOpen ? '▲' : '▼'}</span>
          </div>
          {selectedScene.backgroundSoundId && (
            <div style={{
              marginTop: 6, padding: '6px 8px', background: '#2a1a1a',
              border: '1px solid #8a3a3a', borderRadius: 4, fontSize: 10, color: '#f0a0a0',
            }}>
              <strong style={{ fontSize: 11 }}>⚠ Posibles fallos como música de fondo:</strong>
              <ul style={{ margin: '4px 0 0 0', paddingLeft: 14 }}>
                <li>No loop automático — el sonido se reproduce una sola vez</li>
                <li>Sin control de tempo o compás</li>
                <li>Sin mezcla con efectos SFX (un solo canal)</li>
                <li>Sin pausa/transición entre escenas</li>
                <li>Formato WAV/MP3 pesado para ROM GBA</li>
              </ul>
            </div>
          )}
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
                placeholder="Buscar..."
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
                  onClick={() => { updateScene(selectedScene.id, { backgroundSong: '', backgroundSoundId: undefined }); setDropdownOpen(false); setSongSearch(''); }}
                  style={{
                    padding: '4px 6px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                    background: !hasBgm ? 'var(--accent)' : 'transparent',
                    color: !hasBgm ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  Ninguna
                </div>
                {filteredSongs.length > 0 && (
                  <>
                    <div style={{ padding: '2px 6px', fontSize: 9, color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', marginTop: 2 }}>Canciones</div>
                    {filteredSongs.map((so) => (
                      <div
                        key={so.id}
                        onClick={() => { updateScene(selectedScene.id, { backgroundSong: so.id, backgroundSoundId: undefined }); setDropdownOpen(false); setSongSearch(''); }}
                        style={{
                          padding: '4px 6px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                          background: selectedScene.backgroundSong === so.id ? 'var(--accent)' : 'transparent',
                          color: selectedScene.backgroundSong === so.id ? '#fff' : 'var(--text-secondary)',
                        }}
                      >
                        {so.name}
                      </div>
                    ))}
                  </>
                )}
                {filteredMusicSounds.length > 0 && (
                  <>
                    <div style={{ padding: '2px 6px', fontSize: 9, color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', marginTop: 2 }}>Sonidos (música)</div>
                    {filteredMusicSounds.map((sd) => (
                      <div
                        key={sd.id}
                        onClick={() => { updateScene(selectedScene.id, { backgroundSoundId: sd.id, backgroundSong: '' }); setDropdownOpen(false); setSongSearch(''); }}
                        style={{
                          padding: '4px 6px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                          background: selectedScene.backgroundSoundId === sd.id ? 'var(--accent)' : 'transparent',
                          color: selectedScene.backgroundSoundId === sd.id ? '#fff' : 'var(--text-secondary)',
                        }}
                      >
                        {sd.name}
                      </div>
                    ))}
                  </>
                )}
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

  if (selectedSplash && !selectedConnection) {
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
    const splashBgSound = sounds.find((sd) => sd.id === selectedSplash.backgroundSoundId);
    const splashHasBgm = !!(selectedSplash.backgroundSong || selectedSplash.backgroundSoundId);
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
              borderRadius: 4, color: splashHasBgm ? '#fff' : 'var(--text-muted)',
            }}
          >
            <span>{splashBgSong?.name ?? splashBgSound?.name ?? 'Ninguna'}</span>
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
                placeholder="Buscar..."
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
                  onClick={() => { updateSplashScreen({ backgroundSong: '', backgroundSoundId: undefined }); setDropdownOpen(false); setSongSearch(''); }}
                  style={{
                    padding: '4px 6px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                    background: !splashHasBgm ? 'var(--accent)' : 'transparent',
                    color: !splashHasBgm ? '#fff' : 'var(--text-secondary)',
                  }}
                >
                  Ninguna
                </div>
                {filteredSongs.length > 0 && (
                  <>
                    <div style={{ padding: '2px 6px', fontSize: 9, color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', marginTop: 2 }}>Canciones</div>
                    {filteredSongs.map((so) => (
                      <div
                        key={so.id}
                        onClick={() => { updateSplashScreen({ backgroundSong: so.id, backgroundSoundId: undefined }); setDropdownOpen(false); setSongSearch(''); }}
                        style={{
                          padding: '4px 6px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                          background: selectedSplash.backgroundSong === so.id ? 'var(--accent)' : 'transparent',
                          color: selectedSplash.backgroundSong === so.id ? '#fff' : 'var(--text-secondary)',
                        }}
                      >
                        {so.name}
                      </div>
                    ))}
                  </>
                )}
                {filteredMusicSounds.length > 0 && (
                  <>
                    <div style={{ padding: '2px 6px', fontSize: 9, color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', marginTop: 2 }}>Sonidos (música)</div>
                    {filteredMusicSounds.map((sd) => (
                      <div
                        key={sd.id}
                        onClick={() => { updateSplashScreen({ backgroundSoundId: sd.id, backgroundSong: '' }); setDropdownOpen(false); setSongSearch(''); }}
                        style={{
                          padding: '4px 6px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                          background: selectedSplash.backgroundSoundId === sd.id ? 'var(--accent)' : 'transparent',
                          color: selectedSplash.backgroundSoundId === sd.id ? '#fff' : 'var(--text-secondary)',
                        }}
                      >
                        {sd.name}
                      </div>
                    ))}
                  </>
                )}
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
    inspectorSections.push({
      title: 'Pantalla de pausa',
      fields: [
        {
          label: 'Usar pausa', type: 'toggle', value: selectedSplash.usePauseScreen,
          onChange: (v) => updateSplashScreen({ usePauseScreen: v as boolean }),
        },
        ...(selectedSplash.usePauseScreen ? [{
          label: 'Color', type: 'color' as const, value: selectedSplash.pauseColor,
          onChange: (v: string | number | boolean) => updateSplashScreen({ pauseColor: v as string }),
        }] : []),
        {
          label: 'Tile', type: 'select', value: selectedSplash.entryTransition.tileSize,
          options: [{ value: '8', label: '8×8' }, { value: '10', label: '10×10' }, { value: '16', label: '16×16' }],
          onChange: (v) => updateSplashScreen({
            entryTransition: { ...selectedSplash.entryTransition, tileSize: Number(v) },
            exitTransition: { ...selectedSplash.exitTransition, tileSize: Number(v) },
          }),
        },
      ],
    });
    inspectorSections.push(...buildTransitionSections(
      selectedSplash.entryTransition, fxAssets,
      (patch) => updateSplashScreen({ entryTransition: { ...selectedSplash.entryTransition, ...patch } }),
      projectDir,
      selectedSplash.exitTransition,
      (patch) => updateSplashScreen({ exitTransition: { ...selectedSplash.exitTransition, ...patch } }),
    ));
  }

  // ── Connection inspector ────────────────────────────────────────────
  if (selectedConnection) {
    const isSplashConn = selectedConnection === splashConnection;
    const fromScene = scenes.find((s) => s.id === selectedConnection.fromSceneId);
    const toScene = scenes.find((s) => s.id === selectedConnection.toSceneId);
    inspectorSections.push({
      title: 'Conexión',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 64, flexShrink: 0 }}>Origen</span>
            <span style={{ color: 'var(--text)', fontSize: 11 }}>{fromScene?.name ?? '?'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 64, flexShrink: 0 }}>Destino</span>
            <span style={{ color: 'var(--text)', fontSize: 11 }}>{toScene?.name ?? '?'}</span>
          </div>
          {!isSplashConn && (
            <button onClick={() => { removeConnection(selectedConnection.id); setSelectedNodeId(''); setHighlightedConnId(null); }}
              style={{ padding: '4px 8px', fontSize: 10, cursor: 'pointer', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, alignSelf: 'flex-start' }}>
              Eliminar conexión
            </button>
          )}
        </div>
      ),
    });
    if (isSplashConn) {
      inspectorSections.push({
        title: 'Pantalla de pausa',
        fields: [
          {
            label: 'Usar pausa', type: 'toggle', value: splashScreen.usePauseScreen,
            onChange: (v) => updateSplashScreen({ usePauseScreen: v as boolean }),
          },
          ...(splashScreen.usePauseScreen ? [{
            label: 'Color', type: 'color' as const, value: splashScreen.pauseColor,
            onChange: (v: string | number | boolean) => updateSplashScreen({ pauseColor: v as string }),
          }] : []),
          {
            label: 'Tile', type: 'select', value: splashScreen.entryTransition.tileSize,
            options: [{ value: '8', label: '8×8' }, { value: '10', label: '10×10' }, { value: '16', label: '16×16' }],
            onChange: (v) => updateSplashScreen({
              entryTransition: { ...splashScreen.entryTransition, tileSize: Number(v) },
              exitTransition: { ...splashScreen.exitTransition, tileSize: Number(v) },
            }),
          },
        ],
      });
      inspectorSections.push(...buildTransitionSections(
        splashScreen.entryTransition, fxAssets,
        (patch) => updateSplashScreen({ entryTransition: { ...splashScreen.entryTransition, ...patch } }),
        projectDir,
        splashScreen.exitTransition,
        (patch) => updateSplashScreen({ exitTransition: { ...splashScreen.exitTransition, ...patch } }),
      ));
    } else {
      inspectorSections.push({
        title: 'Pantalla de pausa',
        fields: [
          {
            label: 'Usar pausa', type: 'toggle', value: selectedConnection.usePauseScreen,
            onChange: (v) => updateConnection(selectedConnection.id, { usePauseScreen: v as boolean }),
          },
          ...(selectedConnection.usePauseScreen ? [{
            label: 'Color', type: 'color' as const, value: selectedConnection.pauseColor,
            onChange: (v: string | number | boolean) => updateConnection(selectedConnection.id, { pauseColor: v as string }),
          }] : []),
          {
            label: 'Tile', type: 'select', value: selectedConnection.entryTransition.tileSize,
            options: [{ value: '8', label: '8×8' }, { value: '10', label: '10×10' }, { value: '16', label: '16×16' }],
            onChange: (v) => updateConnection(selectedConnection.id, {
              entryTransition: { ...selectedConnection.entryTransition, tileSize: Number(v) },
              exitTransition: { ...selectedConnection.exitTransition, tileSize: Number(v) },
            }),
          },
        ],
      });
      inspectorSections.push(...buildTransitionSections(
        selectedConnection.entryTransition, fxAssets,
        (patch) => updateConnection(selectedConnection.id, { entryTransition: { ...selectedConnection.entryTransition, ...patch } }),
        projectDir,
        selectedConnection.exitTransition,
        (patch) => updateConnection(selectedConnection.id, { exitTransition: { ...selectedConnection.exitTransition, ...patch } }),
      ));
    }
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
      if (effectiveTool === 'connect') {
        if (connectFrom === null) {
          setConnectFrom(sceneId);
        } else if (connectFrom !== sceneId) {
          // clicking splash as target -> cancel (splash only outgoing)
          setConnectFrom(null);
        }
      }
      return;
    }
    if (effectiveTool === 'connect') {
      if (connectFrom === null) {
        setConnectFrom(sceneId);
      } else if (connectFrom !== sceneId) {
        if (connectFrom === splashScreen.id) {
          // splash → scene: use nextSceneId (only one connection allowed)
          connections.filter((c) => c.fromSceneId === splashScreen.id).forEach((c) => removeConnection(c.id));
          updateSplashScreen({ nextSceneId: sceneId });
          setConnectFrom(null);
          setTool('move');
        } else {
          addConnection(connectFrom, sceneId);
          setConnectFrom(null);
          setTool('move');
        }
      }
    } else if (effectiveTool === 'remove') {
      removeScene(sceneId);
      if (selectedNodeId === sceneId) setSelectedNodeId('');
    } else {
      setSelectedNodeId(sceneId);
    }
  };

  const handleRemove = (id: string) => {
    if (id === splashScreen.id) return;
    removeScene(id);
    setHighlightedConnId(null);
    if (selectedNodeId === id) setSelectedNodeId('');
  };

  return (
    <>
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
          selectedId={highlightedConnId || selectedNodeId}
          editingId={editingId}
          onRename={(id, name) => updateScene(id, { name })}
          onEditingChange={setEditingId}
          onDoubleClick={(id) => {
            const isScene = scenes.some((s) => s.id === id);
            if (isScene) setEditingId(id);
          }}
          onSelect={(id) => {
            setEditingId(null);
            const isConn = connections.some((c) => c.id === id) || id === '__splash_conn__';
            if (isConn) {
              setHighlightedConnId((prev) => prev === id ? null : id);
            } else {
              setSelectedNodeId(id);
              setHighlightedConnId(null);
            }
          }}
          onContextMenu={(id, x, y) => {
            if (id === splashScreen.id) return;
            const isConn = connections.some((c) => c.id === id) || id === '__splash_conn__';
            if (isConn) {
              if (id !== '__splash_conn__') setCtxMenu({ x, y, connectionId: id });
            } else {
              setCtxMenu({ x, y, sceneId: id });
            }
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
              <ToolBtn active={tool === 'actor'} onClick={() => { setTool('actor'); setConnectFrom(null); }} title="Actor"><User size={14} /></ToolBtn>
              <div style={{ width: 1, height: 14, background: 'var(--bg-raised)', margin: '0 2px' }} />
              <ToolBtn active={tool === 'connect'} onClick={() => { setTool('connect'); setConnectFrom(null); }} title="Conectar escenas">
                {connectFrom ? '→' : '🔗'}
              </ToolBtn>
              <div style={{ width: 1, height: 14, background: 'var(--bg-raised)', margin: '0 2px' }} />
              <ToolBtn active={tool === 'collision'} onClick={() => { setTool('collision'); setConnectFrom(null); }} title="Pintar colisión">▦</ToolBtn>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <ToolBtn
                active={mundoShowGrid}
                onClick={() => setMundoShowGrid(!mundoShowGrid)}
                title="Mostrar grid"
                style={{ opacity: mundoShowGrid ? 1 : 0.5 }}
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
                        onClick={() => { setMundoGridSize(s); setGridMenuOpen(false); }}
                        style={{
                          padding: '4px 8px', fontSize: 11, borderRadius: 4, cursor: 'pointer',
                          background: mundoGridSize === s ? 'var(--accent)' : 'transparent',
                          color: mundoGridSize === s ? '#fff' : 'var(--text-secondary)',
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
              if (e.button === 2 && connectFrom) {
                setConnectFrom(null);
                return;
              }
              const onScene = (e.target as HTMLElement).closest('[data-scene-card]') !== null;
              if (e.button === 1 || tool === 'select' || tool === 'add') {
                handleMouseDownCanvas(e);
              } else if (e.button === 0 && effectiveTool === 'move' && !onScene) {
                handleMouseDownCanvas(e);
              }
            }}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const sx = e.clientX - rect.left;
              const sy = e.clientY - rect.top;
              mouseCanvasPos.current = { x: sx, y: sy };
              setMouseWorld({ x: (sx - panX) / zoom, y: (sy - panY) / zoom });
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
            {tool === 'collision' && (
              <div style={{
                position: 'absolute', top: 6, left: 6,
                zIndex: 50, display: 'flex', alignItems: 'center', gap: 2,
                padding: '4px 10px', background: 'rgba(45,45,51,0.92)',
                borderRadius: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
                backdropFilter: 'blur(6px)',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 2,
                  background: 'var(--bg-canvas)', borderRadius: 20,
                  padding: '3px 4px',
                }}>
                  <ToolBtn active={false} title="Bote (rellenar) — pronto">▤</ToolBtn>
                    <ToolBtn active={false} title="Barita (seleccionar) — pronto">⌾</ToolBtn>
                  <ToolBtn active={collisionBrush === 'draw'}
                    onClick={() => setCollisionBrush('draw')}
                    title="Dibujar (arrastra para pintar, clic derecho para borrar)"
                  >✎</ToolBtn>
                  <ToolBtn active={collisionBrush === 'rectangle'}
                    onClick={() => setCollisionBrush('rectangle')}
                    title="Cuadro (arrastra para dibujar un rectángulo, clic derecho para borrar)"
                  >▢</ToolBtn>
                  {collisionBrush === 'draw' && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4,
                      transition: 'opacity 0.2s, transform 0.2s',
                    }}>
                      <input type="range" min={1} max={6} step={1}
                        value={collisionBlockSize}
                        onChange={(e) => setCollisionBlockSize(Number(e.target.value))}
                        style={{ width: 48, height: 4, accentColor: 'var(--accent)', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: 10, color: 'var(--text-secondary)', minWidth: 28, textAlign: 'center' }}>
                        {collisionBlockSize * 8}px
                      </span>
                    </div>
                  )}
                </div>
                <div style={{ width: 1, height: 14, background: 'var(--bg-raised)', margin: '0 4px' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {COLLISION_TYPES.map((p) => (
                    <div key={p.value}
                      onClick={() => {
                        setCollisionPaintValue(p.value);
                      }}
                      style={{
                        width: 20, height: 20, cursor: 'pointer',
                        border: collisionPaintValue === p.value ? '2px solid #fff' : '2px solid transparent',
                        outline: collisionPaintValue === p.value ? '1px solid var(--accent)' : 'none',
                        outlineOffset: 1,
                        borderRadius: 3,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(0,0,0,0.3)',
                      }}
                      title={p.title}
                    >
                      <svg width={16} height={16} viewBox="0 0 16 16">
                        {p.icon}
                      </svg>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                position: 'absolute',
                left: svgBounds.x, top: svgBounds.y,
                width: svgBounds.w, height: svgBounds.h,
                pointerEvents: 'none', zIndex: 100,
              }}>
                <defs>
                  <marker id="arrowOut" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill={connColorOut} />
                  </marker>
                  <marker id="arrowIn" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill={connColorIn} />
                  </marker>
                </defs>
                <style>{`@keyframes flow { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -16; } }`}</style>
                {visibleConnections.map((c) => {
                  const fromSc = scenes.find((s) => s.id === c.fromSceneId) ?? (c.fromSceneId === splashScreen.id ? splashScreen : undefined);
                  const toSc = scenes.find((s) => s.id === c.toSceneId) ?? (c.toSceneId === splashScreen.id ? splashScreen : undefined);
                  if (!fromSc || !toSc) return null;
                  const isFrom = c.fromSceneId === selectedNodeId;
                  const strokeColor = isFrom ? connColorOut : connColorIn;
                  const markerId = isFrom ? 'url(#arrowOut)' : 'url(#arrowIn)';
                  const isHighlighted = highlightedConnId === c.id;
                  const getCenter = (node: typeof fromSc) => {
                    if ('width' in node) {
                      // Scene node
                      return { x: node.x + node.width / 2, y: node.y + 18 + node.height / 2 };
                    }
                    // Splash node: fixed card size 260w × ~206h
                    return { x: node.x + 130, y: node.y + 108 };
                  };
                  const c1 = getCenter(fromSc);
                  const c2 = getCenter(toSc);
                  const x1 = c1.x - svgBounds.x;
                  const y1 = c1.y - svgBounds.y;
                  const x2 = c2.x - svgBounds.x;
                  const y2 = c2.y - svgBounds.y;
                  const dx = Math.abs(x2 - x1) * 0.4;
                  const hw = isHighlighted ? connStrokeWidth * 2 : connStrokeWidth;
                  return (
                    <g key={c.id}>
                      {isHighlighted && (
                        <path
                          d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
                          fill="none" stroke={strokeColor} strokeWidth={connStrokeWidth * 4} opacity={0.2}
                        />
                      )}
                      <path
                        d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
                        fill="none" stroke={strokeColor} strokeWidth={hw}
                        strokeDasharray="12 4"
                        markerEnd={markerId}
                        opacity={isHighlighted ? 1 : 0.6}
                        style={isHighlighted ? { animation: 'flow 0.8s linear infinite' } : undefined}
                      />
                      {/* hit area for click + context menu */}
                      <path
                        d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
                        fill="none" stroke="transparent" strokeWidth={24}
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          setHighlightedConnId((prev) => prev === c.id ? null : c.id);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setCtxMenu({ x: e.clientX, y: e.clientY, connectionId: c.id });
                        }}
                      />
                    </g>
                  );
                })}
                {connectFrom && (() => {
                  const fromSc = scenes.find((s) => s.id === connectFrom);
                  if (!fromSc) return null;
                  const x1 = fromSc.x + fromSc.width / 2 - svgBounds.x;
                  const y1 = fromSc.y + 18 + fromSc.height / 2 - svgBounds.y;
                  const x2 = mouseWorld.x - svgBounds.x;
                  const y2 = mouseWorld.y - svgBounds.y;
                  const dx = Math.abs(x2 - x1) * 0.4;
                  return (
                    <path
                      d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
                       fill="none" stroke={connColorOut} strokeWidth={connStrokeWidth}
                        strokeDasharray="12 4"
                      markerEnd="url(#arrowOut)"
                      opacity={0.5}
                    />
                  );
                })()}
              </svg>
              {/* SplashScreen card */}
                    <SplashCard
                      splash={splashScreen}
                      selected={selectedNodeId === splashScreen.id}
                      onSelect={() => { if (!hasMoved.current) handleSceneBoxClick(splashScreen.id); }}
                      updateSplashScreen={updateSplashScreen}
                      dragZoom={zoom}
                      showGrid={mundoShowGrid}
                      gridSize={mundoGridSize}
                      gridOpacity={mundoGridOpacity}
                      gridStrokeWidth={mundoGridStrokeWidth}
                      gridColor={mundoGridColor}
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
                      tool={effectiveTool}
                      connectFrom={connectFrom}
                      onSelect={(id) => { if (!hasMoved.current) handleSceneBoxClick(id); }}
                      onContextMenu={(e, id) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setCtxMenu({ x: e.clientX, y: e.clientY, sceneId: id });
                      }}
                      updateScene={updateScene}
                      dragZoom={zoom}
                      showGrid={mundoShowGrid}
                      gridSize={mundoGridSize}
                      gridOpacity={mundoGridOpacity}
                      gridStrokeWidth={mundoGridStrokeWidth}
                      gridColor={mundoGridColor}
                      animPaused={!!sceneAnimPaused[sc.id]}
                      collisionPaintValue={tool === 'collision' ? collisionPaintValue : undefined}
                      collisionBrush={tool === 'collision' ? collisionBrush : undefined}
                      collisionBlockSize={collisionBlockSize}
                      setCollisionTile={setCollisionTile}
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

            {/* Menú radial +/X anclado al canvas de escenas */}
            <div style={{ position: 'absolute', left: 45, bottom: -285, zIndex: 300, pointerEvents: 'auto' }}>
              <div style={{ width: 340, height: 340, transform: 'translate(-50%, -50%)' }}>
                <RadialMenu
                  count={4}
                  wobble={false}
                  noShadow
                  centerColor={themeAccent}
                  fan={[-Math.PI / 2, 0]}
                  items={radialItems}
                  onPick={onRadialPick}
                  onOpenChange={(next) => { if (next) setRadialCollisionsOpen(false); }}
                />
                <AnimatePresence>
                  {radialCollisionsOpen && (
                    <motion.div
                      key="radial-collisions-panel"
                      initial={{ opacity: 0, x: -24, scale: 0.9 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -12, scale: 0.95 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                      style={{
                        position: 'absolute',
                        left: 208,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        display: 'flex', alignItems: 'center', gap: 2,
                        padding: '4px 10px',
                        background: 'rgba(45,45,51,0.95)',
                        borderRadius: 20,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
                        backdropFilter: 'blur(6px)',
                        border: '1px solid var(--border-color)',
                        zIndex: 320,
                      }}
                    >
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 2,
                        background: 'var(--bg-canvas)', borderRadius: 20, padding: '3px 4px',
                      }}>
                        <ToolBtn active={false} title="Bote (rellenar) — pronto">▤</ToolBtn>
                        <ToolBtn active={false} title="Varita (seleccionar) — pronto">⌾</ToolBtn>
                        <ToolBtn active={collisionBrush === 'draw'}
                          onClick={() => setCollisionBrush('draw')}
                          title="Lápiz (arrastra para pintar, clic derecho para borrar)"
                        >✎</ToolBtn>
                        <ToolBtn active={collisionBrush === 'rectangle'}
                          onClick={() => setCollisionBrush('rectangle')}
                          title="Cuadro (arrastra para dibujar un rectángulo, clic derecho para borrar)"
                        >▢</ToolBtn>
                      </div>
                      <div style={{ width: 1, height: 14, background: 'var(--bg-raised)', margin: '0 4px' }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {COLLISION_TYPES.map((p) => (
                          <div key={p.value}
                            onClick={() => setCollisionPaintValue(p.value)}
                            style={{
                              width: 20, height: 20, cursor: 'pointer',
                              border: collisionPaintValue === p.value ? '2px solid #fff' : '2px solid transparent',
                              outline: collisionPaintValue === p.value ? '1px solid var(--accent)' : 'none',
                              outlineOffset: 1, borderRadius: 3,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: 'rgba(0,0,0,0.3)',
                            }}
                            title={p.title}
                          >
                            <svg width={16} height={16} viewBox="0 0 16 16">{p.icon}</svg>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => setRadialCollisionsOpen(false)}
                        title="Cerrar panel de colisiones"
                        style={{
                          marginLeft: 2, background: 'transparent', border: 'none',
                          color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14,
                          lineHeight: 1, padding: 4,
                        }}
                      >×</button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            {radialPick && (
              <div style={{
                position: 'absolute', bottom: 40, left: 64,
                background: 'var(--bg-panel)', border: '1px solid var(--border-color)',
                borderRadius: 999, padding: '6px 14px', fontSize: 12,
                color: 'var(--text)', zIndex: 310, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                pointerEvents: 'none',
              }}>
                {radialPick}
              </div>
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
          {ctxMenu.sceneId && (
            <>
              <div
                onClick={() => {
                  setEditingId(ctxMenu.sceneId!);
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
                  handleRemove(ctxMenu.sceneId!);
                  setCtxMenu(null);
                }}
                style={{ padding: '6px 12px', fontSize: 12, borderRadius: 4, cursor: 'pointer', color: '#ef4444' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-raised)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                Eliminar escena
              </div>
            </>
          )}
          {ctxMenu.connectionId && (
            <div
              onClick={() => {
                removeConnection(ctxMenu.connectionId!);
                if (selectedNodeId === ctxMenu.connectionId) setSelectedNodeId('');
                setCtxMenu(null);
              }}
              style={{ padding: '6px 12px', fontSize: 12, borderRadius: 4, cursor: 'pointer', color: '#ef4444' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-raised)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              Eliminar conexión
            </div>
          )}
        </div>
</>
    )}
  </>
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

function SceneCard({ scene, selected, isConnecting, tool, connectFrom, onSelect, onContextMenu, updateScene, dragZoom, showGrid, gridSize, gridOpacity, gridStrokeWidth, gridColor, animPaused, collisionPaintValue, collisionBrush, collisionBlockSize, setCollisionTile }: {
  scene: Scene; selected: boolean; isConnecting: boolean;
  tool: string; connectFrom: string | null;
  onSelect: (id: string) => void;
  onContextMenu?: (e: React.MouseEvent, id: string) => void;
  updateScene: (id: string, patch: Partial<Scene>) => void;
  dragZoom: number;
  showGrid: boolean;
  gridSize: number;
  gridOpacity: number;
  gridStrokeWidth: number;
  gridColor: string;
  animPaused: boolean;
  collisionPaintValue?: number;
  collisionBrush?: CollisionBrush;
  collisionBlockSize?: number;
  setCollisionTile?: (sceneId: string, col: number, row: number, value: number) => void;
}) {
  const backgrounds = useAppStore((s) => s.backgrounds);
  const songs = useAppStore((s) => s.songs);
  const clickAnimation = useAppStore((s) => s.clickAnimation);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0 });
  const [bgImageUrl, setBgImageUrl] = useState('');
  const [animFrame, setAnimFrame] = useState(0);
  const animDirRef = useRef(1);
  const imageContainerRef = useRef<HTMLDivElement | null>(null);
  const [paintRect, setPaintRect] = useState<{x1: number; y1: number; x2: number; y2: number} | null>(null);
  const paintStartRef = useRef<{x: number; y: number} | null>(null);

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
  // rescale=false → mostrar la imagen completa (contain); rescale=true → forzar a llenar 240×160 (fill)
  const imageFit: React.CSSProperties['objectFit'] = matchingLayer ? (matchingLayer.rescale ? 'fill' : 'contain') : 'contain';

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

  const batchCollisionTiles = useAppStore((s) => s.batchCollisionTiles);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) return; // Middle click: let bubble for canvas panning
    e.preventDefault();
    e.stopPropagation();

    // Collision mode: draw (tile brush with line interpolation)
    // For ramp values (7, 8): line mode — draw a line, fill tiles on release
    if (tool === 'collision' && setCollisionTile && collisionBrush === 'draw') {
      if (e.button !== 0 && e.button !== 2) return;
      const paintValue = e.button === 2 ? 0 : (collisionPaintValue ?? 0);
      const isRamp = paintValue === COLLISION_SLOPE || paintValue === COLLISION_SLOPE_INV || paintValue === COLLISION_SLOPE_MIRROR || paintValue === COLLISION_SLOPE_INV_MIRROR;
      const container = imageContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / dragZoom;
      const my = (e.clientY - rect.top) / dragZoom;
      const tileSize = scene.collisionTileSize || 8;

      // Ramp line mode — relleno triangular siguiendo la línea
      if (isRamp) {
        const snapCorner = (v: number) => Math.round(v / tileSize) * tileSize;
        const clamp = (v: number, lim: number) => Math.max(0, Math.min(v, lim));
        const sx = clamp(snapCorner(mx), scene.width);
        const sy = clamp(snapCorner(my), scene.height);
        paintStartRef.current = { x: sx, y: sy };

        const handleMove = (ev: MouseEvent) => {
          const r2 = container.getBoundingClientRect();
          const mx2 = clamp((ev.clientX - r2.left) / dragZoom, scene.width);
          const my2 = clamp((ev.clientY - r2.top) / dragZoom, scene.height);
          const ex = clamp(snapCorner(mx2), scene.width);
          const ey = clamp(snapCorner(my2), scene.height);
          if (!paintStartRef.current) return;
          // Only show preview on actual drag, not on single click
          if (!paintRect) {
            setPaintRect({ x1: sx, y1: sy, x2: ex, y2: ey });
          } else {
            setPaintRect({ x1: sx, y1: sy, x2: ex, y2: ey });
          }
        };
        const handleUp = (ev: MouseEvent) => {
          document.removeEventListener('mousemove', handleMove);
          document.removeEventListener('mouseup', handleUp);
          const r2 = container.getBoundingClientRect();
          const mx2 = clamp((ev.clientX - r2.left) / dragZoom, scene.width);
          const my2 = clamp((ev.clientY - r2.top) / dragZoom, scene.height);
          const ex = clamp(snapCorner(mx2), scene.width);
          const ey = clamp(snapCorner(my2), scene.height);
          const nCols = Math.ceil(scene.width / tileSize);
          const nRows = Math.ceil(scene.height / tileSize);
          const tiles: [number, number, number][] = [];
          const isBelow = paintValue === COLLISION_SLOPE || paintValue === COLLISION_SLOPE_MIRROR;
          const encodeForward = paintValue === COLLISION_SLOPE || paintValue === COLLISION_SLOPE_INV_MIRROR;
          const forceBackslash = paintValue === COLLISION_SLOPE_MIRROR || paintValue === COLLISION_SLOPE_INV_MIRROR;
          const isMirror = paintValue === COLLISION_SLOPE_MIRROR || paintValue === COLLISION_SLOPE_INV_MIRROR;
          const segMinCol = Math.max(0, Math.floor(Math.min(sx, ex) / tileSize));
          const segMaxCol = Math.min(nCols - 1, Math.floor(Math.max(sx, ex) / tileSize));
          const segMinRow = Math.max(0, Math.floor(Math.min(sy, ey) / tileSize));
          const segMaxRow = Math.min(nRows - 1, Math.floor(Math.max(sy, ey) / tileSize));
          // Single click (no drag): place raw value directly
          if (sx === ex && sy === ey) {
            tiles.push([segMinCol, segMinRow, paintValue]);
          } else {
          for (let tr = segMinRow; tr <= segMaxRow; tr++) {
            for (let tc = segMinCol; tc <= segMaxCol; tc++) {
              const counts = tilePixelCounts(sx, sy, ex, ey, tc, tr, tileSize, isBelow, forceBackslash);
              if (counts.length === 0) continue;
              tiles.push([tc, tr, encodeSlope(counts, encodeForward, isMirror)]);
            }
          }
          }
          if (tiles.length) batchCollisionTiles(scene.id, tiles);
          paintStartRef.current = null;
          setPaintRect(null);
        };
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleUp);
        return;
      }

      // Regular tile brush mode (non-ramp)
      const bs = collisionBlockSize ?? 1;
      const offset = Math.floor(bs / 2);
      const nCols = Math.ceil(scene.width / tileSize);
      const nRows = Math.ceil(scene.height / tileSize);
      const addTiles = (tc: number, tr: number) => {
        const tiles: [number, number, number][] = [];
        for (let dy = 0; dy < bs; dy++) {
          for (let dx = 0; dx < bs; dx++) {
            const c = tc + dx;
            const r = tr + dy;
            if (c >= 0 && r >= 0 && c < nCols && r < nRows) tiles.push([c, r, paintValue]);
          }
        }
        if (tiles.length) batchCollisionTiles(scene.id, tiles);
      };
      const tc0 = Math.floor(mx / tileSize) - offset;
      const tr0 = Math.floor(my / tileSize) - offset;
      addTiles(tc0, tr0);
      paintStartRef.current = { x: tc0, y: tr0 };
      const handleMove = (ev: MouseEvent) => {
        const r2 = container.getBoundingClientRect();
        const mx2 = (ev.clientX - r2.left) / dragZoom;
        const my2 = (ev.clientY - r2.top) / dragZoom;
        const tc = Math.floor(mx2 / tileSize) - offset;
        const tr = Math.floor(my2 / tileSize) - offset;
        setPaintRect({ x1: tc * tileSize, y1: tr * tileSize, x2: (tc + bs) * tileSize, y2: (tr + bs) * tileSize });
        const last = paintStartRef.current;
        if (!last || (tc === last.x && tr === last.y)) return;
        // Bresenham line interpolation from last tile to current tile
        const dx = tc - last.x;
        const dy = tr - last.y;
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        const sx = dx > 0 ? 1 : -1;
        const sy = dy > 0 ? 1 : -1;
        let err = adx - ady;
        let cx = last.x, cy = last.y;
        while (cx !== tc || cy !== tr) {
          const e2 = 2 * err;
          if (e2 > -ady) { err -= ady; cx += sx; }
          if (e2 < adx) { err += adx; cy += sy; }
          addTiles(cx, cy);
        }
        paintStartRef.current = { x: tc, y: tr };
      };
      const handleUp = () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
        paintStartRef.current = null;
      };
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
      return;
    }

    // Collision mode: rectangle (draw a rect, fill on release)
    if (tool === 'collision' && setCollisionTile && collisionBrush === 'rectangle') {
      if (e.button !== 0 && e.button !== 2) return;
      const paintValue = e.button === 2 ? 0 : (collisionPaintValue ?? 0);
      const container = imageContainerRef.current;
      if (!container) return;
      const cr = container.getBoundingClientRect();
      const sx = (e.clientX - cr.left) / dragZoom;
      const sy = (e.clientY - cr.top) / dragZoom;
      paintStartRef.current = { x: sx, y: sy };
      setPaintRect({ x1: sx, y1: sy, x2: sx, y2: sy });
      const handleMove = (ev: MouseEvent) => {
        const r2 = container.getBoundingClientRect();
        const mx = (ev.clientX - r2.left) / dragZoom;
        const my = (ev.clientY - r2.top) / dragZoom;
        if (paintStartRef.current) {
          setPaintRect({
            x1: paintStartRef.current.x, y1: paintStartRef.current.y,
            x2: mx, y2: my,
          });
        }
      };
      const handleUp = (ev: MouseEvent) => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
        if (!paintStartRef.current) return;
        const r2 = container.getBoundingClientRect();
        const ex = (ev.clientX - r2.left) / dragZoom;
        const ey = (ev.clientY - r2.top) / dragZoom;
        const x1 = Math.min(paintStartRef.current.x, ex);
        const y1 = Math.min(paintStartRef.current.y, ey);
        const x2 = Math.max(paintStartRef.current.x, ex);
        const y2 = Math.max(paintStartRef.current.y, ey);
        const tileSize = scene.collisionTileSize || 8;
        const col1 = Math.max(0, Math.floor(x1 / tileSize));
        const row1 = Math.max(0, Math.floor(y1 / tileSize));
        const col2 = Math.min(Math.ceil(scene.width / tileSize) - 1, Math.floor(x2 / tileSize));
        const row2 = Math.min(Math.ceil(scene.height / tileSize) - 1, Math.floor(y2 / tileSize));
        const tiles: [number, number, number][] = [];
        for (let r = row1; r <= row2; r++) {
          for (let c = col1; c <= col2; c++) {
            tiles.push([c, r, paintValue]);
          }
        }
        if (tiles.length) batchCollisionTiles(scene.id, tiles);
        paintStartRef.current = null;
        setPaintRect(null);
      };
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
      return;
    }

    if (e.button !== 0) return;
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
  }, [scene.id, scene.x, scene.y, onSelect, updateScene, dragZoom, tool, setCollisionTile, collisionPaintValue, collisionBrush, collisionBlockSize, scene.collisionTileSize, scene.width, scene.height, batchCollisionTiles]);

  const bgSongObj = useMemo(() => songs.find((so) => so.id === scene.backgroundSong), [songs, scene.backgroundSong]);

  return (
    <div
      data-scene-card
      style={{
        position: 'absolute',
        left: 0, top: 0,
        transform: `translate(${scene.x}px, ${scene.y}px)`,
        willChange: dragging ? 'transform' : 'auto',
        display: 'flex', flexDirection: 'column',
        background: clickAnimation && selected ? 'var(--bg-panel)' : 'transparent',
        border: selected ? `2px solid var(--accent-light)` : '2px solid transparent',
        borderRadius: 0,
        overflow: 'hidden',
        padding: clickAnimation && selected ? 10 : 0,
        cursor: tool === 'connect' ? 'crosshair' : tool === 'collision' ? 'crosshair' : dragging ? 'grabbing' : 'grab',
        zIndex: dragging ? 10 : 1,
        userSelect: 'none',
        transition: clickAnimation ? 'border-color 0.15s, background 0.15s, padding 0.15s' : 'none',
        opacity: clickAnimation && selected ? 1 : 0.85,
      }}
      onMouseDown={handleMouseDown}
      onClick={() => onSelect(scene.id)}
      onContextMenu={(e) => {
        if (tool === 'collision' && (collisionBrush === 'draw' || collisionBrush === 'rectangle')) { e.preventDefault(); return; }
        onContextMenu?.(e, scene.id);
      }}
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
        {(scene.width > 240 || scene.height > 160) && (
          <span style={{ fontSize: 9, color: '#ffaa44', flexShrink: 0, background: 'rgba(255,170,68,0.15)', padding: '1px 5px', borderRadius: 4 }}>
            CAM {scene.cameraX},{scene.cameraY}
          </span>
        )}
        {bgSongObj && selected && (
          <span style={{ fontSize: 10, color: '#6b8cff', flexShrink: 0 }}>🎵 {bgSongObj.name}</span>
        )}
      </div>
      {/* Mini-map — pixel exacto */}
      <div ref={imageContainerRef} style={{
        width: scene.width,
        height: scene.height,
        position: 'relative',
        overflow: 'hidden',
      }}
        onMouseMove={(e) => {
          if (tool !== 'collision') { setPaintRect(null); return; }
          const pv = collisionPaintValue ?? 0;
          const isRamp = pv === COLLISION_SLOPE || pv === COLLISION_SLOPE_INV || pv === COLLISION_SLOPE_MIRROR || pv === COLLISION_SLOPE_INV_MIRROR;
          if (collisionBrush === 'draw' && !paintStartRef.current && !isRamp) {
            const rect = e.currentTarget.getBoundingClientRect();
            const mx = (e.clientX - rect.left) / dragZoom;
            const my = (e.clientY - rect.top) / dragZoom;
            const tileSize = scene.collisionTileSize || 8;
            const bs = collisionBlockSize ?? 1;
            const offset = Math.floor(bs / 2);
            const tc = Math.floor(mx / tileSize) - offset;
            const tr = Math.floor(my / tileSize) - offset;
            setPaintRect({ x1: tc * tileSize, y1: tr * tileSize, x2: (tc + bs) * tileSize, y2: (tr + bs) * tileSize });
          } else {
            setPaintRect(null);
          }
        }}
        onMouseLeave={() => { if (!paintStartRef.current) setPaintRect(null); }}
      >
        <div style={{
          position: 'absolute', inset: 0,
          background: bgImageUrl ? 'transparent' : scene.backgroundColor,
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
                    imageRendering: 'pixelated',
                  }}
                />
              </div>
            ) : (
              <img src={bgImageUrl} alt="" draggable={false} onDragStart={(e) => e.preventDefault()}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated' }}
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
                <line key={`gv${i}`} x1={i * gridSize} y1={0} x2={i * gridSize} y2={scene.height} stroke={gridColor} strokeWidth={gridStrokeWidth} opacity={gridOpacity} />
              ))}
              {Array.from({ length: Math.floor(scene.height / gridSize) + 1 }, (_, i) => (
                <line key={`gh${i}`} x1={0} y1={i * gridSize} x2={scene.width} y2={i * gridSize} stroke={gridColor} strokeWidth={gridStrokeWidth} opacity={gridOpacity} />
              ))}
            </svg>
          )}
          {/* Collision overlay */}
          <svg style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            pointerEvents: 'none', zIndex: 2,
          }}
            viewBox={`0 0 ${scene.width} ${scene.height}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {scene.collisionMap?.map((row, ri) =>
              row.map((val, ci) => {
                if (val === COLLISION_EMPTY) return null;
                const ts = scene.collisionTileSize || 8;
                const hs = ts / 2;
                // Encoded slopes (100+) — render per-row counts
                const slopeInfo = decodeSlope(val);
                if (slopeInfo) {
                  const x = ci * ts, y = ri * ts;
                  const s = ts / 8;
                  const { counts, forward, mirror } = slopeInfo;
                  const color = mirror ? (forward ? '#ffbb66' : '#66ffbb') : (forward ? '#ff66bb' : '#bb66ff');
                  return (
                    <g key={`c${ci}_${ri}`}>
                      {counts.map((cnt, py) => {
                        if (cnt === 0) return null;
                        if (forward) {
                          return <rect key={py} x={x + (8 - cnt) * s} y={y + py * s} width={cnt * s} height={s} fill={color} />;
                        } else {
                          return <rect key={py} x={x} y={y + py * s} width={cnt * s} height={s} fill={color} />;
                        }
                      })}
                    </g>
                  );
                }
                const palette = COLLISION_PALETTE.find((p) => p.value === val);
                if (!palette) return null;
                if (val === 2) {
                  return <rect key={`c${ci}_${ri}`} x={ci * ts} y={ri * ts} width={ts} height={hs} fill={palette.color} />;
                }
                if (val === 3) {
                  return <rect key={`c${ci}_${ri}`} x={ci * ts} y={ri * ts + hs} width={ts} height={hs} fill={palette.color} />;
                }
                if (val === 4) {
                  return <rect key={`c${ci}_${ri}`} x={ci * ts} y={ri * ts} width={hs} height={ts} fill={palette.color} />;
                }
                if (val === 5) {
                  return <rect key={`c${ci}_${ri}`} x={ci * ts + hs} y={ri * ts} width={hs} height={ts} fill={palette.color} />;
                }
                if (val === 6) {
                  const x = ci * ts, y = ri * ts;
                  return (
                    <path key={`c${ci}_${ri}`} fill={palette.color} fillRule="evenodd"
                      d={`M${x} ${y} h${ts} v${ts} h-${ts} Z M${x+2} ${y+2} h4 v2 h-4 Z M${x+2} ${y+6} h4 v2 h-4 Z`}
                    />
                  );
                }
                if (val === 7 || val === 8 || val === 10 || val === 11) {
                  const x = ci * ts, y = ri * ts;
                  const def = SLOPE_DEFS[val];
                  if (def) {
                    const s = ts / 8;
                    const forward = val === 7 ? true : val === 8 ? false : val === 10 ? false : true;
                    const color = val === 7 ? '#ff66bb' : val === 8 ? '#bb66ff' : val === 10 ? '#66ffbb' : '#ffbb66';
                    return (
                      <g key={`c${ci}_${ri}_${val}`}>
                        {def.map((cnt, py) => {
                          if (cnt === 0) return null;
                          if (forward) {
                            return <rect key={py} x={x + (8 - cnt) * s} y={y + py * s} width={cnt * s} height={s} fill={color} />;
                          } else {
                            return <rect key={py} x={x} y={y + py * s} width={cnt * s} height={s} fill={color} />;
                          }
                        })}
                      </g>
                    );
                  }
                }
                return (
                  <rect key={`c${ci}_${ri}`}
                    x={ci * ts}
                    y={ri * ts}
                    width={ts}
                    height={ts}
                    fill={palette.color}
                  />
                );
              })
            )}
            {paintRect && (collisionPaintValue === COLLISION_SLOPE || collisionPaintValue === COLLISION_SLOPE_INV || collisionPaintValue === COLLISION_SLOPE_MIRROR || collisionPaintValue === COLLISION_SLOPE_INV_MIRROR) ? (
              (() => {
                const pts = bresenhamLine(paintRect.x1, paintRect.y1, paintRect.x2, paintRect.y2);
                return pts.map((p, i) => (
                  <rect key={i} x={p.x - 0.5} y={p.y - 0.5} width={1} height={1} fill="#fff" opacity={0.9} />
                ));
              })()
            ) : paintRect && (() => {
              const x = Math.min(paintRect.x1, paintRect.x2);
              const y = Math.min(paintRect.y1, paintRect.y2);
              const w = Math.max(paintRect.x1, paintRect.x2) - x;
              const h = Math.max(paintRect.y1, paintRect.y2) - y;
              return (
                <rect x={x} y={y} width={w || 1} height={h || 1}
                  fill="rgba(255,255,255,0.12)"
                  stroke="#fff"
                  strokeWidth={1}
                  strokeDasharray="3 2"
                />
              );
            })()}
          </svg>
          {/* Viewport overlay — rectangulo de la camara (240x160) arrastrable */}
          {(scene.width > 240 || scene.height > 160) && (
            <CameraRect
              cameraX={scene.cameraX}
              cameraY={scene.cameraY}
              sceneWidth={scene.width}
              sceneHeight={scene.height}
              sceneId={scene.id}
              dragZoom={dragZoom}
              updateScene={updateScene}
            />
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

function CameraRect({ cameraX, cameraY, sceneWidth, sceneHeight, sceneId, dragZoom, updateScene }: {
  cameraX: number; cameraY: number; sceneWidth: number; sceneHeight: number;
  sceneId: string; dragZoom: number;
  updateScene: (id: string, patch: Partial<Scene>) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: cameraX, origY: cameraY };
    const handleMove = (ev: MouseEvent) => {
      ev.preventDefault();
      if (!dragRef.current) return;
      const dx = (ev.clientX - dragRef.current.startX) / dragZoom;
      const dy = (ev.clientY - dragRef.current.startY) / dragZoom;
      const maxX = Math.max(0, sceneWidth - 240);
      const maxY = Math.max(0, sceneHeight - 160);
      const newX = Math.round(Math.max(0, Math.min(maxX, dragRef.current.origX + dx)));
      const newY = Math.round(Math.max(0, Math.min(maxY, dragRef.current.origY + dy)));
      updateScene(sceneId, { cameraX: newX, cameraY: newY });
    };
    const handleUp = () => {
      setDragging(false);
      dragRef.current = null;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [cameraX, cameraY, sceneWidth, sceneHeight, sceneId, dragZoom, updateScene]);

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        left: cameraX,
        top: cameraY,
        width: 240,
        height: 160,
        boxSizing: 'border-box',
        border: dragging ? '2px solid #fff' : '2px dashed var(--accent)',
        cursor: dragging ? 'grabbing' : 'move',
        zIndex: 3,
        backgroundColor: 'rgba(255,255,255,0.06)',
      }}
    />
  );
}

function SplashCard({ splash, selected, onSelect, updateSplashScreen, dragZoom, showGrid, gridSize, gridOpacity, gridStrokeWidth, gridColor }: {
  splash: SplashScreen; selected: boolean;
  onSelect: () => void;
  updateSplashScreen: (patch: Partial<SplashScreen>) => void;
  dragZoom: number;
  showGrid: boolean;
  gridSize: number;
  gridOpacity: number;
  gridStrokeWidth: number;
  gridColor: string;
}) {
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
      data-scene-card
      style={{
        position: 'absolute',
        left: 0, top: 0,
        transform: `translate(${splash.x}px, ${splash.y}px)`,
        willChange: dragging ? 'transform' : 'auto',
        display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
        border: `2px solid ${selected ? 'var(--accent-light)' : '#3a3a5a'}`,
        borderRadius: 0, padding: 10,
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
        width: 240, height: 160, position: 'relative',
        marginBottom: 4, overflow: 'hidden',
        borderRadius: 0,
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: '#0d0d1a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, color: '#ffffff88',
        }}>
          {videoUrl && (
            <video ref={videoRef} src={videoUrl} autoPlay loop muted playsInline
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated' }}
            />
          )}
          {bgImageUrl && !videoUrl && (
            <img src={bgImageUrl} alt="" draggable={false} onDragStart={(e) => e.preventDefault()}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated' }}
            />
          )}
          <span style={{ position: 'relative', zIndex: 1, background: '#00000066', padding: '2px 6px', borderRadius: 0 }}>
            Splash — {splash.duration}s{videoUrl ? ' 🎬' : ''}
          </span>
          <div style={{
            position: 'absolute', inset: 0,
            border: '2px solid rgba(255,255,255,0.1)', borderRadius: 0, pointerEvents: 'none',
          }} />
          {showGrid && (
            <svg style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              pointerEvents: 'none', zIndex: 2,
            }}
              viewBox="0 0 240 160"
              preserveAspectRatio="xMidYMid meet"
            >
              {Array.from({ length: Math.floor(240 / gridSize) + 1 }, (_, i) => (
                <line key={`sgv${i}`} x1={i * gridSize} y1={0} x2={i * gridSize} y2={160} stroke={gridColor} strokeWidth={gridStrokeWidth} opacity={gridOpacity} />
              ))}
              {Array.from({ length: Math.floor(160 / gridSize) + 1 }, (_, i) => (
                <line key={`sgh${i}`} x1={0} y1={i * gridSize} x2={240} y2={i * gridSize} stroke={gridColor} strokeWidth={gridStrokeWidth} opacity={gridOpacity} />
              ))}
            </svg>
          )}
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
