// ── Tipos globales de Advance Studio ────────────────────────────────────────

// Plantilla de cartucho. Valor encodificado según el tipo:
//   `${style}:${colorKey}`              → uno de los 9 colores fijos
//   `${style}:custom:#rrggbb`           → color personalizado (selector)
//   (legacy) 'cartucho' | 'cartuchotransparente' | 'cartucho_color'
export type TemplateId = string;

export type CartuchoStyle = 'plano' | 'transparente';

export const CARTUCHO_STYLES: { key: CartuchoStyle; label: string }[] = [
  { key: 'plano', label: 'Color plano' },
  { key: 'transparente', label: 'Color transparente' },
];

// Orden fijo de los 9 colores: gris, blanco, rojo, verde, azul,
// morado, café, amarillo, negro
export const CARTUCHO_COLORS: { key: string; label: string }[] = [
  { key: 'gris',     label: 'Gris' },
  { key: 'blanco',   label: 'Blanco' },
  { key: 'rojo',     label: 'Rojo' },
  { key: 'verde',    label: 'Verde' },
  { key: 'azul',     label: 'Azul' },
  { key: 'morado',   label: 'Morado' },
  { key: 'cafe',     label: 'Café' },
  { key: 'amarillo', label: 'Amarillo' },
  { key: 'negro',    label: 'Negro' },
];

// Plantillas legacy (primeras versiones) — se mantienen para compatibilidad
export const TEMPLATES: { id: TemplateId; label: string; file: string }[] = [
  { id: 'cartucho',              label: 'Clásico',       file: '/recursos/cartucho.png' },
  { id: 'cartucho_color',        label: 'Color plano',   file: '/recursos/cartucho_color.png' },
  { id: 'cartuchotransparente',  label: 'Transparente',  file: '/recursos/cartuchotransparente.png' },
];

export interface Project {
  id: string;
  name: string;
  author: string;
  path: string;
  template: TemplateId;
  coverPath: string;   // '' = usa plantilla por defecto
  lastOpened: string;  // ISO date string
}

export interface CreditEntry {
  id: string;
  name: string;
  role?: string;
  url?: string;         // si está presente y linkEnabled = true, el clic abre el link
  linkEnabled: boolean;
}

// Pantallas de nivel superior del Launcher
export type LauncherTab = 'recientes' | 'crear' | 'importar';

// Sub-pantallas que reemplazan el contenido principal
export type ActiveScreen =
  | { type: 'launcher' }
  | { type: 'todos-proyectos' }
  | { type: 'editar'; projectId: string }
  | { type: 'modificar-portada'; projectId: string }
  | { type: 'creditos' }
  | { type: 'editor'; projectId: string };
