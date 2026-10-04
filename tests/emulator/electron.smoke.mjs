// ─────────────────────────────────────────────────────────────────────────────
// Humo del camino Electron: el origen app:// y la ventana del emulador.
//
// El test de emulación (emu.spec.mjs) sirve public/emulator por http, que es lo
// que hace el export web. Pero la app usa el esquema app:// con protocol.handle(),
// y file:// no sirve para EJS. Este test comprueba que ese camino también
// funciona de verdad, launching la app Electron real.
//
// Necesita DISPLAY (xvfb-run npm run test:emulator si no hay).
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect, _electron as electron } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTestRom } from './build-test-rom.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

// La ROM se compila a nivel de módulo porque test.skip() se evalúa al RECOGER
// los tests, es decir antes de que corra beforeAll.
const romPath = buildTestRom();

let app = null;

test.beforeAll(async () => {
  if (!romPath) return;
  app = await electron.launch({
    args: [ROOT, '--no-sandbox', '--disable-gpu-sandbox'],
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: 'production' },
  });
});

test.afterAll(async () => {
  await app?.close();
});

test.skip(!romPath, 'devkitARM no disponible: no se puede compilar la ROM de prueba');

test('la ventana del emulador arranca con app:// y dibuja', async () => {
  const principal = await app.firstWindow();
  await principal.waitForLoadState('domcontentloaded');

  // El camino REAL de usuario: renderer → IPC → main → ventana del emulador.
  // Nada de colarse en los módulos internos.
  const res = await principal.evaluate((rom) => window.advanceAPI.emu.play(rom), romPath);
  expect(res.success, `emu:play falló: ${res.reason ?? '(sin motivo)'}`).toBe(true);

  const ventana = await app.waitForEvent('window', { timeout: 20_000 });
  await ventana.waitForLoadState('domcontentloaded');

  // La URL tiene que ser app://: con file:// Chromium no deja descargar el core.
  expect(ventana.url()).toMatch(/^app:\/\/emu\/index\.html/);

  await ventana.waitForFunction(() => window.__advanceEmu?.state === 'started', null, { timeout: 60_000 });

  // drawCalls se publica una vez por segundo, así que hay que esperar a que el
  // contador haya Published algo (leerlo en el instante de 'started' siempre da 0).
  await ventana.waitForFunction(() => (window.__advanceEmu?.drawCalls ?? 0) > 0, null, { timeout: 15_000 });
  const estado = await ventana.evaluate(() => window.__advanceEmu);
  expect(estado.error).toBeNull();
  expect(estado.everDrawn, 'no se dibujó ni un fotograma').toBe(true);

  const canvas = ventana.locator('#gba-mount canvas');
  await expect(canvas).toHaveCount(1);
  const box = await canvas.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(100);

  // Y stop debe cerrar la ventana de verdad.
  await principal.evaluate(() => window.advanceAPI.emu.stop());
  await ventana.waitForEvent('close', { timeout: 10_000 }).catch(() => {});
  const sigue = await principal.evaluate(() => window.advanceAPI.emu.isRunning());
  expect(sigue, 'emu:isRunning sigue diciendo que hay emulador').toBe(false);
});
