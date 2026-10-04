// Compila tests/emulator/testrom.c a una ROM real con devkitARM.
// Si devkitARM no está, devuelve null y el test se salta con un motivo claro
// en vez de fallar con un error incomprensible.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, copyFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, 'testrom.c');

function devkitpro() {
  return process.env.DEVKITPRO || '/opt/devkitpro';
}

export function devkitArmAvailable() {
  const bin = join(devkitpro(), 'devkitARM', 'bin');
  return (
    existsSync(join(bin, 'arm-none-eabi-gcc')) &&
    existsSync(join(devkitpro(), 'libgba', 'lib', 'libgba.a'))
  );
}

/** @returns {string|null} ruta de la ROM compilada, o null si falta devkitARM */
export function buildTestRom() {
  if (!devkitArmAvailable()) return null;

  const dk = devkitpro();
  const gcc = join(dk, 'devkitARM', 'bin', 'arm-none-eabi-gcc');
  const objcopy = join(dk, 'devkitARM', 'bin', 'arm-none-eabi-objcopy');
  const gbafix = join(dk, 'tools', 'bin', 'gbafix');

  const dir = mkdtempSync(join(tmpdir(), 'ae-testrom-'));
  const name = basename(SRC, '.c');
  copyFileSync(SRC, join(dir, `${name}.c`));

  const env = {
    ...process.env,
    DEVKITPRO: dk,
    DEVKITARM: join(dk, 'devkitARM'),
    PATH: `${join(dk, 'devkitARM', 'bin')}:${join(dk, 'tools', 'bin')}:${process.env.PATH}`,
  };
  const run = (cmd, args) => execFileSync(cmd, args, { cwd: dir, env, stdio: 'pipe' });

  const ARCH = ['-mthumb', '-mthumb-interwork', '-mcpu=arm7tdmi'];
  run(gcc, ['-Wall', '-O2', ...ARCH, `-I${join(dk, 'libgba', 'include')}`, '-c', `${name}.c`, '-o', `${name}.o`]);
  run(gcc, [...ARCH, `-L${join(dk, 'libgba', 'lib')}`, '-specs=gba.specs', '-o', `${name}.elf`, `${name}.o`, '-lgba']);
  run(objcopy, ['-O', 'binary', `${name}.elf`, `${name}.gba`]);

  // gbafix pone el logo de Nintendo y el cabecera válidos; sin eso mGBA avisa
  // del checksum pero arranca igual. Lo hacemos igual por limpieza.
  if (existsSync(gbafix)) run(gbafix, [`${name}.gba`, '-p', '-tAEEMUTEST', '-cAE01', '-m01']);

  const rom = join(dir, `${name}.gba`);
  // El header de gbafix deja el logo en 0x04..0x9F y 0x96 en 0xB2.
  const head = readFileSync(rom).subarray(0, 0xB3);
  if (head[0xB2] !== 0x96) throw new Error('la ROM generada no tiene el header válido (falta gbafix?)');

  return rom;
}