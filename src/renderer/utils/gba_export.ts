import type { EditorState } from './project_persistence';
import type { Song } from '../types/editor';
import { scriptEffectiveCCode, type ACodTranspileResult } from './advanceCode';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Length del blip por defecto (78 ms), igual que el secuenciador del editor.
const SONG_LEN_PULSE_DEFAULT = 44;  // (64-44)/64 s
const SONG_LEN_WAVE_DEFAULT = 236;  // (256-236)/256 s

/** Misma fórmula que gba_audio.ts: frecuencia de la nota (nota vacía → A4). */
function noteToFreq(note: string, octave: number): number {
  const i = NOTE_NAMES.indexOf(note);
  if (i < 0) return 440;
  const midi = i + (octave + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** "C4" → frecuencia. */
function noteNameToFreq(name: string): number {
  const m = /^([A-G]#?)(-?\d+)$/.exec((name || 'C4').toUpperCase());
  if (!m) return 440;
  return noteToFreq(m[1], parseInt(m[2]));
}

/** Los 8 u16 de Wave RAM con la senoide de 32 dígitos del editor (0-15). */
function sineWaveWords(): string {
  const nibbles: number[] = [];
  for (let i = 0; i < 32; i++) nibbles.push(Math.round((Math.sin((i / 32) * Math.PI * 2) + 1) / 2 * 15));
  const words: string[] = [];
  for (let w = 0; w < 8; w++) {
    const n0 = nibbles[w * 4], n1 = nibbles[w * 4 + 1], n2 = nibbles[w * 4 + 2], n3 = nibbles[w * 4 + 3];
    words.push(`0x${((n0 << 12) | (n1 << 8) | (n2 << 4) | n3).toString(16).padStart(4, '0')}`);
  }
  return words.join(', ');
}

function dutyToGBA(dutyVal: number): number {
  // dutyVal from Instrument type is 0-1 (fraction), but might also be 0-100
  const pct = dutyVal > 1 ? dutyVal : dutyVal * 100;
  if (pct <= 12.5) return 0;
  if (pct <= 25) return 1;
  if (pct <= 50) return 2;
  return 3;
}

function generateSoundTypes(): string {
  return `
// ── GBA Sound Registers & Types ─────────────────────────────────────────
#define REG_SND1SWEEP *(vu16*)(0x04000060)
#define REG_SND1CNT   *(vu16*)(0x04000062)
#define REG_SND1FREQ  *(vu16*)(0x04000064)
#define REG_SND2CNT   *(vu16*)(0x04000068)
#define REG_SND2FREQ  *(vu16*)(0x0400006C)
#define REG_SND3CNT_L *(vu16*)(0x04000070)
#define REG_SND3CNT_H *(vu16*)(0x04000072)
#define REG_SND3FREQ  *(vu16*)(0x04000074)
#define REG_SND4CNT   *(vu16*)(0x04000078)
#define REG_SND4FREQ  *(vu16*)(0x0400007C)
#define REG_SNDCTL    *(vu16*)(0x04000080)
#define REG_SNDBIAS   *(vu16*)(0x04000088)
#define REG_SNDCNTH   *(vu16*)(0x04000082)
#define REG_SNDCNTX   *(vu16*)(0x04000084)

typedef struct {
  u8 volume;
  u8 duty;
  u8 envDir;
  u8 envSweep;
  u8 sweepShift;
  u8 sweepTime;
  u8 sweepDir;
  u8 lenP;   // length de pulse/noise (0-63): (64-n)/64 s
  u8 lenW;   // length del canal wave (0-255): (256-n)/256 s
} GBAInst;

typedef struct {
  u16 period;    // valor directo del registro FREQ (pulse/wave) o bits ratio|cs<<3 (noise); 0xFFFF=rest
  u8 instIdx;
} GBANote;

typedef struct {
  GBANote ch[4];  // [pulse1, pulse2, wave, noise]
  u16 pcmSample;  // índice de muestra (0xFFFF = sin nota PCM)
  u16 pcmTimer;   // reload del timer 1 para la altura de la nota
  u16 pcmFrames;  // vsyncs que suena (0 = bucle)
} GBAStep;

// Volumen del canal wave (bits 13-14 de SND3CNT_H): 0=mute, 1=100%, 2=50%, 3=25%.
// Misma escala que el editor: índice = round(vol/5) clamp 0-3.
static u16 waveVolCode(u8 vol) {
  int idx = ((vol * 2) + 5) / 10;   /* round(vol/5) */
  if (idx < 0) idx = 0;
  if (idx > 3) idx = 3;
  return (u16)idx;
}

// Wave RAM: misma senoide de 32 dígitos que usa el editor (gba_audio.ts).
// Cada u16 = 4 dígitos de 4 bits, el dígito alto primero (n0<<12|n1<<8|n2<<4|n3).
static void initWaveRAM(void) {
  vu16* wave = (vu16*)0x04000090;
  const u16 waveData[8] = {${sineWaveWords()}};
  int i;
  for (i = 0; i < 8; i++) wave[i] = waveData[i];
}

static void initSound(void) {
  REG_SND1SWEEP = 0;
  REG_SND1CNT = 0;
  REG_SND1FREQ = 0;
  REG_SND2CNT = 0;
  REG_SND2FREQ = 0;
  REG_SND3CNT_L = 0;
  REG_SND3CNT_H = 0;
  REG_SND3FREQ = 0;
  REG_SND4CNT = 0;
  REG_SND4FREQ = 0;
  REG_SNDBIAS = 0x200;
  REG_SNDCNTX = 0x0080;
  REG_SNDCNTH = 0x0002;
  REG_SNDCTL = 0xFF77;
  REG_SND3CNT_L = 0x0080;   // canal 3: playback ON, un banco de 32 dígitos
  initWaveRAM();
}

// Enciende una nota. "period" es el valor del registro de frecuencia ya
// calculado (pulse: 2048-131072/f; wave: 2048-65536/f; noise: ratio|cs<<3).
// El contador de length corta la nota sola, igual que los blips de 80 ms del
// editor (pulse/noise: (64-n)/256s; wave: (256-n)/256s).
static void noteOn(int ch, const GBAInst* inst, u16 period) {
  u16 dutyVal = (inst->duty & 3) << 6;                                                  // bits 6-7
  u16 envVal = ((inst->volume & 0xF) << 12) | ((inst->envDir & 1) << 11) | ((inst->envSweep & 7) << 8);
  u16 freqVal = 0xC000 | (period & 0x07FF);   // restart + length flag
  switch (ch) {
  case 0: {
    u16 sweepVal = (inst->sweepShift & 7) | ((inst->sweepDir & 1) << 3) | ((inst->sweepTime & 7) << 4);
    REG_SND1SWEEP = sweepVal;
    REG_SND1CNT = dutyVal | envVal | inst->lenP;
    REG_SND1FREQ = freqVal;
    break;
  }
  case 1:
    REG_SND2CNT = dutyVal | envVal | inst->lenP;
    REG_SND2FREQ = freqVal;
    break;
  case 2:
    // Volumen del canal wave en bits 13-14 (0=mute, 1=100%, 2=50%, 3=25%),
    // misma escala que el editor: índice = round(vol/5) clamp 0-3
    REG_SND3CNT_L = 0x0080;
    REG_SND3CNT_H = (u16)(inst->lenW | (waveVolCode(inst->volume) << 13));
    REG_SND3FREQ = freqVal;
    break;
  case 3:
    REG_SND4CNT = envVal | inst->lenP;
    REG_SND4FREQ = freqVal;   // bits 0-2 = ratio, bit 3 = width 7-bit, shift s=0
    break;
  }
}
`;
}

/** Decodifica base64 a bytes con signo (PCM 8-bit de la GBA). */
function base64ToS8(b64: string): number[] {
  const bin = atob(b64);
  const out: number[] = new Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    const b = bin.charCodeAt(i);
    out[i] = b < 128 ? b : b - 256;
  }
  return out;
}

export interface PcmSoundMeta { id: string; index: number; name: string; bytes: number; rate: number; loop: boolean; }

/**
 * Sonidos PCM (importados y ya convertidos a 8-bit mono): datos en ROM +
 * runtime de reproducción por DMA (direct sound). La GBA no decodifica MP3/OGG:
 * reproduce PCM de 8 bits con signo alimentando el FIFO_A con el DMA1, a la
 * velocidad que marca el timer 0. `sound_play(idx)` se puede llamar desde un
 * script de C Directo (p.ej. al recoger una moneda).
 */
export function generatePcmSoundData(sounds: any[]): { code: string; meta: PcmSoundMeta[] } {
  const pcm = (sounds ?? []).filter((s) => s && typeof s.pcmBase64 === 'string' && s.pcmBase64 && (s.pcmBytes ?? 0) > 0);
  const meta: PcmSoundMeta[] = pcm.map((s, i) => ({
    id: s.id, index: i, name: s.name ?? `sonido ${i}`,
    bytes: (s.pcmBytes ?? 0), rate: s.pcmRate || 11025, loop: !!s.loop,
  }));

  if (pcm.length === 0) {
    return {
      meta,
      code: `
// ── Sonido PCM por DMA: sin sonidos importados ─────────────────────────
#define SOUND_COUNT 0
static void soundPlay(int idx, int loop) { (void)idx; (void)loop; }
static void soundStop(void) {}
static void soundTick(void) {}
static void pcmVoicePlay(int sampleIdx, u16 timerReload, u16 frames) { (void)sampleIdx; (void)timerReload; (void)frames; }
static void pcmVoiceStop(void) {}
`,
    };
  }

  // Los datos primero: en C la tabla de punteros necesita los arrays declarados.
  let dataCode = '';
  for (let i = 0; i < pcm.length; i++) {
    const bytes = base64ToS8(pcm[i].pcmBase64);
    while (bytes.length % 4 !== 0) bytes.push(0);
    dataCode += `// ${meta[i].name} — ${meta[i].rate} Hz, ${bytes.length} bytes\n`;
    dataCode += `static const s8 snd_${i}[${bytes.length}] = {\n`;
    const lines: string[] = [];
    for (let j = 0; j < bytes.length; j += 24) {
      lines.push('  ' + bytes.slice(j, j + 24).join(', '));
    }
    dataCode += lines.join(',\n') + '\n};\n\n';
  }

  let code = dataCode + `
// ── Sonido PCM por DMA (direct sound) ──────────────────────────────────
#define AE_TM0CNT_L  *(vu16*)(0x04000100)
#define AE_TM0CNT_H  *(vu16*)(0x04000102)
#define AE_DMA1SAD   *(vu32*)(0x040000BC)
#define AE_DMA1DAD   *(vu32*)(0x040000C0)
#define AE_DMA1CNT_H *(vu16*)(0x040000C6)
#define AE_FIFO_A    *(vu32*)(0x040000A0)
#define AE_TM1CNT_L  *(vu16*)(0x04000104)
#define AE_TM1CNT_H  *(vu16*)(0x04000106)
#define AE_DMA2SAD   *(vu32*)(0x040000C8)
#define AE_DMA2DAD   *(vu32*)(0x040000CC)
#define AE_DMA2CNT_H *(vu16*)(0x040000CE)
#define AE_FIFO_B    *(vu32*)(0x040000A4)
#define SOUND_COUNT ${pcm.length}

static const s8* const gSndData[SOUND_COUNT] = { ${pcm.map((_, i) => `snd_${i}`).join(', ')} };
static const u32 gSndBytes[SOUND_COUNT] = { ${pcm.map((s) => (s.pcmBytes + 3) & ~3).join(', ')} };
static const u16 gSndRate[SOUND_COUNT] = { ${pcm.map((s) => s.pcmRate || 11025).join(', ')} };

static int gSoundFrames;   // vsyncs que le quedan al sonido (0 = parado)
static int gPcmFrames;     // vsyncs de la voz PCM del secuenciador

// Voz PCM del secuenciador (canal B: timer 1 + DMA2 -> FIFO_B). Se usa para
// instrumentos muestreados a distintas alturas, en paralelo a los 4 canales PSG.
static void pcmVoiceStop(void) { AE_DMA2CNT_H = 0; gPcmFrames = 0; }

static void pcmVoicePlay(int sampleIdx, u16 timerReload, u16 frames) {
  if (sampleIdx < 0 || sampleIdx >= SOUND_COUNT) return;
  pcmVoiceStop();
  AE_TM1CNT_H = 0;
  AE_TM1CNT_L = timerReload;
  AE_TM1CNT_H = 0x0080;                    // prescaler 1, timer 1 encendido
  AE_DMA2SAD = (u32)gSndData[sampleIdx];
  AE_DMA2DAD = (u32)&AE_FIFO_B;
  AE_DMA2CNT_H = 0xB640;                   // 32-bit, destino fijo, repeat, especial
  REG_SNDCNTH |= 0x7008;                   // DMA B 100% a L y R, timer 1
  gPcmFrames = frames ? frames : 0x7FFFFFFF;
}

static void soundStop(void) {
  AE_DMA1CNT_H = 0;
  REG_SNDCNTH = 0x0002;    // PSG 100%, DMA A apagado
  gSoundFrames = 0;
}

static void soundPlay(int idx, int loop) {
  if (idx < 0 || idx >= SOUND_COUNT) return;
  soundStop();
  REG_SNDCNTX = 0x0080;    // master de sonido encendido (aunque no haya PSG)
  REG_SNDBIAS = 0x200;
  AE_TM0CNT_H = 0;
  AE_TM0CNT_L = (u16)(65536 - (16777216 / gSndRate[idx]));
  AE_TM0CNT_H = 0x0080;                    // prescaler 1, timer encendido
  AE_DMA1SAD = (u32)gSndData[idx];
  AE_DMA1DAD = (u32)&AE_FIFO_A;
  AE_DMA1CNT_H = 0xB640;                   // 32-bit, destino fijo, repeat, timing especial
  // SOUNDCNT_H (GBATEK): bits 0-1 vol PSG, bit 2 vol DMA A, bit 8 A-derecha,
  // bit 9 A-izquierda, bit 10 timer A (0 = timer 0), bit 11 reset FIFO A (0).
  REG_SNDCNTH = 0x0306;                     // PSG 100%, DMA A 100% a L y R, timer 0
  gSoundFrames = loop ? 0x7FFFFFFF : ((gSndBytes[idx] * 60) / gSndRate[idx] + 2);
}

static void soundTick(void) {
  if (gSoundFrames > 0 && --gSoundFrames == 0) soundStop();
  if (gPcmFrames > 0 && --gPcmFrames == 0) pcmVoiceStop();
}

`;
  return { code, meta };
}

function generateSongData(song: Song, suffix: string = '', pcmMeta: PcmSoundMeta[] = []): string {
  const allSteps = song.patterns.flatMap((p) => p.rows);
  const stepCount = allSteps.length;
  const insts = song.instruments;

  let code = `
// ── Song: ${song.name} ──────────────────────────────────────────────────
#define SONG_BPM${suffix} ${song.bpm}
#define SONG_STEPS${suffix} ${stepCount}

const GBAInst gInstruments${suffix}[${insts.length}] = {`;
  for (const inst of insts) {
    const env = inst.envelope || { attack: 0, decay: 0, sustain: 1, release: 0 };
    const initialVol = Math.round(Math.max(1, Math.min(15, env.sustain * 15)));
    const envDir = env.attack > env.decay ? 1 : 0;
    const envSweep = Math.min(7, Math.max(0, Math.round(Math.max(env.attack, env.decay) * 7)));
    const sweepShift = Math.min(7, Math.max(0, inst.sweepShift ?? 0));
    const sweepTime = Math.min(7, Math.max(0, inst.sweepTime ?? 0));
    // Length: si el preset la define (lengthEnabled) se usa (en frames de 60 Hz
    // → 0.266s para 16, 0.53s para 32, 1s para 64). Si no, el blip de 78ms que
    // usa el secuenciador del editor.
    let lenP = SONG_LEN_PULSE_DEFAULT;
    let lenW = SONG_LEN_WAVE_DEFAULT;
    if (inst.lengthEnabled && inst.length) {
      lenP = Math.max(0, Math.min(63, 64 - Math.round((inst.length / 60) * 64)));
      lenW = Math.max(0, Math.min(255, 256 - Math.round((inst.length / 60) * 256)));
    }
    code += `
  {${initialVol}, ${dutyToGBA(inst.dutyCycle)}, ${envDir}, ${envSweep}, ${sweepShift}, ${sweepTime}, 0, ${lenP}, ${lenW}},`;
  }
  code += `
};

const GBAStep gSongData${suffix}[SONG_STEPS${suffix}] = {`;
  for (let s = 0; s < stepCount; s++) {
    const row = allSteps[s];
    const channels = ['ch-pulse1', 'ch-pulse2', 'ch-wave', 'ch-noise'];
    const parts: string[] = [];
    for (let c = 0; c < channels.length; c++) {
      const nr = row[channels[c]];
      if (nr && nr.note && nr.instrumentId) {
        const freq = noteToFreq(nr.note, nr.octave);
        const rawI = insts.findIndex((i) => i.id === nr.instrumentId);
        const iIdx = rawI >= 0 ? rawI : 0;
        let period: number;
        if (c === 2) {
          // El canal wave reproduce los 32 dígitos del buffer por ciclo:
          // rate del registro = freq*32 → period = 2048 - 65536/freq
          period = Math.round(2048 - 65536 / freq);
        } else if (c === 3) {
          // Noise: ratio (bits 0-2) + width 7-bit (bit 3), shift s=0.
          // Misma fórmula que gba_audio.ts para que suene igual que el editor.
          const inst = insts[iIdx];
          const instDutyPct = Math.round((inst?.dutyCycle ?? 0.5) * 100);
          const baseRatio = Math.max(0, Math.min(7, Math.round(instDutyPct / 12.5) - 1));
          const octaveShift = Math.max(0, Math.min(7, 7 - Math.floor(Math.log2(Math.max(1, freq) / 50))));
          const ratio = Math.max(0, Math.min(7, Math.round((baseRatio + octaveShift) / 2)));
          const cs = (inst?.sweepShift ?? 0) > 0 ? 1 : 0;
          period = ratio | (cs << 3);
        } else {
          // Pulse: rate = 131072/(2048-n) → period = 2048 - 131072/freq
          period = Math.round(2048 - 131072 / freq);
        }
        period = Math.max(0, Math.min(0x7FF, Math.round(period)));
        parts.push(`{${period}, ${iIdx}}`);
      } else {
        parts.push('{0xFFFF, 0}');
      }
    }
    // Voz PCM (instrumento muestreado) del step: muestra + timer por altura.
    let pcmSample = 0xFFFF, pcmTimer = 0, pcmFrames = 0;
    const pcmNote = row['ch-pcm'];
    if (pcmNote && pcmNote.note && pcmNote.instrumentId) {
      const inst = insts.find((i) => i.id === pcmNote.instrumentId);
      const meta = inst?.sampleId ? pcmMeta.find((m) => m.id === inst.sampleId) : undefined;
      if (meta) {
        const freq = noteToFreq(pcmNote.note, pcmNote.octave);
        const baseFreq = noteNameToFreq(inst?.baseNote ?? 'C4');
        const rate = meta.rate * Math.max(0.25, Math.min(4, freq / baseFreq));
        pcmTimer = Math.max(0, Math.min(65535, Math.round(65536 - 16777216 / rate)));
        pcmSample = meta.index;
        pcmFrames = meta.loop ? 0 : Math.min(65535, Math.ceil((meta.bytes / meta.rate) * 60));
      }
    }
    code += '\n  {{' + parts.join(', ') + '}, ' + pcmSample + ', ' + pcmTimer + ', ' + pcmFrames + '}';
    if (s < stepCount - 1) code += ',';
  }
  code += `
};

static void playStep${suffix}(int step) {
  if (step < 0 || step >= SONG_STEPS${suffix}) return;
  const GBAStep* s = &gSongData${suffix}[step];
  int c;
  for (c = 0; c < 4; c++) {
    if (s->ch[c].period != 0xFFFF) {
      if (s->ch[c].instIdx < ${insts.length}) {
        const GBAInst* inst = &gInstruments${suffix}[s->ch[c].instIdx];
        noteOn(c, inst, s->ch[c].period);
      }
    }
  }
  if (s->pcmSample != 0xFFFF) pcmVoicePlay(s->pcmSample, s->pcmTimer, s->pcmFrames);
}
`;

  return code;
}

export interface ExportManifest {
  name: string;
  author: string;
  scenes: number;
  sprites: number;
  songs: number;
  backgrounds: number;
}

export interface ExportLog {
  messages: string[];
  add(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

// El prefijo es lo que lee GlobalAlerts para sacar el aviso (`[ERROR] …`), así
// que aquí no se antepone nada: antes los errores de AdvanceCode se añadían con
// `add('[ERROR] …')` y salían como "[INFO] [ERROR] …", que no casa con el
// filtro y el script roto se omitía de la ROM sin que nadie se enterara.
export function createLog(): ExportLog {
  const messages: string[] = [];
  return {
    messages,
    add(msg: string) { messages.push(`[INFO] ${msg}`); },
    warn(msg: string) { messages.push(`[WARN] ${msg}`); },
    error(msg: string) { messages.push(`[ERROR] ${msg}`); },
  };
}

function generateTransitionData(
  framesCArray: string,
  tileSize: number,
  tilesetFrames: number,
  totalDurationSec: number, // total transition time in seconds (1-60)
  fw: number,
  fh: number,
  tag: string,
  gradientCArray: string | null,
  gradientW: number,
  gradientH: number,
): string {

  const tilesX = Math.ceil(240 / tileSize);
  const tilesY = Math.ceil(160 / tileSize);
  const arrName = `gTilesetPixel_${tag}`;
  const renamedArray = framesCArray.replace(/gTilesetPixel/g, arrName);
  const gW = gradientCArray ? gradientW : tilesX;
  const gH = gradientCArray ? gradientH : tilesY;
  const gData = gradientCArray || (() => {
    const rows: string[] = [];
    for (let y = 0; y < gH; y++) {
      const cols: string[] = [];
      for (let x = 0; x < gW; x++) cols.push('255');
      rows.push('    {' + cols.join(',') + '}');
    }
    return '{\n' + rows.join(',\n') + '\n  }';
  })();

  // Parse brightness values from gradient data to compute tile order
  function parseGradientValues(gradientCStr: string): number[] {
    const cleaned = gradientCStr.replace(/[{};\s\n\r]/g, '');
    const nums = cleaned.split(',').filter(Boolean).map(s => parseInt(s, 10));
    return nums.filter(n => !isNaN(n));
  }

  // Group tiles by exact brightness: same brightness → animate simultaneously
  const tileCount = gW * gH;
  const brightnessVals = parseGradientValues(gData);
  const groupsMap = new Map<number, number[]>();
  const effectiveVals = brightnessVals.length >= tileCount ? brightnessVals.slice(0, tileCount) : [];
  if (effectiveVals.length >= tileCount) {
    for (let i = 0; i < tileCount; i++) {
      const b = effectiveVals[i];
      if (!groupsMap.has(b)) groupsMap.set(b, []);
      groupsMap.get(b)!.push(i);
    }
  } else {
    const all: number[] = [];
    for (let i = 0; i < tileCount; i++) all.push(i);
    groupsMap.set(255, all);
  }

  // Sort groups by brightness descending (white first)
  const sortedBrightness = Array.from(groupsMap.keys()).sort((a, b) => b - a);
  const numGroups = sortedBrightness.length;

  // Build group offsets and flat tile order
  const groupOffsets: number[] = [0];
  const flatOrder: number[] = [];
  for (const b of sortedBrightness) {
    const indices = groupsMap.get(b)!;
    for (const idx of indices) flatOrder.push(idx);
    groupOffsets.push(flatOrder.length);
  }
  const groupOffsetsStr = '{' + groupOffsets.join(',') + '}';
  const flatOrderStr = '{' + flatOrder.join(',') + '}';

  // totalDurationSec = desired total transition time in seconds
  // Cada grupo reproduce TODOS los frames del tileset (uno por VSync) y
  // después fuerza el tile a su color final antes de pasar al grupo siguiente.
  // Si hay demasiados grupos para el presupuesto de VSyncs, se fusionan bins
  // de brillo consecutivos para que a cada grupo le toque al menos 1 VSync.
  const totalVSyncs = totalDurationSec * 60;
  const maxGroups = Math.max(1, Math.floor(totalVSyncs));
  const groupsArr: { brightness: number; indices: number[] }[] = [];

  if (numGroups > maxGroups && totalVSyncs > 0) {
    // Merge groups into maxGroups bins
    const binSize = Math.ceil(sortedBrightness.length / maxGroups);
    for (let b = 0; b < maxGroups; b++) {
      const start = b * binSize;
      const end = Math.min(start + binSize, sortedBrightness.length);
      const merged: number[] = [];
      for (let i = start; i < end; i++) {
        const bi = sortedBrightness[i];
        const indices = groupsMap.get(bi)!;
        merged.push(...indices);
      }
      groupsArr.push({ brightness: maxGroups - b, indices: merged });
    }
  } else {
    for (const b of sortedBrightness) {
      groupsArr.push({ brightness: b, indices: groupsMap.get(b)! });
    }
  }

  // Rebuild group offsets and flat tile order from (possibly merged) groups
  const finalGroupOffsets: number[] = [0];
  const finalFlatOrder: number[] = [];
  for (const grp of groupsArr) {
    for (const idx of grp.indices) finalFlatOrder.push(idx);
    finalGroupOffsets.push(finalFlatOrder.length);
  }
  const finalNumGroups = groupsArr.length;
  const finalGroupOffsetsStr = '{' + finalGroupOffsets.join(',') + '}';
  const finalFlatOrderStr = '{' + finalFlatOrder.join(',') + '}';

  // VSyncs que se conceden a cada grupo. La duración real es
  // finalNumGroups × frameDelay ≈ totalVSyncs, así que la que pide el inspector
  // se respeta. El bug anterior era otro: los tilesetFrames frames de cada grupo
  // se pintaban seguidos SIN esperar, de modo que solo se veía el último y la
  // animación píxel a píxel no existía. Ahora se dibuja un frame por VSync y el
  // índice de frame se avanza proporcionalmente a los VSyncs del grupo: si el
  // grupo tiene menos VSyncs que frames, se muestrean (se ven menos fotogramas,
  // pero la transición dura lo pedido en vez de alargarse × tilesetFrames).
  const frameDelay = Math.max(1, Math.round(totalVSyncs / Math.max(1, finalNumGroups)));
  const tilesetFramesC = Math.max(1, tilesetFrames);
  const forceTile = (color: string, txVar: string, tyVar: string) => `        int iy;
        for (iy = 0; iy < ${tileSize} && (${tyVar} * ${tileSize} + iy) < 160; iy++) {
          int ix;
          for (ix = 0; ix < ${tileSize} && (${txVar} * ${tileSize} + ix) < 240; ix++) {
            int px = ${txVar} * ${tileSize} + ix;
            int py = ${tyVar} * ${tileSize} + iy;
            screen[py * 240 + px] = ${color};
          }
        }`;
  const maskTile = (arr: string, cmp: string, val: string, txVar: string, tyVar: string, frameVar: string) => `        int iy;
        for (iy = 0; iy < ${tileSize} && (${tyVar} * ${tileSize} + iy) < 160; iy++) {
          int ix;
          for (ix = 0; ix < ${tileSize} && (${txVar} * ${tileSize} + ix) < 240; ix++) {
            int px = ${txVar} * ${tileSize} + ix;
            int py = ${tyVar} * ${tileSize} + iy;
            if (${arr}[${frameVar}][iy][ix] ${cmp})
              screen[py * 240 + px] = ${val};
          }
        }`;

  // ── Group-by-brightness sequential (both entry and exit) ──────
  const seqBlackCmp = '== 0';
  const seqBlackForce = '0';
  const seqSceneCmp = '!= 0';
  const seqSceneVal = 'scene[py * 240 + px]';
  const seqSceneForce = 'scene[py * 240 + px]';
  const exitTag = tag === 'Exit';

  const finalTileCount = Math.max(1, finalFlatOrder.length);
  const seqFn = (fnName: string, cmp: string, val: string, forceVal: string, clearBeforeFrame: boolean, reverseFrames: boolean, drawActors: boolean) => `
static void ${fnName}(const u16* scene, int totalFrames) {
  u16* screen = (u16*)VRAM;
  static const int gGroupOffsets_${tag}[${finalNumGroups + 1}] = ${finalGroupOffsetsStr};
  static const int gTileOrder_${tag}[${finalTileCount}] = ${finalFlatOrderStr};
  int g;
${drawActors ? '  initActors();\n  drawAllActors(screen, 0);\n' : ''}  for (g = 0; g < ${finalNumGroups}; g++) {
    int v;
    for (v = 0; v < ${frameDelay}; v++) {
      /* Un frame del tileset por VSync. El índice avanza proporcionalmente:
         con menos VSyncs que frames se muestrean, con más, algunos frames se
         repiten. Así la duración es la pedida y la animación se ve. */
      int f = (v * ${tilesetFramesC}) / ${frameDelay};
      int ti;
      for (ti = gGroupOffsets_${tag}[g]; ti < gGroupOffsets_${tag}[g + 1]; ti++) {
        int idx = gTileOrder_${tag}[ti];
        int tx2 = idx % ${gW};
        int ty2 = idx / ${gW};
${clearBeforeFrame ? `        {
          int iy;
          for (iy = 0; iy < ${tileSize} && (ty2 * ${tileSize} + iy) < 160; iy++) {
            int ix;
            for (ix = 0; ix < ${tileSize} && (tx2 * ${tileSize} + ix) < 240; ix++) {
              int px = tx2 * ${tileSize} + ix;
              int py = ty2 * ${tileSize} + iy;
              screen[py * 240 + px] = 0;
            }
          }
        }
` : ''}${maskTile(arrName, cmp, val, 'tx2', 'ty2', 'f')}
      }
      waitVSync();
    }
    {
      int ti;
      for (ti = gGroupOffsets_${tag}[g]; ti < gGroupOffsets_${tag}[g + 1]; ti++) {
        int idx = gTileOrder_${tag}[ti];
        int tx2 = idx % ${gW};
        int ty2 = idx / ${gW};
${forceTile(forceVal, 'tx2', 'ty2')}
      }
    }
${drawActors ? '    drawAllActors(screen, 0);\n' : ''}  }
}
`;

  const runToBlackCode = seqFn(`runToBlack_${tag}`, seqBlackCmp, '0', seqBlackForce, false, false, false);
  const runToSceneCode = seqFn(`runToScene_${tag}`, seqSceneCmp, seqSceneVal, seqSceneForce, exitTag, exitTag, false);

  return `
// ── Gradient (${tag}) ──────────────────────────────────────────────
#define GRADIENT_W_${tag} ${gW}
#define GRADIENT_H_${tag} ${gH}
const u8 gGradientData_${tag}[GRADIENT_H_${tag}][GRADIENT_W_${tag}] = ${gData};

// ── Tileset (${tag}) ────────────────────────────────────────────────
${renamedArray}
${runToBlackCode}
${runToSceneCode}
`;
}

/**
 * Detecta texto explicativo pegado por error en un script de C.
 *
 * El cuerpo del script se copia tal cual al main.c, así que si alguien pega la
 * explicación que rodea a un ejemplo, el gcc se come veinte líneas de warnings y
 * un error críptico tipo "unknown type name 'Y'". Aquí se avisa ANTES de
 * compilar, que es cuando todavía se entiende.
 *
 * Una línea es sospechosa si, sin ser comentario ni preprocesador, parece una
 * frase: muchas palabras y ninguno de los símbolos que usa el código.
 */
function lineasDeTextoPegado(code: string): number[] {
  const sospechosas: number[] = [];

  // Símbolo que el código usa y un texto en castellano casi nunca: si aparece,
  // la línea es código aunque no tenga ni punto y coma ni llave (un condicional
  // largo sin llaves, una firma de función partida en dos líneas...).
  // \w\( es llamada o declaración de función: en castellano eso no pasa
  // ("rápido (" lleva espacio, y un identificador pegado al paréntesis no aparece).
  const CODIGO_FUERTE = /\w\(|->|&&|\|\||==|!=|<=|>=|\+\+|--|<<|>>|\[|\]|_|::|\*/;
  const CIERRE = /;|\{|\}/;

  let enComentario = false;

  code.split('\n').forEach((linea, i) => {
    const t = linea.trim();

    // Comentario de bloque: hay que llevar la cuenta hasta el cierre, porque sus
    // líneas intermedias no empiezan por * y son texto igual.
    if (enComentario) {
      if (t.includes('*/')) enComentario = false;
      return;
    }
    if (!t) return;
    if (t.startsWith('/*')) {
      if (!t.includes('*/')) enComentario = true;
      return;
    }
    if (t.startsWith('//') || t.startsWith('#')) return;

    const palabras = t.split(/\s+/).filter(Boolean).length;
    if (palabras < 6) return;                    // una frase corta puede ser código
    if (CODIGO_FUERTE.test(t) || CIERRE.test(t)) return;

    sospechosas.push(i + 1);
  });

  return sospechosas;
}

export function generateGBAProject(
  state: EditorState,
  name: string,
  author: string,
  log: ExportLog,
  splashImageCArray?: string,
  splashDuration?: number,
  splashSong?: Song,
  sceneSong?: Song,
  sceneImageCArray?: string,
  sceneBackgroundColor?: string,
  entryTilesetCArray?: string,
  entryTileSize?: number,
  entryTilesetFrames?: number,
  entryTilesetSpeed?: number,
  entryTilesetFw?: number,
  entryTilesetFh?: number,
  exitTilesetCArray?: string,
  exitTileSize?: number,
  exitTilesetFrames?: number,
  exitTilesetSpeed?: number,
  exitTilesetFw?: number,
  exitTilesetFh?: number,
  exitTransitionDuration?: number,
  exitGradientCArray?: string | null,
  exitGradientW?: number,
  exitGradientH?: number,
  entryGradientCArray?: string | null,
  entryGradientW?: number,
  entryGradientH?: number,
  entryTransitionType?: string,
  exitTransitionType?: string,
  collisionMap?: number[][],
  collisionTileSize?: number,
  sceneCamX?: number,
  sceneCamY?: number,
  actors?: GBAExportedActor[],
  multiScenes?: GBAMultiScenes,
): string {
  if (multiScenes && multiScenes.scenes.length > 0) {
    return generateGBAProjectMulti(
      state, name, author, log, splashImageCArray, splashDuration, splashSong, sceneSong,
      entryTilesetCArray, entryTileSize, entryTilesetFrames, entryTilesetSpeed, entryTilesetFw, entryTilesetFh,
      exitTilesetCArray, exitTileSize, exitTilesetFrames, exitTilesetSpeed, exitTilesetFw, exitTilesetFh,
      exitTransitionDuration, exitGradientCArray, exitGradientW, exitGradientH,
      entryGradientCArray, entryGradientW, entryGradientH,
      entryTransitionType, exitTransitionType, multiScenes);
  }

  log.add(`Generando proyecto GBA: ${name}`);
  log.add(`Autor: ${author}`);

  const hasSplash = splashImageCArray && splashDuration && splashDuration > 0;
  const hasMusic = splashSong && splashSong.patterns.length > 0 && splashSong.patterns.some((p) => p.rows.length > 0);
  const hasSceneMusic = sceneSong && sceneSong.patterns.length > 0 && sceneSong.patterns.some((p) => p.rows.length > 0);
  const hasActors = !!(actors && actors.length > 0);
  const hasCollisionMap = !!(collisionMap && collisionMap.length > 0 && collisionMap[0].length > 0);
  const cScripts: any[] = [];
  const scriptC = new Map<string, ACodTranspileResult>();
  (state.scripts ?? []).forEach((s: any) => {
    if (!s) return;
    const raw = s.mode === 'language' ? (s.language ?? '') : (s.cCode ?? '');
    if (typeof raw !== 'string' || raw.trim().length === 0) return;
    const r = scriptEffectiveCCode(s);
    if (s.mode === 'language') {
      if (r.ok) {
        r.warnings.forEach((w) => log.warn(`AdvanceCode "${s.name ?? 'sin nombre'}": ${w}`));
      } else {
        r.errors.forEach((e) => log.error(`AdvanceCode "${s.name ?? 'sin nombre'}": ${e}`));
        log.error(`Script "${s.name ?? 'sin nombre'}": errores de AdvanceCode — NO se incluye en la ROM`);
      }
    }
    scriptC.set(s.id, r);
    if (r.ok && r.code.trim().length > 0) cScripts.push(s);
  });
  const hasCScripts = cScripts.length > 0;
  // Un script SOLO se ejecuta si está asignado (scriptId) a algún actor de la escena.
  const actorScriptIds = new Set((actors ?? []).map((a: GBAExportedActor) => a.scriptId).filter(Boolean) as string[]);
  const activeScripts = cScripts.filter((s: any) => actorScriptIds.has(s.id));
  const hasActiveScripts = activeScripts.length > 0;
  const anyActiveNeedsAreas = activeScripts.some((s: any) => scriptC.get(s.id)?.needsAreas);
  const anyActorHasArea = hasActors && (actors ?? []).some((a: GBAExportedActor) => a.hasArea);
  const needsAreaRuntime = (anyActiveNeedsAreas || anyActorHasArea) && hasActors;
  const anyActiveNeedsEdge = activeScripts.some((s: any) => scriptC.get(s.id)?.needsEdge);
  cScripts.forEach((s: any) => {
    if (!actorScriptIds.has(s.id)) log.warn(`Script "${s.name ?? 'sin nombre'}" NO está asignado a ningún actor — no se ejecuta`);
  });
  const sceneSongSuffix = (hasSceneMusic && hasMusic && splashSong!.id !== sceneSong!.id) ? '_Scene' : '';
  const hasScene = !!sceneImageCArray || !!sceneBackgroundColor;
  const entryType = entryTransitionType || 'fade';
  const exitType = exitTransitionType || 'fade';
  const hasCustomEntry = !!(entryTilesetCArray && entryTilesetFrames && entryTilesetFw && entryTilesetFh && entryTileSize);
  const hasCustomExit = !!(exitTilesetCArray && exitTilesetFrames && exitTilesetFw && exitTilesetFh && exitTileSize);
  const hasEntry = entryType !== 'instant' && (entryType === 'fade' || hasCustomEntry);
  const hasExit = exitType !== 'instant' && (exitType === 'fade' || hasCustomExit);
  const hasTransition = hasEntry || hasExit;
  const entryTotalFrames = Math.round((entryTilesetSpeed ?? 5) * 60);
  const exitTotalFrames = Math.round((exitTilesetSpeed ?? 5) * 60);
  const totalFrames = Math.max(entryTotalFrames, exitTotalFrames);
  const tilesForGradW = Math.ceil(240 / (exitTileSize ?? 8));
  const tilesForGradH = Math.ceil(160 / (exitTileSize ?? 8));
  const hasCustomTransition = (entryType === 'custom' && hasCustomEntry) || (exitType === 'custom' && hasCustomExit);

  function getCoverCall(): string {
    if (entryType === 'fade') return `fadeToScene(sceneData, ${entryTotalFrames})`;
    if (entryType === 'custom' && hasCustomEntry) return `runToBlack_Entry(sceneData, ${totalFrames})`;
    return '';
  }
  function getRevealCall(): string {
    if (exitType === 'fade') return `fadeToBlack(sceneData, ${exitTotalFrames})`;
    if (exitType === 'custom' && hasCustomExit) return `runToScene_Exit(sceneData, ${totalFrames})`;
    if (entryType === 'custom' && hasCustomEntry) return `runToScene_Entry(sceneData, ${totalFrames})`;
    return '';
  }
  function hexColor(cssColor: string): number {
    let hex = cssColor.replace('#', '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    const r = parseInt(hex.slice(0,2), 16);
    const g = parseInt(hex.slice(2,4), 16);
    const b = parseInt(hex.slice(4,6), 16);
    return ((r>>3) | ((g>>3)<<5) | ((b>>3)<<10)) & 0x7FFF;
  }

  // ── Scripts de usuario (C Directo) ────────────────────────────────────
  const DEF_FN = (name: string) => new RegExp(`void\\s+${name}\\s*\\(\\s*(?:void)?\\s*\\)`);

  function buildScriptsSection(): string {
    const initCalls: string[] = [];
    const updCalls: string[] = [];
    const bodies: string[] = [];

    activeScripts.forEach((s: any, i: number) => {
      const tag = `script_u${i}`;
      const r = scriptC.get(s.id)!;
      const raw = r.code.trimEnd();
      const hasInit = r.hasInit;
      const hasUpd = r.hasUpdate;
      const body = raw
        .replace(/\bscript_init\b\s*\(/g, `${tag}_init(`)
        .replace(/\bscript_update\b\s*\(/g, `${tag}_update(`);

      // Texto pegado por error: se avisa aquí, antes de que el gcc lo entierre
      // entre veinte líneas de warnings.
      const textoPegado = lineasDeTextoPegado(raw);
      if (textoPegado.length > 0) {
        log.add(
          `[ERROR] Script "${s.name}" línea(s) ${textoPegado.join(', ')} parecen texto explicativo, no código C. ` +
          `Borra el texto que rodea al ejemplo y pega solo el código (void script_init / void script_update).`
        );
      }

      if (!hasUpd) log.warn(`Script "${s.name}": no define script_update() — no hará nada cada frame`);

      const indices = (actors ?? []).map((a: GBAExportedActor, ai: number) => (a.scriptId === s.id ? ai : -1)).filter((ai) => ai >= 0);
      if (indices.length === 0) {
        log.warn(`Script "${s.name}" está asignado a un actor que no se exporta en esta escena`);
        return;
      }
      log.add(`Script "${s.name}": asignado a ${indices.length} actor(es) → gSelf=gActors[${indices.join(', ')}]`);
      indices.forEach((idx) => {
        if (hasInit) initCalls.push(`  gSelf = &gActors[${idx}];\n  ${tag}_init();`);
        if (hasUpd) updCalls.push(`    gSelf = &gActors[${idx}];\n    ${tag}_update();`);
      });
      bodies.push(`// ── Script ${i + 1}: ${s.name ?? 'sin nombre'}${indices.length === 1 ? ` (gActors[${indices[0]}])` : ''}\n${body}`);
    });

    return `
// ── Scripts de usuario (C ó AdvanceCode transpilado) ─────────────────────
// Contrato: cada script asignado a un actor se ejecuta con la variable global
//   GBAActor* gSelf — apunta AL ACTOR al que está asignado este script.
//   script_init(void)        — se llama UNA vez al entrar en la escena (por actor)
//   script_update(void)      — se llama CADA frame del juego (por actor)
// API disponible (definida arriba en este archivo):
//   gSelf, gActors[ACTOR_COUNT] (GBAActor: .x .y .z .w .h .vx .vy .frame .timer),
//   PLAYER_INDEX, moveActorCollide(actor, dx, dy), movePlayer(keys, actor),
//   moveTopDown(a, keys), movePlatformer(a, keys), onFloor(a), approach(&v, t, s),
//   near(a, b, dist), switchScene(n),
//   actor_in_area(a,b)/actor_entered(a,b)/actor_exit(a,b): ¿está b en el área de a?
//   REG_KEYINPUT: bit 0=A 1=B 2=SELEC 3=START 4=RIGHT 5=LEFT 6=UP 7=DOWN 8=R 9=L (0=presionado).
// Reglas GBA: tipos u8/s16 (sin float), sin memoria dinámica, todo a 60fps.
${anyActiveNeedsEdge ? `// Flanco de teclas: gJp tiene SOLO los bits pulsados ESTE frame (como
// REG_KEYINPUT, activo en 0). Se actualiza cada frame dentro del bucle.
static u16 gKeysPrev = 0, gJp = 0;
` : ''}static GBAActor* gSelf;
${bodies.join('\n\n')}

static void userScriptsInit(void) {
${initCalls.length ? initCalls.join('\n') : '  // ningún script define script_init\n'}}
static void userScriptsUpdate(void) {
${updCalls.length ? updCalls.join('\n') : '  // ningún script define script_update\n'}}
`;
  }

  function fillScene(): string {
    const purpleHex = '0x7C1F';
    if (sceneImageCArray) {
      return `  {
    int i;
    for (i = 0; i < PIXEL_COUNT; i++) screen[i] = sceneData[i];
  }`;
    }
    if (sceneBackgroundColor) {
      const hex = `0x${hexColor(sceneBackgroundColor).toString(16).padStart(4, '0')}`;
      return `  {
    int i;
    for (i = 0; i < PIXEL_COUNT; i++) screen[i] = ${hex};
  }`;
    }
    // fallback: purple solid
    return `  {
    int i;
    for (i = 0; i < PIXEL_COUNT; i++) screen[i] = ${purpleHex};
  }`;
  }

function sceneInit(): string {
    const scriptInitLine = hasActiveScripts ? '  userScriptsInit();\n' : '';
    if (!hasActors) return scriptInitLine ? `\n${scriptInitLine}` : '';
    return `
  {
    int i;
    for (i = 0; i < PIXEL_COUNT; i++) gBackBuf[i] = screen[i];
  }
  {
    int i;
    for (i = 0; i < PIXEL_COUNT; i++) gActorBack[i] = screen[i];
  }
  initActors();
  drawAllActors(gBackBuf, 0);
 ${scriptInitLine}`;
  }

  function actorLoopBody(): string {
    const lines: string[] = [];
    lines.push('soundTick();');
    if (anyActiveNeedsEdge) lines.push('{ u16 kn = ~REG_KEYINPUT & 0x3FF; gJp = (u16)(kn & ~gKeysPrev); gKeysPrev = kn; }');
    if (hasActors) {
      lines.push(`if (gDirty) { blitDirtyRect(); gDirty = 0; }`, 'advanceAllActors();', 'updatePlayer();');
    }
    if (needsAreaRuntime) lines.push('updateAreaContacts();');
    if (hasActiveScripts) lines.push('userScriptsUpdate();');
    if (hasActors) lines.push(`if (actorsChanged()) { computeDirtyRect(); drawAllActors(gBackBuf, 1); gDirty = 1; }`);
    if (lines.length === 0) return '';
    return lines.map((l) => '      ' + l).join('\n') + '\n';
  }

  function sceneLoop(suffix: string = sceneSongSuffix): string {
    const sceneSoundLine = sceneSoundIdx >= 0 ? `  soundPlay(${sceneSoundIdx}, 1);\n` : '';
    if (hasSceneMusic) {
      return `  initSound();
${sceneSoundLine}
  {
    int step = 0;
    u32 accum = 0;
    while (1) {
      waitVSync();
      accum += SONG_BPM${suffix};
      if (accum >= 900) {
        accum -= 900;
        playStep${suffix}(step);
        step++;
        if (step >= SONG_STEPS${suffix}) step = 0;
      }
      ${actorLoopBody().trimEnd()}
    }
  }
`;
    }
    if (sceneSoundIdx >= 0) {
      return `  initSound();
${sceneSoundLine}` + ((hasActors || hasActiveScripts)
        ? `
  while (1) {
    waitVSync();
${actorLoopBody().replace(/^      /gm, '    ').trimEnd()}
  }
`
        : `
  while (1) { waitVSync(); soundTick(); }
`);
    }
    return (hasActors || hasActiveScripts)
      ? `  while (1) {
    waitVSync();
${actorLoopBody().replace(/^      /gm, '    ').trimEnd()}
  }
`
      : `  while (1) { waitVSync(); soundTick(); }
`;
  }

  function renderScene(): string {
    return fillScene() + '\n' + sceneInit() + '\n' + sceneLoop(sceneSongSuffix);
  }

  let cCode = `/*
 * ${name} — Generado por Advance Engine
 * Author: ${author}
 * Fecha: ${new Date().toISOString()}
 */

#include <gba.h>
#include <string.h>

#define SCREEN_W 240
#define SCREEN_H 160
#define PIXEL_COUNT (SCREEN_W * SCREEN_H)

static void waitVSync(void) {
  while (REG_VCOUNT >= SCREEN_H);
  while (REG_VCOUNT < SCREEN_H);
}
`;

  if (hasActors && hasTransition) {
    cCode += `
static void initActors(void);
static void drawAllActors(u16* screen, int filterDirty);
static void drawAllActorsOpaque(u16* screen);
`;
  }

  if (hasTransition && (entryType === 'fade' || exitType === 'fade')) {
    cCode += `
// ── Fade Transition ──────────────────────────────────────────────────────
static void fadeToScene(const u16* scene, int totalFrames) {
  u16* screen = (u16*)VRAM;
  ${hasActors ? '  initActors();\n' : ''}int i, p;
  for (i = 0; i < totalFrames; i++) {
    int t = i + 1;
    for (p = 0; p < PIXEL_COUNT; p++) {
      u16 s = scene[p];
      int r = (s & 0x1F) * t / totalFrames;
      int g = ((s >> 5) & 0x1F) * t / totalFrames;
      int b = ((s >> 10) & 0x1F) * t / totalFrames;
      screen[p] = r | (g << 5) | (b << 10);
    }
    ${hasActors ? '    drawAllActorsOpaque(screen);\n' : ''}waitVSync();
  }
}

static void fadeToBlack(const u16* scene, int totalFrames) {
  u16* screen = (u16*)VRAM;
  int i, p;
  for (i = 0; i < totalFrames; i++) {
    for (p = 0; p < PIXEL_COUNT; p++) {
      u16 cur = screen[p];
      int r = (cur & 0x1F) * (totalFrames - i) / totalFrames;
      int g = ((cur >> 5) & 0x1F) * (totalFrames - i) / totalFrames;
      int b = ((cur >> 10) & 0x1F) * (totalFrames - i) / totalFrames;
      screen[p] = r | (g << 5) | (b << 10);
    }
    waitVSync();
  }
}
`;
  }

  if (hasSplash) {
    cCode += `
// ── Splash Screen ─────────────────────────────────────────────────────
#define SPLASH_DURATION ${splashDuration}

const u16 splashScreenData[PIXEL_COUNT] = ${splashImageCArray};
`;
  }

  if (hasScene) {
    const sceneHex = sceneBackgroundColor ? `0x${hexColor(sceneBackgroundColor).toString(16).padStart(4, '0')}` : '0x7C1F';
    cCode += `
// ── Scene after splash ─────────────────────────────────────────────────
`;
    if (sceneImageCArray) {
      cCode += `const u16 sceneData[PIXEL_COUNT] = ${sceneImageCArray};
`;
    } else if (hasTransition) {
      cCode += `#define SCENE_COLOR ${sceneHex}
const u16 sceneData[PIXEL_COUNT] = { [0 ... PIXEL_COUNT-1] = SCENE_COLOR };
`;
    } else {
      cCode += `#define SCENE_COLOR ${sceneHex}
`;
    }
  } else if (hasTransition) {
    const fallbackHex = '0x7C1F';
    cCode += `
// ── Scene data (fallback for transition) ───────────────────────────────
const u16 sceneData[PIXEL_COUNT] = { [0 ... PIXEL_COUNT-1] = ${fallbackHex} };
`;
  }

  if (collisionMap && collisionMap.length > 0 && collisionMap[0].length > 0) {
    const ts = collisionTileSize ?? 8;
    const rows = collisionMap.length;
    const cols = collisionMap[0].length;
    // Normaliza valores: 0 vacío, 1-6 tipos, 7-11 rampas/encoded (>u8) → sólido (1)
    const normalize = (v: number) =>
      (v === 0 || v === 6) ? v :                     // vacío / escalera pasable
      (v === 1 || v === 2 || v === 3 || v === 4 || v === 5) ? v : // sólido y one-ways
      1;                                             // rampas codificadas/estáticas → sólido
    const lines = collisionMap.map((row) =>
      '  {' + row.map(normalize).join(',') + '}'
    );
    cCode += `
// ── Collision Map ─────────────────────────────────────────────────────
#define COLLISION_COLS ${cols}
#define COLLISION_ROWS ${rows}
#define COLLISION_TILE_SIZE ${ts}
#define CAM_X ${Math.round(sceneCamX ?? 0)}
#define CAM_Y ${Math.round(sceneCamY ?? 0)}

const u8 collisionMap[COLLISION_ROWS][COLLISION_COLS] = {
${lines.join(',\n')}
};
`;
    log.add(`Collision map: ${cols}x${rows} tiles (${ts}px)`);
  }

  cCode += generateSoundTypes();

  // Sonidos PCM importados (DMA direct sound). El índice es el orden de
  // state.sounds filtrado por los que tienen PCM: sound_play(idx) desde script.
  const pcmSnd = generatePcmSoundData(state.sounds ?? []);
  cCode += pcmSnd.code;
  const splashSoundIdx = pcmSnd.meta.find((m) => m.id === state.splashSoundId)?.index ?? -1;
  const startSceneSound = state.scenes?.find((sc) => sc.id === state.splashScreen?.nextSceneId);
  const sceneSoundIdx = pcmSnd.meta.find((m) => m.id === startSceneSound?.backgroundSoundId)?.index ?? -1;
  pcmSnd.meta.forEach((m) => log.add(`Sonido PCM ${m.index}: "${m.name}" (${(m.bytes / 1024).toFixed(1)} KB, ${m.rate} Hz)${m.loop ? ' [bucle]' : ''}`));

  if (hasMusic) {
    cCode += generateSongData(splashSong!, '', pcmSnd.meta);
    log.add(`Cancion splash: "${splashSong!.name}" (${splashSong!.patterns.length} patrones)`);
  }
  if (hasSceneMusic && sceneSongSuffix === '_Scene') {
    cCode += generateSongData(sceneSong!, '_Scene', pcmSnd.meta);
    log.add(`Cancion escena: "${sceneSong!.name}" (${sceneSong!.patterns.length} patrones) — distinta de splash`);
  } else if (hasSceneMusic && !hasMusic) {
    cCode += generateSongData(sceneSong!, '', pcmSnd.meta);
    log.add(`Cancion escena: "${sceneSong!.name}" (${sceneSong!.patterns.length} patrones)`);
  } else if (hasSceneMusic) {
    log.add(`Cancion escena: "${sceneSong!.name}" (misma que splash)`);
  }
  if (!hasMusic && !hasSceneMusic) {
    log.add('Sin cancion de fondo para la ROM');
  }

  if (entryType === 'custom' && hasCustomEntry) {
    cCode += generateTransitionData(
      entryTilesetCArray!, entryTileSize!,
      entryTilesetFrames!, entryTilesetSpeed ?? 5,
      entryTilesetFw!, entryTilesetFh!,
      'Entry',
      entryGradientCArray ?? null, entryGradientW ?? 0, entryGradientH ?? 0,
    );
    log.add(`Transicion de entrada (cover): ${entryTilesetFrames} frames, tile ${entryTileSize}px`);
  }
  if (exitType === 'custom' && hasCustomExit) {
    cCode += generateTransitionData(
      exitTilesetCArray!, exitTileSize!,
      exitTilesetFrames!, exitTilesetSpeed ?? 5,
      exitTilesetFw!, exitTilesetFh!,
      'Exit',
      exitGradientCArray ?? null, exitGradientW ?? tilesForGradW, exitGradientH ?? tilesForGradH,
    );
    log.add(`Transicion de salida (reveal): ${exitTilesetFrames} frames, tile ${exitTileSize}px`);
  }

  if (hasTransition) {
    if (entryType === 'fade') log.add(`Transicion de entrada (fade): ${entryTilesetSpeed ?? 5}s`);
    if (entryType === 'instant') log.add('Transicion de entrada: instantanea');
    if (exitType === 'fade') log.add(`Transicion de salida (fade): ${exitTilesetSpeed ?? 5}s`);
    if (exitType === 'instant') log.add('Transicion de salida: instantanea');
  }

  if (hasActors) {
    cCode += generateActorsData(actors!, log, hasCollisionMap, hasCScripts);
  }
  if (needsAreaRuntime) {
    cCode += generateAreaSupport('CAM_X', 'CAM_Y');
    log.add('Soporte de áreas de actor activado (hooks actor_in_area/actor_entered/actor_exit)');
  }

  if (hasActiveScripts) {
    cCode += buildScriptsSection();
    log.add(`Scripts C Directo: ${activeScripts.length} script(s) activo(s) — solo asignados a actores`);
  }

  cCode += `
// ── Entry Point ─────────────────────────────────────────────────────────
int main() {
  REG_DISPCNT = MODE_3 | BG2_ENABLE;
  u16* screen = (u16*)VRAM;
`;

  const splashSoundLine = splashSoundIdx >= 0 ? `  soundPlay(${splashSoundIdx}, 1);\n` : '';
  if (hasSplash) {
    cCode += `
  {
    int i;
    for (i = 0; i < PIXEL_COUNT; i++) screen[i] = splashScreenData[i];
  }
`;
    if (hasMusic) {
      const song = splashSong!;
      cCode += `
  initSound();
${splashSoundLine}
  {
    int step = 0;
    u32 accum = 0;
    int frames = SPLASH_DURATION * 60;
    int i;
    for (i = 0; i < frames; i++) {
      waitVSync();
      accum += SONG_BPM;
      if (accum >= 900) {
        accum -= 900;
        playStep(step);
        step++;
        if (step >= SONG_STEPS) step = 0;
      }
    }
  }
`;
      cCode += hasTransition ? `  ${getCoverCall()};

  ${getRevealCall()};

` + fillScene() + '\n' + sceneInit() + '\n' + sceneLoop() : renderScene();
    } else {
      cCode += `
  {
    int frames = SPLASH_DURATION * 60;
    int i;
    for (i = 0; i < frames; i++) waitVSync();
  }
${splashSoundIdx >= 0 ? `  initSound();\n  soundPlay(${splashSoundIdx}, 1);\n` : ''}`;
      cCode += hasTransition ? `  ${getCoverCall()};

  ${getRevealCall()};

` + fillScene() + '\n' + sceneInit() + '\n' + sceneLoop() : renderScene();
    }
  } else {
    cCode += `
  {
    int i;
    for (i = 0; i < PIXEL_COUNT; i++) screen[i] = 0x7C1F;
  }
`;
    if (hasMusic) {
      cCode += `
  initSound();

`;
      cCode += hasTransition ? `  ${getCoverCall()};

  ${getRevealCall()};

` + fillScene() + '\n' + sceneInit() + '\n' + sceneLoop() : (hasActors ? fillScene() + '\n' + sceneInit() + '\n' + sceneLoop() : sceneLoop());
    } else {
      cCode += hasTransition ? `  ${getCoverCall()};

  ${getRevealCall()};

` + fillScene() + '\n' + sceneInit() + '\n' + sceneLoop() : (hasActors ? fillScene() + '\n' + sceneInit() + '\n' + sceneLoop() : sceneLoop());
    }
  }

  cCode += `  return 0;
}
`;

  log.add(`${hasSplash ? 'SplashScreen incluido (' + splashDuration + 's)' : 'Sin SplashScreen - pantalla purpura'}`);
  if (hasMusic) {
    const totalSteps = splashSong!.patterns.reduce((s, p) => s + p.rows.length, 0);
    log.add(`Musica splash: ${splashSong!.name} (${splashSong!.patterns.length} patrones, ${totalSteps} steps)`);
  }
  if (hasSceneMusic) {
    const totalSteps = sceneSong!.patterns.reduce((s, p) => s + p.rows.length, 0);
    log.add(`Musica escena: ${sceneSong!.name} (${sceneSong!.patterns.length} patrones, ${totalSteps} steps) — ${hasSceneMusic ? 'con loop' : 'sin loop'}`);
  }
  if (!hasMusic && !hasSceneMusic) {
    log.add('Sin musica');
  }
  log.add('Codigo fuente C generado correctamente');

  return cCode;
}

export interface GBAExportedActorFrame {
  w: number;
  h: number;
  pixels: number[]; // u16 por píxel; bit15 (0x8000) = transparente
}

export interface GBAExportedActor {
  name: string;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  mode: 'once' | 'loop' | 'pingpong';
  frames: GBAExportedActorFrame[];
  delays: number[]; // vsyncs por frame (0.25–4x speed aplicado)
  collider?: boolean;
  colliderW?: number;
  colliderH?: number;
  colliderOffsetX?: number;
  colliderOffsetY?: number;
  hasArea?: boolean;   // zona de detección (sigue al actor, como el collider)
  areaW?: number;
  areaH?: number;
  areaOffsetX?: number;
  areaOffsetY?: number;
  scriptId?: string; // script C asignado a este actor (solo los asignados se ejecutan)
}

// Datos ya preparados para EMBEBER una escena en la ROM. El orden del array
// `scenes` es el orden en el editor → switchScene(n) usa ese índice.
export interface GBAExportedSceneBundle {
  id: string;
  name: string;
  imageCArray?: string; // body de `const u16 [...][PIXEL_COUNT]` (imagen 240×160)
  color: string;        // css hex; se usa si no hay imageCArray (color sólido)
  collisionMap?: number[][];
  collisionTileSize?: number;
  camX: number;
  camY: number;
  actors: GBAExportedActor[];
  song?: Song;
  /** Id del sonido de fondo de la escena (PCM por DMA en la ROM). */
  soundId?: string;
}

// Transición que se reproduce al cambiar de escena con switchScene(n[, "nombre"]).
// `name` se compara con el 2º argumento; si la conexión no tiene nombre propio,
// el store usa el nombre del tileset/gradiente seleccionado.
export interface GBASceneTransition {
  fromSceneId: string;
  toSceneId: string;
  name: string;
  type: 'fade' | 'instant' | 'custom';
  durationSec: number;
  tilesetCArray?: string;
  tileSize?: number;
  frames?: number;
  fw?: number;
  fh?: number;
  gradientCArray?: string | null;
  gradientW?: number;
  gradientH?: number;
}

export interface GBAMultiScenes {
  scenes: GBAExportedSceneBundle[];
  startSceneId: string;
  transitions?: GBASceneTransition[];
}

// MAX_ACTORS límite a 64 (software render, orden z asc)
function cHexList(vals: number[], perLine = 8): string {
  const chunks: string[] = [];
  for (let i = 0; i < vals.length; i += perLine) {
    chunks.push(vals.slice(i, i + perLine).map((v) => `0x${v.toString(16).padStart(4, '0')}`).join(', '));
  }
  return chunks.join(',\n  ');
}

// Runtime C de las ÁREAS DE ACTOR: cada actor puede llevar un rect (como el
// collider) que lo sigue. Los scripts preguntan si OTRO actor está dentro con
// actor_in_area(otro) / actor_entered(otro) / actor_exit(otro) /
// actor_out_area(otro). Debe emitirse DESPUÉS de GBAActor/ACTOR_COUNT/gActors.
function generateAreaSupport(camX: string, camY: string): string {
  return `// ── Áreas de actor (detectores que siguen al actor) ────────────────────
// Cada actor con área define un rect relativo a su sprite (aw/ah/aox/aoy). Los
// scripts preguntan si OTRO actor entra en el área de gSelf con
// actor_in_area(otro), actor_entered(otro), actor_exit(otro) y
// actor_out_area(otro). areaInside/areaWas (bitmask) guardan el estado por
// frame para los flancos (límite: 32 actores).
static void actorAreaRect(const GBAActor* a, s16* rx, s16* ry) {
  *rx = a->x + ${camX} + (a->w - a->aw) / 2 + a->aox;
  *ry = a->y + ${camY} + (a->h - a->ah) / 2 + a->aoy;
}
static int actorInArea(const GBAActor* a, const GBAActor* other) {
  s16 ax, ay, bx, by, bw, bh;
  if (!a->hasArea) return 0;
  actorAreaRect(a, &ax, &ay);
  actorBox(other, &bx, &by, &bw, &bh);
  return (ax < bx + bw && ax + (s16)a->aw > bx && ay < by + bh && ay + (s16)a->ah > by) ? 1 : 0;
}
static int actorOutArea(const GBAActor* a, const GBAActor* other) {
  return !actorInArea(a, other);
}
// Recalcula qué actores están dentro del área de cada actor. Los scripts deben
// ejecutarse DESPUÉS de esta llamada (una vez por frame).
static void updateAreaContacts(void) {
  int i, j;
  for (i = 0; i < ACTOR_COUNT; i++) {
    GBAActor* a = &gActors[i];
    a->areaWas = a->areaInside;
    a->areaInside = 0;
    if (!a->hasArea) continue;
    for (j = 0; j < ACTOR_COUNT && j < 32; j++) {
      if (j == i || gActors[j].frameCount == 0) continue;
      if (actorInArea(a, &gActors[j])) a->areaInside |= (1u << j);
    }
  }
}
// Flanco: b entró AHORA / salió AHORA del área de a.
static int actorEnteredArea(const GBAActor* a, const GBAActor* other) {
  int j = (int)(other - gActors);
  if (j < 0 || j >= 32) return 0;
  return (a->areaInside & (1u << j)) && !(a->areaWas & (1u << j));
}
static int actorExitedArea(const GBAActor* a, const GBAActor* other) {
  int j = (int)(other - gActors);
  if (j < 0 || j >= 32) return 0;
  return !(a->areaInside & (1u << j)) && (a->areaWas & (1u << j));
}
`;
}

function generateActorsData(actors: GBAExportedActor[], log: ExportLog, hasCollisionMap: boolean, hasCScripts: boolean): string {
  const frames = actors.flatMap((a) => a.frames);

  // Pool de imágenes únicas compartidas
  const images: GBAExportedActorFrame[] = [];
  const imageIdx = new Map<string, number>();
  frames.forEach((f) => {
    const key = `${f.w}x${f.h}:${f.pixels.join(',')}`;
    if (!imageIdx.has(key)) {
      imageIdx.set(key, images.length);
      images.push(f);
    }
  });

  const imageArr = images.map((img, i) => `static const u16 gSprImg${i}[${img.w * img.h}] = {\n  ${cHexList(img.pixels)},\n};`);

  const poolArr = images.map((img, i) => `    { gSprImg${i}, ${img.w}, ${img.h} }`);

  // Código generado: construcción con loops para tablas de punteros
  const perActorCode = actors.slice(0, 64).map((a, ai) => {
    const animFrames = a.frames.map((f) => imageIdx.get(`${f.w}x${f.h}:${f.pixels.join(',')}`)!);
    const delaysArr = a.delays.map((d) => String(Math.max(1, Math.round(d))));
    const mode = a.mode === 'once' ? 0 : a.mode === 'pingpong' ? 2 : 1;
    return `  gActors[${ai}].x = ${a.x};
  gActors[${ai}].y = ${a.y};
  gActors[${ai}].z = ${Math.max(0, a.z)};
  gActors[${ai}].w = ${a.w};
  gActors[${ai}].h = ${a.h};
  gActors[${ai}].prevX = ${a.x};
  gActors[${ai}].prevY = ${a.y};
  gActors[${ai}].prevW = ${a.w};
  gActors[${ai}].prevH = ${a.h};
  gActors[${ai}].hasCollider = ${a.collider ? 1 : 0};
  gActors[${ai}].cw = ${a.collider ? Math.max(1, Math.round(a.colliderW ?? a.w)) : 0};
  gActors[${ai}].ch = ${a.collider ? Math.max(1, Math.round(a.colliderH ?? a.h)) : 0};
  gActors[${ai}].cox = ${a.colliderOffsetX ?? 0};
  gActors[${ai}].coy = ${a.colliderOffsetY ?? 0};
  gActors[${ai}].hasArea = ${a.hasArea ? 1 : 0};
  gActors[${ai}].aw = ${a.hasArea ? Math.max(1, Math.round(a.areaW ?? a.w)) : 0};
  gActors[${ai}].ah = ${a.hasArea ? Math.max(1, Math.round(a.areaH ?? a.h)) : 0};
  gActors[${ai}].aox = ${a.areaOffsetX ?? 0};
  gActors[${ai}].aoy = ${a.areaOffsetY ?? 0};
  gActors[${ai}].areaInside = 0;
  gActors[${ai}].areaWas = 0;
  gActors[${ai}].frameCount = ${a.frames.length};
  gActors[${ai}].mode = ${mode};
  gActors[${ai}].frame = 0;
  gActors[${ai}].prevFrame = 0;
  gActors[${ai}].timer = (u16)(${ai} * 7); // desfasa los avances de animación
  gActors[${ai}].dir = 1;
  gActors[${ai}].face = 1;
  gActors[${ai}].coyote = 0;
  gActors[${ai}].jumpBuf = 0;
  gActors[${ai}].jumpHeld = 0;
  gActors[${ai}].animSpeed = 0;
  {
    int fi;
    u16 srcDelays[${a.frames.length}] = { ${delaysArr.join(', ')} };
    u16 srcFrames[${a.frames.length}] = { ${animFrames.join(', ')} };
    for (fi = 0; fi < ${a.frames.length}; fi++) {
      gActors[${ai}].frames[fi] = &gFrames[srcFrames[fi]];
      gActors[${ai}].delays[fi] = srcDelays[fi];
    }
  }`;
  });

  log.add(`Actores exportados: ${actors.length} (${images.length} imágenes de sprite únicas)`);
  if (actors.length > 64) log.warn(`${actors.length} actores, el render por software soporta hasta 64 — se exportan los primeros 64`);

const playerDemo = `
// ── Physica runtime (colisiones tiles + actor-actor) ─────────────────────
#define PLAYER_SPEED 2

// AABB del actor en píxeles (posición relativa a cámara + cam offset)
static inline void actorBox(const GBAActor* a, s16* bx, s16* by, s16* bw, s16* bh) {
  *bw = a->cw ? a->cw : a->w;
  *bh = a->ch ? a->ch : a->h;
  *bx = a->x + CAM_X + (a->w - *bw) / 2 + a->cox;
  *by = a->y + CAM_Y + (a->h - *bh) / 2 + a->coy;
}

// actor-actor AABB
static inline int rectsOverlap(s16 ax, s16 ay, s16 aw, s16 ah, s16 bx, s16 by, s16 bw, s16 bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

${hasCollisionMap ? `
static inline u8 solidTile(u8 v, int dirX, int dirY) {
  if (v == 1) return 1;                    // sólido
  if (v == 2) return dirY > 0;             // one-way ↑: bloquea cayendo
  if (v == 3) return dirY < 0;             // one-way ↓: bloquea saltando
  if (v == 4) return dirX > 0;             // one-way ←: bloquea yendo derecha
  if (v == 5) return dirX < 0;             // one-way →: bloquea yendo izquierda
  return 0;                                // 0 vacío, 6 escalera (pasable)
}

// true si el rect en coords mundo toca algún tile sólido para dir (dx,dy)
static inline int rectHitsSolid(s16 bx, s16 by, s16 bw, s16 bh, s16 dx, s16 dy) {
  int x0 = bx, y0 = by, x1 = bx + bw - 1, y1 = by + bh - 1;
  int tx0 = x0 / COLLISION_TILE_SIZE, ty0 = y0 / COLLISION_TILE_SIZE;
  int tx1 = x1 / COLLISION_TILE_SIZE, ty1 = y1 / COLLISION_TILE_SIZE;
  int cx, cy;
  for (cy = ty0; cy <= ty1; cy++) {
    for (cx = tx0; cx <= tx1; cx++) {
      if (cx < 0 || cy < 0 || cx >= COLLISION_COLS || cy >= COLLISION_ROWS) continue;
      if (solidTile(collisionMap[cy][cx], dx, dy)) return 1;
    }
  }
  return 0;
}
` : `
// Sin mapa de colisiones: nada es sólido, pero las primitivas de movimiento
// (moveTopDown / movePlatformer) se siguen compilando para que un script
// funcione igual en un mapa sin colisiones pintadas.
static inline int rectHitsSolid(s16 bx, s16 by, s16 bw, s16 bh, int dx, int dy) { (void)bx; (void)by; (void)bw; (void)bh; (void)dx; (void)dy; return 0; }
`}
// mover con resolución axial (X e Y por separado). Sin mapa de colisiones
// es un simple desplazamiento; con mapa respeta los tiles sólidos.
static void moveActorCollide(GBAActor* a, s16 dx, s16 dy) {${hasCollisionMap ? `
  s16 bx, by, bw, bh;
  actorBox(a, &bx, &by, &bw, &bh);
  if (dx != 0) {
    a->x += dx;
    actorBox(a, &bx, &by, &bw, &bh);
    if (rectHitsSolid(bx, by, bw, bh, dx, 0)) a->x -= dx;
  }
  if (dy != 0) {
    a->y += dy;
    actorBox(a, &bx, &by, &bw, &bh);
    if (rectHitsSolid(bx, by, bw, bh, 0, dy)) a->y -= dy;
  }` : `
  a->x += dx;
  a->y += dy;`}
}
// ── Primitivas de movimiento ────────────────────────────────────────────────
// En vez de "bases" de escenas: el nivel ya es el mapa de tiles y lo que
// cambia entre un plataformas y un topdown son estas ~40 líneas. El script las
// llama y si no las quiere, mueve gSelf a mano: nada obliga a usarlas.
// Todo son defines: se tocan aquí y afecta a todos los scripts.
#define WALK_SPEED 2        // px/vsync horizontal máximo
#define RUN_SPEED 3         // con R o L (shoulder)
#define ACCEL 1             // aceleración horizontal (1 = respuesta inmediata)
#define FRICTION 1          // frenada en suelo
#define GRAVITY 1           // px/vsync² — entero: en GBA no hay floats
#define MAX_FALL 5          // velocidad máxima de caída
#define JUMP_VEL -11        // impulso del salto (negativo = hacia arriba)
#define COYOTE_FRAMES 5     // vsyncs de margen tras salir de la plataforma
#define JUMP_BUFFER 5       // vsyncs que un salto espera a que haya suelo
#define JUMP_CUT_VEL -3     // salto corto: soltar A corta la subida

// ¿Hay suelo justo debajo del actor? Mira un tile por debajo del collider.
static int onFloor(GBAActor* a) {
  s16 bx, by, bw, bh;
  actorBox(a, &bx, &by, &bw, &bh);
  return rectHitsSolid(bx, by + 1, bw, bh, 0, 1);
}

// Empuja *v hacia target sin pasarse (para que frenar no dé tirones)
static inline void approach(s16* v, s16 target, s16 step) {
  if (*v > target) { *v -= step; if (*v < target) *v = target; }
  else if (*v < target) { *v += step; if (*v > target) *v = target; }
}

// Cómo se leen las teclas. Bits de ~REG_KEYINPUT & 0x3FF (0 = pulsado):
// b4 RIGHT, b5 LEFT, b6 UP, b7 DOWN, b8 R shoulder, b9 L shoulder, b3 START,
// b2 SELECT, b0 A, b1 B.
#define KEY_RIGHT 0x010
#define KEY_LEFT  0x020
#define KEY_UP    0x040
#define KEY_DOWN  0x080
#define KEY_A     0x001
#define KEY_B     0x002
#define KEY_SHOULDER 0x300

// Topdown: 4 direcciones con aceleración y frenada, sin gravedad. Para juegos
// de laberinto, RPG y menús.
static void moveTopDown(GBAActor* a, u16 keys) {
  s16 ox = a->x, oy = a->y;
  s16 tx = 0, ty = 0, max = (keys & KEY_SHOULDER) ? RUN_SPEED : WALK_SPEED;
  if (keys & KEY_RIGHT) tx = max;
  else if (keys & KEY_LEFT) tx = -max;
  if (keys & KEY_DOWN) ty = max;
  else if (keys & KEY_UP) ty = -max;
  if (tx) a->face = (tx > 0) ? 1 : 0;
  approach(&a->vx, tx, tx ? ACCEL : FRICTION);
  approach(&a->vy, ty, ty ? ACCEL : FRICTION);
  moveActorCollide(a, a->vx, a->vy);
  // Si no se movió, es que un tile lo frenó: pon ese eje a 0 o se queda
  // "pegado" al muro y en cuanto el muro acaba sigue a velocidad máxima.
  if (a->x == ox) a->vx = 0;
  if (a->y == oy) a->vy = 0;
}

// Plataformas: gravedad + salto con coyote time (correr y saltar tras salir del
// borde), jump buffer (pulsar A antes de aterrizar salta al tocar suelo) y
// salto variable (soltar A corta la subida). Respeta los tiles one-way: solo
// bloquean si vienes cayendo, así que se puede subir atravesándolos.
static void movePlatformer(GBAActor* a, u16 keys) {
  s16 tx = 0, max = (keys & KEY_SHOULDER) ? RUN_SPEED : WALK_SPEED;
  s16 before = a->y;
  if (keys & KEY_RIGHT) { tx = max; a->face = 1; }
  else if (keys & KEY_LEFT) { tx = -max; a->face = 0; }
  approach(&a->vx, tx, tx ? ACCEL : (onFloor(a) ? FRICTION : 0));

  // Coyote time: margen para saltar justo tras salir del borde.
  if (onFloor(a)) a->coyote = COYOTE_FRAMES;
  else if (a->coyote) a->coyote--;
  // Jump buffer: pulsar A hasta JUMP_BUFFER vsyncs antes de tocar suelo ya
  // cuenta como salto. Se arma SOLO en el flanco de pulsación (si no, mantener
  // A pulsado rebotaría solo al aterrizar).
  if (keys & KEY_A) {
    if (!a->jumpHeld) { a->jumpBuf = JUMP_BUFFER; a->jumpHeld = 1; }
  } else {
    a->jumpHeld = 0;
    a->jumpBuf = 0;
  }
  if (a->jumpBuf && a->coyote) {
    a->vy = JUMP_VEL;
    a->jumpBuf = 0;
    a->coyote = 0;
  }
  if (a->jumpBuf) a->jumpBuf--;
  if (!(keys & KEY_A) && a->vy < JUMP_CUT_VEL) a->vy = JUMP_CUT_VEL;

  a->vy += GRAVITY;
  if (a->vy > MAX_FALL) a->vy = MAX_FALL;
  moveActorCollide(a, a->vx, a->vy);
  if (a->y == before) a->vy = 0;   // suelo o techo: no acumula velocidad
}

// Input demo: D-pad mueve al actor 0 (jugador). Se llama desde el script del
// usuario (si hay script C) o desde updatePlayer (si no le controla el script).
static void movePlayer(u16 keys, GBAActor* p) { moveTopDown(p, keys); }

static void updatePlayer(void) {
  GBAActor* p = &gActors[PLAYER_INDEX];
  int i;
  if (!p->hasCollider) return;
${hasCScripts
    ? '  // El jugador lo mueve tu script C (script_update) — el motor no duplica.'
    : '  {\n    u16 keys = ~REG_KEYINPUT & 0x3FF;\n    movePlayer(keys, p);\n  }'}
  // empuje actor-actor: el jugador resbala por el eje de menor intrusión
  for (i = 0; i < ACTOR_COUNT; i++) {
    GBAActor* b = &gActors[i];
    s16 ax, ay, aw, ah, bx, by, bw, bh;
    s16 pushX, pushY;
    if (b == p || !b->hasCollider) continue;
    actorBox(p, &ax, &ay, &aw, &ah);
    actorBox(b, &bx, &by, &bw, &bh);
    if (!rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh)) continue;
    pushX = ax < bx ? ax + aw - bx : bx + bw - ax;
    pushY = ay < by ? ay + ah - by : by + bh - ay;
    if (pushX < pushY) p->x += (ax < bx) ? -pushX : pushX;
    else p->y += (ay < by) ? -pushY : pushY;
  }
}
`;

  return images.length === 0 ? '' : `
// ── Actores (sprites software sobre MODE 3) ─────────────────────────────
#define MAX_ACTOR_FRAMES 32
#define ACTOR_COUNT ${Math.min(actors.length, 64)}
#define PLAYER_INDEX 0

#ifndef REG_KEYINPUT
#define REG_KEYINPUT (*(volatile u16*)0x04000130)
#endif
#ifndef CAM_X
#define CAM_X 0
#endif
#ifndef CAM_Y
#define CAM_Y 0
#endif

typedef struct {
  const u16* img;
  u16 w, h;
} GBAFrame;

typedef struct {
  s16 x, y;         // posición top-left (relativa a cámara)
  s16 z;            // orden de dibujo (asc)
  u16 w, h;         // tamaño del sprite
  s16 prevX, prevY; // rect anterior pintado (para borrar rastros de movimiento)
  u16 prevW, prevH; // tamaño del frame anterior pintado
  u8 hasCollider;   // 1 si usa colisiones
  u16 cw, ch;       // tamaño del collider (centrado en el sprite)
  s16 cox, coy;     // desplazamiento px del collider respecto al centro
  u8 hasArea;       // 1 si tiene zona de detección (rect que sigue al actor)
  u16 aw, ah;       // tamaño del área (centrada en el sprite)
  s16 aox, aoy;     // desplazamiento px del área respecto al centro
  u32 areaInside;   // bitmask de actores dentro del área este frame
  u32 areaWas;      // bitmask del frame anterior (para el flanco de entrada/salida)
  s16 vx, vy;       // velocidad (px/vsync) usada por física
  s8 face;          // 1 mira a la derecha, 0 a la izquierda
  u8 coyote;        // vsyncs desde el último suelo (salto con margen)
  u8 jumpBuf;       // vsyncs que un salto queda pendiente de aterrizaje
  u8 jumpHeld;      // A sigue pulsado (para armar el buffer solo al pulsar)
  const GBAFrame* frames[MAX_ACTOR_FRAMES];
  u16 delays[MAX_ACTOR_FRAMES];
  u8 frameCount;
  u8 mode;          // 0 once, 1 loop, 2 pingpong
  u8 frame;
  u8 prevFrame;     // frame del último pase de dibujo (para borrado de animación)
  s8 dir;
  u16 timer;
  u8 animSpeed;     // paso por vsync del avance de animación (0/1 = cadencia exacta). Lo pone el script.
} GBAActor;

${imageArr.join('\n')}

static const GBAFrame gFrames[${images.length}] = {
${poolArr.join(',\n')}
};

static GBAActor gActors[ACTOR_COUNT];
// Snapshot del fondo en EWRAM (256KB) — no cabe en IWRAM (32KB)
static u16 gActorBack[PIXEL_COUNT] __attribute__((section(".ewram"), aligned(4)));
// Backbuffer: el frame se dibuja aquí durante el tiempo de frame ACTIVO y SOLO
// se copia a VRAM en el VBLANK. Así ningún estallido de erase/paint puede cortar
// una línea visible en mGBA/hardware (parpadeo del actor que se mueve).
static u16 gBackBuf[PIXEL_COUNT] __attribute__((section(".ewram"), aligned(4)));
// 1 = hay que copiar el backbuffer a VRAM (algo cambió); 0 = escena igual al
// frame anterior (no se blitea ni se re-dibuja → máximo margen de VBLANK/CPU)
static int gDirty = 1;
// Rectángulo cambiado este frame: SOLO esa zona se copia de gBackBuf a VRAM.
// Al caminar son ~750px (el rect del actor) en vez de los 38400 de la pantalla
// completa → el coste por frame cae ~50x (gbajs rápido, hardware con margen).
static s16 gDirtyX0 = 0, gDirtyY0 = 0, gDirtyX1 = 239, gDirtyY1 = 159;

// Copia a VRAM (dentro del VBLANK) solo el rectángulo que cambió.
static void blitDirtyRect(void) {
  int y;
  if (gDirtyX1 < gDirtyX0 || gDirtyY1 < gDirtyY0) return;
  for (y = gDirtyY0; y <= gDirtyY1; y++) {
    int x;
    u16* dst = &((u16*)VRAM)[y * 240];
    const u16* src = &gBackBuf[y * 240];
    for (x = gDirtyX0; x <= gDirtyX1; x++) dst[x] = src[x];
  }
}

// Render por software con 2 pases por frame (borrar + pintar).
//
// Pase 1 — eraseActorRect: restaura del fondo (gActorBack) lo que este actor
// pintó el frame pasado y que este frame ya no debe pintar.
//
//  - Actor MOVIO (o cambió de tamaño): restaurar TODO el rect anterior. Es
//    OBLIGATORIO restaurar el rect completo (no solo las franjas fuera del
//    actual): los píxeles donde el frame nuevo es transparente NO se repintan
//    en el pase de dibujo (se saltan), y si no se restauraran aquí quedaría el
//    residuo opaco del frame anterior (frames fantasma).
//  - Actor quieto con animación: solo hay que restaurar los píxeles donde el
//    frame ANTERIOR era opaco y el NUEVO es transparente (la «diferencia» de la
//    animación). Esto evita restaurar todo el rect: cuando los 5 actores
//    avanzan de frame a la vez, el borrado es de muy pocos píxeles y no se
//    supera el presupuesto de VBLANK (evita el parpadeo).
//  - Actor quieto en el MISMO frame: no hay nada que restaurar.
//
// Pase 2 — drawActorRect: pinta SOLO los píxeles opacos (transparente = saltar,
// dejar ver al actor de menor z o la escena). Graba prevX/Y/W/H/prevFrame para
// el borrado del siguiente frame.
static void eraseActorRect(const GBAActor* a, u16* screen) {
  const GBAFrame* cf = a->frames[a->frame];
  if (a->prevX == a->x && a->prevY == a->y &&
      a->prevW == cf->w && a->prevH == cf->h) {
    // Quieto y mismo tamaño: borrado por diferencia de animación.
    if (a->prevFrame == a->frame) return;
    {
      const GBAFrame* pf = a->frames[a->prevFrame];
      int y, x;
      int ex0 = a->x, ey0 = a->y;
      int ex1 = ex0 + (int)cf->w - 1, ey1 = ey0 + (int)cf->h - 1;
      if (ex0 < 0) ex0 = 0;
      if (ey0 < 0) ey0 = 0;
      if (ex1 >= SCREEN_W) ex1 = SCREEN_W - 1;
      if (ey1 >= SCREEN_H) ey1 = SCREEN_H - 1;
      if (ex0 > ex1 || ey0 > ey1) return;
      for (y = ey0; y <= ey1; y++) {
        u16* sp = &screen[y * SCREEN_W + ex0];
        const u16* pb = &gActorBack[y * SCREEN_W + ex0];
        const u16* old = &pf->img[(y - a->y) * pf->w + (ex0 - a->x)];
        const u16* now = &cf->img[(y - a->y) * cf->w + (ex0 - a->x)];
        for (x = ex0; x <= ex1; x++, sp++, pb++, old++, now++) {
          if ((*old & 0x8000) == 0 && (*now & 0x8000) != 0) *sp = *pb;
        }
      }
    }
    return;
  }
  {
    // Actor en movimiento/cambio de tamaño: restaurar SOLO los píxeles donde el
    // frame anterior era OPACO (lo único que este actor pintó). NO se toca lo
    // que era transparente: puede haber otros actores debajo (el de menor z) y
    // no deben quedar "quemados" con el fondo — si se restaurara el rect entero,
    // el actor que pasa por encima de un NPC le pisaría sus píxeles y mGBA lo
    // muestra como parpadeo.
    const GBAFrame* pf = a->frames[a->prevFrame];
    int y, x;
    int ex0 = a->prevX, ey0 = a->prevY;
    int ex1 = ex0 + (int)a->prevW - 1, ey1 = ey0 + (int)a->prevH - 1;
    if (ex0 < 0) ex0 = 0;
    if (ey0 < 0) ey0 = 0;
    if (ex1 >= SCREEN_W) ex1 = SCREEN_W - 1;
    if (ey1 >= SCREEN_H) ey1 = SCREEN_H - 1;
    if (ex0 > ex1 || ey0 > ey1) return;
    for (y = ey0; y <= ey1; y++) {
      u16* sp = &screen[y * SCREEN_W + ex0];
      const u16* pb = &gActorBack[y * SCREEN_W + ex0];
      const u16* old = &pf->img[(y - a->prevY) * pf->w + (ex0 - a->prevX)];
      for (x = ex0; x <= ex1; x++, sp++, pb++, old++) {
        if ((*old & 0x8000) == 0) *sp = *pb;
      }
    }
  }
}

// Pintado con transparencia REAL: donde el sprite es transparente NO se
// escribe, dejando ver al actor de detrás (menor z) o la escena. El rastro
// del frame anterior ya lo limpia eraseActorRect antes de pintar.
static void drawActorRect(GBAActor* a, u16* screen) {
  const GBAFrame* f = a->frames[a->frame];
  int x0 = a->x, y0 = a->y;
  int x1 = x0 + f->w - 1, y1 = y0 + f->h - 1;
  if (x0 < 0) x0 = 0;
  if (y0 < 0) y0 = 0;
  if (x1 >= SCREEN_W) x1 = SCREEN_W - 1;
  if (y1 >= SCREEN_H) y1 = SCREEN_H - 1;
  if (x0 > x1 || y0 > y1) { a->prevX = a->x; a->prevY = a->y; a->prevW = f->w; a->prevH = f->h; a->prevFrame = a->frame; return; }
  {
    int y, x;
    for (y = y0; y <= y1; y++) {
      u16* sp = &screen[y * SCREEN_W + x0];
      const u16* pimg = &f->img[(y - a->y) * f->w + (x0 - a->x)];
      for (x = x0; x <= x1; x++, sp++, pimg++) {
        u16 px = *pimg;
        if (px & 0x8000) continue; // transparente: no escribir
        *sp = px;
      }
    }
  }
  a->prevX = a->x; a->prevY = a->y; a->prevW = f->w; a->prevH = f->h; a->prevFrame = a->frame;
}

// Presentación durante el fade: transparente = NO escribir (deja ver la escena
// fundida), no depende de gActorBack.
static void drawActorRectOpaque(GBAActor* a, u16* screen) {
  const GBAFrame* f = a->frames[a->frame];
  int x0 = a->x, y0 = a->y;
  int x1 = x0 + f->w - 1, y1 = y0 + f->h - 1;
  if (x0 < 0) x0 = 0;
  if (y0 < 0) y0 = 0;
  if (x1 >= SCREEN_W) x1 = SCREEN_W - 1;
  if (y1 >= SCREEN_H) y1 = SCREEN_H - 1;
  if (x0 > x1 || y0 > y1) { a->prevX = a->x; a->prevY = a->y; a->prevW = f->w; a->prevH = f->h; a->prevFrame = a->frame; return; }
  {
    int y, x;
    for (y = y0; y <= y1; y++) {
      u16* sp = &screen[y * SCREEN_W + x0];
      const u16* pimg = &f->img[(y - a->y) * f->w + (x0 - a->x)];
      for (x = x0; x <= x1; x++, sp++, pimg++) {
        u16 px = *pimg;
        if (px & 0x8000) continue; // transparente: no escribir
        *sp = px;
      }
    }
  }
  a->prevX = a->x; a->prevY = a->y; a->prevW = f->w; a->prevH = f->h; a->prevFrame = a->frame;
}

static void drawAllActorsOpaque(u16* screen) {
  int i;
  for (i = 0; i < ACTOR_COUNT; i++) drawActorRectOpaque(&gActors[i], screen);
}

static void advanceAllActors(void) {
  int i;
  GBAActor* a;
  // Cadencia de animación controlada por el script: cada vsync el timer avanza
  // "a->animSpeed" ticks (0 o 1 = cadencia exacta del delay; 2 = doble; ...).
  // El script pone gSelf->animSpeed (p.ej. subirlo al caminar y bajarlo al
  // soltar). NO hay boost automático: por defecto TODO va a la cadencia exacta
  // de su delay, tanto en reposo como caminando.
  for (i = 0; i < ACTOR_COUNT; i++) {
    a = &gActors[i];
    if (a->frameCount <= 1) continue;
    a->timer += (a->animSpeed > 1) ? a->animSpeed : 1;
    if (a->timer < a->delays[a->frame]) continue;
    a->timer = 0;
    if (a->mode == 0) {
      if (a->frame < a->frameCount - 1) a->frame++;
    } else if (a->mode == 1) {
      a->frame = (a->frame + 1) % a->frameCount;
    } else {
      a->frame += a->dir;
      if (a->frame <= 0) { a->frame = 0; a->dir = 1; }
      if (a->frame >= a->frameCount - 1) { a->frame = a->frameCount - 1; a->dir = -1; }
    }
  }
}

static int paintKey(int idx) {
  int z = gActors[idx].z;
  return z * 2 + (idx == PLAYER_INDEX ? 1 : 0);
}

static void drawAllActors(u16* screen, int filterDirty) {
  int order[ACTOR_COUNT];
  int i, j, n = 0;
  // Solo se borran/pintan los actores que cambian este frame o cuyo rect se
  // solapa con el rect sucio (la zona de pantalla que va a cambiar). Los que
  // quedan fuera ya están pintados correctamente en gBackBuf de frames
  // anteriores → ni borrado ni pintado (coste ~0 por actor estático al caminar).
  for (i = 0; i < ACTOR_COUNT; i++) {
    const GBAActor* a = &gActors[i];
    if (filterDirty) {
      int px0 = a->prevX, py0 = a->prevY, px1 = a->prevX + a->prevW, py1 = a->prevY + a->prevH;
      int cx0 = a->x, cy0 = a->y, cx1 = a->x + a->w, cy1 = a->y + a->h;
      int dx0 = gDirtyX0, dy0 = gDirtyY0, dx1 = gDirtyX1, dy1 = gDirtyY1;
      if (dx1 >= dx0 && dy1 >= dy0) {
        int pIn = px0 <= dx1 && px1 >= dx0 && py0 <= dy1 && py1 >= dy0;
        int cIn = cx0 <= dx1 && cx1 >= dx0 && cy0 <= dy1 && cy1 >= dy0;
        if (!pIn && !cIn) continue;
      }
    }
    order[n++] = i;
    eraseActorRect(&gActors[i], screen);
  }
  // Orden de pintado por z ASC; entre iguales z, el jugador va por DELANTE
  // (se pinta al final) para que no desaparezca al cruzarse con un NPC.
  for (i = 1; i < n; i++) {
    int key = order[i];
    int zkey = paintKey(key);
    for (j = i - 1; j >= 0 && paintKey(order[j]) > zkey; j--) order[j + 1] = order[j];
    order[j + 1] = key;
  }
  for (i = 0; i < n; i++) drawActorRect(&gActors[order[i]], screen);
}

// ¿Este actor ha cambiado de sitio, de frame o de tamaño respecto al frame
// anterior? Es el predicado que decide si su rect entra en la zona sucia.
static int actorChanged(const GBAActor* a) {
  return a->x != a->prevX || a->y != a->prevY || a->frame != a->prevFrame
      || a->w != a->prevW || a->h != a->prevH;
}

// ¿Hay algo que re-pintar este frame? (posición o frame de animación cambiaron)
static int actorsChanged(void) {
  int i;
  for (i = 0; i < ACTOR_COUNT; i++) {
    if (actorChanged(&gActors[i])) return 1;
  }
  return 0;
}

// Unión de los rects (anterior ∪ actual) de los actores QUE HAN CAMBIADO → la
// zona de VRAM que hay que copiar a gBackBuf. Se llama ANTES de drawAllActors
// (que actualiza prev*).
//
// Solo entran los actores cambiados: al caminar solo se mueve el jugador, así
// que la zona sucia es su rect (unos 23x33 px) en vez del bounding box de TODOS
// los actores (puede ser 79x88 = 6952 px con 4 actores juntos), y el blit se
// abarata ~9x. Los actores quietos que se solapan con esa zona NO se incluyen
// aquí, pero drawAllActors los repinta igual porque su rect intersecta el
// rect sucio (filterDirty) — por eso al moverse el jugador se sigue viendo el
// NPC que tenía tapado.
static void computeDirtyRect(void) {
  int i;
  gDirtyX0 = 240; gDirtyY0 = 160; gDirtyX1 = -1; gDirtyY1 = -1;
  for (i = 0; i < ACTOR_COUNT; i++) {
    const GBAActor* a = &gActors[i];
    int x0, y0, x1, y1, xx, yy;
    if (!actorChanged(a)) continue;
    x0 = a->prevX < a->x ? a->prevX : a->x;
    y0 = a->prevY < a->y ? a->prevY : a->y;
    x1 = a->prevX + a->prevW;               // rect anterior (tamaño prevW)
    xx = a->x + a->w;                       // rect actual
    if (xx > x1) x1 = xx;
    y1 = a->prevY + a->prevH;
    yy = a->y + a->h;
    if (yy > y1) y1 = yy;
    if (x0 < 0) x0 = 0;
    if (y0 < 0) y0 = 0;
    if (x1 > 240) x1 = 240;
    if (y1 > 160) y1 = 160;
    if (x1 <= x0 || y1 <= y0) continue;
    if (x0 < gDirtyX0) gDirtyX0 = (s16)x0;
    if (y0 < gDirtyY0) gDirtyY0 = (s16)y0;
    if (x1 - 1 > gDirtyX1) gDirtyX1 = (s16)(x1 - 1);
    if (y1 - 1 > gDirtyY1) gDirtyY1 = (s16)(y1 - 1);
  }
}

static void initActors(void) {
${perActorCode.join('\n')}
}
${playerDemo}
`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Export MULTIESCENA: embebe TODAS las escenas del proyecto en la ROM y genera
// el runtime para cambiar de escena en caliente.
//
//  - `switchScene(n)` (llamable desde script C) hace fade a negro → carga la
//    escena n → fade desde negro. El índice n es el ORDEN en el editor
//    (state.scenes), el mismo orden del array `scenes` que llega aquí.
//  - Cada escena lleva su propia imagen/color, mapa de colisión+cam y actores.
//  - Primitivas de interacción para scripts: `near(a,b,dist)` y el flanco de
//    teclas global `gJp` (bits como REG_KEYINPUT, 0=pulsado) actualizado CADA
//    frame — para "si estoy cerca y pulso A, cambio de escena".
//  - La escena tras el splash es `startSceneId` (índice SCENE_START), y su
//    imagen se emite con el nombre legacy `sceneData` para que las transiciones
//    de entrada/salida (fades y tileset) sigan funcionando sin cambios.
// ─────────────────────────────────────────────────────────────────────────────
function generateGBAProjectMulti(
  state: EditorState,
  name: string,
  author: string,
  log: ExportLog,
  splashImageCArray?: string,
  splashDuration?: number,
  splashSong?: Song,
  sceneSong?: Song,
  entryTilesetCArray?: string,
  entryTileSize?: number,
  entryTilesetFrames?: number,
  entryTilesetSpeed?: number,
  entryTilesetFw?: number,
  entryTilesetFh?: number,
  exitTilesetCArray?: string,
  exitTileSize?: number,
  exitTilesetFrames?: number,
  exitTilesetSpeed?: number,
  exitTilesetFw?: number,
  exitTilesetFh?: number,
  exitTransitionDuration?: number,
  exitGradientCArray?: string | null,
  exitGradientW?: number,
  exitGradientH?: number,
  entryGradientCArray?: string | null,
  entryGradientW?: number,
  entryGradientH?: number,
  entryTransitionType?: string,
  exitTransitionType?: string,
  multiScenes?: GBAMultiScenes,
): string {
  log.add(`Generando proyecto GBA (multi-escena): ${name}`);
  log.add(`Autor: ${author}`);

  const { scenes: scenesArg, startSceneId } = multiScenes || { scenes: [], startSceneId: '' };
  const scenes = scenesArg;
  const sceneCount = scenes.length;
  let startIdx = scenes.findIndex((sc) => sc.id === startSceneId);
  if (startIdx < 0) {
    log.warn(`startSceneId "${startSceneId}" no está en la lista de escenas — usando índice 0`);
    startIdx = 0;
  }

  const hasSplash = splashImageCArray && splashDuration && splashDuration > 0;
  const hasMusic = splashSong && splashSong.patterns.length > 0 && splashSong.patterns.some((p) => p.rows.length > 0);
  const hasSceneMusic = sceneSong && sceneSong.patterns.length > 0 && sceneSong.patterns.some((p) => p.rows.length > 0);

  const entryType = entryTransitionType || 'fade';
  const exitType = exitTransitionType || 'fade';
  const hasCustomEntry = !!(entryTilesetCArray && entryTilesetFrames && entryTilesetFw && entryTilesetFh && entryTileSize);
  const hasCustomExit = !!(exitTilesetCArray && exitTilesetFrames && exitTilesetFw && exitTilesetFh && exitTileSize);
  const hasEntry = entryType !== 'instant' && (entryType === 'fade' || hasCustomEntry);
  const hasExit = exitType !== 'instant' && (exitType === 'fade' || hasCustomExit);
  const hasTransition = hasEntry || hasExit;
  const entryTotalFrames = Math.round((entryTilesetSpeed ?? 5) * 60);
  const exitTotalFrames = Math.round((exitTilesetSpeed ?? 5) * 60);
  const totalFrames = Math.max(entryTotalFrames, exitTotalFrames);
  const tilesForGradW = Math.ceil(240 / (exitTileSize ?? 8));
  const tilesForGradH = Math.ceil(160 / (exitTileSize ?? 8));

  function hexColor(cssColor: string): number {
    let hex = cssColor.replace('#', '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    const r = parseInt(hex.slice(0,2), 16);
    const g = parseInt(hex.slice(2,4), 16);
    const b = parseInt(hex.slice(4,6), 16);
    return ((r>>3) | ((g>>3)<<5) | ((b>>3)<<10)) & 0x7FFF;
  }

  function getCoverCall(): string {
    if (entryType === 'fade') return `fadeToScene(sceneData, ${entryTotalFrames})`;
    if (entryType === 'custom' && hasCustomEntry) return `runToBlack_Entry(sceneData, ${totalFrames})`;
    return '';
  }
  function getRevealCall(): string {
    if (exitType === 'fade') return `fadeToBlack(sceneData, ${exitTotalFrames})`;
    if (exitType === 'custom' && hasCustomExit) return `runToScene_Exit(sceneData, ${totalFrames})`;
    if (entryType === 'custom' && hasCustomEntry) return `runToScene_Entry(sceneData, ${totalFrames})`;
    return '';
  }

  // ── Scripts de usuario (C ó AdvanceCode), con bindings POR ESCENA ──────
  // Los scripts en modo 'language' se transpilan 1:1 a C; si el AdvanceCode
  // tiene errores se listan y el script NO entra a la ROM.
  const cScripts: any[] = [];
  const scriptC = new Map<string, ACodTranspileResult>();
  (state.scripts ?? []).forEach((s: any) => {
    if (!s) return;
    const raw = s.mode === 'language' ? (s.language ?? '') : (s.cCode ?? '');
    if (typeof raw !== 'string' || raw.trim().length === 0) return;
    const r = scriptEffectiveCCode(s);
    if (s.mode === 'language') {
      if (r.ok) {
        r.warnings.forEach((w) => log.warn(`AdvanceCode "${s.name ?? 'sin nombre'}": ${w}`));
      } else {
        r.errors.forEach((e) => log.error(`AdvanceCode "${s.name ?? 'sin nombre'}": ${e}`));
        log.error(`Script "${s.name ?? 'sin nombre'}": errores de AdvanceCode — NO se incluye en la ROM`);
      }
    }
    scriptC.set(s.id, r);
    if (r.ok && r.code.trim().length > 0) cScripts.push(s);
  });
  const hasCScripts = cScripts.length > 0;
  const allAssignedIds = new Set<string>();
  scenes.forEach((sc) => sc.actors.forEach((a) => { if (a.scriptId) allAssignedIds.add(a.scriptId); }));
  const activeScripts = cScripts.filter((s: any) => allAssignedIds.has(s.id));
  const anyActiveNeedsAreas = activeScripts.some((s: any) => scriptC.get(s.id)?.needsAreas);
  const anyActiveNeedsEdge = activeScripts.some((s: any) => scriptC.get(s.id)?.needsEdge);
  cScripts.forEach((s: any) => {
    if (!allAssignedIds.has(s.id)) log.warn(`Script "${s.name ?? 'sin nombre'}" NO está asignado a ningún actor de ninguna escena — no se ejecuta`);
  });

  const DEF_FN = (nm: string) => new RegExp(`void\\s+${nm}\\s*\\(\\s*(?:void)?\\s*\\)`);

  // ── Pool de imágenes de sprite única (dedupe entre TODAS las escenas) ──
  const allActorFrames = scenes.flatMap((sc) => sc.actors.slice(0, 64).flatMap((a) => a.frames));
  const images: GBAExportedActorFrame[] = [];
  const imageIdx = new Map<string, number>();
  allActorFrames.forEach((f) => {
    const key = `${f.w}x${f.h}:${f.pixels.join(',')}`;
    if (!imageIdx.has(key)) {
      imageIdx.set(key, images.length);
      images.push(f);
    }
  });

  const maxActors = Math.max(1, ...scenes.map((sc) => Math.min(sc.actors.length, 64)));

  function actorConfig(a: GBAExportedActor, ai: number): string {
    const animFrames = a.frames.map((f) => imageIdx.get(`${f.w}x${f.h}:${f.pixels.join(',')}`)!);
    const delaysArr = a.delays.map((d) => String(Math.max(1, Math.round(d))));
    const mode = a.mode === 'once' ? 0 : a.mode === 'pingpong' ? 2 : 1;
    return `  gActors[${ai}].x = ${a.x};
  gActors[${ai}].y = ${a.y};
  gActors[${ai}].z = ${Math.max(0, a.z)};
  gActors[${ai}].w = ${a.w};
  gActors[${ai}].h = ${a.h};
  gActors[${ai}].prevX = ${a.x};
  gActors[${ai}].prevY = ${a.y};
  gActors[${ai}].prevW = ${a.w};
  gActors[${ai}].prevH = ${a.h};
  gActors[${ai}].hasCollider = ${a.collider ? 1 : 0};
  gActors[${ai}].cw = ${a.collider ? Math.max(1, Math.round(a.colliderW ?? a.w)) : 0};
  gActors[${ai}].ch = ${a.collider ? Math.max(1, Math.round(a.colliderH ?? a.h)) : 0};
  gActors[${ai}].cox = ${a.colliderOffsetX ?? 0};
  gActors[${ai}].coy = ${a.colliderOffsetY ?? 0};
  gActors[${ai}].hasArea = ${a.hasArea ? 1 : 0};
  gActors[${ai}].aw = ${a.hasArea ? Math.max(1, Math.round(a.areaW ?? a.w)) : 0};
  gActors[${ai}].ah = ${a.hasArea ? Math.max(1, Math.round(a.areaH ?? a.h)) : 0};
  gActors[${ai}].aox = ${a.areaOffsetX ?? 0};
  gActors[${ai}].aoy = ${a.areaOffsetY ?? 0};
  gActors[${ai}].areaInside = 0;
  gActors[${ai}].areaWas = 0;
  gActors[${ai}].frameCount = ${a.frames.length};
  gActors[${ai}].mode = ${mode};
  gActors[${ai}].frame = 0;
  gActors[${ai}].prevFrame = 0;
  gActors[${ai}].timer = (u16)(${ai} * 7); // desfasa los avances de animación
  gActors[${ai}].dir = 1;
  gActors[${ai}].face = 1;
  gActors[${ai}].coyote = 0;
  gActors[${ai}].jumpBuf = 0;
  gActors[${ai}].jumpHeld = 0;
  gActors[${ai}].animSpeed = 0;
  {
    int fi;
    u16 srcDelays[${a.frames.length}] = { ${delaysArr.join(', ')} };
    u16 srcFrames[${a.frames.length}] = { ${animFrames.join(', ')} };
    for (fi = 0; fi < ${a.frames.length}; fi++) {
      gActors[${ai}].frames[fi] = &gFrames[srcFrames[fi]];
      gActors[${ai}].delays[fi] = srcDelays[fi];
    }
  }`;
  }

  const imageArr = images.map((img, i) => `static const u16 gSprImg${i}[${img.w * img.h}] = {\n  ${cHexList(img.pixels)},\n};`);
  const poolArr = images.map((img, i) => `    { gSprImg${i}, ${img.w}, ${img.h} }`);

  const sceneActorsFns = scenes.map((sc, si) => {
    const configs = sc.actors.slice(0, 64).map((a, ai) => actorConfig(a, ai));
    const body = configs.length ? '\n' + configs.join('\n') + '\n' : '\n';
    return `static void sceneInitActors_${si}(void) {
  memset(gActors, 0, sizeof(gActors));${body}}`;
  });

  // ── Script dispatchers por escena ───────────────────────────────────────
  const scriptBodies: string[] = [];
  const scriptFnInits: string[] = [];
  const scriptFnUpds: string[] = [];
  {
    activeScripts.forEach((s: any, i: number) => {
      const tag = `script_u${i}`;
      const r = scriptC.get(s.id)!;
      const raw = r.code.trimEnd();
      const hasUpd = r.hasUpdate;
      const body = raw
        .replace(/\bscript_init\b\s*\(/g, `${tag}_init(`)
        .replace(/\bscript_update\b\s*\(/g, `${tag}_update(`);
      // Texto pegado por error: se avisa aquí, antes de que el gcc lo entierre
      // entre veinte líneas de warnings.
      const textoPegado = lineasDeTextoPegado(raw);
      if (textoPegado.length > 0) {
        log.add(
          `[ERROR] Script "${s.name}" línea(s) ${textoPegado.join(', ')} parecen texto explicativo, no código C. ` +
          `Borra el texto que rodea al ejemplo y pega solo el código (void script_init / void script_update).`
        );
      }

      if (!hasUpd) log.warn(`Script "${s.name}": no define script_update() — no hará nada cada frame`);
      scriptBodies.push(`// ── Script ${i + 1}: ${s.name ?? 'sin nombre'}\n${body}`);
    });
    scenes.forEach((sc, si) => {
      const inits: string[] = [];
      const upds: string[] = [];
      sc.actors.slice(0, 64).forEach((a, ai) => {
        if (!a.scriptId) return;
        const i = activeScripts.findIndex((x: any) => x.id === a.scriptId);
        if (i < 0) return;
        const s = activeScripts[i];
        const tag = `script_u${i}`;
        const r = scriptC.get(s.id)!;
        if (r.hasInit) inits.push(`  gSelf = &gActors[${ai}];\n  ${tag}_init();`);
        if (r.hasUpdate) upds.push(`    gSelf = &gActors[${ai}];\n    ${tag}_update();`);
      });
      if (inits.length) log.add(`Escena "${sc.name}": script en gActors[${inits.map((x) => x.match(/gActors\[(\d+)\]/)![1]).join(', ')}]`);
      scriptFnInits.push(`static void sceneScriptInit_${si}(void) {\n${inits.length ? inits.join('\n') : '  // sin scripts asignados'}\n}`);
      scriptFnUpds.push(`static void sceneScriptUpdate_${si}(void) {\n${upds.length ? upds.join('\n') : '  // sin scripts asignados'}\n}`);
    });
  }

  // ── Nombres de arrays por índice ────────────────────────────────────────
  const imgName = (si: number) => (si === startIdx ? 'sceneData' : `sceneData_${si}`);
  const imgNames = scenes.map((_, si) => imgName(si));
  const colNames = scenes.map((sc, si) =>
    (sc.collisionMap && sc.collisionMap.length > 0 && sc.collisionMap[0].length > 0) ? `gColFlat_${si}` : '0');
  const colCols = scenes.map((sc) => (sc.collisionMap && sc.collisionMap.length && sc.collisionMap[0].length) ? sc.collisionMap[0].length : 0);
  const colRows = scenes.map((sc) => (sc.collisionMap && sc.collisionMap.length) ? sc.collisionMap.length : 0);
  const colTiles = scenes.map((sc) => sc.collisionTileSize || 8);
  const camXs = scenes.map((sc) => Math.round(sc.camX || 0));
  const camYs = scenes.map((sc) => Math.round(sc.camY || 0));

  // ── Áreas de actor: runtime si algún script las usa o algún actor las tiene ─
  const anyActorHasArea = scenes.some((sc) => sc.actors.some((a: any) => a.hasArea));
  const needsAreaRuntime = anyActiveNeedsAreas || anyActorHasArea;

  // ── Construcción del C ─────────────────────────────────────────────────
  let c = `/*
 * ${name} — Generado por Advance Engine
 * Author: ${author}
 * Fecha: ${new Date().toISOString()}
 * MODE: multi-escena (${sceneCount} escenas embebidas, switchScene(n) disponible)
 */

#include <gba.h>
#include <string.h>

#define SCREEN_W 240
#define SCREEN_H 160
#define PIXEL_COUNT (SCREEN_W * SCREEN_H)

static void waitVSync(void) {
  while (REG_VCOUNT >= SCREEN_H);
  while (REG_VCOUNT < SCREEN_H);
}

// ── Runtime de escenas ───────────────────────────────────────────────────────
// gScene: escena actual. switchScene(n) pide cambiar (índice = orden en el
// editor); el bucle la carga en el siguiente frame con fade a negro y desde
// negro. gCol*/gCam* son los datos de la escena ACTUAL (cambian al cambiar).
static int gScene = 0;
static int gSceneTarget = -1;
static const u8* gColMap = 0;
static u16 gColCols = 0, gColRows = 0, gColTile = 8;
static s16 gCamX = 0, gCamY = 0;
// Flanco de teclas: gJp tiene SOLO los bits pulsados ESTE frame (para
// interacción: "pulsé A ahora"). Bits como REG_KEYINPUT (0 = pulsado).
static u16 gKeysPrev = 0, gJp = 0;
#define SCENE_SWITCH_FRAMES 60

static void initActors(void);
static void drawAllActors(u16* screen, int filterDirty);
static void drawAllActorsOpaque(u16* screen);

// ── Fades (siempre presentes: los usa switchScene) ────────────────────────
static void fadeToScene(const u16* scene, int totalFrames) {
  u16* screen = (u16*)VRAM;
  int i, p;
  initActors();
  for (i = 0; i < totalFrames; i++) {
    int t = i + 1;
    for (p = 0; p < PIXEL_COUNT; p++) {
      u16 s = scene[p];
      int r = (s & 0x1F) * t / totalFrames;
      int g = ((s >> 5) & 0x1F) * t / totalFrames;
      int b = ((s >> 10) & 0x1F) * t / totalFrames;
      screen[p] = r | (g << 5) | (b << 10);
    }
    drawAllActorsOpaque(screen);
    waitVSync();
  }
}

static void fadeToBlack(const u16* scene, int totalFrames) {
  u16* screen = (u16*)VRAM;
  int i, p;
  (void)scene;
  for (i = 0; i < totalFrames; i++) {
    for (p = 0; p < PIXEL_COUNT; p++) {
      u16 cur = screen[p];
      int r = (cur & 0x1F) * (totalFrames - i) / totalFrames;
      int g = ((cur >> 5) & 0x1F) * (totalFrames - i) / totalFrames;
      int b = ((cur >> 10) & 0x1F) * (totalFrames - i) / totalFrames;
      screen[p] = r | (g << 5) | (b << 10);
    }
    waitVSync();
  }
}
`;

  if (hasSplash) {
    c += `
// ── Splash Screen ─────────────────────────────────────────────────────
#define SPLASH_DURATION ${splashDuration}

const u16 splashScreenData[PIXEL_COUNT] = ${splashImageCArray};
`;
  }

  // ── Imágenes de escena (todas; la de inicio se llama sceneData) ────────
  c += `
// ── Escenas (imágenes) ────────────────────────────────────────────────
#define SCENE_COUNT ${sceneCount}
`;
  scenes.forEach((sc, si) => {
    const nm = imgName(si);
    if (sc.imageCArray) {
      c += `const u16 ${nm}[PIXEL_COUNT] = ${sc.imageCArray};
`;
    } else {
      const hex = `0x${hexColor(sc.color || '#1e1e24').toString(16).padStart(4, '0')}`;
      c += `const u16 ${nm}[PIXEL_COUNT] = { [0 ... PIXEL_COUNT-1] = ${hex} };
`;
    }
  });

  scenes.forEach((sc, si) => {
    if (!colNames[si].startsWith('gCol')) return;
    const ts = colTiles[si];
    const rows = colRows[si];
    const cols = colCols[si];
    const normalize = (v: number) =>
      (v === 0 || v === 6) ? v :
      (v === 1 || v === 2 || v === 3 || v === 4 || v === 5) ? v :
      1;
    const flat: string[] = [];
    sc.collisionMap!.forEach((row) => row.forEach((v) => flat.push(String(normalize(v)))));
    c += `
const u8 gColFlat_${si}[${rows * cols}] = {  // ${sc.name}
  ${flat.join(', ')}
};
`;
    log.add(`Escena "${sc.name}": colisión ${cols}x${rows} tiles (${ts}px)`);
  });

  c += `
// ── Registro de escenas (índice = orden en el editor) ────────────────────
static const u16* gSceneImg[SCENE_COUNT] = { ${imgNames.join(', ')} };
static const u8* gSceneCol[SCENE_COUNT] = { ${colNames.join(', ')} };
static const u16 gSceneCols[SCENE_COUNT] = { ${colCols.join(', ')} };
static const u16 gSceneRows[SCENE_COUNT] = { ${colRows.join(', ')} };
static const u16 gSceneTile[SCENE_COUNT] = { ${colTiles.join(', ')} };
static const s16 gSceneCamX[SCENE_COUNT] = { ${camXs.join(', ')} };
static const s16 gSceneCamY[SCENE_COUNT] = { ${camYs.join(', ')} };
`;

  c += generateSoundTypes();

  // Sonidos PCM (DMA direct sound): tabla global + índice por escena.
  const pcmSnd = generatePcmSoundData(state.sounds ?? []);
  c += pcmSnd.code;
  const splashSoundIdx = pcmSnd.meta.find((m) => m.id === state.splashSoundId)?.index ?? -1;
  const splashSoundLine = splashSoundIdx >= 0 ? `  soundPlay(${splashSoundIdx}, 1);\n` : '';
  const sceneSoundIdxs = scenes.map((sc) => pcmSnd.meta.find((m) => m.id === (sc as any).soundId)?.index ?? -1);
  pcmSnd.meta.forEach((m) => log.add(`Sonido PCM ${m.index}: "${m.name}" (${(m.bytes / 1024).toFixed(1)} KB, ${m.rate} Hz)${m.loop ? ' [bucle]' : ''}`));

  if (hasMusic) {
    c += generateSongData(splashSong!, '', pcmSnd.meta);
    log.add(`Cancion splash: "${splashSong!.name}" (${splashSong!.patterns.length} patrones)`);
  }
  // Música POR ESCENA: cada escena lleva su canción (_S<si>). Las que no
  // tienen, quedan en silencio (gSceneSongBpm[gScene] = 0 en la tabla).
  scenes.forEach((sc, si) => {
    const sg = sc.song;
    if (sg && sg.patterns.length > 0 && sg.patterns.some((p) => (p.rows ?? []).length > 0)) {
      c += generateSongData(sg, `_S${si}`, pcmSnd.meta);
      c += `
static void songStep_S${si}(int step) { playStep_S${si}(step); }
`;
      log.add(`Musica escena ${si} ("${sc.name}"): "${sg.name}" (${sg.patterns.length} patrones)`);
    }
  });
  if (!hasMusic && !scenes.some((sc) => sc.song)) log.add('Sin cancion de fondo para la ROM');

  if (entryType === 'custom' && hasCustomEntry) {
    c += generateTransitionData(
      entryTilesetCArray!, entryTileSize!,
      entryTilesetFrames!, entryTilesetSpeed ?? 5,
      entryTilesetFw!, entryTilesetFh!,
      'Entry',
      entryGradientCArray ?? null, entryGradientW ?? 0, entryGradientH ?? 0,
    );
    log.add(`Transicion de entrada (cover): ${entryTilesetFrames} frames, tile ${entryTileSize}px`);
  }
  if (exitType === 'custom' && hasCustomExit) {
    c += generateTransitionData(
      exitTilesetCArray!, exitTileSize!,
      exitTilesetFrames!, exitTilesetSpeed ?? 5,
      exitTilesetFw!, exitTilesetFh!,
      'Exit',
      exitGradientCArray ?? null, exitGradientW ?? tilesForGradW, exitGradientH ?? tilesForGradH,
    );
    log.add(`Transicion de salida (reveal): ${exitTilesetFrames} frames, tile ${exitTileSize}px`);
  }
  if (hasTransition) {
    if (entryType === 'fade') log.add(`Transicion de entrada (fade): ${entryTilesetSpeed ?? 5}s`);
    if (entryType === 'instant') log.add('Transicion de entrada: instantanea');
    if (exitType === 'fade') log.add(`Transicion de salida (fade): ${exitTilesetSpeed ?? 5}s`);
    if (exitType === 'instant') log.add('Transicion de salida: instantanea');
  }

  // ── Transiciones por conexión (las usa switchScene al cambiar de escena) ─
  const sceneIdToIndex = new Map<string, number>();
  scenes.forEach((sc, i) => sceneIdToIndex.set(sc.id, i));
  const connTrans = (multiScenes?.transitions ?? []).filter(
    (t) => sceneIdToIndex.has(t.fromSceneId) && sceneIdToIndex.has(t.toSceneId),
  );
  const isCustomTrans = (t: GBASceneTransition) =>
    t.type === 'custom' && !!t.tilesetCArray && !!t.tileSize && !!t.frames && !!t.fw && !!t.fh;
  connTrans.forEach((t, i) => {
    if (!isCustomTrans(t)) return;
    c += generateTransitionData(
      t.tilesetCArray!, t.tileSize!, t.frames!, t.durationSec || 5,
      t.fw!, t.fh!, `CT${i}`,
      t.gradientCArray ?? null, t.gradientW ?? 0, t.gradientH ?? 0,
    );
    log.add(`Transicion conexion "${t.name || `${t.fromSceneId}->${t.toSceneId}`}": ${t.frames} frames, tile ${t.tileSize}px`);
  });
  const nTrans = connTrans.length;
  const transArrSize = Math.max(1, nTrans);
  const transFrom = nTrans ? connTrans.map((t) => sceneIdToIndex.get(t.fromSceneId)!) : [0];
  const transTo = nTrans ? connTrans.map((t) => sceneIdToIndex.get(t.toSceneId)!) : [0];
  const transKind = nTrans ? connTrans.map((t) => (t.type === 'instant' ? 0 : t.type === 'fade' ? 1 : 2)) : [0];
  const transFrames = nTrans ? connTrans.map((t) => Math.max(1, Math.round((t.durationSec || 0.5) * 60))) : [0];
  const transName = nTrans ? connTrans.map((t) => JSON.stringify(t.name || '')) : ['""'];
  const transCover = nTrans ? connTrans.map((t, i) => (isCustomTrans(t) ? `runToBlack_CT${i}` : '0')) : ['0'];
  const transReveal = nTrans ? connTrans.map((t, i) => (isCustomTrans(t) ? `runToScene_CT${i}` : '0')) : ['0'];
  c += `
// ── Transiciones por conexion (switchScene) ──────────────────────────────
#define SCENE_TRANS_COUNT ${nTrans}
typedef void (*SceneTransFn)(const u16*, int);
static const s16 gTransFrom[${transArrSize}] = {${transFrom.join(', ')}};
static const s16 gTransTo[${transArrSize}] = {${transTo.join(', ')}};
static const u8 gTransKind[${transArrSize}] = {${transKind.join(', ')}};
static const int gTransFrames[${transArrSize}] = {${transFrames.join(', ')}};
static const char* const gTransName[${transArrSize}] = {${transName.join(', ')}};
static SceneTransFn const gTransCover[${transArrSize}] = {${transCover.join(', ')}};
static SceneTransFn const gTransReveal[${transArrSize}] = {${transReveal.join(', ')}};

static int strEq(const char* a, const char* b) {
  if (!a || !b) return 0;
  while (*a && *b) { if (*a != *b) return 0; a++; b++; }
  return *a == *b;
}
static int findTransition(int from, int to, const char* name) {
  int i, fallback = -1;
  for (i = 0; i < SCENE_TRANS_COUNT; i++) {
    if (gTransFrom[i] != from || gTransTo[i] != to) continue;
    if (name) { if (strEq(gTransName[i], name)) return i; }
    else if (fallback < 0) fallback = i;
  }
  return fallback;
}
`;

  // ── Motor de actores (datos por escena: gCol*/gCam* en runtime) ───────
  c += `
// ── Actores (sprites software sobre MODE 3) ─────────────────────────────
#define MAX_ACTOR_FRAMES 32
#define ACTOR_COUNT ${maxActors}
#define PLAYER_INDEX 0

#ifndef REG_KEYINPUT
#define REG_KEYINPUT (*(volatile u16*)0x04000130)
#endif

typedef struct {
  const u16* img;
  u16 w, h;
} GBAFrame;

typedef struct {
  s16 x, y;
  s16 z;
  u16 w, h;
  s16 prevX, prevY;
  u16 prevW, prevH;
  u8 hasCollider;
  u16 cw, ch;
  s16 cox, coy;
  u8 hasArea;
  u16 aw, ah;
  s16 aox, aoy;
  u32 areaInside;
  u32 areaWas;
  s16 vx, vy;
  s8 face;
  u8 coyote;
  u8 jumpBuf;
  u8 jumpHeld;
  const GBAFrame* frames[MAX_ACTOR_FRAMES];
  u16 delays[MAX_ACTOR_FRAMES];
  u8 frameCount;
  u8 mode;
  u8 frame;
  u8 prevFrame;
  s8 dir;
  u16 timer;
  u8 animSpeed;
} GBAActor;

${imageArr.join('\n')}

static const GBAFrame gFrames[${images.length}] = {
${poolArr.join(',\n')}
};

static GBAActor gActors[ACTOR_COUNT];
static u16 gActorBack[PIXEL_COUNT] __attribute__((section(".ewram"), aligned(4)));
static u16 gBackBuf[PIXEL_COUNT] __attribute__((section(".ewram"), aligned(4)));
static int gDirty = 1;
static s16 gDirtyX0 = 0, gDirtyY0 = 0, gDirtyX1 = 239, gDirtyY1 = 159;

static void blitDirtyRect(void) {
  int y;
  if (gDirtyX1 < gDirtyX0 || gDirtyY1 < gDirtyY0) return;
  for (y = gDirtyY0; y <= gDirtyY1; y++) {
    int x;
    u16* dst = &((u16*)VRAM)[y * 240];
    const u16* src = &gBackBuf[y * 240];
    for (x = gDirtyX0; x <= gDirtyX1; x++) dst[x] = src[x];
  }
}

static void eraseActorRect(const GBAActor* a, u16* screen) {
  const GBAFrame* cf = a->frames[a->frame];
  if (a->prevX == a->x && a->prevY == a->y &&
      a->prevW == cf->w && a->prevH == cf->h) {
    if (a->prevFrame == a->frame) return;
    {
      const GBAFrame* pf = a->frames[a->prevFrame];
      int y, x;
      int ex0 = a->x, ey0 = a->y;
      int ex1 = ex0 + (int)cf->w - 1, ey1 = ey0 + (int)cf->h - 1;
      if (ex0 < 0) ex0 = 0;
      if (ey0 < 0) ey0 = 0;
      if (ex1 >= SCREEN_W) ex1 = SCREEN_W - 1;
      if (ey1 >= SCREEN_H) ey1 = SCREEN_H - 1;
      if (ex0 > ex1 || ey0 > ey1) return;
      for (y = ey0; y <= ey1; y++) {
        u16* sp = &screen[y * SCREEN_W + ex0];
        const u16* pb = &gActorBack[y * SCREEN_W + ex0];
        const u16* old = &pf->img[(y - a->y) * pf->w + (ex0 - a->x)];
        const u16* now = &cf->img[(y - a->y) * cf->w + (ex0 - a->x)];
        for (x = ex0; x <= ex1; x++, sp++, pb++, old++, now++) {
          if ((*old & 0x8000) == 0 && (*now & 0x8000) != 0) *sp = *pb;
        }
      }
    }
    return;
  }
  {
    const GBAFrame* pf = a->frames[a->prevFrame];
    int y, x;
    int ex0 = a->prevX, ey0 = a->prevY;
    int ex1 = ex0 + (int)a->prevW - 1, ey1 = ey0 + (int)a->prevH - 1;
    if (ex0 < 0) ex0 = 0;
    if (ey0 < 0) ey0 = 0;
    if (ex1 >= SCREEN_W) ex1 = SCREEN_W - 1;
    if (ey1 >= SCREEN_H) ey1 = SCREEN_H - 1;
    if (ex0 > ex1 || ey0 > ey1) return;
    for (y = ey0; y <= ey1; y++) {
      u16* sp = &screen[y * SCREEN_W + ex0];
      const u16* pb = &gActorBack[y * SCREEN_W + ex0];
      const u16* old = &pf->img[(y - a->prevY) * pf->w + (ex0 - a->prevX)];
      for (x = ex0; x <= ex1; x++, sp++, pb++, old++) {
        if ((*old & 0x8000) == 0) *sp = *pb;
      }
    }
  }
}

static void drawActorRect(GBAActor* a, u16* screen) {
  const GBAFrame* f = a->frames[a->frame];
  int x0 = a->x, y0 = a->y;
  int x1 = x0 + f->w - 1, y1 = y0 + f->h - 1;
  if (x0 < 0) x0 = 0;
  if (y0 < 0) y0 = 0;
  if (x1 >= SCREEN_W) x1 = SCREEN_W - 1;
  if (y1 >= SCREEN_H) y1 = SCREEN_H - 1;
  if (x0 > x1 || y0 > y1) { a->prevX = a->x; a->prevY = a->y; a->prevW = f->w; a->prevH = f->h; a->prevFrame = a->frame; return; }
  {
    int y, x;
    for (y = y0; y <= y1; y++) {
      u16* sp = &screen[y * SCREEN_W + x0];
      const u16* pimg = &f->img[(y - a->y) * f->w + (x0 - a->x)];
      for (x = x0; x <= x1; x++, sp++, pimg++) {
        u16 px = *pimg;
        if (px & 0x8000) continue;
        *sp = px;
      }
    }
  }
  a->prevX = a->x; a->prevY = a->y; a->prevW = f->w; a->prevH = f->h; a->prevFrame = a->frame;
}

static void drawActorRectOpaque(GBAActor* a, u16* screen) {
  const GBAFrame* f = a->frames[a->frame];
  int x0 = a->x, y0 = a->y;
  int x1 = x0 + f->w - 1, y1 = y0 + f->h - 1;
  if (x0 < 0) x0 = 0;
  if (y0 < 0) y0 = 0;
  if (x1 >= SCREEN_W) x1 = SCREEN_W - 1;
  if (y1 >= SCREEN_H) y1 = SCREEN_H - 1;
  if (x0 > x1 || y0 > y1) { a->prevX = a->x; a->prevY = a->y; a->prevW = f->w; a->prevH = f->h; a->prevFrame = a->frame; return; }
  {
    int y, x;
    for (y = y0; y <= y1; y++) {
      u16* sp = &screen[y * SCREEN_W + x0];
      const u16* pimg = &f->img[(y - a->y) * f->w + (x0 - a->x)];
      for (x = x0; x <= x1; x++, sp++, pimg++) {
        u16 px = *pimg;
        if (px & 0x8000) continue;
        *sp = px;
      }
    }
  }
  a->prevX = a->x; a->prevY = a->y; a->prevW = f->w; a->prevH = f->h; a->prevFrame = a->frame;
}

static void drawAllActorsOpaque(u16* screen) {
  int i;
  for (i = 0; i < ACTOR_COUNT; i++) {
    GBAActor* a = &gActors[i];
    if (a->frameCount == 0) continue;
    drawActorRectOpaque(a, screen);
  }
}

static void advanceAllActors(void) {
  int i;
  GBAActor* a;
  for (i = 0; i < ACTOR_COUNT; i++) {
    a = &gActors[i];
    if (a->frameCount <= 1) continue;
    a->timer += (a->animSpeed > 1) ? a->animSpeed : 1;
    if (a->timer < a->delays[a->frame]) continue;
    a->timer = 0;
    if (a->mode == 0) {
      if (a->frame < a->frameCount - 1) a->frame++;
    } else if (a->mode == 1) {
      a->frame = (a->frame + 1) % a->frameCount;
    } else {
      a->frame += a->dir;
      if (a->frame <= 0) { a->frame = 0; a->dir = 1; }
      if (a->frame >= a->frameCount - 1) { a->frame = a->frameCount - 1; a->dir = -1; }
    }
  }
}

static int paintKey(int idx) {
  int z = gActors[idx].z;
  return z * 2 + (idx == PLAYER_INDEX ? 1 : 0);
}

static void drawAllActors(u16* screen, int filterDirty) {
  int order[ACTOR_COUNT];
  int i, j, n = 0;
  for (i = 0; i < ACTOR_COUNT; i++) {
    const GBAActor* a = &gActors[i];
    if (a->frameCount == 0) continue;
    if (filterDirty) {
      int px0 = a->prevX, py0 = a->prevY, px1 = a->prevX + a->prevW, py1 = a->prevY + a->prevH;
      int cx0 = a->x, cy0 = a->y, cx1 = a->x + a->w, cy1 = a->y + a->h;
      int dx0 = gDirtyX0, dy0 = gDirtyY0, dx1 = gDirtyX1, dy1 = gDirtyY1;
      if (dx1 >= dx0 && dy1 >= dy0) {
        int pIn = px0 <= dx1 && px1 >= dx0 && py0 <= dy1 && py1 >= dy0;
        int cIn = cx0 <= dx1 && cx1 >= dx0 && cy0 <= dy1 && cy1 >= dy0;
        if (!pIn && !cIn) continue;
      }
    }
    order[n++] = i;
    eraseActorRect(&gActors[i], screen);
  }
  for (i = 1; i < n; i++) {
    int key = order[i];
    int zkey = paintKey(key);
    for (j = i - 1; j >= 0 && paintKey(order[j]) > zkey; j--) order[j + 1] = order[j];
    order[j + 1] = key;
  }
  for (i = 0; i < n; i++) drawActorRect(&gActors[order[i]], screen);
}

static int actorChanged(const GBAActor* a) {
  return a->x != a->prevX || a->y != a->prevY || a->frame != a->prevFrame
      || a->w != a->prevW || a->h != a->prevH;
}

static int actorsChanged(void) {
  int i;
  for (i = 0; i < ACTOR_COUNT; i++) {
    if (actorChanged(&gActors[i])) return 1;
  }
  return 0;
}

static void computeDirtyRect(void) {
  int i;
  gDirtyX0 = 240; gDirtyY0 = 160; gDirtyX1 = -1; gDirtyY1 = -1;
  for (i = 0; i < ACTOR_COUNT; i++) {
    const GBAActor* a = &gActors[i];
    int x0, y0, x1, y1, xx, yy;
    if (!actorChanged(a)) continue;
    x0 = a->prevX < a->x ? a->prevX : a->x;
    y0 = a->prevY < a->y ? a->prevY : a->y;
    x1 = a->prevX + a->prevW;
    xx = a->x + a->w;
    if (xx > x1) x1 = xx;
    y1 = a->prevY + a->prevH;
    yy = a->y + a->h;
    if (yy > y1) y1 = yy;
    if (x0 < 0) x0 = 0;
    if (y0 < 0) y0 = 0;
    if (x1 > 240) x1 = 240;
    if (y1 > 160) y1 = 160;
    if (x1 <= x0 || y1 <= y0) continue;
    if (x0 < gDirtyX0) gDirtyX0 = (s16)x0;
    if (y0 < gDirtyY0) gDirtyY0 = (s16)y0;
    if (x1 - 1 > gDirtyX1) gDirtyX1 = (s16)(x1 - 1);
    if (y1 - 1 > gDirtyY1) gDirtyY1 = (s16)(y1 - 1);
  }
}

// ── Colisiones por escena (runtime) ──────────────────────────────────────────
static inline u8 colTileAt(s16 cx, s16 cy) {
  if (!gColMap) return 0;
  if (cx < 0 || cy < 0 || cx >= (s16)gColCols || cy >= (s16)gColRows) return 0;
  return gColMap[cy * gColCols + cx];
}

static inline u8 solidTile(u8 v, int dirX, int dirY) {
  if (v == 1) return 1;
  if (v == 2) return dirY > 0;
  if (v == 3) return dirY < 0;
  if (v == 4) return dirX > 0;
  if (v == 5) return dirX < 0;
  return 0;
}

static inline void actorBox(const GBAActor* a, s16* bx, s16* by, s16* bw, s16* bh) {
  *bw = a->cw ? a->cw : a->w;
  *bh = a->ch ? a->ch : a->h;
  *bx = a->x + gCamX + (a->w - *bw) / 2 + a->cox;
  *by = a->y + gCamY + (a->h - *bh) / 2 + a->coy;
}

static inline int rectsOverlap(s16 ax, s16 ay, s16 aw, s16 ah, s16 bx, s16 by, s16 bw, s16 bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

static inline int rectHitsSolid(s16 bx, s16 by, s16 bw, s16 bh, s16 dx, s16 dy) {
  int x0 = bx, y0 = by, x1 = bx + bw - 1, y1 = by + bh - 1;
  int tx0 = x0 / (int)gColTile, ty0 = y0 / (int)gColTile;
  int tx1 = x1 / (int)gColTile, ty1 = y1 / (int)gColTile;
  int cx, cy;
  for (cy = ty0; cy <= ty1; cy++) {
    for (cx = tx0; cx <= tx1; cx++) {
      if (solidTile(colTileAt((s16)cx, (s16)cy), dx, dy)) return 1;
    }
  }
  return 0;
}

static void moveActorCollide(GBAActor* a, s16 dx, s16 dy) {
  s16 bx, by, bw, bh;
  actorBox(a, &bx, &by, &bw, &bh);
  if (dx != 0) {
    a->x += dx;
    actorBox(a, &bx, &by, &bw, &bh);
    if (rectHitsSolid(bx, by, bw, bh, dx, 0)) a->x -= dx;
  }
  if (dy != 0) {
    a->y += dy;
    actorBox(a, &bx, &by, &bw, &bh);
    if (rectHitsSolid(bx, by, bw, bh, 0, dy)) a->y -= dy;
  }
}

// ── Primitivas de movimiento ────────────────────────────────────────────────
#define WALK_SPEED 2
#define RUN_SPEED 3
#define ACCEL 1
#define FRICTION 1
#define GRAVITY 1
#define MAX_FALL 5
#define JUMP_VEL -11
#define COYOTE_FRAMES 5
#define JUMP_BUFFER 5
#define JUMP_CUT_VEL -3

static int onFloor(GBAActor* a) {
  s16 bx, by, bw, bh;
  actorBox(a, &bx, &by, &bw, &bh);
  return rectHitsSolid(bx, by + 1, bw, bh, 0, 1);
}

static inline void approach(s16* v, s16 target, s16 step) {
  if (*v > target) { *v -= step; if (*v < target) *v = target; }
  else if (*v < target) { *v += step; if (*v > target) *v = target; }
}

#define KEY_RIGHT 0x010
#define KEY_LEFT  0x020
#define KEY_UP    0x040
#define KEY_DOWN  0x080
#define KEY_A     0x001
#define KEY_B     0x002
#define KEY_SHOULDER 0x300

static void moveTopDown(GBAActor* a, u16 keys) {
  s16 ox = a->x, oy = a->y;
  s16 tx = 0, ty = 0, max = (keys & KEY_SHOULDER) ? RUN_SPEED : WALK_SPEED;
  if (keys & KEY_RIGHT) tx = max;
  else if (keys & KEY_LEFT) tx = -max;
  if (keys & KEY_DOWN) ty = max;
  else if (keys & KEY_UP) ty = -max;
  if (tx) a->face = (tx > 0) ? 1 : 0;
  approach(&a->vx, tx, tx ? ACCEL : FRICTION);
  approach(&a->vy, ty, ty ? ACCEL : FRICTION);
  moveActorCollide(a, a->vx, a->vy);
  if (a->x == ox) a->vx = 0;
  if (a->y == oy) a->vy = 0;
}

static void movePlatformer(GBAActor* a, u16 keys) {
  s16 tx = 0, max = (keys & KEY_SHOULDER) ? RUN_SPEED : WALK_SPEED;
  s16 before = a->y;
  if (keys & KEY_RIGHT) { tx = max; a->face = 1; }
  else if (keys & KEY_LEFT) { tx = -max; a->face = 0; }
  approach(&a->vx, tx, tx ? ACCEL : (onFloor(a) ? FRICTION : 0));

  if (onFloor(a)) a->coyote = COYOTE_FRAMES;
  else if (a->coyote) a->coyote--;
  if (keys & KEY_A) {
    if (!a->jumpHeld) { a->jumpBuf = JUMP_BUFFER; a->jumpHeld = 1; }
  } else {
    a->jumpHeld = 0;
    a->jumpBuf = 0;
  }
  if (a->jumpBuf && a->coyote) {
    a->vy = JUMP_VEL;
    a->jumpBuf = 0;
    a->coyote = 0;
  }
  if (a->jumpBuf) a->jumpBuf--;
  if (!(keys & KEY_A) && a->vy < JUMP_CUT_VEL) a->vy = JUMP_CUT_VEL;

  a->vy += GRAVITY;
  if (a->vy > MAX_FALL) a->vy = MAX_FALL;
  moveActorCollide(a, a->vx, a->vy);
  if (a->y == before) a->vy = 0;
}

static void movePlayer(u16 keys, GBAActor* p) { moveTopDown(p, keys); }

static void updatePlayer(void) {
  GBAActor* p = &gActors[PLAYER_INDEX];
  int i;
  if (!p->hasCollider) return;
${hasCScripts
  ? '  // El jugador lo mueve tu script C (script_update) — el motor no duplica.'
  : '  {\n    u16 keys = ~REG_KEYINPUT & 0x3FF;\n    movePlayer(keys, p);\n  }'}
  for (i = 0; i < ACTOR_COUNT; i++) {
    GBAActor* b = &gActors[i];
    s16 ax, ay, aw, ah, bx, by, bw, bh;
    s16 pushX, pushY;
    if (b == p || !b->hasCollider) continue;
    actorBox(p, &ax, &ay, &aw, &ah);
    actorBox(b, &bx, &by, &bw, &bh);
    if (!rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh)) continue;
    pushX = ax < bx ? ax + aw - bx : bx + bw - ax;
    pushY = ay < by ? ay + ah - by : by + bh - ay;
    if (pushX < pushY) p->x += (ax < bx) ? -pushX : pushX;
    else p->y += (ay < by) ? -pushY : pushY;
  }
}

// ── Interacción (API de scripts) ───────────────────────────────────────────
// near(a, b, dist): 1 si la caja de dist px alrededor del centro de b
// toca al actor a (proximidad para "hablar"/"usar"). Usa coords relativas
// a cámara, válidas dentro de la escena actual.
static int near(const GBAActor* a, const GBAActor* b, s16 dist) {
  s16 ax = a->x + a->w / 2, ay = a->y + a->h / 2;
  s16 bx = b->x + b->w / 2, by = b->y + b->h / 2;
  s16 dx = ax - bx; if (dx < 0) dx = -dx;
  s16 dy = ay - by; if (dy < 0) dy = -dy;
  return dx <= dist && dy <= dist;
}

// Pide cambiar a la escena n (índice en el orden del editor). El bucle la
// carga usando la transicion de la conexion origen->destino; el 2o argumento
// opcional elige la conexion por nombre. Llama desde cualquier script C:
//   switchScene(1);            // primera conexion gScene->1 (o fade por defecto)
//   switchScene(1, "puerta");  // la conexion cuyo nombre sea "puerta"
static const char* gSceneTransName = 0;
static void switchSceneNamed(int n, const char* name) {
  if (n >= 0 && n < SCENE_COUNT) { gSceneTarget = n; gSceneTransName = name; }
}
static void switchScenePlain(int n) { switchSceneNamed(n, 0); }
#define AE_SWITCH_PICK(_1, _2, NAME, ...) NAME
#define switchScene(...) AE_SWITCH_PICK(__VA_ARGS__, switchSceneNamed, switchScenePlain)(__VA_ARGS__)
`;

  // ── Inicializadores de actores por escena ──────────────────────────────
  c += sceneActorsFns.join('\n\n') + '\n';

  // ── Áreas de actor: runtime (compartido por todas las escenas) ─────────
  if (needsAreaRuntime) {
    c += generateAreaSupport('gCamX', 'gCamY');
  }

  // ── Scripts de usuario + dispatchers por escena ────────────────────────
  c += `
// ── Scripts de usuario (C ó AdvanceCode transpilado) ────────────────────
// Contrato: cada script asignado a un actor se ejecuta con la variable global
//   GBAActor* gSelf — apunta AL ACTOR (índice de SU escena).
//   script_init(void)        — se llama UNA vez al entrar en la escena (por actor)
//   script_update(void)      — se llama CADA frame del juego (por actor)
// API disponible (definida arriba en este archivo):
//   gSelf, gActors[ACTOR_COUNT] (GBAActor: .x .y .z .w .h .vx .vy .frame .timer),
//   PLAYER_INDEX, moveActorCollide(actor, dx, dy), movePlayer(keys, actor),
//   moveTopDown(a, keys), movePlatformer(a, keys), onFloor(a), approach(&v, t, s),
//   near(a, b, dist), switchScene(n),
//   gJp (bits pulsados ESTE frame), gScene (escena actual),
//   actor_in_area(a, b), actor_entered(a, b), actor_exit(a, b) — ver Áreas de actor arriba
//   REG_KEYINPUT: bit 0=A 1=B 2=SELEC 3=START 4=RIGHT 5=LEFT 6=UP 7=DOWN 8=R 9=L (0=presionado).
// Reglas GBA: tipos u8/s16 (sin float), sin memoria dinámica, todo a 60fps.
static GBAActor* gSelf;
${scriptBodies.join('\n\n')}
`;

  c += `
${scriptFnInits.join('\n\n')}

${scriptFnUpds.join('\n\n')}
`;

  // ── Registro de funciones por escena + dispatcher initActors ───────────
  const sceneHasSong = scenes.map((sc) => !!sc.song && sc.song.patterns.some((p) => (p.rows ?? []).length > 0));
  const sceneSongBpm = scenes.map((sc, si) => sceneHasSong[si] ? (sc.song!.bpm ?? 120) : 0);
  const sceneSongSteps = scenes.map((sc, si) => sceneHasSong[si] ? sc.song!.patterns.reduce((s, p) => s + (p.rows?.length ?? 0), 0) : 0);
  c += `
typedef void (*SceneFn)(void);
typedef void (*SongFn)(int);

static const SceneFn gSceneActorInit[SCENE_COUNT] = { ${scenes.map((_, si) => `sceneInitActors_${si}`).join(', ')} };
static const SceneFn gSceneScriptInit[SCENE_COUNT] = { ${scenes.map((_, si) => `sceneScriptInit_${si}`).join(', ')} };
static const SceneFn gSceneScriptUpdate[SCENE_COUNT] = { ${scenes.map((_, si) => `sceneScriptUpdate_${si}`).join(', ')} };
static const SongFn gSceneSongStep[SCENE_COUNT] = { ${scenes.map((_, si) => sceneHasSong[si] ? `songStep_S${si}` : '0').join(', ')} };
static const int gSceneSoundIdx[SCENE_COUNT] = { ${sceneSoundIdxs.join(', ')} };
static const u16 gSceneSongBpm[SCENE_COUNT] = { ${sceneSongBpm.join(', ')} };
static const u16 gSceneSongSteps[SCENE_COUNT] = { ${sceneSongSteps.join(', ')} };

int gSongStep;
u32 gSongAccum;

static void initActors(void) { if (gSceneActorInit[gScene]) gSceneActorInit[gScene](); }
`;

  c += `
// Carga la escena n: datos de colisión/cámara, fondo en los buffers, actores
// y scripts de esa escena. Asume que VRAM ya tiene el nuevo fondo (tras el
// fade) o que se bliteará por el rect sucio completo.
static void loadSceneState(int n) {
  int i;
  gScene = n;
  gColMap = gSceneCol[n];
  gColCols = gSceneCols[n];
  gColRows = gSceneRows[n];
  gColTile = gSceneTile[n];
  gCamX = gSceneCamX[n];
  gCamY = gSceneCamY[n];
  for (i = 0; i < PIXEL_COUNT; i++) gBackBuf[i] = gSceneImg[n][i];
  for (i = 0; i < PIXEL_COUNT; i++) gActorBack[i] = gBackBuf[i];
  if (gSceneActorInit[n]) gSceneActorInit[n]();
  if (gSceneScriptInit[n]) gSceneScriptInit[n]();
  drawAllActors(gBackBuf, 0);
  gSongStep = 0;
  gSongAccum = 0;
  if (gSceneSoundIdx[n] >= 0) soundPlay(gSceneSoundIdx[n], 1); else soundStop();
  gDirty = 1; gDirtyX0 = 0; gDirtyY0 = 0; gDirtyX1 = SCREEN_W - 1; gDirtyY1 = SCREEN_H - 1;
}
`;

  // ── main / entrada ─────────────────────────────────────────────────────
  const SCENE_START = String(startIdx);
  const fillSceneBlock = `  {
    int i;
    for (i = 0; i < PIXEL_COUNT; i++) screen[i] = sceneData[i];
  }`;
  const sceneInitBlock = `  loadSceneState(${SCENE_START});`;
  const prologue = `  gScene = ${SCENE_START};`;

  // bucle de escena (multi)
  const actorLines = `  if (gDirty) { blitDirtyRect(); gDirty = 0; }
  advanceAllActors();
  updatePlayer();
` + (needsAreaRuntime ? `  updateAreaContacts();
` : '') + (activeScripts.length ? `  if (gSceneScriptUpdate[gScene]) gSceneScriptUpdate[gScene]();
` : '') + `  if (actorsChanged()) { computeDirtyRect(); drawAllActors(gBackBuf, 1); gDirty = 1; }`;

  let sceneLoopCode: string;
  sceneLoopCode = `  initSound();
  if (gSceneSoundIdx[gScene] >= 0) soundPlay(gSceneSoundIdx[gScene], 1);

  {
    while (1) {
      waitVSync();
      if (gSceneTarget != -1 && gSceneTarget != gScene) {
        int from = gScene;
        int n = gSceneTarget;
        const char* nm = gSceneTransName;
        gSceneTarget = -1;
        gSceneTransName = 0;
        int ti = findTransition(from, n, nm);
        if (ti < 0) {
          fadeToBlack(gSceneImg[from], SCENE_SWITCH_FRAMES);
          loadSceneState(n);
          fadeToScene(gSceneImg[n], SCENE_SWITCH_FRAMES);
        } else if (gTransKind[ti] == 0) {
          loadSceneState(n);
        } else if (gTransKind[ti] == 1) {
          fadeToBlack(gSceneImg[from], gTransFrames[ti]);
          loadSceneState(n);
          fadeToScene(gSceneImg[n], gTransFrames[ti]);
        } else {
          if (gTransCover[ti]) gTransCover[ti](gSceneImg[from], gTransFrames[ti]);
          loadSceneState(n);
          if (gTransReveal[ti]) gTransReveal[ti](gSceneImg[n], gTransFrames[ti]);
        }
        gKeysPrev = ~REG_KEYINPUT & 0x3FF;
      }
      { u16 kn = ~REG_KEYINPUT & 0x3FF; gJp = (u16)(kn & ~gKeysPrev); gKeysPrev = kn; }
      soundTick();
      /* Música por escena: cada escena con canción avanza con su propio BPM;
         las que no tienen, gSceneSongBpm = 0 → silencio. */
      if (gSceneSongBpm[gScene]) {
        gSongAccum += gSceneSongBpm[gScene];
        if (gSongAccum >= 900) {
          gSongAccum -= 900;
          if (gSceneSongStep[gScene]) {
            if (gSongStep >= gSceneSongSteps[gScene]) gSongStep = 0;
            gSceneSongStep[gScene](gSongStep);
          }
          gSongStep++;
        }
      }
${actorLines.split('\n').map((l) => '      ' + l.trim()).join('\n').trimEnd()}
    }
  }
`;

  c += `
// ── Entry Point ─────────────────────────────────────────────────────────
int main() {
  REG_DISPCNT = MODE_3 | BG2_ENABLE;
  u16* screen = (u16*)VRAM;
  ${prologue.trim()}
`;

  if (hasSplash) {
    c += `
  {
    int i;
    for (i = 0; i < PIXEL_COUNT; i++) screen[i] = splashScreenData[i];
  }
`;
    if (hasMusic) {
      c += `
  initSound();
${splashSoundLine}
  {
    int step = 0;
    u32 accum = 0;
    int frames = SPLASH_DURATION * 60;
    int i;
    for (i = 0; i < frames; i++) {
      waitVSync();
      accum += SONG_BPM;
      if (accum >= 900) {
        accum -= 900;
        playStep(step);
        step++;
        if (step >= SONG_STEPS) step = 0;
      }
    }
  }
`;
    } else {
      c += `
  {
    int frames = SPLASH_DURATION * 60;
    int i;
    for (i = 0; i < frames; i++) waitVSync();
  }
${splashSoundIdx >= 0 ? `  initSound();\n  soundPlay(${splashSoundIdx}, 1);\n` : ''}`;
    }
  } else {
    c += `
  {
    int i;
    for (i = 0; i < PIXEL_COUNT; i++) screen[i] = 0x7C1F;
  }
`;
  }

  const transitionChain = getCoverCall();
  const revealChain = getRevealCall();
  if (transitionChain) {
    c += `
  ${transitionChain};

  ${revealChain};

`;
  }

  c += fillSceneBlock + '\n\n' + sceneInitBlock + '\n\n' + sceneLoopCode + '\n';
  c += `  return 0;
}
`;

  scenes.forEach((sc, si) => {
    log.add(`Escena ${si}: "${sc.name}" — ${sc.imageCArray ? 'imagen' : 'color sólido'}, ${sc.actors.length} actor(es)${sc.collisionMap?.length ? ', colisión' : ''}`);
  });
  log.add(`Escena de inicio (tras splash): índice ${startIdx} ("${scenes[startIdx]?.name}") — switchScene(n) usa el orden del editor`);
  if (hasSplash) log.add(`SplashScreen incluido (${splashDuration}s)`);
  else log.add('Sin SplashScreen - pantalla purpura');
  if (hasMusic) log.add(`Musica splash: ${splashSong!.name}`);
  if (hasSceneMusic) log.add(`Musica escena: ${sceneSong!.name}`);
  if (!hasMusic && !hasSceneMusic) log.add('Sin musica');
  if (activeScripts.length) log.add(`Scripts C Directo: ${activeScripts.length} script(s) activo(s) — solo asignados a actores`);
  log.add('Codigo fuente C generado correctamente (multi-escena)');

  return c;
}

export function generateMakefile(name: string, log: ExportLog): string {
  const sanitized = name.replace(/\s+/g, '_');
  const makefile = `# ${name} — Makefile generado por Advance Engine
# Requiere devkitARM (https://devkitpro.org)

PROJNAME = ${sanitized}
TARGET = \$(PROJNAME).gba

ARCH = -mthumb -mthumb-interwork -mcpu=arm7tdmi -mtune=arm7tdmi
CFLAGS = -Wall -O2 \$(ARCH) -I\$(DEVKITPRO)/libgba/include
LDFLAGS = \$(ARCH) -L\$(DEVKITPRO)/libgba/lib -specs=gba.specs

CC = arm-none-eabi-gcc
LD = arm-none-eabi-gcc
OBJCOPY = arm-none-eabi-objcopy
GBAFIX = $(DEVKITPRO)/tools/bin/gbafix

SRCS = main.c
OBJS = $(SRCS:.c=.o)

all: $(TARGET)

$(TARGET): $(OBJS)
	$(LD) $(LDFLAGS) -o $(PROJNAME).elf $(OBJS) -lgba
	$(OBJCOPY) -O binary $(PROJNAME).elf $(TARGET)
	$(GBAFIX) $(TARGET) -p -t"$(PROJNAME)" -c"AE01" -m"01"
	@echo "ROM generada: $(TARGET)"

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

clean:
	rm -f \$(OBJS) \$(PROJNAME).elf \$(TARGET)

.PHONY: all clean
`;
  log.add('Makefile generado (requiere devkitARM)');
  return makefile;
}

export async function exportToGBA(
  state: EditorState,
  name: string,
  author: string,
  projectDir: string,
  log: ExportLog,
): Promise<boolean> {
  const api = window.advanceAPI;
  log.add('=== INICIANDO EXPORTACION GBA ===');

  const buildDir = `${projectDir}/build`;
  await api.dir.create(buildDir);

  const cCode = generateGBAProject(state, name, author, log);
  const cResult = await api.file.writeText(`${buildDir}/main.c`, cCode);
  if (!cResult.success) {
    log.error('Error escribiendo main.c: ' + cResult.reason);
    return false;
  }

  const makefile = generateMakefile(name, log);
  const mfResult = await api.file.writeText(`${buildDir}/Makefile`, makefile);
  if (!mfResult.success) {
    log.error('Error escribiendo Makefile: ' + mfResult.reason);
    return false;
  }

  log.add('=== EXPORTACION COMPLETADA ===');
  log.add('Build en: ' + projectDir + '/build/');
  log.add('Para compilar: instala devkitARM y ejecuta "make" en la carpeta build/');
  return true;
}
