import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { HierarchyPanel, type HierarchySection } from '../HierarchyPanel';
import { InspectorPanel, type InspectorSection } from '../InspectorPanel';
import { ResizableEditorLayout } from '../ResizableEditorLayout';

export function DialogoTab() {
  const dialogues = useAppStore((s) => s.dialogues);
  const scenes = useAppStore((s) => s.scenes);
  const selectedNodeId = useAppStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useAppStore((s) => s.setSelectedNodeId);
  const addDialogue = useAppStore((s) => s.addDialogue);
  const removeDialogue = useAppStore((s) => s.removeDialogue);
  const updateDialogue = useAppStore((s) => s.updateDialogue);
  const addPage = useAppStore((s) => s.addPage);
  const removePage = useAppStore((s) => s.removePage);
  const updatePage = useAppStore((s) => s.updatePage);
  const hierarchyWidth = useAppStore((s) => s.hierarchyWidth);
  const inspectorWidth = useAppStore((s) => s.inspectorWidth);
  const setHierarchyWidth = useAppStore((s) => s.setHierarchyWidth);
  const setInspectorWidth = useAppStore((s) => s.setInspectorWidth);

  const [sceneFilter, setSceneFilter] = useState<string>('');

  const filteredDialogues = useMemo(() => {
    if (!sceneFilter) return dialogues;
    return dialogues.filter((d) => d.sceneId === sceneFilter);
  }, [dialogues, sceneFilter]);

  const hierarchySections: HierarchySection[] = [
    {
      id: 'scripts',
      title: 'Scripts',
      items: filteredDialogues.map((d) => {
        const linkedScene = scenes.find((sc) => sc.id === d.sceneId);
        return {
          id: d.id, label: d.name, icon: '💬',
          subtitle: linkedScene ? linkedScene.name : '(sin escena)',
          children: d.pages.map((p, i) => ({
            id: p.id,
            label: p.text ? p.text.slice(0, 28) + (p.text.length > 28 ? '…' : '') : `Pág ${i + 1}`,
            icon: '📄',
          })),
        };
      }),
      onAdd: addDialogue,
    },
  ];

  const selectedDialogue = dialogues.find((d) => d.id === selectedNodeId)
    ?? (selectedNodeId ? dialogues.find((d) => d.pages.some((p) => p.id === selectedNodeId)) : null);

  const selectedPage = selectedNodeId
    ? dialogues.flatMap((d) => d.pages).find((p) => p.id === selectedNodeId)
    : null;

  const parentDialogue = selectedPage
    ? dialogues.find((d) => d.pages.some((p) => p.id === selectedPage.id))
    : selectedDialogue;

  const inspectorSections: InspectorSection[] = [];

  if (selectedDialogue && !selectedPage) {
    inspectorSections.push({
      title: 'Diálogo',
      fields: [
        { label: 'Nombre', type: 'text', value: selectedDialogue.name, onChange: (v) => updateDialogue(selectedDialogue.id, { name: v as string }) },
        {
          label: 'Escena', type: 'select', value: selectedDialogue.sceneId,
          options: [
            { value: '', label: '(sin vínculo)' },
            ...scenes.map((sc) => ({ value: sc.id, label: sc.name })),
          ],
          onChange: (v) => updateDialogue(selectedDialogue.id, { sceneId: v as string }),
        },
      ],
    });
  }

  if (selectedPage) {
    inspectorSections.push({
      title: 'Página',
      fields: [
        { label: 'Texto', type: 'textarea' as const, value: selectedPage.text, onChange: (v) => parentDialogue && updatePage(parentDialogue.id, selectedPage.id, { text: v as string }) },
      ],
    });
    if (selectedPage.choices.length > 0) {
      inspectorSections.push({
        title: 'Opciones',
        fields: selectedPage.choices.map((c, i) => ({
          label: `#${i + 1}`,
          type: 'text' as const,
          value: c.text,
          onChange: (v) => {
            if (!parentDialogue) return;
            const newChoices = [...selectedPage.choices];
            newChoices[i] = { ...c, text: v as string };
            updatePage(parentDialogue.id, selectedPage.id, { choices: newChoices });
          },
        })),
      });
    }
  }

  const handleRemove = (id: string) => {
    const isDialogue = dialogues.some((d) => d.id === id);
    if (isDialogue) removeDialogue(id);
    else {
      for (const d of dialogues) {
        if (d.pages.some((p) => p.id === id)) { removePage(d.id, id); break; }
      }
    }
    if (selectedNodeId === id) setSelectedNodeId('');
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
        <>
          {/* Scene filter chips */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 10px', background: 'var(--bg-panel)',
            borderBottom: '1px solid var(--border-color)',
            flexWrap: 'wrap', flexShrink: 0,
          }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', marginRight: 4 }}>
              Escena:
            </span>
            <button
              onClick={() => setSceneFilter('')}
              style={{
                background: sceneFilter === '' ? 'var(--accent)' : 'var(--bg-raised)',
                border: 'none', borderRadius: 10,
                color: '#fff', fontSize: 10,
                padding: '2px 10px', cursor: 'pointer',
              }}
            >
              Todas
            </button>
            {scenes.map((sc) => (
              <button
                key={sc.id}
                onClick={() => setSceneFilter(sc.id === sceneFilter ? '' : sc.id)}
                style={{
                  background: sceneFilter === sc.id ? 'var(--accent)' : 'var(--bg-raised)',
                  border: 'none', borderRadius: 10,
                  color: 'var(--text-secondary)', fontSize: 10,
                  padding: '2px 10px', cursor: 'pointer',
                }}
              >
                {sc.name}
              </button>
            ))}
            {sceneFilter && (
              <span style={{ color: 'var(--text-muted)', fontSize: 9, marginLeft: 4 }}>
                ({filteredDialogues.length} diálogos)
              </span>
            )}
          </div>

          {/* Editor */}
          <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
            {selectedPage ? (
              <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Dialogue bubble preview */}
                <div style={{
                  background: 'var(--bg-panel)', border: '1px solid var(--bg-raised)',
                  borderRadius: 12, padding: '16px 20px', minHeight: 80,
                }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: 9, textTransform: 'uppercase', marginBottom: 8 }}>
                    Vista previa
                  </div>
                  <div style={{ color: 'var(--text)', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {selectedPage.text || (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Escribe el diálogo en el inspector...</span>
                    )}
                  </div>
                  {selectedPage.choices.length > 0 && (
                    <div style={{ marginTop: 12, borderTop: '1px solid var(--bg-raised)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {selectedPage.choices.map((c, i) => (
                        <div key={i} style={{
                          padding: '6px 12px', background: 'var(--bg-raised)',
                          borderRadius: 6, color: 'var(--accent-light)', fontSize: 12,
                        }}>
                          → {c.text || `Opción ${i + 1}`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick choice editor */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>Opciones</span>
                    <button
                      onClick={() => {
                        if (!parentDialogue) return;
                        const newChoices = [...(selectedPage.choices || [])];
                        newChoices.push({ text: '', nextPageId: '' });
                        updatePage(parentDialogue.id, selectedPage.id, { choices: newChoices });
                      }}
                      style={{
                        background: 'var(--accent)', border: 'none', borderRadius: 3,
                        color: '#fff', width: 20, height: 20, fontSize: 13,
                        fontWeight: 700, cursor: 'pointer', lineHeight: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      +
                    </button>
                  </div>
                  {(selectedPage.choices ?? []).map((c, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        placeholder={`Opción ${i + 1}...`}
                        value={c.text}
                        onChange={(e) => {
                          if (!parentDialogue) return;
                          const newChoices = [...selectedPage.choices];
                          newChoices[i] = { ...c, text: e.target.value };
                          updatePage(parentDialogue.id, selectedPage.id, { choices: newChoices });
                        }}
                        style={{
                          flex: 1, background: 'var(--bg-dark)', border: '1px solid var(--bg-raised)',
                          borderRadius: 4, color: 'var(--text)', fontSize: 12,
                          padding: '5px 8px', outline: 'none',
                        }}
                      />
                      <button
                        onClick={() => {
                          if (!parentDialogue) return;
                          updatePage(parentDialogue.id, selectedPage.id, {
                            choices: selectedPage.choices.filter((_, j) => j !== i),
                          });
                        }}
                        style={{
                          background: 'transparent', border: 'none',
                          color: 'var(--red)', cursor: 'pointer', fontSize: 14,
                          fontWeight: 700, padding: '2px 6px',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : selectedDialogue ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>
                Selecciona una página para editar
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>
                Crea o selecciona un diálogo
              </div>
            )}
          </div>
        </>
      }
      right={
        <InspectorPanel
          title="Inspector"
          sections={inspectorSections}
          emptyMessage="Selecciona un diálogo o página"
        />
      }
    />
  );
}