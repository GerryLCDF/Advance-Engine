import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { HierarchyPanel, type HierarchySection } from '../HierarchyPanel';
import { InspectorPanel, type InspectorSection } from '../InspectorPanel';
import { ResizableEditorLayout } from '../ResizableEditorLayout';
import type { InstrumentType, NoteRow } from '../../../types/editor';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

interface InstrumentPreset {
  id: string;
  name: string;
  type: InstrumentType;
  color: string;
}

const DUTY_PRESETS: InstrumentPreset[] = [
  { id: 'preset-duty-1', name: 'Duty 12.5%', type: 'duty', color: '#57E4B3' },
  { id: 'preset-duty-2', name: 'Duty 25%', type: 'duty', color: '#00A9CC' },
  { id: 'preset-duty-3', name: 'Duty 50%', type: 'duty', color: '#6C7A8E' },
  { id: 'preset-duty-4', name: 'Duty 75%', type: 'duty', color: '#4A4579' },
  { id: 'preset-duty-5', name: 'Duty 12.5%', type: 'duty', color: '#1B8C7A' },
  { id: 'preset-duty-6', name: 'Duty 25%', type: 'duty', color: '#6CC459' },
  { id: 'preset-duty-7', name: 'Duty 50%', type: 'duty', color: '#A9E464' },
  { id: 'preset-duty-8', name: 'Duty 75%', type: 'duty', color: '#F5E873' },
  { id: 'preset-duty-9', name: 'Duty 9', type: 'duty', color: '#F38D56' },
  { id: 'preset-duty-10', name: 'Duty 10', type: 'duty', color: '#D65576' },
  { id: 'preset-duty-11', name: 'Duty 11', type: 'duty', color: '#793D85' },
  { id: 'preset-duty-12', name: 'Duty 12', type: 'duty', color: '#D63475' },
  { id: 'preset-duty-13', name: 'Duty 13', type: 'duty', color: '#F3B0C3' },
  { id: 'preset-duty-14', name: 'Duty 14', type: 'duty', color: '#F3BD9D' },
  { id: 'preset-duty-15', name: 'Duty 15', type: 'duty', color: '#A9A57E' },
];

const WAVE_PRESETS: InstrumentPreset[] = [
  { id: 'preset-wave-1', name: '12,5% Pulse', type: 'wave', color: '#57E4B3' },
  { id: 'preset-wave-2', name: '25% Pulse', type: 'wave', color: '#00A9CC' },
  { id: 'preset-wave-3', name: '31.25% Pulse', type: 'wave', color: '#6C7A8E' },
  { id: 'preset-wave-4', name: '37,50% Pulse', type: 'wave', color: '#4A4579' },
  { id: 'preset-wave-5', name: '43,75% Pulse', type: 'wave', color: '#1B8C7A' },
  { id: 'preset-wave-6', name: '50% Pulse', type: 'wave', color: '#6CC459' },
  { id: 'preset-wave-7', name: '50% Pulse (Volume 5)', type: 'wave', color: '#A9E464' },
  { id: 'preset-wave-8', name: '50% Pulse (Volume 3)', type: 'wave', color: '#F5E873' },
  { id: 'preset-wave-9', name: '50% Pulse (Volume 1)', type: 'wave', color: '#F38D56' },
  { id: 'preset-wave-10', name: 'Square Wave with added Square Wave (2 Oktaves high...)', type: 'wave', color: '#D65576' },
  { id: 'preset-wave-11', name: 'Triangular Wave', type: 'wave', color: '#793D85' },
  { id: 'preset-wave-12', name: 'Triangular with added Square Wave (2 Oktaves higher)', type: 'wave', color: '#D63475' },
  { id: 'preset-wave-13', name: 'Saw Wave', type: 'wave', color: '#F3B0C3' },
  { id: 'preset-wave-14', name: 'Distorted Saw Wave', type: 'wave', color: '#F3BD9D' },
  { id: 'preset-wave-15', name: '(empty)', type: 'wave', color: '#A9A57E' },
];

const NOISE_PRESETS: InstrumentPreset[] = [
  { id: 'preset-noise-1', name: 'Noise 1', type: 'noise', color: '#57E4B3' },
  { id: 'preset-noise-2', name: 'Noise 2', type: 'noise', color: '#00A9CC' },
  { id: 'preset-noise-3', name: 'Noise 3', type: 'noise', color: '#6C7A8E' },
  { id: 'preset-noise-4', name: 'Noise 4', type: 'noise', color: '#4A4579' },
  { id: 'preset-noise-5', name: 'Noise 5', type: 'noise', color: '#1B8C7A' },
  { id: 'preset-noise-6', name: 'Noise 6', type: 'noise', color: '#6CC459' },
  { id: 'preset-noise-7', name: 'Noise 7', type: 'noise', color: '#A9E464' },
  { id: 'preset-noise-8', name: 'Noise 8', type: 'noise', color: '#F5E873' },
  { id: 'preset-noise-9', name: 'Noise 9', type: 'noise', color: '#F38D56' },
  { id: 'preset-noise-10', name: 'Noise 10', type: 'noise', color: '#D65576' },
  { id: 'preset-noise-11', name: 'Noise 11', type: 'noise', color: '#793D85' },
  { id: 'preset-noise-12', name: 'Noise 12', type: 'noise', color: '#D63475' },
  { id: 'preset-noise-13', name: 'Noise 13', type: 'noise', color: '#F3B0C3' },
  { id: 'preset-noise-14', name: 'Noise 14', type: 'noise', color: '#F3BD9D' },
  { id: 'preset-noise-15', name: 'Noise 15', type: 'noise', color: '#A9A57E' },
];

const ALL_PRESETS = [...DUTY_PRESETS, ...WAVE_PRESETS, ...NOISE_PRESETS];

const CHANNELS = [
  { id: 'ch-pulse1', name: 'Pulse 1', type: 'duty', icon: '◻' },
  { id: 'ch-pulse2', name: 'Pulse 2', type: 'duty', icon: '◻' },
  { id: 'ch-wave', name: 'Wave', type: 'wave', icon: '〰' },
  { id: 'ch-noise', name: 'Noise', type: 'noise', icon: '📢' },
];

export function MusicTab() {
  const songs = useAppStore((s) => s.songs);
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useAppStore((s) => s.setSelectedNodeId);
  const addSong = useAppStore((s) => s.addSong);
  const removeSong = useAppStore((s) => s.removeSong);
  const updateSong = useAppStore((s) => s.updateSong);
  const addPattern = useAppStore((s) => s.addPattern);
  const removePattern = useAppStore((s) => s.removePattern);
  const updatePattern = useAppStore((s) => s.updatePattern);
  const updateNoteRow = useAppStore((s) => s.updateNoteRow);
  const hierarchyWidth = useAppStore((s) => s.hierarchyWidth);
  const inspectorWidth = useAppStore((s) => s.inspectorWidth);
  const setHierarchyWidth = useAppStore((s) => s.setHierarchyWidth);
  const setInspectorWidth = useAppStore((s) => s.setInspectorWidth);

  const [toolMode, setToolMode] = useState<'pencil' | 'eraser' | 'select'>('pencil');
  const [activePattern, setActivePattern] = useState<string | null>(null);
  const [musicZoom, setMusicZoom] = useState(2);

  const BASE = 12;
  const CELL_W = BASE * musicZoom;
  const CELL_H = BASE * musicZoom;

  // Zoom con Ctrl+Wheel, scroll horizontal con Shift+Wheel (como las otras pestañas)
  const pianoRollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = pianoRollRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setMusicZoom((z) => Math.max(1, Math.min(4, z + (e.deltaY > 0 ? -1 : 1))));
      } else if (e.shiftKey) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);
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
        id: so.id, label: so.name, icon: '🎵',
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
        return {
          id: ch.id, label: ch.name, icon: ch.icon, removable: false,
          subtitle: '',
          actions: (
            <>
              <span
                onClick={() => toggleChannel(ch.id, 'visible')}
                style={{
                  cursor: 'pointer', fontSize: 10, opacity: cs.visible ? 1 : 0.3,
                  filter: cs.visible ? 'none' : 'grayscale(1)',
                }}
                title={cs.visible ? 'Ocultar' : 'Mostrar'}
              >
                👁
              </span>
              <span
                onClick={() => toggleChannel(ch.id, 'solo')}
                style={{
                  cursor: 'pointer', fontSize: 9, fontWeight: 700, padding: '0 2px',
                  color: cs.solo ? '#fbbf24' : '#666',
                  background: cs.solo ? 'rgba(251,191,36,0.15)' : 'transparent',
                  borderRadius: 2,
                }}
                title={cs.solo ? 'Quitar Solo' : 'Solo'}
              >
                S
              </span>
              <span
                onClick={() => toggleChannel(ch.id, 'muted')}
                style={{
                  cursor: 'pointer', fontSize: 9, fontWeight: 700, padding: '0 2px',
                  color: cs.muted ? '#f87171' : '#666',
                  background: cs.muted ? 'rgba(248,113,113,0.15)' : 'transparent',
                  borderRadius: 2,
                }}
                title={cs.muted ? 'Quitar Mute' : 'Mute'}
              >
                M
              </span>
            </>
          ),
        };
      }),
    },
    {
      id: 'instruments',
      title: 'INSTRUMENTS',
      collapsed: false,
      items: [
        {
          id: '__header-duty', label: 'DUTY', isHeader: true,
            children: DUTY_PRESETS.map((p) => ({
            id: p.id, label: p.name, icon: '', subtitle: '', color: p.color, removable: false,
          })),
        },
        {
          id: '__header-wave', label: 'WAVE', isHeader: true,
          children: WAVE_PRESETS.map((p) => ({
            id: p.id, label: p.name, icon: '', subtitle: '', color: p.color, removable: false,
          })),
        },
        {
          id: '__header-noise', label: 'NOISE', isHeader: true,
          children: NOISE_PRESETS.map((p) => ({
            id: p.id, label: p.name, icon: '', subtitle: '', color: p.color, removable: false,
          })),
        },
      ],
    },
  ];

  const selectedPreset = ALL_PRESETS.find((p) => p.id === selectedNodeId);
  const selectedChannel = CHANNELS.find((c) => c.id === selectedNodeId);

  const inspectorSections: InspectorSection[] = [];

  if (selectedSong) {
    inspectorSections.push({
      title: 'Canción',
      fields: [
        { label: 'Nombre', type: 'text', value: selectedSong.name, onChange: (v) => updateSong(selectedSong.id, { name: v as string }) },
        { label: 'BPM', type: 'number', value: selectedSong.bpm, onChange: (v) => updateSong(selectedSong.id, { bpm: v as number }) },
        { label: 'Patrones', type: 'text', value: String(selectedSong.patterns.length), onChange: () => {} },
      ],
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
    inspectorSections.push({
      title: 'Preset',
      fields: [
        { label: 'Nombre', type: 'text', value: selectedPreset.name, onChange: () => {} },
        { label: 'Tipo', type: 'text', value: selectedPreset.type.toUpperCase(), onChange: () => {} },
        { label: 'Color', type: 'text', value: selectedPreset.color, onChange: () => {} },
      ],
    });
    if (selectedPreset.type === 'duty') {
      inspectorSections.push({
        title: 'Duty Cycle',
        fields: [
          { label: 'Onda', type: 'select', value: '0.5', options: [
            { value: '0.125', label: '12.5% ▏' },
            { value: '0.25', label: '25% ▎' },
            { value: '0.5', label: '50% ▊' },
            { value: '0.75', label: '75% ▊' },
          ], onChange: () => {} },
        ],
      });
    }
  }

  const handleRemove = (id: string) => {
    if (songs.some((so) => so.id === id)) removeSong(id);
    else if (CHANNELS.some((c) => c.id === id) || ALL_PRESETS.some((p) => p.id === id)) {
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

  // Build all notes: C8 → C3 (72 notes, octaves 8-3)
  const ALL_NOTES: { note: string; octave: number; label: string }[] = [];
  for (let o = 8; o >= 3; o--) {
    for (let i = NOTES.length - 1; i >= 0; i--) {
      ALL_NOTES.push({ note: NOTES[i], octave: o, label: `${NOTES[i]}${o}` });
    }
  }
  const isNoteSharp = (n: string) => n.includes('#');
  const isCNote = (n: string) => n === 'C';

  const [editStepCount, setEditStepCount] = useState(patternStepCount);
  const [selectedInstId, setSelectedInstId] = useState<string>(
    () => ALL_PRESETS[0]?.id ?? ''
  );

  // Sync editStepCount when pattern changes
  React.useEffect(() => {
    setEditStepCount(patternStepCount);
  }, [patternStepCount]);

  const handleResizePattern = (newCount: number) => {
    if (!patternSong || !selectedPattern) return;
    const cur = patternRows;
    const emptyRow = (): NoteRow => ({ note: '', octave: 4, instrumentId: '', effect: '' });
    const rows = Array.from({ length: newCount }, (_, i) =>
      i < cur.length ? { ...cur[i] } : emptyRow()
    );
    updatePattern(patternSong.id, selectedPattern.id, { rows });
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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-canvas)' }}>
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
              <ToolBtn onClick={() => {}}><SaveIcon size={14} /></ToolBtn>
              <div style={{ width: 1, height: 14, background: 'var(--bg-raised)', margin: '0 2px' }} />
              <ToolBtn onClick={() => {}}><PlayIcon size={14} /></ToolBtn>
              <ToolBtn onClick={() => {}}><StopIcon size={14} /></ToolBtn>
              <div style={{ width: 1, height: 14, background: 'var(--bg-raised)', margin: '0 2px' }} />
              <ToolBtn active={toolMode === 'pencil'} onClick={() => setToolMode('pencil')}><PencilIcon size={14} /></ToolBtn>
              <ToolBtn active={toolMode === 'select'} onClick={() => setToolMode('select')}><SelectIcon size={14} /></ToolBtn>
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
                    let list = selChan?.type === 'duty' ? DUTY_PRESETS
                      : selChan?.type === 'wave' ? WAVE_PRESETS
                      : selChan?.type === 'noise' ? NOISE_PRESETS
                      : ALL_PRESETS;
                    return list.map((p) => (
                      <option key={p.id} value={p.id} style={{ color: p.color }}>{p.name}</option>
                    ));
                  })()}
                </select>
              </div>
            </div>
            {/* Zoom controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 'auto' }}>
              <button onClick={() => setMusicZoom((z) => Math.max(1, z - 1))} style={zoomBtnStyle}>−</button>
              <span style={{ color: 'var(--text-secondary)', fontSize: 10, minWidth: 24, textAlign: 'center' }}>{musicZoom}x</span>
              <button onClick={() => setMusicZoom((z) => Math.min(4, z + 1))} style={zoomBtnStyle}>+</button>
            </div>
          </div>

          {/* Piano Roll */}
          <div ref={pianoRollRef} style={{ flex: 1, overflow: 'auto', display: 'flex', position: 'relative' }}>
            {/* Piano keyboard (sticky left) */}
            <div style={{
              display: 'flex', flexDirection: 'column',
              background: 'var(--bg-dark)',
              borderRight: '1px solid var(--bg-raised)',
              flexShrink: 0, position: 'sticky', left: 0, zIndex: 2,
            }}>
              {ALL_NOTES.map(({ note, octave, label }) => {
                const sharp = isNoteSharp(note);
                const isC = isCNote(note);
                return (
                  <div
                    key={label}
                    style={{
                      width: 44, height: CELL_H,
                      borderBottom: '1px solid var(--border-color)',
                      display: 'flex', alignItems: 'center',
                      position: 'relative',
                      background: sharp ? 'var(--bg-canvas)' : isC ? 'var(--bg-inspector)' : '#2d2d33',
                    }}
                  >
                    {sharp && (
                      <div style={{
                        position: 'absolute', right: 0, top: 0, bottom: 0,
                        width: 20, background: '#1a1a20',
                        borderLeft: '1px solid var(--border-color)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ color: 'var(--text-dim)', fontSize: 6 }}>{label}</span>
                      </div>
                    )}
                    {!sharp && (
                      <span style={{
                        fontSize: 7, marginLeft: 2,
                        color: isC ? 'var(--accent-light)' : 'var(--text-muted)',
                        fontWeight: isC ? 600 : 400,
                      }}>
                        {label}
                      </span>
                    )}
                    {isC && (
                      <div style={{
                        position: 'absolute', bottom: -1, left: 0, right: 0,
                        height: 1, background: 'var(--accent-dark)',
                      }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Grid with 8×12 cell blocks */}
            <div style={{ position: 'relative', minWidth: patternStepCount * CELL_W }}>
              {/* Block vertical dividers (every 8 steps) */}
              {Array.from({ length: Math.ceil(patternStepCount / 8) + 1 }, (_, i) => (
                <div key={`bv${i}`} style={{
                  position: 'absolute', left: i * 8 * CELL_W - 1, top: 0, bottom: 0,
                  width: 1, background: i % 2 === 0 ? 'var(--accent-dark)' : 'var(--border-color)',
                  pointerEvents: 'none', zIndex: 1,
                }} />
              ))}
              {/* Block horizontal dividers (every 12 notes) */}
              {Array.from({ length: Math.ceil(ALL_NOTES.length / 12) + 1 }, (_, i) => (
                <div key={`bh${i}`} style={{
                  position: 'absolute', left: 0, right: 0,
                  top: i * 12 * CELL_H - 1, height: 1,
                  background: i % 2 === 0 ? 'var(--accent-dark)' : 'var(--border-light)',
                  pointerEvents: 'none', zIndex: 1,
                }} />
              ))}
              {/* Beat lines (every 4 steps) */}
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                backgroundImage: 'linear-gradient(90deg, var(--border-light) 1px, transparent 1px)',
                backgroundSize: `${4 * CELL_W}px 1px`, zIndex: 0,
              }} />
              {/* Note cells */}
              {ALL_NOTES.map(({ note, octave, label }) => {
                const sharp = isNoteSharp(note);
                return (
                  <div key={label} style={{ display: 'flex', height: CELL_H, position: 'relative' }}>
                    {Array.from({ length: patternStepCount }, (_, step) => {
                      const active = patternRows[step]?.note === note && patternRows[step]?.octave === octave;
                      return (
                        <div
                          key={step}
                          style={{
                            width: CELL_W, height: CELL_H,
                            background: active
                              ? 'var(--accent)'
                              : sharp
                              ? 'transparent'
                              : step % 2 === 0
                              ? 'rgba(255,255,255,0.015)'
                              : 'transparent',
                            borderBottom: '1px solid var(--border-color)',
                            borderRight: '1px solid var(--border-color)',
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            if (patternSong && selectedPattern) {
                              if (toolMode === 'eraser' || (toolMode === 'pencil' && active)) {
                                updateNoteRow(patternSong.id, selectedPattern.id, step, { note: '', octave: 4, instrumentId: '', effect: '' });
                              } else if (toolMode === 'pencil' && !active) {
                                updateNoteRow(patternSong.id, selectedPattern.id, step, { note, octave, instrumentId: selectedInstId, effect: '' });
                              } else if (toolMode === 'select') {
                                setSelectedNodeId(step.toString());
                              }
                            }
                          }}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

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
              {CHANNELS.map((ch) => (
                <div
                  key={ch.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 2,
                    padding: '2px 6px',
                    background: 'var(--bg-dark)',
                    borderRadius: 3, fontSize: 10,
                    color: '#aaa',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: 10, marginRight: 2 }}>{ch.icon}</span>
                  <span>{ch.name}</span>
                  <button
                    style={{
                      background: 'var(--bg-raised)',
                      border: 'none', borderRadius: 2,
                      color: '#fff', fontSize: 8,
                      padding: '1px 4px', cursor: 'pointer', fontWeight: 700,
                    }}
                  >
                    M
                  </button>
                  <button
                    style={{
                      background: 'var(--bg-raised)',
                      border: 'none', borderRadius: 2,
                      color: '#fff', fontSize: 8,
                      padding: '1px 4px', cursor: 'pointer', fontWeight: 700,
                    }}
                  >
                    S
                  </button>
                </div>
              ))}
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

// ── Iconos SVG ─────────────────────────────────────────────────────────
function SaveIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}
function PlayIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}
function StopIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <rect x="4" y="4" width="16" height="16" rx="2" />
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
function SelectIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
      <path d="M13 13l6 6" />
    </svg>
  );
}
function EraserIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8L14.6 1.6c.8-.8 2-.8 2.8 0L21 5.4c.8.8.8 2 0 2.8L12 17" />
      <path d="M6 11l7 7" />
    </svg>
  );
}
