import React, { useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { HierarchyPanel, type HierarchySection } from '../HierarchyPanel';
import { InspectorPanel, type InspectorSection } from '../InspectorPanel';
import type { InstrumentType, NoteRow } from '../../../types/editor';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OCTAVES = [2, 3, 4, 5, 6, 7, 8];
const NOTE_KEYS_FLAT = [...NOTES];

export function MusicTab() {
  const songs = useAppStore((s) => s.songs);
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useAppStore((s) => s.setSelectedNodeId);
  const addSong = useAppStore((s) => s.addSong);
  const removeSong = useAppStore((s) => s.removeSong);
  const updateSong = useAppStore((s) => s.updateSong);
  const addInstrument = useAppStore((s) => s.addInstrument);
  const removeInstrument = useAppStore((s) => s.removeInstrument);
  const updateInstrument = useAppStore((s) => s.updateInstrument);
  const addPattern = useAppStore((s) => s.addPattern);
  const removePattern = useAppStore((s) => s.removePattern);
  const updatePattern = useAppStore((s) => s.updatePattern);
  const updateNoteRow = useAppStore((s) => s.updateNoteRow);

  const [dutyCycle, setDutyCycle] = useState('12.5');
  const [activePattern, setActivePattern] = useState<string | null>(null);

  const selectedSong = songs.find((so) => so.id === selectedNodeId)
    ?? (selectedNodeId ? null : null);
  const selectedInst = songs.flatMap((so) => so.instruments).find((i) => i.id === selectedNodeId);
  const selectedPattern = songs.flatMap((so) => so.patterns).find((p) => p.id === (activePattern ?? ''));

  const parentSong = selectedInst
    ? songs.find((so) => so.instruments.some((i) => i.id === selectedInst.id))
    : selectedPattern
    ? songs.find((so) => so.patterns.some((p) => p.id === selectedPattern.id))
    : selectedSong;

  const currentSong = selectedSong
    ?? (selectedInst ? songs.find((so) => so.instruments.some((i) => i.id === selectedInst.id)) : null)
    ?? (selectedPattern ? songs.find((so) => so.patterns.some((p) => p.id === selectedPattern.id)) : null);

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
      id: 'instruments',
      title: 'INSTRUMENTS',
      collapsed: !currentSong,
      items: currentSong
        ? [
            ...currentSong.instruments.filter((i) => i.type === 'duty').map((i) => ({
              id: i.id, label: i.name, icon: '🔔',
              subtitle: i.muted ? 'M' : i.solo ? 'S' : '',
            })),
            ...currentSong.instruments.filter((i) => i.type === 'wave').map((i) => ({
              id: i.id, label: i.name, icon: '〰',
              subtitle: i.muted ? 'M' : i.solo ? 'S' : '',
            })),
            ...currentSong.instruments.filter((i) => i.type === 'noise').map((i) => ({
              id: i.id, label: i.name, icon: '📢',
              subtitle: i.muted ? 'M' : i.solo ? 'S' : '',
            })),
          ]
        : [],
      onAdd: currentSong ? () => addInstrument(currentSong.id) : undefined,
    },
  ];

  const inspectorSections: InspectorSection[] = [];

  if (selectedInst) {
    const inst = selectedInst;
    inspectorSections.push({
      title: 'Instrumento',
      fields: [
        { label: 'Nombre', type: 'text', value: inst.name, onChange: (v) => parentSong && updateInstrument(parentSong.id, inst.id, { name: v as string }) },
        { label: 'Tipo', type: 'select', value: inst.type, options: [
          { value: 'duty', label: 'Duty' },
          { value: 'wave', label: 'Wave' },
          { value: 'noise', label: 'Noise' },
        ], onChange: (v) => parentSong && updateInstrument(parentSong.id, inst.id, { type: v as InstrumentType }) },
        { label: 'Mute', type: 'toggle', value: inst.muted, onChange: (v) => parentSong && updateInstrument(parentSong.id, inst.id, { muted: v as boolean }) },
        { label: 'Solo', type: 'toggle', value: inst.solo, onChange: (v) => parentSong && updateInstrument(parentSong.id, inst.id, { solo: v as boolean }) },
      ],
    });
    inspectorSections.push({
      title: 'Envolvente (ADSR)',
      fields: [
        { label: 'Attack', type: 'number', value: inst.envelope.attack, onChange: (v) => parentSong && updateInstrument(parentSong.id, inst.id, { envelope: { ...inst.envelope, attack: v as number } }) },
        { label: 'Decay', type: 'number', value: inst.envelope.decay, onChange: (v) => parentSong && updateInstrument(parentSong.id, inst.id, { envelope: { ...inst.envelope, decay: v as number } }) },
        { label: 'Sustain', type: 'number', value: inst.envelope.sustain, onChange: (v) => parentSong && updateInstrument(parentSong.id, inst.id, { envelope: { ...inst.envelope, sustain: v as number } }) },
        { label: 'Release', type: 'number', value: inst.envelope.release, onChange: (v) => parentSong && updateInstrument(parentSong.id, inst.id, { envelope: { ...inst.envelope, release: v as number } }) },
      ],
    });
    inspectorSections.push({
      title: 'Frecuencia',
      fields: [
        { label: 'Volumen', type: 'number', value: 100, onChange: () => {} },
        { label: 'Frecuencia', type: 'number', value: 440, onChange: () => {} },
      ],
    });
    inspectorSections.push({
      title: 'Duty Cycle',
      fields: [
        { label: 'Onda', type: 'select', value: String(inst.dutyCycle), options: [
          { value: '0.125', label: '12.5% ▏' },
          { value: '0.25', label: '25% ▎' },
          { value: '0.5', label: '50% ▊' },
          { value: '0.75', label: '75% ▊' },
        ], onChange: (v) => parentSong && updateInstrument(parentSong.id, inst.id, { dutyCycle: Number(v) }) },
      ],
    });
  }

  const handleRemove = (id: string) => {
    if (songs.some((so) => so.id === id)) removeSong(id);
    else {
      for (const so of songs) {
        if (so.instruments.some((i) => i.id === id)) { removeInstrument(so.id, id); break; }
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
    () => currentSong?.instruments[0]?.id ?? ''
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
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <HierarchyPanel
        sections={hierarchySections}
        selectedId={selectedNodeId}
        onSelect={setSelectedNodeId}
        onRemove={handleRemove}
      />

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

          {/* Step count */}
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
              padding: '2px 4px',
            }}
          >
            {(currentSong?.instruments ?? []).map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </div>

        {/* Piano Roll */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', position: 'relative' }}>
          {/* Note labels (sticky left) */}
          <div style={{
            display: 'flex', flexDirection: 'column',
            background: 'var(--bg-dark)',
            borderRight: '1px solid var(--bg-raised)',
            flexShrink: 0, position: 'sticky', left: 0, zIndex: 1,
          }}>
            {ALL_NOTES.map(({ note, octave, label }) => (
              <div
                key={label}
                style={{
                  width: 44, height: 16,
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex', alignItems: 'center',
                  paddingLeft: isNoteSharp(note) ? 12 : 4,
                  fontSize: 8,
                  color: isNoteSharp(note) ? 'var(--text-dim)' : isCNote(note) ? 'var(--accent-light)' : 'var(--text-secondary)',
                  background: isNoteSharp(note) ? 'var(--bg-canvas)' : isCNote(note) ? 'var(--bg-inspector)' : 'transparent',
                }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div style={{ position: 'relative', minWidth: patternStepCount * 24 }}>
            {/* Beat lines overlay */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              backgroundImage: 'linear-gradient(90deg, var(--border-light) 1px, transparent 1px)',
              backgroundSize: `${4 * 24}px 1px`,
            }} />

            {/* Measure lines (every 16 steps) */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              backgroundImage: 'linear-gradient(90deg, var(--accent-dark) 1px, transparent 1px)',
              backgroundSize: `${16 * 24}px 1px`,
            }} />

            {/* Note cells */}
            {ALL_NOTES.map(({ note, octave, label }) => (
              <div key={label} style={{ display: 'flex', height: 16, position: 'relative' }}>
                {Array.from({ length: patternStepCount }, (_, step) => {
                  const active = patternRows[step]?.note === note && patternRows[step]?.octave === octave;
                  return (
                    <div
                      key={step}
                      style={{
                        width: 24, height: 16,
                        background: active ? 'var(--accent)' : 'transparent',
                        borderBottom: '1px solid var(--border-color)',
                        borderRight: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'background 0.05s',
                      }}
                      onMouseEnter={(e) => {
                        if (!active) e.currentTarget.style.background = 'var(--accent-dark)';
                      }}
                      onMouseLeave={(e) => {
                        if (!active) e.currentTarget.style.background = 'transparent';
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
            ))}
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

        {/* Instrument mute/solo bar */}
        {currentSong && currentSong.instruments.length > 0 && (
          <div style={{
            height: 28,
            background: 'var(--bg-canvas)',
            borderTop: '1px solid var(--border-color)',
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '0 10px', flexShrink: 0, overflowX: 'auto',
          }}>
            {currentSong.instruments.map((inst) => (
              <div
                key={inst.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 2,
                  padding: '2px 6px',
                  background: inst.muted ? '#2a1515' : 'var(--bg-dark)',
                  borderRadius: 3, fontSize: 10,
                  color: inst.muted ? '#666' : '#aaa',
                  flexShrink: 0,
                }}
              >
                <span style={{ cursor: 'pointer' }} onClick={() => updateInstrument(currentSong.id, inst.id, { visible: !inst.visible })}>
                  {inst.visible ? '👁' : '👁‍🗨'}
                </span>
                <span>{inst.name}</span>
                <button
                  onClick={() => updateInstrument(currentSong.id, inst.id, { muted: !inst.muted })}
                  style={{
                    background: inst.muted ? 'var(--red)' : 'var(--bg-raised)',
                    border: 'none', borderRadius: 2,
                    color: '#fff', fontSize: 8,
                    padding: '1px 4px', cursor: 'pointer', fontWeight: 700,
                  }}
                >
                  M
                </button>
                <button
                  onClick={() => updateInstrument(currentSong.id, inst.id, { solo: !inst.solo })}
                  style={{
                    background: inst.solo ? '#fbbf24' : 'var(--bg-raised)',
                    border: 'none', borderRadius: 2,
                    color: inst.solo ? '#000' : '#fff',
                    fontSize: 8, padding: '1px 4px', cursor: 'pointer', fontWeight: 700,
                  }}
                >
                  S
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <InspectorPanel
        title="Inspector"
        sections={inspectorSections}
        emptyMessage="Selecciona un instrumento"
      />
    </div>
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
