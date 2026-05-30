// ── Editor data types for Advance Studio ───────────────────────────────────

export type EditorTab = 'mundo' | 'scripting' | 'sprite' | 'imagen' | 'music' | 'sound' | 'dialogo';

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
  backgroundColor: string;
  backgroundImage?: string;
  type: 'platformer' | 'topdown' | 'rpg' | 'fighting';
  actors: Actor[];
  backgroundSong?: string;
}

// ── Sprite ────────────────────────────────────────────────────────────────
export interface AnimationFrame {
  tileIndex: number;
  duration: number;
}

export interface Animation {
  id: string;
  name: string;
  frames: AnimationFrame[];
  loop: boolean;
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
}

// ── Imagen (Background) ──────────────────────────────────────────────────
export interface BackgroundLayer {
  id: string;
  imagePath: string;
  fillColor?: string;
  parallaxX: number;
  parallaxY: number;
  speed: number;
  visible: boolean;
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
