import type { EditorState } from './project_persistence';

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

function hexToGBA15(hex: string): string {
  const h = hex.replace('#', '0x');
  const num = parseInt(h, 16);
  if (isNaN(num)) return '0x7fff';
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const gba = ((r >> 3) | ((g >> 3) << 5) | ((b >> 3) << 10)) & 0x7fff;
  return `0x${gba.toString(16).padStart(4, '0')}`;
}

export function generateGBAProject(state: EditorState, name: string, author: string, log: ExportLog): string {
  log.add(`Generando proyecto GBA: ${name}`);
  log.add(`Autor: ${author}`);

  const scenes = state.scenes ?? [];
  const backgrounds = state.backgrounds ?? [];
  const sprites = state.sprites ?? [];
  const songs = state.songs ?? [];

  let cCode = `/*
 * ${name} — Generado por Advance Engine
 * Author: ${author}
 * Fecha: ${new Date().toISOString()}
 */

#include <gba.h>
#include <string.h>

// ── Assets ──────────────────────────────────────────────────────────────
`;

  // Background defines
  cCode += `\n// Backgrounds\n`;
  backgrounds.forEach((bg: any, i: number) => {
    cCode += `#define BG_COUNT ${backgrounds.length}\n`;
  });
  if (backgrounds.length === 0) {
    cCode += `#define BG_COUNT 0\n`;
  }

  // Scene data
  cCode += `\n// ── Escenas ──────────────────────────────────────────────────────────\n`;
  cCode += `#define SCENE_COUNT ${scenes.length}\n\n`;
  cCode += `typedef struct {\n  u16 width;\n  u16 height;\n  u16 bgColor;\n  const char* name;\n} SceneDef;\n\n`;
  cCode += `const SceneDef scenes[SCENE_COUNT] = {\n`;
  scenes.forEach((sc: any) => {
    const color = hexToGBA15(sc.backgroundColor ?? '#6b8cff');
    cCode += `  { ${sc.width ?? 240}, ${sc.height ?? 160}, ${color}, "${sc.name ?? 'Escena'}" },\n`;
  });
  cCode += `};\n`;

  // Song metadata
  cCode += `\n// ── Canciones ─────────────────────────────────────────────────────────\n`;
  cCode += `#define SONG_COUNT ${songs.length}\n\n`;
  songs.forEach((song: any, i: number) => {
    const patternCount = song.patterns?.length ?? 0;
    cCode += `// Song ${i}: ${song.name ?? 'Untitled'} (${patternCount} patterns)\n`;
  });
  cCode += `\nconst u16 songCount = SONG_COUNT;\n`;

  // Sprite metadata
  cCode += `\n// ── Sprites ──────────────────────────────────────────────────────────\n`;
  cCode += `#define SPRITE_COUNT ${sprites.length}\n`;
  sprites.forEach((spr: any, i: number) => {
    const tw = spr.tileWidth ?? 8;
    const th = spr.tileHeight ?? 8;
    const cols = spr.cols ?? 1;
    const rows = spr.rows ?? 1;
    cCode += `// Sprite ${i}: ${spr.name ?? 'Untitled'} (${cols}x${rows} tiles of ${tw}x${th})\n`;
  });

  // Main entry
  cCode += `
// ── Entry Point ─────────────────────────────────────────────────────────
int main() {
  // Inicialización GBA
  REG_DISPCNT = MODE_0 | BG0_ENABLE;

  // Cargar assets (generado por pipeline)
  // Scenes: ${scenes.length}, Sprites: ${sprites.length}, Songs: ${songs.length}

  while(1) {
    // Game loop
    VBlankIntrWait();
  }
  return 0;
}
`;

  log.add(`${scenes.length} escenas, ${sprites.length} sprites, ${songs.length} canciones, ${backgrounds.length} fondos`);
  log.add('Código fuente C generado correctamente');

  return cCode;
}

export function generateMakefile(name: string, log: ExportLog): string {
  const makefile = `# ${name} — Makefile generado por Advance Engine
# Requiere devkitARM (https://devkitpro.org)

PROJNAME = ${name}
TARGET = \$(PROJNAME).gba

ARCH = -mthumb -mthumb-interwork -mcpu=arm7tdmi -mtune=arm7tdmi
CFLAGS = -Wall -O2 \$(ARCH) -I\$(DEVKITPRO)/libgba/include
LDFLAGS = \$(ARCH) -L\$(DEVKITPRO)/libgba/lib -lgba -specs=gba.specs

CC = arm-none-eabi-gcc
LD = arm-none-eabi-gcc
OBJCOPY = arm-none-eabi-objcopy

SRCS = main.c
OBJS = \$(SRCS:.c=.o)

all: \$(TARGET)

\$(TARGET): \$(OBJS)
	\$(LD) \$(LDFLAGS) -o \$(PROJNAME).elf \$(OBJS)
	\$(OBJCOPY) -O binary \$(PROJNAME).elf \$(TARGET)
	@echo "ROM generada: \$(TARGET)"

%.o: %.c
	\$(CC) \$(CFLAGS) -c $< -o $@

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
  log.add('=== INICIANDO EXPORTACIÓN GBA ===');

  const buildDir = `${projectDir}/build`;
  await api.dir.create(buildDir);

  // Generate C source
  const cCode = generateGBAProject(state, name, author, log);
  const cResult = await api.file.writeText(`${buildDir}/main.c`, cCode);
  if (!cResult.success) {
    log.error(`Error escribiendo main.c: ${cResult.reason}`);
    return false;
  }

  // Generate Makefile
  const makefile = generateMakefile(name, log);
  const mfResult = await api.file.writeText(`${buildDir}/Makefile`, makefile);
  if (!mfResult.success) {
    log.error(`Error escribiendo Makefile: ${mfResult.reason}`);
    return false;
  }

  log.add('=== EXPORTACIÓN COMPLETADA ===');
  log.add(`Build en: ${projectDir}/build/`);
  log.add('Para compilar: instala devkitARM y ejecuta "make" en la carpeta build/');
  return true;
}
