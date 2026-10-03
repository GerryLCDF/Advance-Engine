import React, { useMemo, useRef } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { HierarchyPanel, type HierarchySection } from '../HierarchyPanel';
import { InspectorPanel, type InspectorSection } from '../InspectorPanel';
import { ResizableEditorLayout } from '../ResizableEditorLayout';
import { AdvanceCodeIcon, CodeIcon, PlusIcon, PuzzleIcon, XIcon } from './icons';
import { SCRIPT_MODES, type ScriptData, type ScriptMode } from '../../../types/editor';
import { highlightCode, type CodeTokenType } from '../codeHighlight';
import { transpileAdvanceCode } from '../../../utils/advanceCode';

const MODE_LABEL: Record<ScriptMode, string> = {
  blocks: 'Bloques',
  language: 'AdvanceCode',
  c: 'C',
};

const MODE_HINT: Record<ScriptMode, string> = {
  blocks: 'Une bloques visuales. El motor los convertirá a AdvanceCode al exportar.',
  language: 'AdvanceCode: la sintaxis pensada para GBA (sin floats, sin memoria dinámica). Se transpila a C 1:1 al exportar; this = el actor asignado.',
  c: 'Escribe C directo. El script se inserta en la ROM y se ejecuta cada frame si define las funciones del contrato: script_init() (una vez) y script_update() (cada frame).',
};

const MODE_SOON: Record<'blocks', string> = {
  blocks: 'El lienzo de bloques llegará en la próxima fase.',
};

// Colores del badge de estado (ok = verde, error = rojo, warn = ámbar).
function statusColors(tone?: 'ok' | 'warn' | 'error') {
  if (tone === 'ok') return { bg: 'rgba(34,197,94,0.15)', fg: '#22c55e', bd: '1px solid rgba(34,197,94,0.3)' };
  if (tone === 'error') return { bg: 'rgba(248,113,113,0.15)', fg: '#f87171', bd: '1px solid rgba(248,113,113,0.3)' };
  return { bg: 'rgba(234,179,8,0.15)', fg: '#eab308', bd: '1px solid rgba(234,179,8,0.3)' };
}

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

  const code = selected
    ? (selected.mode === 'language' ? selected.language : selected.cCode)
    : '';
  const hasCode = code.trim().length > 0;
  const isLang = selected?.mode === 'language';
  // AdvanceCode se transpila en vivo para el estado: errores, y si define el
  // contrato (on start / on update). El C directo usa el regex del contrato.
  const acod = React.useMemo(
    () => (selected && selected.mode === 'language' ? transpileAdvanceCode(selected.language, selected.name) : null),
    [selected?.id, selected?.mode, selected?.language, selected?.name],
  );
  const acodErrors = acod && !acod.ok ? acod.errors : [];
  const hasUpdate = acod ? acod.hasUpdate : /void\s+script_update\s*\(\s*void\s*\)/.test(code);
  const hasInit = acod ? acod.hasInit : /void\s+script_init\s*\(\s*void\s*\)/.test(code);
  const shipsToRom = (selected?.mode === 'c' || isLang) && hasCode && assignments.length > 0 && acodErrors.length === 0;
  const contractDetail = hasUpdate ? (isLang ? 'on update' : 'script_update') : (isLang ? 'on update (obligatorio)' : 'script_update');

  const status = !selected
    ? null
    : selected.mode === 'blocks'
      ? { tone: 'warn' as const, label: 'Próximamente', detail: 'Este modo todavía no genera código para la ROM.' }
      : acodErrors.length > 0
        ? { tone: 'error' as const, label: 'Error de sintaxis', detail: acodErrors[0] }
        : !hasCode
          ? { tone: 'warn' as const, label: 'Vacío', detail: isLang ? 'Escribe tu lógica en AdvanceCode para poder exportarla.' : 'Escribe el código C para poder exportarlo.' }
          : assignments.length === 0
            ? { tone: 'warn' as const, label: 'Sin asignar', detail: 'Un script solo se compila si está asignado a un actor. Asígnalo abajo para que entre en la ROM.' }
            : !hasUpdate
              ? { tone: 'warn' as const, label: `Falta ${contractDetail}`, detail: isLang ? 'El motor llama a on update cada frame. Sin él, este script no hace nada.' : 'El motor solo llama a script_update() cada frame. Sin él, este script no hace nada.' }
              : { tone: 'ok' as const, label: 'Se exporta', detail: `Se compila en la ROM y corre cada frame en ${assignments.length} actor${assignments.length > 1 ? 'es' : ''}.` };

  const hierarchySections: HierarchySection[] = (SCRIPT_MODES.map((m) => {
    const items = scripts
      .filter((s) => s.mode === m.value)
      .map((s) => {
        const n = scenes.reduce((acc, sc) => acc + sc.actors.filter((a) => a.scriptId === s.id).length, 0);
        return {
          id: s.id,
          label: s.name,
          icon: m.value === 'c' ? <CodeIcon size={14} /> : m.value === 'blocks' ? <PuzzleIcon size={14} /> : <AdvanceCodeIcon size={14} />,
          subtitle: m.value === 'blocks'
            ? 'próximamente'
            : n > 0
              ? `${n} actor${n > 1 ? 'es' : ''}`
              : (m.value === 'language' ? s.language : s.cCode).trim() ? 'sin asignar' : 'vacío',
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
    if (target === 'blocks') {
      setComingSoonMode(target);
      return;
    }
    setComingSoonMode(null);
    if (sc.mode === target) return;
    const hasContent = sc.blocks.length > 0 || sc.language.trim().length > 0 || sc.cCode.trim().length > 0;
    if (hasContent && !window.confirm(
      `"${sc.name}" tiene contenido en el modo ${MODE_LABEL[sc.mode]}.\n` +
      `Cada modo se guarda por separado (no se borra nada).\n\n¿Cambiar a ${MODE_LABEL[target]}?`
    )) return;
    setScriptMode(id, target);
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
              background: statusColors(status?.tone).bg,
              color: statusColors(status?.tone).fg,
              border: statusColors(status?.tone).bd,
            }}>
              {status?.label}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 10, flex: 1, lineHeight: 1.4 }}>
              {status?.detail}
            </span>
          </div>
          {acodErrors.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {acodErrors.slice(0, 6).map((e, i) => (
                <div key={i} style={{ color: '#f87171', fontSize: 10, fontFamily: 'monospace', lineHeight: 1.4 }}>• {e}</div>
              ))}
              {acodErrors.length > 6 && (
                <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>… y {acodErrors.length - 6} error(es) más</div>
              )}
            </div>
          )}
          {(sc.mode === 'c' || isLang) && hasCode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ color: hasInit ? '#22c55e' : 'var(--text-muted)', fontSize: 10, fontFamily: 'monospace' }}>
                {hasInit ? '✓' : '○'} {isLang ? 'on start' : 'void script_init(void);'}   // una vez
              </div>
              <div style={{ color: hasUpdate ? '#22c55e' : '#eab308', fontSize: 10, fontFamily: 'monospace' }}>
                {hasUpdate ? '✓' : '○'} {isLang ? 'on update' : 'void script_update(void);'} // cada frame
              </div>
            </div>
          )}
          {(sc.mode === 'c' || isLang) && hasCode && (
            <div style={{ background: '#0d0d14', border: '1px solid var(--border-light)', borderRadius: 4, padding: 8, fontSize: 10, fontFamily: 'monospace', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {isLang ? (
                <>logic MiLogica for Hero &#123;<br />
                &nbsp;&nbsp;on update &#123; … &#125;<br />
                &#125;<br /></>
              ) : (
                <>void script_init(void);   // una vez<br />
                void script_update(void); // cada frame<br /></>
              )}
              <span style={{ color: '#666' }}>// API: gActors[..], moveTopDown(), REG_KEYINPUT, actor_in_area(actor)</span>
            </div>
          )}
        </div>
      ),
    });

    if (sc.mode === 'c' || isLang) {
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
                        display: 'grid', placeItems: 'center',
                      }}
                    >
                      <XIcon size={11} />
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
                    background: statusColors(status.tone).bg,
                    color: statusColors(status.tone).fg,
                    border: statusColors(status.tone).bd,
                  }}
                >
                  {status.label}
                </span>
              )}
              {(selected.mode === 'c' || selected.mode === 'language') && (
                <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                  {code.split('\n').length} líneas · {assignments.length} actor{assignments.length === 1 ? '' : 'es'}
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

            {activeMode === 'blocks'
              ? <ComingSoonPane mode="blocks" />
              : <CodeEditor key={activeMode} script={selected} onUpdate={updateScript} field={activeMode === 'language' ? 'language' : 'cCode'} />}
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
              El sistema de código soporta <b>AdvanceCode</b> y <b>C</b>. Bloques llegará próximamente.
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
function ComingSoonPane({ mode }: { mode: 'blocks' }) {
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
const CODE_PADDING = '10px 12px';
// El interlineado crece con la letra (misma proporción que el 12/16 original)
const codeLineHeight = (size: number) => Math.round(size * 1.34);

// ── Minimapa (como el de VS Code) ──
// Columna a la derecha del editor: una barrita por línea del archivo y un
// cursor que marca la zona visible. La escala es FIJA (3 px por línea) para que
// un archivo de 1000 líneas quepa en la pantalla, igual que en VS Code.
const MM_W = 56;
const MM_ROW_H = 2;
const MM_GAP = 1;
const MM_LINE_H = MM_ROW_H + MM_GAP;
const MM_PAD = 6;
// Todas las líneas tienen que caber: si el archivo es más largo que el panel
// se COMPRIMEN (pitch más pequeño) en vez de recortarse, así el clic sigue
// apuntando a la línea correcta. Nunca baja de 2 px por línea.
const mmPitch = (availH: number, n: number) =>
  Math.max(MM_ROW_H + MM_GAP, Math.min(MM_LINE_H, Math.floor(availH / Math.max(1, n))));

// Colores del resaltado (paleta One Dark, afinada al fondo #0d0d14 del editor)
const TOKEN_COLOR: Record<CodeTokenType, string> = {
  comment: '#5c6370',
  preproc: '#e06c75',
  include: '#98c379',
  string: '#ce9178',
  char: '#ce9178',
  number: '#98c379',
  keyword: '#c678dd',
  type: '#e5c07b',
  builtin: '#61afef',
  func: '#61afef',
  op: '#8b93a5',
  text: 'var(--text)',
};
// El <pre> y el <textarea> comparten EXACTAMENTE estas métricas: si difieren
// una línea, el texto coloreado se descuadra del cursor
const codeMetrics = (size: number): React.CSSProperties => ({
  fontSize: size,
  lineHeight: `${codeLineHeight(size)}px`,
  fontFamily: CODE_FONT,
  whiteSpace: 'pre',
  tabSize: 2,
  padding: CODE_PADDING,
});

const CODE_SNIPPETS: { label: string; code: string }[] = [
  { label: 'script_update()', code: 'void script_update(void) {\n  \n}\n' },
  { label: 'script_init()', code: 'void script_init(void) {\n  \n}\n' },
  { label: 'leer teclas', code: 'u16 keys = ~REG_KEYINPUT & 0x3FF;   // b4=RIGHT b5=LEFT b6=UP b7=DOWN' },
  { label: 'topdown', code: 'moveTopDown(gSelf, keys);   // 4 dirs, sin gravedad\n' },
  { label: 'plataformas', code: 'movePlatformer(gSelf, keys);   // gravedad + salto (A)' },
  { label: 'en el suelo?', code: 'if (onFloor(gSelf)) { /* en el suelo */ }' },
  { label: 'mover a la fuerza', code: 'gSelf->vx = 3;   // velocidad horizontal (px/vsync)\ngSelf->vy = -6;  // negativa = hacia arriba' },
  { label: 'mover gSelf', code: 'moveActorCollide(gSelf, 2, 0);   // (actor, dx, dy) en píxeles' },
  { label: 'bucle de frames', code: 'for (u16 i = 0; i < 60; i++) {\n  \n}\n' },
  { label: 'datos de gSelf', code: 'gSelf->x;  gSelf->y;  gSelf->frame;  gSelf->timer;' },
];

// Snippets de AdvanceCode: la lógica se escribe dentro de `logic <Nombre> for
// <Actor> { on start {…} on update {…} }`. `this` es el actor asignado.
const ACOD_SNIPPETS: { label: string; code: string }[] = [
  { label: 'logic + on update', code: 'logic MiLogica for Hero {\n  on update {\n    \n  }\n}\n' },
  { label: 'on start', code: 'on start {\n  \n}\n' },
  { label: 'variable', code: 'mutable pasos: s16 = 0\n' },
  { label: 'si / si no', code: 'if (input.is_pressed(BUTTON_A)) {\n  \n} else {\n  \n}\n' },
  { label: 'topdown', code: 'moveTopDown(this, keys)\n' },
  { label: 'plataformas', code: 'movePlatformer(this, keys)\n' },
  { label: 'en el suelo?', code: 'if (onFloor(this)) {\n  \n}\n' },
  { label: 'mover a la fuerza', code: 'this.vx = 3\nthis.vy = -6\n' },
  { label: 'dentro de un área', code: 'if (actor_in_area(PLAYER_INDEX)) {\n  \n}\n' },
  { label: 'al entrar/salir de un área', code: 'if (actor_entered(PLAYER_INDEX)) {\n  switchScene(1)\n}\n' },
];

function CodeEditor({ script, onUpdate, field }: {
  script: ScriptData;
  onUpdate: (id: string, patch: Partial<ScriptData>) => void;
  field: 'cCode' | 'language';
}) {
  const value = script[field] ?? '';
  const codeFontSize = useAppStore((s) => s.codeFontSize);
  const setCodeFontSize = useAppStore((s) => s.setCodeFontSize);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const mmRef = useRef<HTMLDivElement | null>(null);
  const mmSliderRef = useRef<HTMLDivElement | null>(null);
  const mmDragRef = useRef(false);
  const [mmOn, setMmOn] = React.useState(true);

  const metrics = useMemo(() => codeMetrics(codeFontSize), [codeFontSize]);

  // Ctrl+rueda = zoom del código (listener nativo y NO pasivo: en el root de
  // React los eventos wheel son pasivos y preventDefault no valdría)
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setCodeFontSize(codeFontSize + (e.deltaY < 0 ? 1 : -1));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [codeFontSize, setCodeFontSize]);
  // ── Historial (Ctrl+Z / Ctrl+Y) ─────────────────────────────────────────
  // Pila propia en vez de la del navegador: el textarea es controlado y los
  // inserts de snippets / Tab / auto-cierre de llaves limpian el undo nativo,
  // así que con el nativo se perdían pasos. Al cambiar de script se reinicia.
  const HIST_MAX = 200;
  const HIST_COALESCE_MS = 600;
  const histRef = useRef<{ stack: string[]; index: number; at: number }>({ stack: [value], index: 0, at: 0 });

  React.useEffect(() => {
    histRef.current = { stack: [value], index: 0, at: 0 };
  }, [script.id]);

  const setValue = (v: string, typed = false) => {
    if (v === value) return;
    const h = histRef.current;
    const now = Date.now();
    // Lo escrito seguido se agrupa (como el undo por palabra de los editores):
    // escribir una línea entera es un solo Ctrl+Z, no 40
    if (typed && now - h.at < HIST_COALESCE_MS && h.index >= 0) {
      h.stack[h.index] = v;
    } else {
      h.stack.length = h.index + 1;
      h.stack.push(v);
      if (h.stack.length > HIST_MAX) h.stack.shift();
      h.index = h.stack.length - 1;
    }
    h.at = now;
    onUpdate(script.id, { [field]: v });
  };

  const stepHistory = (dir: -1 | 1) => {
    const h = histRef.current;
    const target = h.index + dir;
    if (target < 0 || target >= h.stack.length) return;
    h.index = target;
    h.at = 0;
    const next = h.stack[target];
    const ta = taRef.current;
    const caret = ta ? Math.min(ta.selectionStart, next.length) : next.length;
    onUpdate(script.id, { [field]: next });
    requestAnimationFrame(() => {
      const el = taRef.current;
      if (!el) return;
      el.focus();
      el.selectionStart = el.selectionEnd = caret;
    });
  };

  const lines = useMemo(() => value.split('\n').length, [value]);
  const tokens = useMemo(() => highlightCode(value), [value]);
  const lineH = codeLineHeight(codeFontSize);

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

  // ── Minimapa ──────────────────────────────────────────────────────────────
  // Una barrita por línea: el ancho es proporcional a lo larga que es (tope de
  // 100 caracteres) y el color el del primer token no vacío, para leer de un
  // vistazo dónde están los comentarios y los bloques.
  const mmRows = useMemo(() => {
    const raw = value.split('\n');
    const first = new Array<CodeTokenType | ''>(raw.length).fill('');
    let ln = 0;
    for (const tk of tokens) {
      const parts = tk.text.split('\n');
      if (parts[0].trim() && !first[ln]) first[ln] = tk.type;
      for (let i = 1; i < parts.length; i++) {
        ln += 1;
        if (parts[i].trim() && !first[ln]) first[ln] = tk.type;
      }
    }
    return raw.map((l, i) => {
      const trimmed = l.trim().length;
      const type = first[i];
      return {
        w: trimmed === 0 ? 0 : Math.max(2, Math.min(100, trimmed)) / 100,
        color: type ? TOKEN_COLOR[type] : 'transparent',
        op: type === 'comment' ? 0.3 : type === 'text' ? 0.28 : 0.5,
      };
    });
  }, [value, tokens]);

  // El alto del panel se mide tras el layout (si no, el primer render mide 0).
  // Va en estado y no en ref para que el valor nuevo se aplique a las filas.
  const [mmBox, setMmBox] = React.useState({ rowH: MM_ROW_H, gap: MM_GAP });
  const measureMM = () => {
    const mm = mmRef.current;
    if (!mm) return;
    const pitch = mmPitch(mm.clientHeight - MM_PAD * 2, lines);
    const next = { rowH: Math.max(1, pitch - MM_GAP), gap: pitch >= MM_LINE_H ? MM_GAP : 0 };
    setMmBox((b) => (b.rowH === next.rowH && b.gap === next.gap ? b : next));
  };
  React.useLayoutEffect(measureMM, [lines, mmOn, value, codeFontSize]);

  // El cursor del minimapa se mueve SIN re-render: se muta el estilo en el
  // onScroll, como ya se hace con el <pre> y el gutter (si no, cada scroll
  // re-renderizaría los miles de spans del resaltado).
  const mmSync = () => {
    const ta = taRef.current, mm = mmRef.current, sl = mmSliderRef.current;
    if (!ta || !mm || !sl) return;
    const max = ta.scrollHeight - ta.clientHeight;
    const mmH = mm.clientHeight - MM_PAD * 2;
    if (max <= 0 || mmH <= 0) { sl.style.display = 'none'; return; }
    const contentH = lines * mmPitch(mmH, lines);
    sl.style.display = 'block';
    sl.style.height = `${Math.max(16, Math.min(contentH, mmH * (ta.clientHeight / ta.scrollHeight)))}px`;
    sl.style.transform = `translateY(${(ta.scrollTop / ta.scrollHeight) * contentH}px)`;
  };

  React.useEffect(() => {
    const raf = requestAnimationFrame(mmSync);
    return () => cancelAnimationFrame(raf);
  }, [value, codeFontSize, mmOn, lines, mmBox]);

  // El alto del editor cambia al redimensionar los paneles (ResizableEditorLayout)
  React.useEffect(() => {
    const ta = taRef.current;
    if (!ta || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => { mmSync(); measureMM(); });
    ro.observe(ta);
    if (mmRef.current) ro.observe(mmRef.current);
    return () => ro.disconnect();
  }, [mmOn]);

  // Clic o arrastre: la línea tocada queda en el centro de la vista
  const mmJump = (clientY: number) => {
    const ta = taRef.current, mm = mmRef.current;
    if (!ta || !mm) return;
    const r = mm.getBoundingClientRect();
    const pitch = mmPitch(mm.clientHeight - MM_PAD * 2, lines);
    const idx = Math.max(0, Math.min(lines - 1, Math.floor((clientY - r.top - MM_PAD) / pitch)));
    const max = Math.max(0, ta.scrollHeight - ta.clientHeight);
    ta.scrollTop = Math.max(0, Math.min(max, idx * lineH - ta.clientHeight / 2 + lineH / 2));
  };

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
    if (next.length !== value.length + 1) { setValue(next, true); return; }
    const start = ta.selectionStart;
    const typed = next.slice(start - 1, start);
    const after = value.slice(start);
    if ((typed === '}' || typed === ')' || typed === ']') && after[0] === typed) {
      setValue(next.slice(0, start) + after.slice(1), true);
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start; });
      return;
    }
    if (typed === '{' || typed === '(' || typed === '[') {
      const close = typed === '{' ? '}' : typed === '(' ? ')' : ']';
      setValue(next.slice(0, start) + close + after, true);
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start; });
      return;
    }
    setValue(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;

    if (e.ctrlKey || e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); stepHistory(-1); return; }
      if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); stepHistory(1); return; }
    }

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
       {(field === 'language' ? ACOD_SNIPPETS : CODE_SNIPPETS).map((sn) => (
          <button key={sn.label} onClick={() => insert(sn.code)} title={sn.code}
            style={{
              background: 'transparent', border: '1px solid var(--border-light)', borderRadius: 3,
              color: 'var(--text-secondary)', fontSize: 10, fontFamily: CODE_FONT, padding: '2px 6px', cursor: 'pointer',
            }}
          >
            {sn.label}
          </button>
        ))}
        <button
          onClick={() => setCodeFontSize(12)}
          title="Zoom del código: Ctrl + rueda del ratón (clic aquí para volver al 100%)"
          style={{
            marginLeft: 'auto', marginRight: 8, background: 'transparent', border: 'none', cursor: 'pointer',
            fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', padding: 0,
          }}
        >
          {Math.round((codeFontSize / 12) * 100)}%
        </button>
        <button
          onClick={() => setMmOn((v) => !v)}
          title="Minimapa del código"
          style={{
            background: 'transparent', border: '1px solid var(--border-light)', borderRadius: 3,
            color: mmOn ? 'var(--text-secondary)' : '#3f3f3f', fontSize: 10, fontFamily: CODE_FONT,
            padding: '2px 6px', cursor: 'pointer', marginRight: 8,
          }}
        >
          minimapa
        </button>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
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
            color: '#555', fontSize: codeFontSize, fontFamily: CODE_FONT,
            userSelect: 'none', borderRight: '1px solid var(--border-color)', background: '#0d0d14',
          }}
        >
          {Array.from({ length: lines }, (_, i) => (
            <div key={i} style={{ height: lineH, lineHeight: `${lineH}px` }}>{i + 1}</div>
          ))}
        </div>

        <div ref={wrapRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <pre
            ref={preRef}
            aria-hidden
            style={{
              position: 'absolute', top: 0, left: 0, margin: 0, border: 0,
              pointerEvents: 'none', userSelect: 'none', willChange: 'transform',
              color: 'var(--text)', ...metrics,
            }}
          >
            {tokens.map((tk, i) => (
              <span key={i} style={{ color: TOKEN_COLOR[tk.type], fontStyle: tk.type === 'comment' ? 'italic' : undefined }}>
                {tk.text}
              </span>
            ))}
            {'\n'}
          </pre>
          <textarea
            ref={taRef}
            value={value}
            onChange={handleChange}
            onScroll={(e) => {
              const gutter = e.currentTarget.parentElement?.querySelector('.code-gutter');
              if (gutter) gutter.scrollTop = e.currentTarget.scrollTop;
              mmSync();
              // El <pre> no scrollea (si no, recortaría las líneas largas):
              // lo movemos con transform para que quede pegado al textarea
              if (preRef.current) {
                preRef.current.style.transform =
                  `translate(${-e.currentTarget.scrollLeft}px, ${-e.currentTarget.scrollTop}px)`;
              }
            }}
            onKeyDown={handleKeyDown}
            wrap="off"
            spellCheck={false}
            placeholder={'// C directo — define script_update(void) para que corra cada frame\n// script_init(void) corre una vez al entrar a la escena'}
            style={{
              position: 'absolute', inset: 0, background: 'transparent', border: 'none',
              outline: 'none', resize: 'none', color: 'transparent', caretColor: 'var(--text)',
              ...metrics,
            }}
          />
        </div>

        {mmOn && (
          <div
            ref={mmRef}
            onPointerDown={(e) => {
              // sin preventDefault el clic saca el foco del textarea y se
              // pierden las teclas justo al usar el minimapa
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              mmDragRef.current = true;
              mmJump(e.clientY);
            }}
            onPointerMove={(e) => { if (mmDragRef.current) mmJump(e.clientY); }}
            onPointerUp={(e) => {
              mmDragRef.current = false;
              e.currentTarget.releasePointerCapture(e.pointerId);
            }}
            title="Minimapa: clic o arrastra para desplazarte"
            style={{
              width: MM_W, flexShrink: 0, position: 'relative', overflow: 'hidden',
              borderLeft: '1px solid var(--border-color)', background: '#0b0b11',
              userSelect: 'none', cursor: 'pointer', touchAction: 'none',
            }}
          >
            <div style={{
              position: 'absolute', top: MM_PAD, left: 8, right: 6,
              display: 'flex', flexDirection: 'column', gap: mmBox.gap,
            }}>
              {mmRows.map((r, i) => (
                <div
                  key={i}
                  style={{
                    height: mmBox.rowH, width: `${r.w * 100}%`, flexShrink: 0,
                    background: r.color, opacity: r.op,
                  }}
                />
              ))}
            </div>
            <div
              ref={mmSliderRef}
              style={{
                position: 'absolute', top: MM_PAD, left: 0, right: 0, height: 40,
                background: 'rgba(255,255,255,0.07)',
                borderLeft: '2px solid var(--accent)', pointerEvents: 'none', display: 'none',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}