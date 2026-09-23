// ── Editor data types for Advance Studio ───────────────────────────────────

export type EditorTab = 'mundo' | 'scripting' | 'sprite' | 'imagen' | 'music' | 'sound' | 'dialogo';

// ── Collision ────────────────────────────────────────────────────────────
export const COLLISION_EMPTY = 0;
export const COLLISION_SOLID = 1;
export const COLLISION_ONE_WAY_UP = 2;
export const COLLISION_ONE_WAY_DOWN = 3;
export const COLLISION_ONE_WAY_LEFT = 4;
export const COLLISION_ONE_WAY_RIGHT = 5;
export const COLLISION_LADDER = 6;
export const COLLISION_SLOPE = 7;
export const COLLISION_SLOPE_INV = 8;
export const COLLISION_SLOPE_26 = 9;
export const COLLISION_SLOPE_MIRROR = 10;
export const COLLISION_SLOPE_INV_MIRROR = 11;

export type CollisionBrush = 'block' | 'bucket' | 'wand' | 'draw' | 'rectangle';

export const COLLISION_PALETTE: { value: number; label: string; color: string }[] = [
  { value: COLLISION_SOLID, label: 'Sólido', color: '#ff4444' },
  { value: COLLISION_ONE_WAY_UP, label: 'One-way ↑', color: '#ffdd44' },
  { value: COLLISION_ONE_WAY_DOWN, label: 'One-way ↓', color: '#ff8844' },
  { value: COLLISION_ONE_WAY_LEFT, label: 'One-way ←', color: '#4488ff' },
  { value: COLLISION_ONE_WAY_RIGHT, label: 'One-way →', color: '#44ddff' },
  { value: COLLISION_LADDER, label: 'Escalera', color: '#44cc44' },
  { value: COLLISION_SLOPE, label: 'Rampa', color: '#ff66bb' },
  { value: COLLISION_SLOPE_INV, label: 'Rampa inversa', color: '#bb66ff' },
  { value: COLLISION_SLOPE_26, label: 'Rampa 26°', color: '#ff9966' },
  { value: COLLISION_SLOPE_MIRROR, label: 'Rampa espejo', color: '#66ffbb' },
  { value: COLLISION_SLOPE_INV_MIRROR, label: 'Rampa inv espejo', color: '#ffbb66' },
];

export function createCollisionMap(sceneWidth: number, sceneHeight: number, tileSize: number): number[][] {
  const cols = Math.ceil(sceneWidth / tileSize);
  const rows = Math.ceil(sceneHeight / tileSize);
  return Array.from({ length: rows }, () => Array(cols).fill(COLLISION_EMPTY));
}

// ── Mundo (Scene/World) ──────────────────────────────────────────────────
export interface Actor {
  id: string;
  name: string;
  type: 'estatico' | 'interactuable' | 'objeto';
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  spriteId: string;
  animId: string;
  collider: boolean;
  colliderWidth: number;
  colliderHeight: number;
  soundId?: string;
  musicId?: string;
  scriptId?: string;
  dialogueId?: string;
  properties: Record<string, string>;
}

export type TransitionType = 'fade' | 'instant' | 'custom';
export type TransitionDirection = 'left' | 'right' | 'up' | 'down';
export type FxAssetType = 'gradient' | 'tileset';
export type TilesetAnimDirection = 'forward' | 'reverse';

export interface FxAsset {
  id: string;
  name: string;
  type: FxAssetType;
  filePath: string;
  hFilePath?: string; // auto-generated .h file for binary mask data
  // tileset config
  cols: number;
  rows: number;
  animSpeed: number;
  animDirection: TilesetAnimDirection;
  // gradient config
  startColor: string;
  endColor: string;
}

export interface TransitionConfig {
  type: TransitionType;
  duration: number; // total transition time in seconds (0.1-60)
  gradientId: string; // FxAsset id of type 'gradient' (solo custom)
  tilesetId: string; // FxAsset id of type 'tileset' (solo custom)
  tileSize: number; // 8, 10, or 16 (solo custom)
  animSpeed: number; // segundos (solo custom, legacy compat)
}

const defaultTransition = (): TransitionConfig => ({
  type: 'fade',
  duration: 0.5,
  gradientId: '',
  tilesetId: '',
  tileSize: 8,
  animSpeed: 5,
});

const defaultFxAsset = (): FxAsset => ({
  id: '',
  name: '',
  type: 'gradient',
  filePath: '',
  cols: 1,
  rows: 1,
  animSpeed: 5,
  animDirection: 'forward',
  startColor: '#000000',
  endColor: '#ffffff',
});

export interface SceneConnection {
  id: string;
  fromSceneId: string;
  toSceneId: string;
  label: string;
  usePauseScreen: boolean;
  pauseColor: string;
  entryTransition: TransitionConfig;
  exitTransition: TransitionConfig;
}

export const makeDefaultConnection = (fromSceneId: string, toSceneId: string): SceneConnection => ({
  id: '',
  fromSceneId,
  toSceneId,
  label: '',
  usePauseScreen: false,
  pauseColor: '#000000',
  entryTransition: defaultTransition(),
  exitTransition: defaultTransition(),
});

export interface Scene {
  id: string;
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
  cameraX: number;
  cameraY: number;
  backgroundColor: string;
  backgroundImage?: string;
  type: 'platformer' | 'topdown' | 'rpg' | 'fighting';
  actors: Actor[];
  backgroundSong?: string;
  backgroundSoundId?: string;
  collisionTileSize: number;
  collisionMap: number[][];
}

// ── SplashScreen ─────────────────────────────────────────────────────────
export interface SplashScreen {
  id: string;
  name: string;
  x: number;
  y: number;
  backgroundImage?: string;
  backgroundSong?: string;
  backgroundSoundId?: string;
  duration: number; // 1-5 seconds for static images / max seconds for video
  videoPath?: string;
  videoFps?: number; // frames per second for video export (default 15)
  nextSceneId?: string; // scene to transition to after splash
  usePauseScreen: boolean;
  pauseColor: string;
  entryTransition: TransitionConfig;
  exitTransition: TransitionConfig;
}

// ── Sprite ────────────────────────────────────────────────────────────────
export interface AnimationFrame {
  tileIndex: number;
  duration: number;
}

export type AnimationMode = 'once' | 'loop' | 'pingpong';

export interface Animation {
  id: string;
  name: string;
  frames: AnimationFrame[];
  mode: AnimationMode;
  speed: number; // 0.25–4, default 1
}

export interface SpriteSheet {
  id: string;
  name: string;
  tilesetPath: string;
  tileWidth: number;
  tileHeight: number;
  cols: number;
  rows: number;
  animations: Animation[];
  skippedFrames: number[];
}

// ── Imagen (Background) ──────────────────────────────────────────────────
export type AnimationLoop = 'loop' | 'once' | 'pingpong' | 'random';

export interface BackgroundLayer {
  id: string;
  imagePath: string;
  fillColor?: string;
  parallaxX: number;
  parallaxY: number;
  speed: number;
  visible: boolean;
  rescale?: boolean;
  animated?: boolean;
  animationSpeed?: number;
  animationLoop?: AnimationLoop;
  animationFramesX?: number;
  animationFramesY?: number;
}

export interface Background {
  id: string;
  name: string;
  layers: BackgroundLayer[];
}

// ── Music/Sound ──────────────────────────────────────────────────────────
export type InstrumentType = 'duty' | 'wave' | 'noise';

export interface SoundEffect {
  id: string;
  name: string;
  usage: 'sfx' | 'music';
  type: 'duty' | 'wave' | 'noise';
  duration: number;
  volume: number; // 0-15 GBA / 0-100 master
  dutyCycleValue: number;
  change: number;
  sweepShift: number;
  sweepTime: number;
  lengthEnabled: boolean;
  length: number;
  waveData: number[];
  freq: number;
  filePath?: string;
  // Playback controls
  masterVolume: number; // 0-100
  pitch: number; // semitones -12..+12
  speed: number; // 0.25..4
  delay: number; // seconds 0..2
  attack: number; // seconds 0..1
  release: number; // seconds 0..2
}

export const defaultSoundEffect = (): SoundEffect => ({
  id: '',
  name: 'Nuevo sonido',
  usage: 'sfx',
  type: 'duty',
  duration: 0.5,
  volume: 12,
  dutyCycleValue: 50,
  change: 0,
  sweepShift: 0,
  sweepTime: 0,
  lengthEnabled: false,
  length: 0,
  waveData: Array.from({ length: 32 }, (_, i) =>
    Math.round((Math.sin(i / 32 * Math.PI * 2) + 1) / 2 * 15)
  ),
  freq: 440,
  masterVolume: 80,
  pitch: 0,
  speed: 1,
  delay: 0,
  attack: 0,
  release: 0.05,
});

export interface ADSREnvelope {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface Instrument {
  id: string;
  name: string;
  type: InstrumentType;
  dutyCycle: number;
  waveData: number[];
  envelope: ADSREnvelope;
  visible: boolean;
  muted: boolean;
  solo: boolean;
}

export interface NoteRow {
  note: string;
  octave: number;
  instrumentId: string;
  effect: string;
}

export interface Pattern {
  id: string;
  name: string;
  rows: Record<string, NoteRow>[]; // step -> { channelId: NoteRow }
}

export interface Song {
  id: string;
  name: string;
  artist: string;
  bpm: number;
  instruments: Instrument[];
  patterns: Pattern[];
}

// ── Dialogo ──────────────────────────────────────────────────────────────
export interface DialogueChoice {
  text: string;
  nextPageId: string;
}

export interface DialoguePage {
  id: string;
  text: string;
  choices: DialogueChoice[];
}

export interface DialogueEntry {
  id: string;
  name: string;
  sceneId: string;
  pages: DialoguePage[];
}
