import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { HierarchyPanel, type HierarchySection } from '../HierarchyPanel';
import { HierarchyContextMenu } from '../HierarchyContextMenu';
import { InspectorPanel, type InspectorSection } from '../InspectorPanel';
import { ResizableEditorLayout } from '../ResizableEditorLayout';
import { EmptyState } from '../EmptyState';
import { ValidatedNameInput } from '../ValidatedNameInput';
import { validateItemName } from '../../../utils/validateName';
import { MessageSquareIcon, FileTextIcon, PlusIcon, XIcon, CopyIcon } from './icons';
import { FontModal } from '../FontModal';
import { SoundIcon } from './SoundTab';
import type { DialogueEntry, DialogueRow } from '../../../types/editor';

// Acepta solo caracteres "básicos": letras, números, espacios y signos
// comunes. Rechaza emojis y cualquier carácter fuera del conjunto permitido.
const BASIC_RE = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü0-9 _.,:;!?()\[\]{}\-+*/&%#'"@]*$/;
function sanitizeBasic(v: string): string {
  let out = '';
  for (const ch of v) {
    if (BASIC_RE.test(ch)) out += ch;
  }
  return out;
}

const MAX_LANGUAGES = 6;
const COMMON_LANGS = ['ES', 'EN', 'FR', 'DE', 'IT', 'PT', 'JA', 'KO', 'ZH', 'RU'];

export function DialogoTab() {
  const dialogues = useAppStore((s) => s.dialogues);
  const scenes = useAppStore((s) => s.scenes);
  const sounds = useAppStore((s) => s.sounds);
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useAppStore((s) => s.setSelectedNodeId);
  const addDialogue = useAppStore((s) => s.addDialogue);
  const removeDialogue = useAppStore((s) => s.removeDialogue);
  const updateDialogue = useAppStore((s) => s.updateDialogue);
  const addRow = useAppStore((s) => s.addRow);
  const updateRow = useAppStore((s) => s.updateRow);
  const removeRow = useAppStore((s) => s.removeRow);
  const addLanguage = useAppStore((s) => s.addLanguage);
  const removeLanguage = useAppStore((s) => s.removeLanguage);
  const hierarchyWidth = useAppStore((s) => s.hierarchyWidth);
  const inspectorWidth = useAppStore((s) => s.inspectorWidth);
  const setHierarchyWidth = useAppStore((s) => s.setHierarchyWidth);
  const setInspectorWidth = useAppStore((s) => s.setInspectorWidth);

  const [langInput, setLangInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showLangInput, setShowLangInput] = useState(false);
  const [showFontModal, setShowFontModal] = useState(false);
  const fonts = useAppStore((s) => s.fonts);
  const sectionRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null);
  const cellRefs = useRef<(HTMLInputElement | HTMLTextAreaElement | null)[][]>([]);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [ctxMenu, setCtxMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const pushToast = useAppStore((s) => s.pushToast);

  const handleRenameDialogue = useCallback((id: string, name: string): boolean => {
    if (!dialogues.some((d) => d.id === id)) return false;
    const err = validateItemName(name, dialogues.filter((d) => d.id !== id).map((d) => d.name));
    if (err) { pushToast(err); return false; }
    updateDialogue(id, { name: name.trim() });
    return true;
  }, [dialogues, pushToast, updateDialogue]);

  const handleAddDialogue = useCallback(() => {
    const id = addDialogue();
    if (!id) return;
    setSelectedNodeId(id);
    setEditingId(id);
  }, [addDialogue, setSelectedNodeId]);

  // Idiomas compartidos: se mantienen sincronizados entre diálogos.
  const sharedLanguages = dialogues.length > 0 ? (dialogues[0].languages ?? ['ES']) : ['ES'];

  // Diálogo seleccionado (o padre de la fila seleccionada)
  const selectedDialogue = useMemo(() => {
    if (!selectedNodeId) return null;
    const d = dialogues.find((d) => d.id === selectedNodeId);
    if (d) return d;
    return dialogues.find((d) => d.rows.some((r) => r.id === selectedNodeId)) ?? null;
  }, [dialogues, selectedNodeId]);

  const selectedRow = useMemo(() => {
    if (!selectedNodeId || !selectedDialogue) return null;
    return selectedDialogue.rows.find((r) => r.id === selectedNodeId) ?? null;
  }, [selectedDialogue, selectedNodeId]);

  const hierarchySections: HierarchySection[] = [
    {
      id: 'dialogos',
      title: 'DIÁLOGOS',
      items: dialogues.map((d) => ({
        id: d.id,
        label: d.name,
        icon: <MessageSquareIcon size={13} />,
        subtitle: `${d.rows.length} filas`,
      })),
      onAdd: handleAddDialogue,
    },
  ];

  const inputStyle: React.CSSProperties = {
    background: 'transparent', border: 'none', borderRadius: 0,
    color: 'var(--text)', fontSize: 11, padding: '2px 4px', outline: 'none', width: '100%',
    boxSizing: 'border-box',
  };

  const thStyle: React.CSSProperties = {
    padding: '4px 6px', fontSize: 9, fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.4px',
    border: '1px solid var(--border-color)', background: 'var(--bg-canvas)',
    position: 'sticky', top: 0, zIndex: 2, textAlign: 'left', whiteSpace: 'nowrap',
  };
  const tdStyle: React.CSSProperties = {
    padding: '2px 4px', border: '1px solid var(--border-color)', verticalAlign: 'top',
    background: 'transparent',
  };

  const handleAddLanguage = (code: string) => {
    const c = (code || '').trim().toUpperCase();
    if (!c || sharedLanguages.includes(c) || sharedLanguages.length >= MAX_LANGUAGES) return;
    // se aplica a todos los diálogos para mantener las columnas sincronizadas
    dialogues.forEach((d) => addLanguage(d.id, c));
    setLangInput('');
    setShowLangInput(false);
  };

  const handleRemoveLanguage = (lang: string) => {
    if (sharedLanguages.length <= 1) return;
    dialogues.forEach((d) => removeLanguage(d.id, lang));
  };

  const handleRemoveRow = (dlg: DialogueEntry, rowId: string) => {
    removeRow(dlg.id, rowId);
    if (selectedNodeId === rowId) setSelectedNodeId(dlg.id);
  };

  const scrollToSection = (id: string) => {
    setSelectedNodeId(id);
    const el = sectionRefs.current[id];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ── Inspector ──
  const inspectorSections: InspectorSection[] = [];

  if (selectedDialogue) {
    if (selectedRow) {
      const row = selectedRow;
      inspectorSections.push({
        title: 'Fila',
        content: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 56 }}>ID</span>
              <span style={{ color: 'var(--text)', fontSize: 11, fontFamily: 'monospace' }}>{row.id}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 56 }}>Código</span>
              <input type="text" value={row.code}
                onChange={(e) => updateRow(selectedDialogue.id, row.id, { code: sanitizeBasic(e.target.value) })}
                onInput={(e) => updateRow(selectedDialogue.id, row.id, { code: sanitizeBasic((e.target as HTMLInputElement).value) })}
                style={{ flex: 1, background: '#141420', border: '1px solid var(--border-light)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '3px 6px', outline: 'none' }}
                placeholder="comando..." />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 56 }}>Nombre</span>
              <input type="text" value={row.speaker}
                onChange={(e) => updateRow(selectedDialogue.id, row.id, { speaker: sanitizeBasic(e.target.value) })}
                onInput={(e) => updateRow(selectedDialogue.id, row.id, { speaker: sanitizeBasic((e.target as HTMLInputElement).value) })}
                style={{ flex: 1, background: '#141420', border: '1px solid var(--border-light)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '3px 6px', outline: 'none' }}
                placeholder="Hablante..." />
            </div>
            {sharedLanguages.map((lang) => (
              <div key={lang} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{lang}</span>
                <textarea
                  value={row.text[lang] ?? ''}
                  onChange={(e) => updateRow(selectedDialogue.id, row.id, { text: { ...row.text, [lang]: sanitizeBasic(e.target.value) } })}
                  onInput={(e) => updateRow(selectedDialogue.id, row.id, { text: { ...row.text, [lang]: sanitizeBasic((e.target as HTMLTextAreaElement).value) } })}
                  rows={3}
                  style={{ background: '#141420', border: '1px solid var(--border-light)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '3px 6px', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--border-light)', margin: '4px 0' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 56 }}>Sonido</span>
              <select value={row.soundId ?? ''}
                onChange={(e) => updateRow(selectedDialogue.id, row.id, { soundId: e.target.value || undefined })}
                style={{ flex: 1, background: '#141420', border: '1px solid var(--border-light)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '3px 6px', outline: 'none' }}
              >
                <option value="">(ninguno)</option>
                {sounds.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 56 }}>Fuente</span>
              <select value={row.fontId ?? ''}
                onChange={(e) => updateRow(selectedDialogue.id, row.id, { fontId: e.target.value || undefined })}
                style={{ flex: 1, background: '#141420', border: '1px solid var(--border-light)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '3px 6px', outline: 'none' }}
              >
                <option value="">(por defecto)</option>
                {fonts.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <button onClick={() => setShowFontModal(true)}
                style={{ background: 'var(--accent)', border: 'none', borderRadius: 4, color: '#fff', fontSize: 11, fontWeight: 700, width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Crear/editar fuentes"
              >+</button>
            </div>
            <button onClick={() => { removeRow(selectedDialogue.id, row.id); setSelectedNodeId(selectedDialogue.id); }}
              style={{
                width: '100%', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
                borderRadius: 4, color: '#f87171', fontSize: 11, padding: '6px 12px', cursor: 'pointer', marginTop: 4,
              }}
            >
              Eliminar fila
            </button>
          </div>
        ),
      });
    } else {
      inspectorSections.push({
        title: 'Diálogo',
        content: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 56 }}>Nombre</span>
              <ValidatedNameInput
                value={selectedDialogue.name}
                onChange={(name) => updateDialogue(selectedDialogue.id, { name: sanitizeBasic(name) })}
                others={dialogues.filter((d) => d.id !== selectedDialogue.id).map((d) => d.name)}
                inputRef={nameInputRef}
                style={{ flex: 1, background: '#141420', border: '1px solid var(--border-light)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '3px 6px', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 56 }}>Escena</span>
              <select value={selectedDialogue.sceneId}
                onChange={(e) => updateDialogue(selectedDialogue.id, { sceneId: e.target.value })}
                style={{ flex: 1, background: '#141420', border: '1px solid var(--border-light)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '3px 6px', outline: 'none' }}
              >
                <option value="">(sin vínculo)</option>
                {scenes.map((sc) => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 11, minWidth: 56 }}>Idiomas</span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
                {sharedLanguages.map((lang) => (
                  <span key={lang} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    background: 'var(--bg-raised)', borderRadius: 4, padding: '2px 6px',
                    fontSize: 10, color: 'var(--text)',
                  }}>
                    {lang}
                    {sharedLanguages.length > 1 && (
                      <span onClick={() => handleRemoveLanguage(lang)}
                        style={{ cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}>×</span>
                    )}
                  </span>
                ))}
                {sharedLanguages.length < MAX_LANGUAGES && (
                  showLangInput ? (
                    <input
                      autoFocus
                      value={langInput}
                      onChange={(e) => setLangInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddLanguage(langInput);
                        if (e.key === 'Escape') { setShowLangInput(false); setLangInput(''); }
                      }}
                      onBlur={() => { if (langInput.trim()) handleAddLanguage(langInput); else setShowLangInput(false); }}
                      placeholder="+"
                      style={{ width: 36, background: '#141420', border: '1px solid var(--border-light)', borderRadius: 4, color: 'var(--text)', fontSize: 11, padding: '2px 6px', outline: 'none', textAlign: 'center', textTransform: 'uppercase' }}
                    />
                  ) : (
                    <span onClick={() => setShowLangInput(true)}
                      style={{ cursor: 'pointer', background: 'var(--bg-raised)', borderRadius: 4, padding: '2px 8px', fontSize: 11, color: 'var(--text-muted)' }}>
                      +
                    </span>
                  )
                )}
              </div>
            </div>
            <button onClick={() => { removeDialogue(selectedDialogue.id); setSelectedNodeId(''); }}
              style={{
                width: '100%', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
                borderRadius: 4, color: '#f87171', fontSize: 11, padding: '6px 12px', cursor: 'pointer', marginTop: 4,
              }}
            >
              Eliminar diálogo
            </button>
          </div>
        ),
      });
    }
  }

  const handleImportCsv = async () => {
    const api = window.advanceAPI;
    if (!api) return;
    let dlg = selectedDialogue;
    if (!dlg) {
      addDialogue();
      await new Promise((r) => setTimeout(r, 0));
      const fresh = useAppStore.getState().dialogues;
      dlg = fresh[fresh.length - 1];
      if (dlg) setSelectedNodeId(dlg.id);
    }
    if (!dlg) return;
    const result = await (api as any).dialog.openCsv();
    if (!result?.path) return;
    const read = await api.file.readText(result.path);
    if (!read?.success || !read.data) return;
    const lines = read.data.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return;
    const header = lines[0].split(',').map((h) => h.trim());
    // header: code, speaker, ES, ING, ...
    const langCols = header.slice(2);
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const code = (cols[0] ?? '').trim();
      const speaker = (cols[1] ?? '').trim();
      const text: Record<string, string> = {};
      langCols.forEach((lang, li) => {
        text[lang] = (cols[2 + li] ?? '').trim();
      });
      // ensure languages exist
      langCols.forEach((lang) => {
        if (!sharedLanguages.includes(lang)) {
          dialogues.forEach((d) => addLanguage(d.id, lang));
        }
      });
      addRow(dlg.id);
      // update the last row (leer estado fresco)
      const freshDlg = useAppStore.getState().dialogues.find((d) => d.id === dlg.id);
      if (freshDlg && freshDlg.rows.length > 0) {
        const lastRow = freshDlg.rows[freshDlg.rows.length - 1];
        updateRow(dlg.id, lastRow.id, { code, speaker, text });
      }
    }
  };

  const handleRemove = (id: string) => {
    const isDialogue = dialogues.some((d) => d.id === id);
    if (isDialogue) removeDialogue(id);
    else {
      for (const d of dialogues) {
        if (d.rows.some((r) => r.id === id)) { removeRow(d.id, id); break; }
      }
    }
    if (selectedNodeId === id) setSelectedNodeId('');
  };

  return (
    <>
    <ResizableEditorLayout
      leftWidth={hierarchyWidth}
      rightWidth={inspectorWidth}
      onLeftWidthChange={setHierarchyWidth}
      onRightWidthChange={setInspectorWidth}
      left={
        <HierarchyPanel
          sections={hierarchySections}
          selectedId={selectedNodeId}
          editingId={editingId}
          onSelect={scrollToSection}
          onRename={handleRenameDialogue}
          onNameError={(msg) => pushToast(msg)}
          onEditingChange={setEditingId}
          onDoubleClick={(id) => {
            const isDialogue = dialogues.some((d) => d.id === id);
            if (isDialogue) setEditingId(id);
          }}
          onRemove={handleRemove}
          onContextMenu={(id, x, y) => {
            if (dialogues.some((d) => d.id === id)) setCtxMenu({ id, x, y });
          }}
        />
      }
      center={
        dialogues.length === 0 ? (
          <EmptyState
            icon={<MessageSquareIcon size={40} />}
            title="Sin diálogos"
            hint="Crea un diálogo desde el botón + de la jerarquía."
          />
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-canvas)', minHeight: 0, overflow: 'hidden' }}>
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
                <span style={{ color: 'var(--text)', fontSize: 10, fontWeight: 700, padding: '0 6px' }}>
                  {dialogues.length} diálogo{dialogues.length !== 1 ? 's' : ''} · {dialogues.reduce((a, d) => a + d.rows.length, 0)} filas
                </span>
                <div style={{ width: 1, height: 14, background: 'var(--bg-raised)', margin: '0 2px' }} />
                <span style={{ color: 'var(--text-muted)', fontSize: 9, padding: '0 4px' }}>
                  {sharedLanguages.join(' · ')}
                </span>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                {sharedLanguages.length < MAX_LANGUAGES && (
                  showLangInput ? (
                    <input
                      autoFocus
                      value={langInput}
                      onChange={(e) => setLangInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddLanguage(langInput);
                        if (e.key === 'Escape') { setShowLangInput(false); setLangInput(''); }
                      }}
                      onBlur={() => { if (langInput.trim()) handleAddLanguage(langInput); else setShowLangInput(false); }}
                      placeholder="+ idioma"
                      style={{ width: 70, background: '#141420', border: '1px solid var(--border-light)', borderRadius: 4, color: 'var(--text)', fontSize: 10, padding: '2px 6px', outline: 'none', textAlign: 'center', textTransform: 'uppercase' }}
                    />
                  ) : (
                    <button onClick={() => setShowLangInput(true)}
                      style={{ background: 'var(--bg-raised)', border: 'none', borderRadius: 4, color: 'var(--text-muted)', fontSize: 10, padding: '3px 8px', cursor: 'pointer', fontWeight: 600 }}
                    >
                      + Idioma
                    </button>
                  )
                )}
                <button onClick={handleImportCsv}
                  style={{ background: 'var(--bg-raised)', border: 'none', borderRadius: 4, color: 'var(--text-muted)', fontSize: 10, padding: '3px 8px', cursor: 'pointer', fontWeight: 600 }}
                  title="Cargar filas desde CSV (code,speaker,ES,ING,...)"
                >
                  Cargar CSV
                </button>
                <button onClick={handleAddDialogue}
                  style={{ background: 'var(--accent)', border: 'none', borderRadius: 4, color: '#fff', fontSize: 10, padding: '3px 8px', cursor: 'pointer', fontWeight: 600 }}
                >
                  + Diálogo
                </button>
              </div>
            </div>

            {/* Tabla única con secciones */}
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}
              onKeyDown={(e) => {
                if (!focusedCell) return;
                const numCols = 3 + sharedLanguages.length;
                const numRows = dialogues.reduce((a, d) => a + d.rows.length, 0);
                if (numRows === 0) return;
                let { row, col } = focusedCell;
                let handled = true;
                if (e.key === 'ArrowRight') col = Math.min(col + 1, numCols - 1);
                else if (e.key === 'ArrowLeft') col = Math.max(col - 1, 0);
                else if (e.key === 'ArrowDown') row = Math.min(row + 1, numRows - 1);
                else if (e.key === 'ArrowUp') row = Math.max(row - 1, 0);
                else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (col < numCols - 1) col += 1;
                  else if (row < numRows - 1) { row += 1; col = 0; }
                  else { row = 0; col = 0; }
                } else if (e.key === 'Tab') {
                  e.preventDefault();
                  if (e.shiftKey) {
                    if (col > 0) col -= 1; else if (row > 0) { row -= 1; col = numCols - 1; }
                  } else {
                    if (col < numCols - 1) col += 1; else if (row < numRows - 1) { row += 1; col = 0; }
                  }
                } else handled = false;
                if (!handled) return;
                if (row === focusedCell.row && col === focusedCell.col) { e.preventDefault(); return; }
                e.preventDefault();
                // seleccionar la fila a la que nos movimos (para el inspector)
                let acc = 0;
                for (const dlg of dialogues) {
                  if (row < acc + dlg.rows.length) {
                    const r = dlg.rows[row - acc];
                    if (r) setSelectedNodeId(r.id);
                    break;
                  }
                  acc += dlg.rows.length;
                }
                const target = cellRefs.current[row]?.[col];
                if (target) { target.focus(); setFocusedCell({ row, col }); }
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: 170 }}>ID</th>
                    <th style={{ ...thStyle, width: 110 }}>Código</th>
                    <th style={{ ...thStyle, width: 110 }}>Nombre</th>
                    {sharedLanguages.map((lang) => (
                      <th key={lang} style={{ ...thStyle, minWidth: 140 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {lang}
                          {sharedLanguages.length > 1 && (
                            <button onClick={(e) => { e.stopPropagation(); handleRemoveLanguage(lang); }}
                              title={`Quitar ${lang}`}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 9, lineHeight: 1, opacity: 0.6, padding: 0 }}
                            >×</button>
                          )}
                        </span>
                      </th>
                    ))}
                    {sharedLanguages.length < MAX_LANGUAGES && (
                      <th style={{ ...thStyle, width: 32, padding: 2, textAlign: 'center' }}>
                        <input
                          value={langInput}
                          onChange={(e) => setLangInput(e.target.value.toUpperCase())}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && langInput.trim()) { handleAddLanguage(langInput); }
                            if (e.key === 'Escape') { setLangInput(''); }
                          }}
                          placeholder="+"
                          title="Escribe el código del idioma y pulsa Enter"
                          style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 9, textAlign: 'center', outline: 'none' }}
                        />
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let gIdx = 0;
                    return dialogues.map((dlg) => (
                    <React.Fragment key={dlg.id}>
                      {/* Cabecera de sección */}
                      <tr ref={(el) => { sectionRefs.current[dlg.id] = el; }}
                        onClick={() => setSelectedNodeId(dlg.id)}
                        style={{ background: '#000000', cursor: 'pointer' }}
                      >
                        <td colSpan={3 + sharedLanguages.length + 1}
                          style={{ padding: '4px 8px', border: '1px solid var(--border-color)', fontWeight: 700, color: 'var(--accent-lighter)', fontSize: 11, letterSpacing: '0.3px' }}
                        >
                          {dlg.name}
                          <span style={{ color: 'var(--accent-light)', fontWeight: 400, fontSize: 9, marginLeft: 8 }}>
                            ({dlg.rows.length} filas · {dlg.languages.join(', ')})
                          </span>
                          <span onClick={(e) => { e.stopPropagation(); addRow(dlg.id); }}
                            style={{ float: 'right', cursor: 'pointer', color: 'var(--accent-light)', fontSize: 10, fontWeight: 600 }}
                            title="Añadir fila"
                          >
                            + Fila
                          </span>
                        </td>
                      </tr>
                      {dlg.rows.map((row, idx) => {
                        const gi = gIdx++;
                        const isSelected = selectedNodeId === row.id;
                        const parts = row.id.split('-');
                        const prefix = parts.length >= 3 ? parts.slice(0, 2).join('-') + '-' : row.id;
                        const suffix = parts.length >= 3 ? parts.slice(2).join('-') : '';
                        return (
                          <tr key={gi}
                            onClick={() => setSelectedNodeId(row.id)}
                            style={{
                              background: isSelected ? 'rgba(124,92,240,0.22)' : (idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'),
                              cursor: 'pointer',
                            }}
                          >
                            <td style={{ padding: '2px 4px', border: '1px solid var(--border-color)', verticalAlign: 'top' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: 10, whiteSpace: 'nowrap', userSelect: 'text' }} title={row.id}>{prefix}</span>
                                <input
                                  ref={(el) => { if (!cellRefs.current[gi]) cellRefs.current[gi] = []; cellRefs.current[gi][0] = el; }}
                                  value={suffix}
                                  onFocus={() => setFocusedCell({ row: gi, col: 0 })}
                                  onChange={(e) => {
                                    const newSuffix = sanitizeBasic(e.target.value);
                                    const newId = `${prefix}${newSuffix}`;
                                    updateRow(dlg.id, row.id, { id: newId });
                                    if (selectedNodeId === row.id) setSelectedNodeId(newId);
                                  }}
                                  onInput={(e) => {
                                    const newSuffix = sanitizeBasic((e.target as HTMLInputElement).value);
                                    const newId = `${prefix}${newSuffix}`;
                                    updateRow(dlg.id, row.id, { id: newId });
                                    if (selectedNodeId === row.id) setSelectedNodeId(newId);
                                  }}
                                  style={{ background: 'transparent', border: 'none', borderRadius: 0, color: 'var(--text)', fontSize: 10, padding: '2px 4px', outline: 'none', flex: 1, minWidth: 0, boxSizing: 'border-box' }}
                                  placeholder="sufijo"
                                  title={row.id}
                                />
                                <button
                                  onClick={(e) => { e.stopPropagation(); if (navigator.clipboard) void navigator.clipboard.writeText(row.id); }}
                                  title="Copiar ID"
                                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                                ><CopyIcon size={11} /></button>
                              </div>
                            </td>
                            <td style={{ padding: '2px 4px', border: '1px solid var(--border-color)', verticalAlign: 'top' }}>
                              <input value={row.code}
                                ref={(el) => { if (!cellRefs.current[gi]) cellRefs.current[gi] = []; cellRefs.current[gi][1] = el; }}
                                onFocus={() => setFocusedCell({ row: gi, col: 1 })}
                                onChange={(e) => updateRow(dlg.id, row.id, { code: sanitizeBasic(e.target.value) })}
                                onInput={(e) => updateRow(dlg.id, row.id, { code: sanitizeBasic((e.target as HTMLInputElement).value) })}
                                style={{ background: 'transparent', border: 'none', borderRadius: 0, color: 'var(--text)', fontSize: 10, padding: '2px 4px', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                                placeholder="code..." />
                            </td>
                            <td style={{ padding: '2px 4px', border: '1px solid var(--border-color)', verticalAlign: 'top' }}>
                              <input value={row.speaker}
                                ref={(el) => { if (!cellRefs.current[gi]) cellRefs.current[gi] = []; cellRefs.current[gi][2] = el; }}
                                onFocus={() => setFocusedCell({ row: gi, col: 2 })}
                                onChange={(e) => updateRow(dlg.id, row.id, { speaker: sanitizeBasic(e.target.value) })}
                                onInput={(e) => updateRow(dlg.id, row.id, { speaker: sanitizeBasic((e.target as HTMLInputElement).value) })}
                                style={{ background: 'transparent', border: 'none', borderRadius: 0, color: 'var(--text)', fontSize: 10, padding: '2px 4px', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                                placeholder="nombre..." />
                            </td>
                            {sharedLanguages.map((lang, li) => (
                              <td key={lang} style={{ padding: '2px 4px', border: '1px solid var(--border-color)', verticalAlign: 'top' }}>
                                <textarea
                                  ref={(el) => { if (!cellRefs.current[gi]) cellRefs.current[gi] = []; cellRefs.current[gi][3 + li] = el; }}
                                  value={row.text[lang] ?? ''}
                                  onFocus={() => setFocusedCell({ row: gi, col: 3 + li })}
                                  onChange={(e) => updateRow(dlg.id, row.id, { text: { ...row.text, [lang]: sanitizeBasic(e.target.value) } })}
                                  onInput={(e) => updateRow(dlg.id, row.id, { text: { ...row.text, [lang]: sanitizeBasic((e.target as HTMLTextAreaElement).value) } })}
                                  rows={2}
                                  style={{ background: 'transparent', border: 'none', borderRadius: 0, color: 'var(--text)', fontSize: 10, padding: '2px 4px', outline: 'none', resize: 'vertical', minHeight: 32, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }}
                                  placeholder={lang}
                                />
                              </td>
                            ))}
                            <td style={{ padding: '2px 4px', border: '1px solid var(--border-color)', verticalAlign: 'top', textAlign: 'center' }}>
                              <span onClick={(e) => { e.stopPropagation(); handleRemoveRow(dlg, row.id); }}
                                style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, lineHeight: 1 }}>×</span>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ));
                  })()}
                </tbody>
              </table>
              {dialogues.every((d) => d.rows.length === 0) && (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 11 }}>
                  Sin filas. Pulsa "+ Fila" en una sección para añadir la primera.
                </div>
              )}
            </div>
          </div>
        )
      }
      right={
        <InspectorPanel
          title="Inspector"
          sections={inspectorSections}
          emptyMessage="Selecciona un diálogo o fila"
        />
      }
    />
    {showFontModal && <FontModal onClose={() => { setShowFontModal(false); void useAppStore.getState().saveProject(); }} />}
    {ctxMenu && (
      <HierarchyContextMenu
        x={ctxMenu.x}
        y={ctxMenu.y}
        onRename={() => setEditingId(ctxMenu.id)}
        onDelete={() => { removeDialogue(ctxMenu.id); if (selectedNodeId === ctxMenu.id) setSelectedNodeId(''); }}
        deleteLabel="Eliminar diálogo"
        onClose={() => setCtxMenu(null)}
      />
    )}
    </>
  );
}
