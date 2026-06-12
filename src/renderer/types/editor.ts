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
  type: 'character' | 'collision' | 'trigger' | 'prop';
  x: number;
  y: number;
  width: number;
  height: number;
  spriteId: string;
  properties: Record<string, string>;
}

export interface SceneConnection {
  id: string;
  fromSceneId: string;
  toSceneId: string;
  label: string;
}

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
  duration: number; // 1-5 seconds for static images / max seconds for video
  videoPath?: string;
  videoFps?: number; // frames per second for video export (default 15)
  nextSceneId?: string; // scene to transition to after splash
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
