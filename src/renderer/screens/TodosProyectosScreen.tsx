import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAppStore, selectProjects } from '../store/useAppStore';
import { CartuchoDisplay } from '../components/CartuchoDisplay';

export function TodosProyectosScreen() {
  const projects = useAppStore(selectProjects);
  const setActiveScreen = useAppStore((s) => s.setActiveScreen);
  const openProject = useAppStore((s) => s.openProject);
  const loadDraftFromProject = useAppStore((s) => s.loadDraftFromProject);

  const all = useMemo(
    () =>
      [...projects].sort(
        (a, b) => new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime()
      ),
    [projects]
  );

  const handleGear = (id: string) => {
    const p = projects.find((r) => r.id === id);
    if (p) loadDraftFromProject(p);
    setActiveScreen({ type: 'editar', projectId: id });
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('es-MX', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      });
    } catch { return ''; }
  };

  return (
    <motion.div
      key="todos-proyectos"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.25 }}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#1c1c2a',
        zIndex: 10,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 16px',
          height: 48,
          background: '#c4a0f0',
          flexShrink: 0,
        }}
      >
        <motion.button
          onClick={() => setActiveScreen({ type: 'launcher' })}
          whileHover={{ scale: 1.08 }}
          style={{
            background: 'rgba(0,0,0,0.2)',
            border: 'none',
            borderRadius: 6,
            color: '#1a0a3a',
            fontSize: 18,
            width: 32,
            height: 32,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
          }}
          title="Volver"
        >
          ←
        </motion.button>
        <span style={{ fontWeight: 800, fontSize: 16, color: '#1a0a3a' }}>Advance Studio</span>
      </div>

      {/* Lista */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {all.length === 0 && (
          <p style={{ color: '#888', textAlign: 'center', marginTop: 32, fontSize: 14 }}>
            No hay proyectos guardados.
          </p>
        )}
        {all.map((project, i) => (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #2a2a4a',
              background: '#22223a',
              cursor: 'pointer',
            }}
            onClick={() => openProject(project.id)}
            whileHover={{ background: '#2e2e4e' } as any}
          >
            <CartuchoDisplay
              name=""
              template={project.template}
              coverPath={project.coverPath}
              size="sm"
            />
            <span
              style={{
                flex: 1,
                color: '#e8e8f0',
                fontWeight: 600,
                fontSize: 14,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}
            >
              {project.name}
            </span>
            <span style={{ color: '#888', fontSize: 12, flexShrink: 0 }}>
              {formatDate(project.lastOpened)}
            </span>
            <motion.button
              onClick={(e) => { e.stopPropagation(); handleGear(project.id); }}
              whileHover={{ rotate: 30 }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 20,
                color: '#c4a0f0',
                padding: '2px 4px',
                flexShrink: 0,
              }}
              title="Editar"
            >
              ⚙
            </motion.button>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
