// ── Tipos globales de Advance Studio ────────────────────────────────────────

export type TemplateId = 'cartucho' | 'cartuchotransparente' | 'cartucho_color';

export const TEMPLATES: { id: TemplateId; label: string; file: string }[] = [
  { id: 'cartucho',              label: 'Transparente',       file: '/recursos/cartuchotransparente.png' },
  { id: 'cartucho_color',        label: 'Color plano',        file: '/recursos/cartucho_color.png' },
  { id: 'cartuchotransparente',  label: 'Color Transparente', file: '/recursos/cartucho.png' },
];

export interface Project {
  id: string;
  name: string;
  author: string;
  path: string;
  template: TemplateId;
  coverPath: string;   // '' = usa portada por defecto
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
