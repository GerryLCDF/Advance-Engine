import React from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { CartuchoPanel } from '../components/CartuchoPanel';
import { TEMPLATES } from '../types';
import type { TemplateId } from '../types';

export function CrearScreen() {
  const { draftName, draftAuthor, draftPath, draftTemplate, draftCoverPath, setDraft, resetDraft } =
    useAppStore();
  const addProject = useAppStore((s) => s.addProject);
  const setActiveScreen = useAppStore((s) => s.setActiveScreen);

  const handleBrowse = async () => {
    const api = (window as any).advanceAPI;
    if (api) {
      const folder: string | null = await api.dialog.openFolder();
      if (folder) setDraft({ draftPath: folder });
    }
  };

  const handleCrear = async () => {
    if (!draftName.trim()) return;
    const project = await addProject({
      name: draftName.trim(),
      author: draftAuthor.trim(),
      path: draftPath.trim(),
      template: draftTemplate,
      coverPath: draftCoverPath,
    });
    if (project) {
      try {
        // Copy cover image to project folder if present
        if (draftCoverPath && !draftCoverPath.startsWith('/')) {
          const api = window.advanceAPI;
          if (api?.file?.copyCover) {
            const result = await api.file.copyCover(draftCoverPath, project.path);
            if (result.success && result.destPath) {
              const st = useAppStore.getState();
              await st.updateProject(project.id, { coverPath: result.destPath });
              project.coverPath = result.destPath;
            }
          }
        }

        const api = window.advanceAPI;
        if (api?.project?.save) {
          const result = await api.project.save(project.id, {
            name: project.name,
            state: {
              scenes: [],
              sceneConnections: [],
              backgrounds: [],
              sprites: [],
              songs: [],
              sounds: [],
              dialogues: [],
              scripts: [],
            },
          });
          if (result.success && result.path) {
            useAppStore.getState().setProjectDir(result.path);
            console.log('[Crear] Carpeta creada en:', result.path);
          } else {
            console.error('[Crear] Error al guardar:', result.reason);
          }
        }
      } catch (err) {
        console.error('[Crear] Excepción:', err);
      }
      // Limpiar estado del editor y del draft
      useAppStore.getState().resetEditorState();
      resetDraft();
      setActiveScreen({ type: 'editor', projectId: project.id });
    }
  };

  const handleModificarCartucho = () => {
    // Para crear, usamos un ID temporal vacío — ModificarPortada trabaja con el draft
    setActiveScreen({ type: 'modificar-portada', projectId: '__draft__' });
  };

  return (
    <motion.div
      key="crear"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{ flex: 1, display: 'flex', overflow: 'hidden' }}
    >
      {/* Panel izquierdo */}
      <CartuchoPanel
        name={draftName}
        template={draftTemplate}
        coverPath={draftCoverPath}
        onModificarCartucho={handleModificarCartucho}
      />

      {/* Panel derecho */}
      <div
        style={{
          flex: 1,
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          overflowY: 'auto',
        }}
      >
        <Field label="Nombre:">
          <input
            className="ae-input"
            placeholder="Nombre del proyecto"
            value={draftName}
            onChange={(e) => setDraft({ draftName: e.target.value })}
          />
        </Field>

        <Field label="Ruta:">
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="ae-input"
              style={{ flex: 1 }}
              placeholder="c/Ruta/user"
              value={draftPath}
              onChange={(e) => setDraft({ draftPath: e.target.value })}
              readOnly
            />
            <button className="ae-btn-ghost" onClick={handleBrowse} title="Examinar">
              ...
            </button>
          </div>
        </Field>

        <Field label="Plantillas">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {TEMPLATES.map((t) => (
              <TemplateThumbnail
                key={t.id}
                id={t.id}
                label={t.label}
                file={t.file}
                selected={draftTemplate === t.id}
                onSelect={() => setDraft({ draftTemplate: t.id as TemplateId })}
              />
            ))}
          </div>
        </Field>

        <div style={{ flex: 1 }} />

        <motion.button
          onClick={handleCrear}
          disabled={!draftName.trim()}
          whileHover={draftName.trim() ? { scale: 1.03, background: '#3dba60' } : {}}
          whileTap={draftName.trim() ? { scale: 0.97 } : {}}
          style={{
            background: draftName.trim() ? '#2ea84a' : '#444',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
            padding: '10px',
            cursor: draftName.trim() ? 'pointer' : 'not-allowed',
            width: '100%',
          }}
        >
          Crear
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── Sub-componentes internos ─────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ color: 'var(--text)', fontSize: 16, fontWeight: 700 }}>{label}</span>
      {children}
    </div>
  );
}

function TemplateThumbnail({
  id,
  label,
  file,
  selected,
  onSelect,
}: {
  id: string;
  label: string;
  file: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.div
      onClick={onSelect}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.95 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          width: 72,
          height: 54,
          borderRadius: 6,
          border: selected ? '2px solid var(--accent-light)' : '2px solid var(--border-color)',
          overflow: 'hidden',
          background: 'var(--bg-dark)',
          transition: 'border-color 0.15s',
        }}
      >
        <img
          src={file}
          alt={label}
          style={{ width: '100%', height: '100%', objectFit: 'cover', imageRendering: 'pixelated' }}
        />
      </div>
      <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{label}</span>
    </motion.div>
  );
}
