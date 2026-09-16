import type { CartuchoStyle, TemplateId } from '../types';

// Imagen del cartucho para una combinación style + color
export function cartuchoFile(style: CartuchoStyle, colorKey: string): string {
  const suffix = style === 'transparente' ? '_trans' : '';
  return `/recursos/cartuchos/cartucho_${colorKey}${suffix}.png`;
}

export function encodeTemplate(style: CartuchoStyle, colorKey: string): string {
  return `${style}:${colorKey}`;
}

export function encodeCustomTemplate(style: CartuchoStyle, hex: string): string {
  return `${style}:custom:${hex}`;
}

export interface ParsedTemplate {
  style: CartuchoStyle;          // 'plano' | 'transparente'
  colorKey: string;              // uno de los 9 colores, o 'gris' en legacy
  customHex: string | null;      // set si es color personalizado
  isCustom: boolean;
  file: string | null;           // ruta directa (legacy o color fijo)
}

const LEGACY_FILES: Record<string, string> = {
  cartucho: '/recursos/cartucho.png',
  cartucho_color: '/recursos/cartucho_color.png',
  cartuchotransparente: '/recursos/cartuchotransparente.png',
};

// Interpreta la plantilla almacenada (nuevo formato o legacy)
export function parseTemplate(template: TemplateId | undefined): ParsedTemplate {
  if (template && LEGACY_FILES[template]) {
    const style: CartuchoStyle = template === 'cartuchotransparente' ? 'transparente' : 'plano';
    return { style, colorKey: 'gris', customHex: null, isCustom: false, file: LEGACY_FILES[template] };
  }

  const [style, colorPart, hex] = (template ?? '').split(':');
  if (style === 'plano' || style === 'transparente') {
    if (colorPart === 'custom' && hex) {
      return { style, colorKey: 'blanco', customHex: hex, isCustom: true, file: cartuchoFile(style, 'blanco') };
    }
    return { style, colorKey: colorPart ?? 'gris', customHex: null, isCustom: false, file: cartuchoFile(style, colorPart ?? 'gris') };
  }

  // Fallback: cartucho base plano
  return { style: 'plano', colorKey: 'gris', customHex: null, isCustom: false, file: cartuchoFile('plano', 'gris') };
}

// ── Tinte para el color personalizado ────────────────────────────────────────

interface Hsl { h: number; s: number; l: number }

export function hexToHsl(hex: string): Hsl {
  let hx = hex.replace('#', '');
  if (hx.length === 3) {
    hx = hx.split('').map((c) => c + c).join('');
  }
  const r = parseInt(hx.slice(0, 2), 16) / 255;
  const g = parseInt(hx.slice(2, 4), 16) / 255;
  const b = parseInt(hx.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h = h * 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

// Filtro CSS para teñir el cartucho blanco hacia un color arbitrario.
// Para el "color propio" se evitan las tonalidades pegadas al blanco/negro
// (y los grises planos): se delimita la luminancia y saturación mínima.
export function hexToFilter(hex: string): string {
  const { h, s, l } = hexToHsl(hex);
  // Luminancia contenida en mitad del rango (ni blanco ni negro)
  const L = Math.max(18, Math.min(82, l));
  // Saturación mínima para que un color grisáceo no pinte plano
  const S = Math.max(s, 25);
  // saturate amplifica el croma del sepia hasta saturación objetivo
  const sat = Math.max(S * 20, S <= 8 ? 200 : 2500);
  // brightness lleva la luminancia del blanco hacia la del color meta
  const bright = Math.max(5, Math.min(300, Math.round(L * 1.8)));
  const contrast = Math.max(80, Math.min(140, Math.round(90 + (S - 50) * 0.8)));
  return `sepia(1) saturate(${Math.round(sat)}%) hue-rotate(${Math.round(h)}deg) brightness(${bright}%) contrast(${contrast}%)`;
}