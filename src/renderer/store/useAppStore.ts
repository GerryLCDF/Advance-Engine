import { create } from 'zustand';
import type { Project, ActiveScreen, LauncherTab, CreditEntry, TemplateId } from '../types';

// ── Créditos del proyecto ────────────────────────────────────────────────────
const DEFAULT_CREDITS: CreditEntry[] = [
  { id: '1', name: 'Tu Nombre', role: 'Desarrollador principal', url: '', linkEnabled: false },
  { id: '2', name: 'Advance Studio', role: 'Motor', url: 'https://github.com', linkEnabled: true },
];

// ── Proyectos de demostración (se reemplazan al cargar desde el main) ────────
const DEMO_PROJECTS: Project[] = [
  { id: 'demo1', name: 'Proyecto tringa jsjsjs', author: 'Dev', path: 'C:/proyectos/tringa', template: 'cartuchotransparente', coverPath: '', lastOpened: '2026-05-02T00:00:00Z' },
  { id: 'demo2', name: 'atrapalos a todozzzzzz', author: 'Dev', path: 'C:/proyectos/atrapalos', template: 'cartucho_color', coverPath: '', lastOpened: '2026-04-08T00:00:00Z' },
  { id: 'demo3', name: 'Proyecto elefantitos', author: 'Dev', path: 'C:/proyectos/elefantitos', template: 'cartucho', coverPath: '', lastOpened: '2026-01-01T00:00:00Z' },
];

interface AppState {
  // ── Navegación ─────────────────────────────────────────────────────────────
  activeScreen: ActiveScreen;
  activeTab: LauncherTab;
  setActiveScreen: (screen: ActiveScreen) => void;
  setActiveTab: (tab: LauncherTab) => void;

  // ── Proyectos ──────────────────────────────────────────────────────────────
  projects: Project[];
  isLoadingProjects: boolean;
  loadProjects: () => Promise<void>;
  addProject: (data: Omit<Project, 'id' | 'lastOpened'>) => Promise<Project | null>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  openProject: (id: string) => void;

  // ── Estado temporal de formularios (no persistido por sí solo) ────────────
  draftName: string;
  draftAuthor: string;
  draftPath: string;
  draftTemplate: TemplateId;
  draftCoverPath: string;
  setDraft: (fields: Partial<Pick<AppState, 'draftName' | 'draftAuthor' | 'draftPath' | 'draftTemplate' | 'draftCoverPath'>>) => void;
  resetDraft: () => void;
  loadDraftFromProject: (project: Project) => void;

  // ── Créditos ───────────────────────────────────────────────────────────────
  credits: CreditEntry[];
}

export const useAppStore = create<AppState>((set, get) => ({
  // ── Navegación ─────────────────────────────────────────────────────────────
  activeScreen: { type: 'launcher' },
  activeTab: 'recientes',
  setActiveScreen: (screen) => set({ activeScreen: screen }),
  setActiveTab: (tab) => set({ activeTab: tab }),

  // ── Proyectos ──────────────────────────────────────────────────────────────
  projects: DEMO_PROJECTS,
  isLoadingProjects: false,

  loadProjects: async () => {
    set({ isLoadingProjects: true });
    try {
      const api = (window as any).advanceAPI;
      if (api) {
        const loaded: Project[] = await api.projects.getAll();
        set({ projects: loaded.length > 0 ? loaded : DEMO_PROJECTS });
      }
    } catch {
      // En entorno web (dev sin Electron) se usan los datos de demo
    } finally {
      set({ isLoadingProjects: false });
    }
  },

  addProject: async (data) => {
    try {
      const api = (window as any).advanceAPI;
      if (api) {
        const res = await api.projects.create(data);
        if (res.success && res.project) {
          set((s) => ({ projects: [res.project, ...s.projects] }));
          return res.project;
        }
      } else {
        // Modo demo sin Electron
        const project: Project = { ...data, id: Date.now().toString(), lastOpened: new Date().toISOString() };
        set((s) => ({ projects: [project, ...s.projects] }));
        return project;
      }
    } catch { /* ignore */ }
    return null;
  },

  updateProject: async (id, data) => {
    try {
      const api = (window as any).advanceAPI;
      if (api) {
        await api.projects.update(id, data);
      }
      set((s) => ({
        projects: s.projects.map((p) => (p.id === id ? { ...p, ...data } : p)),
      }));
    } catch { /* ignore */ }
  },

  deleteProject: async (id) => {
    try {
      const api = (window as any).advanceAPI;
      if (api) await api.projects.delete(id);
    } catch { /* ignore */ }
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
  },

  openProject: (id) => {
    try {
      const api = (window as any).advanceAPI;
      if (api) api.projects.setLastOpened(id);
    } catch { /* ignore */ }
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === id ? { ...p, lastOpened: new Date().toISOString() } : p
      ),
      activeScreen: { type: 'editor', projectId: id },
    }));
  },

  // ── Draft ──────────────────────────────────────────────────────────────────
  draftName: '',
  draftAuthor: '',
  draftPath: '',
  draftTemplate: 'cartuchotransparente',
  draftCoverPath: '',

  setDraft: (fields) => set((s) => ({ ...s, ...fields })),

  resetDraft: () => set({
    draftName: '',
    draftAuthor: '',
    draftPath: '',
    draftTemplate: 'cartuchotransparente',
    draftCoverPath: '',
  }),

  loadDraftFromProject: (project) => set({
    draftName: project.name,
    draftAuthor: project.author,
    draftPath: project.path,
    draftTemplate: project.template,
    draftCoverPath: project.coverPath,
  }),

  // ── Créditos ───────────────────────────────────────────────────────────────
  credits: DEFAULT_CREDITS,
}));

// Selector estable: devuelve el array original sin transformar
// El sorting se hace con useMemo en el componente para evitar loops infinitos
export const selectProjects = (state: AppState) => state.projects;
