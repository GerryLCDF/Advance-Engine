import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { EditorTopBar } from '../components/editor/EditorTopBar';
import { MundoTab } from '../components/editor/tabs/MundoTab';
import { SpriteTab } from '../components/editor/tabs/SpriteTab';
import { ImagenTab } from '../components/editor/tabs/ImagenTab';
import { MusicTab } from '../components/editor/tabs/MusicTab';
import { DialogoTab } from '../components/editor/tabs/DialogoTab';

interface EditorScreenProps {
  projectId: string;
}

export function EditorScreen({ projectId }: EditorScreenProps) {
  const editorTab = useAppStore((s) => s.editorTab);
  const setEditorProjectId = useAppStore((s) => s.setEditorProjectId);
  const setSelectedNodeId = useAppStore((s) => s.setSelectedNodeId);

  const maximizedRef = useRef(false);

  useEffect(() => {
    setEditorProjectId(projectId);
    setSelectedNodeId('');
  }, [projectId, setEditorProjectId, setSelectedNodeId]);

  useEffect(() => {
    if (!maximizedRef.current) {
      maximizedRef.current = true;
      (window as any).advanceAPI?.window.maximizeEditor();
    }
  }, []);

  const renderTab = () => {
    switch (editorTab) {
      case 'mundo':   return <MundoTab />;
      case 'sprite':  return <SpriteTab />;
      case 'imagen':  return <ImagenTab />;
      case 'music':   return <MusicTab />;
      case 'dialogo': return <DialogoTab />;
    }
  };

  return (
    <motion.div
      key={`editor-${projectId}`}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#1e1e24',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        overflow: 'hidden',
      }}
    >
      <EditorTopBar />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {renderTab()}
      </div>
    </motion.div>
  );
}
