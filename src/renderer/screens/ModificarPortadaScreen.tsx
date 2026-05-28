import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';
import { CartuchoDisplay } from '../components/CartuchoDisplay';
import { TEMPLATES } from '../types';
import type { TemplateId } from '../types';

const SKIP_HINT_KEY = 'advance-studio:skip-cover-hint';

interface ModificarPortadaScreenProps {
  projectId: string;
}

export function ModificarPortadaScreen({ projectId }: ModificarPortadaScreenProps) {
  const {
    draftTemplate,
    draftCoverPath,
    draftName,
    setDraft,
    updateProject,
    setActiveScreen,
    projects,
  } = useAppStore();

  const [localTemplate, setLocalTemplate] = useState<TemplateId>(draftTemplate);
  const [localCover, setLocalCover]       = useState<string>(draftCoverPath);

  // Modal de instrucciones
  const [showHint, setShowHint]           = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Error de validación de portada
  const [validationError, setValidationError] = useState<string | null>(null);

  // Al montar, leer el flag de localStorage
  useEffect(() => {
    const skip = localStorage.getItem(SKIP_HINT_KEY) === 'true';
    // No mostramos el modal al montar; solo al presionar "Cambiar portada"
    setDontShowAgain(skip);
  }, []);

  const handleCambiarPortadaClick = () => {
    const skip = localStorage.getItem(SKIP_HINT_KEY) === 'true';
    if (skip) {
      // Saltar directamente al explorador
      openImagePicker();
    } else {
      setShowHint(true);
    }
  };

  const openImagePicker = async () => {
    const api = (window as any).advanceAPI;
    if (api) {
      const result: { path: string | null; error: string | null } = await api.dialog.openImage();
      if (result.error) {
        setValidationError(result.error);
      } else if (result.path) {
        setLocalCover(result.path);
        setValidationError(null);
      }
    }
  };

  const handleHintContinue = () => {
    if (dontShowAgain) {
      localStorage.setItem(SKIP_HINT_KEY, 'true');
    }
    setShowHint(false);
    openImagePicker();
  };

  const handleHintClose = () => {
    setShowHint(false);
  };

  const handleSave = async () => {
    setDraft({ draftTemplate: localTemplate, draftCoverPath: localCover });
    if (projectId !== '__draft__') {
      await updateProject(projectId, { template: localTemplate, coverPath: localCover });
      setActiveScreen({ type: 'editar', projectId });
    } else {
      setActiveScreen({ type: 'launcher' });
    }
  };

  const handleCancel = () => {
    if (projectId !== '__draft__') {
      setActiveScreen({ type: 'editar', projectId });
    } else {
      setActiveScreen({ type: 'launcher' });
    }
  };

  const displayName =
    projectId !== '__draft__'
      ? projects.find((p) => p.id === projectId)?.name ?? draftName
      : draftName;

  return (
    <>
      <motion.div
        key="modificar-portada"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.22 }}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10,
          overflow: 'hidden',
          borderRadius: 8,
        }}
      >
        {/* Zona superior: preview */}
        <div
          style={{
            flex: 1,
            background: '#b090e8',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            padding: '16px 20px',
          }}
        >
          <CartuchoDisplay
            name={displayName}
            showName
            template={localTemplate}
            coverPath={localCover}
            size="lg"
          />

          {validationError && (
            <div
              style={{
                background: 'rgba(200,40,40,0.85)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                padding: '7px 14px',
                borderRadius: 6,
                maxWidth: 300,
                textAlign: 'center',
                lineHeight: 1.4,
                position: 'relative',
              }}
            >
              <span
                onClick={() => setValidationError(null)}
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 7,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#fff',
                  opacity: 0.7,
                }}
              >
                ×
              </span>
              {validationError}
            </div>
          )}

          <motion.button
            onClick={handleCambiarPortadaClick}
            whileHover={{ scale: 1.04,             background: 'var(--accent-dark)' } as any}
            whileTap={{ scale: 0.97 }}
            style={{
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            padding: '6px 20px',
            cursor: 'pointer',
            }}
          >
            Cambiar portada
          </motion.button>
        </div>

        {/* Zona inferior: selector de plantillas */}
        <div
          style={{
            background: 'var(--bg-panel)',
            padding: '14px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <span style={{ color: 'var(--text)', fontSize: 15, fontWeight: 700 }}>Colores:</span>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {TEMPLATES.map((t) => (
              <TemplateCard
                key={t.id}
                label={t.label}
                file={t.file}
                selected={localTemplate === t.id}
                onSelect={() => setLocalTemplate(t.id as TemplateId)}
              />
            ))}
          </div>
        </div>

        {/* Pie: Cancel / Save */}
        <div
          style={{
            display: 'flex',
            background: 'var(--bg-panel)',
            borderTop: '1px solid var(--border-color)',
          }}
        >
          <motion.button
            onClick={handleCancel}
            whileHover={{ background: '#c73030' } as any}
            style={{
              flex: 1,
              background: '#b02020',
              border: 'none',
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              padding: '12px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </motion.button>
          <motion.button
            onClick={handleSave}
            whileHover={{ background: '#3dba60' } as any}
            style={{
              flex: 1,
              background: '#2ea84a',
              border: 'none',
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              padding: '12px',
              cursor: 'pointer',
            }}
          >
            Save
          </motion.button>
        </div>
      </motion.div>

      {/* ── Modal de instrucciones ─────────────────────────────────────── */}
      <AnimatePresence>
        {showHint && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.70)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 30,
            }}
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0, y: 12 }}
              animate={{ scale: 1,    opacity: 1, y: 0  }}
              exit={{    scale: 0.88, opacity: 0, y: 12 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              style={{
                background: 'var(--bg-dark)',
                border: '1px solid var(--bg-raised)',
                borderRadius: 12,
                padding: '24px 28px',
                width: 320,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {/* Título */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>🖼️</span>
                <span style={{ color: 'var(--text)', fontSize: 16, fontWeight: 700 }}>
                  Requisitos de portada
                </span>
              </div>

              {/* Cuerpo */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <ReqRow icon="📐" label="Dimensiones" value="480 × 270 píxeles" />
                <ReqRow icon="🗂️" label="Formato"     value="PNG (.png)" />
                <ReqRow icon="🎨" label="Color"        value="RGB o RGBA" />
              </div>

              <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.5 }}>
                La imagen se recortará para ajustarse a la ventana del cartucho.
                Usa exactamente 480×270 px para mejores resultados.
              </p>

              {/* Checkbox no volver a mostrar */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  color: 'var(--text-dim)',
                  fontSize: 12,
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  style={{ width: 14, height: 14,                   accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
                No volver a mostrar este mensaje
              </label>

              {/* Botones */}
              <div style={{ display: 'flex', gap: 8 }}>
                <motion.button
                  onClick={handleHintClose}
                  whileHover={{ background: 'var(--bg-raised)' } as any}
                  style={{
                    flex: 1,
                    background: 'var(--bg-inspector)',
                    border: '1px solid var(--bg-raised)',
                    borderRadius: 7,
                    color: 'var(--text-dim)',
                    fontSize: 13,
                    fontWeight: 600,
                    padding: '8px',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </motion.button>
                <motion.button
                  onClick={handleHintContinue}
                  whileHover={{             background: 'var(--accent-dark)' } as any}
                  style={{
                    flex: 2,
                    background: 'var(--accent)',
                    border: 'none',
                    borderRadius: 7,
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    padding: '8px',
                    cursor: 'pointer',
                  }}
                >
                  Entendido, elegir imagen
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

function ReqRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'var(--bg-panel)',
        borderRadius: 7,
        padding: '8px 12px',
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ color: 'var(--text-muted)', fontSize: 12, minWidth: 80 }}>{label}</span>
      <span style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function TemplateCard({
  label, file, selected, onSelect,
}: {
  label: string; file: string; selected: boolean; onSelect: () => void;
}) {
  return (
    <motion.div
      onClick={onSelect}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer' }}
    >
      <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{label}</span>
      <div
        style={{
          width: 80,
          height: 60,
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
    </motion.div>
  );
}
