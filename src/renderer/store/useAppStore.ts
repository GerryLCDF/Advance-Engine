import { create } from 'zustand';
import type { Project, ActiveScreen, LauncherTab, CreditEntry, TemplateId } from '../types';
import type {
  EditorTab, Scene, SceneConnection, SpriteSheet, Background,
  Song, DialogueEntry, Actor, Animation, AnimationFrame,
  BackgroundLayer, Instrument, Pattern, NoteRow, ADSREnvelope, SplashScreen, FxAsset, SoundEffect, ScriptMode, ScriptData, TransitionConfig,
} from '../types/editor';
import { createCollisionMap, makeDefaultConnection, defaultSoundEffect } from '../types/editor';
import type { GBAExportedActor, GBAExportedActorFrame, GBAExportedSceneBundle, GBASceneTransition } from '../utils/gba_export';
import { scriptEffectiveCCode, acodSkeleton } from '../utils/advanceCode';

const DEFAULT_CREDITS: CreditEntry[] = [
  { id: '1', name: 'Gerardo Montaño(LCDF)', role: 'Desarrollador principal', url: 'https://github.com/GerryLCDF', linkEnabled: true },
  { id: '2', name: 'Naomi rodiges', role: 'Design Consultant ', url: 'https://github.com', linkEnabled: false },
  { id: '3', name: 'Ian Tapia', role: 'Asistente de desarrollo', url: '', linkEnabled: false },
  { id: '4', name: 'Tabler Icons', role: 'Iconos UI (MIT License, © 2024-2026 Paweł Kuna)', url: 'https://tabler.io/icons', linkEnabled: true },
];

const DEMO_PROJECTS: Project[] = [
  { id: 'demo1', name: 'Proyecto tringa jsjsjs', author: 'Dev', path: 'C:/proyectos/tringa', template: 'cartuchotransparente', coverPath: '', lastOpened: '2026-05-02T00:00:00Z' },
  { id: 'demo2', name: 'atrapalos a todozzzzzz', author: 'Dev', path: 'C:/proyectos/atrapalos', template: 'cartucho_color', coverPath: '', lastOpened: '2026-04-08T00:00:00Z' },
  { id: 'demo3', name: 'Proyecto elefantitos', author: 'Dev', path: 'C:/proyectos/elefantitos', template: 'cartucho', coverPath: '', lastOpened: '2026-01-01T00:00:00Z' },
];

// ── Helpers ──────────────────────────────────────────────────────────────
let _nextId = 1;
const uid = () => `e${_nextId++}_${Date.now()}`;
let _copiedScene: Scene | null = null;
let _copiedAnimation: Animation | null = null;
let _copiedAnimationFrame: { frame: AnimationFrame; animId: string } | null = null;

const defaultScene = (): Scene => ({
  id: uid(), name: 'Nueva escena', width: 240, height: 160,
  x: 60, y: 20, cameraX: 0, cameraY: 0,
  backgroundColor: '#6b8cff', type: 'platformer', actors: [],
  collisionTileSize: 8, collisionMap: createCollisionMap(240, 160, 8),
});

const defaultSplashScreen = (): SplashScreen => ({
  id: '__splash__', name: 'SplashScreen', x: 60, y: -120,
  duration: 3,
  usePauseScreen: false,
  pauseColor: '#000000',
  entryTransition: { type: 'fade' as const, duration: 0.5, gradientId: '', tilesetId: '', tileSize: 8, animSpeed: 5 },
  exitTransition: { type: 'fade' as const, duration: 0.5, gradientId: '', tilesetId: '', tileSize: 8, animSpeed: 5 },
});

const defaultActor = (): Actor => ({
  id: uid(), name: 'Nuevo actor', type: 'estatico',
  x: 0, y: 0, width: 16, height: 16, z: 0,
  spriteId: '', animId: '',
  collider: false, colliderWidth: 16, colliderHeight: 16,
  colliderOffsetX: 0, colliderOffsetY: 0,
  properties: {},
});

const defaultSpriteSheet = (): SpriteSheet => ({
  id: uid(), name: 'Nuevo sprite', tilesetPath: '',
  tileWidth: 8, tileHeight: 8, cols: 4, rows: 4, animations: [], skippedFrames: [],
});

const defaultAnimation = (): Animation => ({
  id: uid(), name: 'Nueva animación', frames: [], mode: 'loop', speed: 1,
});

const defaultBackground = (): Background => ({
  id: uid(), name: 'Nuevo fondo', layers: [],
});

const defaultLayer = (): BackgroundLayer => ({
  id: uid(), imagePath: '', parallaxX: 1, parallaxY: 1, speed: 1, visible: true, rescale: false,
  animated: false, animationSpeed: 5, animationLoop: 'loop',
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
  flatColors: boolean;
  setFlatColors: (val: boolean) => void;
  codeFontSize: number;
  setCodeFontSize: (val: number) => void;
  setGridLineOpacity: (val: number) => void;
  mundoShowGrid: boolean;
  setMundoShowGrid: (val: boolean) => void;
  mundoGridSize: number;
  setMundoGridSize: (val: number) => void;
  mundoGridOpacity: number;
  setMundoGridOpacity: (val: number) => void;
  mundoGridStrokeWidth: number;
  setMundoGridStrokeWidth: (val: number) => void;
  mundoGridColor: string;
  setMundoGridColor: (val: string) => void;
  connColorOut: string;
  setConnColorOut: (val: string) => void;
  connColorIn: string;
  setConnColorIn: (val: string) => void;
  connStrokeWidth: number;
  setConnStrokeWidth: (val: number) => void;
  clickAnimation: boolean;
  setClickAnimation: (val: boolean) => void;

  // ── Pipeline / Proyecto ─────────────────────────────────────────────────
  projectDir: string | null;
  setProjectDir: (dir: string | null) => void;
  resetEditorState: () => void;
  exportLog: string[];
  addExportLog: (msg: string) => void;
  clearExportLog: () => void;
  /**
   * Genera main.c + Makefile en <proyecto>/build.
   *
   * `verbose: false` no publica las ~40 líneas de detalle en el log. Se usa al
   * guardar: guardar también regenera los ficheros (para que el build esté
   * siempre al día) y, si publicara el detalle, cada Ctrl+S añadía otro bloque
   * entero de [INFO] y el log se volvía ilegible a los pocos_guardados.
   */
  generateBuildFiles: (opts?: { verbose?: boolean }) => Promise<boolean>;
  /** Vacía el log: se llama al empezar una exportación o un Play. */
  beginExportRun: () => void;
  saveProject: () => Promise<boolean>;
  loadProject: (path: string) => Promise<boolean>;
  exportGBA: () => Promise<boolean>;
  playEmulator: () => Promise<boolean>;
  stopEmulator: () => Promise<boolean>;

  // ── Mundo ──────────────────────────────────────────────────────────────
  scenes: Scene[];
  addScene: (x?: number, y?: number) => void;
  updateScene: (id: string, patch: Partial<Scene>) => void;
  removeScene: (id: string) => void;
  setCollisionTile: (sceneId: string, col: number, row: number, value: number) => void;
  batchCollisionTiles: (sceneId: string, tiles: [number, number, number][]) => void;
  clearCollisionMap: (sceneId: string) => void;
  addActor: (sceneId: string, overrides?: Partial<Actor>) => string;
  updateActor: (sceneId: string, actorId: string, patch: Partial<Actor>) => void;
  removeActor: (sceneId: string, actorId: string) => void;
  sceneConnections: SceneConnection[];
  addConnection: (fromSceneId: string, toSceneId: string) => void;
  removeConnection: (id: string) => void;
  updateConnection: (id: string, patch: Partial<SceneConnection>) => void;

  // ── SplashScreen ────────────────────────────────────────────────────────
  splashScreen: SplashScreen;
  updateSplashScreen: (patch: Partial<SplashScreen>) => void;

  // ── Sprite editor session state (used by menu bar / global shortcuts) ──
  previewAnimId: string | null;
  setPreviewAnimId: (id: string | null) => void;
  currentFrameIdx: number;
  setCurrentFrameIdx: (idx: number) => void;

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

  // ── Undo / Redo for Sprite sheets ──────────────────────────────────────
  _spriteUndoStack: SpriteSheet[][];
  _spriteRedoStack: SpriteSheet[][];
  _snapshotSprite: () => void;
  spriteUndo: () => void;
  spriteRedo: () => void;

  // ── Sprite clipboard actions ───────────────────────────────────────────
  copyAnimation: (spriteId: string, animId: string) => void;
  pasteAnimation: (spriteId: string) => void;
  cutAnimation: (spriteId: string, animId: string) => void;
  copyFrame: (spriteId: string, animId: string, frameIdx: number) => void;
  pasteFrame: (spriteId: string, animId: string) => void;
  cutFrame: (spriteId: string, animId: string, frameIdx: number) => void;
  deleteFrame: (spriteId: string, animId: string, frameIdx: number) => void;

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

  // ── Undo / Redo for Mundo ──────────────────────────────────────────────
  _mundoUndoStack: { scenes: Scene[]; sceneConnections: SceneConnection[] }[];
  _mundoRedoStack: { scenes: Scene[]; sceneConnections: SceneConnection[] }[];
  _snapshotMundo: () => void;
  mundoUndo: () => void;
  mundoRedo: () => void;
  copyScene: (id: string) => void;
  pasteScene: (x?: number, y?: number) => void;

  // ── Dialogo ────────────────────────────────────────────────────────────
  dialogues: DialogueEntry[];
  addDialogue: () => void;
  updateDialogue: (id: string, patch: Partial<DialogueEntry>) => void;
  removeDialogue: (id: string) => void;
  addPage: (dialogueId: string) => void;
  updatePage: (dialogueId: string, pageId: string, patch: Partial<DialogueEntry['pages'][0]>) => void;
  removePage: (dialogueId: string, pageId: string) => void;

  // ── Sound / Script / FX ─────────────────────────────────────────────────
  sounds: SoundEffect[];
  addSound: (overrides?: Partial<SoundEffect>) => string;
  updateSound: (id: string, patch: Partial<SoundEffect>) => void;
  removeSound: (id: string) => void;
  scripts: ScriptData[];
  addScript: (mode?: ScriptMode) => string;
  updateScript: (id: string, patch: Partial<ScriptData>) => void;
  removeScript: (id: string) => void;
  setScriptMode: (id: string, mode: ScriptMode) => void;
  fxAssets: FxAsset[];
  addFxAsset: (asset: FxAsset) => void;
  removeFxAsset: (id: string) => void;
  updateFxAsset: (id: string, patch: Partial<FxAsset>) => void;
}

/**
 * Tope de líneas del log de exportación.
 *
 * El log crece con cada operación (compilación, emulador, avisos globales) y sin
 * tope una sesión larga acaba con decenas de miles de líneas: a partir de cierto
 * punto.scrollback se come la CPU y leerlo es inútil. Se queda solo el final,
 * que es donde está el error.
 */
const LOG_MAX = 600;

// ── Global settings persistence (localStorage) ──────────────────────────────
const GLOBAL_SETTINGS_KEY = 'advance-engine-settings';

interface GlobalSettings {
  mundoShowGrid: boolean; mundoGridSize: number; mundoGridOpacity: number;
  mundoGridStrokeWidth: number; mundoGridColor: string;
  connColorOut: string; connColorIn: string; connStrokeWidth: number;
  clickAnimation: boolean; showGrid: boolean; gridLineOpacity: number; imageSmoothing: boolean;
  flatColors: boolean; codeFontSize: number;
}

function loadGlobalSettings(): Partial<GlobalSettings> {
  try {
    const raw = localStorage.getItem(GLOBAL_SETTINGS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch { return {}; }
}

const _saved = loadGlobalSettings();

// Tamaño de letra del editor de código (Ctrl+rueda); 9–26 px
const CODE_FONT_MIN = 9;
const CODE_FONT_MAX = 26;
const clampFontSize = (v: number) =>
  Math.max(CODE_FONT_MIN, Math.min(CODE_FONT_MAX, Math.round(v) || 12));

// ── Transiciones de conexión (se reproducen al cambiar de escena) ─────────
// Extraen el tileset y el gradiente de una transición (reutiliza el mismo
// formato .h / conversión que las del splash) para que switchScene(n) use la
// animación configurada en la conexión origen→destino.
interface TransitionTileset {
  cArray: string;
  tileSize: number;
  frames: number;
  fw: number;
  fh: number;
  name: string;
}

interface TransitionGradient {
  cArray: string;
  w: number;
  h: number;
}

async function extractTilesetForTransition(
  transition: TransitionConfig | undefined,
  fxAssets: FxAsset[],
  log: { add: (m: string) => void },
  label: string,
): Promise<TransitionTileset | null> {
  if (!transition?.tilesetId || !transition?.tileSize) {
    log.add(`[WARN] ${label}: transicion sin tileset o tileSize`);
    return null;
  }
  const asset = fxAssets.find((a) => a.id === transition.tilesetId);
  if (!asset) {
    log.add(`[WARN] ${label}: tileset ID "${transition.tilesetId}" no encontrado en assets`);
    return null;
  }
  const api = window.advanceAPI;
  const tileSize = transition.tileSize;
  const valToMask = (n: number): number => {
    const r = n & 0x1F, g = (n >> 5) & 0x1F, b = (n >> 10) & 0x1F;
    return (r + g + b) >= 30 ? 1 : 0;
  };
  const buildPixelFrameArray = (frameData: number[][]): string => {
    const lines: string[] = [];
    for (let y = 0; y < frameData.length; y++) {
      lines.push('    {' + frameData[y].map((v) => (v ? '0x7FFF' : '0x0000')).join(',') + '}');
    }
    return '{\n' + lines.join(',\n') + '\n  }';
  };
  const buildFrames = (srcVals: number[], sw: number, sh: number, cols: number, rows: number): { cArray: string; fw: number; fh: number } => {
    const totalFrames = cols * rows;
    const fw = sw / cols;
    const fh = sh / rows;
    const frameArrays: string[] = [];
    for (let f = 0; f < totalFrames; f++) {
      const fCol = f % cols;
      const fRow = Math.floor(f / cols);
      const frameData: number[][] = [];
      for (let py = 0; py < fh; py++) {
        const row: number[] = [];
        for (let px = 0; px < fw; px++) {
          const srcIdx = (fRow * fh + py) * sw + (fCol * fw + px);
          row.push(srcVals[srcIdx] || 0);
        }
        frameData.push(row);
      }
      frameArrays.push(`  // Frame ${f}\n  ${buildPixelFrameArray(frameData)}`);
    }
    return { cArray: `static const u16 gTilesetPixel[${totalFrames}][${fh}][${fw}] = {\n${frameArrays.join(',\n')},\n};`, fw, fh };
  };
  try {
    let cArray: string | undefined;
    let fw = 0, fh = 0, frames = 0;
    if (asset.hFilePath) {
      const hRead = await api.file.readText(asset.hFilePath);
      if (hRead.success && hRead.data) {
        const hd = hRead.data;
        const wMatch = hd.match(/#define\s+TILESET_W\s+(\d+)/);
        const hMatch = hd.match(/#define\s+TILESET_H\s+(\d+)/);
        const cMatch = hd.match(/#define\s+TILESET_COLS\s+(\d+)/);
        const rMatch = hd.match(/#define\s+TILESET_ROWS\s+(\d+)/);
        const dMatch = hd.match(/tilesetData\[\d+\]\s*=\s*\{([\s\S]*?)\};/);
        if (wMatch && hMatch && cMatch && rMatch && dMatch) {
          const sw = parseInt(wMatch[1]);
          const sh = parseInt(hMatch[1]);
          const cols = parseInt(cMatch[1]);
          const rows = parseInt(rMatch[1]);
          const hexVals = dMatch[1].replace(/\s+/g, '').split(',').filter(Boolean);
          const srcVals = hexVals.map((s) => { const n = parseInt(s.trim(), 16); return isNaN(n) ? 0 : valToMask(n); });
          const built = buildFrames(srcVals, sw, sh, cols, rows);
          cArray = built.cArray; fw = built.fw; fh = built.fh; frames = cols * rows;
          log.add(`${label}: usado .h pre-generado "${asset.hFilePath.split(/[\\/]/).pop()}" (${sw}x${sh})`);
        } else {
          log.add(`[WARN] ${label}: .h sin tilesetData valido, fallback a conversion`);
        }
      } else {
        log.add(`[WARN] ${label}: no se pudo leer .h, fallback a conversion`);
      }
    }
    if (!cArray) {
      const gbaResult = await api.file.convertImageToGbaBase64Exact(asset.filePath);
      if (gbaResult.success && gbaResult.base64) {
        const binaryStr = atob(gbaResult.base64);
        const sw = gbaResult.width!;
        const sh = gbaResult.height!;
        const cols = asset.cols;
        const rows = asset.rows;
        const srcVals: number[] = [];
        for (let y = 0; y < sh; y++) {
          for (let x = 0; x < sw; x++) {
            const idx = (y * sw + x) * 2;
            srcVals.push(valToMask((binaryStr.charCodeAt(idx + 1) << 8) | binaryStr.charCodeAt(idx)));
          }
        }
        const built = buildFrames(srcVals, sw, sh, cols, rows);
        cArray = built.cArray; fw = built.fw; fh = built.fh; frames = cols * rows;
        log.add(`${label}: tileset convertido (${sw}x${sh}, ${cols}x${rows} frames)`);
      } else {
        log.add(`[WARN] ${label}: falló conversión del tileset — ${gbaResult.reason || 'desconocido'}`);
      }
    }
    if (!cArray) return null;
    return { cArray, tileSize, frames, fw, fh, name: asset.name };
  } catch (err: any) {
    log.add(`[WARN] ${label}: error — ${String(err)}`);
    return null;
  }
}

async function extractGradientForTransition(
  transition: TransitionConfig | undefined,
  fxAssets: FxAsset[],
  log: { add: (m: string) => void },
  label: string,
): Promise<TransitionGradient | null> {
  const gradId = transition?.gradientId;
  if (!gradId) return null;
  const asset = fxAssets.find((a) => a.id === gradId);
  if (!asset) {
    log.add(`[WARN] ${label}: gradiente "${gradId}" no encontrado`);
    return null;
  }
  const api = window.advanceAPI;
  try {
    let cArray: string | null = null;
    let w = 0, h = 0;
    if (asset.hFilePath) {
      const hRead = await api.file.readText(asset.hFilePath);
      if (hRead.success && hRead.data) {
        const hd = hRead.data;
        const wMatch = hd.match(/#define\s+GRADIENT_W\s+(\d+)/);
        const hMatch = hd.match(/#define\s+GRADIENT_H\s+(\d+)/);
        const dMatch = hd.match(/gradientData\[\d+\]\s*=\s*\{([\s\S]*?)\};/);
        if (wMatch && hMatch && dMatch) {
          w = parseInt(wMatch[1]);
          h = parseInt(hMatch[1]);
          const vals = dMatch[1].replace(/\s+/g, '').split(',').filter(Boolean).map((s) => parseInt(s.trim(), 10));
          const rows: string[] = [];
          for (let y = 0; y < h; y++) {
            const rowVals: string[] = [];
            for (let x = 0; x < w; x++) rowVals.push(String(vals[y * w + x] ?? 0));
            rows.push('    {' + rowVals.join(',') + '}');
          }
          cArray = '{\n' + rows.join(',\n') + '\n  }';
          log.add(`${label}: degradado desde .h "${asset.hFilePath.split(/[\\/]/).pop()}" (${w}x${h})`);
        }
      }
    }
    if (!cArray) {
      const gbaResult = await api.file.convertImageToGbaBase64Exact(asset.filePath);
      if (gbaResult.success && gbaResult.base64) {
        const binaryStr = atob(gbaResult.base64);
        w = gbaResult.width!;
        h = gbaResult.height!;
        const rows: string[] = [];
        for (let y = 0; y < h; y++) {
          const vals: string[] = [];
          for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 2;
            const val = (binaryStr.charCodeAt(idx + 1) << 8) | binaryStr.charCodeAt(idx);
            const r = val & 0x1F, g = (val >> 5) & 0x1F, b = (val >> 10) & 0x1F;
            vals.push(String(Math.round(((r + g + b) * 255) / 93)));
          }
          rows.push('    {' + vals.join(',') + '}');
        }
        cArray = '{\n' + rows.join(',\n') + '\n  }';
        log.add(`${label}: degradado convertido ${w}x${h}`);
      }
    }
    if (!cArray) return null;
    return { cArray, w, h };
  } catch (err: any) {
    log.add(`[WARN] ${label}: error — ${String(err)}`);
    return null;
  }
}

async function buildConnectionTransitions(
  state: { sceneConnections?: SceneConnection[]; fxAssets: FxAsset[]; scenes: Scene[] },
  log: { add: (m: string) => void },
): Promise<GBASceneTransition[]> {
  const out: GBASceneTransition[] = [];
  const sceneIds = new Set(state.scenes.map((s) => s.id));
  for (const conn of state.sceneConnections ?? []) {
    if (!sceneIds.has(conn.fromSceneId) || !sceneIds.has(conn.toSceneId)) continue;
    const tr = conn.entryTransition;
    const base = { fromSceneId: conn.fromSceneId, toSceneId: conn.toSceneId };
    if (!tr || tr.type === 'instant') {
      out.push({ ...base, name: conn.label || '', type: 'instant', durationSec: 0 });
      continue;
    }
    if (tr.type === 'fade') {
      out.push({ ...base, name: conn.label || '', type: 'fade', durationSec: tr.duration || 0.5 });
      continue;
    }
    const label = `Conexion "${conn.label || `${conn.fromSceneId}->${conn.toSceneId}`}"`;
    const ts = await extractTilesetForTransition(tr, state.fxAssets, log, label);
    const gr = await extractGradientForTransition(tr, state.fxAssets, log, label);
    if (ts) {
      out.push({
        ...base,
        name: conn.label || ts.name || '',
        type: 'custom',
        durationSec: tr.animSpeed || tr.duration || 5,
        tilesetCArray: ts.cArray,
        tileSize: ts.tileSize,
        frames: ts.frames,
        fw: ts.fw,
        fh: ts.fh,
        gradientCArray: gr?.cArray ?? null,
        gradientW: gr?.w,
        gradientH: gr?.h,
      });
    } else {
      log.add(`[WARN] ${label}: transicion custom sin tileset valido → fade`);
      out.push({ ...base, name: conn.label || '', type: 'fade', durationSec: tr.duration || 0.5 });
    }
  }
  return out;
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
      ? (projectsDir + '/' + project.name).replace(/\\/g, '/')
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
      splashScreen: defaultSplashScreen(),
      spriteSheets: [],
      backgrounds: [],
      songs: [],
      dialogues: [],
      sounds: [],
      scripts: [],
      fxAssets: [],
      dirty: false,
      exportLog: [],
      selectedNodeId: '',
      _songsUndoStack: [],
      _songsRedoStack: [],
      _mundoUndoStack: [],
      _mundoRedoStack: [],
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

  previewAnimId: null,
  setPreviewAnimId: (id) => set({ previewAnimId: id }),
  currentFrameIdx: 0,
  setCurrentFrameIdx: (idx) => set({ currentFrameIdx: idx }),

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
  showGrid: _saved.showGrid ?? true,
  setShowGrid: (val) => set({ showGrid: val }),
  gridLineOpacity: _saved.gridLineOpacity ?? 0.08,
  setGridLineOpacity: (val) => set({ gridLineOpacity: val }),
  imageSmoothing: _saved.imageSmoothing ?? false,
  flatColors: _saved.flatColors ?? false,
  setFlatColors: (val) => set({ flatColors: val }),
  codeFontSize: clampFontSize(_saved.codeFontSize ?? 12),
  setCodeFontSize: (val) => set({ codeFontSize: clampFontSize(val) }),
  setImageSmoothing: (val) => set({ imageSmoothing: val }),
  mundoShowGrid: _saved.mundoShowGrid ?? true,
  setMundoShowGrid: (val) => set({ mundoShowGrid: val }),
  mundoGridSize: _saved.mundoGridSize ?? 16,
  setMundoGridSize: (val) => set({ mundoGridSize: val }),
  mundoGridOpacity: _saved.mundoGridOpacity ?? 0.15,
  setMundoGridOpacity: (val) => set({ mundoGridOpacity: val }),
  mundoGridStrokeWidth: _saved.mundoGridStrokeWidth ?? 0.5,
  setMundoGridStrokeWidth: (val) => set({ mundoGridStrokeWidth: val }),
  mundoGridColor: _saved.mundoGridColor ?? '#4488ff',
  setMundoGridColor: (val) => set({ mundoGridColor: val }),
  connColorOut: _saved.connColorOut ?? '#3b82f6',
  setConnColorOut: (val) => set({ connColorOut: val }),
  connColorIn: _saved.connColorIn ?? '#f59e0b',
  setConnColorIn: (val) => set({ connColorIn: val }),
  connStrokeWidth: _saved.connStrokeWidth ?? 2,
  setConnStrokeWidth: (val) => set({ connStrokeWidth: val }),
  clickAnimation: _saved.clickAnimation ?? false,
  setClickAnimation: (val) => set({ clickAnimation: val }),

  // ── Pipeline / Proyecto ─────────────────────────────────────────────────
  projectDir: null,
  setProjectDir: (dir) => set({ projectDir: dir }),
  resetEditorState: () => set({
    scenes: [],
    sceneConnections: [],
    splashScreen: defaultSplashScreen(),
    spriteSheets: [],
    backgrounds: [],
    songs: [],
    dialogues: [],
    sounds: [],
    scripts: [],
    fxAssets: [],
    dirty: false,
    exportLog: [],
    selectedNodeId: '',
    _songsUndoStack: [],
    _songsRedoStack: [],
    _mundoUndoStack: [],
    _mundoRedoStack: [],
    _spriteUndoStack: [],
    _spriteRedoStack: [],
    spriteZoom: 1,
    imagenZoom: 1,
  }),
  exportLog: [],
  addExportLog: (msg) => set((s) => ({ exportLog: [...s.exportLog, msg].slice(-LOG_MAX) })),
  clearExportLog: () => set({ exportLog: [] }),
  beginExportRun: () => set({ exportLog: [] }),
  generateBuildFiles: async (opts) => {
    const verbose = opts?.verbose !== false;
    try {
      const state = get();
      const projectDir = state.projectDir;
      const project = state.projects.find((p) => p.id === state.editorProjectId);
      if (!projectDir || !project) return false;
      const { generateGBAProject, generateMakefile, createLog } = await import('../utils/gba_export');
      const log = createLog();

      let splashCArray: string | undefined;
      let splashDuration: number | undefined;
      if (state.splashScreen?.backgroundImage && state.splashScreen.duration > 0) {
        try {
          const api = window.advanceAPI;
          const imgPath = state.splashScreen.backgroundImage;
          log.add(`SplashScreen: convirtiendo "${imgPath}"...`);
          const gbaResult = await api.file.convertImageToGbaBase64(imgPath);
          if (gbaResult.success && gbaResult.base64) {
            const binaryStr = atob(gbaResult.base64);
            const pixelCount = Math.floor(binaryStr.length / 2);
            log.add(`SplashScreen: ${gbaResult.width}x${gbaResult.height} original, ${pixelCount} píxeles GBA`);
            const values: string[] = [];
            for (let i = 0; i < binaryStr.length; i += 2) {
              const lo = binaryStr.charCodeAt(i);
              const hi = binaryStr.charCodeAt(i + 1);
              const val = (hi << 8) | lo;
              values.push(`0x${val.toString(16).padStart(4, '0')}`);
            }
            const lines: string[] = [];
            for (let i = 0; i < values.length; i += 16) {
              lines.push('  ' + values.slice(i, i + 16).join(', '));
            }
            splashCArray = '{\n' + lines.join(',\n') + '\n}';
            splashDuration = state.splashScreen.duration;
            log.add(`SplashScreen: array C generado (${values.length} u16, ${splashDuration}s)`);
          } else {
            log.add(`[WARN] SplashScreen: falló conversión — ${gbaResult.reason || 'desconocido'}`);
          }
        } catch (err: any) {
          log.add(`[WARN] SplashScreen: error — ${String(err)}`);
        }
      } else {
        log.add('SplashScreen: sin imagen o duración 0, saltando');
      }

      const splashSongId = state.splashScreen?.backgroundSong;
      const splashSong = splashSongId ? state.songs.find((s) => s.id === splashSongId) : undefined;
      if (splashSong) {
        log.add(`Canción de splash: "${splashSong.name}"`);
      }
      if (state.splashScreen?.backgroundSoundId) {
        const found = state.sounds.find((s) => s.id === state.splashScreen.backgroundSoundId);
        log.add(`[WARN] Splash: sonido como música de fondo "${found?.name ?? 'desconocido'}": reproducción PCM no implementada en C export`);
      }

      // ── Bundles de escena para el export (multi-escena) ───────────────
      // Convierte una escena del editor en su bundle: imagen (o color sólido),
      // colisión+cámara, canción y actores ya relativos a la cámara de esa
      // escena. El orden de `state.scenes` define el índice de switchScene(n).
      let sceneCArray: string | undefined;
      let sceneColor: string | undefined;
      let sceneCollisionMap: number[][] | undefined;
      let sceneCollisionTileSize: number | undefined;
      let sceneCamX: number | undefined;
      let sceneCamY: number | undefined;
      let sceneSong: Song | undefined;
      let actorsExport: GBAExportedActor[] = [];
      const sheetCache = new Map<string, { base64: string; width: number; height: number }>();
      async function buildSceneBundle(scene: Scene): Promise<GBAExportedSceneBundle> {
        const color = scene.backgroundColor || '#000000';
        const camX = scene.cameraX || 0;
        const camY = scene.cameraY || 0;
        let imageCArray: string | undefined;
        let collisionMap: number[][] | undefined;
        let song: Song | undefined;
        const actors: GBAExportedActor[] = [];

        if (scene.collisionMap?.length && scene.collisionMap[0]?.length) {
          collisionMap = scene.collisionMap;
        }
        const imgPath = scene.backgroundImage;
        if (imgPath) {
          try {
            const api = window.advanceAPI;
            const hasCamera = camX !== 0 || camY !== 0 || scene.width > 240 || scene.height > 160;
            let gbaResult;
            if (hasCamera) {
              log.add(`Escena "${scene.name}": recortando fondo en cámara (${camX},${camY})...`);
              gbaResult = await api.file.cropImageToGbaBase64(imgPath, camX, camY);
            }
            if (!hasCamera || !gbaResult?.success) {
              log.add(`Escena "${scene.name}": redimensionando fondo...`);
              gbaResult = await api.file.convertImageToGbaBase64(imgPath);
            }
            if (gbaResult.success && gbaResult.base64) {
              const binaryStr = atob(gbaResult.base64);
              const values: string[] = [];
              for (let i = 0; i < binaryStr.length; i += 2) {
                const lo = binaryStr.charCodeAt(i);
                const hi = binaryStr.charCodeAt(i + 1);
                const val = (hi << 8) | lo;
                values.push(`0x${val.toString(16).padStart(4, '0')}`);
              }
              const lines: string[] = [];
              for (let i = 0; i < values.length; i += 16) {
                lines.push('  ' + values.slice(i, i + 16).join(', '));
              }
              imageCArray = '{\n' + lines.join(',\n') + '\n}';
              log.add(`Escena "${scene.name}": array C generado (${values.length} u16)`);
            } else {
              log.add(`[WARN] Escena "${scene.name}": falló conversión — ${gbaResult.reason || 'desconocido'}`);
            }
          } catch (err: any) {
            log.add(`[WARN] Escena "${scene.name}": error — ${String(err)}`);
          }
        } else {
          log.add(`Escena "${scene.name}": sin imagen de fondo, se usará color sólido`);
        }
        // ── Música de fondo de la escena ──────────────────────────────────
        if (scene.backgroundSong) {
          const found = state.songs.find((s) => s.id === scene.backgroundSong);
          if (found) {
            song = found;
            log.add(`Canción de escena "${scene.name}": "${found.name}" (${found.patterns.length} patrones)`);
          } else {
            log.add(`[WARN] backgroundSong "${scene.backgroundSong}" no encontrada entre las canciones`);
          }
        }
        if (scene.backgroundSoundId) {
          const found = state.sounds.find((s) => s.id === scene.backgroundSoundId);
          log.add(`[WARN] Escena "${scene.name}": sonido como música de fondo "${found?.name ?? 'desconocido'}": reproducción PCM no implementada en C export`);
        }
        // ── Actores de la escena (sprites software OVERLAY) ───────────────
        if (scene.actors?.length) {
          for (const actor of scene.actors) {
            if (!actor.spriteId) {
              log.add(`[WARN] Actor "${actor.name}" sin spritesheet: omitido en export GBA`);
              continue;
            }
            const sheet = (state.spriteSheets ?? []).find((s) => s.id === actor.spriteId);
            if (!sheet) {
              log.add(`[WARN] Actor "${actor.name}": spritesheet "${actor.spriteId}" no encontrado`);
              continue;
            }
            const api = window.advanceAPI;
            let raw = sheetCache.get(sheet.tilesetPath);
            if (!raw) {
              const gbaResult = await api.file.convertImageToGbaBase64ExactAlpha(sheet.tilesetPath);
              if (gbaResult.success && gbaResult.base64 && gbaResult.width && gbaResult.height) {
                raw = { base64: gbaResult.base64, width: gbaResult.width, height: gbaResult.height };
                sheetCache.set(sheet.tilesetPath, raw);
              } else {
                log.add(`[WARN] Actor "${actor.name}": no se pudo leer tileset "${sheet.name}" — ${gbaResult.reason || 'desconocido'}`);
                continue;
              }
            }
            const binaryStr = atob(raw.base64);
            const imgW = raw.width;
            const cols = sheet.cols || 1;
            const tw = sheet.tileWidth || 8;
            const th = sheet.tileHeight || 8;
            let anim = sheet.animations.find((an) => an.id === actor.animId);
            if (!anim) anim = sheet.animations[0];
            if (!anim) {
              log.add(`[WARN] Actor "${actor.name}": spritesheet "${sheet.name}" sin animaciones`);
              continue;
            }
            const frameList = anim.frames.length ? anim.frames.slice(0, 32) : [anim.frames[0]].filter(Boolean);
            if (!frameList.length) {
              log.add(`[WARN] Actor "${actor.name}": animación "${anim.name}" sin frames`);
              continue;
            }
            if (anim.frames.length > 32) {
              log.add(`[WARN] Actor "${actor.name}": animación "${anim.name}" tiene ${anim.frames.length} frames, se exportan los primeros 32 (MAX_ACTOR_FRAMES)`);
            }
            const speedFac = anim.speed && anim.speed > 0 ? anim.speed : 1;
            const frames: GBAExportedActorFrame[] = frameList.map((f) => {
              const ti = f.tileIndex || 0;
              const tc = ti % cols;
              const tr = Math.floor(ti / cols);
              const pixels: number[] = [];
              for (let py = 0; py < th; py++) {
                for (let px = 0; px < tw; px++) {
                  const srcIdx = ((tr * th + py) * imgW + (tc * tw + px)) * 2;
                  if (srcIdx + 1 >= binaryStr.length) { pixels.push(0x8000); continue; }
                  const lo = binaryStr.charCodeAt(srcIdx);
                  const hi = binaryStr.charCodeAt(srcIdx + 1);
                  const val = (hi << 8) | lo;
                  if (val & 0x8000) pixels.push(0x8000); // transparencia via canal alpha del PNG
                  else pixels.push(val & 0x7FFF);
                }
              }
              return { w: tw, h: th, pixels };
            });
            const delays = frameList.map((f) => Math.max(1, Math.round((f.duration || 100) * 60 / 1000 / speedFac)));
            actors.push({
              name: actor.name,
              x: Math.round(actor.x - camX),
              y: Math.round(actor.y - camY),
              z: actor.z || 0,
              w: tw,
              h: th,
              mode: anim.mode || 'loop',
              frames,
              delays,
              collider: !!actor.collider,
              colliderW: actor.colliderWidth,
              colliderH: actor.colliderHeight,
              colliderOffsetX: actor.colliderOffsetX ?? 0,
              colliderOffsetY: actor.colliderOffsetY ?? 0,
              hasArea: !!actor.hasArea,
              areaW: actor.areaWidth,
              areaH: actor.areaHeight,
              areaOffsetX: actor.areaOffsetX ?? 0,
              areaOffsetY: actor.areaOffsetY ?? 0,
              scriptId: actor.scriptId || undefined,
            });
            log.add(`Actor "${actor.name}": ${tw}x${th}, ${frames.length} frames (${anim.name}), z=${actor.z || 0}`);
          }
        }
        return {
          id: scene.id, name: scene.name, imageCArray, color, collisionMap,
          collisionTileSize: scene.collisionTileSize || 8, camX, camY, actors,
        };
      }

      // Bundle de TODAS las escenas (índice = orden del editor, el que usa
      // switchScene(n) en la ROM). El bundle de la escena tras el splash
      // además alimenta las variables históricas de escena usadas abajo.
      const allSceneBundles: GBAExportedSceneBundle[] = [];
      let startBundle: GBAExportedSceneBundle | undefined;
      for (const sc of state.scenes) {
        const b = await buildSceneBundle(sc);
        allSceneBundles.push(b);
        if (sc.id === state.splashScreen?.nextSceneId) startBundle = b;
      }
      if (startBundle) {
        sceneCArray = startBundle.imageCArray;
        sceneColor = startBundle.color;
        sceneCollisionMap = startBundle.collisionMap;
        sceneCollisionTileSize = startBundle.collisionTileSize;
        sceneCamX = startBundle.camX;
        sceneCamY = startBundle.camY;
        sceneSong = startBundle.song;
        actorsExport = startBundle.actors;
      } else if (state.splashScreen?.nextSceneId) {
        log.add(`[WARN] nextSceneId "${state.splashScreen.nextSceneId}" no coincide con ninguna escena`);
      }

      // ── Entry transition tileset ──────────────────────────────────────
      let entryTilesetCArray: string | undefined;
      let entryTileSize: number | undefined;
      let entryTilesetFrames: number | undefined;
      let entryTilesetSpeed: number | undefined;
      let entryTilesetFw: number | undefined;
      let entryTilesetFh: number | undefined;
      const entryTransition = state.splashScreen?.entryTransition;
      if (entryTransition?.tilesetId && entryTransition?.tileSize) {
        const tilesetAsset = state.fxAssets.find((a) => a.id === entryTransition.tilesetId);
        if (tilesetAsset) {
          try {
            const api = window.advanceAPI;
            const tileSize = entryTransition.tileSize;

            // Helper: parse a source pixel value to reveal (1) or hide (0)
            function valToMask(n: number): number {
              const r = n & 0x1F;
              const g = (n >> 5) & 0x1F;
              const b = (n >> 10) & 0x1F;
              return (r + g + b) >= 30 ? 1 : 0;
            }

            // Helper: build a 2D frame array string
            function buildPixelFrameArray(frameData: number[][]): string {
              const lines: string[] = [];
              for (let y = 0; y < frameData.length; y++) {
                const rowHex = frameData[y].map((v) => v ? '0x7FFF' : '0x0000');
                lines.push('    {' + rowHex.join(',') + '}');
              }
              return '{\n' + lines.join(',\n') + '\n  }';
            }

            // Try reading pre-generated .h file first
            if (tilesetAsset.hFilePath) {
              const hRead = await api.file.readText(tilesetAsset.hFilePath);
              if (hRead.success && hRead.data) {
                const hd = hRead.data;
                const wMatch = hd.match(/#define\s+TILESET_W\s+(\d+)/);
                const hMatch = hd.match(/#define\s+TILESET_H\s+(\d+)/);
                const cMatch = hd.match(/#define\s+TILESET_COLS\s+(\d+)/);
                const rMatch = hd.match(/#define\s+TILESET_ROWS\s+(\d+)/);
                const dMatch = hd.match(/tilesetData\[\d+\]\s*=\s*\{([\s\S]*?)\};/);
                if (wMatch && hMatch && cMatch && rMatch && dMatch) {
                  const sw = parseInt(wMatch[1]);
                  const sh = parseInt(hMatch[1]);
                  const cols = parseInt(cMatch[1]);
                  const rows = parseInt(rMatch[1]);
                  const totalFrames = cols * rows;
                  const fw = sw / cols;
                  const fh = sh / rows;

                  // Parse hex values from the C array
                  const hexStr = dMatch[1].replace(/\s+/g, '');
                  const hexVals = hexStr.split(',').filter(Boolean);
                  const srcVals: number[] = hexVals.map((s) => {
                    const n = parseInt(s.trim(), 16);
                    return isNaN(n) ? 0 : valToMask(n);
                  });

                  // Extract per-pixel frame data (fw × fh per frame)
                  const frameArrays: string[] = [];
                  for (let f = 0; f < totalFrames; f++) {
                    const fCol = f % cols;
                    const fRow = Math.floor(f / cols);
                    const frameData: number[][] = [];
                    for (let py = 0; py < fh; py++) {
                      const row: number[] = [];
                      for (let px = 0; px < fw; px++) {
                        const srcIdx = (fRow * fh + py) * sw + (fCol * fw + px);
                        row.push(srcVals[srcIdx] || 0);
                      }
                      frameData.push(row);
                    }
                    frameArrays.push(`  // Frame ${f}\n  ${buildPixelFrameArray(frameData)}`);
                  }

                  entryTilesetCArray = `static const u16 gTilesetPixel[${totalFrames}][${fh}][${fw}] = {\n${frameArrays.join(',\n')},\n};`;
                  entryTileSize = tileSize;
                  entryTilesetFrames = totalFrames;
                  entryTilesetSpeed = entryTransition.animSpeed || 5;
                  entryTilesetFw = fw;
                  entryTilesetFh = fh;
                  log.add(`Transicion: usado .h pre-generado "${tilesetAsset.hFilePath.split(/[\\/]/).pop()}" (${sw}x${sh})`);
                } else {
                  log.add(`[WARN] Transicion: .h no contiene tilesetData valido, fallback a conversion`);
                }
              } else {
                log.add(`[WARN] Transicion: no se pudo leer .h, fallback a conversion`);
              }
            }

            if (!entryTilesetCArray) {
              log.add(`Transicion: convirtiendo tileset "${tilesetAsset.name}"...`);
              const gbaResult = await api.file.convertImageToGbaBase64Exact(tilesetAsset.filePath);
              if (gbaResult.success && gbaResult.base64) {
                const binaryStr = atob(gbaResult.base64);
                const sw = gbaResult.width!;
                const sh = gbaResult.height!;
                const cols = tilesetAsset.cols;
                const rows = tilesetAsset.rows;
                const totalFrames = cols * rows;
                const fw = sw / cols;
                const fh = sh / rows;

                // Parse source pixels from GBA base64
                const srcVals: number[] = [];
                for (let y = 0; y < sh; y++) {
                  for (let x = 0; x < sw; x++) {
                    const idx = (y * sw + x) * 2;
                    const lo = binaryStr.charCodeAt(idx);
                    const hi = binaryStr.charCodeAt(idx + 1);
                    const val = (hi << 8) | lo;
                    srcVals.push(valToMask(val));
                  }
                }

                // Extract per-pixel frame data (fw × fh per frame)
                const frameArrays: string[] = [];
                for (let f = 0; f < totalFrames; f++) {
                  const fCol = f % cols;
                  const fRow = Math.floor(f / cols);
                  const frameData: number[][] = [];
                  for (let py = 0; py < fh; py++) {
                    const row: number[] = [];
                    for (let px = 0; px < fw; px++) {
                      const srcIdx = (fRow * fh + py) * sw + (fCol * fw + px);
                      row.push(srcVals[srcIdx] || 0);
                    }
                    frameData.push(row);
                  }
                  frameArrays.push(`  // Frame ${f}\n  ${buildPixelFrameArray(frameData)}`);
                }

                entryTilesetCArray = `static const u16 gTilesetPixel[${totalFrames}][${fh}][${fw}] = {\n${frameArrays.join(',\n')},\n};`;
                entryTileSize = tileSize;
                entryTilesetFrames = totalFrames;
                entryTilesetSpeed = entryTransition.animSpeed || 5;
                entryTilesetFw = fw;
                entryTilesetFh = fh;
                log.add(`Transicion: tileset convertido (${sw}x${sh}, ${cols}x${rows} frames)`);
              } else {
                log.add(`[WARN] Transicion: falló conversión del tileset — ${gbaResult.reason || 'desconocido'}`);
              }
            }
          } catch (err: any) {
            log.add(`[WARN] Transicion: error — ${String(err)}`);
          }
        } else {
          log.add(`[WARN] Transicion: tileset ID "${entryTransition.tilesetId}" no encontrado en assets`);
        }
      } else {
        log.add('Transicion de entrada: sin tileset o tileSize, saltando');
      }

      // ── Entry gradient ────────────────────────────────────────────────
      let entryGradientCArray: string | null = null;
      let entryGradientW = 0;
      let entryGradientH = 0;
      const entryGradId = state.splashScreen?.entryTransition?.gradientId;
      if (entryGradId) {
        const gradAsset = state.fxAssets.find((a) => a.id === entryGradId);
        if (gradAsset) {
          try {
            const api = window.advanceAPI;
            if (gradAsset.hFilePath) {
              const hRead = await api.file.readText(gradAsset.hFilePath);
              if (hRead.success && hRead.data) {
                const hd = hRead.data;
                const wMatch = hd.match(/#define\s+GRADIENT_W\s+(\d+)/);
                const hMatch = hd.match(/#define\s+GRADIENT_H\s+(\d+)/);
                const dMatch = hd.match(/gradientData\[\d+\]\s*=\s*\{([\s\S]*?)\};/);
                if (wMatch && hMatch && dMatch) {
                  const sw = parseInt(wMatch[1]);
                  const sh = parseInt(hMatch[1]);
                  entryGradientW = sw;
                  entryGradientH = sh;
                  const numStr = dMatch[1].replace(/\s+/g, '');
                  const vals = numStr.split(',').filter(Boolean).map((s) => parseInt(s.trim(), 10));
                  const rows: string[] = [];
                  for (let y = 0; y < sh; y++) {
                    const rowVals: string[] = [];
                    for (let x = 0; x < sw; x++) {
                      const v = vals[y * sw + x];
                      rowVals.push(String(v ?? 0));
                    }
                    rows.push('    {' + rowVals.join(',') + '}');
                  }
                  entryGradientCArray = '{\n' + rows.join(',\n') + '\n  }';
                  log.add(`Degradado entrada: usado .h "${gradAsset.hFilePath.split(/[\\/]/).pop()}" (${sw}x${sh})`);
                } else {
                  log.add(`[WARN] Degradado entrada: .h incompleto, fallback a conversion`);
                }
              } else {
                log.add(`[WARN] Degradado entrada: no se pudo leer .h, fallback a conversion`);
              }
            }

            if (!entryGradientCArray) {
              log.add(`Degradado entrada: convirtiendo imagen "${gradAsset.name}"...`);
              const gbaResult = await api.file.convertImageToGbaBase64Exact(gradAsset.filePath);
              if (gbaResult.success && gbaResult.base64) {
                const binaryStr = atob(gbaResult.base64);
                const sw = gbaResult.width!;
                const sh = gbaResult.height!;
                entryGradientW = sw;
                entryGradientH = sh;
                const rows: string[] = [];
                for (let y = 0; y < sh; y++) {
                  const vals: string[] = [];
                  for (let x = 0; x < sw; x++) {
                    const idx = (y * sw + x) * 2;
                    const lo = binaryStr.charCodeAt(idx);
                    const hi = binaryStr.charCodeAt(idx + 1);
                    const val = (hi << 8) | lo;
                    const r = val & 0x1F;
                    const g = (val >> 5) & 0x1F;
                    const b = (val >> 10) & 0x1F;
                    const brightness = Math.round(((r + g + b) * 255) / 93);
                    vals.push(String(brightness));
                  }
                  rows.push('    {' + vals.join(',') + '}');
                }
                entryGradientCArray = '{\n' + rows.join(',\n') + '\n  }';
                log.add(`Degradado entrada: convertido ${sw}x${sh}`);
              } else {
                log.add(`[WARN] Degradado entrada: falló conversión — ${gbaResult.reason || 'desconocido'}`);
              }
            }
          } catch (err: any) {
            log.add(`[WARN] Degradado entrada: error — ${String(err)}`);
          }
        } else {
          log.add(`[WARN] Degradado entrada: asset "${entryGradId}" no encontrado`);
        }
      } else {
        log.add('Degradado de entrada: no configurado');
      }

      // ── Exit transition tileset ──────────────────────────────────────
      let exitTilesetCArray: string | undefined;
      let exitTileSize: number | undefined;
      let exitTilesetFrames: number | undefined;
      let exitTilesetSpeed: number | undefined;
      let exitTilesetFw: number | undefined;
      let exitTilesetFh: number | undefined;
      const exitTransition = state.splashScreen?.exitTransition;
      if (exitTransition?.tilesetId && exitTransition?.tileSize) {
        const tilesetAsset = state.fxAssets.find((a) => a.id === exitTransition.tilesetId);
        if (tilesetAsset) {
          try {
            const api = window.advanceAPI;
            const tileSize = exitTransition.tileSize;

            function valToMask(n: number): number {
              const r = n & 0x1F;
              const g = (n >> 5) & 0x1F;
              const b = (n >> 10) & 0x1F;
              return (r + g + b) >= 30 ? 1 : 0;
            }

            function buildPixelFrameArray(frameData: number[][]): string {
              const lines: string[] = [];
              for (let y = 0; y < frameData.length; y++) {
                const rowHex = frameData[y].map((v) => v ? '0x7FFF' : '0x0000');
                lines.push('    {' + rowHex.join(',') + '}');
              }
              return '{\n' + lines.join(',\n') + '\n  }';
            }

            if (tilesetAsset.hFilePath) {
              const hRead = await api.file.readText(tilesetAsset.hFilePath);
              if (hRead.success && hRead.data) {
                const hd = hRead.data;
                const wMatch = hd.match(/#define\s+TILESET_W\s+(\d+)/);
                const hMatch = hd.match(/#define\s+TILESET_H\s+(\d+)/);
                const cMatch = hd.match(/#define\s+TILESET_COLS\s+(\d+)/);
                const rMatch = hd.match(/#define\s+TILESET_ROWS\s+(\d+)/);
                const dMatch = hd.match(/tilesetData\[\d+\]\s*=\s*\{([\s\S]*?)\};/);
                if (wMatch && hMatch && cMatch && rMatch && dMatch) {
                  const sw = parseInt(wMatch[1]);
                  const sh = parseInt(hMatch[1]);
                  const cols = parseInt(cMatch[1]);
                  const rows = parseInt(rMatch[1]);
                  const totalFrames = cols * rows;
                  const fw = sw / cols;
                  const fh = sh / rows;

                  const hexStr = dMatch[1].replace(/\s+/g, '');
                  const hexVals = hexStr.split(',').filter(Boolean);
                  const srcVals: number[] = hexVals.map((s) => {
                    const n = parseInt(s.trim(), 16);
                    return isNaN(n) ? 0 : valToMask(n);
                  });

                  const frameArrays: string[] = [];
                  for (let f = 0; f < totalFrames; f++) {
                    const fCol = f % cols;
                    const fRow = Math.floor(f / cols);
                    const frameData: number[][] = [];
                    for (let py = 0; py < fh; py++) {
                      const row: number[] = [];
                      for (let px = 0; px < fw; px++) {
                        const srcIdx = (fRow * fh + py) * sw + (fCol * fw + px);
                        row.push(srcVals[srcIdx] || 0);
                      }
                      frameData.push(row);
                    }
                    frameArrays.push(`  // Frame ${f}\n  ${buildPixelFrameArray(frameData)}`);
                  }

                  exitTilesetCArray = `static const u16 gTilesetPixel[${totalFrames}][${fh}][${fw}] = {\n${frameArrays.join(',\n')},\n};`;
                  exitTileSize = tileSize;
                  exitTilesetFrames = totalFrames;
                  exitTilesetSpeed = exitTransition.animSpeed || 5;
                  exitTilesetFw = fw;
                  exitTilesetFh = fh;
                  log.add(`Transicion salida: usado .h pre-generado "${tilesetAsset.hFilePath.split(/[\\/]/).pop()}" (${sw}x${sh})`);
                } else {
                  log.add(`[WARN] Transicion salida: .h no contiene tilesetData valido, fallback a conversion`);
                }
              } else {
                log.add(`[WARN] Transicion salida: no se pudo leer .h, fallback a conversion`);
              }
            }

            if (!exitTilesetCArray) {
              log.add(`Transicion salida: convirtiendo tileset "${tilesetAsset.name}"...`);
              const gbaResult = await api.file.convertImageToGbaBase64Exact(tilesetAsset.filePath);
              if (gbaResult.success && gbaResult.base64) {
                const binaryStr = atob(gbaResult.base64);
                const sw = gbaResult.width!;
                const sh = gbaResult.height!;
                const cols = tilesetAsset.cols;
                const rows = tilesetAsset.rows;
                const totalFrames = cols * rows;
                const fw = sw / cols;
                const fh = sh / rows;

                const srcVals: number[] = [];
                for (let y = 0; y < sh; y++) {
                  for (let x = 0; x < sw; x++) {
                    const idx = (y * sw + x) * 2;
                    const lo = binaryStr.charCodeAt(idx);
                    const hi = binaryStr.charCodeAt(idx + 1);
                    const val = (hi << 8) | lo;
                    srcVals.push(valToMask(val));
                  }
                }

                const frameArrays: string[] = [];
                for (let f = 0; f < totalFrames; f++) {
                  const fCol = f % cols;
                  const fRow = Math.floor(f / cols);
                  const frameData: number[][] = [];
                  for (let py = 0; py < fh; py++) {
                    const row: number[] = [];
                    for (let px = 0; px < fw; px++) {
                      const srcIdx = (fRow * fh + py) * sw + (fCol * fw + px);
                      row.push(srcVals[srcIdx] || 0);
                    }
                    frameData.push(row);
                  }
                  frameArrays.push(`  // Frame ${f}\n  ${buildPixelFrameArray(frameData)}`);
                }

                exitTilesetCArray = `static const u16 gTilesetPixel[${totalFrames}][${fh}][${fw}] = {\n${frameArrays.join(',\n')},\n};`;
                exitTileSize = tileSize;
                exitTilesetFrames = totalFrames;
                exitTilesetSpeed = exitTransition.animSpeed || 5;
                exitTilesetFw = fw;
                exitTilesetFh = fh;
                log.add(`Transicion salida: tileset convertido (${sw}x${sh}, ${cols}x${rows} frames)`);
              } else {
                log.add(`[WARN] Transicion salida: falló conversión del tileset — ${gbaResult.reason || 'desconocido'}`);
              }
            }
          } catch (err: any) {
            log.add(`[WARN] Transicion salida: error — ${String(err)}`);
          }
        } else {
          log.add(`[WARN] Transicion salida: tileset ID "${exitTransition.tilesetId}" no encontrado en assets`);
        }
      } else {
        log.add('Transicion de salida: sin tileset o tileSize, saltando');
      }
      const entryTransitionType = state.splashScreen?.entryTransition?.type || 'fade';
      const exitTransitionType = state.splashScreen?.exitTransition?.type || 'fade';
      if (entryTransition && !entryTilesetSpeed) entryTilesetSpeed = entryTransition.animSpeed || 5;
      if (exitTransition && !exitTilesetSpeed) exitTilesetSpeed = exitTransition.animSpeed || 5;

      // ── Exit gradient ────────────────────────────────────────────────
      let exitGradientCArray: string | null = null;
      let exitGradientW = 0;
      let exitGradientH = 0;
      let exitTransitionDuration = exitTransition?.animSpeed || 5;
      const exitGradId = state.splashScreen?.exitTransition?.gradientId;
      if (exitGradId) {
        const gradAsset = state.fxAssets.find((a) => a.id === exitGradId);
        if (gradAsset) {
          try {
            const api = window.advanceAPI;

            // Try reading pre-generated .h file first
            if (gradAsset.hFilePath) {
              const hRead = await api.file.readText(gradAsset.hFilePath);
              if (hRead.success && hRead.data) {
                const hd = hRead.data;
                const wMatch = hd.match(/#define\s+GRADIENT_W\s+(\d+)/);
                const hMatch = hd.match(/#define\s+GRADIENT_H\s+(\d+)/);
                const dMatch = hd.match(/gradientData\[\d+\]\s*=\s*\{([\s\S]*?)\};/);
                if (wMatch && hMatch && dMatch) {
                  const sw = parseInt(wMatch[1]);
                  const sh = parseInt(hMatch[1]);
                  exitGradientW = sw;
                  exitGradientH = sh;

                  const numStr = dMatch[1].replace(/\s+/g, '');
                  const vals = numStr.split(',').filter(Boolean).map((s) => parseInt(s.trim(), 10));
                  const rows: string[] = [];
                  for (let y = 0; y < sh; y++) {
                    const rowVals: string[] = [];
                    for (let x = 0; x < sw; x++) {
                      const v = vals[y * sw + x];
                      rowVals.push(String(v ?? 0));
                    }
                    rows.push('    {' + rowVals.join(',') + '}');
                  }
                  exitGradientCArray = '{\n' + rows.join(',\n') + '\n  }';
                  log.add(`Degradado salida: usado .h "${gradAsset.hFilePath.split(/[\\/]/).pop()}" (${sw}x${sh})`);
                } else {
                  log.add(`[WARN] Degradado salida: .h incompleto, fallback a conversion`);
                }
              } else {
                log.add(`[WARN] Degradado salida: no se pudo leer .h, fallback a conversion`);
              }
            }

            if (!exitGradientCArray) {
              log.add(`Degradado salida: convirtiendo imagen "${gradAsset.name}"...`);
              const gbaResult = await api.file.convertImageToGbaBase64Exact(gradAsset.filePath);
              if (gbaResult.success && gbaResult.base64) {
                const binaryStr = atob(gbaResult.base64);
                const sw = gbaResult.width!;
                const sh = gbaResult.height!;
                exitGradientW = sw;
                exitGradientH = sh;
                const rows: string[] = [];
                for (let y = 0; y < sh; y++) {
                  const vals: string[] = [];
                  for (let x = 0; x < sw; x++) {
                    const idx = (y * sw + x) * 2;
                    const lo = binaryStr.charCodeAt(idx);
                    const hi = binaryStr.charCodeAt(idx + 1);
                    const val = (hi << 8) | lo;
                    const r = val & 0x1F;
                    const g = (val >> 5) & 0x1F;
                    const b = (val >> 10) & 0x1F;
                    const brightness = Math.round(((r + g + b) * 255) / 93);
                    vals.push(String(brightness));
                  }
                  rows.push('    {' + vals.join(',') + '}');
                }
                exitGradientCArray = '{\n' + rows.join(',\n') + '\n  }';
                log.add(`Degradado salida: convertido ${sw}x${sh}`);
              } else {
                log.add(`[WARN] Degradado salida: falló conversión — ${gbaResult.reason || 'desconocido'}`);
              }
            }
          } catch (err: any) {
            log.add(`[WARN] Degradado salida: error — ${String(err)}`);
          }
        } else {
          log.add(`[WARN] Degradado salida: asset "${exitGradId}" no encontrado`);
        }
      } else {
        log.add('Degradado de salida: no configurado');
      }

      const sceneTransitions = await buildConnectionTransitions(
        { sceneConnections: state.sceneConnections, fxAssets: state.fxAssets, scenes: state.scenes },
        log,
      );
      if (sceneTransitions.length) {
        log.add(`Transiciones de conexion: ${sceneTransitions.length} configurada(s) para switchScene`);
      }

      const cCode = generateGBAProject({
        scenes: state.scenes,
        sceneConnections: state.sceneConnections,
        backgrounds: state.backgrounds ?? [],
        sprites: state.spriteSheets ?? [],
        songs: state.songs,
        sounds: state.sounds ?? [],
        dialogues: state.dialogues ?? [],
        scripts: state.scripts ?? [],
      }, project.name, project.author, log, splashCArray, splashDuration, splashSong, sceneSong, sceneCArray, sceneColor,
        entryTilesetCArray, entryTileSize, entryTilesetFrames, entryTilesetSpeed, entryTilesetFw, entryTilesetFh,
        exitTilesetCArray, exitTileSize, exitTilesetFrames, exitTilesetSpeed, exitTilesetFw, exitTilesetFh,
        exitTransitionDuration, exitGradientCArray, exitGradientW, exitGradientH,
        entryGradientCArray, entryGradientW, entryGradientH,
        entryTransitionType, exitTransitionType,
        sceneCollisionMap, sceneCollisionTileSize, sceneCamX, sceneCamY, actorsExport,
        { scenes: allSceneBundles, startSceneId: state.splashScreen?.nextSceneId ?? '', transitions: sceneTransitions });
      const makefile = generateMakefile(project.name, log);
      const api = window.advanceAPI;
      const buildDir = `${projectDir}/build`;
      await api.dir.create(buildDir);
      await api.file.writeText(`${buildDir}/main.c`, cCode);
      await api.file.writeText(`${buildDir}/Makefile`, makefile);

      // Publicar el detalle. Al guardar (verbose: false) no se publica: son
      // ~40 líneas por guardado y el log se hacía ilegible.
      if (verbose) set((s) => ({ exportLog: [...s.exportLog, ...log.messages].slice(-LOG_MAX) }));
      return true;
    } catch (err: any) {
      // El error siempre se publica, aussi en silencio: si no, un fallo al
      // guardar no se vería por ningún lado.
      set((s) => ({ exportLog: [...s.exportLog, `[ERROR] generateBuildFiles: ${String(err)}`] }));
      return false;
    }
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
          fxAssets: state.fxAssets ?? [],
          dialogues: state.dialogues ?? [],
          scripts: state.scripts ?? [],
          splashScreen: state.splashScreen,
        },
      });
      if (result.success) {
        set({ projectDir: result.path, dirty: false, exportLog: [...get().exportLog, `[OK] Proyecto guardado en ${result.path}`] });
        get().updateProject(project.id, { path: result.path });
        // Se regenera el build para que esté al día, pero en silencio: publicar
        // el detalle aquí metía otro bloque de ~40 líneas por cada guardado y el
        // log acababa siendo ilegible. Await: antes quedaba en el aire y se
        // solapaba con la siguiente operación.
        await get().generateBuildFiles({ verbose: false });
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
      get().beginExportRun();
      set((s) => ({ exportLog: [...s.exportLog, `[INFO] Cargando proyecto: ${path}`] }));
      const result = await api.project.load(path);
      if (!result.success || !result.state) {
        set((s) => ({ exportLog: [...s.exportLog, `[ERROR] ${result.reason}`] }));
        return false;
      }
      set({
        projectDir: path,
        scenes: (result.state.scenes ?? []).map((sc: any) => ({
          ...sc,
          collisionTileSize: sc.collisionTileSize ?? 8,
          collisionMap: sc.collisionMap ?? createCollisionMap(sc.width, sc.height, sc.collisionTileSize ?? 8),
        })),
        sceneConnections: (result.state.sceneConnections ?? []).map((c: any) => ({ ...makeDefaultConnection(c.fromSceneId, c.toSceneId), ...c, id: c.id, usePauseScreen: c.usePauseScreen ?? false, pauseColor: c.pauseColor ?? '#000000', entryTransition: { tileSize: 8, animSpeed: 5, ...(c.entryTransition ?? { type: 'fade', duration: 0.5, gradientId: '', tilesetId: '' }) }, exitTransition: { tileSize: 8, animSpeed: 5, ...(c.exitTransition ?? { type: 'fade', duration: 0.5, gradientId: '', tilesetId: '' }) } })),
        splashScreen: { ...defaultSplashScreen(), ...result.state.splashScreen, usePauseScreen: result.state.splashScreen?.usePauseScreen ?? false, pauseColor: result.state.splashScreen?.pauseColor ?? '#000000', entryTransition: { tileSize: 8, animSpeed: 5, ...(result.state.splashScreen?.entryTransition ?? { type: 'fade', duration: 0.5, gradientId: '', tilesetId: '' }) }, exitTransition: { tileSize: 8, animSpeed: 5, ...(result.state.splashScreen?.exitTransition ?? { type: 'fade', duration: 0.5, gradientId: '', tilesetId: '' }) } },
        backgrounds: result.state.backgrounds ?? [],
        spriteSheets: result.state.sprites ?? [],
        songs: result.state.songs ?? [],
        sounds: result.state.sounds ?? [],
        fxAssets: result.state.fxAssets ?? [],
        dialogues: result.state.dialogues ?? [],
        scripts: (result.state.scripts ?? []).map((sc: any) => ({
          id: sc.id ?? '',
          name: sc.name ?? 'Nuevo script',
          mode: sc.mode ?? 'blocks',
          blocks: sc.blocks ?? [],
          language: sc.language ?? sc.code ?? '',
          cCode: sc.cCode ?? '',
        })),
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
      // Una exportación = un log limpio. Antes se concatenaban con todo lo
      // anterior y el error real quedaba enterrado.
      get().beginExportRun();
      const state = get();
      const project = state.projects.find((p) => p.id === state.editorProjectId);
      const projectDir = state.projectDir;
      if (!projectDir) {
        set((s) => ({ exportLog: [...s.exportLog, '[ERROR] Guarda el proyecto antes de exportar'] }));
        return false;
      }
      const filesOk = await get().generateBuildFiles();
      if (!filesOk) {
        set((s) => ({ exportLog: [...s.exportLog, '[ERROR] Falló la generación de los build files — no se compila la ROM. Revisa los mensajes anteriores (¿Electron desactualizado? Reinicia la app).'] }));
        return false;
      }
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
  playEmulator: async () => {
    try {
      // Igual que en exportGBA: lo que interesa es la última ejecución.
      get().beginExportRun();
      const state = get();
      const project = state.projects.find((p) => p.id === state.editorProjectId);
      const projectDir = state.projectDir;
      if (!projectDir || !project) {
        set((s) => ({ exportLog: [...s.exportLog, '[ERROR] Guarda el proyecto antes de ejecutar'] }));
        return false;
      }
      const api = window.advanceAPI;
      const buildDir = `${projectDir}/build`;
      const romPath = `${buildDir}/${project.name.replace(/\s+/g, '_')}.gba`;

      // Close existing emulator
      await api.emu.stop();

      // Compile
      set((s) => ({ exportLog: [...s.exportLog, '[INFO] Generando build files…'] }));
      const filesOk = await get().generateBuildFiles();
      if (!filesOk) {
        set((s) => ({ exportLog: [...s.exportLog, '[ERROR] Falló la generación de los build files — no se compila la ROM. Revisa los mensajes anteriores (¿Electron desactualizado? Reinicia la app).'] }));
        return false;
      }
      set((s) => ({ exportLog: [...s.exportLog, '[INFO] Compilando ROM…'] }));
      const result = await api.system.runCommand('make -j4', buildDir);
      if (!result.success) {
        set((s) => ({ exportLog: [...s.exportLog, `[ERROR] ${result.output}`] }));
        return false;
      }
      set((s) => ({ exportLog: [...s.exportLog, '[OK] ROM compilada, lanzando emulador…'] }));

      // Launch emulator
      const emuResult = await api.emu.play(romPath);
      if (!emuResult.success) {
        set((s) => ({ exportLog: [...s.exportLog, `[ERROR] Emulador: ${emuResult.reason}`] }));
        return false;
      }
      return true;
    } catch (err: any) {
      set((s) => ({ exportLog: [...s.exportLog, `[ERROR] ${String(err)}`] }));
      return false;
    }
  },
  stopEmulator: async () => {
    try {
      await window.advanceAPI.emu.stop();
      return true;
    } catch { return false; }
  },

  // ── Mundo ──────────────────────────────────────────────────────────────
  scenes: [defaultScene()],
  splashScreen: defaultSplashScreen(),
  addScene: (x?: number, y?: number) => {
    get()._snapshotMundo();
    set((s) => {
      const baseName = 'Escena';
      const names = s.scenes.map((sc) => sc.name);
      let num = 1;
      while (names.includes(`${baseName} ${num}`)) num++;
      const posX = x ?? (s.scenes.length * 30 + 60);
      const posY = y ?? 20;
      return { scenes: [...s.scenes, { ...defaultScene(), name: `${baseName} ${num}`, x: posX, y: posY }] };
    });
  },
  updateScene: (id, patch) => {
    get()._snapshotMundo();
    set((s) => ({
      scenes: s.scenes.map((sc) => {
        if (sc.id !== id) return sc;
        const next = { ...sc, ...patch };
        const ts = patch.collisionTileSize ?? sc.collisionTileSize ?? 8;
        next.collisionTileSize = ts;
        if (patch.width !== undefined || patch.height !== undefined) {
          const w = patch.width ?? sc.width;
          const h = patch.height ?? sc.height;
          next.cameraX = Math.min(next.cameraX, Math.max(w - 240, 0));
          next.cameraY = Math.min(next.cameraY, Math.max(h - 160, 0));
          next.collisionMap = createCollisionMap(w, h, ts);
        }
        if (patch.collisionTileSize !== undefined) {
          next.collisionMap = createCollisionMap(next.width, next.height, patch.collisionTileSize);
        }
        return next;
      }),
    }));
  },
  removeScene: (id) => {
    get()._snapshotMundo();
    set((s) => ({ scenes: s.scenes.filter((sc) => sc.id !== id) }));
  },
  setCollisionTile: (sceneId, col, row, value) => {
    get()._snapshotMundo();
    set((s) => ({
      scenes: s.scenes.map((sc) => {
        if (sc.id !== sceneId) return sc;
        const map = (sc.collisionMap || createCollisionMap(sc.width, sc.height, sc.collisionTileSize || 8)).map((r) => [...r]);
        if (map[row] && map[row][col] !== undefined) map[row][col] = value;
        return { ...sc, collisionTileSize: sc.collisionTileSize || 8, collisionMap: map };
      }),
    }));
  },
  batchCollisionTiles: (sceneId, tiles: [number, number, number][]) => {
    get()._snapshotMundo();
    set((s) => ({
      scenes: s.scenes.map((sc) => {
        if (sc.id !== sceneId) return sc;
        const ts = sc.collisionTileSize || 8;
        const map = (sc.collisionMap || createCollisionMap(sc.width, sc.height, ts)).map((r) => [...r]);
        for (const [col, row, val] of tiles) {
          if (map[row] && map[row][col] !== undefined) map[row][col] = val;
        }
        return { ...sc, collisionTileSize: ts, collisionMap: map };
      }),
    }));
  },
  clearCollisionMap: (sceneId) => {
    get()._snapshotMundo();
    set((s) => ({
      scenes: s.scenes.map((sc) =>
        sc.id !== sceneId ? sc : { ...sc, collisionTileSize: sc.collisionTileSize || 8, collisionMap: createCollisionMap(sc.width, sc.height, sc.collisionTileSize || 8) }
      ),
    }));
  },
addActor: (sceneId, overrides) => {
  get()._snapshotMundo();
  const actor = { ...defaultActor(), ...(overrides ?? {}) };
  set((s) => ({
    scenes: s.scenes.map((sc) =>
      sc.id === sceneId ? { ...sc, actors: [...sc.actors, actor] } : sc
    ),
  }));
  return actor.id;
},
  updateActor: (sceneId, actorId, patch) => {
    get()._snapshotMundo();
    set((s) => ({
      scenes: s.scenes.map((sc) =>
        sc.id !== sceneId ? sc : {
          ...sc,
          actors: sc.actors.map((a) => (a.id === actorId ? { ...a, ...patch } : a)),
        }
      ),
    }));
  },
  removeActor: (sceneId, actorId) => {
    get()._snapshotMundo();
    set((s) => ({
      scenes: s.scenes.map((sc) =>
        sc.id !== sceneId ? sc : {
          ...sc,
          actors: sc.actors.filter((a) => a.id !== actorId),
        }
      ),
    }));
  },
  // ── Áreas (rectángulos con nombre que los scripts consultan) ───────────
  // El nombre es la clave que usa el script: actor_in_area("puerta"), etc.
  // Por eso se autogenera único por escena (area2, area3…) si no se pasa uno.
  sceneConnections: [],
  addConnection: (fromSceneId, toSceneId) => {
    get()._snapshotMundo();
    const splashId = get().splashScreen.id;
    if (fromSceneId === splashId) {
      // splash only uses nextSceneId, not SceneConnection
      get().updateSplashScreen({ nextSceneId: toSceneId });
      return;
    }
    if (toSceneId === splashId) return; // splash only outgoing
    set((s) => ({
      sceneConnections: [...s.sceneConnections, { ...makeDefaultConnection(fromSceneId, toSceneId), id: uid() }],
    }));
  },
  removeConnection: (id) => {
    get()._snapshotMundo();
    set((s) => ({
      sceneConnections: s.sceneConnections.filter((c) => c.id !== id),
    }));
  },
  updateConnection: (id, patch) => {
    get()._snapshotMundo();
    set((s) => ({
      sceneConnections: s.sceneConnections.map((c) => c.id === id ? { ...c, ...patch } : c),
    }));
  },

  // ── SplashScreen ────────────────────────────────────────────────────────
  updateSplashScreen: (patch) => set((s) => {
    // If nextSceneId is set or cleared, remove any stale SceneConnections from splash
    if ('nextSceneId' in patch) {
      return {
        splashScreen: { ...s.splashScreen, ...patch },
        sceneConnections: s.sceneConnections.filter((c) => c.fromSceneId !== s.splashScreen.id),
      };
    }
    return { splashScreen: { ...s.splashScreen, ...patch } };
  }),

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
  addFrame: (spriteId, animId) => set((s) => {
    const sprite = s.spriteSheets.find((sp) => sp.id === spriteId);
    const anim = sprite?.animations.find((a) => a.id === animId);
    const lastTile = anim?.frames.length ? anim.frames[anim.frames.length - 1].tileIndex : 0;
    const total = sprite ? sprite.cols * sprite.rows : 0;
    const skipped = sprite?.skippedFrames ?? [];
    let nextTile = lastTile;
    if (total > 0) {
      for (let offset = 1; offset < total; offset++) {
        const candidate = (lastTile + offset) % total;
        if (!skipped.includes(candidate)) { nextTile = candidate; break; }
      }
    }
    return {
      spriteSheets: s.spriteSheets.map((sp) =>
        sp.id !== spriteId ? sp : {
          ...sp,
          animations: sp.animations.map((a) =>
            a.id !== animId ? a : { ...a, frames: [...a.frames, { tileIndex: nextTile, duration: 100 }] }
          ),
        }
      ),
    };
  }),
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
  _mundoUndoStack: [],
  _mundoRedoStack: [],

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

  // ── Undo / Redo for Mundo ──────────────────────────────────────────────
  _snapshotMundo: () => set((s) => ({
    _mundoUndoStack: [...(s._mundoUndoStack ?? []).slice(-49), { scenes: s.scenes, sceneConnections: s.sceneConnections }],
    _mundoRedoStack: [],
  })),
  mundoUndo: () => set((s) => {
    const stack = s._mundoUndoStack ?? [];
    if (stack.length === 0) return s;
    const prev = stack[stack.length - 1];
    return {
      scenes: prev.scenes,
      sceneConnections: prev.sceneConnections,
      _mundoUndoStack: stack.slice(0, -1),
      _mundoRedoStack: [...(s._mundoRedoStack ?? []), { scenes: s.scenes, sceneConnections: s.sceneConnections }],
    };
  }),
  mundoRedo: () => set((s) => {
    const stack = s._mundoRedoStack ?? [];
    if (stack.length === 0) return s;
    const next = stack[stack.length - 1];
    return {
      scenes: next.scenes,
      sceneConnections: next.sceneConnections,
      _mundoRedoStack: stack.slice(0, -1),
      _mundoUndoStack: [...(s._mundoUndoStack ?? []), { scenes: s.scenes, sceneConnections: s.sceneConnections }],
    };
  }),

  // ── Undo / Redo for Sprite sheets ──────────────────────────────────────
  _spriteUndoStack: [],
  _spriteRedoStack: [],

  _snapshotSprite: () => set((s) => ({
    _spriteUndoStack: [...(s._spriteUndoStack ?? []).slice(-49), s.spriteSheets],
    _spriteRedoStack: [],
  })),

  spriteUndo: () => set((s) => {
    const stack = s._spriteUndoStack ?? [];
    if (stack.length === 0) return s;
    const prev = stack[stack.length - 1];
    return {
      spriteSheets: prev,
      _spriteUndoStack: stack.slice(0, -1),
      _spriteRedoStack: [...(s._spriteRedoStack ?? []), s.spriteSheets],
    };
  }),

  spriteRedo: () => set((s) => {
    const stack = s._spriteRedoStack ?? [];
    if (stack.length === 0) return s;
    const next = stack[stack.length - 1];
    return {
      spriteSheets: next,
      _spriteRedoStack: stack.slice(0, -1),
      _spriteUndoStack: [...(s._spriteUndoStack ?? []), s.spriteSheets],
    };
  }),

  // ── Sprite clipboard actions ───────────────────────────────────────────
  copyAnimation: (spriteId, animId) => {
    const sprite = get().spriteSheets.find((sp) => sp.id === spriteId);
    const anim = sprite?.animations.find((a) => a.id === animId);
    if (anim) _copiedAnimation = { ...anim, id: uid(), frames: anim.frames.map((f) => ({ ...f })) };
  },

  pasteAnimation: (spriteId) => {
    if (!_copiedAnimation) return;
    get()._snapshotSprite();
    set((s) => ({
      spriteSheets: s.spriteSheets.map((sp) =>
        sp.id !== spriteId ? sp : {
          ...sp,
          animations: [...sp.animations, { ..._copiedAnimation!, id: uid() }],
        }
      ),
    }));
  },

  cutAnimation: (spriteId, animId) => {
    get().copyAnimation(spriteId, animId);
    get()._snapshotSprite();
    set((s) => ({
      spriteSheets: s.spriteSheets.map((sp) =>
        sp.id !== spriteId ? sp : {
          ...sp,
          animations: sp.animations.filter((a) => a.id !== animId),
        }
      ),
    }));
  },

  copyFrame: (spriteId, animId, frameIdx) => {
    const sprite = get().spriteSheets.find((sp) => sp.id === spriteId);
    const anim = sprite?.animations.find((a) => a.id === animId);
    const frame = anim?.frames[frameIdx];
    if (frame) _copiedAnimationFrame = { frame: { ...frame }, animId };
  },

  pasteFrame: (spriteId, animId) => {
    if (!_copiedAnimationFrame) return;
    get()._snapshotSprite();
    set((s) => ({
      spriteSheets: s.spriteSheets.map((sp) =>
        sp.id !== spriteId ? sp : {
          ...sp,
          animations: sp.animations.map((a) =>
            a.id !== animId ? a : {
              ...a,
              frames: [...a.frames, { ..._copiedAnimationFrame!.frame }],
            }
          ),
        }
      ),
    }));
  },

  cutFrame: (spriteId, animId, frameIdx) => {
    get().copyFrame(spriteId, animId, frameIdx);
    get()._snapshotSprite();
    set((s) => ({
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
    }));
  },

  deleteFrame: (spriteId, animId, frameIdx) => {
    get()._snapshotSprite();
    set((s) => ({
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
    }));
  },

  copyScene: (id) => {
    const scene = get().scenes.find((s) => s.id === id);
    if (scene) _copiedScene = { ...scene, id: uid(), name: scene.name + ' (copia)' };
  },
  pasteScene: (x?: number, y?: number) => {
    if (!_copiedScene) return;
    get()._snapshotMundo();
    const base = _copiedScene.name.replace(/\s*\(copia\)\s*$/, '');
    const names = get().scenes.map((s) => s.name);
    let name = base;
    let num = 2;
    while (names.includes(name)) { name = `${base} ${num}`; num++; }
    const posX = x ?? (get().scenes.length * 30 + 60);
    const posY = y ?? 20;
    set((s) => ({
      scenes: [...s.scenes, { ..._copiedScene!, id: uid(), name, x: posX, y: posY }],
    }));
  },

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
  addSound: (overrides) => {
    const id = crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set((s) => ({
      sounds: [...s.sounds, { ...defaultSoundEffect(), id, name: `Sonido ${s.sounds.length + 1}`, ...overrides }],
      selectedNodeId: id,
    }));
    return id;
  },
  updateSound: (id, patch) => set((s) => ({
    sounds: s.sounds.map((sd) => sd.id === id ? { ...sd, ...patch } : sd),
  })),
  removeSound: (id) => set((s) => ({ sounds: s.sounds.filter((sd) => sd.id !== id) })),
  scripts: [],
  addScript: (mode = 'blocks') => {
    const id = Date.now().toString();
// El esqueleto ofrece las DOS primitivas de movimiento del motor. Descomenta
// la que te sirva: topdown (laberinto/RPG) o plataformas (gravedad + salto).
// Ninguna es obligatoria — si prefieres mover gSelf a mano, borra esto.
const skeletonC = `void script_update(void) {
  u16 keys = ~REG_KEYINPUT & 0x3FF;

  // 4 direcciones, sin gravedad. Para laberintos, RPG o menús.
  moveTopDown(gSelf, keys);

  // Plataformas: gravedad, salto con margen y salto variable.
  // (descomenta esto y comenta moveTopDown si es un plataformas)
  // movePlatformer(gSelf, keys);
}`;
// Esqueleto AdvanceCode: el canónico de advanceCode.ts (evita duplicar el
// ejemplo; muestra primitivas de movimiento, input.* y hooks de área).
const skeletonACod = acodSkeleton();
    set((s) => ({ scripts: [...s.scripts, {
      id, name: 'Nuevo script', mode, blocks: [],
      language: mode === 'language' ? skeletonACod : '',
      cCode: mode === 'c' ? skeletonC : '',
    }], selectedNodeId: id }));
    return id;
  },
  updateScript: (id, patch) => set((s) => ({
    scripts: s.scripts.map((sc) => sc.id === id ? { ...sc, ...patch } : sc),
  })),
  removeScript: (id) => set((s) => ({
    scripts: s.scripts.filter((sc) => sc.id !== id),
    scenes: s.scenes.map((scene) => ({
      ...scene,
      actors: scene.actors.map((a) => (a.scriptId === id ? { ...a, scriptId: undefined } : a)),
    })),
  })),
  setScriptMode: (id, mode) => set((s) => ({
    scripts: s.scripts.map((sc) => sc.id === id ? { ...sc, mode } : sc),
  })),
  fxAssets: [],
  addFxAsset: (asset) => set((s) => ({ fxAssets: [...s.fxAssets, asset] })),
  removeFxAsset: (id) => set((s) => ({ fxAssets: s.fxAssets.filter((a) => a.id !== id) })),
  updateFxAsset: (id, patch) => set((s) => ({
    fxAssets: s.fxAssets.map((a) => a.id === id ? { ...a, ...patch } : a),
  })),
}));

// Auto-save global settings to localStorage on every change
let _prevSettingsJson = '';
useAppStore.subscribe((state) => {
  const json = JSON.stringify({
    mundoShowGrid: state.mundoShowGrid, mundoGridSize: state.mundoGridSize,
    mundoGridOpacity: state.mundoGridOpacity, mundoGridStrokeWidth: state.mundoGridStrokeWidth,
    mundoGridColor: state.mundoGridColor,
    connColorOut: state.connColorOut, connColorIn: state.connColorIn,
    connStrokeWidth: state.connStrokeWidth, clickAnimation: state.clickAnimation,
    showGrid: state.showGrid, gridLineOpacity: state.gridLineOpacity, imageSmoothing: state.imageSmoothing,
    flatColors: state.flatColors, codeFontSize: state.codeFontSize,
  });
  if (json !== _prevSettingsJson) {
    _prevSettingsJson = json;
    try { localStorage.setItem(GLOBAL_SETTINGS_KEY, json); } catch { /* ignore */ }
  }
});

// ── Estado del emulador → log global ────────────────────────────────────────
// La ventana del emulador va en su propia BrowserWindow, así que su estado sólo
// se ve si alguien escucha. Se suscribe una vez al cargar el store para que los
// fallos del emulador aparezcan en el log desde CUALQUIER pestaña, no solo desde
// MundoTab (que es donde antes se pintaba el log).
let emuLogSuscrito = false;
if (typeof window !== 'undefined' && !emuLogSuscrito) {
  emuLogSuscrito = true;
  try {
    window.advanceAPI?.emu?.onEmulatorStatus(({ level, msg }) => {
      const linea = level === 'error' ? `[ERROR] ${msg}` : msg;
      useAppStore.setState((s) => ({ exportLog: [...s.exportLog, linea].slice(-LOG_MAX) }));
    });
  } catch {
    // Sin preload de emulador (p.ej. la vista web de Vite): no pasa nada.
  }
}

export const selectProjects = (state: AppState) => state.projects;
