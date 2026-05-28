import React, { useState } from 'react';
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

  const [dutyCycle, setDutyCycle] = useState('12.5');
  const [activePattern, setActivePattern] = useState<string | null>(null);
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
          id: ch.id, label: ch.name, icon: ch.icon,
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
            id: p.id, label: p.name, icon: '', subtitle: '', color: p.color,
          })),
        },
        {
          id: '__header-wave', label: 'WAVE', isHeader: true,
          children: WAVE_PRESETS.map((p) => ({
            id: p.id, label: p.name, icon: '', subtitle: '', color: p.color,
          })),
        },
        {
          id: '__header-noise', label: 'NOISE', isHeader: true,
          children: NOISE_PRESETS.map((p) => ({
            id: p.id, label: p.name, icon: '', subtitle: '', color: p.color,
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

  // Build all notes across octaves (B8 → C2)
  const ALL_NOTES: { note: string; octave: number; label: string }[] = [];
  for (let o = 8; o >= 2; o--) {
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
          {/* Toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', background: 'var(--bg-panel)',
            borderBottom: '1px solid var(--border-color)',
            height: 32, flexShrink: 0,
          }}>
            <ToolBtn label="💾" title="Guardar" />
            <ToolBtn label="▶" title="Play" />
            <ToolBtn label="⏹" title="Stop" />
            <div style={{ width: 1, height: 18, background: 'var(--bg-raised)', margin: '0 6px' }} />
            <ToolBtn label="✏" title="Dibujar" active />
            <ToolBtn label="◇" title="Seleccionar" />
            <ToolBtn label="🗑" title="Borrar" />
            <div style={{ width: 1, height: 18, background: 'var(--bg-raised)', margin: '0 6px' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Duty:</span>
            <select
              value={dutyCycle}
              onChange={(e) => setDutyCycle(e.target.value)}
              style={{
                background: 'var(--bg-canvas)', border: '1px solid var(--bg-raised)',
                borderRadius: 3, color: 'var(--text-secondary)', fontSize: 10,
                padding: '2px 4px',
              }}
            >
              <option value="12.5">12.5%</option>
              <option value="25">25%</option>
              <option value="50">50%</option>
              <option value="75">75%</option>
            </select>

            <div style={{ width: 1, height: 18, background: 'var(--bg-raised)', margin: '0 6px' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Steps:</span>
            <select
              value={editStepCount}
              onChange={(e) => handleResizePattern(Number(e.target.value))}
              style={{
                background: 'var(--bg-canvas)', border: '1px solid var(--bg-raised)',
                borderRadius: 3, color: 'var(--text-secondary)', fontSize: 10,
                padding: '2px 4px',
              }}
            >
              <option value={16}>16</option>
              <option value={32}>32</option>
              <option value={48}>48</option>
              <option value={64}>64</option>
            </select>

            <span style={{ color: 'var(--text-muted)', fontSize: 10, marginLeft: 8 }}>Inst:</span>
            <select
              value={selectedInstId}
              onChange={(e) => setSelectedInstId(e.target.value)}
              style={{
                background: 'var(--bg-canvas)', border: '1px solid var(--bg-raised)',
                borderRadius: 3, color: 'var(--text-secondary)', fontSize: 10,
                padding: '2px 4px', maxWidth: 140,
              }}
            >
              <optgroup label="DUTY">
                {DUTY_PRESETS.map((p) => (
                  <option key={p.id} value={p.id} style={{ color: p.color }}>{p.name}</option>
                ))}
              </optgroup>
              <optgroup label="WAVE">
                {WAVE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id} style={{ color: p.color }}>{p.name}</option>
                ))}
              </optgroup>
              <optgroup label="NOISE">
                {NOISE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id} style={{ color: p.color }}>{p.name}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Piano Roll */}
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', position: 'relative' }}>
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
                      width: 52, height: 20,
                      borderBottom: '1px solid var(--border-color)',
                      display: 'flex', alignItems: 'center',
                      position: 'relative',
                      background: sharp
                        ? 'var(--bg-canvas)'
                        : isC
                        ? 'var(--bg-inspector)'
                        : '#2d2d33',
                    }}
                  >
                    {/* Black key overlay */}
                    {sharp && (
                      <div style={{
                        position: 'absolute', right: 0, top: 0, bottom: 0,
                        width: 28,
                        background: '#1a1a20',
                        borderLeft: '1px solid var(--border-color)',
                        borderRadius: '0 0 3px 3px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ color: 'var(--text-dim)', fontSize: 7 }}>{label}</span>
                      </div>
                    )}
                    {/* White key label */}
                    {!sharp && (
                      <span style={{
                        fontSize: 9, marginLeft: 4,
                        color: isC ? 'var(--accent-light)' : 'var(--text-muted)',
                        fontWeight: isC ? 600 : 400,
                      }}>
                        {label}
                      </span>
                    )}
                    {/* Octave divider line */}
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

            {/* Grid */}
            <div style={{ position: 'relative', minWidth: patternStepCount * 28 }}>
              {/* Beat lines */}
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                backgroundImage: 'linear-gradient(90deg, var(--border-light) 1px, transparent 1px)',
                backgroundSize: `${4 * 28}px 1px`, zIndex: 0,
              }} />
              {/* Bar lines */}
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                backgroundImage: 'linear-gradient(90deg, var(--accent-dark) 1px, transparent 1px)',
                backgroundSize: `${16 * 28}px 1px`, zIndex: 0,
              }} />
              {ALL_NOTES.map(({ note, octave, label }) => {
                const sharp = isNoteSharp(note);
                return (
                  <div key={label} style={{ display: 'flex', height: 20, position: 'relative' }}>
                    {Array.from({ length: patternStepCount }, (_, step) => {
                      const active = patternRows[step]?.note === note && patternRows[step]?.octave === octave;
                      return (
                        <div
                          key={step}
                          style={{
                            width: 28, height: 20,
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
                              if (active) {
                                updateNoteRow(patternSong.id, selectedPattern.id, step, { note: '', octave: 4, instrumentId: '', effect: '' });
                              } else {
                                updateNoteRow(patternSong.id, selectedPattern.id, step, { note, octave, instrumentId: selectedInstId, effect: '' });
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

function ToolBtn({ label, title, active }: { label: string; title?: string; active?: boolean }) {
  return (
    <button
      title={title}
      style={{
        background: active ? 'var(--accent)' : 'transparent',
        border: 'none', borderRadius: 3,
        color: 'var(--text-secondary)', fontSize: 13,
        width: 26, height: 24, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {label}
    </button>
  );
}
