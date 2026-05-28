import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { CartuchoPanel } from '../components/CartuchoPanel';

interface EditarScreenProps {
  projectId: string;
}

export function EditarScreen({ projectId }: EditarScreenProps) {
  const { draftName, draftAuthor, draftPath, draftTemplate, draftCoverPath, setDraft } =
    useAppStore();
  const updateProject = useAppStore((s) => s.updateProject);
  const deleteProject = useAppStore((s) => s.deleteProject);
  const setActiveScreen = useAppStore((s) => s.setActiveScreen);

  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleBrowse = async () => {
    const api = (window as any).advanceAPI;
    if (api) {
      const folder: string | null = await api.dialog.openFolder();
      if (folder) setDraft({ draftPath: folder });
    }
  };

  const handleGuardar = async () => {
    if (!draftName.trim()) return;
    await updateProject(projectId, {
      name: draftName.trim(),
      author: draftAuthor.trim(),
      path: draftPath.trim(),
      template: draftTemplate,
      coverPath: draftCoverPath,
    });
    setActiveScreen({ type: 'launcher' });
  };

  const handleEliminar = async () => {
    await deleteProject(projectId);
    setActiveScreen({ type: 'launcher' });
  };

  const handleModificarCartucho = () => {
    setActiveScreen({ type: 'modificar-portada', projectId });
  };

  return (
    <motion.div
      key={`editar-${projectId}`}
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.22 }}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        zIndex: 10,
        background: 'var(--bg-canvas)',
      }}
    >
      {/* Panel izquierdo con botón Eliminar en el footer */}
      <CartuchoPanel
        name={draftName}
        template={draftTemplate}
        coverPath={draftCoverPath}
        onModificarCartucho={handleModificarCartucho}
        footer={
          <motion.button
            onClick={() => setConfirmDelete(true)}
            whileHover={{ scale: 1.04, background: '#c73030' }}
            whileTap={{ scale: 0.97 }}
            style={{
              background: '#b02020',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              padding: '7px 20px',
              cursor: 'pointer',
              width: '100%',
              maxWidth: 200,
              marginTop: 4,
            }}
          >
            Eliminar
          </motion.button>
        }
      />

      {/* Panel derecho */}
      <div
        style={{
          flex: 1,
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          overflowY: 'auto',
        }}
      >
        {/* Volver */}
        <motion.button
          onClick={() => setActiveScreen({ type: 'launcher' })}
          whileHover={{ x: -2 }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--accent-light)',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            alignSelf: 'flex-start',
            padding: 0,
          }}
        >
          ← Volver
        </motion.button>

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

        <Field label="Autor">
          <input
            className="ae-input"
            placeholder="Autor"
            value={draftAuthor}
            onChange={(e) => setDraft({ draftAuthor: e.target.value })}
          />
        </Field>

        <div style={{ flex: 1 }} />

        <motion.button
          onClick={handleGuardar}
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
          Modificar
        </motion.button>
      </div>

      {/* Modal de confirmación de eliminación */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 20,
            }}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              style={{
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderRadius: 12,
                padding: '24px 28px',
                maxWidth: 320,
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <p style={{ color: 'var(--text)', fontSize: 15 }}>
                ¿Eliminar <strong>{draftName}</strong>? Esta acción no se puede deshacer.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{
                    background: 'var(--text-dim)',
                    border: 'none',
                    borderRadius: 6,
                    color: '#fff',
                    padding: '8px 22px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEliminar}
                  style={{
                    background: '#b02020',
                    border: 'none',
                    borderRadius: 6,
                    color: '#fff',
                    padding: '8px 22px',
                    cursor: 'pointer',
                    fontWeight: 700,
                  }}
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ color: 'var(--text)', fontSize: 16, fontWeight: 700 }}>{label}</span>
      {children}
    </div>
  );
}
