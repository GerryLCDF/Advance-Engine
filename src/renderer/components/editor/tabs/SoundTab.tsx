import React, { useState, useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { HierarchyPanel, type HierarchySection } from '../HierarchyPanel';
import { InspectorPanel, type InspectorSection } from '../InspectorPanel';
import { ResizableEditorLayout } from '../ResizableEditorLayout';
import { EmptyState } from '../EmptyState';
import {
  HeadphonesFilledIcon,
  NoiseIcon,
  PlayIcon,
  PlusIcon,
  RotateCcwIcon,
  StopIcon,
  VolumeIcon,
  WaveIcon,
} from './icons';
import { playGBASound, getAudioContext, loadAudioFileBuffer } from '../../../utils/gba_audio';
import { convertAudioToGbaPcm, pcmToAudioBuffer, formatBytes, GBA_SAMPLE_RATES } from '../../../utils/gba_pcm';
import type { SoundEffect } from '../../../types/editor';

// ── Waveform canvas component ────────────────────────────────────────────
export interface WaveformPlayerHandle {
  togglePlay: () => void;
}

const WaveformPlayer = forwardRef<WaveformPlayerHandle, { sound: SoundEffect }>(function WaveformPlayer({ sound }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const startTimeRef = useRef(0);
  const rafRef = useRef<number>(0);
  const delayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Buffer a mostrar/reproducir: si ya hay PCM convertido se usa ese (suena
  // igual que en la ROM); si no, el archivo decodificado; si no, es sintético.
  useEffect(() => {
    let cancelled = false;
    if (sound.pcmBase64 && sound.pcmRate) {
      const buf = pcmToAudioBuffer(sound.pcmBase64, sound.pcmRate);
      setAudioBuffer(buf);
      setDuration(buf.duration);
    } else if (sound.filePath) {
      loadAudioFileBuffer(sound.filePath).then((buf) => {
        if (cancelled || !buf) return;
        setAudioBuffer(buf);
        setDuration(buf.duration);
      });
    } else {
      setAudioBuffer(null);
      setDuration(sound.duration);
    }
    return () => { cancelled = true; };
  }, [sound.pcmBase64, sound.pcmRate, sound.filePath, sound.duration]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth * dpr;
    const h = canvas.clientHeight * dpr;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#141420';
    ctx.fillRect(0, 0, w, h);

    const drawProgress = sound.filePath ? (currentTime / (duration || 1)) : (currentTime / (duration || 1));

    if (audioBuffer) {
      // Draw waveform from decoded data
      const data = audioBuffer.getChannelData(0);
      const totalSamples = data.length;
      const step = Math.max(1, Math.floor(totalSamples / w));
      const mid = h / 2;

      // Background waveform (dim)
      ctx.strokeStyle = '#2a2a3a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const idx = Math.min(Math.floor(x / w * totalSamples), totalSamples - 1);
        const sample = Math.abs(data[idx]);
        const y = mid - sample * mid * 0.9;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Playback progress overlay (brighter)
      const progressX = Math.floor(drawProgress * w);
      ctx.strokeStyle = 'var(--accent-light)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < Math.min(progressX, w); x++) {
        const idx = Math.min(Math.floor(x / w * totalSamples), totalSamples - 1);
        const sample = Math.abs(data[idx]);
        const y = mid - sample * mid * 0.9;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Progress line
      if (progressX > 0 && progressX < w) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(progressX, 0);
        ctx.lineTo(progressX, h);
        ctx.stroke();
      }
    } else if (sound.type === 'noise') {
      // Draw noise visualization
      ctx.fillStyle = '#2a2a3a';
      for (let x = 0; x < w; x += 3) {
        const barHeight = Math.random() * h * 0.8;
        ctx.fillRect(x, h - barHeight, 2, barHeight);
      }
    } else {
      // Draw duty cycle wave
      const dutyPercent = sound.dutyCycleValue / 100;
      const cycles = 4;
      const cycleW = w / cycles;
      ctx.fillStyle = '#2a2a3a';
      for (let c = 0; c < cycles; c++) {
        const onW = cycleW * dutyPercent;
        const offW = cycleW * (1 - dutyPercent);
        const cx = c * cycleW;
        ctx.fillRect(cx, h * 0.2, onW, h * 0.6);
      }
    }
  }, [audioBuffer, currentTime, duration, sound.filePath, sound.type, sound.dutyCycleValue]);

  const stopPlayback = useCallback(() => {
    if (delayTimeoutRef.current) clearTimeout(delayTimeoutRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    try { sourceRef.current?.stop(); } catch {}
    sourceRef.current = null;
    gainRef.current = null;
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const startPlayback = useCallback(async () => {
    stopPlayback();
    const ctx = getAudioContext();

    const vol = sound.masterVolume / 100;
    const pitchRatio = Math.pow(2, sound.pitch / 12);
    const playbackRate = sound.speed * pitchRatio;

    gainRef.current = ctx.createGain();
    gainRef.current.gain.value = vol;
    gainRef.current.connect(ctx.destination);

    // Fuente: PCM ya convertido (versión GBA) > archivo decodificado > sintético.
    let buf: AudioBuffer | null = null;
    if (sound.pcmBase64 && sound.pcmRate) {
      buf = pcmToAudioBuffer(sound.pcmBase64, sound.pcmRate);
    } else if (sound.filePath) {
      buf = await loadAudioFileBuffer(sound.filePath);
    }

    if (buf) {
      const doPlay = () => {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = playbackRate;
        src.connect(gainRef.current!);
        src.start(ctx.currentTime);
        sourceRef.current = src;
        startTimeRef.current = ctx.currentTime;
        setIsPlaying(true);

        src.onended = () => {
          setIsPlaying(false);
          setCurrentTime(0);
          sourceRef.current = null;
        };

        const updateTime = () => {
          if (sourceRef.current && startTimeRef.current > 0) {
            const elapsed = ctx.currentTime - startTimeRef.current;
            const effectiveDuration = buf.duration / playbackRate;
            if (elapsed >= effectiveDuration) {
              setCurrentTime(effectiveDuration);
              setIsPlaying(false);
              setCurrentTime(0);
              return;
            }
            setCurrentTime(elapsed);
            rafRef.current = requestAnimationFrame(updateTime);
          }
        };
        rafRef.current = requestAnimationFrame(updateTime);
      };

      if (sound.delay > 0) {
        delayTimeoutRef.current = setTimeout(doPlay, sound.delay * 1000);
      } else {
        doPlay();
      }
    } else {
      // Synthesized sound — use playGBASound but with our gain control
      const duration = sound.duration;

      const doPlay = () => {
        playGBASound({
          type: sound.type,
          freq: sound.freq * playbackRate,
          volume: 12,
          dutyCycleValue: sound.dutyCycleValue,
          change: sound.change,
          sweepShift: sound.sweepShift,
          sweepTime: sound.sweepTime,
          lengthEnabled: sound.lengthEnabled,
          length: sound.length,
          waveBuffer: sound.waveData,
          duration,
        });
        startTimeRef.current = ctx.currentTime;
        setIsPlaying(true);

        const updateTime = () => {
          const elapsed = ctx.currentTime - startTimeRef.current;
          if (elapsed >= duration) {
            setIsPlaying(false);
            setCurrentTime(0);
            return;
          }
          setCurrentTime(elapsed);
          rafRef.current = requestAnimationFrame(updateTime);
        };
        rafRef.current = requestAnimationFrame(updateTime);
      };

      if (sound.delay > 0) {
        delayTimeoutRef.current = setTimeout(doPlay, sound.delay * 1000);
      } else {
        doPlay();
      }
    }
  }, [sound, stopPlayback]);

  // Expose togglePlay to parent
  useImperativeHandle(ref, () => ({
    togglePlay: () => {
      if (isPlaying) stopPlayback();
      else startPlayback();
    },
  }), [isPlaying, stopPlayback, startPlayback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (delayTimeoutRef.current) clearTimeout(delayTimeoutRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try { sourceRef.current?.stop(); } catch {}
    };
  }, []);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-canvas)', minHeight: 0 }}>
      {/* Waveform: es lo primero que se encoge si falta altura (el aviso de
          procesado no debe empujar los controles fuera de la ventana). */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '12px 16px', minHeight: 0, overflow: 'hidden' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', minHeight: 48, borderRadius: 6 }} />
      </div>

      {/* Player: solo Play/Pausa (el waveform de arriba es la pista) */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '10px 16px',
        borderTop: '1px solid var(--border-light)', background: 'var(--bg-panel)', flexShrink: 0,
      }}>
        <button onClick={isPlaying ? stopPlayback : startPlayback}
          title={isPlaying ? 'Pausar' : 'Reproducir'}
          style={{
            background: isPlaying ? '#f87171' : 'var(--accent)', border: 'none', borderRadius: 6,
            color: '#fff', fontSize: 12, padding: '8px 22px', cursor: 'pointer',
            fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {isPlaying ? <StopIcon size={13} /> : <PlayIcon size={13} />}
          {isPlaying ? 'Pausar' : 'Reproducir'}
        </button>
        <span style={{ color: 'var(--text-muted)', fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
});

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

// ── Helpers ──────────────────────────────────────────────────────────────
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteToFreq(note: string, octave: number): number {
  const semitone = NOTE_NAMES.indexOf(note);
  if (semitone < 0) return 440;
  const midi = (octave + 1) * 12 + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function freqToNote(freq: number): string {
  if (freq <= 0) return 'A4';
  const midi = Math.round(69 + 12 * Math.log2(freq / 440));
  const clamped = Math.max(0, Math.min(119, midi));
  const octave = Math.floor(clamped / 12) - 1;
  const noteIdx = clamped % 12;
  return `${NOTE_NAMES[noteIdx]}${octave}`;
}

function SoundIcon({ type, size = 14 }: { type: 'duty' | 'wave' | 'noise'; size?: number }) {
  if (type === 'noise') return <NoiseIcon size={size} />;
  if (type === 'wave') return <WaveIcon size={size} />;
  return <VolumeIcon size={size} />;
}

// ── Knob component (from MusicTab) ───────────────────────────────────────
function Knob({ value, min, max, step, onChange, label, unit }: {
  value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; label: string; unit?: string;
}) {
  const knobRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const startValRef = useRef(0);

  const range = max - min;
  const ratio = (value - min) / range;
  const angle = -135 + ratio * 270;

  const onMouseDown = (e: React.MouseEvent) => {
    draggingRef.current = true;
    startYRef.current = e.clientY;
    startValRef.current = value;
    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return;
      const delta = startYRef.current - ev.clientY;
      const newVal = Math.max(min, Math.min(max, startValRef.current + delta * (range / 200)));
      onChange(Math.round(newVal / step) * step);
    };
    const onUp = () => { draggingRef.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div ref={knobRef} onMouseDown={onMouseDown}
        style={{
          width: 32, height: 32, borderRadius: '50%', cursor: 'ns-resize',
          background: 'radial-gradient(circle at 40% 35%, #3a3a4a, #1a1a2a)',
          position: 'relative', border: '1px solid var(--border-light)',
        }}
      >
        <div style={{
          position: 'absolute', top: 3, left: '50%', width: 2, height: 10,
          background: 'var(--accent-light)', borderRadius: 1, transformOrigin: 'bottom center',
          transform: `translateX(-50%) rotate(${angle}deg)`,
        }} />
      </div>
      <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>{label}</span>
      <span style={{ color: 'var(--text)', fontSize: 10, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {value}{unit || ''}
      </span>
    </div>
  );
}

// ── Slider row ───────────────────────────────────────────────────────────
function SliderRow({ label, value, min, max, step, onChange, unit, defaultVal }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; unit?: string; defaultVal?: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: 'var(--text)', fontSize: 10, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {typeof value === 'number' ? value.toFixed(step < 1 ? 2 : 0) : value}{unit || ''}
          </span>
          {defaultVal !== undefined && value !== defaultVal && (
            <span onClick={() => onChange(defaultVal)}
              style={{ cursor: 'pointer', color: 'var(--text-muted)', padding: '0 2px', opacity: 0.5, display: 'grid', placeItems: 'center' }}
              title="Restablecer"
            >
              <RotateCcwIcon size={12} />
            </span>
          )}
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', margin: 0 }}
      />
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────
export function SoundTab() {
  const sounds = useAppStore((s) => s.sounds);
  const addSound = useAppStore((s) => s.addSound);
  const updateSound = useAppStore((s) => s.updateSound);
  const removeSound = useAppStore((s) => s.removeSound);
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useAppStore((s) => s.setSelectedNodeId);
  const hierarchyWidth = useAppStore((s) => s.hierarchyWidth);
  const setHierarchyWidth = useAppStore((s) => s.setHierarchyWidth);
  const inspectorWidth = useAppStore((s) => s.inspectorWidth);
  const setInspectorWidth = useAppStore((s) => s.setInspectorWidth);

  const [isImporting, setIsImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: 'info' | 'ok' | 'warn' } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerRef = useRef<WaveformPlayerHandle>(null);

  const selectedSound = sounds.find((sd) => sd.id === selectedNodeId);

  const showNotice = useCallback((text: string, tone: 'info' | 'ok' | 'warn', autoHide = true) => {
    setNotice({ text, tone });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    if (autoHide) noticeTimer.current = setTimeout(() => setNotice(null), 7000);
  }, []);

  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);

  // Space to play/pause
  useEffect(() => {
    if (!selectedSound) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.code === 'Space') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
        e.preventDefault();
        playerRef.current?.togglePlay();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedSound]);

  // Convierte el archivo al formato de la GBA (8-bit mono PCM) y lo guarda en el
  // sonido. Se avisa mientras procesa: el usuario tiene que saber que el audio se
  // transforma para que quepa y suene en la consola.
  const convertSound = useCallback(async (id: string, filePath: string, rate: number) => {
    showNotice(`Procesando audio para que se ajuste a la consola… (8-bit mono · ${rate} Hz)`, 'info', false);
    try {
      const pcm = await convertAudioToGbaPcm(filePath, rate);
      if (!pcm) { showNotice('No se pudo leer o decodificar el audio (¿formato no soportado?).', 'warn'); return; }
      updateSound(id, {
        pcmBase64: pcm.base64, pcmRate: pcm.rate, pcmBytes: pcm.bytes, pcmPeak: pcm.peak, duration: pcm.duration,
      });
      showNotice(`Audio ajustado a la GBA: 8-bit mono · ${pcm.rate} Hz · ${formatBytes(pcm.bytes)} · ${pcm.duration.toFixed(2)}s`, 'ok');
    } catch (e) {
      showNotice(`Error al procesar el audio: ${String(e)}`, 'warn');
    }
  }, [showNotice, updateSound]);

  const importAudioPath = useCallback(async (filePath: string) => {
    const name = filePath.split(/[\\/]/).pop()?.replace(/\.[^/.]+$/, '') || 'Imported';
    const rate = GBA_SAMPLE_RATES[1]; // 11025 Hz por defecto
    const id = addSound({ filePath, name, pcmRate: rate });
    setSelectedNodeId(id);
    await convertSound(id, filePath, rate);
  }, [addSound, setSelectedNodeId, convertSound]);

  const handleImport = async () => {
    try {
      const api = window.advanceAPI;
      const result = await api.dialog.openAudio();
      if (!result || !result.path) return;
      setIsImporting(true);
      await importAudioPath(result.path);
      setIsImporting(false);
    } catch { setIsImporting(false); }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    let importados = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Electron 31 expone File.path; 32+ exige webUtils (vía preload).
      const filePath = ((file as any).path as string | undefined) || window.advanceAPI?.filePathFor?.(file) || '';
      if (!filePath) {
        showNotice(`No se pudo leer la ruta de "${file.name}". Usa el botón "+ Cargar WAV/MP3".`, 'warn');
        continue;
      }
      const ext = filePath.split('.').pop()?.toLowerCase();
      if (!ext || !['wav', 'mp3', 'ogg', 'flac'].includes(ext)) {
        showNotice(`Formato no soportado: "${file.name}". Usa WAV, MP3, OGG o FLAC.`, 'warn');
        continue;
      }
      importados++;
      await importAudioPath(filePath);
    }
    if (importados === 0 && files.length > 0) {
      showNotice('No se importó ningún archivo (formato no soportado o sin ruta).', 'warn');
    }
  }, [importAudioPath, showNotice]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const hierarchySections: HierarchySection[] = [
    {
      id: 'sounds',
      title: 'SOUNDS',
      items: sounds.map((sd) => ({
        id: sd.id,
        label: sd.name,
        icon: <SoundIcon type={sd.type} />,
        subtitle: sd.filePath ? sd.filePath.split(/[\\/]/).pop() || '' : `${sd.duration.toFixed(1)}s`,
      })),
    },
  ];

  const inspectorSections: InspectorSection[] = [];

  if (selectedSound) {
    const sd = selectedSound;
    inspectorSections.push({
      title: 'Ajustes',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 56 }}>Nombre</span>
            <input type="text" value={sd.name}
              onChange={(e) => updateSound(sd.id, { name: e.target.value })}
              style={{ flex: 1, background: '#141420', border: '1px solid var(--border-light)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '3px 6px', outline: 'none' }}
            />
          </div>

          {/* Usage: SFX / Music */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 56 }}>Uso</span>
            <div style={{ display: 'flex', gap: 4, flex: 1 }}>
              <button onClick={() => updateSound(sd.id, { usage: 'sfx' })}
                style={{
                  flex: 1, padding: '4px 8px', fontSize: 10, borderRadius: 4, cursor: 'pointer',
                  border: sd.usage === 'sfx' ? '1px solid var(--accent)' : '1px solid var(--border-light)',
                  background: sd.usage === 'sfx' ? 'var(--accent)' : 'transparent',
                  color: sd.usage === 'sfx' ? '#fff' : 'var(--text-muted)',
                }}
              >
                SFX
              </button>
              <button onClick={() => updateSound(sd.id, { usage: 'music' })}
                style={{
                  flex: 1, padding: '4px 8px', fontSize: 10, borderRadius: 4, cursor: 'pointer',
                  border: sd.usage === 'music' ? '1px solid var(--accent)' : '1px solid var(--border-light)',
                  background: sd.usage === 'music' ? 'var(--accent)' : 'transparent',
                  color: sd.usage === 'music' ? '#fff' : 'var(--text-muted)',
                }}
              >
                Música
              </button>
            </div>
          </div>

          {/* File info */}
          {sd.filePath && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 10, flex: 1, wordBreak: 'break-all' }}>
                {sd.filePath.split(/[\\/]/).pop()}
              </span>
              <button onClick={() => updateSound(sd.id, { filePath: undefined })}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>
                &times;
              </button>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />

          {/* Volume knob row */}
          <div style={{ display: 'flex', justifyContent: 'space-around', padding: '4px 0' }}>
            <Knob label="Volumen" value={sd.masterVolume} min={0} max={100} step={1}
              onChange={(v) => updateSound(sd.id, { masterVolume: v })} unit="%" />
            <Knob label="Pitch" value={sd.pitch} min={-12} max={12} step={1}
              onChange={(v) => updateSound(sd.id, { pitch: v })} />
            {!sd.pcmBase64 && (
              <Knob label="Speed" value={sd.speed} min={0.25} max={4} step={0.05}
                onChange={(v) => updateSound(sd.id, { speed: v })} unit="x" />
            )}
            {!sd.pcmBase64 && (
              <Knob label="Delay" value={sd.delay} min={0} max={2} step={0.01}
                onChange={(v) => updateSound(sd.id, { delay: v })} unit="s" />
            )}
          </div>

          {!sd.pcmBase64 && (
            <>
              <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />
              <SliderRow label="Ataque" value={sd.attack} min={0} max={1} step={0.01}
                onChange={(v) => updateSound(sd.id, { attack: v })} unit="s" defaultVal={0} />
              <SliderRow label="Release" value={sd.release} min={0} max={2} step={0.01}
                onChange={(v) => updateSound(sd.id, { release: v })} unit="s" defaultVal={0.05} />
            </>
          )}

          <div style={{ borderTop: '1px solid var(--border-light)', margin: '2px 0' }} />

          {/* Import */}
          {!sd.filePath && (
            <button onClick={handleImport} disabled={isImporting}
              style={{
                background: 'transparent', border: '1px dashed var(--border-light)', borderRadius: 4,
                color: 'var(--text-muted)', fontSize: 10, padding: '8px', cursor: 'pointer',
                width: '100%',
              }}
            >
              {isImporting ? 'Importando...' : '+ Cargar WAV/MP3'}
            </button>
          )}
        </div>
      ),
    });

    // Sección PCM: solo para audios importados (ya convertidos a formato GBA)
    if (sd.pcmBase64) {
      const rate = sd.pcmRate ?? 11025;
      const bytes = sd.pcmBytes ?? 0;
      inspectorSections.push({
        title: 'Audio GBA (PCM)',
        content: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 56 }}>Calidad</span>
              <select value={rate}
                onChange={(e) => {
                  const r = parseInt(e.target.value);
                  updateSound(sd.id, { pcmRate: r });
                  if (sd.filePath) convertSound(sd.id, sd.filePath, r);
                }}
                style={{ flex: 1, background: '#141420', border: '1px solid var(--border-light)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '3px 6px', outline: 'none' }}
              >
                {GBA_SAMPLE_RATES.map((r) => (
                  <option key={r} value={r}>{r} Hz{r === 11025 ? ' (recomendado)' : ''}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 56 }}>Bucle</span>
              <button onClick={() => updateSound(sd.id, { loop: !sd.loop })}
                style={{
                  width: 44, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', position: 'relative',
                  background: sd.loop ? 'var(--accent)' : 'var(--bg-raised)', transition: 'background 0.15s',
                }}
              >
                <div style={{
                  position: 'absolute', top: 2, width: 18, height: 18, borderRadius: '50%',
                  background: '#fff', transition: 'left 0.15s', left: sd.loop ? 24 : 2,
                }} />
              </button>
              <span style={{ color: 'var(--text-secondary)', fontSize: 10 }}>{sd.loop ? 'Se repite' : 'Una vez'}</span>
            </div>

            <div style={{ color: 'var(--text-secondary)', fontSize: 10, fontFamily: 'monospace' }}>
              8-bit mono · {rate} Hz · {formatBytes(bytes)} · {(sd.duration || 0).toFixed(2)}s
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: 10, lineHeight: 1.4 }}>
              Se exporta como PCM y suena por DMA en la ROM (música de fondo o efecto desde un script).
            </div>

            {sd.filePath && (
              <button onClick={() => convertSound(sd.id, sd.filePath!, rate)}
                style={{
                  background: 'transparent', border: '1px dashed var(--border-light)', borderRadius: 4,
                  color: 'var(--text-muted)', fontSize: 10, padding: '6px', cursor: 'pointer', width: '100%',
                }}
              >
                Reprocesar audio
              </button>
            )}
          </div>
        ),
      });
    }

    // GBA export section (collapsible) — solo para sonidos sintetizados
    if (!sd.pcmBase64) inspectorSections.push({
      title: 'Exportacion GBA',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 56 }}>Tipo</span>
            <select value={sd.type}
              onChange={(e) => updateSound(sd.id, { type: e.target.value as 'duty' | 'wave' | 'noise' })}
              style={{ flex: 1, background: '#141420', border: '1px solid var(--border-light)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '3px 6px', outline: 'none' }}
            >
              <option value="duty">Pulse</option>
              <option value="wave">Wave</option>
              <option value="noise">Noise</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 56 }}>Nota</span>
            <input type="text" value={freqToNote(sd.freq || 440)}
              onChange={(e) => {
                const match = e.target.value.match(/^([A-G]#?)(\d)$/);
                if (match) updateSound(sd.id, { freq: noteToFreq(match[1], parseInt(match[2])) });
              }}
              placeholder="A4"
              style={{ width: 50, background: '#141420', border: '1px solid var(--border-light)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '3px 6px', outline: 'none', textAlign: 'center' }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{Math.round(sd.freq || 440)} Hz</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 56 }}>Duracion</span>
            <input type="range" min={0.05} max={5} step={0.05} value={sd.duration}
              onChange={(e) => updateSound(sd.id, { duration: parseFloat(e.target.value) })}
              style={{ flex: 1 }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: 10, minWidth: 36, textAlign: 'right' }}>{sd.duration.toFixed(2)}s</span>
          </div>

          {sd.type === 'duty' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 56 }}>Duty</span>
              <select value={sd.dutyCycleValue}
                onChange={(e) => updateSound(sd.id, { dutyCycleValue: parseFloat(e.target.value) })}
                style={{ flex: 1, background: '#141420', border: '1px solid var(--border-light)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '3px 6px', outline: 'none' }}
              >
                <option value={12.5}>12.5%</option>
                <option value={25}>25%</option>
                <option value={50}>50%</option>
                <option value={75}>75%</option>
              </select>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 56 }}>Envelope</span>
            <input type="range" min={-15} max={15} step={1} value={sd.change}
              onChange={(e) => updateSound(sd.id, { change: parseInt(e.target.value) })}
              style={{ flex: 1 }}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: 10, minWidth: 24, textAlign: 'right' }}>{sd.change > 0 ? '+' : ''}{sd.change}</span>
          </div>

          {sd.type === 'duty' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 56 }}>Sweep</span>
              <input type="range" min={0} max={7} step={1} value={sd.sweepShift}
                onChange={(e) => updateSound(sd.id, { sweepShift: parseInt(e.target.value) })}
                style={{ flex: 1 }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: 10, minWidth: 24, textAlign: 'right' }}>{sd.sweepShift}</span>
            </div>
          )}

          {sd.type === 'duty' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 56 }}>Sweep Time</span>
              <input type="range" min={0} max={7} step={1} value={sd.sweepTime}
                onChange={(e) => updateSound(sd.id, { sweepTime: parseInt(e.target.value) })}
                style={{ flex: 1 }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: 10, minWidth: 24, textAlign: 'right' }}>{sd.sweepTime}</span>
            </div>
          )}
        </div>
      ),
    });

    inspectorSections.push({
      title: 'Eliminar',
      content: (
        <button onClick={() => { removeSound(sd.id); setSelectedNodeId(''); }}
          style={{
            width: '100%', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
            borderRadius: 4, color: '#f87171', fontSize: 11, padding: '6px 12px', cursor: 'pointer',
          }}
        >
          Eliminar sonido
        </button>
      ),
    });
  }

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
          onSelect={(id) => setSelectedNodeId(id)}
          onRemove={(id) => { removeSound(id); setSelectedNodeId(''); }}
        />
      }
      center={
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg-canvas)',
            outline: dragOver ? '2px dashed var(--accent-light)' : 'none', outlineOffset: -2,
          }}
        >
          {notice && (
            <div style={{
              padding: '6px 12px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
              background: notice.tone === 'warn' ? 'rgba(248,113,113,0.12)' : notice.tone === 'ok' ? 'rgba(74,222,128,0.12)' : 'rgba(124,92,240,0.12)',
              color: notice.tone === 'warn' ? '#f87171' : notice.tone === 'ok' ? '#4ade80' : 'var(--accent-lighter)',
              borderBottom: '1px solid var(--border-light)',
            }}>
              {notice.text}
            </div>
          )}
          {selectedSound ? (
            <WaveformPlayer ref={playerRef} sound={selectedSound} />
          ) : (
            <div style={{ flex: 1, display: 'flex', background: 'var(--bg-canvas)', minHeight: 0 }}>
              <EmptyState
                background="transparent"
                icon={<HeadphonesFilledIcon size={40} />}
                title={sounds.length === 0 ? 'Sin efectos de sonido' : 'Sin sonido seleccionado'}
                hint="Arrastra archivos de audio aquí o impórtalos manualmente. Se convertirán a 8-bit mono para la consola."
                action={
                  <button onClick={handleImport} disabled={isImporting}
                    style={{
                      marginTop: 2,
                      background: dragOver ? 'var(--accent)' : 'transparent',
                      border: dragOver ? 'none' : '1px dashed var(--border-light)',
                      borderRadius: 4,
                      color: dragOver ? '#fff' : 'var(--text-muted)',
                      fontSize: 11, padding: '8px 16px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    {isImporting ? 'Importando...' : '+ Cargar WAV/MP3'}
                  </button>
                }
              />
            </div>
          )}
        </div>
      }
      right={
        <InspectorPanel
          title="Sonido"
          sections={inspectorSections}
          emptyMessage="Selecciona un sonido"
        />
      }
    />
  );
}
