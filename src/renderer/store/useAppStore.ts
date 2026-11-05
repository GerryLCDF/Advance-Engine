import { create } from 'zustand';
import type { Project, ActiveScreen, LauncherTab, CreditEntry, TemplateId } from '../types';
import type {
  EditorTab, Scene, SceneConnection, SpriteSheet, Background,
  Song, DialogueEntry, DialogueRow, FontTileset, Actor, Animation, AnimationFrame,
  BackgroundLayer, Instrument, Pattern, NoteRow, ADSREnvelope, SplashScreen, FxAsset, SoundEffect, ScriptMode, ScriptData, TransitionConfig,
} from '../types/editor';
import { createCollisionMap, makeDefaultConnection, defaultSoundEffect, defaultFontTileset } from '../types/editor';
import type { GBAExportedActor, GBAExportedActorFrame, GBAExportedSceneBundle, GBASceneTransition } from '../utils/gba_export';
import { scriptEffectiveCCode, acodSkeleton } from '../utils/advanceCode';
import {
  defaultInstrumentPresets, mergeInstrumentPresets, songInstrumentsForExport,
} from '../utils/instrumentPresets';
import type { InstrumentPreset } from '../types/editor';

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
let _toastSeq = 1;

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

const defaultDialogueRow = (dialogueName: string, index: number): DialogueRow => ({
  id: `${dialogueName || 'dialogo'}-${String(index + 1).padStart(3, '0')}-`,
  code: '', speaker: '', text: { ES: '' }, choices: [],
});
const defaultDialogueEntry = (): DialogueEntry => ({
  id: uid(), name: 'Nuevo', sceneId: '', languages: ['ES'],
  rows: [defaultDialogueRow('Nuevo', 0)],
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
  fontLabelBgColor: string;
  setFontLabelBgColor: (val: string) => void;
  fontCanvasBgColor: string;
  setFontCanvasBgColor: (val: string) => void;
  fontCharOrderMode: 'symbols-first' | 'letters-first' | 'custom';
  setFontCharOrderMode: (val: 'symbols-first' | 'letters-first' | 'custom') => void;
  fontCharOrderCustom: string;
  setFontCharOrderCustom: (val: string) => void;
  flatColors: boolean;
  setFlatColors: (val: boolean) => void;
  codeFontSize: number;
  setCodeFontSize: (val: number) => void;
  emulatorKeyMap: EmuButtonMap;
  setEmuKeyMap: (map: EmuButtonMap) => void;
  resetEmuKeyMap: () => void;
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
  /** Avisos cortos (toasts) para validaciones de UI. */
  toasts: { id: number; msg: string }[];
  pushToast: (msg: string) => void;
  dismissToast: (id: number) => void;
  /**
   * Hay una carga de proyecto en curso.
   *
   * While es true, el estado del editor está a medio poblar (escenas vacías).
   * Guardar en ese momento escribía esas escenas vacías encima del proyecto en
   * disco, o sea: abrir un proyecto y pulsar Ctrl+S rápido lo borraba. El
   * guardado se niega mientras dure la carga, y el vigilante de "cambios sin
   * guardar" se resincroniza al terminar para no marcar el proyecto como
   * modificado recién abierto.
   */
  projectLoading: boolean;
  /** ¿Hay una ventana de emulador abierta? Lo usa el botón PLAY/STOP único. */
  emulatorRunning: boolean;
  setEmulatorRunning: (v: boolean) => void;
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
  addScene: (x?: number, y?: number) => string;
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
  /** Biblioteca de presets de instrumento (la edita el inspector de Music). */
  instrumentPresets: InstrumentPreset[];
  updateInstrumentPreset: (id: string, patch: Partial<InstrumentPreset>) => void;
  addSong: () => string;
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
  addDialogue: () => string;
  updateDialogue: (id: string, patch: Partial<DialogueEntry>) => void;
  removeDialogue: (id: string) => void;
  // ── Fuentes de texto (tilesets de caracteres) ──
  fonts: FontTileset[];
  addFont: () => string;
  updateFont: (id: string, patch: Partial<FontTileset>) => void;
  removeFont: (id: string) => void;
  addRow: (dialogueId: string) => void;
  updateRow: (dialogueId: string, rowId: string, patch: Partial<DialogueRow>) => void;
  removeRow: (dialogueId: string, rowId: string) => void;
  addLanguage: (dialogueId: string, lang: string) => void;
  removeLanguage: (dialogueId: string, lang: string) => void;

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
 * Cuántas líneas se pintan en la terminal de MundoTab.
 *
 * El log **no** se recorta en el store a propósito: GlobalAlerts rastrea las
 * líneas nuevas por índice, y con `slice(-LOG_MAX)` el array se mantenía en 600
 * elementos desplazando el contenido, así que al llegar al tope la longitud ya
 * nunca crecía y el bucle "busca lo nuevo" no iteraba nunca más — a partir de
 * ahí ningún error se volvía a avisar. Recortar solo al pintar mantiene los
 * índices estables para el rastreo y acota el DOM.
 */
export const LOG_TERMINAL_LINES = 600;

// Cola de guardado: `saveProject` se encadena aquí para que dos guardados no
// se escriban a la vez (ver saveProject).
let saveChain: Promise<unknown> = Promise.resolve();

// Espera activa de la carga en curso: quien pulse Ctrl+S mientras el proyecto
// se está abriendo no se le niega el guardado, se le espera (ver saveProject).
let ultimaCargaOk = true;
let esperaCarga: (() => void)[] = [];

/**
 * Espera a que termine la carga del proyecto en curso.
 *
 * Mientras carga, el estado del editor está a medio poblar (escenas vacías):
 * guardar o compilar en ese momento escribe/compila un proyecto vacío. Quien
 * llama no se le deniega la operación, se le espera. Devuelve `false` si la
 * carga falló, en cuyo caso el estado sigue vacío y hay que abortar.
 */
async function esperarFinDeCarga(): Promise<boolean> {
  if (!useAppStore.getState().projectLoading) return true;
  await new Promise<void>((resolve) => { esperaCarga.push(resolve); });
  return ultimaCargaOk;
}

// ── Global settings persistence (localStorage) ──────────────────────────────
const GLOBAL_SETTINGS_KEY = 'advance-engine-settings';

interface GlobalSettings {
  mundoShowGrid: boolean; mundoGridSize: number; mundoGridOpacity: number;
  mundoGridStrokeWidth: number; mundoGridColor: string;
  connColorOut: string; connColorIn: string; connStrokeWidth: number;
  clickAnimation: boolean; showGrid: boolean; gridLineOpacity: number; imageSmoothing: boolean;
  fontLabelBgColor: string; fontCanvasBgColor: string; fontCharOrderMode: string; fontCharOrderCustom: string;
  flatColors: boolean; codeFontSize: number;
  emulatorKeyMap: EmuButtonMap;
}

// ── Remapeo de botones del emulador ─────────────────────────────────────────
// Cada botón de la GBA se asigna a un `code` de teclado (KeyboardEvent.code).
// La restricción clave: una misma tecla NO puede estar en dos botones. Quien
// asigna a un botón la tecla de otro, las intercambia (como VS Code): así el
// mapa sigue siendo una biyección y nunca hay duplicados ni teclas huérfanas.
export type EmuButton = 'A' | 'B' | 'L' | 'R' | 'SELECT' | 'START' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
export type EmuButtonMap = Record<EmuButton, string>;

export const EMU_BUTTONS: { id: EmuButton; label: string }[] = [
  { id: 'A', label: 'A' }, { id: 'B', label: 'B' },
  { id: 'L', label: 'L' }, { id: 'R', label: 'R' },
  { id: 'SELECT', label: 'Select' }, { id: 'START', label: 'Start' },
  { id: 'UP', label: '↑ Arriba' }, { id: 'DOWN', label: '↓ Abajo' },
  { id: 'LEFT', label: '← Izquierda' }, { id: 'RIGHT', label: '→ Derecha' },
];

export const EMU_KEY_MAP_DEFAULT: EmuButtonMap = {
  A: 'KeyZ', B: 'KeyX', L: 'KeyA', R: 'KeyS',
  SELECT: 'KeyV', START: 'Enter',
  UP: 'ArrowUp', DOWN: 'ArrowDown', LEFT: 'ArrowLeft', RIGHT: 'ArrowRight',
};

/** Teclas que se pueden asignar, con su etiqueta legible. */
export const EMU_KEY_OPTIONS: { code: string; label: string }[] = [
  { code: 'ArrowUp', label: '↑ Arriba' }, { code: 'ArrowDown', label: '↓ Abajo' },
  { code: 'ArrowLeft', label: '← Izquierda' }, { code: 'ArrowRight', label: '→ Derecha' },
  { code: 'KeyZ', label: 'Z' }, { code: 'KeyX', label: 'X' },
  { code: 'KeyC', label: 'C' }, { code: 'KeyV', label: 'V' },
  { code: 'KeyB', label: 'B' }, { code: 'KeyN', label: 'N' }, { code: 'KeyM', label: 'M' },
  { code: 'KeyA', label: 'A' }, { code: 'KeyS', label: 'S' }, { code: 'KeyD', label: 'D' },
  { code: 'KeyF', label: 'F' }, { code: 'KeyG', label: 'G' }, { code: 'KeyH', label: 'H' },
  { code: 'KeyJ', label: 'J' }, { code: 'KeyK', label: 'K' }, { code: 'KeyL', label: 'L' },
  { code: 'KeyQ', label: 'Q' }, { code: 'KeyW', label: 'W' }, { code: 'KeyE', label: 'E' },
  { code: 'KeyR', label: 'R' }, { code: 'KeyT', label: 'T' }, { code: 'KeyY', label: 'Y' },
  { code: 'KeyU', label: 'U' }, { code: 'KeyI', label: 'I' }, { code: 'KeyO', label: 'O' },
  { code: 'KeyP', label: 'P' },
  { code: 'Digit1', label: '1' }, { code: 'Digit2', label: '2' }, { code: 'Digit3', label: '3' },
  { code: 'Digit4', label: '4' }, { code: 'Digit5', label: '5' }, { code: 'Digit6', label: '6' },
  { code: 'Digit7', label: '7' }, { code: 'Digit8', label: '8' }, { code: 'Digit9', label: '9' },
  { code: 'Digit0', label: '0' },
  { code: 'Enter', label: '↵ Enter' }, { code: 'Space', label: 'Espacio' },
  { code: 'ShiftLeft', label: 'Shift izq' }, { code: 'ShiftRight', label: 'Shift der' },
  { code: 'ControlLeft', label: 'Ctrl izq' }, { code: 'ControlRight', label: 'Ctrl der' },
  { code: 'Tab', label: 'Tab' }, { code: 'Backspace', label: 'Retroceso' },
  { code: 'Escape', label: 'Esc' }, { code: 'CapsLock', label: 'Bloq Mayús' },
  { code: 'Comma', label: ',' }, { code: 'Period', label: '.' }, { code: 'Slash', label: '/' },
  { code: 'Semicolon', label: ';' }, { code: 'Quote', label: "'" },
  { code: 'BracketLeft', label: '[' }, { code: 'BracketRight', label: ']' },
  { code: 'Backslash', label: '\\' }, { code: 'Minus', label: '-' }, { code: 'Equal', label: '=' },
  { code: 'Home', label: 'Inicio' }, { code: 'End', label: 'Fin' },
  { code: 'PageUp', label: 'Re Pág' }, { code: 'PageDown', label: 'Av Pág' },
  { code: 'Insert', label: 'Insertar' }, { code: 'Delete', label: 'Supr' },
  ...Array.from({ length: 12 }, (_, i) => ({ code: `F${i + 1}`, label: `F${i + 1}` })),
];

/**
 * Normaliza un mapa recibido (de localStorage o de la URL): se asegura de que
 * tenga los 10 botones con una tecla válida y SIN duplicados. Lo que no encaja
 * se resuelve cambiando el valor por la tecla libre que le toque por defecto.
 */
export function normalizeEmuKeyMap(raw: unknown): EmuButtonMap {
  const out: EmuButtonMap = { ...EMU_KEY_MAP_DEFAULT };
  if (!raw || typeof raw !== 'object') return out;
  const valid = new Set(EMU_KEY_OPTIONS.map((o) => o.code));
  const usados = new Set<string>();
  const libre = (): string => {
    const d = EMU_KEY_MAP_DEFAULT;
    const preferido = Object.values(d).find((c) => valid.has(c) && !usados.has(c));
    if (preferido) return preferido;
    return EMU_KEY_OPTIONS.find((o) => !usados.has(o.code))?.code ?? 'Space';
  };
  for (const btn of EMU_BUTTONS) {
    const code = (raw as Record<string, string>)[btn.id];
    if (typeof code === 'string' && valid.has(code) && !usados.has(code)) {
      out[btn.id] = code;
      usados.add(code);
    } else if (typeof code === 'string' && valid.has(code) && usados.has(code)) {
      // Tecla duplicada en la fuente: se le busca otra libre para que el mapa
      // siga siendo usable (no debería pasar: el setter lo evita).
      const l = libre();
      out[btn.id] = l;
      usados.add(l);
    }
  }
  return out;
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

// ── Extrae datos de fuentes (tilesets de caracteres) para el export GBA ──
async function extractFontsData(fonts: any[], log: { add: (m: string) => void }): Promise<string> {
  if (!fonts || fonts.length === 0) return '';
  const api = window.advanceAPI;
  const blocks: string[] = [];
  const charMaps: string[] = [];
  const spacingX: number[] = [];
  const spacingY: number[] = [];
  let idx = 0;
  for (const f of fonts) {
    if (!f.imagePath) { log.add(`[WARN] Fuente "${f.name}": sin imagen, omitida`); continue; }
    const cols = f.cols || 16;
    const rows = f.rows || 6;
    const totalTiles = cols * rows;
    try {
      const gbaResult = await api.file.convertImageToGbaBase64ExactAlpha(f.imagePath);
      if (!gbaResult.success || !gbaResult.base64 || !gbaResult.width || !gbaResult.height) {
        log.add(`[WARN] Fuente "${f.name}": no se pudo convertir imagen`);
        continue;
      }
      const sw = gbaResult.width;
      const sh = gbaResult.height;
      const tileW = Math.floor(sw / cols);
      const tileH = Math.floor(sh / rows);
      const binaryStr = atob(gbaResult.base64);
      // charMap -> tile index; build reverse map tile->char
      const charMap: Record<string, number> = (f.charMap && typeof f.charMap === 'object') ? f.charMap : {};
      const tileToChar: string[] = new Array(totalTiles).fill('');
      for (const [ch, ti] of Object.entries(charMap)) {
        if (typeof ti === 'number' && ti >= 0 && ti < totalTiles) tileToChar[ti] = ch;
      }
      // unassigned
      const unassigned: number[] = Array.isArray(f.unassigned) ? f.unassigned : [];
      // Build gFontCharMap[256]: char code -> tile index (-1 if none)
      const charToTile: number[] = new Array(256).fill(-1);
      for (let t = 0; t < totalTiles; t++) {
        if (unassigned.includes(t)) continue;
        const ch = tileToChar[t];
        if (ch) {
          const code = ch.charCodeAt(0);
          if (code >= 0 && code < 256) charToTile[code] = t;
        } else {
          const code = (f.firstChar ?? 32) + t;
          if (code >= 0 && code < 256 && !unassigned.includes(t)) charToTile[code] = t;
        }
      }
      charMaps.push('  { ' + charToTile.join(', ') + ' }');
      // Build pixel array per tile
      const tilePixels: string[] = [];
      for (let t = 0; t < totalTiles; t++) {
        const tc = t % cols;
        const tr = Math.floor(t / cols);
        const lines: string[] = [];
        for (let py = 0; py < tileH; py++) {
          const vals: string[] = [];
          for (let px = 0; px < tileW; px++) {
            const srcIdx = ((tr * tileH + py) * sw + (tc * tileW + px)) * 2;
            if (srcIdx + 1 >= binaryStr.length) { vals.push('0x8000'); continue; }
            const lo = binaryStr.charCodeAt(srcIdx);
            const hi = binaryStr.charCodeAt(srcIdx + 1);
            const val = (hi << 8) | lo;
            // font: non-transparent pixels reveal; treat alpha via high bit
            if (val & 0x8000) vals.push('0x8000');
            else vals.push(`0x${(val & 0x7FFF).toString(16).padStart(4, '0')}`);
          }
          lines.push('    {' + vals.join(',') + '}');
        }
        tilePixels.push('  {\n' + lines.join(',\n') + '\n  }');
      }
      const block = `
// ── Font ${idx}: ${f.name} (${cols}x${rows}, ${tileW}x${tileH}) ──
#define FONT_${idx}_COLS ${cols}
#define FONT_${idx}_ROWS ${rows}
#define FONT_${idx}_TW ${tileW}
#define FONT_${idx}_TH ${tileH}
static const u16 gFont${idx}Pixels[${totalTiles}][${tileH}][${tileW}] = {
${tilePixels.join(',\n')}
};

`;
      blocks.push(block);
      spacingX.push(f.letterSpacingX ?? 0);
      spacingY.push(f.letterSpacingY ?? 0);
      idx++;
      log.add(`Fuente "${f.name}": ${cols}x${rows} tiles de ${tileW}x${tileH}`);
    } catch (err: any) {
      log.add(`[WARN] Fuente "${f.name}": error — ${String(err)}`);
    }
  }
  // Sin fuentes válidas no se emite nada: el helper drawText referenciaría
  // arrays que no existen y el main.c no compilaría.
  if (idx === 0) return '';
  // Registry
  blocks.push(`
#define FONT_COUNT ${idx}
static const int gFontCols[FONT_COUNT] = { ${Array.from({length: idx}, (_, i) => `FONT_${i}_COLS`).join(', ')} };
static const int gFontRows[FONT_COUNT] = { ${Array.from({length: idx}, (_, i) => `FONT_${i}_ROWS`).join(', ')} };
static const int gFontTw[FONT_COUNT] = { ${Array.from({length: idx}, (_, i) => `FONT_${i}_TW`).join(', ')} };
static const int gFontTh[FONT_COUNT] = { ${Array.from({length: idx}, (_, i) => `FONT_${i}_TH`).join(', ')} };
static const int gFontSpacingX[FONT_COUNT] = { ${spacingX.join(', ')} };
static const int gFontSpacingY[FONT_COUNT] = { ${spacingY.join(', ')} };
static const u8 gFontCharMap[FONT_COUNT][256] = {
${charMaps.join(',\n')}
};
static const u16* const gFontPixels[FONT_COUNT] = {
${Array.from({length: idx}, (_, i) => `  &gFont${i}Pixels[0][0][0]`).join(',\n')}
};
`);
  // drawText helper
  blocks.push(`
void drawText(int fontIdx, int x, int y, const char* text) {
  const u16* pix;
  int tw, th, cx, cy, py, px;
  const char* p;
  if (fontIdx < 0 || fontIdx >= FONT_COUNT || !text) return;
  tw = gFontTw[fontIdx];
  th = gFontTh[fontIdx];
  pix = gFontPixels[fontIdx];
  cx = x; cy = y;
  p = text;
  while (*p) {
    if (*p == '\\n') { cx = x; cy += th + gFontSpacingY[fontIdx] + 2; p++; continue; }
    {
      int tile = gFontCharMap[fontIdx][(unsigned char)*p];
      if (tile >= 0) {
        for (py = 0; py < th; py++) {
          for (px = 0; px < tw; px++) {
            u16 v = pix[(tile * th + py) * tw + px];
            if (!(v & 0x8000)) {
              int sx = cx + px;
              int sy = cy + py;
              if (sx >= 0 && sx < SCREEN_W && sy >= 0 && sy < SCREEN_H)
                gBackBuf[sy * SCREEN_W + sx] = v;
            }
          }
        }
      }
    }
    cx += tw + gFontSpacingX[fontIdx];
    p++;
  }
}
`);
  return blocks.join('\n');
}

// ── Extrae datos de dialog boxes (sprites 3x3) para el export GBA ──
async function extractDialogBoxesData(sheets: any[], log: { add: (m: string) => void }): Promise<string> {
  if (!sheets || sheets.length === 0) return '';
  const api = window.advanceAPI;
  const blocks: string[] = [];
  let idx = 0;
  for (const sh of sheets) {
    if (!sh.tilesetPath) { log.add(`[WARN] DialogBox "${sh.name}": sin imagen, omitido`); continue; }
    try {
      const gbaResult = await api.file.convertImageToGbaBase64ExactAlpha(sh.tilesetPath);
      if (!gbaResult.success || !gbaResult.base64 || !gbaResult.width || !gbaResult.height) {
        log.add(`[WARN] DialogBox "${sh.name}": no se pudo convertir imagen`);
        continue;
      }
      const sw = gbaResult.width;
      const shh = gbaResult.height;
      const cols = sh.cols || 3;
      const rows = sh.rows || 3;
      const tw = Math.floor(sw / cols);
      const th = Math.floor(shh / rows);
      const binaryStr = atob(gbaResult.base64);
      const tiles: string[] = [];
      for (let t = 0; t < cols * rows; t++) {
        const tc = t % cols;
        const tr = Math.floor(t / cols);
        const lines: string[] = [];
        for (let py = 0; py < th; py++) {
          const vals: string[] = [];
          for (let px = 0; px < tw; px++) {
            const srcIdx = ((tr * th + py) * sw + (tc * tw + px)) * 2;
            if (srcIdx + 1 >= binaryStr.length) { vals.push('0x8000'); continue; }
            const lo = binaryStr.charCodeAt(srcIdx);
            const hi = binaryStr.charCodeAt(srcIdx + 1);
            const val = (hi << 8) | lo;
            if (val & 0x8000) vals.push('0x8000');
            else vals.push(`0x${(val & 0x7FFF).toString(16).padStart(4, '0')}`);
          }
          lines.push('    {' + vals.join(',') + '}');
        }
        tiles.push('  {\n' + lines.join(',\n') + '\n  }');
      }
      blocks.push(`
// ── DialogBox ${idx}: ${sh.name} (${cols}x${rows}, ${tw}x${th}) ──
#define DB_${idx}_COLS ${cols}
#define DB_${idx}_ROWS ${rows}
#define DB_${idx}_TW ${tw}
#define DB_${idx}_TH ${th}
static const u16 gDialogBox${idx}Pixels[9][${th}][${tw}] = {
${tiles.join(',\n')}
};
`);
      idx++;
      log.add(`DialogBox "${sh.name}": ${cols}x${rows} tiles de ${tw}x${th}`);
    } catch (err: any) {
      log.add(`[WARN] DialogBox "${sh.name}": error — ${String(err)}`);
    }
  }
  if (idx === 0) return '';
  let out = blocks.join('\n');
  // registry
  out += `
#define DIALOGBOX_COUNT ${idx}
`;
  // drawDialogBox helper
  out += `
static const u16* const gDialogBoxPixels[DIALOGBOX_COUNT] = {
${Array.from({ length: idx }, (_, i) => `  &gDialogBox${i}Pixels[0][0][0]`).join(',\n')}
};
static const int gDialogBoxTw[DIALOGBOX_COUNT] = { ${Array.from({ length: idx }, (_, i) => `DB_${i}_TW`).join(', ')} };
static const int gDialogBoxTh[DIALOGBOX_COUNT] = { ${Array.from({ length: idx }, (_, i) => `DB_${i}_TH`).join(', ')} };

void drawDialogBox(int dbIdx, int x, int y, int w, int h) {
  const u16* pix;
  int tw, th, py, px;
  if (dbIdx < 0 || dbIdx >= DIALOGBOX_COUNT) return;
  pix = gDialogBoxPixels[dbIdx];
  tw = gDialogBoxTw[dbIdx];
  th = gDialogBoxTh[dbIdx];
  // tiles: 0=arriba-izq, 1=arriba, 2=arriba-der, 3=izq, 4=centro,
  //        5=der, 6=abajo-izq, 7=abajo, 8=abajo-der
  // esquina superior izquierda (tile 0)
  for (py = 0; py < th && py < h; py++)
    for (px = 0; px < tw && px < w; px++) {
      u16 v = pix[(0 * th + py) * tw + px];
      if (!(v & 0x8000)) { int sx=x+px, sy=y+py; if (sx>=0&&sx<SCREEN_W&&sy>=0&&sy<SCREEN_H) gBackBuf[sy*SCREEN_W+sx]=v; }
    }
  // esquina superior derecha (tile 2)
  for (py = 0; py < th && py < h; py++)
    for (px = 0; px < tw && (w-tw+px) >= 0 && (w-tw+px) < w; px++) {
      u16 v = pix[(2 * th + py) * tw + px];
      if (!(v & 0x8000)) { int sx=x+(w-tw+px), sy=y+py; if (sx>=0&&sx<SCREEN_W&&sy>=0&&sy<SCREEN_H) gBackBuf[sy*SCREEN_W+sx]=v; }
    }
  // esquina inferior izquierda (tile 6)
  for (py = 0; py < th && (h-th+py) >= 0 && (h-th+py) < h; py++)
    for (px = 0; px < tw && px < w; px++) {
      u16 v = pix[(6 * th + py) * tw + px];
      if (!(v & 0x8000)) { int sx=x+px, sy=y+(h-th+py); if (sx>=0&&sx<SCREEN_W&&sy>=0&&sy<SCREEN_H) gBackBuf[sy*SCREEN_W+sx]=v; }
    }
  // esquina inferior derecha (tile 8)
  for (py = 0; py < th && (h-th+py) >= 0 && (h-th+py) < h; py++)
    for (px = 0; px < tw && (w-tw+px) >= 0 && (w-tw+px) < w; px++) {
      u16 v = pix[(8 * th + py) * tw + px];
      if (!(v & 0x8000)) { int sx=x+(w-tw+px), sy=y+(h-th+py); if (sx>=0&&sx<SCREEN_W&&sy>=0&&sy<SCREEN_H) gBackBuf[sy*SCREEN_W+sx]=v; }
    }
  // borde superior (tile 1) estirado
  for (py = 0; py < th && py < h; py++)
    for (px = tw; px < w - tw; px++) {
      u16 v = pix[(1 * th + py) * tw + (px % tw)];
      if (!(v & 0x8000)) { int sx=x+px, sy=y+py; if (sx>=0&&sx<SCREEN_W&&sy>=0&&sy<SCREEN_H) gBackBuf[sy*SCREEN_W+sx]=v; }
    }
  // borde inferior (tile 7) estirado
  for (py = 0; py < th && (h-th+py) >= 0 && (h-th+py) < h; py++)
    for (px = tw; px < w - tw; px++) {
      u16 v = pix[(7 * th + py) * tw + (px % tw)];
      if (!(v & 0x8000)) { int sx=x+px, sy=y+(h-th+py); if (sx>=0&&sx<SCREEN_W&&sy>=0&&sy<SCREEN_H) gBackBuf[sy*SCREEN_W+sx]=v; }
    }
  // borde izquierdo (tile 3) estirado
  for (py = th; py < h - th; py++)
    for (px = 0; px < tw && px < w; px++) {
      u16 v = pix[(3 * th + (py % th)) * tw + px];
      if (!(v & 0x8000)) { int sx=x+px, sy=y+py; if (sx>=0&&sx<SCREEN_W&&sy>=0&&sy<SCREEN_H) gBackBuf[sy*SCREEN_W+sx]=v; }
    }
  // borde derecho (tile 5) estirado
  for (py = th; py < h - th; py++)
    for (px = 0; px < tw && (w-tw+px) >= 0 && (w-tw+px) < w; px++) {
      u16 v = pix[(5 * th + (py % th)) * tw + px];
      if (!(v & 0x8000)) { int sx=x+(w-tw+px), sy=y+py; if (sx>=0&&sx<SCREEN_W&&sy>=0&&sy<SCREEN_H) gBackBuf[sy*SCREEN_W+sx]=v; }
    }
  // centro (tile 4) relleno
  for (py = th; py < h - th; py++)
    for (px = tw; px < w - tw; px++) {
      u16 v = pix[(4 * th + (py % th)) * tw + (px % tw)];
      if (!(v & 0x8000)) { int sx=x+px, sy=y+py; if (sx>=0&&sx<SCREEN_W&&sy>=0&&sy<SCREEN_H) gBackBuf[sy*SCREEN_W+sx]=v; }
    }
}
`;
  return out;
}

// ── Extrae datos de diálogos para el export GBA ──
async function extractDialoguesData(dialogues: any[], log: { add: (m: string) => void }): Promise<string> {
  if (!dialogues || dialogues.length === 0) return '';
  const MAX_ROWS = 64;
  const MAX_LANGS = 6;
  const blocks: string[] = [];
  const rowCountArr: number[] = [];
  const langCountArr: number[] = [];
  const escC = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const textArr: string[] = []; // per dialogue: array of rows, each row array of langs
  const codeArr: string[] = []; // per dialogue: código de cada fila
  const idArr: string[] = [];   // per dialogue: ID completa de cada fila
  const fontArr: string[] = [];
  let idx = 0;
  for (const d of dialogues) {
    const rows = d.rows ?? [];
    const langs = d.languages ?? ['ES'];
    const rc = Math.min(rows.length, MAX_ROWS);
    const lc = Math.min(langs.length, MAX_LANGS);
    rowCountArr.push(rc);
    langCountArr.push(lc);
    const rowTexts: string[] = [];
    const rowFonts: string[] = [];
    const rowCodes: string[] = [];
    const rowIds: string[] = [];
    for (let r = 0; r < rc; r++) {
      const row = rows[r];
      const fontId = row.fontId;
      // map fontId to index in state.fonts (will be resolved later; store -1 for now, resolve below)
      rowFonts.push(String(-1));
      rowCodes.push('"' + escC(String(row.code ?? '')) + '"');
      rowIds.push('"' + escC(String(row.id ?? '')) + '"');
      const langTexts: string[] = [];
      for (let l = 0; l < lc; l++) {
        const lang = langs[l];
        const txt = (row.text && row.text[lang]) ? String(row.text[lang]) : '';
        langTexts.push('"' + escC(txt) + '"');
      }
      // pad langs
      while (langTexts.length < MAX_LANGS) langTexts.push('""');
      rowTexts.push('    { ' + langTexts.join(', ') + ' }');
    }
    // pad rows
    while (rowTexts.length < MAX_ROWS) {
      rowTexts.push('    { ' + Array(MAX_LANGS).fill('""').join(', ') + ' }');
    }
    while (rowCodes.length < MAX_ROWS) rowCodes.push('""');
    while (rowIds.length < MAX_ROWS) rowIds.push('""');
    textArr.push('  {\n' + rowTexts.join(',\n') + '\n  }');
    codeArr.push('  { ' + rowCodes.join(', ') + ' }');
    idArr.push('  { ' + rowIds.join(', ') + ' }');
    fontArr.push('  { ' + rowFonts.join(', ') + Array(MAX_ROWS - rc).fill('-1').join(', ') + (rc < MAX_ROWS ? (rc > 0 ? ', ' : '') + Array(MAX_ROWS - rc).fill('-1').join(', ') : '') + ' }');
    idx++;
    log.add(`Dialogo "${d.name}": ${rc} filas, ${lc} idiomas`);
  }
  if (idx === 0) return '';
  let out = `
#define DIALOGUE_COUNT ${idx}
#define MAX_DIALOGUE_ROWS ${MAX_ROWS}
#define MAX_DIALOGUE_LANGS ${MAX_LANGS}
static const int gDialogueRowCount[DIALOGUE_COUNT] = { ${rowCountArr.join(', ')} };
static const int gDialogueLangCount[DIALOGUE_COUNT] = { ${langCountArr.join(', ')} };
static const char* gDialogueText[DIALOGUE_COUNT][MAX_DIALOGUE_ROWS][MAX_DIALOGUE_LANGS] = {
${textArr.join(',\n')}
};
static const char* gRowCode[DIALOGUE_COUNT][MAX_DIALOGUE_ROWS] = {
${codeArr.join(',\n')}
};
static const char* gRowId[DIALOGUE_COUNT][MAX_DIALOGUE_ROWS] = {
${idArr.join(',\n')}
};

int gLang = 0;
static int gActiveDialogue = -1;
const char* gCurrentDialogueText = "";
static int gActiveRow = 0;
static int gDialogueVisible = 0;
static int gActiveDialogFont = -1;

void showDialogue(int id) {
  if (id < 0 || id >= DIALOGUE_COUNT) return;
  gActiveDialogue = id;
  gActiveRow = 0;
  gCurrentDialogueText = gDialogueText[id][0][gLang];
  gDialogueVisible = 1;
  gActiveDialogFont = -1;
}
void hideDialogue(void) { gDialogueVisible = 0; gActiveDialogue = -1; gActiveRow = 0; gCurrentDialogueText = ""; }
void nextDialogueRow(void) {
  if (!gDialogueVisible) return;
  gActiveRow++;
  if (gActiveRow >= gDialogueRowCount[gActiveDialogue]) hideDialogue();
  else gCurrentDialogueText = gDialogueText[gActiveDialogue][gActiveRow][gLang];
}
void showDialogueRow(const char* key) {
  int d, r;
  if (!key) return;
  for (d = 0; d < DIALOGUE_COUNT; d++) {
    for (r = 0; r < gDialogueRowCount[d]; r++) {
      if (strEq(gRowCode[d][r], key) || strEq(gRowId[d][r], key)) {
        gActiveDialogue = d;
        gActiveRow = r;
        gCurrentDialogueText = gDialogueText[d][r][gLang];
        gDialogueVisible = 1;
        return;
      }
    }
  }
}
`;
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
      instrumentPresets: defaultInstrumentPresets(),
      dialogues: [],
      fonts: [],
      sounds: [],
      scripts: [],
      fxAssets: [],
      dirty: false,
      exportLog: [],
      projectLoading: true,
      emulatorRunning: false,
      selectedNodeId: '',
      _songsUndoStack: [],
      _songsRedoStack: [],
      _mundoUndoStack: [],
      _mundoRedoStack: [],
      _spriteUndoStack: [],
      _spriteRedoStack: [],
    }));
    // Cargar datos guardados del proyecto. Se espera: mientras dura, el estado
    // está a medio poblar y cualquier guardado (Ctrl+S) lo escribiría vacío.
    const st = get();
    if (st.projectDir) {
      await get().loadProject(st.projectDir);
    } else {
      set({ projectLoading: false });
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
      fontLabelBgColor: _saved.fontLabelBgColor ?? 'rgba(0,0,0,0.55)',
      fontCanvasBgColor: _saved.fontCanvasBgColor ?? '#1a1a24',
      fontCharOrderMode: (_saved.fontCharOrderMode as any) ?? 'symbols-first',
      fontCharOrderCustom: _saved.fontCharOrderCustom ?? '',
      flatColors: _saved.flatColors ?? false,
      setFlatColors: (val) => set({ flatColors: val }),
      codeFontSize: clampFontSize(_saved.codeFontSize ?? 12),
      emulatorKeyMap: normalizeEmuKeyMap(_saved.emulatorKeyMap),
      setEmuKeyMap: (map) => set({ emulatorKeyMap: normalizeEmuKeyMap(map) }),
      resetEmuKeyMap: () => set({ emulatorKeyMap: { ...EMU_KEY_MAP_DEFAULT } }),
  setCodeFontSize: (val) => set({ codeFontSize: clampFontSize(val) }),
  setImageSmoothing: (val) => set({ imageSmoothing: val }),
  setFontLabelBgColor: (val) => set({ fontLabelBgColor: val }),
  setFontCanvasBgColor: (val) => set({ fontCanvasBgColor: val }),
  setFontCharOrderMode: (val) => set({ fontCharOrderMode: val }),
  setFontCharOrderCustom: (val) => set({ fontCharOrderCustom: val }),
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
    instrumentPresets: defaultInstrumentPresets(),
    dialogues: [],
    fonts: [],
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
  toasts: [],
  pushToast: (msg) => {
    const id = _toastSeq++;
    set((s) => ({ toasts: [...s.toasts, { id, msg }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  projectLoading: false,
  emulatorRunning: false,
  setEmulatorRunning: (v) => set({ emulatorRunning: v }),
  addExportLog: (msg) => set((s) => ({ exportLog: [...s.exportLog, msg] })),
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
      // La canción que llega al export lleva su tabla de instrumentos derivada
      // de los presets usados por sus notas (songInstrumentsForExport): sin
      // esto, generateSongData solo ve el instrumento default de la canción y
      // TODAS las notas suenan igual en la ROM.
      const songParaExport = (s: Song): Song => ({
        ...s,
        instruments: songInstrumentsForExport(s, state.instrumentPresets),
      });
      const splashSong = splashSongId
        ? (state.songs.find((s) => s.id === splashSongId) ?? undefined)
        : undefined;
      const splashSongExport = splashSong ? songParaExport(splashSong) : undefined;
      if (splashSong) {
        log.add(`Canción de splash: "${splashSong.name}"`);
      }
      if (state.splashScreen?.backgroundSoundId) {
        const found = state.sounds.find((s) => s.id === state.splashScreen.backgroundSoundId);
        if (found?.pcmBase64) log.add(`Splash: sonido de fondo "${found.name}" → PCM por DMA`);
        else log.add(`[WARN] Splash: "${found?.name ?? 'desconocido'}" no tiene audio convertido — impórtalo en Sound para que suene`);
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
            song = songParaExport(found);
            log.add(`Canción de escena "${scene.name}": "${found.name}" (${found.patterns.length} patrones)`);
          } else {
            log.add(`[WARN] backgroundSong "${scene.backgroundSong}" no encontrada entre las canciones`);
          }
        }
        if (scene.backgroundSoundId) {
          const found = state.sounds.find((s) => s.id === scene.backgroundSoundId);
          if (found?.pcmBase64) log.add(`Escena "${scene.name}": sonido de fondo "${found.name}" → PCM por DMA`);
          else log.add(`[WARN] Escena "${scene.name}": "${found?.name ?? 'desconocido'}" no tiene audio convertido — impórtalo en Sound para que suene`);
        }
        // ── Actores de la escena (sprites software OVERLAY) ───────────────
        if (scene.actors?.length) {
          for (const actor of scene.actors) {
            if (!actor.spriteId && actor.type !== 'texto') {
              log.add(`[WARN] Actor "${actor.name}" sin spritesheet: omitido en export GBA (type=${actor.type})`);
              continue;
            }
            // Actor 'texto' sin spritesheet: se exporta como actor invisible (solo para script/área)
            if (!actor.spriteId) {
              actors.push({
                name: actor.name,
                x: Math.round(actor.x - camX),
                y: Math.round(actor.y - camY),
                z: actor.z || 0,
                w: actor.width || 8,
                h: actor.height || 8,
                mode: 'loop',
                frames: [],
                delays: [],
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
                dialogBoxSpriteId: actor.dialogBoxSpriteId || undefined,
                dialogBoxW: actor.dialogBoxW,
                dialogBoxH: actor.dialogBoxH,
                dialogBoxOffsetX: actor.dialogBoxOffsetX ?? 0,
                dialogBoxOffsetY: actor.dialogBoxOffsetY ?? 0,
                scriptId: actor.scriptId || undefined,
              });
              log.add(`Actor "${actor.name}": texto (sin sprite), solo script/área`);
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
              dialogBoxSpriteId: actor.dialogBoxSpriteId || undefined,
              dialogBoxW: actor.dialogBoxW,
              dialogBoxH: actor.dialogBoxH,
              dialogBoxOffsetX: actor.dialogBoxOffsetX ?? 0,
              dialogBoxOffsetY: actor.dialogBoxOffsetY ?? 0,
              scriptId: actor.scriptId || undefined,
            });
            log.add(`Actor "${actor.name}": ${tw}x${th}, ${frames.length} frames (${anim.name}), z=${actor.z || 0}`);
          }
        }
        return {
          id: scene.id, name: scene.name, imageCArray, color, collisionMap,
          collisionTileSize: scene.collisionTileSize || 8, camX, camY, actors,
          song,
          soundId: scene.backgroundSoundId || undefined,
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

      const fontsCCode = await extractFontsData(state.fonts ?? [], log);
      // collect unique dialog box sprite sheets
      const dbSpriteIds = new Set<string>();
      for (const sc of state.scenes) {
        for (const a of (sc.actors ?? [])) {
          if (a.dialogBoxSpriteId) dbSpriteIds.add(a.dialogBoxSpriteId);
        }
      }
      const dbSprites = (state.spriteSheets ?? []).filter((sp: any) => dbSpriteIds.has(sp.id));
      const dialogBoxesCCode = await extractDialogBoxesData(dbSprites, log);
      const dialoguesCCode = await extractDialoguesData(state.dialogues ?? [], log);

      const cCode = generateGBAProject({
        scenes: state.scenes,
        sceneConnections: state.sceneConnections,
        backgrounds: state.backgrounds ?? [],
        sprites: state.spriteSheets ?? [],
        songs: state.songs,
        sounds: state.sounds ?? [],
        dialogues: state.dialogues ?? [],
        fonts: state.fonts ?? [],
        scripts: state.scripts ?? [],
        splashSoundId: state.splashScreen?.backgroundSoundId || undefined,
      }, project.name, project.author, log, splashCArray, splashDuration, splashSongExport, sceneSong, sceneCArray, sceneColor,
        entryTilesetCArray, entryTileSize, entryTilesetFrames, entryTilesetSpeed, entryTilesetFw, entryTilesetFh,
        exitTilesetCArray, exitTileSize, exitTilesetFrames, exitTilesetSpeed, exitTilesetFw, exitTilesetFh,
        exitTransitionDuration, exitGradientCArray, exitGradientW, exitGradientH,
        entryGradientCArray, entryGradientW, entryGradientH,
        entryTransitionType, exitTransitionType,
        sceneCollisionMap, sceneCollisionTileSize, sceneCamX, sceneCamY, actorsExport,
        fontsCCode,
        dialogBoxesCCode,
        dialoguesCCode,
        { scenes: allSceneBundles, startSceneId: state.splashScreen?.nextSceneId ?? '', transitions: sceneTransitions });
      const makefile = generateMakefile(project.name, log);
      const api = window.advanceAPI;
      const buildDir = `${projectDir}/build`;
      await api.dir.create(buildDir);
      await api.file.writeText(`${buildDir}/main.c`, cCode);
      await api.file.writeText(`${buildDir}/Makefile`, makefile);

      // Publicar el detalle. Al guardar (verbose: false) no se publica: son
      // ~40 líneas por guardado y el log se hacía ilegible.
      if (verbose) set((s) => ({ exportLog: [...s.exportLog, ...log.messages] }));
      return true;
    } catch (err: any) {
      // El error siempre se publica, aussi en silencio: si no, un fallo al
      // guardar no se vería por ningún lado.
      set((s) => ({ exportLog: [...s.exportLog, `[ERROR] generateBuildFiles: ${String(err)}`] }));
      return false;
    }
  },
  saveProject: async () => {
    // Guardados encolados: sin esto, un Ctrl+S en racha (o el guardado del
    // menú mientras el otro corre) launches dos escrituras de project.json y de
    // main.c a la vez, y se pisan entre sí.
    const run = async (): Promise<boolean> => {
      // Si el proyecto se está abriendo, se espera a que termine en vez de
      // denegar: denegar obligaba al usuario a repetir el Ctrl+S. Guardar el
      // estado a medio poblar era justo lo que vaciaba el proyecto en disco.
      if (get().projectLoading) {
        const cargado = await esperarFinDeCarga();
        if (!cargado) {
          set((s) => ({ exportLog: [...s.exportLog, '[ERROR] El proyecto no se pudo cargar — no se guarda (habría escrito el estado vacío encima)'] }));
          return false;
        }
      }
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
          instrumentPresets: state.instrumentPresets,
          sounds: state.sounds ?? [],
          fxAssets: state.fxAssets ?? [],
          dialogues: state.dialogues ?? [],
        fonts: state.fonts ?? [],
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
    };
    const chain = saveChain.then(run, run);
    saveChain = chain.catch(() => false);
    return chain;
  },
  loadProject: async (path) => {
    let ok = false;
    ultimaCargaOk = true;
    set({ projectLoading: true });
    try {
      const api = window.advanceAPI;
      get().beginExportRun();
      set((s) => ({ exportLog: [...s.exportLog, `[INFO] Cargando proyecto: ${path}`] }));
      const result = await api.project.load(path);
      if (!result.success) {
        ok = false;
        set((s) => ({ exportLog: [...s.exportLog, `[ERROR] ${result.reason ?? 'No se pudo leer el proyecto'}`] }));
        return false;
      }
      // Un proyecto recién creado puede no tener estado todavía (o haberse
      // borrado): se abre vacío, no es un error.
      if (!result.state) {
        ok = true;
        set((s) => ({
          exportLog: [...s.exportLog, '[INFO] El proyecto todavía no tiene escenas guardadas'],
        }));
        return true;
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
        instrumentPresets: mergeInstrumentPresets(result.state.instrumentPresets),
        sounds: result.state.sounds ?? [],
        fxAssets: result.state.fxAssets ?? [],
        fonts: (result.state.fonts ?? []).map((f: any) => ({
          id: f.id ?? '',
          name: f.name ?? 'Fuente',
          imagePath: f.imagePath ?? '',
          cols: f.cols ?? 16,
          rows: f.rows ?? 6,
          firstChar: f.firstChar ?? 32,
          charMap: (f.charMap && typeof f.charMap === 'object') ? f.charMap : {},
          unassigned: Array.isArray(f.unassigned) ? f.unassigned : [],
        })),
        dialogues: (result.state.dialogues ?? []).map((d: any) => {
          const langs = Array.isArray(d.languages) && d.languages.length ? d.languages : ['ES'];
          const rows = Array.isArray(d.rows) && d.rows.length
            ? d.rows.map((r: any) => ({
                id: r.id ?? '',
                code: r.code ?? '',
                speaker: r.speaker ?? '',
                text: (r.text && typeof r.text === 'object') ? r.text : { ES: r.text ?? '' },
                choices: r.choices ?? [],
                soundId: r.soundId,
                fontId: r.fontId,
              }))
            : (d.pages ?? []).map((p: any, i: number) => ({
                id: p.id ?? `${d.name || 'dialogo'}-${String(i + 1).padStart(3, '0')}-`,
                code: '',
                speaker: '',
                text: { ES: p.text ?? '' },
                choices: p.choices ?? [],
              }));
          const fixed = rows.map((r: any) => {
            const t = { ...r.text };
            langs.forEach((l: string) => { if (t[l] === undefined) t[l] = ''; });
            return { ...r, text: t };
          });
          return { id: d.id ?? '', name: d.name ?? 'Nuevo diálogo', sceneId: d.sceneId ?? '', languages: langs, rows: fixed };
        }),
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
      ok = true;
      return true;
    } catch (err: any) {
      ok = false;
      set((s) => ({ exportLog: [...s.exportLog, `[ERROR] ${String(err)}`] }));
      return false;
    } finally {
      ultimaCargaOk = ok;
      // En un `set` aparte del de los datos a propósito: el vigilante de
      // "cambios sin guardar" usa este flag para resincronizar su línea base
      // cuando pasa a false (si shareset, vería el salto vacío→datos como un
      // cambio del usuario y marcaría el proyecto como modificado al abrirlo).
      set({ projectLoading: false });
      // Se suelta a quien estuviera esperando para guardar (ver saveProject).
      const esperando = esperaCarga;
      esperaCarga = [];
      esperando.forEach((fn) => fn());
    }
  },
  exportGBA: async () => {
    // Igual que al guardar: con el proyecto a medio cargar se compilaría un
    // main.c de un proyecto vacío.
    if (!(await esperarFinDeCarga())) {
      get().beginExportRun();
      get().addExportLog('[ERROR] El proyecto no se pudo cargar — no se exporta (habría compilado el estado vacío)');
      return false;
    }
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
    // Igual que al guardar y al exportar: no se lanza el emulador con el
    // proyecto a medio cargar.
    if (!(await esperarFinDeCarga())) {
      get().beginExportRun();
      get().addExportLog('[ERROR] El proyecto no se pudo cargar — no se ejecuta');
      return false;
    }
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

      // El remapeo de botones elegido en Ajustes → Play viaja en la URL.
      const keymapParam = encodeURIComponent(JSON.stringify(get().emulatorKeyMap));
      const themeParam = encodeURIComponent(JSON.stringify({ bg: get().themeBgPanel, accent: get().themeAccent, flat: get().flatColors }));

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
      const emuResult = await api.emu.play(romPath, keymapParam, themeParam);
      if (!emuResult.success) {
        set((s) => ({ exportLog: [...s.exportLog, `[ERROR] Emulador: ${emuResult.reason}`] }));
        return false;
      }

      // La ventana del emulador tiene su propia pestaña Registro: se le manda el
      // log que ya hay (la compilación entera) y a partir de ahí sigue en vivo.
      try { await api.emu.sendLog?.(get().exportLog); } catch { /* best-effort */ }
      set({ emulatorRunning: true });
      return true;
    } catch (err: any) {
      set((s) => ({ exportLog: [...s.exportLog, `[ERROR] ${String(err)}`] }));
      return false;
    }
  },
  stopEmulator: async () => {
    try {
      await window.advanceAPI.emu.stop();
      set({ emulatorRunning: false });
      return true;
    } catch {
      set({ emulatorRunning: false });
      return false;
    }
  },

  // ── Mundo ──────────────────────────────────────────────────────────────
  scenes: [defaultScene()],
  splashScreen: defaultSplashScreen(),
  addScene: (x?: number, y?: number) => {
    get()._snapshotMundo();
    const baseName = 'Escena';
    const names = get().scenes.map((sc) => sc.name);
    let num = 1;
    while (names.includes(`${baseName} ${num}`)) num++;
    const posX = x ?? (get().scenes.length * 30 + 60);
    const posY = y ?? 20;
    const scene = { ...defaultScene(), name: `${baseName} ${num}`, x: posX, y: posY };
    set((s) => ({ scenes: [...s.scenes, scene], selectedNodeId: scene.id }));
    return scene.id;
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
  instrumentPresets: defaultInstrumentPresets(),
  addSong: () => {
    get()._snapshotSongs();
    const song = defaultSong();
    set((s) => ({ songs: [...s.songs, song], selectedNodeId: song.id }));
    return song.id;
  },

  // Ajustes de un preset de instrumento (biblioteca compartida por canciones).
  // Sin snapshot de undo a propósito: cada tick de un knob dispararía uno.
  updateInstrumentPreset: (id, patch) => set((s) => ({
    instrumentPresets: s.instrumentPresets.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  })),

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
  fonts: [],
  addDialogue: () => {
    const base = 'Nuevo';
    const names = new Set(get().dialogues.map((d) => d.name));
    let name = base;
    let n = 2;
    while (names.has(name)) { name = `${base} ${n}`; n++; }
    const d = defaultDialogueEntry();
    d.name = name;
    // el ID de las filas usa el nombre del diálogo: regenerarlas con el nombre único
    d.rows = d.rows.map((r, i) => ({ ...r, id: `${name}-${String(i + 1).padStart(3, '0')}-` }));
    set((s) => ({ dialogues: [...s.dialogues, d] }));
    return d.id;
  },
  updateDialogue: (id, patch) => set((s) => ({
    dialogues: s.dialogues.map((d) => (d.id === id ? { ...d, ...patch } : d)),
  })),
  removeDialogue: (id) => set((s) => ({ dialogues: s.dialogues.filter((d) => d.id !== id) })),

  addFont: () => {
    const id = uid();
    set((s) => ({ fonts: [...s.fonts, { ...defaultFontTileset(), id, name: `Fuente ${s.fonts.length + 1}` }] }));
    return id;
  },
  updateFont: (id, patch) => set((s) => ({
    fonts: s.fonts.map((f) => (f.id === id ? { ...f, ...patch } : f)),
  })),
  removeFont: (id) => set((s) => ({ fonts: s.fonts.filter((f) => f.id !== id) })),
  addRow: (dialogueId) => set((s) => ({
    dialogues: s.dialogues.map((d) => {
      if (d.id !== dialogueId) return d;
      const row = defaultDialogueRow(d.name, d.rows.length);
      return { ...d, rows: [...d.rows, row] };
    }),
  })),
  updateRow: (dialogueId, rowId, patch) => set((s) => ({
    dialogues: s.dialogues.map((d) =>
      d.id !== dialogueId ? d : {
        ...d,
        rows: d.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)),
      }
    ),
  })),
  removeRow: (dialogueId, rowId) => set((s) => ({
    dialogues: s.dialogues.map((d) =>
      d.id !== dialogueId ? d : {
        ...d,
        rows: d.rows.filter((r) => r.id !== rowId),
      }
    ),
  })),
  addLanguage: (dialogueId, lang) => set((s) => ({
    dialogues: s.dialogues.map((d) => {
      if (d.id !== dialogueId) return d;
      const code = (lang || '').trim().toUpperCase();
      if (!code || d.languages.includes(code) || d.languages.length >= 6) return d;
      return {
        ...d,
        languages: [...d.languages, code],
        rows: d.rows.map((r) => ({ ...r, text: { ...r.text, [code]: '' } })),
      };
    }),
  })),
  removeLanguage: (dialogueId, lang) => set((s) => ({
    dialogues: s.dialogues.map((d) => {
      if (d.id !== dialogueId) return d;
      if (d.languages.length <= 1) return d;
      const langs = d.languages.filter((l) => l !== lang);
      const rows = d.rows.map((r) => {
        const t = { ...r.text };
        delete t[lang];
        return { ...r, text: t };
      });
      return { ...d, languages: langs, rows };
    }),
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
    fontLabelBgColor: state.fontLabelBgColor,
    fontCanvasBgColor: state.fontCanvasBgColor,
    fontCharOrderMode: state.fontCharOrderMode,
    fontCharOrderCustom: state.fontCharOrderCustom,
    flatColors: state.flatColors, codeFontSize: state.codeFontSize,
    emulatorKeyMap: state.emulatorKeyMap,
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
      useAppStore.setState((s) => ({ exportLog: [...s.exportLog, linea] }));
    });

    // El estado de la ventana, para que el botón PLAY/STOP refleje también cuando
    // el usuario la cierra con la X o con Esc (no pasa por stopEmulator).
    window.advanceAPI?.emu?.onEmulatorState(({ state }) => {
      useAppStore.setState({ emulatorRunning: state !== 'closed' });
    });
  } catch {
    // Sin preload de emulador (p.ej. la vista web de Vite): no pasa nada.
  }
}

export const selectProjects = (state: AppState) => state.projects;
