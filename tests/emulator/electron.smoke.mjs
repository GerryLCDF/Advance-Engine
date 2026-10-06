// ─────────────────────────────────────────────────────────────────────────────
// Humo del camino Electron: el origen app://, la ventana y los botones.
//
// El test de emulación (emu.spec.mjs) sirve public/emulator por http, que es lo
// que hace el export web. Pero la app usa el esquema app:// con protocol.handle(),
// y file:// no sirve para EJS. Aquí se lanza la app Electron real y se va por el
// camino del usuario: renderer → advanceAPI.emu.play → IPC → main → ventana.
//
// Va en su propia pasada (playwright.app.config.mjs) y en un SOLO test a
// propósito: relanzar Electron varias veces seguidas dentro del mismo proceso
// dejaba la segunda ventana principal sin preload y el resultado era
// intermitente. Con una sola app y una sola ventana de emulador es determinista.
//
// Necesita DISPLAY (xvfb-run npm run test:emulator:app si no hay).
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTestRom } from './build-test-rom.mjs';
import { decodePng } from './png.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

// A nivel de módulo porque test.skip() se evalúa al recoger los tests, antes
// de que corra beforeAll.
const romPath = buildTestRom();
const BIT = ['A', 'B', 'SELECT', 'START', 'DERECHA', 'IZQUIERDA', 'ARRIBA', 'ABAJO', 'R', 'L'];

/**
 * Ventana principal de la app.
 *
 * NO vale app.firstWindow(): con Electron + Playwright se abre también la de
 * DevTools y a veces es la primera, así que firstWindow() devolvía el DevTools
 * (url devtools://) y el preload advanceAPI no existía nunca. Se elige la
 * ventana que carga el renderer de la app.
 */
async function esperarVentanaPrincipal(app) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    for (const w of app.windows()) {
      const url = w.url();
      if (url.startsWith('devtools://')) continue;
      if (url && url !== 'about:blank') return w;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('la ventana principal de la app no apareció');
}

test('la app abre el emulador por app://, dibuja y mapea los botones', async () => {
  test.skip(!romPath, 'devkitARM no disponible: no se puede compilar la ROM de prueba');

  // --user-data-dir propio: si el Electron del usuario y este se pelean por el
  // perfil, Chromium se queda colgado sin montar nada.
  const perfil = mkdtempSync(join(tmpdir(), 'ae-emu-perfil-'));
  const app = await electron.launch({
    args: [ROOT, '--no-sandbox', '--disable-gpu-sandbox', `--user-data-dir=${perfil}`],
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: 'production' },
  });

  // Se declara fuera del try porque leds() la usa y el try bloquea su alcance.
  let ventana;

  /**
   * Espera a que la ROM muestre exactamente el botón esperado.
   *
   * Antes se dormía un tiempo fijo y la botón en pantalla fallaba de vez en
   * cuando (220 ms no siempre dan para que el core llegue a pintar el
   * fotograma). Preguntando hasta que pase es determinista y más rápido.
   */
  const esperarLeds = async (esperado, ms = 4000) => {
    const limite = Date.now() + ms;
    let ultimo = [];
    while (Date.now() < limite) {
      ultimo = await leds();
      if (JSON.stringify(ultimo) === JSON.stringify(esperado)) return ultimo;
      await new Promise((r) => setTimeout(r, 100));
    }
    return ultimo;
  };

  /** Lee la tira de 10 celdas y devuelve los botones GBA que están blancos. */
  const leds = async () => {
    const buf = await ventana.locator('#gba-mount canvas').screenshot();
    const { width, channels, pixels } = decodePng(buf);
    const escala = width / 240;
    const out = [];
    for (let i = 0; i < 10; i++) {
      const x = Math.round((i * 8 + 4) * escala);
      const y = Math.round(4 * escala);
      const p = (y * width + x) * channels;
      const lum = 0.299 * pixels[p] + 0.587 * pixels[p + 1] + 0.114 * pixels[p + 2];
      if (lum > 128) out.push(i);
    }
    return out;
  };

  try {
    // ── la ventana principal ────────────────────────────────────────────
    const principal = await esperarVentanaPrincipal(app);
    await principal.waitForLoadState('domcontentloaded');
    await principal.waitForFunction(() => !!window.advanceAPI, null, { timeout: 30_000 });

    // ── abrir el emulador por el IPC real ───────────────────────────────
    const res = await principal.evaluate((rom) => window.advanceAPI.emu.play(rom), romPath);
    expect(res.success, `emu:play falló: ${res.reason ?? '(sin motivo)'}`).toBe(true);

    // El log se manda AHORA MISMO, antes de que la página haya cargado, igual que
    // hace la app: comprueba que el búfer existe y no se pierde el mensaje.
    await principal.evaluate((rom) => window.advanceAPI.emu.sendLog([
      `[INFO] ROM de prueba: ${rom.split('/').pop()}`,
      '[OK] Compilada sin errores',
      '[WARN] Un aviso de prueba',
      '[ERROR] Un error de prueba',
    ]), romPath);

    ventana = await app.waitForEvent('window', { timeout: 30_000 });
    await ventana.waitForLoadState('domcontentloaded');

    // Con file:// Chromium no deja descargar el core, así que esto no es
    // cosmético: es lo que decide si el emulador funciona.
    expect(ventana.url()).toMatch(/^app:\/\/emu\/index\.html/);

    await ventana.waitForFunction(() => window.__advanceEmu?.state === 'started', null, { timeout: 60_000 });
    // Barrera: no medir hasta que el core haya pintado de verdad.
    await ventana.waitForFunction(() => (window.__advanceEmu?.drawCalls ?? 0) > 20, null, { timeout: 30_000 });

    const estado = await ventana.evaluate(() => window.__advanceEmu);
    expect(estado.error).toBeNull();
    expect(estado.everDrawn, 'no se dibujó ni un fotograma').toBe(true);

    await expect(ventana.locator('#gba-mount canvas')).toHaveCount(1);
    expect((await ventana.locator('#gba-mount canvas').boundingBox())?.width ?? 0).toBeGreaterThan(100);

    // ── el mapeo de botones, en el core que usa de verdad la app ─────────
    // OJO: el test de HTTP usa el core legacy (WebGL1) porque el Chromium
    // headless no da WebGL2, mientras que Electron sí y usa mgba-wasm.data. Si
    // un core ordenara los botones distinto, los controles funcionarían en el
    // test y fallarían en la app.
    const TECLAS = [
      ['KeyZ', 0], ['KeyX', 1], ['KeyV', 2], ['Enter', 3],
      ['ArrowRight', 4], ['ArrowLeft', 5], ['ArrowUp', 6], ['ArrowDown', 7],
      ['KeyS', 8], ['KeyA', 9],
    ];
    for (const [code, bit] of TECLAS) {
      await ventana.keyboard.down(code);
      expect(await esperarLeds([bit]), `${code} debería pulsar ${BIT[bit]} y solo eso`).toEqual([bit]);
      await ventana.keyboard.up(code);
      expect(await esperarLeds([]), `${code} se quedó pulsado al soltarlo`).toEqual([]);
    }

    // Los botones en pantalla van por el camino sintético, no por teclado real.
    const BOTONES = [
      ['#btn-a', 0], ['#btn-b', 1], ['#btn-select', 2], ['#btn-start', 3],
      ['#dpad-right', 4], ['#dpad-left', 5], ['#dpad-up', 6], ['#dpad-down', 7],
      ['#btn-r', 8], ['#btn-l', 9],
    ];
    for (const [sel, bit] of BOTONES) {
      const box = await ventana.locator(sel).boundingBox();
      await ventana.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await ventana.mouse.down();
      expect(await esperarLeds([bit]), `${sel} debería pulsar ${BIT[bit]} y solo eso`).toEqual([bit]);
      await ventana.mouse.up();
      expect(await esperarLeds([]), `${sel} se quedó pulsado`).toEqual([]);
    }

    // ── la pestaña Registro ──────────────────────────────────────────────
    await expect(ventana.locator('#tab-log')).toBeVisible();
    await ventana.locator('#tab-log').click();

    await expect(ventana.locator('#log-panel')).toHaveClass(/activo/);
    // La de Juego se oculta al cambiar de pestaña.
    await expect(ventana.locator('#container')).toBeHidden();

    // Diagnóstico: estado y FPS tienen que salir de verdad, no guiones.
    const diag = await ventana.locator('#diag .celda').allTextContents();
    expect(diag.join(' | '), 'el panel de diagnóstico está vacío').toContain('Estado');
    expect(diag.join(' '), `no se ve el core en el diagnóstico: ${JSON.stringify(diag)}`).toContain('mGBA/WASM');
    expect(diag.join(' '), `no se ve la resolución: ${JSON.stringify(diag)}`).toMatch(/\d+x\d+/);

    // Y el log que mandó el editor tiene que estar ahí, con la ROM de prueba.
    const lineas = await ventana.locator('#log-list .l').allTextContents();
    expect(lineas.length, 'la pestaña Registro llegó vacía').toBeGreaterThan(0);
    const texto = lineas.join('\n');
    expect(texto, 'el log no llegó (o se perdió por mandarlo antes de que cargara la página)').toContain('testrom.gba');
    expect(texto).toContain('Compilada sin errores');

    // Las líneas se colorean por gravedad y el contador marca los errores.
    await expect(ventana.locator('#log-list .l.error')).toHaveText('[ERROR] Un error de prueba');
    await expect(ventana.locator('#log-list .l.warn')).toHaveText('[WARN] Un aviso de prueba');
    await expect(ventana.locator('#log-contador')).toHaveText('1');

    // Volver a Juego y comprobar que el emulador sigue vivo.
    await ventana.locator('#tab-juego').click();
    await expect(ventana.locator('#log-panel')).toBeHidden();
    await ventana.locator('#gba-mount canvas').screenshot();
    expect(await esperarLeds([]), 'el emulador se paró al cambiar de pestaña').toEqual([]);

    // ── el log no debe llenarse de ruido ────────────────────────────────
    // Electron suelta avisos de seguridad y de Autofill por consola, y el
    // navegador avisa de Wake Lock y del audio automático. Ninguno es un fallo
    // del emulador, así que no pueden llegar al log del editor como [ERROR].
    const ruido = await principal.evaluate(async () => {
      const lineas = [];
      const sin = window.advanceAPI.emu.onEmulatorStatus(({ msg }) => lineas.push(msg));
      await window.advanceAPI.emu.play('__no_existe__.gba');
      await new Promise((r) => setTimeout(r, 1500));
      sin();
      return lineas;
    });
    expect(
      ruido.filter((m) => /Security Warning|Autofill|Wake Lock|%c|font-weight/.test(m)),
      `ruido de Electron en el log del emulador:\n${ruido.join('\n')}`
    ).toEqual([]);
    expect(ruido.some((m) => m.startsWith('[emulador]')), 'ni siquiera se registró el fallo').toBe(true);

    // ── y stop tiene que cerrar la ventana ───────────────────────────────
    await principal.evaluate(() => window.advanceAPI.emu.stop());
    expect(await principal.evaluate(() => window.advanceAPI.emu.isRunning())).toBe(false);
  } finally {
    // Con el try/finally la app siempre se cierra. Sin esto, una corrida que
    // fallaba antes del cierre dejaba Electron zombis, y unos cuantos cargaban
    // tanto la máquina que el siguiente arranque no montaba ni el preload.
    await app.close().catch(() => {});
  }
});