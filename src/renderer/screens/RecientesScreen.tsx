import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAppStore, selectProjects } from '../store/useAppStore';
import { CartuchoDisplay } from '../components/CartuchoDisplay';

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 20 } },
};

export function RecientesScreen() {
  const projects = useAppStore(selectProjects);
  const setActiveScreen = useAppStore((s) => s.setActiveScreen);
  const openProject = useAppStore((s) => s.openProject);
  const loadDraftFromProject = useAppStore((s) => s.loadDraftFromProject);

  // useMemo: el sort solo se recalcula cuando cambia el array de proyectos
  const recent = useMemo(
    () =>
      [...projects]
        .sort((a, b) => new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime())
        .slice(0, 3),
    [projects]
  );

  const handleGear = (id: string) => {
    const p = projects.find((r) => r.id === id);
    if (p) loadDraftFromProject(p);
    setActiveScreen({ type: 'editar', projectId: id });
  };

  return (
    <motion.div
      key="recientes"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        padding: '12px 16px',
        overflowY: 'auto',
      }}
    >
      {recent.length === 0 ? (
        <p style={{ color: '#888', fontSize: 14 }}>No hay proyectos recientes. ¡Crea uno!</p>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          style={{
            display: 'flex',
            gap: 24,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          {recent.map((project) => (
            <motion.div
              key={project.id}
              variants={itemVariants}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <CartuchoDisplay
                name=""
                template={project.template}
                coverPath={project.coverPath}
                size="md"
                onClick={() => openProject(project.id)}
              />

              <span
                style={{
                  color: '#e8e8f0',
                  fontSize: 13,
                  fontWeight: 500,
                  textAlign: 'center',
                  maxWidth: 180,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}
              >
                {project.name}
              </span>

              <motion.button
                onClick={() => handleGear(project.id)}
                whileHover={{ rotate: 30, scale: 1.15 }}
                transition={{ type: 'spring', stiffness: 300 }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 24,
                  color: '#c4a0f0',
                  lineHeight: 1,
                  padding: 4,
                }}
                title="Editar proyecto"
              >
                ⚙
              </motion.button>
            </motion.div>
          ))}
        </motion.div>
      )}

      <motion.button
        onClick={() => setActiveScreen({ type: 'todos-proyectos' })}
        whileHover={{ scale: 1.04, background: '#6d4fc7' } as any}
        whileTap={{ scale: 0.97 }}
        style={{
          background: '#5a3fa0',
          border: 'none',
          borderRadius: 6,
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          padding: '8px 28px',
          cursor: 'pointer',
          marginTop: 4,
        }}
      >
        Todos los proyectos
      </motion.button>
    </motion.div>
  );
}
