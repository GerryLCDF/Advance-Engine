import type { EditorState } from './project_persistence';
import type { Song } from '../types/editor';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function noteToPeriodIdx(note: string, octave: number): number {
  const i = NOTE_NAMES.indexOf(note);
  if (i < 0) return -1;
  return (octave - 1) * 12 + i;
}

function calcPeriod(freq: number): number {
  const p = Math.round(2048 - (131072 / freq));
  return Math.max(0, Math.min(2047, p));
}

function buildPeriodTable(): number[] {
  const table: number[] = [];
  for (let o = 1; o <= 8; o++) {
    for (let n = 0; n < 12; n++) {
      const midiIdx = (o + 1) * 12 + n;
      const freq = 440 * Math.pow(2, (midiIdx - 69) / 12);
      table.push(calcPeriod(freq));
    }
  }
  return table;
}

function dutyToGBA(dutyVal: number): number {
  // dutyVal from Instrument type is 0-1 (fraction), but might also be 0-100
  const pct = dutyVal > 1 ? dutyVal : dutyVal * 100;
  if (pct <= 12.5) return 0;
  if (pct <= 25) return 1;
  if (pct <= 50) return 2;
  return 3;
}

function generateSongData(song: Song): string {
  const periods = buildPeriodTable();
  const allSteps = song.patterns.flatMap((p) => p.rows);
  const stepCount = allSteps.length;
  const TABLE_SIZE = periods.length;

  let code = `
// ── Note period table (C1-B8, ${TABLE_SIZE} notes) ──────────────────────
const u16 gNotePeriods[${TABLE_SIZE}] = {${periods.map((p) => `0x${p.toString(16).padStart(4, '0')}`).join(', ')}};

// ── Song: ${song.name} ──────────────────────────────────────────────────
#define SONG_BPM ${song.bpm}
#define SONG_STEPS ${stepCount}

typedef struct {
  u8 volume;      // initial volume (0-15)
  u8 duty;        // GBA duty value (0-3)
  u8 envDir;      // envelope direction (0=decrease, 1=increase)
  u8 envSweep;    // envelope sweep rate (0-7)
  u8 sweepShift;  // sweep shift (0-7)
  u8 sweepTime;   // sweep time (0-7)
  u8 sweepDir;    // sweep direction (0=increase, 1=decrease)
} GBAInst;

typedef struct {
  u8 periodIdx;  // 0-${TABLE_SIZE - 1}, 0xFF=rest
  u8 instIdx;    // instrument index
} GBANote;

typedef struct {
  GBANote ch[4]; // [pulse1, pulse2, wave, noise]
} GBAStep;
`;

  // Instrument table
  const insts = song.instruments;
  code += `
const GBAInst gInstruments[${insts.length}] = {`;
  for (const inst of insts) {
    const env = inst.envelope || { attack: 0, decay: 0, sustain: 1, release: 0 };
    const initialVol = Math.round(Math.max(1, Math.min(15, env.sustain * 15)));
    const envDir = env.attack > env.decay ? 1 : 0;
    const envSweep = Math.min(7, Math.max(0, Math.round(Math.max(env.attack, env.decay) * 7)));
    code += `
  {${initialVol}, ${dutyToGBA(inst.dutyCycle)}, ${envDir}, ${envSweep}, 0, 0, 0},`;
  }
  code += `
};

const GBAStep gSongData[SONG_STEPS] = {`;
  for (let s = 0; s < stepCount; s++) {
    const row = allSteps[s];
    const channels = ['ch-pulse1', 'ch-pulse2', 'ch-wave', 'ch-noise'];
    const parts: string[] = [];
    for (let c = 0; c < channels.length; c++) {
      const nr = row[channels[c]];
      if (nr && nr.note && nr.instrumentId) {
        const rawIdx = noteToPeriodIdx(nr.note, nr.octave);
        const pIdx = Math.max(0, Math.min(TABLE_SIZE - 1, rawIdx));
        const iIdx = insts.findIndex((i) => i.id === nr.instrumentId);
        parts.push(`{${pIdx}, ${iIdx >= 0 ? iIdx : 0}}`);
      } else {
        parts.push('{0xFF, 0}');
      }
    }
    code += '\n  {{' + parts.join(', ') + '}}';
    if (s < stepCount - 1) code += ',';
  }
  code += `
};
`;

  // Sound functions
  code += `
// GBA sound register addresses
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

static void initWaveRAM(void) {
  // Write 32 4-bit samples (16 bytes) at 0x04000090
  // Sawtooth wave: 0,1,2,...,15,0,1,2,...,15
  vu16* wave = (vu16*)0x04000090;
  const u16 waveData[8] = {
    0x0123, 0x4567, 0x89AB, 0xCDEF,
    0x0123, 0x4567, 0x89AB, 0xCDEF
  };
  int i;
  for (i = 0; i < 8; i++) wave[i] = waveData[i];
}

static void initSound(void) {
  // Reset all channel registers
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

  // 1. Bias FIRST (mGBA necesita el bias antes de master enable)
  REG_SNDBIAS = 0x200;

  // 2. Master sound enable (bit 7)
  REG_SNDCNTX = 0x0080;

  // 3. DMG 100% volume ratio, Direct Sound off
  REG_SNDCNTH = 0x0002;

  // 4. Route all PSG channels to left and right output, max volume
  REG_SNDCTL = 0xFF77;

  // Enable wave RAM + 100% volume for Sound 3
  REG_SND3CNT_L = 0x0080;
  REG_SND3CNT_H = 0x0001;

  initWaveRAM();
}

static void noteOn(int ch, const GBAInst* inst, u16 period) {
  u16 dutyVal = (inst->duty & 3) << 0;
  u16 envVal = ((inst->volume & 0xF) << 11) | ((inst->envDir & 1) << 8) | ((inst->envSweep & 7) << 4);
  u16 freqVal = 0xC000 | (period & 0x07FF);

  switch (ch) {
  case 0: {
    u16 sweepVal = (inst->sweepShift & 7) | ((inst->sweepTime & 7) << 3) | ((inst->sweepDir & 1) << 6);
    REG_SND1SWEEP = sweepVal;
    REG_SND1CNT = dutyVal | envVal;
    REG_SND1FREQ = freqVal;
    break;
  }
  case 1:
    REG_SND2CNT = dutyVal | envVal;
    REG_SND2FREQ = freqVal;
    break;
  case 2:
    REG_SND3CNT_L = 0x0080;
    REG_SND3CNT_H = 0x0001;
    REG_SND3FREQ = freqVal >> 1;
    break;
  case 3:
    REG_SND4CNT = envVal;
    REG_SND4FREQ = 0xC031;
    break;
  }
}

static void playStep(int step) {
  if (step < 0 || step >= SONG_STEPS) return;
  const GBAStep* s = &gSongData[step];
  int c;
  for (c = 0; c < 4; c++) {
    if (s->ch[c].periodIdx != 0xFF) {
      if (s->ch[c].instIdx < ${insts.length}) {
        const GBAInst* inst = &gInstruments[s->ch[c].instIdx];
        noteOn(c, inst, gNotePeriods[s->ch[c].periodIdx]);
      }
    }
  }
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
  error(msg: string): void;
}

export function createLog(): ExportLog {
  const messages: string[] = [];
  return {
    messages,
    add(msg: string) { messages.push(`[INFO] ${msg}`); },
    error(msg: string) { messages.push(`[ERROR] ${msg}`); },
  };
}

export function generateGBAProject(
  state: EditorState,
  name: string,
  author: string,
  log: ExportLog,
  splashImageCArray?: string,
  splashDuration?: number,
  splashSong?: Song,
  sceneImageCArray?: string,
  sceneBackgroundColor?: string,
): string {
  log.add(`Generando proyecto GBA: ${name}`);
  log.add(`Autor: ${author}`);

  const hasSplash = splashImageCArray && splashDuration && splashDuration > 0;
  const hasMusic = splashSong && splashSong.patterns.length > 0 && splashSong.patterns.some((p) => p.rows.length > 0);
  const hasScene = !!sceneImageCArray || !!sceneBackgroundColor;

  function hexColor(cssColor: string): number {
    let hex = cssColor.replace('#', '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    const r = parseInt(hex.slice(0,2), 16);
    const g = parseInt(hex.slice(2,4), 16);
    const b = parseInt(hex.slice(4,6), 16);
    return ((r>>3) | ((g>>3)<<5) | ((b>>3)<<10)) & 0x7FFF;
  }

  function renderScene(): string {
    if (sceneImageCArray) {
      return `  {
    int i;
    for (i = 0; i < PIXEL_COUNT; i++) screen[i] = sceneData[i];
  }

  while (1) waitVSync();
`;
    }
    if (sceneBackgroundColor) {
      const color = sceneBackgroundColor;
      const hex = `0x${hexColor(color).toString(16).padStart(4, '0')}`;
      return `  {
    int i;
    for (i = 0; i < PIXEL_COUNT; i++) screen[i] = ${hex};
  }

  while (1) waitVSync();
`;
    }
    // fallback: purple
    return `  memset(screen, 0, sizeof(splashScreenData));

  while (1) waitVSync();
`;
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

  if (hasSplash) {
    cCode += `
// ── Splash Screen ─────────────────────────────────────────────────────
#define SPLASH_DURATION ${splashDuration}

const u16 splashScreenData[PIXEL_COUNT] = ${splashImageCArray};
`;
  }

  if (hasScene) {
    const sceneHex = sceneBackgroundColor ? `0x${hexColor(sceneBackgroundColor).toString(16).padStart(4, '0')}` : '0x0000';
    cCode += `
// ── Scene after splash ─────────────────────────────────────────────────
`;
    if (sceneImageCArray) {
      cCode += `const u16 sceneData[PIXEL_COUNT] = ${sceneImageCArray};
`;
    } else {
      cCode += `#define SCENE_COLOR ${sceneHex}
`;
    }
  }

  if (hasMusic) {
    cCode += generateSongData(splashSong!);
    log.add(`Cancion "${splashSong!.name}" incluida en la ROM (${splashSong!.patterns.length} patrones)`);
  } else {
    log.add('Sin cancion de fondo para la ROM');
  }

  cCode += `
// ── Entry Point ─────────────────────────────────────────────────────────
int main() {
  REG_DISPCNT = MODE_3 | BG2_ENABLE;
  u16* screen = (u16*)VRAM;
`;

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
` + renderScene();
    } else {
      cCode += `
  {
    int frames = SPLASH_DURATION * 60;
    int i;
    for (i = 0; i < frames; i++) waitVSync();
  }
` + renderScene();
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

  {
    int step = 0;
    u32 accum = 0;
    while (1) {
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
      cCode += `
  while (1) waitVSync();
`;
    }
  }

  cCode += `  return 0;
}
`;

  log.add(`${hasSplash ? 'SplashScreen incluido (' + splashDuration + 's)' : 'Sin SplashScreen - pantalla purpura'}`);
  if (hasMusic) {
    const totalSteps = splashSong!.patterns.reduce((s, p) => s + p.rows.length, 0);
    log.add(`Musica incluida (${splashSong!.patterns.length} patrones, ${totalSteps} steps)`);
  } else {
    log.add('Sin musica');
  }
  log.add('Codigo fuente C generado correctamente');

  return cCode;
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
