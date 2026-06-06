/**
 * CartuchoDisplay
 * ──────────────────────────────────────────────────────────────────────────
 * Sistema de capas para el cartucho GBA:
 *
 *  Layer 0 – imagen del cartucho (marco con ventana)          ← fondo
 *  Layer 1 – portada del usuario, posicionada DENTRO
 *             de la ventana rectangular del cartucho           ← encima del fondo
 *  Layer 2 – imagen del cartucho OTRA VEZ encima de la portada
 *             para que el marco tape los bordes de la portada  ← tapa
 *  Layer 3 – nombre del proyecto (solo si showName=true)
 *
 * La portada se recorta visualmente porque el marco del cartucho
 * (Layer 2) queda encima con el área interior transparente.
 *
 * Offsets de la ventana interior del cartucho (% sobre el total):
 *   top: 11%   left: 12%   right: 12%   bottom: 18%
 */

import React from 'react';
import { motion } from 'framer-motion';
import type { TemplateId } from '../types';
import { TEMPLATES } from '../types';

const TEMPLATE_FILE: Record<TemplateId, string> = Object.fromEntries(
  TEMPLATES.map((t) => [t.id, t.file])
) as Record<TemplateId, string>;

// Imagen del cartucho sin portada (solo el marco con área blanca/transparente interior)
const CARTUCHO_MARCO = '/recursos/cartucho.png';
const DEFAULT_COVER  = '/recursos/portada.png';

// Offsets calibrados para que la portada quede dentro de la ventana del cartucho
// Estos valores se ajustan según el pixel art del cartucho.png (480x270 src)
const WINDOW_INSET = {
  top:    '11%',
  left:   '12%',
  right:  '12%',
  bottom: '18%',
};

interface CartuchoDisplayProps {
  name?: string;
  showName?: boolean;          // mostrar nombre encima de la portada (Layer 3)
  template?: TemplateId;       // solo cambia el color del marco (no afecta portada)
  coverPath?: string;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const SIZES = {
  sm:  { width: 96,  height: 54,  fontSize: 9,  radius: 4 },
  md:  { width: 192, height: 108, fontSize: 12, radius: 8 },
  lg:  { width: 256, height: 144, fontSize: 13, radius: 10 },
};

// Mapa de colores de tinte para el marco según la plantilla elegida
const TEMPLATE_TINT: Record<TemplateId, string | undefined> = {
  cartucho:             undefined,        // color natural del PNG
  cartuchotransparente: undefined,
  cartucho_color:       undefined,
};

export function CartuchoDisplay({
  name = '',
  showName = false,
  template = 'cartuchotransparente',
  coverPath = '',
  size = 'md',
  onClick,
}: CartuchoDisplayProps) {
  const dim = SIZES[size];

  // Seleccionar la imagen de marco según la plantilla elegida
  const marcoSrc = TEMPLATE_FILE[template] ?? CARTUCHO_MARCO;

  // Resolver la ruta de la portada
  const resolvedCover = coverPath
    ? coverPath.startsWith('/')
      ? coverPath
      : `atom://local/${coverPath.replace(/\\/g, '/')}`
    : DEFAULT_COVER;

  return (
    <motion.div
      onClick={onClick}
      whileHover={onClick ? { scale: 1.04, y: -2 } : {}}
      whileTap={onClick ? { scale: 0.97 } : {}}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      style={{
        position: 'relative',
        width: dim.width,
        height: dim.height,
        borderRadius: dim.radius,
        cursor: onClick ? 'pointer' : 'default',
        flexShrink: 0,
        userSelect: 'none',
        // Sin overflow:hidden aquí para que el cartucho se vea limpio
      }}
    >
      {/* ── Layer 0: marco base del cartucho (fondo) ─────────────────── */}
      <img
        src={marcoSrc}
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'fill',
          imageRendering: 'pixelated',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* ── Layer 1: portada del usuario dentro de la ventana ─────────── */}
      <img
        src={resolvedCover}
        alt="portada"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = DEFAULT_COVER;
        }}
        style={{
          position: 'absolute',
          top:    WINDOW_INSET.top,
          left:   WINDOW_INSET.left,
          right:  WINDOW_INSET.right,
          bottom: WINDOW_INSET.bottom,
          width:  `calc(100% - ${WINDOW_INSET.left} - ${WINDOW_INSET.right})`,
          height: `calc(100% - ${WINDOW_INSET.top}  - ${WINDOW_INSET.bottom})`,
          objectFit: 'cover',
          imageRendering: 'pixelated',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* ── Layer 2: marco encima de la portada para tapar bordes ─────── */}
      <img
        src={marcoSrc}
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'fill',
          imageRendering: 'pixelated',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* ── Layer 3: nombre del proyecto (opcional) ──────────────────── */}
      {showName && name && (
        <div
          style={{
            position: 'absolute',
            top:    WINDOW_INSET.top,
            left:   WINDOW_INSET.left,
            right:  WINDOW_INSET.right,
            bottom: WINDOW_INSET.bottom,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: 3,
            background: 'linear-gradient(transparent 50%, rgba(0,0,0,0.65))',
            color: '#fff',
            fontSize: dim.fontSize,
            fontWeight: 700,
            textAlign: 'center',
            textShadow: '0 1px 3px rgba(0,0,0,0.9)',
            overflow: 'hidden',
            pointerEvents: 'none',
            zIndex: 3,
          }}
        >
          <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', maxWidth: '90%' }}>
            {name}
          </span>
        </div>
      )}
    </motion.div>
  );
}
