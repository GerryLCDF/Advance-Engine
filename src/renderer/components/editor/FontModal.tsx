import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { FontTileset } from '../../types/editor';

interface Props {
  onClose: () => void;
}


function buildCharSequence(mode: string, custom: string, n: number): string[] {
  const printable: string[] = [];
  for (let c = 32; c <= 126; c++) printable.push(String.fromCharCode(c));
  let seq: string[] = [];
  if (mode === 'letters-first') {
    const letters: string[] = [];
    for (let c = 65; c <= 90; c++) letters.push(String.fromCharCode(c));
    for (let c = 97; c <= 122; c++) letters.push(String.fromCharCode(c));
    const digits = printable.filter((ch) => ch >= '0' && ch <= '9');
    const symbols = printable.filter((ch) => !(ch >= 'A' && ch <= 'Z') && !(ch >= 'a' && ch <= 'z') && !(ch >= '0' && ch <= '9'));
    seq = [...letters, ...digits, ...symbols];
  } else if (mode === 'custom') {
    seq = Array.from(custom);
  } else {
    seq = [...printable];
  }
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(seq[i % Math.max(1, seq.length)] ?? ' ');
  }
  return out;
}

function applyCharOrder(fontId: string, cols: number, rows: number) {
  const state = useAppStore.getState();
  const mode = state.fontCharOrderMode;
  const custom = state.fontCharOrderCustom;
  const n = cols * rows;
  const seq = buildCharSequence(mode, custom, n);
  const charMap: Record<string, number> = {};
  seq.forEach((ch, idx) => { charMap[ch] = idx; });
  // remove duplicates: keep first occurrence
  const seen = new Set<string>();
  const cleaned: Record<string, number> = {};
  Object.entries(charMap).forEach(([ch, ti]) => {
    if (seen.has(ch)) return;
    seen.add(ch);
    cleaned[ch] = ti;
  });
  useAppStore.getState().updateFont(fontId, { charMap: cleaned, firstChar: 32 });
}

function tileIndexForChar(font: FontTileset, ch: string): number {
  if ((font.unassigned ?? []).includes(-1)) return -1;
  for (const [c, ti] of Object.entries(font.charMap)) {
    if (c === ch) return ti;
  }
  const idx = ch.charCodeAt(0) - font.firstChar;
  if (idx >= 0 && idx < font.cols * font.rows) return idx;
  return -1;
}
export function FontModal({ onClose }: Props) {
  const fonts = useAppStore((s) => s.fonts);
  const addFont = useAppStore((s) => s.addFont);
  const updateFont = useAppStore((s) => s.updateFont);
  const removeFont = useAppStore((s) => s.removeFont);

  const [selectedId, setSelectedId] = useState<string>(fonts[0]?.id ?? '');
  const [dragOver, setDragOver] = useState(false);
  const [fontZoom, setFontZoom] = useState(1);
  const imageSmoothing = useAppStore((s) => s.imageSmoothing);
  const globalLabelBg = useAppStore((s) => s.fontLabelBgColor);
  const canvasBg = useAppStore((s) => s.fontCanvasBgColor);
  const charOrderMode = useAppStore((s) => s.fontCharOrderMode);
  const [selectedTile, setSelectedTile] = useState<number | null>(null);
  const [testText, setTestText] = useState('Hola');
  const [imgVersion, setImgVersion] = useState(0);
  const testPreviewRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const didPanRef = useRef(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const selectedFont = fonts.find((f) => f.id === selectedId) ?? null;


  const charForTile = useCallback((font: FontTileset, idx: number): string => {
    if ((font.unassigned ?? []).includes(idx)) return '';
    for (const [ch, ti] of Object.entries(font.charMap)) {
      if (ti === idx) return ch;
    }
    const code = font.firstChar + idx;
    if (code >= 32 && code <= 126) return String.fromCharCode(code);
    return '';
  }, []);



  useEffect(() => {
    if (!selectedFont?.imagePath) { imgRef.current = null; return; }
    let cancelled = false;
    const api = window.advanceAPI;
    const load = async () => {
      if (selectedFont.imagePath.startsWith('data:')) {
        const img = new Image();
        img.onload = () => { if (!cancelled) { imgRef.current = img; draw(); setImgVersion((v) => v + 1); } };
        img.onerror = () => { if (!cancelled) imgRef.current = null; };
        img.src = selectedFont.imagePath;
        return;
      }
      if (api?.file?.readImage) {
        const r = await api.file.readImage(selectedFont.imagePath);
        if (cancelled) return;
        if (r?.success && r.dataUrl) {
          const img = new Image();
          img.onload = () => { if (!cancelled) { imgRef.current = img; draw(); setImgVersion((v) => v + 1); } };
          img.onerror = () => { if (!cancelled) imgRef.current = null; };
          img.src = r.dataUrl;
          return;
        }
      }
      imgRef.current = null;
    };
    load();
    return () => { cancelled = true; };
  }, [selectedFont?.imagePath]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const font = selectedFont;
    const img = imgRef.current;
    if (!canvas || !font) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth * dpr;
    const h = canvas.clientHeight * dpr;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    // se asigna DESPUÉS del resize: cambiar canvas.width resetea el estado del contexto
    ctx.imageSmoothingEnabled = imageSmoothing;
    ctx.clearRect(0, 0, w, h);

    if (img) {
      const tw = Math.max(1, Math.floor(img.width / Math.max(1, font.cols)));
      const th = Math.max(1, Math.floor(img.height / Math.max(1, font.rows)));
      const scale = Math.max(0.1, Math.min(w / img.width, h / img.height));
      const dw = img.width * scale;
      const dh = img.height * scale;
      const ox = (w - dw) / 2;
      const oy = (h - dh) / 2;
      ctx.drawImage(img, ox, oy, dw, dh);

      ctx.strokeStyle = 'rgba(124, 92, 240, 0.5)';
      ctx.lineWidth = 1;
      for (let c = 0; c <= font.cols; c++) {
        const x = ox + c * tw * scale;
        ctx.beginPath(); ctx.moveTo(x, oy); ctx.lineTo(x, oy + dh); ctx.stroke();
      }
      for (let r = 0; r <= font.rows; r++) {
        const y = oy + r * th * scale;
        ctx.beginPath(); ctx.moveTo(ox, y); ctx.lineTo(ox + dw, y); ctx.stroke();
      }

      ctx.font = `${Math.max(8, th * scale * 0.6)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let r = 0; r < font.rows; r++) {
        for (let c = 0; c < font.cols; c++) {
          const idx = r * font.cols + c;
          const char = charForTile(font, idx);
          if (!char) continue;
          const tx = ox + c * tw * scale;
          const ty = oy + r * th * scale;
          const label = char === ' ' ? '␣' : char;
          ctx.font = `${Math.max(8, th * scale * 0.5)}px monospace`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          const metrics = ctx.measureText(label);
          const lw = Math.max(10, metrics.width + 4);
          const lh = Math.max(10, th * scale * 0.5 + 4);
          ctx.fillStyle = globalLabelBg;
          ctx.fillRect(tx + 2, ty + 2, lw, lh);
          ctx.fillStyle = '#fff';
          ctx.fillText(label, tx + 4, ty + 3);
        }
      }

      if (selectedTile !== null) {
        const c = selectedTile % font.cols;
        const r = Math.floor(selectedTile / font.cols);
        const x = ox + c * tw * scale;
        const y = oy + r * th * scale;
        ctx.strokeStyle = '#f0c040';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, tw * scale - 2, th * scale - 2);
      }
    } else {
      ctx.fillStyle = '#2a2a3a';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Arrastra o carga una imagen', w / 2, h / 2);
    }
  }, [selectedFont, selectedTile, charForTile, fontZoom]);

  useLayoutEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    const canvas = testPreviewRef.current;
    const font = selectedFont;
    const img = imgRef.current;
    if (!canvas || !font || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth * dpr;
    const h = canvas.clientHeight * dpr;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.imageSmoothingEnabled = imageSmoothing;
    ctx.fillStyle = canvasBg;
    ctx.fillRect(0, 0, w, h);
    const tw = Math.max(1, Math.floor(img.width / Math.max(1, font.cols)));
    const th = Math.max(1, Math.floor(img.height / Math.max(1, font.rows)));
    const scale = Math.max(1, Math.min(w / (tw * Math.max(1, testText.length)), h / th));
    const tileW = tw * scale;
    const tileH = th * scale;
    const spX = (selectedFont.letterSpacingX ?? 0) * scale;
    let x = 4;
    const y = 4;
    for (const ch of testText) {
      const idx = tileIndexForChar(font, ch);
      if (idx < 0) { x += tileW * 0.5; continue; }
      const tc = idx % font.cols;
      const tr = Math.floor(idx / font.cols);
      const sx = tc * tw;
      const sy = tr * th;
      ctx.drawImage(img, sx, sy, tw, th, x, y, tileW, tileH);
      x += tileW + spX;
      if (x + tileW > w) break;
    }
  }, [testText, selectedFont, imgVersion, canvasBg, imageSmoothing]);


  // Pan con botón medio (rueda): listener nativo a nivel de document.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (e.button !== 1) return;
      const el = scrollRef.current;
      if (!el) return;
      // Solo si el clic está dentro del visor
      const rect = el.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
      e.preventDefault();
      el.style.cursor = 'grabbing';
      const startX = e.clientX, startY = e.clientY;
      const sl = el.scrollLeft, st = el.scrollTop;
      const onMove = (ev: MouseEvent) => {
        const newSl = sl - (ev.clientX - startX);
        const newSt = st - (ev.clientY - startY);
        el.scrollLeft = newSl;
        el.scrollTop = newSt;
      };
      const onUp = () => {
        el.style.cursor = 'auto';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Arrastre con el botón medio (rueda) para mover el visor. Listener nativo
  // porque los eventos sintéticos de React no siempre disparan con el botón
  // medio sobre un canvas.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let startX = 0, startY = 0, sl = 0, st = 0, panning = false;
    const onDown = (e: MouseEvent) => {
      if (e.button !== 1) return;
      const rect = el.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
      e.preventDefault();
      el.style.cursor = 'grabbing';
      didPanRef.current = false;
      startX = e.clientX; startY = e.clientY;
      sl = el.scrollLeft; st = el.scrollTop;
      panning = true;
    };
    const onMove = (e: MouseEvent) => {
      if (!panning) return;
      didPanRef.current = true;
      el.scrollLeft = sl - (e.clientX - startX);
      el.scrollTop = st - (e.clientY - startY);
    };
    const onUp = (e: MouseEvent) => {
      if (!panning) return;
      panning = false;
      el.style.cursor = 'auto';
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  const handleTileClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (didPanRef.current) { didPanRef.current = false; return; }
    if (!selectedFont || !imgRef.current) return;
    const canvas = canvasRef.current!;
    const img = imgRef.current;
    const font = selectedFont;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth * dpr;
    const h = canvas.clientHeight * dpr;
    const scale = Math.max(0.1, Math.min(w / img.width, h / img.height));
    const dw = img.width * scale;
    const dh = img.height * scale;
    const ox = (w - dw) / 2;
    const oy = (h - dh) / 2;
    const tw = Math.max(1, Math.floor(img.width / Math.max(1, font.cols)));
    const th = Math.max(1, Math.floor(img.height / Math.max(1, font.rows)));
    const x = (e.nativeEvent.offsetX * dpr) - ox;
    const y = (e.nativeEvent.offsetY * dpr) - oy;
    const c = Math.floor(x / (tw * scale));
    const r = Math.floor(y / (th * scale));
    if (c < 0 || c >= font.cols || r < 0 || r >= font.rows) return;
    setSelectedTile(r * font.cols + c);
  };

  const handleTileKey = (e: React.KeyboardEvent) => {
    if (selectedTile === null || !selectedFont) return;
    const total = selectedFont.cols * selectedFont.rows;
    if (e.key === 'ArrowRight') {
      if (selectedTile < total - 1) setSelectedTile(selectedTile + 1);
      e.preventDefault(); return;
    }
    if (e.key === 'ArrowLeft') {
      if (selectedTile > 0) setSelectedTile(selectedTile - 1);
      e.preventDefault(); return;
    }
    if (e.key === 'ArrowDown') {
      const ni = selectedTile + selectedFont.cols;
      if (ni < total) setSelectedTile(ni);
      e.preventDefault(); return;
    }
    if (e.key === 'ArrowUp') {
      const ni = selectedTile - selectedFont.cols;
      if (ni >= 0) setSelectedTile(ni);
      e.preventDefault(); return;
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const newMap = { ...selectedFont.charMap };
      for (const [ch, ti] of Object.entries(newMap)) {
        if (ti === selectedTile) delete newMap[ch];
      }
      const ua = Array.from(new Set([...(selectedFont.unassigned ?? []), selectedTile]));
      updateFont(selectedFont.id, { charMap: newMap, unassigned: ua });
      e.preventDefault();
      return;
    }
    if (e.key.length === 1) {
      const ch = e.key;
      const newMap = { ...selectedFont.charMap };
      delete newMap[ch];
      for (const [c, ti] of Object.entries(newMap)) {
        if (ti === selectedTile) delete newMap[c];
      }
      newMap[ch] = selectedTile;
      const ua = (selectedFont.unassigned ?? []).filter((t) => t !== selectedTile);
      updateFont(selectedFont.id, { charMap: newMap, unassigned: ua });
      e.preventDefault();
      // pasar al siguiente tile
      const next = selectedTile + 1;
      if (next < total) setSelectedTile(next);
    }
  };

  const handleImportImage = async () => {
    const api = window.advanceAPI;
    if (!api) return;
    // asegurar que exista una fuente y obtener su id de forma síncrona
    let fontId = selectedFont?.id;
    if (!fontId) {
      fontId = addFont();
      setSelectedId(fontId);
      setSelectedTile(null);
    }
    const result = await api.dialog.openAnyImage();
    if (result?.path) {
      imgRef.current = null;
      updateFont(fontId, { imagePath: result.path });
      const after = useAppStore.getState().fonts.find((f) => f.id === fontId);
    } else {
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return;
    let filePath = ((file as any).path as string | undefined) || window.advanceAPI?.filePathFor?.(file) || '';
    if (!filePath) {
      // Fallback: leer el archivo como data URL
      filePath = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });
    }
    if (!filePath) return;
    let fontId = selectedFont?.id;
    if (!fontId) {
      fontId = addFont();
      setSelectedId(fontId);
      setSelectedTile(null);
    }
    updateFont(fontId, { imagePath: filePath });
    imgRef.current = null;
    const img = new Image();
    img.onload = () => { imgRef.current = img; draw(); setImgVersion((v) => v + 1); };
    img.src = filePath;
    const f = useAppStore.getState().fonts.find((x) => x.id === fontId);
    if (f) applyCharOrder(fontId, f.cols, f.rows);
  };

  const handleAddFont = () => {
    imgRef.current = null;
    const id = addFont();
    setSelectedId(id);
    setSelectedTile(null);
    // aplicar orden de caracteres por defecto
    const f = useAppStore.getState().fonts.find((x) => x.id === id);
    if (f) applyCharOrder(id, f.cols, f.rows);
  };

  const handleRemoveFont = () => {
    if (!selectedFont) return;
    removeFont(selectedFont.id);
    const remaining = fonts.filter((f) => f.id !== selectedFont.id);
    setSelectedId(remaining[0]?.id ?? '');
    setSelectedTile(null);
  };

  return (
    <div
      onClick={onClose}
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
          width: '1400PX', maxWidth: '95vw',
          height: '650PX', maxHeight: '95vh',
          overflow: 'auto',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8,
        }}>
          <span style={{ color: '#f0c040', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>
            Fuentes de texto (tilesets)
          </span>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, padding: 0, lineHeight: 1 }}
          >×</button>
        </div>

        <div style={{ flex: 1, display: 'flex', minHeight: 0, gap: 12 }}>
          <div style={{
            width: 240, flexShrink: 0, borderRight: '1px solid var(--border-color)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 10px', borderBottom: '1px solid var(--border-color)',
              background: 'var(--bg-canvas)',
            }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Fuentes</span>
              <button onClick={handleAddFont}
                style={{ background: 'var(--accent)', border: 'none', borderRadius: 3, color: '#fff', fontSize: 12, fontWeight: 700, width: 20, height: 20, cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >+</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 4 }}>
              {fonts.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: 11, padding: 8, textAlign: 'center' }}>
                  Sin fuentes. Pulsa + para crear una.
                </div>
              )}
              {fonts.map((f) => (
                <div
                  key={f.id}
                  onClick={() => { imgRef.current = null; setSelectedId(f.id); setSelectedTile(null); }}
                  style={{
                    padding: '6px 8px', borderRadius: 4, cursor: 'pointer', marginBottom: 2,
                    background: f.id === selectedId ? 'var(--accent)' : 'transparent',
                    color: f.id === selectedId ? '#fff' : 'var(--text)',
                    fontSize: 11,
                  }}
                >
                  {f.name}
                  <div style={{ fontSize: 9, opacity: 0.7, marginTop: 2 }}>
                    {f.cols}×{f.rows} · {f.imagePath ? f.imagePath.split(/[\\/]/).pop() : 'sin imagen'}
                  </div>
                </div>
              ))}
            </div>
            {selectedFont && (
              <div style={{ padding: 8, borderTop: '1px solid var(--border-color)' }}>
                <button onClick={handleRemoveFont}
                  style={{ width: '100%', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 4, color: '#f87171', fontSize: 10, padding: '4px 8px', cursor: 'pointer' }}
                >
                  Eliminar fuente
                </button>
              </div>
            )}
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
            {selectedFont && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                borderBottom: '1px solid var(--border-color)', background: 'var(--bg-panel)',
                flexShrink: 0,
              }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>División</span>
                <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>Cols:</label>
                <input type="number" min={1} max={64} value={selectedFont.cols}
                  onChange={(e) => updateFont(selectedFont.id, { cols: Math.max(1, parseInt(e.target.value) || 1) })}
                  style={{ width: 50, background: '#141420', border: '1px solid var(--border-light)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '3px 6px', outline: 'none', textAlign: 'center' }}
                />
                <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>Filas:</label>
                <input type="number" min={1} max={32} value={selectedFont.rows}
                  onChange={(e) => updateFont(selectedFont.id, { rows: Math.max(1, parseInt(e.target.value) || 1) })}
                  style={{ width: 50, background: '#141420', border: '1px solid var(--border-light)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '3px 6px', outline: 'none', textAlign: 'center' }}
                />
                <span style={{ color: 'var(--text-dim)', fontSize: 9, marginLeft: 'auto' }}>
                  Tile: {Math.max(1, Math.floor((imgRef.current?.width ?? 0) / Math.max(1, selectedFont.cols)))}×{Math.max(1, Math.floor((imgRef.current?.height ?? 0) / Math.max(1, selectedFont.rows)))}px
                </span>
              </div>
            )}
            <div
              ref={scrollRef}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              tabIndex={0}
              onKeyDown={handleTileKey}
              onWheel={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  e.preventDefault();
                  setFontZoom((z) => Math.max(0.5, Math.min(15, z + (e.deltaY > 0 ? -0.25 : 0.25))));
                }
              }}
              onMouseDown={(e) => {
                if (e.button !== 1) return;
                e.preventDefault();
              }}
              style={{
                flex: 1, minHeight: 0, overflow: 'auto',
                background: canvasBg, outline: dragOver ? '2px dashed var(--accent-light)' : 'none',
                outlineOffset: -2, position: 'relative',
                imageRendering: imageSmoothing ? 'auto' : 'pixelated',
              }}
            >
              <canvas ref={canvasRef} tabIndex={-1}
                onClick={handleTileClick}
                onMouseDown={(e) => {
                  if (e.button !== 1) return;
                  e.preventDefault();
                  const el = scrollRef.current;
                  if (!el) return;
                  el.style.cursor = 'grabbing';
                  const startX = e.clientX, startY = e.clientY;
                  const sl = el.scrollLeft, st = el.scrollTop;
                  const onMove = (ev: MouseEvent) => {
                    el.scrollLeft = sl - (ev.clientX - startX);
                    el.scrollTop = st - (ev.clientY - startY);
                  };
                  const onUp = () => {
                    el.style.cursor = 'auto';
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                  };
                  window.addEventListener('mousemove', onMove);
                  window.addEventListener('mouseup', onUp);
                }}
                style={{
                  width: `${fontZoom * 100}%`, height: `${fontZoom * 100}%`,
                  cursor: 'pointer', background: canvasBg,
                  imageRendering: imageSmoothing ? 'auto' : 'pixelated',
                  display: 'block',
                  margin: 'auto',
                }}
              />
            </div>
            {/* Zoom controls (sticky, se quedan visibles al hacer scroll) */}
            <div style={{
              position: 'sticky', top: 8, alignSelf: 'flex-end', marginRight: 8,
              display: 'flex', alignItems: 'center', gap: 2,
              background: 'var(--bg-panel)', borderRadius: 6, padding: '3px 6px',
              border: '1px solid var(--bg-raised)', zIndex: 20,
            }}>
              <button onClick={() => setFontZoom((z) => Math.max(0.5, z - 0.25))}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: '0 4px' }}>−</button>
              <span style={{ color: 'var(--text-secondary)', fontSize: 10, minWidth: 32, textAlign: 'center' }}>{Math.round(fontZoom * 100)}%</span>
              <button onClick={() => setFontZoom((z) => Math.min(15, z + 0.25))}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: '0 4px' }}>+</button>
            </div>
            {selectedTile !== null && (
              <div style={{
                position: 'absolute', bottom: 8, left: 8, right: 8,
                background: 'rgba(0,0,0,0.7)', borderRadius: 4, padding: '4px 8px',
                fontSize: 10, color: '#fff', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span>Tile {selectedTile}:</span>
                <span style={{ color: 'var(--accent-lighter)', fontWeight: 700 }}>
                  {charForTile(selectedFont!, selectedTile) || '(sin asignar)'}
                </span>
                <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  Escribe un carácter para asignarlo · Backspace para quitar
                </span>
              </div>
            )}
            {!selectedFont?.imagePath && (
              <button
                onClick={handleImportImage}
                style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 12,
                  cursor: 'pointer', width: '100%', zIndex: 1,
                }}
              >
                Arrastra o carga una imagen
              </button>
            )}
          </div>

          <div style={{
            width: 312, flexShrink: 0, borderLeft: '1px solid var(--border-color)',
            display: 'flex', flexDirection: 'column', overflow: 'auto', padding: 12, gap: 10,
            background: 'var(--bg-panel)',
          }}>
            {selectedFont ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 56 }}>Nombre</span>
                  <input type="text" value={selectedFont.name}
                    onChange={(e) => {
                      const v = e.target.value;
                      const dup = fonts.some((f) => f.id !== selectedFont.id && f.name === v);
                      if (dup) return;
                      updateFont(selectedFont.id, { name: v });
                    }}
                    style={{ flex: 1, background: '#141420', border: '1px solid var(--border-light)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '3px 6px', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 56 }}>Imagen</span>
                  <button onClick={handleImportImage}
                    style={{ flex: 1, background: 'transparent', border: '1px dashed var(--border-light)', borderRadius: 4, color: 'var(--text-muted)', fontSize: 10, padding: '4px 8px', cursor: 'pointer' }}
                  >
                    {selectedFont.imagePath ? selectedFont.imagePath.split(/[\\/]/).pop() : 'Cargar PNG...'}
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 56 }}>Primer char</span>
                  <input type="number" min={0} max={255} value={selectedFont.firstChar}
                    onChange={(e) => updateFont(selectedFont.id, { firstChar: Math.max(0, Math.min(255, parseInt(e.target.value) || 32)) })}
                    style={{ flex: 1, background: '#141420', border: '1px solid var(--border-light)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '3px 6px', outline: 'none', textAlign: 'center' }}
                  />
                  <span style={{ color: 'var(--text-dim)', fontSize: 9 }}>({String.fromCharCode(selectedFont.firstChar)})</span>
                </div>

                <div style={{ color: 'var(--text-dim)', fontSize: 10, lineHeight: 1.4, marginTop: 4 }}>
                  Mapeo automático: tile i → carácter (firstChar + i). Sobrescribe haciendo clic en un tile y escribiendo un carácter. Backspace quita la asignación.
                </div>

                <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 4 }}>
                  Total tiles: {selectedFont.cols * selectedFont.rows} · Cubre {String.fromCharCode(selectedFont.firstChar)}–{String.fromCharCode(Math.min(126, selectedFont.firstChar + selectedFont.cols * selectedFont.rows - 1))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Espacio X</span>
                    <input type="range" min={0} max={8} value={selectedFont.letterSpacingX ?? 0}
                      onChange={(e) => updateFont(selectedFont.id, { letterSpacingX: parseInt(e.target.value) })}
                      style={{ flex: 1 }}
                    />
                    <span style={{ color: 'var(--text-dim)', fontSize: 9, minWidth: 14 }}>{selectedFont.letterSpacingX ?? 0}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Espacio Y</span>
                    <input type="range" min={0} max={8} value={selectedFont.letterSpacingY ?? 0}
                      onChange={(e) => updateFont(selectedFont.id, { letterSpacingY: parseInt(e.target.value) })}
                      style={{ flex: 1 }}
                    />
                    <span style={{ color: 'var(--text-dim)', fontSize: 9, minWidth: 14 }}>{selectedFont.letterSpacingY ?? 0}</span>
                  </div>
                </div>
                <div style={{ borderTop: '1px solid var(--border-light)', margin: '8px 0' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>Test</span>
                  <input type="text" value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                    placeholder="Texto de prueba..."
                    style={{ background: '#141420', border: '1px solid var(--border-light)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '3px 6px', outline: 'none' }}
                  />
                  <canvas ref={testPreviewRef} width={280} height={40}
                    style={{ width: '100%', height: 'auto', background: canvasBg, border: '1px solid var(--border-light)', borderRadius: 4, imageRendering: imageSmoothing ? 'auto' : 'pixelated' }}
                  />
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'center', marginTop: 20 }}>
                Selecciona o crea una fuente.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
