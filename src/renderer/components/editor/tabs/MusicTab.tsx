import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { HierarchyPanel, type HierarchySection } from '../HierarchyPanel';
import { InspectorPanel, type InspectorSection } from '../InspectorPanel';
import { ResizableEditorLayout } from '../ResizableEditorLayout';
import { EmptyState } from '../EmptyState';
import {
  ActivityIcon,
  ClefIcon,
  HeadphonesFilledIcon,
  EraserIcon,
  MinusIcon,
  MousePointerIcon,
  MusicIcon,
  NoiseIcon,
  Pencil2Icon,
  PlayIcon,
  PlusIcon,
  SaveIcon,
  StopIcon,
  WaveIcon,
} from './icons';
import type { InstrumentType, NoteRow, InstrumentPreset } from '../../../types/editor';
import { PRESET_GROUP_ORDER } from '../../../utils/instrumentPresets';
import { playGBASound, getAudioContext } from '../../../utils/gba_audio';
import { pcmToAudioBuffer } from '../../../utils/gba_pcm';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const CHANNELS = [
  { id: 'ch-pulse1', name: 'Pulse 1', type: 'duty', icon: <ActivityIcon /> },
  { id: 'ch-pulse2', name: 'Pulse 2', type: 'duty', icon: <ActivityIcon /> },
  { id: 'ch-wave', name: 'Wave', type: 'wave', icon: <WaveIcon /> },
  { id: 'ch-noise', name: 'Noise', type: 'noise', icon: <NoiseIcon /> },
  // Canal extra: instrumento PCM (muestra) por DMA, como los juegos comerciales.
  { id: 'ch-pcm', name: 'PCM', type: 'pcm', icon: <HeadphonesFilledIcon /> },
];

// Alturas REALES de las filas del tracker (medidas en el DOM): la cabecera
// mide 21px (lleva iconos) y cada fila de step 18px. Antes se asumía 21px por
// fila, así que el playhead derivaba 3px por paso (al final, ~190px fuera) y
// el clic para posicionarse apuntaba y sonaba la fila equivocada.
const TRACKER_HEADER_H = 21;
const TRACKER_ROW_H = 18;

const CHANNEL_COLORS: Record<string, string> = {
  'ch-pulse1': '#57E4B3',
  'ch-pulse2': '#00A9CC',
  'ch-wave': '#A78BFA',
  'ch-noise': '#F97316',
  'ch-pcm': '#38BDF8',
};

// ── Audio ──────────────────────────────────────────────────────────────────
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function noteToFreq(note: string, octave: number): number {
  const A4 = 440, A4_idx = 69;
  const idx = NOTE_NAMES.indexOf(note) + (octave + 1) * 12;
  return A4 * Math.pow(2, (idx - A4_idx) / 12);
}

function playNoteSound(preset: InstrumentPreset, freq: number, isPlayback = false) {
  // Instrumento PCM: la muestra del sonido, reproducida a la altura de la nota
  // (como el canal DMA de la ROM). El pitch es freq / frecuencia de la nota base.
  if (preset.type === 'pcm') {
    const sd = useAppStore.getState().sounds.find((s) => s.id === preset.sampleId);
    if (!sd?.pcmBase64 || !sd.pcmRate) return;
    try {
      const ctx = getAudioContext();
      const buf = pcmToAudioBuffer(sd.pcmBase64, sd.pcmRate);
      const m = (preset.baseNote ?? 'C4').match(/^([A-G]#?)(\d)$/);
      const baseFreq = m ? noteToFreq(m[1], parseInt(m[2])) : 440;
      const ratio = Math.max(0.25, Math.min(4, freq / baseFreq));
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = ratio;
      const g = ctx.createGain();
      g.gain.value = Math.max(0, Math.min(1, (sd.masterVolume ?? 80) / 100));
      src.connect(g); g.connect(ctx.destination);
      src.start();
      if (!sd.loop) src.stop(ctx.currentTime + buf.duration / ratio);
    } catch { /* audio no disponible */ }
    return;
  }
  playGBASound({
    type: preset.type,
    freq,
    volume: preset.initialVolume,
    dutyCycleValue: preset.dutyCycleValue,
    change: preset.change,
    sweepShift: preset.sweepShift,
    sweepTime: preset.sweepTime,
    lengthEnabled: preset.lengthEnabled,
    length: preset.length,
    // La prueba (botones C3-C8 / teclado / clic en celda) dura más para que se
    // aprecie la forma del instrumento (fade, sweep). El secuenciador usa el
    // blip corto, igual que la nota que emite la ROM.
    duration: isPlayback ? 0.08 : preset.type === 'noise' ? 0.3 : 0.5,
  });
}

export function MusicTab() {
  const songs = useAppStore((s) => s.songs);
  const instrumentPresets = useAppStore((s) => s.instrumentPresets);
  const updateInstrumentPresetStore = useAppStore((s) => s.updateInstrumentPreset);
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useAppStore((s) => s.setSelectedNodeId);
  const addSong = useAppStore((s) => s.addSong);
  const removeSong = useAppStore((s) => s.removeSong);
  const updateSong = useAppStore((s) => s.updateSong);
  const addPattern = useAppStore((s) => s.addPattern);
  const removePattern = useAppStore((s) => s.removePattern);
  const updatePattern = useAppStore((s) => s.updatePattern);
  const updateNoteRow = useAppStore((s) => s.updateNoteRow);
  const removeNoteRow = useAppStore((s) => s.removeNoteRow);
  const hierarchyWidth = useAppStore((s) => s.hierarchyWidth);
  const inspectorWidth = useAppStore((s) => s.inspectorWidth);
  const setHierarchyWidth = useAppStore((s) => s.setHierarchyWidth);
  const setInspectorWidth = useAppStore((s) => s.setInspectorWidth);
  const keyWhiteColor = useAppStore((s) => s.keyWhiteColor);
  const keyBlackColor = useAppStore((s) => s.keyBlackColor);
  const chunkCols = useAppStore((s) => s.chunkCols);
  const chunkRows = useAppStore((s) => s.chunkRows);
  const showGrid = useAppStore((s) => s.showGrid);
  const gridLineOpacity = useAppStore((s) => s.gridLineOpacity);

  const [toolMode, setToolMode] = useState<'pencil' | 'eraser' | 'select'>('pencil');
  const [activePattern, setActivePattern] = useState<string | null>(null);
  const [musicZoom, setMusicZoom] = useState(2);
  const [viewMode, setViewMode] = useState<'tracker' | 'piano'>(() => useAppStore.getState().defaultMusicView);
  const [hoverRowIdx, setHoverRowIdx] = useState<number | null>(null);
  const [hoverStepIdx, setHoverStepIdx] = useState<number | null>(null);

  // ── Ajustes del preset seleccionado ──────────────────────────────────────
  // Se editan DIRECTO al store (updateInstrumentPreset): antes se guardaban en
  // un estado local que se perdía al recargar y jamás llegaba a la ROM.
  const updateEditablePreset = (patch: Partial<InstrumentPreset>) => {
    if (selectedNodeId && instrumentPresets.some((p) => p.id === selectedNodeId)) {
      updateInstrumentPresetStore(selectedNodeId, patch);
    }
  };

  const soundsWithPcm = useAppStore((s) => s.sounds).filter((sd) => !!sd.pcmBase64);

  // Al seleccionar un canal (o un instrumento) se colapsan los grupos de
  // instrumentos de los demás canales; el usuario puede reabrirlos a mano.
  const expandHeaderIds = React.useMemo(() => {
    const ch = CHANNELS.find((c) => c.id === selectedNodeId);
    const preset = instrumentPresets.find((p) => p.id === selectedNodeId);
    const groups: string[] = ch
      ? (ch.type === 'duty' ? ['DUTY']
        : ch.type === 'wave' ? ['WAVE']
        : ch.type === 'noise' ? ['NOISE']
        : ['PCM'])
      : preset ? [preset.group] : [];
    return groups.map((g) => `__header-${g.toLowerCase()}`);
  }, [selectedNodeId, instrumentPresets]);

  const BASE = 12;
  const CELL_W = BASE * musicZoom;
  const CELL_H = BASE * musicZoom;

  // Zoom con Ctrl+Wheel, scroll horizontal con Shift+Wheel (como las otras pestañas)
  const pianoRollRef = useRef<HTMLDivElement>(null);
  const gridMounted = songs.some((so) => so.patterns.some((p) => p.id === (activePattern ?? '')));
  useEffect(() => {
    const el = pianoRollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setMusicZoom((z) => Math.max(1, Math.min(4, z + (e.deltaY > 0 ? -0.5 : 0.5))));
      } else if (e.shiftKey) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', handler, { passive: false });

    // Middle-mouse drag to scroll
    let midDragStart: { x: number; y: number; sx: number; sy: number } | null = null;
    const onMidDown = (e: MouseEvent) => {
      if (e.button !== 1) return;
      e.preventDefault();
      el.style.cursor = 'grabbing';
      midDragStart = { x: e.clientX, y: e.clientY, sx: el.scrollLeft, sy: el.scrollTop };
    };
    const onMidMove = (e: MouseEvent) => {
      if (!midDragStart) return;
      el.scrollLeft = midDragStart.sx - (e.clientX - midDragStart.x);
      el.scrollTop = midDragStart.sy - (e.clientY - midDragStart.y);
    };
    const onMidUp = () => {
      if (!midDragStart) return;
      midDragStart = null;
      el.style.cursor = '';
    };
    el.addEventListener('mousedown', onMidDown);
    window.addEventListener('mousemove', onMidMove);
    window.addEventListener('mouseup', onMidUp);
    return () => {
      el.removeEventListener('wheel', handler);
      el.removeEventListener('mousedown', onMidDown);
      window.removeEventListener('mousemove', onMidMove);
      window.removeEventListener('mouseup', onMidUp);
    };
  }, [gridMounted]);
  const [channelStates, setChannelStates] = useState<Record<string, { visible: boolean; solo: boolean; muted: boolean }>>(() => {
    const m: Record<string, { visible: boolean; solo: boolean; muted: boolean }> = {};
    CHANNELS.forEach((ch) => { m[ch.id] = { visible: true, solo: false, muted: false }; });
    return m;
  });

  const toggleChannel = (id: string, key: 'visible' | 'solo' | 'muted') => {
    setChannelStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], [key]: !prev[id][key] },
    }));
  };

  // Canales con el ojo activo: el tracker oculta su columna.
  const visibleChannels = CHANNELS.filter((ch) => (channelStates[ch.id] ?? { visible: true }).visible);

  // Espejo en refs para que playStepSounds (memoizado sin deps) lea el estado
  // de canales actual sin recrearse en cada toggle.
  const channelStatesRef = useRef(channelStates);
  channelStatesRef.current = channelStates;
  const anySoloRef = useRef(false);
  anySoloRef.current = Object.values(channelStates).some((s) => s.solo);

  const selectedSong = songs.find((so) => so.id === selectedNodeId)
    ?? (selectedNodeId ? null : null);
  const selectedPattern = songs.flatMap((so) => so.patterns).find((p) => p.id === (activePattern ?? ''));

  const currentSong = selectedSong
    ?? (selectedPattern ? songs.find((so) => so.patterns.some((p) => p.id === selectedPattern.id)) : null);

  // Auto-select first pattern when song changes
  React.useEffect(() => {
    if (currentSong && currentSong.patterns.length > 0 && !currentSong.patterns.some((p) => p.id === activePattern)) {
      setActivePattern(currentSong.patterns[0].id);
    }
  }, [currentSong?.id, currentSong?.patterns.length]);

  const hierarchySections: HierarchySection[] = [
    {
      id: 'songs',
      title: 'SONGS',
      items: songs.map((so) => ({
        id: so.id, label: so.name, icon: <MusicIcon />,
        subtitle: `${so.bpm} BPM`,
      })),
      onAdd: addSong,
    },
    {
      id: 'channels',
      title: 'CHANNELS',
      collapsed: false,
      items: CHANNELS.map((ch) => {
        const cs = channelStates[ch.id] ?? { visible: true, solo: false, muted: false };
        const anySolo = Object.values(channelStates).some((s) => s.solo);
        return {
          id: ch.id, label: ch.name, icon: ch.icon, removable: false,
          dimmed: anySolo && !cs.solo,
          toggles: {
            eye: { on: cs.visible, onToggle: () => toggleChannel(ch.id, 'visible') },
            solo: { on: cs.solo, onToggle: () => toggleChannel(ch.id, 'solo') },
            mute: { on: cs.muted, onToggle: () => toggleChannel(ch.id, 'muted') },
          },
        };
      }),
    },
    {
      id: 'instruments',
      title: 'INSTRUMENTS',
      collapsed: false,
      items: PRESET_GROUP_ORDER.map((group) => ({
        id: `__header-${group.toLowerCase()}`, label: group, isHeader: true,
        children: instrumentPresets
          .filter((p) => p.group === group)
          .map((p) => ({
            id: p.id, label: p.name, icon: '', subtitle: '', color: p.color, removable: false,
          })),
      })),
    },
  ];

  const selectedPreset = instrumentPresets.find((p) => p.id === selectedNodeId);
  const selectedChannel = CHANNELS.find((c) => c.id === selectedNodeId);

  const inspectorSections: InspectorSection[] = [];

  if (selectedSong) {
    inspectorSections.push({
      title: 'Canción',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 64 }}>Nombre</span>
            <input type="text" value={selectedSong.name}
              onChange={(e) => updateSong(selectedSong.id, { name: e.target.value })}
              style={{ flex: 1, background: '#141420', border: '1px solid var(--border-light)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '3px 6px', outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 64 }}>Artista</span>
            <input type="text" value={selectedSong.artist}
              onChange={(e) => updateSong(selectedSong.id, { artist: e.target.value })}
              style={{ flex: 1, background: '#141420', border: '1px solid var(--border-light)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '3px 6px', outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Knob label="Tempo" value={Math.round((1008 - selectedSong.bpm) / 48)} min={1} max={20}
              onChange={(v) => updateSong(selectedSong.id, { bpm: 1008 - 48 * v })}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, alignItems: 'center', minWidth: 56 }}>
              <span style={{ color: 'var(--accent)', fontSize: 16, fontWeight: 700 }}>~{selectedSong.bpm}</span>
              <span style={{ color: 'var(--text-dim)', fontSize: 9, fontWeight: 600, letterSpacing: 1 }}>BPM</span>
            </div>
          </div>
        </div>
      ),
    });
  } else if (selectedChannel) {
    inspectorSections.push({
      title: 'Canal',
      fields: [
        { label: 'Nombre', type: 'text', value: selectedChannel.name, onChange: () => {} },
        { label: 'Tipo', type: 'text', value: selectedChannel.type.toUpperCase(), onChange: () => {} },
        { label: 'Volumen', type: 'number', value: 100, onChange: () => {} },
        { label: 'Pan', type: 'number', value: 0, onChange: () => {} },
      ],
    });
  } else if (selectedPreset) {
    const ep = selectedPreset;
    inspectorSections.push({
      title: 'Frecuencia',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Nombre + color */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="color"
              value={ep.color}
              onChange={(e) => updateEditablePreset({ color: e.target.value })}
              style={{ width: 20, height: 20, padding: 0, border: 'none', borderRadius: '50%', cursor: 'pointer', background: 'transparent', flexShrink: 0 }}
            />
            <input
              type="text"
              value={ep.name}
              onChange={(e) => updateEditablePreset({ name: e.target.value })}
              style={{ flex: 1, background: '#141420', border: '1px solid var(--border-light)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '3px 6px', outline: 'none' }}
            />
          </div>

          {/* Instrumento PCM: muestra (un sonido importado) + nota base */}
          {ep.type === 'pcm' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 10, minWidth: 46 }}>Muestra</span>
                <select
                  value={ep.sampleId ?? ''}
                  onChange={(e) => updateEditablePreset({ sampleId: e.target.value || undefined })}
                  style={{ flex: 1, background: '#141420', border: '1px solid var(--border-light)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '3px 6px', outline: 'none' }}
                >
                  <option value="">— elige un sonido —</option>
                  {soundsWithPcm.map((sd) => (
                    <option key={sd.id} value={sd.id}>{sd.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 10, minWidth: 46 }}>Nota base</span>
                <input
                  type="text"
                  value={ep.baseNote ?? 'C4'}
                  onChange={(e) => {
                    const v = e.target.value.toUpperCase();
                    updateEditablePreset({ baseNote: v });
                  }}
                  placeholder="C4"
                  style={{ width: 52, background: '#141420', border: '1px solid var(--border-light)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '3px 6px', outline: 'none', textAlign: 'center' }}
                />
                <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>
                  {ep.sampleId ? 'se toca a distintas alturas' : 'importa audio en Sound'}
                </span>
              </div>
              <div style={{ color: 'var(--text-dim)', fontSize: 10, lineHeight: 1.4 }}>
                Suena por el canal DMA (voz extra junto a los 4 canales PSG).
              </div>
            </>
          )}

          {/* 3 Length toggles + checkbox (solo PSG) */}
          {ep.type !== 'pcm' && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Knob label="Length" value={ep.length} min={0} max={64}
              onChange={(v) => updateEditablePreset({ length: v })}
              enabled={ep.lengthEnabled}
              onToggle={(v) => updateEditablePreset({ lengthEnabled: v })}
            />
            <Knob label="Vol inicial" value={ep.initialVolume} min={0} max={15}
              onChange={(v) => updateEditablePreset({ initialVolume: v })}
            />
            <Knob label="Change" value={ep.change} min={-7} max={7}
              onChange={(v) => updateEditablePreset({ change: v })}
            />
          </div>
          )}

          {/* Probar nota */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
            {[3, 4, 5, 6, 7, 8].map((oct) => (
              <button key={oct} onClick={() => {
                const p = instrumentPresets.find((pr) => pr.id === selectedNodeId);
                if (p) playNoteSound(p, noteToFreq('C', oct));
              }}
                style={{
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: 4,
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '4px 6px',
                  cursor: 'pointer',
                  minWidth: 32,
                }}
              >
                C{oct}
              </button>
            ))}
          </div>

          {/* Wave graph */}
          <div style={{
            height: 48, border: '1px solid var(--border-light)', borderRadius: 4,
            background: '#0a0a10', position: 'relative', overflow: 'hidden',
          }}>
            {renderWaveGraph(ep)}
          </div>

          {/* Duty cycle (solo PSG) */}
          {ep.type !== 'pcm' && <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 10, minWidth: 60 }}>Duty cycle</span>
            <select
              value={String(ep.dutyCycleValue)}
              onChange={(e) => updateEditablePreset({ dutyCycleValue: Number(e.target.value) })}
              style={{ flex: 1, background: '#141420', border: '1px solid var(--border-light)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '3px 6px', outline: 'none' }}
            >
              <option value="12.5">12.5%</option>
              <option value="25">25%</option>
              <option value="50">50%</option>
              <option value="75">75%</option>
            </select>
          </div>}

          {/* Sweep shift (solo PSG) */}
          {ep.type !== 'pcm' && <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 10, minWidth: 60 }}>Sweep shift</span>
              <input
                type="range"
                min={0} max={7} step={1}
                value={ep.sweepShift}
                onChange={(e) => updateEditablePreset({ sweepShift: Number(e.target.value) })}
                style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer', height: 4 }}
              />
              <span style={{ color: 'var(--text)', fontSize: 10, minWidth: 14, textAlign: 'right' }}>{ep.sweepShift}</span>
            </div>
            <select
              value={String(ep.sweepTime)}
              onChange={(e) => updateEditablePreset({ sweepTime: Number(e.target.value) })}
              style={{ width: '100%', background: '#141420', border: '1px solid var(--border-light)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '3px 6px', outline: 'none' }}
            >
              {Array.from({ length: 7 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}/128Hz</option>
              ))}
            </select>
          </div>}
        </div>
      ),
    });
  }

  const handleRemove = (id: string) => {
    if (songs.some((so) => so.id === id)) removeSong(id);
    else if (CHANNELS.some((c) => c.id === id) || instrumentPresets.some((p) => p.id === id)) {
      // Cannot remove channels or presets
      return;
    }
    else {
      for (const so of songs) {
        if (so.patterns.some((p) => p.id === id)) { removePattern(so.id, id); break; }
      }
    }
    if (selectedNodeId === id) setSelectedNodeId('');
  };

  const patternRows = selectedPattern?.rows ?? [];
  const patternSong = selectedPattern ? songs.find((so) => so.patterns.some((p) => p.id === selectedPattern.id)) : currentSong;
  const patternStepCount = patternRows.length;

  const [activeChannelId, setActiveChannelId] = useState('ch-pulse1');
  const [selectedInstId, setSelectedInstId] = useState<string>(
    () => useAppStore.getState().instrumentPresets[0]?.id ?? ''
  );

  const handleTreeSelect = useCallback((id: string) => {
    setSelectedNodeId(id);
    const p = useAppStore.getState().instrumentPresets.find((pr) => pr.id === id);
    if (p) {
      setSelectedInstId(p.id);
      const channel = CHANNELS.find((ch) => ch.type === p.type);
      if (channel) setActiveChannelId(channel.id);
      let foundNote = 'C', foundOctave = 4;
      for (const row of patternRows) {
        for (const ch of CHANNELS) {
          const nr = row[ch.id];
          if (nr?.instrumentId === p.id) {
            foundNote = nr.note;
            foundOctave = nr.octave;
            break;
          }
        }
      }
      playNoteSound(p, noteToFreq(foundNote, foundOctave));
    }
  }, [setSelectedNodeId, setSelectedInstId, setActiveChannelId, patternRows]);

  // Build all notes: C8 → C3 (72 notes, octaves 8-3)
  const ALL_NOTES: { note: string; octave: number; label: string }[] = [];
  for (let o = 8; o >= 3; o--) {
    for (let i = NOTES.length - 1; i >= 0; i--) {
      const n = NOTES[i];
      ALL_NOTES.push({ note: n, octave: o, label: `${n.includes('#') ? n : n + '-'}${o}` });
    }
  }
  const isNoteSharp = (n: string) => n.includes('#');
  const isCNote = (n: string) => n === 'C';

  useEffect(() => {
    if (CHANNELS.some((c) => c.id === selectedNodeId)) {
      setActiveChannelId(selectedNodeId);
    }
  }, [selectedNodeId]);

  // ── Playback ──────────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadStep, setPlayheadStep] = useState(0);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const isDraggingTrackerRef = useRef(false);
  const playbackPatternRef = useRef<string | null>(null);
  const playbackPatternIdxRef = useRef(0);
  const [isPlaybackPaused, setIsPlaybackPaused] = useState(false);

  // Reproduce sonidos en un step dado. Lee los presets y el estado de canales
  // del store fresco (el callback va memoizado sin deps): respeta Mute/Solo
  // igual que la jerarquía, así la previsualización suena como se ve.
  const playStepSounds = useCallback((step: number, rows: Record<string, NoteRow>[]) => {
    if (step < 0 || step >= rows.length) return;
    const stepNotes = rows[step] ?? {};
    for (const ch of CHANNELS) {
      const cs = channelStatesRef.current[ch.id];
      if (cs && cs.muted) continue;
      if (anySoloRef.current && !cs?.solo) continue;
      const nr = stepNotes[ch.id];
      if (nr) {
        const preset = useAppStore.getState().instrumentPresets.find((p) => p.id === nr.instrumentId);
        if (preset) {
          playNoteSound(preset, noteToFreq(nr.note, nr.octave), true);
        }
      }
    }
  }, []);

  // Obtiene el patrón actual por índice (para secuenciación)
  const getPatternByIndex = useCallback((idx: number): { id: string; rows: Record<string, NoteRow>[] } | null => {
    if (!currentSong) return null;
    const patterns = currentSong.patterns;
    if (idx < 0 || idx >= patterns.length) return null;
    const p = patterns[idx];
    return { id: p.id, rows: p.rows ?? [] };
  }, [currentSong]);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    setIsPlaybackPaused(false);
    if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    playIntervalRef.current = null;
  }, []);

  const startPlayback = useCallback(() => {
    if (!currentSong || currentSong.patterns.length === 0) return;

    // Determinar desde qué patrón empezar
    let startIdx = currentSong.patterns.findIndex((p) => p.id === (activePattern ?? selectedPattern?.id));
    if (startIdx < 0) startIdx = 0;

    playbackPatternIdxRef.current = startIdx;
    const pat = currentSong.patterns[startIdx];
    playbackPatternRef.current = pat.id;
    setActivePattern(pat.id);
    setPlayheadStep(0);

    const bpm = currentSong.bpm ?? 120;
    const stepMs = (60 / bpm) * 1000 / 4;

    setIsPlaying(true);
    setIsPlaybackPaused(false);
    if (playIntervalRef.current) clearInterval(playIntervalRef.current);

    // Variable mutable para el step actual (evita problemas de cierre)
    let currentStep = 0;

    playIntervalRef.current = setInterval(() => {
      const songs = useAppStore.getState().songs;
      const song = songs.find((so) => so.id === currentSong?.id);
      if (!song || song.patterns.length === 0) { stopPlayback(); return; }

      const patIdx = playbackPatternIdxRef.current;
      if (patIdx >= song.patterns.length) { stopPlayback(); setPlayheadStep(0); return; }

      const pat = song.patterns[patIdx];
      const rows = pat.rows ?? [];
      const stepCount = rows.length;

      if (currentStep >= stepCount) {
        // Avanzar al siguiente patrón
        const nextIdx = patIdx + 1;
        if (nextIdx < song.patterns.length) {
          playbackPatternIdxRef.current = nextIdx;
          const nextPat = song.patterns[nextIdx];
          playbackPatternRef.current = nextPat.id;
          setActivePattern(nextPat.id);
          currentStep = 0;
          setPlayheadStep(0);
        } else {
          // Loop infinito: volver al primer patrón
          playbackPatternIdxRef.current = 0;
          const firstPat = song.patterns[0];
          playbackPatternRef.current = firstPat.id;
          setActivePattern(firstPat.id);
          currentStep = 0;
          setPlayheadStep(0);
        }
        return;
      }

      // Reproducir sonidos del step actual
      playStepSounds(currentStep, rows);
      setPlayheadStep(currentStep);
      currentStep++;
    }, stepMs);
  }, [currentSong, activePattern, selectedPattern?.id, stopPlayback, playStepSounds]);

  const resetPlayback = useCallback(() => {
    stopPlayback();
    setPlayheadStep(0);
    if (activePattern) {
      playbackPatternRef.current = activePattern;
      playbackPatternIdxRef.current = currentSong?.patterns.findIndex((p) => p.id === activePattern) ?? 0;
    }
  }, [stopPlayback, activePattern, currentSong?.patterns]);

  // Ir a un step específico (click en grid)
  const seekPlayhead = useCallback((step: number) => {
    setPlayheadStep(step);
    if (!isPlaying && !isPlaybackPaused) {
      playStepSounds(step, patternRows);
    }
  }, [isPlaying, isPlaybackPaused, playStepSounds, patternRows]);

  // ── Drag playhead ───────────────────────────────────────────────────
  const dragGridRef = useRef<HTMLDivElement | null>(null);

  const onPlayheadMouseDown = useCallback((e: React.MouseEvent, isTracker = false) => {
    e.preventDefault();
    setIsDraggingPlayhead(true);
    const target = e.currentTarget;
    const overlay = target.parentElement;
    const grid = overlay?.parentElement;
    if (grid) dragGridRef.current = grid as HTMLDivElement;
    if (isTracker) {
      const rect = overlay?.getBoundingClientRect();
      if (!rect) return;
      const step = Math.floor((e.clientY - rect.top) / TRACKER_ROW_H);
      setPlayheadStep(Math.max(0, Math.min(step, patternStepCount - 1)));
      playStepSounds(step, patternRows);
    } else {
      if (!grid) return;
      const rect = grid.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const step = Math.floor(offsetX / CELL_W);
      setPlayheadStep(Math.max(0, Math.min(step, patternStepCount - 1)));
      playStepSounds(step, patternRows);
    }
  }, [patternStepCount, patternRows, playStepSounds]);

  useEffect(() => {
    if (!isDraggingPlayhead) return;
    const onMove = (e: MouseEvent) => {
      const grid = dragGridRef.current;
      if (!grid) return;
      const rect = grid.getBoundingClientRect();
      if (isDraggingTrackerRef.current) {
        const offsetY = e.clientY - rect.top;
        const step = Math.floor(offsetY / TRACKER_ROW_H);
        setPlayheadStep(Math.max(0, Math.min(step, patternStepCount - 1)));
      } else {
        const offsetX = e.clientX - rect.left;
        const step = Math.floor(offsetX / CELL_W);
        setPlayheadStep(Math.max(0, Math.min(step, patternStepCount - 1)));
      }
    };
    const onUp = () => { setIsDraggingPlayhead(false); isDraggingTrackerRef.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isDraggingPlayhead, patternStepCount]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.code === 'Space') { e.preventDefault(); isPlaying ? stopPlayback() : startPlayback(); }
      if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); resetPlayback(); }
      // Ctrl+Z/Y NO se manejan aquí: EditorTopBar ya tiene el atajo global de
      // undo/redo. Tenerlo también aquí hacía que un Ctrl+Z saltara 2 pasos.
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isPlaying, startPlayback, stopPlayback, resetPlayback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (playIntervalRef.current) clearInterval(playIntervalRef.current); };
  }, []);

  const [editStepCount, setEditStepCount] = useState(patternStepCount);

  // Sync editStepCount when pattern changes
  React.useEffect(() => {
    setEditStepCount(patternStepCount);
  }, [patternStepCount]);

  const handleResizePattern = (newCount: number) => {
    if (!patternSong || !selectedPattern) return;
    const cur = patternRows;
    const rows: Record<string, NoteRow>[] = Array.from({ length: newCount }, (_, i) =>
      i < cur.length ? { ...cur[i] } : {}
    );
    updatePattern(patternSong.id, selectedPattern.id, { rows });
  };

  return (
    <>
    <style>{`
      .music-piano-roll::-webkit-scrollbar { width: 10px; height: 10px; }
      .music-piano-roll::-webkit-scrollbar-track { background: transparent; }
      .music-piano-roll::-webkit-scrollbar-thumb { background: transparent; border-radius: 4px; }
      .music-piano-roll:hover::-webkit-scrollbar-thumb { background: #555; }
      .music-piano-roll::-webkit-scrollbar-thumb:hover { background: var(--accent); }
      .music-piano-roll::-webkit-scrollbar-corner { background: transparent; }
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
          onSelect={handleTreeSelect}
          onRemove={handleRemove}
          expandHeaderIds={expandHeaderIds.length ? expandHeaderIds : undefined}
        />
      }
      center={
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-canvas)', minHeight: 0 }}>
          {/* Toolbar — estilo cápsula (MundoTab) */}
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
              <ToolBtn onClick={() => useAppStore.getState().saveProject()}><SaveIcon size={14} /></ToolBtn>
              <div style={{ width: 1, height: 14, background: 'var(--bg-raised)', margin: '0 2px' }} />
<ToolBtn onClick={isPlaying ? stopPlayback : startPlayback}><PlayIcon size={14} /></ToolBtn>
<ToolBtn onClick={stopPlayback}><StopIcon size={14} /></ToolBtn>
              <div style={{ width: 1, height: 14, background: 'var(--bg-raised)', margin: '0 2px' }} />
              <ToolBtn active={toolMode === 'pencil'} onClick={() => setToolMode('pencil')}><Pencil2Icon /></ToolBtn>
              <ToolBtn active={toolMode === 'select'} onClick={() => setToolMode('select')}><MousePointerIcon /></ToolBtn>
              <ToolBtn active={toolMode === 'eraser'} onClick={() => setToolMode('eraser')}><EraserIcon size={14} /></ToolBtn>
              <div style={{ width: 1, height: 14, background: 'var(--bg-raised)', margin: '0 2px' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 4 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>Steps</span>
                <select
                  value={editStepCount}
                  onChange={(e) => handleResizePattern(Number(e.target.value))}
                  style={{
                    background: 'var(--bg-dark)', border: '1px solid var(--bg-raised)',
                    borderRadius: 8, color: 'var(--text-secondary)', fontSize: 9,
                    padding: '2px 4px', height: 18,
                  }}
                >
                  {[16, 32, 48, 64].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 6 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>Inst</span>
                <select
                  value={selectedInstId}
                  onChange={(e) => setSelectedInstId(e.target.value)}
                  style={{
                    background: 'var(--bg-dark)', border: '1px solid var(--bg-raised)',
                    borderRadius: 8, color: 'var(--text-secondary)', fontSize: 9,
                    padding: '2px 4px', height: 18, maxWidth: 110,
                  }}
                >
                  {(() => {
                    const selChan = CHANNELS.find((c) => c.id === selectedNodeId);
                    const grupo = selChan?.type === 'duty' ? 'DUTY'
                      : selChan?.type === 'wave' ? 'WAVE'
                      : selChan?.type === 'noise' ? 'NOISE'
                      : selChan?.type === 'pcm' ? 'PCM' : null;
                    const list = grupo
                      ? instrumentPresets.filter((p) => p.group === grupo)
                      : instrumentPresets;
                    return list.map((p) => (
                      <option key={p.id} value={p.id} style={{ color: p.color }}>{p.name}</option>
                    ));
                  })()}
                </select>
              </div>
              <div style={{ width: 1, height: 14, background: 'var(--bg-raised)', margin: '0 4px' }} />
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: CHANNEL_COLORS[activeChannelId] + '20',
                borderRadius: 8, padding: '2px 8px',
              }}>
                <span style={{ fontSize: 10 }}>{CHANNELS.find((c) => c.id === activeChannelId)?.icon}</span>
                <span style={{ color: CHANNEL_COLORS[activeChannelId], fontSize: 9, fontWeight: 700 }}>
                  {CHANNELS.find((c) => c.id === activeChannelId)?.name}
                </span>
              </div>
            </div>
            {/* View mode toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto' }}>
              <button
                onClick={() => setViewMode('tracker')}
                style={{
                  ...zoomBtnStyle,
                  background: viewMode === 'tracker' ? 'var(--accent)' : 'var(--bg-raised)',
                  color: viewMode === 'tracker' ? '#fff' : 'var(--text-secondary)',
                  fontWeight: 700, fontSize: 9, padding: '2px 6px',
                }}
              >TRK</button>
              <button
                onClick={() => setViewMode('piano')}
                style={{
                  ...zoomBtnStyle,
                  background: viewMode === 'piano' ? 'var(--accent)' : 'var(--bg-raised)',
                  color: viewMode === 'piano' ? '#fff' : 'var(--text-secondary)',
                  fontWeight: 700, fontSize: 9, padding: '2px 6px',
                }}
              >PNO</button>
              {/* Zoom controls */}
              <button onClick={() => setMusicZoom((z) => Math.max(1, z - 0.5))} style={zoomBtnStyle}><MinusIcon size={11} /></button>
              <span style={{ color: 'var(--text-secondary)', fontSize: 10, minWidth: 24, textAlign: 'center' }}>{Number(musicZoom.toFixed(1))}x</span>
              <button onClick={() => setMusicZoom((z) => Math.min(4, z + 0.5))} style={zoomBtnStyle}><PlusIcon size={11} /></button>
            </div>
          </div>

          {!selectedPattern ? (
            <EmptyState
              icon={<ClefIcon size={40} />}
              title={songs.length === 0 ? 'Sin canciones' : 'Sin patrón seleccionado'}
              hint="Elige un patrón en la lista para editar sus notas."
            />
          ) : viewMode === 'tracker' ? (
            /* ── Tracker View ── */
            <div ref={pianoRollRef} className="music-piano-roll" style={{ flex: 1, overflow: 'auto', position: 'relative', fontFamily: 'monospace', fontSize: 11 }}>
              <div style={{ position: 'relative', width: 'fit-content' }}>
                {/* Column headers */}
                <div style={{ display: 'flex', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, zIndex: 10 }}>
                  <div style={{ width: 36, flexShrink: 0, padding: '2px 4px', color: 'var(--text-muted)', fontSize: 9, fontWeight: 700, borderRight: '1px solid var(--border-color)' }}>STEP</div>
                  {visibleChannels.map((ch) => (
                    <div key={ch.id} style={{ width: 120, flexShrink: 0, padding: '2px 4px', color: CHANNEL_COLORS[ch.id], fontSize: 9, fontWeight: 700, borderRight: '1px solid var(--border-color)' }}>
                      {ch.icon} {ch.name}
                    </div>
                  ))}
                </div>
                {/* Rows */}
                {Array.from({ length: patternStepCount }, (_, step) => {
                  const stepNotes = patternRows[step] ?? {};
                  const even = step % 2 === 0;
                  const step16 = (step % 16) === 0;
                  return (
                    <div key={step} style={{ display: 'flex', background: step16 ? 'rgba(255,255,255,0.03)' : (even ? 'rgba(255,255,255,0.01)' : 'transparent') }}>
                      <div
                        onClick={() => seekPlayhead(step)}
                        style={{ width: 36, flexShrink: 0, padding: '2px 4px', color: playheadStep === step ? '#fbbf24' : 'var(--text-muted)', fontSize: 9, borderRight: '1px solid var(--border-color)', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}
                      >
                        {String(step + 1).padStart(3, '0')}
                      </div>
                      {visibleChannels.map((ch) => {
                        const nr = stepNotes[ch.id];
                        const highlight = hoverStepIdx === step;
                        return (
                          <div
                            key={ch.id}
                            onClick={() => {
                              if (!patternSong || !selectedPattern) return;
                              if (toolMode === 'select') { seekPlayhead(step); return; }
                              if (toolMode === 'eraser') { if (nr) removeNoteRow(patternSong.id, selectedPattern.id, step, ch.id); seekPlayhead(step); return; }
                              if (nr) removeNoteRow(patternSong.id, selectedPattern.id, step, ch.id);
                              else updateNoteRow(patternSong.id, selectedPattern.id, step, ch.id, { note: 'C', octave: 4, instrumentId: selectedInstId, effect: '' });
                              seekPlayhead(step);
                            }}
                            onMouseEnter={() => setHoverStepIdx(step)}
                            onMouseLeave={() => setHoverStepIdx(null)}
                            style={{
                              width: 120, flexShrink: 0, padding: '2px 4px',
                              borderRight: '1px solid var(--border-color)',
                              borderBottom: '1px solid rgba(255,255,255,0.04)',
                              cursor: 'pointer',
                              background: highlight ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent',
                              color: nr
                                ? (instrumentPresets.find((p) => p.id === nr.instrumentId)?.color ?? CHANNEL_COLORS[ch.id])
                                : 'var(--text-muted)',
                              display: 'flex', alignItems: 'center', gap: 4, userSelect: 'none',
                            }}
                          >
                            {nr ? (
                              <>
                                <span style={{ fontWeight: 700 }}>
                                  {nr.note.includes('#') ? nr.note : nr.note + '-'}{nr.octave}
                                </span>
                                <span style={{ opacity: 0.5, fontSize: 9 }}>
                                  {instrumentPresets.findIndex((p) => p.id === nr.instrumentId) >= 0
                                    ? String(instrumentPresets.findIndex((p) => p.id === nr.instrumentId) + 1).padStart(2, '0')
                                    : '--'}
                                </span>
                                {nr.effect && <span style={{ opacity: 0.4, fontSize: 9 }}>{nr.effect}</span>}
                              </>
                            ) : (
                              <span style={{ opacity: 0.3, fontSize: 9 }}>...</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                {/* Playhead overlay */}
                <div
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const container = e.currentTarget.parentElement;
                    if (!container) return;
                    dragGridRef.current = container as HTMLDivElement;
                    const rect = container.getBoundingClientRect();
                    const offsetY = e.clientY - rect.top;
                    const step = Math.floor(offsetY / TRACKER_ROW_H);
                    setPlayheadStep(Math.max(0, Math.min(step, patternStepCount - 1)));
                    playStepSounds(step, patternRows);
                    isDraggingTrackerRef.current = true;
                    setIsDraggingPlayhead(true);
                  }}
                  style={{
                    position: 'absolute', top: playheadStep * TRACKER_ROW_H + TRACKER_HEADER_H, left: 0, right: 0,
                    height: 19, zIndex: 10, cursor: 'ns-resize',
                    borderTop: `2px solid ${isPlaying || isDraggingPlayhead ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 50%, transparent)'}`,
                    boxShadow: isPlaying || isDraggingPlayhead ? '0 0 8px var(--accent), inset 0 0 12px color-mix(in srgb, var(--accent) 10%, transparent)' : 'none',
                    background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
                  }}>
                  {/* ▲ indicator at top edge */}
                  <div style={{
                    position: 'absolute', top: 0, left: 2,
                    fontSize: 8, lineHeight: 1,
                    color: isPlaying || isDraggingPlayhead ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 50%, transparent)',
                    pointerEvents: 'none', userSelect: 'none',
                  }}>▲</div>
                  {/* ▼ indicator at bottom edge */}
                  <div style={{
                    position: 'absolute', bottom: 0, left: 2,
                    fontSize: 8, lineHeight: 1,
                    color: isPlaying || isDraggingPlayhead ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 50%, transparent)',
                    pointerEvents: 'none', userSelect: 'none',
                  }}>▼</div>
                </div>
              </div>
            </div>
          ) : (
          <div ref={pianoRollRef} className="music-piano-roll" style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
            <div style={{ display: 'flex', width: 'fit-content', height: 'fit-content' }}>
              {/* Piano keyboard (sticky left) — estilo teclado real */}
              <div
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const y = e.clientY - rect.top;
                  setHoverRowIdx(Math.min(Math.max(Math.floor(y / CELL_H), 0), ALL_NOTES.length - 1));
                }}
                onMouseLeave={() => setHoverRowIdx(null)}
                style={{
                  display: 'flex', flexDirection: 'column',
                  background: '#1a1a20',
                  borderRight: '1px solid var(--bg-raised)',
                  flexShrink: 0, position: 'sticky', left: 0, zIndex: 2,
                }}>
                {ALL_NOTES.map(({ note, octave, label }, idx) => {
                    const sharp = isNoteSharp(note);
                    const isC = isCNote(note);
                    const hovered = hoverRowIdx === idx;
                    const noteInChannel = patternRows.some(
                      (row) => row[activeChannelId]?.note === note && row[activeChannelId]?.octave === octave
                    );
                    const chColor = noteInChannel ? CHANNEL_COLORS[activeChannelId] : 'transparent';
                    const isWhite = !sharp;
                    const keyBg = isWhite ? keyWhiteColor : keyBlackColor;
                    const keyLabelColor = isWhite ? (isC ? '#7c3aed' : '#555') : '#999';
                    return (
                      <div
                        key={label}
                        onClick={() => {
                          const p = instrumentPresets.find((pr) => pr.id === selectedInstId);
                          if (p) playNoteSound(p, noteToFreq(note, octave));
                        }}
                        style={{ height: CELL_H, position: 'relative', background: keyBg, borderBottom: isWhite ? '1px solid #bbb' : '1px solid #000' }}
                      >
                        {/* Hover highlight */}
                        {hovered && (
                          <div style={{
                            position: 'absolute', inset: 0,
                            background: isWhite ? 'rgba(90,63,160,0.12)' : 'rgba(180,160,255,0.15)',
                            zIndex: 2, pointerEvents: 'none',
                          }} />
                        )}
                        {/* Active channel note indicator */}
                        {noteInChannel && (
                          <div style={{
                            position: 'absolute', left: 0, top: 0, bottom: 0,
                            width: 3, background: chColor, zIndex: 3,
                            pointerEvents: 'none',
                          }} />
                        )}
                        {/* Black key (raised look) */}
                        {sharp && (
                          <div style={{
                            position: 'absolute', right: 0, top: 0, bottom: 0,
                            width: '65%', background: hovered ? '#2a2a35' : '#111',
                            borderLeft: '1px solid #333',
                            borderBottom: '1px solid #000',
                            borderRadius: '0 0 0 4px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 1,
                          }}>
                            <span style={{ color: hovered ? '#b8a0ff' : '#888', fontSize: 7, fontWeight: 600 }}>{label}</span>
                          </div>
                        )}
                        {!sharp && (
                          <span style={{
                            fontSize: 7, marginLeft: 3,
                            color: hovered ? '#5a3fa0' : keyLabelColor,
                            fontWeight: isC ? 800 : 500,
                            zIndex: 0,
                          }}>
                            {label}
                          </span>
                        )}
                        {isC && (
                          <div style={{
                            position: 'absolute', bottom: -1, left: 0, right: 0,
                            height: 2, background: '#5a3fa0',
                            opacity: 0.5,
                          }} />
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* Grid with 8×12 cell blocks */}
              <div
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const y = e.clientY - rect.top;
                  const step = Math.floor(x / CELL_W);
                  const row = Math.floor(y / CELL_H);
                  setHoverStepIdx(Math.min(Math.max(step, 0), patternStepCount - 1));
                  setHoverRowIdx(Math.min(Math.max(row, 0), ALL_NOTES.length - 1));
                }}
                onMouseLeave={() => { setHoverStepIdx(null); setHoverRowIdx(null); }}
                style={{ position: 'relative', width: patternStepCount * CELL_W, height: ALL_NOTES.length * CELL_H }}>
                {/* Block vertical dividers */}
                {Array.from({ length: Math.ceil(patternStepCount / chunkCols) + 1 }, (_, i) => (
                  <div key={`bv${i}`} style={{
                    position: 'absolute', left: i * chunkCols * CELL_W - 1, top: 0, bottom: 0,
                    width: 1, background: i % 2 === 0 ? 'var(--accent-dark)' : 'var(--border-color)',
                    pointerEvents: 'none', zIndex: 1,
                  }} />
                ))}
                {/* Block horizontal dividers */}
                {Array.from({ length: Math.ceil(ALL_NOTES.length / chunkRows) + 1 }, (_, i) => (
                  <div key={`bh${i}`} style={{
                    position: 'absolute', left: 0, right: 0,
                    top: i * chunkRows * CELL_H - 1, height: 1,
                    background: i % 2 === 0 ? 'var(--accent-dark)' : 'var(--border-light)',
                    pointerEvents: 'none', zIndex: 1,
                  }} />
                ))}
                {/* Piano roll background — según configuración */}
                {(() => {
                  const bgMode = useAppStore.getState().pianoRollBg;
                  if (!showGrid) return null;
                  if (bgMode === 'checkerboard') {
                    return (
                      <div style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none',
                        backgroundImage:
                          'linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%), ' +
                          'linear-gradient(-45deg, rgba(255,255,255,0.04) 25%, transparent 25%), ' +
                          'linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.04) 75%), ' +
                          'linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.04) 75%)',
                        backgroundSize: `${CELL_W * 2}px ${CELL_H * 2}px`,
                        backgroundPosition: `0 0, 0 ${CELL_H}px, ${CELL_W}px ${CELL_H}px, ${CELL_W}px 0`,
                        zIndex: 0,
                      }} />
                    );
                  }
                  const a = gridLineOpacity;
                  return (
                    <div style={{
                      position: 'absolute', inset: 0, pointerEvents: 'none',
                      backgroundImage:
                        `linear-gradient(rgba(255,255,255,${a}) 1px, transparent 1px), ` +
                        `linear-gradient(90deg, rgba(255,255,255,${a}) 1px, transparent 1px)`,
                      backgroundSize: `${CELL_W}px ${CELL_H}px`,
                      zIndex: 0,
                    }} />
                  );
                })()}
                {/* Note cells */}
                {ALL_NOTES.map(({ note, octave, label }) => {
                  return (
                    <div key={label} style={{ display: 'flex', height: CELL_H, position: 'relative' }}>
                      {Array.from({ length: patternStepCount }, (_, step) => {
                        const stepNotes = patternRows[step] ?? {};
                        const activeNote = stepNotes[activeChannelId];
                        const active = activeNote?.note === note && activeNote?.octave === octave;

                        const otherChId = CHANNELS
                          .filter((ch) => ch.id !== activeChannelId && (channelStates[ch.id] ?? { visible: true }).visible)
                          .find((ch) => {
                            const n = stepNotes[ch.id];
                            return n?.note === note && n?.octave === octave;
                          })?.id;
                        const otherNote = otherChId ? stepNotes[otherChId] : undefined;

                        let bg = 'transparent';
                        let border = 'none';
                        if (active) {
                          const instColor = instrumentPresets.find((p) => p.id === activeNote.instrumentId)?.color;
                          bg = instColor ?? 'var(--accent)';
                          border = 'none';
                        } else if (otherNote) {
                          const instColor = instrumentPresets.find((p) => p.id === otherNote.instrumentId)?.color;
                          bg = (instColor ?? CHANNEL_COLORS[otherChId!]) + '30';
                          border = `1px solid ${(instColor ?? CHANNEL_COLORS[otherChId!])}60`;
                        }

                        return (
                          <div
                            key={step}
                            style={{
                              width: CELL_W, height: CELL_H,
                              background: bg, border, cursor: 'pointer',
                            }}
                            onMouseDown={(e) => {
                              if (!patternSong || !selectedPattern) return;
                              if (e.button === 2) {
                                e.preventDefault();
                                if (toolMode !== 'select') removeNoteRow(patternSong.id, selectedPattern.id, step, activeChannelId);
                                return;
                              }
                              if (e.button !== 0) return;
                              if (toolMode === 'select') { seekPlayhead(step); return; }
                              if (toolMode === 'eraser') { removeNoteRow(patternSong.id, selectedPattern.id, step, activeChannelId); seekPlayhead(step); return; }
                              updateNoteRow(patternSong.id, selectedPattern.id, step, activeChannelId, { note, octave, instrumentId: selectedInstId, effect: '' });
                              const p = instrumentPresets.find((pr) => pr.id === selectedInstId);
                              if (p) playNoteSound(p, noteToFreq(note, octave));
                              seekPlayhead(step);
                            }}
                            onContextMenu={(e) => e.preventDefault()}
                          />
                        );
                      })}
                    </div>
                  );
                })}
                {/* Guideline overlay */}
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
                  {hoverRowIdx !== null && (
                    <div style={{
                      position: 'absolute', left: 0, right: 0,
                      top: hoverRowIdx * CELL_H, height: CELL_H,
                      background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                      borderTop: '1px solid color-mix(in srgb, var(--accent) 50%, transparent)',
                      borderBottom: '1px solid color-mix(in srgb, var(--accent) 50%, transparent)',
                    }} />
                  )}
                  {hoverStepIdx !== null && (
                    <div style={{
                      position: 'absolute', top: 0, bottom: 0,
                      left: hoverStepIdx * CELL_W, width: CELL_W,
                      background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
                      borderLeft: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)',
                      borderRight: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)',
                    }} />
                  )}
                  {/* Playhead marker */}
                  <div
                    onMouseDown={(e) => onPlayheadMouseDown(e, false)}
                    style={{
                      position: 'absolute', top: 0, bottom: 0,
                      left: playheadStep * CELL_W, width: isDraggingPlayhead ? 4 : 2,
                      background: 'var(--accent)',
                      boxShadow: isPlaying || isDraggingPlayhead
                        ? `0 0 8px var(--accent), 0 0 16px color-mix(in srgb, var(--accent) 40%, transparent)`
                        : `0 0 4px color-mix(in srgb, var(--accent) 50%, transparent)`,
                      zIndex: 10, cursor: 'ew-resize',
                    }}
                  >
                    {/* ▲ indicator at top edge */}
                    <div style={{
                      position: 'absolute', top: 0, left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: 8, lineHeight: 1,
                      color: isPlaying || isDraggingPlayhead ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 50%, transparent)',
                      pointerEvents: 'none', userSelect: 'none',
                    }}>▲</div>
                    {/* ▼ indicator at bottom edge */}
                    <div style={{
                      position: 'absolute', bottom: 0, left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: 8, lineHeight: 1,
                      color: isPlaying || isDraggingPlayhead ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 50%, transparent)',
                      pointerEvents: 'none', userSelect: 'none',
                    }}>▼</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Patterns bottom bar */}
          {currentSong && (
            <div style={{
              height: 36,
              background: 'var(--bg-panel)',
              borderTop: '1px solid var(--border-color)',
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '0 10px', flexShrink: 0, overflowX: 'auto',
            }}>
              <span style={{ color: 'var(--accent)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', marginRight: 6 }}>
                PATTERNS
              </span>
              {currentSong.patterns.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setActivePattern(p.id)}
                  style={{
                    background: activePattern === p.id ? 'var(--accent)' : 'var(--bg-raised)',
                    border: 'none', borderRadius: 4,
                    color: '#fff', fontSize: 10,
                    padding: '4px 10px', cursor: 'pointer',
                    fontFamily: 'monospace',
                  }}
                >
                  {i + 1}: {p.id.slice(0, 4).toUpperCase()} {activePattern === p.id ? '▸' : 'V'}
                </button>
              ))}
              <button
                onClick={() => currentSong && addPattern(currentSong.id)}
                style={{
                  background: 'var(--accent)', border: 'none', borderRadius: 4,
                  color: '#fff', width: 22, height: 22,
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                +
              </button>
            </div>
          )}

          {/* Channel mute/solo bar */}
          {currentSong && (
            <div style={{
              height: 28,
              background: 'var(--bg-canvas)',
              borderTop: '1px solid var(--border-color)',
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '0 10px', flexShrink: 0, overflowX: 'auto',
            }}>
              <span style={{ color: 'var(--accent)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', marginRight: 6 }}>
                CH
              </span>
              {CHANNELS.map((ch) => {
                const cs = channelStates[ch.id] ?? { visible: true, solo: false, muted: false };
                return (
                <div
                  key={ch.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 2,
                    padding: '2px 6px',
                    background: 'var(--bg-dark)',
                    borderRadius: 3, fontSize: 10,
                    color: '#aaa',
                    flexShrink: 0,
                    opacity: cs.visible ? 1 : 0.5,
                  }}
                >
                  <span style={{ fontSize: 10, marginRight: 2 }}>{ch.icon}</span>
                  <span>{ch.name}</span>
                  <button
                    onClick={() => toggleChannel(ch.id, 'muted')}
                    title={cs.muted ? 'Quitar mute' : 'Silenciar canal'}
                    style={{
                      background: cs.muted ? 'var(--red, #b02020)' : 'var(--bg-raised)',
                      border: 'none', borderRadius: 2,
                      color: '#fff', fontSize: 8,
                      padding: '1px 4px', cursor: 'pointer', fontWeight: 700,
                    }}
                  >
                    M
                  </button>
                  <button
                    onClick={() => toggleChannel(ch.id, 'solo')}
                    title={cs.solo ? 'Quitar solo' : 'Solo este canal'}
                    style={{
                      background: cs.solo ? 'var(--accent)' : 'var(--bg-raised)',
                      border: 'none', borderRadius: 2,
                      color: '#fff', fontSize: 8,
                      padding: '1px 4px', cursor: 'pointer', fontWeight: 700,
                    }}
                  >
                    S
                  </button>
                </div>
                );
              })}
            </div>
          )}
        </div>
      }
      right={
        <InspectorPanel
          title="Inspector"
          sections={inspectorSections}
          emptyMessage="Selecciona un instrumento"
        />
      }
    />
    </>
  );
}

// ── helpers for SVG arc ───────────────────────────────────────────────────
function polarToCartesian(cx: number, cy: number, r: number, a: number) {
  const rad = (a - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function describeArc(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polarToCartesian(cx, cy, r, start);
  const e = polarToCartesian(cx, cy, r, end);
  let sweep = end - start;
  if (sweep < 0) sweep += 360;
  if (sweep < 0.5) return '';
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${e.x} ${e.y}`;
}

// ── Knob component (rotary dial with drag + accent arc) ───────────────────
function Knob({ label, value, min, max, onChange, enabled, onToggle }: {
  label: string; value: number; min: number; max: number;
  onChange: (v: number) => void;
  enabled?: boolean; onToggle?: (v: boolean) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null);
  const knobRef = useRef<HTMLDivElement>(null);

  const isBipolar = min < 0 && max > 0;
  const range = max - min || 1;
  const frac = Math.max(0, Math.min(1, (value - min) / range));
  const cx = 30, cy = 30, rDot = 20, arcR = 26;

  let angle: number;
  if (isBipolar) {
    const maxAbs = Math.max(Math.abs(min), Math.abs(max));
    angle = (value / maxAbs) * 135;
  } else {
    angle = -135 + frac * 270;
  }
  const rad = (angle - 90) * (Math.PI / 180);
  const dotX = cx + rDot * Math.cos(rad);
  const dotY = cy + rDot * Math.sin(rad);

  let arcD = '';
  if (isBipolar) {
    if (value > 0.001) arcD = describeArc(cx, cy, arcR, 0, angle);
    else if (value < -0.001) arcD = describeArc(cx, cy, arcR, angle, 0);
  } else if (frac > 0.001) {
    arcD = describeArc(cx, cy, arcR, -135, angle);
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (onToggle && !enabled) return;
    setDragging(true);
    dragRef.current = { startY: e.clientY, startValue: value };
  };

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dy = dragRef.current.startY - e.clientY;
      const steps = Math.round(dy / 4);
      const newVal = Math.min(max, Math.max(min, dragRef.current.startValue + steps));
      onChange(Math.round(newVal));
    };
    const handleUp = () => {
      setDragging(false);
      dragRef.current = null;
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        {onToggle && (
          <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)}
            style={{ accentColor: 'var(--accent-light)', cursor: 'pointer', margin: 0, width: 12, height: 12 }} />
        )}
        <span style={{ color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase' }}>{label}</span>
      </div>

      <div
        ref={knobRef}
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: 60, height: 60, borderRadius: '50%',
          border: '3px solid var(--border-light)',
          background: dragging
            ? 'radial-gradient(circle at 35% 35%, #666, #333)'
            : 'radial-gradient(circle at 35% 35%, #555, #222)',
          boxShadow: 'inset 0 3px 3px rgba(255,255,255,0.15), 0 3px 6px rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
          cursor: onToggle && !enabled ? 'default' : 'ns-resize',
        }}
      >
        <svg width={60} height={60} viewBox="0 0 60 60" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {arcD && <path d={arcD} stroke="var(--accent-light)" strokeWidth={3} fill="none" strokeLinecap="round" />}
          <line x1={cx} y1={cy} x2={dotX} y2={dotY} stroke="var(--accent-light)" strokeWidth={2} strokeLinecap="round" />
          <circle cx={dotX} cy={dotY} r={3} fill="var(--accent-light)" />
        </svg>
        <input
          type="number"
          value={value}
          min={min} max={max}
          onChange={(e) => onChange(Math.min(max, Math.max(min, Math.round(Number(e.target.value)))))}
          style={{
            width: 38, background: 'transparent', border: 'none',
            color: 'var(--text)', fontSize: 12, fontWeight: 700,
            textAlign: 'center', outline: 'none', padding: 0,
            MozAppearance: 'textfield',
            position: 'relative', zIndex: 1,
            cursor: onToggle && !enabled ? 'default' : 'ns-resize',
          }}
        />

        {/* Hover tooltip */}
        {hovered && !dragging && (
          <div style={{
            position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
            background: 'var(--bg-panel)', border: '1px solid var(--border-light)', borderRadius: 4,
            padding: '3px 8px', fontSize: 12, fontWeight: 700, color: 'var(--accent-light)',
            whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 10,
          }}>
            {value}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Wave graph ────────────────────────────────────────────────────────────
function renderWaveGraph(preset: InstrumentPreset): React.ReactNode {
  const { dutyCycleValue, initialVolume, lengthEnabled, length } = preset;
  const w = 200, h = 48;
  const half = h / 2;
  const cycleW = 40;
  const duty = dutyCycleValue / 100;
  const vol = initialVolume / 15;
  const amp = half * 0.7 * Math.max(0.1, vol);
  const totalLen = lengthEnabled ? Math.max(1, length) : 64;

  const points: { x: number; y: number }[] = [];
  const stepX = w / totalLen;

  for (let i = 0; i < totalLen; i++) {
    const t = (i % cycleW) / cycleW;
    let y: number;
    if (t < duty) {
      y = half - amp;
    } else {
      y = half + amp;
    }
    points.push({ x: i * stepX, y });
    points.push({ x: (i + 0.5) * stepX, y });
  }

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
      <line x1={0} y1={half} x2={w} y2={half} stroke="#333" strokeWidth={0.5} />
      {points.map((p, i) => {
        if (i === 0) return null;
        return (
          <line key={i} x1={points[i - 1].x} y1={points[i - 1].y} x2={p.x} y2={p.y}
            stroke={preset.color} strokeWidth={1.5} strokeLinecap="round" />
        );
      })}
    </svg>
  );
}

function ToolBtn({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? 'var(--accent)' : 'transparent',
        border: 'none', borderRadius: 16,
        color: active ? '#fff' : 'var(--text-secondary)',
        width: 26, height: 24, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s',
      }}
    >
      {children}
    </button>
  );
}

const zoomBtnStyle: React.CSSProperties = {
  background: 'var(--bg-raised)',
  border: 'none', borderRadius: 3,
  color: 'var(--text-secondary)', fontSize: 13,
  width: 22, height: 20, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};


