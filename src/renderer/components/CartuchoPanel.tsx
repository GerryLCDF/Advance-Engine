/**
 * CartuchoPanel
 * ─────────────────────────────────────────────────────────────
 * Panel izquierdo compartido entre las pantallas Crear, Editar e Importar.
 * Muestra el preview del cartucho con binding en tiempo real y
 * el botón "Modificar Cartucho".
 */
import React from 'react';
import { motion } from 'framer-motion';
import { CartuchoDisplay } from './CartuchoDisplay';
import type { TemplateId } from '../types';

interface CartuchoPanelProps {
  name: string;
  template: TemplateId;
  coverPath: string;
  onModificarCartucho: () => void;
  /** Slot opcional para botones adicionales debajo del botón principal */
  footer?: React.ReactNode;
}

export function CartuchoPanel({
  name,
  template,
  coverPath,
  onModificarCartucho,
  footer,
}: CartuchoPanelProps) {
  return (
    <div
      style={{
        width: 260,
        flexShrink: 0,
        background: '#b090e8',
        borderRadius: '0 0 0 8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '20px 16px',
      }}
    >
      {/* Preview del cartucho con nombre en tiempo real */}
      <CartuchoDisplay
        name={name || '(Nombre del proyecto)'}
        template={template}
        coverPath={coverPath}
        size="lg"
      />

      {/* Nombre bajo el cartucho */}
      <span
        style={{
          color: '#1a0a3a',
          fontWeight: 700,
          fontSize: 13,
          textAlign: 'center',
          maxWidth: 220,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        ({name || 'Nombre del proyecto'})
      </span>

      {/* Botón Modificar Cartucho */}
      <motion.button
        onClick={onModificarCartucho}
        whileHover={{ scale: 1.04, background: '#7c5fcc' }}
        whileTap={{ scale: 0.97 }}
        style={{
          background: '#9b74e0',
          border: 'none',
          borderRadius: 6,
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          padding: '7px 20px',
          cursor: 'pointer',
          width: '100%',
          maxWidth: 200,
        }}
      >
        Modificar Cartucho
      </motion.button>

      {footer}
    </div>
  );
}
