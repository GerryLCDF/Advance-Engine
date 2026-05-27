/**
 * Launcher.tsx  –  Orquestador principal de Advance Studio
 * ─────────────────────────────────────────────────────────────
 * Gestiona el routing entre todas las pantallas usando AnimatePresence
 * de Framer Motion para transiciones fluidas.
 *
 * Árbol de pantallas:
 *   EditorPlaceholder   (fullscreen, zIndex 100) ← si activeScreen.type === 'editor'
 *   CreditosScreen      (absolute, zIndex 10)    ← si activeScreen.type === 'creditos'
 *   ModificarPortada    (absolute, zIndex 10)    ← si activeScreen.type === 'modificar-portada'
 *   EditarScreen        (absolute, zIndex 10)    ← si activeScreen.type === 'editar'
 *   TodosProyectos      (absolute, zIndex 10)    ← si activeScreen.type === 'todos-proyectos'
 *   ── Launcher shell ──────────────────────────── (base)
 *      AppHeader
 *      AnimatePresence → RecientesScreen | CrearScreen | ImportarScreen
 *      TabBar
 */

import React, { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';

import { AppHeader } from '../components/AppHeader';
import { TabBar } from '../components/TabBar';

import { RecientesScreen } from './RecientesScreen';
import { CrearScreen } from './CrearScreen';
import { ImportarScreen } from './ImportarScreen';
import { TodosProyectosScreen } from './TodosProyectosScreen';
import { EditarScreen } from './EditarScreen';
import { ModificarPortadaScreen } from './ModificarPortadaScreen';
import { CreditosScreen } from './CreditosScreen';
import { EditorPlaceholderScreen } from './EditorPlaceholderScreen';

export function Launcher() {
  const activeScreen = useAppStore((s) => s.activeScreen);
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const resetDraft = useAppStore((s) => s.resetDraft);
  const loadProjects = useAppStore((s) => s.loadProjects);

  // Cargar proyectos persistidos al iniciar
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Resetear draft al cambiar de tab
  const handleTabChange = (tab: typeof activeTab) => {
    resetDraft();
    setActiveTab(tab);
  };

  // ── Pantalla editor (fullscreen, sale del shell del Launcher) ─────────────
  if (activeScreen.type === 'editor') {
    return (
      <AnimatePresence>
        <EditorPlaceholderScreen key={`editor-${activeScreen.projectId}`} projectId={activeScreen.projectId} />
      </AnimatePresence>
    );
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#2a2a3e',
        overflow: 'hidden',
        borderRadius: 8,
        position: 'relative',
      }}
    >
      {/* Header fijo */}
      <AppHeader />

      {/* Zona de contenido con pantallas superpuestas */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

        {/* Contenido base de las tabs */}
        <AnimatePresence mode="wait">
          {activeTab === 'recientes' && <RecientesScreen key="recientes" />}
          {activeTab === 'crear'     && <CrearScreen key="crear" />}
          {activeTab === 'importar'  && <ImportarScreen key="importar" />}
        </AnimatePresence>

        {/* Overlays de nivel superior — se montan encima del contenido base */}
        <AnimatePresence>
          {activeScreen.type === 'todos-proyectos' && (
            <TodosProyectosScreen key="todos" />
          )}
          {activeScreen.type === 'editar' && (
            <EditarScreen key={`editar-${activeScreen.projectId}`} projectId={activeScreen.projectId} />
          )}
          {activeScreen.type === 'modificar-portada' && (
            <ModificarPortadaScreen key={`portada-${activeScreen.projectId}`} projectId={activeScreen.projectId} />
          )}
          {activeScreen.type === 'creditos' && (
            <CreditosScreen key="creditos" />
          )}
        </AnimatePresence>

      </div>

      {/* Tab bar inferior — siempre visible salvo en overlays de pantalla completa */}
      {(activeScreen.type === 'launcher' || activeScreen.type === 'todos-proyectos') && (
        <TabBar active={activeTab} onChange={handleTabChange} />
      )}
    </div>
  );
}
