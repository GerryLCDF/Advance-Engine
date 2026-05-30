import { create } from 'zustand';
import type { Project, ActiveScreen, LauncherTab, CreditEntry, TemplateId } from '../types';
import type {
  EditorTab, Scene, SceneConnection, SpriteSheet, Background,
  Song, DialogueEntry, Actor, Animation, AnimationFrame,
  BackgroundLayer, Instrument, Pattern, NoteRow, ADSREnvelope,
} from '../types/editor';

const DEFAULT_CREDITS: CreditEntry[] = [
  { id: '1', name: 'Gerardo Montaño(LCDF)', role: 'Desarrollador principal', url: 'https://github.com/GerryLCDF', linkEnabled: true },
  { id: '2', name: 'Naomi rodiges', role: 'Design Consultant ', url: 'https://github.com', linkEnabled: false },
  { id: '3', name: 'Ian Tapia', role: 'Asistente de desarrollo', url: '', linkEnabled: false },
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
  x: 60, y: 20, backgroundColor: '#6b8cff', type: 'platformer', actors: [],
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
  id: uid(), name: 'Patrón 1', rows: Array.from({ length: 64 }, () => ({})),
});

const defaultNoteRow = (): NoteRow => ({
  note: '', octave: 4, instrumentId: '', effect: '',
});

const defaultSong = (): Song => ({
  id: uid(), name: 'Nueva canción', artist: '', bpm: 120,
  instruments: [defaultInstrument()],
  patterns: [defaultPattern()],
});

const mkn = (note: string, octave: number, instrumentId: string, effect = ''): NoteRow => ({ note, octave, instrumentId, effect });

const demoSong = (): Song => ({
  id: uid(), name: 'Demo Melody', artist: 'Advance Studio', bpm: 140,
  instruments: [defaultInstrument()],
  patterns: [
    // ── Alegre ──────────────────────────────────────────────────────────
    {
      id: uid(), name: 'Alegre',
      rows: Array.from({ length: 32 }, (_, step) => {
        const row: Record<string, NoteRow> = {};
        const melSteps = [0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30];
        const melNotes = ['C','D','E','G','A','G','E','D','C','E','G','A','C','A','G','E'];
        const melOcts  = [5,5,5,5,5,5,5,5,5,5,5,5,6,5,5,5];
        const mi = melSteps.indexOf(step);
        if (mi >= 0) row['ch-pulse1'] = mkn(melNotes[mi], melOcts[mi], 'preset-duty-7');
        if (step % 4 === 0) row['ch-pulse2'] = mkn(['C','G','A','F'][Math.floor(step/4)%4], 4, 'preset-duty-8');
        if (step % 8 === 0) row['ch-wave'] = mkn(['C','G','A','F'][Math.floor(step/8)%4], 2, 'preset-wave-11');
        if (step % 4 === 0) row['ch-noise'] = mkn('C', 3, 'preset-noise-1');
        return row;
      }),
    },
    // ── Oscura ───────────────────────────────────────────────────────────
    {
      id: uid(), name: 'Oscura',
      rows: Array.from({ length: 32 }, (_, step) => {
        const row: Record<string, NoteRow> = {};
        const melSteps = [0,3,6,9,12,15,18,21,24,27,30];
        const melNotes = ['D','F','G','A#','D','F','G','A#','D','F','G'];
        const melOcts  = [4,4,4,4,5,4,4,4,5,4,4];
        const mi = melSteps.indexOf(step);
        if (mi >= 0) row['ch-pulse1'] = mkn(melNotes[mi], melOcts[mi], 'preset-duty-3');
        if (step % 8 === 0) row['ch-pulse2'] = mkn('D', 3, 'preset-duty-10');
        if (step % 6 === 0) row['ch-wave'] = mkn('D', 2, 'preset-wave-6');
        if (step % 8 === 4) row['ch-noise'] = mkn('C', 3, 'preset-noise-8');
        return row;
      }),
    },
    // ── Terror ───────────────────────────────────────────────────────────
    {
      id: uid(), name: 'Terror',
      rows: Array.from({ length: 32 }, (_, step) => {
        const row: Record<string, NoteRow> = {};
        const melSteps = [0,5,10,15,20,25,30];
        const melNotes = ['C','C#','D#','C','C#','D#','C'];
        const melOcts  = [4,4,4,5,4,4,5];
        const mi = melSteps.indexOf(step);
        if (mi >= 0) row['ch-pulse1'] = mkn(melNotes[mi], melOcts[mi], 'preset-duty-13');
        if (step % 12 === 0) row['ch-pulse2'] = mkn('C', 2, 'preset-duty-11');
        if (step === 0 || step === 16) row['ch-wave'] = mkn('C', 3, 'preset-wave-14');
        if (step % 4 === 2) row['ch-noise'] = mkn('C', 3, 'preset-noise-3');
        return row;
      }),
    },
    // ── Agua ─────────────────────────────────────────────────────────────
    {
      id: uid(), name: 'Agua',
      rows: Array.from({ length: 32 }, (_, step) => {
        const row: Record<string, NoteRow> = {};
        const melSteps = [0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30];
        const melNotes = ['E','F#','G','F#','E','D','C','D','E','F#','G','A','B','A','G','F#'];
        const melOcts  = [5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5];
        const mi = melSteps.indexOf(step);
        if (mi >= 0) row['ch-pulse1'] = mkn(melNotes[mi], melOcts[mi], 'preset-duty-1');
        if (step % 6 === 0) row['ch-pulse2'] = mkn('E', 3, 'preset-duty-2');
        if (step % 8 === 0) row['ch-wave'] = mkn('E', 2, 'preset-wave-11');
        if (step % 6 === 3) row['ch-noise'] = mkn('C', 3, 'preset-noise-6');
        return row;
      }),
    },
    // ── Bosque ───────────────────────────────────────────────────────────
    {
      id: uid(), name: 'Bosque',
      rows: Array.from({ length: 32 }, (_, step) => {
        const row: Record<string, NoteRow> = {};
        const melSteps = [0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30];
        const melNotes = ['G','A','B','C','D','C','B','A','G','A','B','C','D','C','B','A'];
        const melOcts  = [4,4,4,5,5,5,4,4,4,4,4,5,5,5,4,4];
        const mi = melSteps.indexOf(step);
        if (mi >= 0) row['ch-pulse1'] = mkn(melNotes[mi], melOcts[mi], 'preset-duty-4');
        if (step % 8 === 0) row['ch-pulse2'] = mkn('G', 3, 'preset-duty-5');
        if (step % 4 === 0) row['ch-wave'] = mkn('G', 2, 'preset-wave-3');
        if (step % 8 === 6) row['ch-noise'] = mkn('C', 3, 'preset-noise-5');
        return row;
      }),
    },
  ],
});

const marioSong = (): Song => ({
  id: uid(), name: 'Super Mario World', artist: 'Nintendo (cover)', bpm: 146,
  instruments: [defaultInstrument()],
  patterns: [
    {
      id: uid(), name: 'Theme A',
      rows: Array.from({ length: 32 }, (_, step) => {
        const row: Record<string, NoteRow> = {};

        // Lead melody (Pulse 1 - bright 12.5%)
        const leadSteps = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,24,25,26,28,29,30];
        const leadNotes = ['C','E','G','C','B','G','E','C','D','F','A','D','C','A','F','D','C','E','G','E','C','E','G','A','C','E','A','G','E','C'];
        const leadOcts  = [5,5,5,6,5,5,5,5,5,5,5,6,6,5,5,5,5,5,5,5,5,5,5,4,5,5,5,5,5,5];
        const li = leadSteps.indexOf(step);
        if (li >= 0) row['ch-pulse1'] = mkn(leadNotes[li], leadOcts[li], 'preset-duty-7');

        // Harmony (Pulse 2 - 25%)
        if (step % 2 === 0) {
          const harmNotes = ['C','C','G','G','D','D','A','A','C','C','G','G','E','E','G','G']
            .map((n, i) => ({ note: n, oct: Math.floor(i/4) < 2 ? 5 : 4, idx: i }));
          const hi = Math.floor(step / 2) % 16;
          if (hi < harmNotes.length) row['ch-pulse2'] = mkn(harmNotes[hi].note, harmNotes[hi].oct, 'preset-duty-8');
        }

        // Bass (Wave - triangular)
        if (step % 4 === 0) {
          const bassNotes = ['C','C','D','D','C','C','A','A'];
          const bassOcts  = [3,3,3,3,3,3,2,2];
          const bi = Math.floor(step / 4) % 8;
          row['ch-wave'] = mkn(bassNotes[bi], bassOcts[bi], 'preset-wave-11');
        }

        // Percussion (Noise)
        if (step % 4 === 0) row['ch-noise'] = mkn('C', 3, 'preset-noise-4');
        if (step % 4 === 2) row['ch-noise'] = mkn('C', 3, 'preset-noise-5');

        return row;
      }),
    },
    {
      id: uid(), name: 'Theme B',
      rows: Array.from({ length: 32 }, (_, step) => {
        const row: Record<string, NoteRow> = {};

        // Lead melody (Pulse 1)
        const leadSteps = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,16,17,18,20,21,22,24,25,26,28,29,30];
        const leadNotes = ['G','B','D','G','E','D','C','B','C','E','G','C','A','G','F','D','G','B','C','B','A','E','C','B','G','E','C'];
        const leadOcts  = [4,4,5,5,5,5,5,4,5,5,5,6,5,5,5,5,4,5,6,5,5,5,6,5,5,5,5];
        const li = leadSteps.indexOf(step);
        if (li >= 0) row['ch-pulse1'] = mkn(leadNotes[li], leadOcts[li], 'preset-duty-7');

        // Harmony (Pulse 2)
        if (step % 2 === 0) {
          const harmNotes = ['G','G','E','E','C','C','D','D','E','E','C','C','D','D','G','G']
            .map((n, i) => ({ note: n, oct: 4, idx: i }));
          const hi = Math.floor(step / 2) % 16;
          if (hi < harmNotes.length) row['ch-pulse2'] = mkn(harmNotes[hi].note, harmNotes[hi].oct, 'preset-duty-8');
        }

        // Bass (Wave)
        if (step % 4 === 0) {
          const bassNotes = ['G','G','C','C','F','F','E','E'];
          const bassOcts  = [3,3,3,3,2,2,2,2];
          const bi = Math.floor(step / 4) % 8;
          row['ch-wave'] = mkn(bassNotes[bi], bassOcts[bi], 'preset-wave-11');
        }

        // Percussion
        if (step % 4 === 0) row['ch-noise'] = mkn('C', 3, 'preset-noise-4');
        if (step % 4 === 2) row['ch-noise'] = mkn('C', 3, 'preset-noise-5');

        return row;
      }),
    },
  ],
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
  dirty: boolean;
  setDirty: (val: boolean) => void;
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

  // ── Settings ───────────────────────────────────────────────────────────
  defaultEditorTab: EditorTab;
  setDefaultEditorTab: (tab: EditorTab) => void;
  pianoRollBg: 'lines' | 'checkerboard';
  setPianoRollBg: (val: 'lines' | 'checkerboard') => void;
  defaultMusicView: 'tracker' | 'piano';
  setDefaultMusicView: (val: 'tracker' | 'piano') => void;
  keyWhiteColor: string;
  keyBlackColor: string;
  setKeyColors: (white: string, black: string) => void;
  chunkCols: number;
  chunkRows: number;
  setChunkCols: (val: number) => void;
  setChunkRows: (val: number) => void;
  showGrid: boolean;
  setShowGrid: (val: boolean) => void;
  gridLineOpacity: number;
  imageSmoothing: boolean;
  setImageSmoothing: (val: boolean) => void;
  setGridLineOpacity: (val: number) => void;

  // ── Pipeline / Proyecto ─────────────────────────────────────────────────
  projectDir: string | null;
  setProjectDir: (dir: string | null) => void;
  exportLog: string[];
  addExportLog: (msg: string) => void;
  clearExportLog: () => void;
  generateBuildFiles: () => Promise<boolean>;
  saveProject: () => Promise<boolean>;
  loadProject: (path: string) => Promise<boolean>;
  exportGBA: () => Promise<boolean>;

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

  // ── Zoom persistence (across tab switches) ───────────────────────────
  spriteZoom: number;
  imagenZoom: number;
  setSpriteZoom: (z: number) => void;
  setImagenZoom: (z: number) => void;

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
  updateNoteRow: (songId: string, patId: string, rowIdx: number, channelId: string, patch: Partial<NoteRow>) => void;
  removeNoteRow: (songId: string, patId: string, rowIdx: number, channelId: string) => void;

  // ── Undo / Redo for songs ──────────────────────────────────────────────
  _songsUndoStack: Song[][];
  _songsRedoStack: Song[][];
  _snapshotSongs: () => void;
  undo: () => void;
  redo: () => void;

  // ── Dialogo ────────────────────────────────────────────────────────────
  dialogues: DialogueEntry[];
  addDialogue: () => void;
  updateDialogue: (id: string, patch: Partial<DialogueEntry>) => void;
  removeDialogue: (id: string) => void;
  addPage: (dialogueId: string) => void;
  updatePage: (dialogueId: string, pageId: string, patch: Partial<DialogueEntry['pages'][0]>) => void;
  removePage: (dialogueId: string, pageId: string) => void;

  // ── Sound / Script ──────────────────────────────────────────────────────
  sounds: any[];
  addSound: () => void;
  scripts: any[];
  addScript: () => void;
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
      const api = window.advanceAPI;
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
      const api = window.advanceAPI;
      if (api) {
        const res = await api.projects.create(data);
        if (res.success && res.project) {
          const project = res.project;
          set((s) => ({ projects: [project, ...s.projects] }));
          return project;
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
      const api = window.advanceAPI;
      if (api) await api.projects.update(id, data);
      set((s) => ({
        projects: s.projects.map((p) => (p.id === id ? { ...p, ...data } : p)),
      }));
    } catch { /* ignore */ }
  },
  deleteProject: async (id) => {
    try {
      const api = window.advanceAPI;
      if (api) await api.projects.delete(id);
    } catch { /* ignore */ }
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
  },
  openProject: async (id) => {
    try {
      const api = window.advanceAPI;
      if (api) api.projects.setLastOpened(id);
    } catch { /* ignore */ }
    // Compute correct path from project name
    const project = get().projects.find((p) => p.id === id);
    const projectsDir = await window.advanceAPI?.project?.ensureProjectsDir();
    const computedPath = project && projectsDir
      ? projectsDir + '\\' + project.name
      : project?.path || null;
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === id ? { ...p, lastOpened: new Date().toISOString() } : p
      ),
      activeScreen: { type: 'editor', projectId: id },
      editorProjectId: id,
      projectDir: computedPath,
      scenes: [],
      sceneConnections: [],
      spriteSheets: [],
      backgrounds: [],
      songs: [],
      dialogues: [],
      sounds: [],
      scripts: [],
      dirty: false,
      exportLog: [],
      selectedNodeId: '',
      _songsUndoStack: [],
      _songsRedoStack: [],
    }));
    // Cargar datos guardados del proyecto
    const st = get();
    if (st.projectDir) {
      get().loadProject(st.projectDir);
    }
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
  dirty: false,
  setDirty: (val) => set({ dirty: val }),
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

  // ── Settings ───────────────────────────────────────────────────────────
  defaultEditorTab: 'mundo',
  setDefaultEditorTab: (tab) => set({ defaultEditorTab: tab }),
  pianoRollBg: 'lines',
  setPianoRollBg: (val) => set({ pianoRollBg: val }),
  defaultMusicView: 'piano',
  setDefaultMusicView: (val) => set({ defaultMusicView: val }),
  keyWhiteColor: '#e8e4db',
  keyBlackColor: '#1a1a1a',
  setKeyColors: (white, black) => set({ keyWhiteColor: white, keyBlackColor: black }),
  chunkCols: 4,
  chunkRows: 6,
  setChunkCols: (val) => set({ chunkCols: val }),
  setChunkRows: (val) => set({ chunkRows: val }),
  showGrid: true,
  setShowGrid: (val) => set({ showGrid: val }),
  gridLineOpacity: 0.08,
  setGridLineOpacity: (val) => set({ gridLineOpacity: val }),
  imageSmoothing: false,
  setImageSmoothing: (val) => set({ imageSmoothing: val }),

  // ── Pipeline / Proyecto ─────────────────────────────────────────────────
  projectDir: null,
  setProjectDir: (dir) => set({ projectDir: dir }),
  exportLog: [],
  addExportLog: (msg) => set((s) => ({ exportLog: [...s.exportLog, msg] })),
  clearExportLog: () => set({ exportLog: [] }),
  generateBuildFiles: async () => {
    try {
      const state = get();
      const projectDir = state.projectDir;
      const project = state.projects.find((p) => p.id === state.editorProjectId);
      if (!projectDir || !project) return false;
      const { generateGBAProject, generateMakefile, createLog } = await import('../utils/gba_export');
      const log = createLog();
      const cCode = generateGBAProject({
        scenes: state.scenes,
        sceneConnections: state.sceneConnections,
        backgrounds: state.backgrounds ?? [],
        sprites: state.spriteSheets ?? [],
        songs: state.songs,
        sounds: state.sounds ?? [],
        dialogues: state.dialogues ?? [],
        scripts: state.scripts ?? [],
      }, project.name, project.author, log);
      const makefile = generateMakefile(project.name, log);
      const api = window.advanceAPI;
      const buildDir = `${projectDir}/build`;
      await api.dir.create(buildDir);
      await api.file.writeText(`${buildDir}/main.c`, cCode);
      await api.file.writeText(`${buildDir}/Makefile`, makefile);
      return true;
    } catch { return false; }
  },
  saveProject: async () => {
    try {
      const api = window.advanceAPI;
      const state = get();
      const project = state.projects.find((p) => p.id === state.editorProjectId);
      if (!project) { set((s) => ({ exportLog: [...s.exportLog, '[ERROR] No hay proyecto abierto'] })); return false; }
      const result = await api.project.save(project.id, {
        name: project.name,
        state: {
          scenes: state.scenes,
          sceneConnections: state.sceneConnections,
          backgrounds: state.backgrounds ?? [],
          sprites: state.spriteSheets ?? [],
          songs: state.songs,
          sounds: state.sounds ?? [],
          dialogues: state.dialogues ?? [],
          scripts: state.scripts ?? [],
        },
      });
      if (result.success) {
        set({ projectDir: result.path, dirty: false, exportLog: [...get().exportLog, `[OK] Proyecto guardado en ${result.path}`] });
        get().updateProject(project.id, { path: result.path });
        get().generateBuildFiles();
        return true;
      }
      set((s) => ({ exportLog: [...s.exportLog, `[ERROR] ${result.reason}`] }));
      return false;
    } catch (err: any) {
      set((s) => ({ exportLog: [...s.exportLog, `[ERROR] ${String(err)}`] }));
      return false;
    }
  },
  loadProject: async (path) => {
    try {
      const api = window.advanceAPI;
      set((s) => ({ exportLog: [...s.exportLog, `[INFO] Cargando proyecto: ${path}`] }));
      const result = await api.project.load(path);
      if (!result.success || !result.state) {
        set((s) => ({ exportLog: [...s.exportLog, `[ERROR] ${result.reason}`] }));
        return false;
      }
      set({
        projectDir: path,
        scenes: result.state.scenes ?? [],
        sceneConnections: result.state.sceneConnections ?? [],
        backgrounds: result.state.backgrounds ?? [],
        spriteSheets: result.state.sprites ?? [],
        songs: result.state.songs ?? [],
        sounds: result.state.sounds ?? [],
        dialogues: result.state.dialogues ?? [],
        scripts: result.state.scripts ?? [],
        dirty: false,
        exportLog: [...get().exportLog, `[OK] Proyecto cargado: ${result.manifest?.name ?? 'Sin nombre'}`],
      });
      return true;
    } catch (err: any) {
      set((s) => ({ exportLog: [...s.exportLog, `[ERROR] ${String(err)}`] }));
      return false;
    }
  },
  exportGBA: async () => {
    try {
      const state = get();
      const project = state.projects.find((p) => p.id === state.editorProjectId);
      const projectDir = state.projectDir;
      if (!projectDir) {
        set((s) => ({ exportLog: [...s.exportLog, '[ERROR] Guarda el proyecto antes de exportar'] }));
        return false;
      }
      await get().generateBuildFiles();
      const { createLog } = await import('../utils/gba_export');
      const log = createLog();
      log.add('=== INICIANDO EXPORTACIÓN GBA ===');
      const api = window.advanceAPI;
      const buildDir = `${projectDir}/build`;
      log.add('Compilando ROM...');
      const result = await api.system.runCommand('make -j4', buildDir);
      if (result.success) {
        log.add('=== ROM GENERADA ===');
        set((s) => ({ exportLog: [...s.exportLog, ...log.messages, `[OK] ROM compilada en ${buildDir}`, result.output ? result.output.split('\n').filter(l => l.trim()).slice(-5).join('\n') : ''] }));
      } else {
        log.add(`=== ERROR DE COMPILACIÓN ===`);
        set((s) => ({ exportLog: [...s.exportLog, ...log.messages, `[ERROR] ${result.output}`] }));
      }
      return true;
    } catch (err: any) {
      set((s) => ({ exportLog: [...s.exportLog, `[ERROR] ${String(err)}`] }));
      return false;
    }
  },

  // ── Mundo ──────────────────────────────────────────────────────────────
  scenes: [defaultScene()],
  addScene: () => set((s) => {
    const baseName = 'Escena';
    const names = s.scenes.map((sc) => sc.name);
    let num = 1;
    while (names.includes(`${baseName} ${num}`)) num++;
    return { scenes: [...s.scenes, { ...defaultScene(), name: `${baseName} ${num}` }] };
  }),
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

  // ── Zoom persistence ───────────────────────────────────────────────────
  spriteZoom: 120,
  imagenZoom: 1,
  setSpriteZoom: (z) => set({ spriteZoom: z }),
  setImagenZoom: (z) => set({ imagenZoom: z }),

  // ── Music ──────────────────────────────────────────────────────────────
  songs: [defaultSong(), demoSong(), marioSong()],
  addSong: () => { get()._snapshotSongs(); set((s) => ({ songs: [...s.songs, defaultSong()] })); },

  updateSong: (id, patch) => { get()._snapshotSongs(); set((s) => ({
    songs: s.songs.map((so) => (so.id === id ? { ...so, ...patch } : so)),
  })); },

  removeSong: (id) => { get()._snapshotSongs(); set((s) => ({ songs: s.songs.filter((so) => so.id !== id) })); },

  addInstrument: (songId) => { get()._snapshotSongs(); set((s) => ({
    songs: s.songs.map((so) =>
      so.id === songId ? { ...so, instruments: [...so.instruments, defaultInstrument()] } : so
    ),
  })); },

  updateInstrument: (songId, instId, patch) => { get()._snapshotSongs(); set((s) => ({
    songs: s.songs.map((so) =>
      so.id !== songId ? so : {
        ...so,
        instruments: so.instruments.map((i) => (i.id === instId ? { ...i, ...patch } : i)),
      }
    ),
  })); },

  removeInstrument: (songId, instId) => { get()._snapshotSongs(); set((s) => ({
    songs: s.songs.map((so) =>
      so.id !== songId ? so : {
        ...so,
        instruments: so.instruments.filter((i) => i.id !== instId),
      }
    ),
  })); },

  addPattern: (songId) => { get()._snapshotSongs(); set((s) => ({
    songs: s.songs.map((so) =>
      so.id === songId ? { ...so, patterns: [...so.patterns, defaultPattern()] } : so
    ),
  })); },

  updatePattern: (songId, patId, patch) => { get()._snapshotSongs(); set((s) => ({
    songs: s.songs.map((so) =>
      so.id !== songId ? so : {
        ...so,
        patterns: so.patterns.map((p) => (p.id === patId ? { ...p, ...patch } : p)),
      }
    ),
  })); },

  removePattern: (songId, patId) => { get()._snapshotSongs(); set((s) => ({
    songs: s.songs.map((so) =>
      so.id !== songId ? so : {
        ...so,
        patterns: so.patterns.filter((p) => p.id !== patId),
      }
    ),
  })); },

  updateNoteRow: (songId, patId, rowIdx, channelId, patch) => { get()._snapshotSongs(); set((s) => ({
    songs: s.songs.map((so) =>
      so.id !== songId ? so : {
        ...so,
        patterns: so.patterns.map((p) =>
          p.id !== patId ? p : {
            ...p,
            rows: p.rows.map((r, i) =>
              i !== rowIdx ? r : {
                ...r,
                [channelId]: { ...(r[channelId] ?? { note: '', octave: 4, instrumentId: '', effect: '' }), ...patch },
              }
            ),
          }
        ),
      }
    ),
  })); },

  removeNoteRow: (songId, patId, rowIdx, channelId) => { get()._snapshotSongs(); set((s) => ({
    songs: s.songs.map((so) =>
      so.id !== songId ? so : {
        ...so,
        patterns: so.patterns.map((p) =>
          p.id !== patId ? p : {
            ...p,
            rows: p.rows.map((r, i) => {
              if (i !== rowIdx) return r;
              const { [channelId]: _, ...rest } = r;
              return rest;
            }),
          }
        ),
      }
    ),
  })); },

  // ── Undo / Redo for songs ──────────────────────────────────────────────
  _songsUndoStack: [],
  _songsRedoStack: [],

  _snapshotSongs: () => set((s) => ({
    _songsUndoStack: [...(s._songsUndoStack ?? []).slice(-49), s.songs],
    _songsRedoStack: [],
  })),

  undo: () => set((s) => {
    const stack = s._songsUndoStack ?? [];
    if (stack.length === 0) return s;
    const prev = stack[stack.length - 1];
    return {
      songs: prev,
      _songsUndoStack: stack.slice(0, -1),
      _songsRedoStack: [...(s._songsRedoStack ?? []), s.songs],
    };
  }),

  redo: () => set((s) => {
    const stack = s._songsRedoStack ?? [];
    if (stack.length === 0) return s;
    const next = stack[stack.length - 1];
    return {
      songs: next,
      _songsRedoStack: stack.slice(0, -1),
      _songsUndoStack: [...(s._songsUndoStack ?? []), s.songs],
    };
  }),

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
  sounds: [],
  addSound: () => set((s) => ({ sounds: [...s.sounds, { id: Date.now().toString(), name: 'Nuevo sonido' }] })),
  scripts: [],
  addScript: () => set((s) => ({ scripts: [...s.scripts, { id: Date.now().toString(), name: 'Nuevo script', code: '' }] })),
}));

export const selectProjects = (state: AppState) => state.projects;
