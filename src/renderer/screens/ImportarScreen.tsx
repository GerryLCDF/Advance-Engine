import React from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { CartuchoPanel } from '../components/CartuchoPanel';

export function ImportarScreen() {
  const { draftName, draftPath, draftTemplate, draftCoverPath, setDraft, resetDraft } =
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

  const handleImportar = async () => {
    if (!draftName.trim() || !draftPath.trim()) return;
    const project = await addProject({
      name: draftName.trim(),
      author: '',
      path: draftPath.trim(),
      template: draftTemplate,
      coverPath: draftCoverPath,
    });
    if (project) {
      resetDraft();
      setActiveScreen({ type: 'launcher' });
    }
  };

  const handleModificarCartucho = () => {
    setActiveScreen({ type: 'modificar-portada', projectId: '__draft__' });
  };

  return (
    <motion.div
      key="importar"
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

        <Field label="Nombre:">
          <input
            className="ae-input"
            placeholder="Nombre del proyecto"
            value={draftName}
            onChange={(e) => setDraft({ draftName: e.target.value })}
          />
        </Field>

        <div style={{ flex: 1 }} />

        <motion.button
          onClick={handleImportar}
          disabled={!draftName.trim() || !draftPath.trim()}
          whileHover={draftName.trim() && draftPath.trim() ? { scale: 1.03, background: '#3dba60' } : {}}
          whileTap={draftName.trim() ? { scale: 0.97 } : {}}
          style={{
            background: draftName.trim() && draftPath.trim() ? '#2ea84a' : '#444',
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
          Importar
        </motion.button>
      </div>
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
