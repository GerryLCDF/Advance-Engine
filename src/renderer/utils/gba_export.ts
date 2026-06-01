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

export function generateGBAProject(
  state: EditorState,
  name: string,
  author: string,
  log: ExportLog,
  splashImageCArray?: string,
  splashDuration?: number,
): string {
  log.add(`Generando proyecto GBA: ${name}`);
  log.add(`Autor: ${author}`);

  const hasSplash = splashImageCArray && splashDuration && splashDuration > 0;

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

  // Splash data
  if (hasSplash) {
    cCode += `
// ── Splash Screen ─────────────────────────────────────────────────────
#define SPLASH_DURATION ${splashDuration}

const u16 splashScreenData[PIXEL_COUNT] = ${splashImageCArray};
`;
  }

  cCode += `
// ── Entry Point ─────────────────────────────────────────────────────────
int main() {
  REG_DISPCNT = MODE_3 | BG2_ENABLE;
  u16* screen = (u16*)VRAM;
`;

  if (hasSplash) {
    cCode += `
  // Mostrar SplashScreen inmediatamente
  {
    int i;
    for (i = 0; i < PIXEL_COUNT; i++) screen[i] = splashScreenData[i];
  }
  {
    int frames = SPLASH_DURATION * 60;
    int i;
    for (i = 0; i < frames; i++) waitVSync();
  }

  // Corte a negro
  memset(screen, 0, sizeof(splashScreenData));
`;
  } else {
    cCode += `
  // Sin splash - pantalla de prueba
  {
    int i;
    for (i = 0; i < PIXEL_COUNT; i++) screen[i] = 0x7C1F;
  }
`;
  }

  cCode += `
  while (1) waitVSync();
  return 0;
}
`;

  log.add(`${hasSplash ? `SplashScreen incluido (${splashDuration}s)` : 'Sin SplashScreen — pantalla púrpura'}`);
  log.add('Código fuente C generado correctamente');

  return cCode;
}

export function generateMakefile(name: string, log: ExportLog): string {
  // Sanitizar nombre para Makefile (sin espacios)
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

SRCS = main.c
OBJS = \$(SRCS:.c=.o)

all: \$(TARGET)

\$(TARGET): \$(OBJS)
	\$(LD) \$(LDFLAGS) -o \$(PROJNAME).elf \$(OBJS) -lgba
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
