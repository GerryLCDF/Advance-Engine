import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CARTUCHO_COLORS, CARTUCHO_STYLES } from '../types';
import type { CartuchoStyle, TemplateId } from '../types';
import {
  encodeTemplate,
  encodeCustomTemplate,
  parseTemplate,
  cartuchoFile,
} from '../utils/cartuchos';

interface CartuchoColorPickerProps {
  value: TemplateId;
  onChange: (template: TemplateId) => void;
}

// Swatch por defecto cuando el color propio aún no está definido
const CUSTOM_DEFAULT = '#8a6ed1';

export function CartuchoColorPicker({ value, onChange }: CartuchoColorPickerProps) {
  const parsed = parseTemplate(value);
  const [openStyle, setOpenStyle] = useState<CartuchoStyle | null>(null);

  // Menú de la variante que está abierta (o la activa si ninguna)
  const style = openStyle ?? parsed.style;

  // Swatch del color propio actual
  const customSwatch = parsed.isCustom ? (parsed.customHex ?? CUSTOM_DEFAULT) : CUSTOM_DEFAULT;
  const selectedCustom = parsed.isCustom && parsed.style === style;

  const toggleStyle = (s: CartuchoStyle) => {
    setOpenStyle(openStyle === s ? null : s);
  };

  // Seleccionar color: se aplica en vivo y el menú se queda abierto
  // para que el usuario siga probando combinaciones
  const selectColor = (colorKey: string) => {
    onChange(encodeTemplate(style, colorKey));
  };

  // Color propio: actualiza en vivo mientras arrastra el selector y
  // solo "termina" cuando cierra el picker nativo (no se cierra el menú)
  const selectCustom = (hex: string) => {
    onChange(encodeCustomTemplate(style, hex));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ display: 'flex', gap: 14 }}>
        {CARTUCHO_STYLES.map((s) => {
          const active = parsed.style === s.key;
          const open = openStyle === s.key;
          return (
            <motion.button
              key={s.key}
              onClick={() => toggleStyle(s.key)}
              whileHover={{ scale: 1.06, y: -2 }}
              whileTap={{ scale: 0.93 }}
              title={s.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                border: 'none',
                background: 'transparent',
                padding: 0,
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: 92,
                  height: 58,
                  borderRadius: 7,
                  overflow: 'hidden',
                  border: active ? '2px solid var(--accent-light)' : '2px solid var(--border-color)',
                  background: 'var(--bg-dark)',
                  boxShadow: open ? '0 0 10px rgba(138,110,209,0.55)' : 'none',
                }}
              >
                {/* Cartucho gris de ejemplo: gris para plano, gris trans para transparente */}
                <img
                  src={cartuchoFile(s.key, 'gris')}
                  alt={s.label}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', imageRendering: 'pixelated' }}
                />
              </div>
              <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{s.label}</span>
            </motion.button>
          );
        })}
      </div>

      {openStyle && (
        <motion.div
          initial={{ opacity: 0, y: -6, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -6, height: 0 }}
          transition={{ duration: 0.16 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 66px)',
            gap: 8,
            overflow: 'hidden',
          }}
        >
          {CARTUCHO_COLORS.map((c) => {
            const selected = parsed.style === style && parsed.colorKey === c.key && !parsed.isCustom;
            return (
              <motion.div
                key={c.key}
                onClick={() => selectColor(c.key)}
                whileHover={{ scale: 1.07, y: -2 }}
                whileTap={{ scale: 0.93 }}
                title={c.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: 66,
                    height: 42,
                    borderRadius: 6,
                    border: selected ? '2px solid var(--accent-light)' : '2px solid var(--border-color)',
                    overflow: 'hidden',
                    background: 'var(--bg-dark)',
                    boxShadow: selected ? '0 0 8px rgba(138,110,209,0.5)' : 'none',
                  }}
                >
                  <img
                    src={cartuchoFile(style, c.key)}
                    alt={c.label}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', imageRendering: 'pixelated' }}
                  />
                </div>
                <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>{c.label}</span>
              </motion.div>
            );
          })}

          {/* Última opción: color propio (selector de color) */}
          <motion.label
            whileHover={{ scale: 1.07, y: -2 }}
            whileTap={{ scale: 0.93 }}
            title="Color propio"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 66,
                height: 42,
                borderRadius: 6,
                border: selectedCustom ? '2px solid var(--accent-light)' : '2px solid var(--border-color)',
                overflow: 'hidden',
                background: `conic-gradient(#e74c3c, #e67e22, #f1c40f, #2ecc71, #3498db, #9b59b6, #e74c3c)`,
                position: 'relative',
                boxShadow: selectedCustom ? '0 0 8px rgba(138,110,209,0.5)' : 'none',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: selectedCustom ? 8 : 12,
                  borderRadius: 6,
                  background: customSwatch,
                  border: '1px solid rgba(0,0,0,0.3)',
                }}
              />
              <input
                type="color"
                value={customSwatch}
                onChange={(e) => selectCustom(e.target.value)}
                style={{ position: 'absolute', opacity: 0, inset: 0, width: '100%', height: '100%', cursor: 'pointer' }}
              />
            </div>
            <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>Color propio</span>
          </motion.label>
        </motion.div>
      )}
    </div>
  );
}