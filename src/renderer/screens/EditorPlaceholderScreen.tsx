import React from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';

interface EditorPlaceholderScreenProps {
  projectId: string;
}

export function EditorPlaceholderScreen({ projectId }: EditorPlaceholderScreenProps) {
  const projects = useAppStore((s) => s.projects);
  const setActiveScreen = useAppStore((s) => s.setActiveScreen);
  const project = projects.find((p) => p.id === projectId);

  return (
    <motion.div
      key={`editor-${projectId}`}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0d0d0d',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        zIndex: 100,
      }}
    >
      {/* Pixel grid decorativo */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle, #2a1a4a 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          opacity: 0.3,
          pointerEvents: 'none',
        }}
      />

      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
        style={{ fontSize: 64, lineHeight: 1 }}
      >
        🎮
      </motion.div>

      <div style={{ textAlign: 'center' }}>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 900,
            color: '#a78bfa',
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          En Proceso
        </h1>
        {project && (
          <p style={{ color: '#888', fontSize: 15, marginTop: 6 }}>
            {project.name}
          </p>
        )}
        <p style={{ color: '#555', fontSize: 13, marginTop: 12 }}>
          El editor principal estará disponible próximamente.
        </p>
      </div>

      <motion.button
        onClick={() => setActiveScreen({ type: 'launcher' })}
        whileHover={{ scale: 1.05, background: '#6a4fba' }}
        whileTap={{ scale: 0.97 }}
        style={{
          marginTop: 8,
          background: '#5a3fa0',
          border: 'none',
          borderRadius: 8,
          color: '#fff',
          fontSize: 14,
          fontWeight: 700,
          padding: '10px 28px',
          cursor: 'pointer',
        }}
      >
        ← Volver al Launcher
      </motion.button>
    </motion.div>
  );
}
