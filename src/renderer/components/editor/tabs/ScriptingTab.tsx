import React, { useMemo, useRef } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { HierarchyPanel, type HierarchySection } from '../HierarchyPanel';
import { InspectorPanel, type InspectorSection } from '../InspectorPanel';
import { ResizableEditorLayout } from '../ResizableEditorLayout';
import { PlusIcon, CodeIcon } from './icons';
import { SCRIPT_MODES, type ScriptData, type ScriptMode } from '../../../types/editor';

const MODE_LABEL: Record<ScriptMode, string> = {
  blocks: 'Bloques',
  language: 'AdvanceCode',
  c: 'C Directo',
};

const MODE_HINT: Record<ScriptMode, string> = {
  blocks: 'Une bloques visuales. El motor los convertirá a AdvanceCode al exportar.',
  language: 'AdvanceCode: la sintaxis pensada para GBA (sin floats, sin memoria dinámica).',
  c: 'Escribe C directo. El script se inserta en la ROM y se ejecuta cada frame si define las funciones del contrato: script_init() (una vez) y script_update() (cada frame).',
};

const MODE_SOON: Record<Exclude<ScriptMode, 'c'>, string> = {
  blocks: 'El lienzo de bloques llegará en la próxima fase.',
  language: 'El intérprete de AdvanceCode llegará en la próxima fase.',
};

export function ScriptingTab() {
  const { scripts, addScript, updateScript, removeScript, setScriptMode, scenes, updateActor, selectedNodeId, setSelectedNodeId } = useAppStore();
  const [hierarchyWidth, setHierarchyWidth] = React.useState(230);
  const [inspectorWidth, setInspectorWidth] = React.useState(240);
  const [comingSoonMode, setComingSoonMode] = React.useState<ScriptMode | null>(null);
  const [assignSceneId, setAssignSceneId] = React.useState('');
  const [assignActorId, setAssignActorId] = React.useState('');

  const selected = scripts.find((s) => s.id === selectedNodeId) ?? null;
  const activeMode = comingSoonMode ?? selected?.mode ?? 'c';

  const assignments = React.useMemo(() => {
    if (!selected) return [] as { sceneId: string; sceneName: string; actorId: string; actorName: string }[];
    const out: { sceneId: string; sceneName: string; actorId: string; actorName: string }[] = [];
    for (const scene of scenes) {
      for (const actor of scene.actors) {
        if (actor.scriptId === selected.id) {
          out.push({ sceneId: scene.id, sceneName: scene.name, actorId: actor.id, actorName: actor.name });
        }
      }
    }
    return out;
  }, [scenes, selected]);

  const code = selected?.cCode ?? '';
  const hasCode = code.trim().length > 0;
  const hasUpdate = /void\s+script_update\s*\(\s*void\s*\)/.test(code);
  const hasInit = /void\s+script_init\s*\(\s*void\s*\)/.test(code);
  const shipsToRom = selected?.mode === 'c' && hasCode && assignments.length > 0;

  const status = !selected
    ? null
    : selected.mode !== 'c'
      ? { tone: 'warn' as const, label: 'Próximamente', detail: 'Este modo todavía no genera código para la ROM.' }
      : !hasCode
        ? { tone: 'warn' as const, label: 'Vacío', detail: 'Escribe el código C para poder exportarlo.' }
        : assignments.length === 0
          ? { tone: 'warn' as const, label: 'Sin asignar', detail: 'Un script solo se compila si está asignado a un actor. Asígnalo abajo para que entre en la ROM.' }
          : !hasUpdate
            ? { tone: 'warn' as const, label: 'Falta script_update', detail: 'El motor solo llama a script_update() cada frame. Sin él, este script no hace nada.' }
            : { tone: 'ok' as const, label: 'Se exporta', detail: `Se compila en la ROM y corre cada frame en ${assignments.length} actor${assignments.length > 1 ? 'es' : ''}.` };

  const hierarchySections: HierarchySection[] = (SCRIPT_MODES.map((m) => {
    const items = scripts
      .filter((s) => s.mode === m.value)
      .map((s) => {
        const n = scenes.reduce((acc, sc) => acc + sc.actors.filter((a) => a.scriptId === s.id).length, 0);
        return {
          id: s.id,
          label: s.name,
          icon: <span style={{ color: m.value === 'c' ? '#4ade80' : '#a78bfa' }}>{m.value === 'c' ? '◧' : '◱'}</span>,
          subtitle: m.value !== 'c'
            ? 'próximamente'
            : n > 0
              ? `${n} actor${n > 1 ? 'es' : ''}`
              : s.cCode.trim() ? 'sin asignar' : 'vacío',
        };
      });
    return {
      id: m.value,
      title: m.label.toUpperCase(),
      items,
      onAdd: () => { setComingSoonMode(null); addScript(m.value); },
    };
  }));

  const handleModeClick = (id: string, target: ScriptMode) => {
    const sc = scripts.find((s) => s.id === id);
    if (!sc) return;
    if (target !== 'c') {
      setComingSoonMode(target);
      return;
    }
    setComingSoonMode(null);
    if (sc.mode === 'c') return;
    const hasContent = sc.blocks.length > 0 || sc.language.trim().length > 0 || sc.cCode.trim().length > 0;
    if (hasContent && !window.confirm(
      `"${sc.name}" tiene contenido en el modo ${MODE_LABEL[sc.mode]}.\n` +
      `Cada modo se guarda por separado (no se borra nada).\n\n¿Cambiar a C Directo?`
    )) return;
    setScriptMode(id, 'c');
  };

  const inspectorSections: InspectorSection[] = [];
  if (selected) {
    const sc = selected;
    inspectorSections.push({
      title: 'Script',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 56 }}>Nombre</span>
            <input type="text" value={sc.name}
              onChange={(e) => updateScript(sc.id, { name: e.target.value })}
              style={{ flex: 1, background: '#141420', border: '1px solid var(--border-light)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '3px 6px', outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 56 }}>Modo</span>
            <select value={sc.mode}
              onChange={(e) => handleModeClick(sc.id, e.target.value as ScriptMode)}
              style={{ flex: 1, background: '#141420', border: '1px solid var(--border-light)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '3px 6px', outline: 'none' }}
            >
              {SCRIPT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>
      ),
    });

    inspectorSections.push({
      title: 'Ayuda',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--text-secondary)', fontSize: 11, lineHeight: 1.5 }}>
          <span>{MODE_HINT[activeMode]}</span>
          <span style={{ marginTop: 4, color: 'var(--text-muted)' }}>
            Regla GBA: nada de floats ni memoria dinámica. Los tipos son u8/s16. Todo vive en el loop de 60fps.
          </span>
        </div>
      ),
    });

    inspectorSections.push({
      title: 'Exportación GBA',
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
              background: status?.tone === 'ok' ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)',
              color: status?.tone === 'ok' ? '#22c55e' : '#eab308',
              border: status?.tone === 'ok' ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(234,179,8,0.3)',
            }}>
              {status?.label}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 10, flex: 1, lineHeight: 1.4 }}>
              {status?.detail}
            </span>
          </div>
          {sc.mode === 'c' && hasCode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ color: hasInit ? '#22c55e' : 'var(--text-muted)', fontSize: 10, fontFamily: 'monospace' }}>
                {hasInit ? '✓' : '○'} void script_init(void);   // una vez
              </div>
              <div style={{ color: hasUpdate ? '#22c55e' : '#eab308', fontSize: 10, fontFamily: 'monospace' }}>
                {hasUpdate ? '✓' : '○'} void script_update(void); // cada frame
              </div>
            </div>
          )}
          {sc.mode === 'c' && hasCode && (
            <div style={{ background: '#0d0d14', border: '1px solid var(--border-light)', borderRadius: 4, padding: 8, fontSize: 10, fontFamily: 'monospace', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              void script_init(void);   // una vez<br />
              void script_update(void); // cada frame<br />
              <span style={{ color: '#666' }}>// API: gActors[..], moveActorCollide(), REG_KEYINPUT</span>
            </div>
          )}
        </div>
      ),
    });

    if (sc.mode === 'c') {
      const actorScenes = scenes.filter((scene) => scene.actors.length > 0);
      const pickScene = actorScenes.find((s) => s.id === assignSceneId) ?? actorScenes[0];
      const inputStyle = {
        width: '100%', background: '#141420', border: '1px solid var(--border-light)',
        borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '4px 6px', outline: 'none',
      } as const;
      inspectorSections.push({
        title: `Actores (${assignments.length})`,
        content: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 10, lineHeight: 1.4 }}>
              El script se compila en la ROM y corre por cada actor asignado. Sin asignar, no se exporta.
            </span>

            {actorScenes.length === 0 ? (
              <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Este proyecto no tiene actores.</span>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 }}>Escena</span>
                  <select
                    value={pickScene?.id ?? ''}
                    onChange={(e) => { setAssignSceneId(e.target.value); setAssignActorId(''); }}
                    style={inputStyle}
                  >
                    {actorScenes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 }}>Actor</span>
                  <select
                    value={assignActorId}
                    onChange={(e) => {
                      const actor = pickScene?.actors.find((a) => a.id === e.target.value);
                      if (actor) updateActor(pickScene!.id, actor.id, { scriptId: sc.id });
                      setAssignActorId('');
                    }}
                    style={inputStyle}
                  >
                    <option value="">Selecciona un actor…</option>
                    {pickScene?.actors.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}{a.scriptId === sc.id ? '  ✓' : a.scriptId ? '  (otro script)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {assignments.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 }}>Asignados</span>
                {assignments.map((asg) => (
                  <div
                    key={asg.actorId}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
                      borderRadius: 4, padding: '3px 4px 3px 8px', fontSize: 11,
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#22c55e' }}>
                      {asg.actorName}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {asg.sceneName}
                    </span>
                    <button
                      onClick={() => updateActor(asg.sceneId, asg.actorId, { scriptId: undefined })}
                      title="Quitar asignación"
                      style={{
                        marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)',
                        cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: '2px 4px',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ),
      });
    }

    inspectorSections.push({
      title: 'Eliminar',
      content: (
        <button onClick={() => { removeScript(sc.id); setSelectedNodeId(''); setComingSoonMode(null); }}
          style={{
            width: '100%', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
            borderRadius: 4, color: '#f87171', fontSize: 11, padding: '6px 12px', cursor: 'pointer',
          }}
        >
          Eliminar script
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
          onRemove={(id) => { removeScript(id); setSelectedNodeId(''); setComingSoonMode(null); }}
        />
      }
      center={
        selected ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-canvas)', overflow: 'hidden' }}>
            {/* Top bar: script name + mode selector */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              borderBottom: '1px solid var(--border-color)', background: 'var(--bg-panel)', flexShrink: 0,
            }}>
              <span style={{ color: 'var(--text)', fontSize: 12, fontWeight: 700 }}>{selected.name}</span>
              {status && (
                <span
                  title={status.detail}
                  style={{
                    padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                    background: status.tone === 'ok' ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)',
                    color: status.tone === 'ok' ? '#22c55e' : '#eab308',
                    border: status.tone === 'ok' ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(234,179,8,0.3)',
                  }}
                >
                  {status.label}
                </span>
              )}
              {selected.mode === 'c' && (
                <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                  {selected.cCode.split('\n').length} líneas · {assignments.length} actor{assignments.length === 1 ? '' : 'es'}
                </span>
              )}
              <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                {SCRIPT_MODES.map((m) => (
                  <button key={m.value}
                    onClick={() => handleModeClick(selected.id, m.value)}
                    style={{
                      padding: '4px 12px', fontSize: 11, borderRadius: 4, cursor: 'pointer',
                      border: activeMode === m.value ? '1px solid var(--accent)' : '1px solid var(--border-light)',
                      background: activeMode === m.value ? 'var(--accent)' : 'transparent',
                      color: activeMode === m.value ? '#fff' : 'var(--text-muted)',
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {activeMode === 'c'
              ? <CodeEditor script={selected} onUpdate={updateScript} />
              : <ComingSoonPane mode={activeMode} />}
          </div>
        ) : (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 12, background: 'var(--bg-canvas)', color: 'var(--text-muted)',
          }}>
            <CodeIcon size={48} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              Sin scripts seleccionados
            </span>
            <span style={{ fontSize: 11, maxWidth: 380, textAlign: 'center', lineHeight: 1.5 }}>
              Por ahora el sistema de código soporta <b>C Directo</b>. Bloques y AdvanceCode llegarán próximamente.
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {SCRIPT_MODES.map((m) => (
                <button key={m.value} onClick={() => { setComingSoonMode(null); addScript(m.value); }}
                  style={{
                    background: 'transparent', border: '1px dashed var(--border-light)', borderRadius: 4,
                    color: 'var(--text-muted)', fontSize: 11, padding: '6px 12px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <PlusIcon size={12} /> {m.label}
                </button>
              ))}
            </div>
          </div>
        )
      }
      right={
        <InspectorPanel
          title="Script"
          sections={inspectorSections}
          emptyMessage="Selecciona un script"
        />
      }
    />
  );
}

// ── Coming soon pane (Bloques / AdvanceCode) ────────────────────────────────
function ComingSoonPane({ mode }: { mode: Exclude<ScriptMode, 'c'> }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 14, background: 'var(--bg-canvas)', color: 'var(--text-muted)',
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%', background: 'var(--bg-raised)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--accent)', opacity: 0.7,
      }}>
        <CodeIcon size={32} />
      </div>
      <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{MODE_LABEL[mode]}</span>
      <span style={{ fontSize: 11, maxWidth: 340, textAlign: 'center', lineHeight: 1.5 }}>{MODE_SOON[mode]}</span>
      <span style={{
        padding: '2px 10px', borderRadius: 10, fontSize: 10, fontWeight: 700,
        background: 'rgba(234,179,8,0.15)', color: '#eab308', border: '1px solid rgba(234,179,8,0.3)',
      }}>
        Próximamente
      </span>
    </div>
  );
}

// ── C code editor ──────────────────────────────────────────────────────────
const CODE_FONT = 'SFMono-Regular, Consolas, "Liberation Mono", monospace';
const CODE_LINE_HEIGHT = 16;

const CODE_SNIPPETS: { label: string; code: string }[] = [
  { label: 'script_update()', code: 'void script_update(void) {\n  \n}\n' },
  { label: 'script_init()', code: 'void script_init(void) {\n  \n}\n' },
  { label: 'leer teclas', code: 'u16 keys = ~REG_KEYINPUT & 0x3FF;   // b4=RIGHT b5=LEFT b6=UP b7=DOWN' },
  { label: 'mover gSelf', code: 'moveActorCollide(gSelf, 2, 0);   // (actor, dx, dy) en píxeles' },
  { label: 'bucle de frames', code: 'for (u16 i = 0; i < 60; i++) {\n  \n}\n' },
  { label: 'datos de gSelf', code: 'gSelf->x;  gSelf->y;  gSelf->frame;  gSelf->timer;' },
];

function CodeEditor({ script, onUpdate }: { script: ScriptData; onUpdate: (id: string, patch: Partial<ScriptData>) => void }) {
  const value = script.cCode;
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const setValue = (v: string) => onUpdate(script.id, { cCode: v });

  const lines = useMemo(() => value.split('\n').length, [value]);

  const balance = useMemo(() => {
    const code = value
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
      .replace(/"(?:\\.|[^"\\])*"/g, '""')
      .replace(/'(?:\\.|[^'\\])*'/g, "''");
    let braces = 0, parens = 0;
    for (const ch of code) {
      if (ch === '{') braces++;
      else if (ch === '}') braces--;
      else if (ch === '(') parens++;
      else if (ch === ')') parens--;
    }
    return { braces, parens };
  }, [value]);

  const insert = (text: string) => {
    const ta = taRef.current;
    if (!ta) { setValue(value + text); return; }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    setValue(value.slice(0, start) + text + value.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + text.length;
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    const next = e.target.value;
    if (next.length !== value.length + 1) { setValue(next); return; }
    const start = ta.selectionStart;
    const typed = next.slice(start - 1, start);
    const after = value.slice(start);
    if ((typed === '}' || typed === ')' || typed === ']') && after[0] === typed) {
      setValue(next.slice(0, start) + after.slice(1));
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start; });
      return;
    }
    if (typed === '{' || typed === '(' || typed === '[') {
      const close = typed === '{' ? '}' : typed === '(' ? ')' : ']';
      setValue(next.slice(0, start) + close + after);
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start; });
      return;
    }
    setValue(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;

    if (e.key === 'Tab') {
      e.preventDefault();
      if (!value.slice(start, end).includes('\n')) {
        setValue(value.slice(0, start) + (e.shiftKey ? '' : '  ') + value.slice(end));
        const caret = e.shiftKey ? start : start + 2;
        requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = caret; });
        return;
      }
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const block = value.slice(lineStart, end);
      const shifted = block.split('\n')
        .map((l) => (e.shiftKey ? l.replace(/^ {1,2}/, '') : '  ' + l))
        .join('\n');
      setValue(value.slice(0, lineStart) + shifted + value.slice(end));
      const delta = shifted.length - block.length;
      requestAnimationFrame(() => { ta.selectionStart = lineStart; ta.selectionEnd = end + delta; });
      return;
    }

    if (e.key === 'Enter') {
      const m = value.slice(0, start).match(/(?:^|\n)([ \t]*)$/);
      if (!m) return;
      e.preventDefault();
      const extra = value.slice(0, start).trimEnd().endsWith('{') ? '  ' : '';
      const indent = m[1] + extra;
      setValue(value.slice(0, start) + '\n' + indent + value.slice(start));
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 1 + indent.length; });
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const lineEnd = value.indexOf('\n', end);
      const block = value.slice(lineStart, lineEnd === -1 ? value.length : lineEnd);
      const commented = block.split('\n').every((l) => !l.trim() || l.trimStart().startsWith('//'));
      const nextBlock = block.split('\n')
        .map((l) => {
          if (!l.trim()) return l;
          if (commented) return l.replace(/^(\s*)\/\/ ?/, '$1');
          const indent = l.match(/^\s*/)?.[0] ?? '';
          return `${indent}// ${l.slice(indent.length)}`;
        })
        .join('\n');
      setValue(value.slice(0, lineStart) + nextBlock + value.slice(lineEnd === -1 ? value.length : lineEnd));
      return;
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0d0d14' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', flexWrap: 'wrap',
        borderBottom: '1px solid var(--border-color)', background: 'var(--bg-panel)', flexShrink: 0,
      }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 9, marginRight: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Insertar
        </span>
        {CODE_SNIPPETS.map((sn) => (
          <button key={sn.label} onClick={() => insert(sn.code)} title={sn.code}
            style={{
              background: 'transparent', border: '1px solid var(--border-light)', borderRadius: 3,
              color: 'var(--text-secondary)', fontSize: 10, fontFamily: CODE_FONT, padding: '2px 6px', cursor: 'pointer',
            }}
          >
            {sn.label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
          {(balance.braces !== 0 || balance.parens !== 0)
            ? <span style={{ color: '#eab308' }}>
                {balance.braces !== 0 ? `llaves ${balance.braces > 0 ? '+' : ''}${balance.braces} ` : ''}
                {balance.parens !== 0 ? `paréntesis ${balance.parens > 0 ? '+' : ''}${balance.parens}` : ''}
              </span>
            : <span style={{ color: '#3f3f3f' }}>balanceadas</span>
          }
        </span>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div
          className="code-gutter"
          style={{
            width: 44, flexShrink: 0, overflow: 'hidden', textAlign: 'right', paddingTop: 10, paddingRight: 8,
            color: '#555', fontSize: 12, fontFamily: CODE_FONT,
            userSelect: 'none', borderRight: '1px solid var(--border-color)', background: '#0d0d14',
          }}
        >
          {Array.from({ length: lines }, (_, i) => (
            <div key={i} style={{ height: CODE_LINE_HEIGHT, lineHeight: `${CODE_LINE_HEIGHT}px` }}>{i + 1}</div>
          ))}
        </div>

        <textarea
          ref={taRef}
          value={value}
          onChange={handleChange}
          onScroll={(e) => {
            const gutter = e.currentTarget.parentElement?.querySelector('.code-gutter');
            if (gutter) gutter.scrollTop = e.currentTarget.scrollTop;
          }}
          onKeyDown={handleKeyDown}
          wrap="off"
          spellCheck={false}
          placeholder={'// C directo — define script_update(void) para que corra cada frame\n// script_init(void) corre una vez al entrar a la escena'}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none',
            color: 'var(--text)', fontSize: 12, lineHeight: `${CODE_LINE_HEIGHT}px`, padding: '10px 12px',
            fontFamily: CODE_FONT, whiteSpace: 'pre', tabSize: 2,
          }}
        />
      </div>
    </div>
  );
}