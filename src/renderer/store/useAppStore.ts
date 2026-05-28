import { create } from 'zustand';
import type { Project, ActiveScreen, LauncherTab, CreditEntry, TemplateId } from '../types';
import type {
  EditorTab, Scene, SceneConnection, SpriteSheet, Background,
  Song, DialogueEntry, Actor, Animation, AnimationFrame,
  BackgroundLayer, Instrument, Pattern, NoteRow, ADSREnvelope,
} from '../types/editor';

const DEFAULT_CREDITS: CreditEntry[] = [
  { id: '1', name: 'Tu Nombre', role: 'Desarrollador principal', url: '', linkEnabled: false },
  { id: '2', name: 'Advance Studio', role: 'Motor', url: 'https://github.com', linkEnabled: true },
];

const DEMO_PROJECTS: Project[] = [
  { id: 'demo1', name: 'Proyecto tringa jsjsjs', author: 'Dev', path: 'C:/proyectos/tringa', template: 'cartuchotransparente', coverPath: '', lastOpened: '2026-05-02T00:00:00Z' },
  { id: 'demo2', name: 'atrapalos a todozzzzzz', author: 'Dev', path: 'C:/proyectos/atrapalos', template: 'cartucho_color', coverPath: '', lastOpened: '2026-04-08T00:00:00Z' },
  { id: 'demo3', name: 'Proyecto elefantitos', author: 'Dev', path: 'C:/proyectos/elefantitos', template: 'cartucho', coverPath: '', lastOpened: '2026-01-01T00:00:00Z' },
];

// ── Helpers ──────────────────────────────────────────────────────────────
let _nextId = 1;
const uid = () => `e${_nextId++}_${Date.now()}`;

const defaultScene = (): Scene => ({
  id: uid(), name: 'Nueva escena', width: 240, height: 160,
  backgroundColor: '#6b8cff', type: 'platformer', actors: [],
});

const defaultActor = (): Actor => ({
  id: uid(), name: 'Nuevo actor', type: 'character',
  x: 0, y: 0, width: 16, height: 16, spriteId: '', properties: {},
});

const defaultSpriteSheet = (): SpriteSheet => ({
  id: uid(), name: 'Nuevo sprite', tilesetPath: '',
  tileWidth: 8, tileHeight: 8, cols: 4, rows: 4, animations: [],
});

const defaultAnimation = (): Animation => ({
  id: uid(), name: 'Nueva animación', frames: [], loop: true,
});

const defaultBackground = (): Background => ({
  id: uid(), name: 'Nuevo fondo', layers: [],
});

const defaultLayer = (): BackgroundLayer => ({
  id: uid(), imagePath: '', parallaxX: 1, parallaxY: 1, speed: 1, visible: true,
});

const defaultEnvelope = (): ADSREnvelope => ({ attack: 0, decay: 0, sustain: 1, release: 0 });

const defaultInstrument = (): Instrument => ({
  id: uid(), name: 'Pulse 1', type: 'duty', dutyCycle: 0.5,
  waveData: [], envelope: defaultEnvelope(), visible: true, muted: false, solo: false,
});

const defaultPattern = (): Pattern => ({
  id: uid(), name: 'Patrón 1', rows: Array.from({ length: 16 }, () => defaultNoteRow()),
});

const defaultNoteRow = (): NoteRow => ({
  note: '', octave: 4, instrumentId: '', effect: '',
});

const defaultSong = (): Song => ({
  id: uid(), name: 'Nueva canción', bpm: 120,
  instruments: [defaultInstrument()],
  patterns: [defaultPattern()],
});

const defaultDialogueEntry = (): DialogueEntry => ({
  id: uid(), name: 'Nuevo diálogo', sceneId: '', pages: [{ id: uid(), text: '', choices: [] }],
});

interface AppState {
  // ── Navegación principal ─────────────────────────────────────────────────
  activeScreen: ActiveScreen;
  activeTab: LauncherTab;
  setActiveScreen: (screen: ActiveScreen) => void;
  setActiveTab: (tab: LauncherTab) => void;

  // ── Proyectos ──────────────────────────────────────────────────────────
  projects: Project[];
  isLoadingProjects: boolean;
  loadProjects: () => Promise<void>;
  addProject: (data: Omit<Project, 'id' | 'lastOpened'>) => Promise<Project | null>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  openProject: (id: string) => void;

  // ── Draft ──────────────────────────────────────────────────────────────
  draftName: string;
  draftAuthor: string;
  draftPath: string;
  draftTemplate: TemplateId;
  draftCoverPath: string;
  setDraft: (fields: Partial<Pick<AppState, 'draftName' | 'draftAuthor' | 'draftPath' | 'draftTemplate' | 'draftCoverPath'>>) => void;
  resetDraft: () => void;
  loadDraftFromProject: (project: Project) => void;

  // ── Créditos ───────────────────────────────────────────────────────────
  credits: CreditEntry[];

  // ═══════════════════════════════════════════════════════════════════════
  // EDITOR STATE
  // ═══════════════════════════════════════════════════════════════════════

  editorProjectId: string;
  editorTab: EditorTab;
  selectedNodeId: string;
  setEditorProjectId: (id: string) => void;
  setEditorTab: (tab: EditorTab) => void;
  setSelectedNodeId: (id: string) => void;

  // ── Panel sizes (shared across all editor tabs) ────────────────────────
  hierarchyWidth: number;
  inspectorWidth: number;
  terminalHeight: number;
  setHierarchyWidth: (w: number) => void;
  setInspectorWidth: (w: number) => void;
  setTerminalHeight: (h: number) => void;

  // ── Theme ──────────────────────────────────────────────────────────────
  themeBgPanel: string;
  themeAccent: string;
  fontSize: number;
  setTheme: (bgPanel: string, accent: string) => void;
  setFontSize: (px: number) => void;

  // ── Mundo ──────────────────────────────────────────────────────────────
  scenes: Scene[];
  addScene: () => void;
  updateScene: (id: string, patch: Partial<Scene>) => void;
  removeScene: (id: string) => void;
  addActor: (sceneId: string) => void;
  updateActor: (sceneId: string, actorId: string, patch: Partial<Actor>) => void;
  removeActor: (sceneId: string, actorId: string) => void;
  sceneConnections: SceneConnection[];
  addConnection: (fromSceneId: string, toSceneId: string) => void;
  removeConnection: (id: string) => void;

  // ── Sprite ─────────────────────────────────────────────────────────────
  spriteSheets: SpriteSheet[];
  addSpriteSheet: () => void;
  updateSpriteSheet: (id: string, patch: Partial<SpriteSheet>) => void;
  removeSpriteSheet: (id: string) => void;
  addAnimation: (spriteId: string) => void;
  updateAnimation: (spriteId: string, animId: string, patch: Partial<Animation>) => void;
  removeAnimation: (spriteId: string, animId: string) => void;
  addFrame: (spriteId: string, animId: string) => void;
  updateFrame: (spriteId: string, animId: string, frameIdx: number, patch: Partial<AnimationFrame>) => void;
  removeFrame: (spriteId: string, animId: string, frameIdx: number) => void;

  // ── Imagen ─────────────────────────────────────────────────────────────
  backgrounds: Background[];
  addBackground: () => void;
  updateBackground: (id: string, patch: Partial<Background>) => void;
  removeBackground: (id: string) => void;
  addLayer: (bgId: string) => void;
  updateLayer: (bgId: string, layerId: string, patch: Partial<BackgroundLayer>) => void;
  removeLayer: (bgId: string, layerId: string) => void;

  // ── Music ──────────────────────────────────────────────────────────────
  songs: Song[];
  addSong: () => void;
  updateSong: (id: string, patch: Partial<Song>) => void;
  removeSong: (id: string) => void;
  addInstrument: (songId: string) => void;
  updateInstrument: (songId: string, instId: string, patch: Partial<Instrument>) => void;
  removeInstrument: (songId: string, instId: string) => void;
  addPattern: (songId: string) => void;
  updatePattern: (songId: string, patId: string, patch: Partial<Pattern>) => void;
  removePattern: (songId: string, patId: string) => void;
  updateNoteRow: (songId: string, patId: string, rowIdx: number, patch: Partial<NoteRow>) => void;

  // ── Dialogo ────────────────────────────────────────────────────────────
  dialogues: DialogueEntry[];
  addDialogue: () => void;
  updateDialogue: (id: string, patch: Partial<DialogueEntry>) => void;
  removeDialogue: (id: string) => void;
  addPage: (dialogueId: string) => void;
  updatePage: (dialogueId: string, pageId: string, patch: Partial<DialogueEntry['pages'][0]>) => void;
  removePage: (dialogueId: string, pageId: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // ── Navegación ─────────────────────────────────────────────────────────
  activeScreen: { type: 'launcher' },
  activeTab: 'recientes',
  setActiveScreen: (screen) => set({ activeScreen: screen }),
  setActiveTab: (tab) => set({ activeTab: tab }),

  // ── Proyectos ──────────────────────────────────────────────────────────
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
      if (api) await api.projects.update(id, data);
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

  // ── Draft ──────────────────────────────────────────────────────────────
  draftName: '',
  draftAuthor: '',
  draftPath: '',
  draftTemplate: 'cartuchotransparente',
  draftCoverPath: '',
  setDraft: (fields) => set((s) => ({ ...s, ...fields })),
  resetDraft: () => set({
    draftName: '', draftAuthor: '', draftPath: '',
    draftTemplate: 'cartuchotransparente', draftCoverPath: '',
  }),
  loadDraftFromProject: (project) => set({
    draftName: project.name, draftAuthor: project.author,
    draftPath: project.path, draftTemplate: project.template,
    draftCoverPath: project.coverPath,
  }),

  // ── Créditos ───────────────────────────────────────────────────────────
  credits: DEFAULT_CREDITS,

  // ═══════════════════════════════════════════════════════════════════════
  // EDITOR STATE
  // ═══════════════════════════════════════════════════════════════════════

  editorProjectId: '',
  editorTab: 'mundo',
  selectedNodeId: '',
  setEditorProjectId: (id) => set({ editorProjectId: id }),
  setEditorTab: (tab) => set({ editorTab: tab }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  hierarchyWidth: 260,
  inspectorWidth: 220,
  terminalHeight: 72,
  setHierarchyWidth: (w) => set({ hierarchyWidth: w }),
  setInspectorWidth: (w) => set({ inspectorWidth: w }),
  setTerminalHeight: (h) => set({ terminalHeight: h }),

  // ── Theme ──────────────────────────────────────────────────────────────
  themeBgPanel: '#2d2d33',
  themeAccent: '#5a3fa0',
  fontSize: 13,
  setTheme: (bgPanel: string, accent: string) => set({ themeBgPanel: bgPanel, themeAccent: accent }),
  setFontSize: (px) => set({ fontSize: px }),

  // ── Mundo ──────────────────────────────────────────────────────────────
  scenes: [defaultScene()],
  addScene: () => set((s) => ({ scenes: [...s.scenes, defaultScene()] })),
  updateScene: (id, patch) => set((s) => ({
    scenes: s.scenes.map((sc) => (sc.id === id ? { ...sc, ...patch } : sc)),
  })),
  removeScene: (id) => set((s) => ({ scenes: s.scenes.filter((sc) => sc.id !== id) })),
  addActor: (sceneId) => set((s) => ({
    scenes: s.scenes.map((sc) =>
      sc.id === sceneId ? { ...sc, actors: [...sc.actors, defaultActor()] } : sc
    ),
  })),
  updateActor: (sceneId, actorId, patch) => set((s) => ({
    scenes: s.scenes.map((sc) =>
      sc.id !== sceneId ? sc : {
        ...sc,
        actors: sc.actors.map((a) => (a.id === actorId ? { ...a, ...patch } : a)),
      }
    ),
  })),
  removeActor: (sceneId, actorId) => set((s) => ({
    scenes: s.scenes.map((sc) =>
      sc.id !== sceneId ? sc : {
        ...sc,
        actors: sc.actors.filter((a) => a.id !== actorId),
      }
    ),
  })),
  sceneConnections: [],
  addConnection: (fromSceneId, toSceneId) => set((s) => ({
    sceneConnections: [...s.sceneConnections, { id: uid(), fromSceneId, toSceneId, label: '' }],
  })),
  removeConnection: (id) => set((s) => ({
    sceneConnections: s.sceneConnections.filter((c) => c.id !== id),
  })),

  // ── Sprite ─────────────────────────────────────────────────────────────
  spriteSheets: [defaultSpriteSheet()],
  addSpriteSheet: () => set((s) => ({ spriteSheets: [...s.spriteSheets, defaultSpriteSheet()] })),
  updateSpriteSheet: (id, patch) => set((s) => ({
    spriteSheets: s.spriteSheets.map((sp) => (sp.id === id ? { ...sp, ...patch } : sp)),
  })),
  removeSpriteSheet: (id) => set((s) => ({ spriteSheets: s.spriteSheets.filter((sp) => sp.id !== id) })),
  addAnimation: (spriteId) => set((s) => ({
    spriteSheets: s.spriteSheets.map((sp) =>
      sp.id === spriteId ? { ...sp, animations: [...sp.animations, defaultAnimation()] } : sp
    ),
  })),
  updateAnimation: (spriteId, animId, patch) => set((s) => ({
    spriteSheets: s.spriteSheets.map((sp) =>
      sp.id !== spriteId ? sp : {
        ...sp,
        animations: sp.animations.map((a) => (a.id === animId ? { ...a, ...patch } : a)),
      }
    ),
  })),
  removeAnimation: (spriteId, animId) => set((s) => ({
    spriteSheets: s.spriteSheets.map((sp) =>
      sp.id !== spriteId ? sp : {
        ...sp,
        animations: sp.animations.filter((a) => a.id !== animId),
      }
    ),
  })),
  addFrame: (spriteId, animId) => set((s) => ({
    spriteSheets: s.spriteSheets.map((sp) =>
      sp.id !== spriteId ? sp : {
        ...sp,
        animations: sp.animations.map((a) =>
          a.id !== animId ? a : { ...a, frames: [...a.frames, { tileIndex: 0, duration: 100 }] }
        ),
      }
    ),
  })),
  updateFrame: (spriteId, animId, frameIdx, patch) => set((s) => ({
    spriteSheets: s.spriteSheets.map((sp) =>
      sp.id !== spriteId ? sp : {
        ...sp,
        animations: sp.animations.map((a) =>
          a.id !== animId ? a : {
            ...a,
            frames: a.frames.map((f, i) => (i === frameIdx ? { ...f, ...patch } : f)),
          }
        ),
      }
    ),
  })),
  removeFrame: (spriteId, animId, frameIdx) => set((s) => ({
    spriteSheets: s.spriteSheets.map((sp) =>
      sp.id !== spriteId ? sp : {
        ...sp,
        animations: sp.animations.map((a) =>
          a.id !== animId ? a : {
            ...a,
            frames: a.frames.filter((_, i) => i !== frameIdx),
          }
        ),
      }
    ),
  })),

  // ── Imagen ─────────────────────────────────────────────────────────────
  backgrounds: [defaultBackground()],
  addBackground: () => set((s) => ({ backgrounds: [...s.backgrounds, defaultBackground()] })),
  updateBackground: (id, patch) => set((s) => ({
    backgrounds: s.backgrounds.map((bg) => (bg.id === id ? { ...bg, ...patch } : bg)),
  })),
  removeBackground: (id) => set((s) => ({ backgrounds: s.backgrounds.filter((bg) => bg.id !== id) })),
  addLayer: (bgId) => set((s) => ({
    backgrounds: s.backgrounds.map((bg) =>
      bg.id === bgId ? { ...bg, layers: [...bg.layers, defaultLayer()] } : bg
    ),
  })),
  updateLayer: (bgId, layerId, patch) => set((s) => ({
    backgrounds: s.backgrounds.map((bg) =>
      bg.id !== bgId ? bg : {
        ...bg,
        layers: bg.layers.map((l) => (l.id === layerId ? { ...l, ...patch } : l)),
      }
    ),
  })),
  removeLayer: (bgId, layerId) => set((s) => ({
    backgrounds: s.backgrounds.map((bg) =>
      bg.id !== bgId ? bg : {
        ...bg,
        layers: bg.layers.filter((l) => l.id !== layerId),
      }
    ),
  })),

  // ── Music ──────────────────────────────────────────────────────────────
  songs: [defaultSong()],
  addSong: () => set((s) => ({ songs: [...s.songs, defaultSong()] })),
  updateSong: (id, patch) => set((s) => ({
    songs: s.songs.map((so) => (so.id === id ? { ...so, ...patch } : so)),
  })),
  removeSong: (id) => set((s) => ({ songs: s.songs.filter((so) => so.id !== id) })),
  addInstrument: (songId) => set((s) => ({
    songs: s.songs.map((so) =>
      so.id === songId ? { ...so, instruments: [...so.instruments, defaultInstrument()] } : so
    ),
  })),
  updateInstrument: (songId, instId, patch) => set((s) => ({
    songs: s.songs.map((so) =>
      so.id !== songId ? so : {
        ...so,
        instruments: so.instruments.map((i) => (i.id === instId ? { ...i, ...patch } : i)),
      }
    ),
  })),
  removeInstrument: (songId, instId) => set((s) => ({
    songs: s.songs.map((so) =>
      so.id !== songId ? so : {
        ...so,
        instruments: so.instruments.filter((i) => i.id !== instId),
      }
    ),
  })),
  addPattern: (songId) => set((s) => ({
    songs: s.songs.map((so) =>
      so.id === songId ? { ...so, patterns: [...so.patterns, defaultPattern()] } : so
    ),
  })),
  updatePattern: (songId, patId, patch) => set((s) => ({
    songs: s.songs.map((so) =>
      so.id !== songId ? so : {
        ...so,
        patterns: so.patterns.map((p) => (p.id === patId ? { ...p, ...patch } : p)),
      }
    ),
  })),
  removePattern: (songId, patId) => set((s) => ({
    songs: s.songs.map((so) =>
      so.id !== songId ? so : {
        ...so,
        patterns: so.patterns.filter((p) => p.id !== patId),
      }
    ),
  })),
  updateNoteRow: (songId, patId, rowIdx, patch) => set((s) => ({
    songs: s.songs.map((so) =>
      so.id !== songId ? so : {
        ...so,
        patterns: so.patterns.map((p) =>
          p.id !== patId ? p : {
            ...p,
            rows: p.rows.map((r, i) => (i === rowIdx ? { ...r, ...patch } : r)),
          }
        ),
      }
    ),
  })),

  // ── Dialogo ────────────────────────────────────────────────────────────
  dialogues: [defaultDialogueEntry()],
  addDialogue: () => set((s) => ({ dialogues: [...s.dialogues, defaultDialogueEntry()] })),
  updateDialogue: (id, patch) => set((s) => ({
    dialogues: s.dialogues.map((d) => (d.id === id ? { ...d, ...patch } : d)),
  })),
  removeDialogue: (id) => set((s) => ({ dialogues: s.dialogues.filter((d) => d.id !== id) })),
  addPage: (dialogueId) => set((s) => ({
    dialogues: s.dialogues.map((d) =>
      d.id === dialogueId
        ? { ...d, pages: [...d.pages, { id: uid(), text: '', choices: [] }] }
        : d
    ),
  })),
  updatePage: (dialogueId, pageId, patch) => set((s) => ({
    dialogues: s.dialogues.map((d) =>
      d.id !== dialogueId ? d : {
        ...d,
        pages: d.pages.map((p) => (p.id === pageId ? { ...p, ...patch } : p)),
      }
    ),
  })),
  removePage: (dialogueId, pageId) => set((s) => ({
    dialogues: s.dialogues.map((d) =>
      d.id !== dialogueId ? d : {
        ...d,
        pages: d.pages.filter((p) => p.id !== pageId),
      }
    ),
  })),
}));

export const selectProjects = (state: AppState) => state.projects;
