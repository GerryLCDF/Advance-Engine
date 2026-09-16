/**
 * CartuchoDisplay
 * ──────────────────────────────────────────────────────────────────────────
 * Sistema de capas para el cartucho GBA:
 *
 *  Layer 0 – imagen del cartucho (solo el marco, sin ventana)     ← fondo
 *  Layer 1 – portada / calcomanía delantera recortada por la
 *             máscara `recorte.png` (blanco visible, negro oculto)   ← delante
 *  Layer 2 – nombre del proyecto (solo si showName=true), con
 *             degradado negro anclado a la base del cartucho      ← tapa
 *
 * La portada y la calcomanía son lo MISMO: el diseño que carga el
 * usuario se pinta POR DELANTE del cartucho, recortado exactamente
 * por la máscara sobre la zona de la etiqueta delantera.
 */

import React from 'react';
import { motion } from 'framer-motion';
import type { TemplateId } from '../types';
import { parseTemplate, hexToFilter } from '../utils/cartuchos';

// Imagen del cartucho sin portada (solo el marco)
const CARTUCHO_MARCO = '/recursos/cartucho.png';

// Plantilla blanca por defecto que imita la etiqueta en blanco del cartucho
// (cuando el usuario aún no carga una portada/calcomanía)
const CALCOMANIA_DEFAULT = '/recursos/calcomania/plantilla.png';

// Máscara estática de la calcomanía (blanco = visible, negro = oculto)
const CALCOMANIA_MASK = '/recursos/calcomania/recorte.png';

interface CartuchoDisplayProps {
  name?: string;
  showName?: boolean;      // mostrar nombre encima del cartucho (Layer 2)
  template?: TemplateId;   // solo cambia el color del marco
  coverPath?: string;      // portada = calcomanía; '' = plantilla blanca
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const SIZES = {
  sm:  { width: 96,  height: 54,  fontSize: 9,  radius: 4 },
  md:  { width: 192, height: 108, fontSize: 12, radius: 8 },
  lg:  { width: 256, height: 144, fontSize: 13, radius: 10 },
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
  const { file, isCustom, customHex } = parseTemplate(template);
  const marcoSrc = file ?? CARTUCHO_MARCO;
  const customFilter = isCustom && customHex ? hexToFilter(customHex) : undefined;

  // Resolver la ruta de la portada (= calcomanía). Sin portada → plantilla blanca.
  // Una ruta absoluta del sistema (Linux: /home/..., Windows: C:/...) hay que
  // servirla por el protocolo atom://local/ (no confundir con rutas public/ de Vite)
  const frontSrc = coverPath
    ? /^(atom:\/\/|https?:\/\/)/.test(coverPath)
      ? coverPath
      : `atom://local/${coverPath.replace(/\\/g, '/')}`
    : CALCOMANIA_DEFAULT;

  const maskStyle = {
    maskImage: `url(${CALCOMANIA_MASK})`,
    WebkitMaskImage: `url(${CALCOMANIA_MASK})`,
    maskSize: '100% 100%',
    WebkitMaskSize: '100% 100%',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskPosition: 'center',
  } as React.CSSProperties;

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
          ...(customFilter ? { filter: customFilter } : {}),
        }}
      />

      {/* ── Layer 1: portada / calcomanía delantera (con máscara) ────── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 4,
          pointerEvents: 'none',
          ...maskStyle,
        }}
      >
        <img
          src={frontSrc}
          alt="portada"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = CALCOMANIA_DEFAULT;
          }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'fill',
            imageRendering: 'pixelated',
          }}
        />
      </div>

      {/* ── Layer 2: nombre del proyecto (opcional) ──────────────────── */}
      {showName && name && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: 5,
            background: 'linear-gradient(to bottom, transparent 55%, rgba(0,0,0,0.78))',
            color: '#fff',
            fontSize: dim.fontSize,
            fontWeight: 700,
            textAlign: 'center',
            textShadow: '0 1px 3px rgba(0,0,0,0.9)',
            overflow: 'hidden',
            pointerEvents: 'none',
            zIndex: 5,
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