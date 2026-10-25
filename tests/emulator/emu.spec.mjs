// ─────────────────────────────────────────────────────────────────────────────
// El emulador dibuja de verdad (y no una pantalla negra)
//
// Este es el test que habría cazado el gbajs anterior: aquel emulaba bien pero
// tenía el blit comentado en js/video.js, así que la ventana salía negra. Aquí
// se mide la imagen real del canvas, que es lo único que no se puede maquillar.
//
// Se sirve public/emulator/ por HTTP porque EJS usa fetch() y Web Workers, y
// Chromium los bloquea en file:// (igual que hace que la app use app://).
//
// Uso:  npm run test:emulator
// ─────────────────────────────────────────────────────────────────────────────
import { test, expect, chromium } from '@playwright/test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, analyze } from './png.mjs';
import { serveDir } from './serve.mjs';
import { buildTestRom } from './build-test-rom.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const EMU_DIR = join(HERE, '..', '..', 'public', 'emulator');

/**
 * Estado que publica el shell en window.__advanceEmu (tipado en
 * src/renderer/global.d.ts). Aquí sin tipos porque el fichero es .mjs.
 * @typedef {{state:string, error:string|null, rom:string|null, fps?:number, everChanged?:boolean}} EmuState
 */

let server;
let browser;
let romPath = null;
let romUrl = null;
const fallosRed = [];
const peticiones = [];
/** Peticiones fuera de nuestro propio servidor: no debe haber ninguna. */
const externas = [];

test.beforeAll(async () => {
  romPath = buildTestRom();
  if (!romPath) return; // sin devkitARM los tests se saltan

  server = await serveDir(EMU_DIR, { '/__rom/testrom.gba': romPath });
  romUrl = `${server.origin}/__rom/testrom.gba`;

  browser = await chromium.launch({
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  });
});

test.afterAll(async () => {
  await browser?.close();
  await server?.close();
});

async function abrirYEsperar(page) {
  const errores = [];
  externas.length = 0;
  fallosRed.length = 0;

  // Wake Lock y autoplay los rechaza el navegador sin gesto del usuario: el
  // shell los ignora a propósito (no son fallos del emulador), así que aquí
  // también, o el test sería intermitente.
  const IGNORABLE = /Wake Lock|NotAllowedError|play\(\) request|user gesture|AudioContext/i;
  page.on('pageerror', (e) => { if (!IGNORABLE.test(e.message)) errores.push(e.message); });
  page.on('response', (r) => {
    peticiones.push(`${r.status()} ${r.url().slice(-60)}`);
    if (r.status() >= 400) fallosRed.push(`${r.status()} ${r.url()}`);
  });
  page.on('requestfailed', (r) => peticiones.push(`FAIL ${r.url().slice(-60)} ${r.failure()?.errorText}`));
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith('http://127.0.0.1') && !u.startsWith('blob:') && !u.startsWith('data:')) {
      externas.push(u);
    }
  });

  await page.goto(`http://127.0.0.1:${new URL(server.origin).port}/index.html?rom=${encodeURIComponent(romUrl)}&mode=editor`);

  // Que arranque de verdad: EJS no crea canvas hasta que el core está listo.
  try {
    await page.waitForFunction(() => window.__advanceEmu?.state === 'started', null, { timeout: 45_000 });
    // Barrera: esperar a que el core haya dibujado de verdad. Sin esto la
    // primera captura puede salir a medio pintar y los tests se vuelven
    // intermitentes (pasaba con el test de "imagen no negra").
    await page.waitForFunction(() => (window.__advanceEmu?.drawCalls ?? 0) > 20, null, { timeout: 30_000 });
  } catch (err) {
    // Fallar sin decir por qué es INDESCIFRABLE: volcar el estado real.
    const st = await page.evaluate(() => window.__advanceEmu).catch(() => '(sin estado)');
    const html = await page.evaluate(() => document.getElementById('gba-mount')?.innerHTML.slice(0, 400)).catch(() => '?');
    console.error('DIAG estado:', JSON.stringify(st));
    console.error('DIAG consola:', errores.join(' | ') || '(vacío)');
    console.error('DIAG red:', fallosRed.join(' | ') || '(vacío)');
    console.error('DIAG mount:', html);
    console.error('DIAG peticiones:', peticiones.join('\n  ') || '(ninguna)');
    throw err;
  }
  return errores;
}

/** Lee el canvas del emulador y lo analiza. */
/** Brillo (0-255) del píxel central del canvas. */
async function brilloCentro(page) {
  const buf = await page.locator('#gba-mount canvas').screenshot();
  const { width, height, channels, pixels } = decodePng(buf);
  const i = ((height >> 1) * width + (width >> 1)) * channels;
  return 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
}

/**
 * Lee la tira de 10 celdas de la esquina superior izquierda de la ROM de test
 * y devuelve los índices de las que están blancas.
 *
 * Cada celda es de 8x8 píxeles GBA, y el canvas de EJS es 720x480 = 3x, así que
 * el centro de la celda i está en (i*8+4)*3. Orden = bits de REG_KEYINPUT:
 * A B SELECT START RIGHT LEFT UP DOWN R L
 */
async function botonesPulsados(page) {
  const buf = await page.locator('#gba-mount canvas').screenshot();
  const { width, channels, pixels } = decodePng(buf);
  const escala = width / 240;

  const blancos = [];
  for (let i = 0; i < 10; i++) {
    const x = Math.round((i * 8 + 4) * escala);
    const y = Math.round(4 * escala);
    const p = (y * width + x) * channels;
    const lum = 0.299 * pixels[p] + 0.587 * pixels[p + 1] + 0.114 * pixels[p + 2];
    if (lum > 128) blancos.push(i);
  }
  return blancos;
}

/**
 * Espera a que la ROM muestre exactamente el botón esperado. Preguntar hasta que
 * pase es determinista; dormir un tiempo fijo fallaba de vez en cuando.
 */
async function esperarBotones(page, esperado, ms = 4000) {
  const limite = Date.now() + ms;
  let ultimo = [];
  while (Date.now() < limite) {
    ultimo = await botonesPulsados(page);
    if (JSON.stringify(ultimo) === JSON.stringify(esperado)) return ultimo;
    await new Promise((r) => setTimeout(r, 100));
  }
  return ultimo;
}

async function fotograma(page) {
  const canvas = page.locator('#gba-mount canvas');
  await expect(canvas).toHaveCount(1);
  const buf = await canvas.screenshot();
  return { buf, stats: analyze(decodePng(buf)) };
}

test('el core arranca y no pide nada por red que no tengamos', async () => {
  test.skip(!romPath, 'devkitARM no disponible: no se puede compilar la ROM de prueba');

  const page = await browser.newPage();
  const errores = await abrirYEsperar(page);

  // Lo que el shell tiene que cargar sí está en el repo, así que cualquier 404
  // significa que falta un asset vendored.
  expect(fallosRed, `peticiones fallidas:\n${fallosRed.join('\n')}`).toEqual([]);
  expect(errores).toEqual([]);

  const st = await page.evaluate(() => window.__advanceEmu);
  expect(st.state).toBe('started');
  expect(st.error).toBeNull();

  await page.close();
});

test('no sale a Internet: todo se sirve desde el repo', async () => {
  test.skip(!romPath, 'devkitARM no disponible: no se puede compilar la ROM de prueba');

  const page = await browser.newPage();
  await abrirYEsperar(page);
  await page.waitForTimeout(2500);

  // El export web y el .exe tienen que funcionar sin conexión. EJS tenía un
  // fetch hardcodeado al CDN (por el aviso de "using stable"), así que esto
  // vigila que el parche de scripts/fetch-emulatorjs.mjs siga en su sitio.
  expect(externas, `salidas a Internet:\n${externas.join('\n')}`).toEqual([]);

  await page.close();
});

test('el emulador dibuja una imagen real, no negra', async () => {
  test.skip(!romPath, 'devkitARM no disponible: no se puede compilar la ROM de prueba');

  const page = await browser.newPage();
  await abrirYEsperar(page);

  const { stats } = await fotograma(page);

  // La ROM de test pinta un damero de verdes: si sale negro, no está dibujando.
  // Ojo con el umbral: una pantalla "casi negra" (lumMax 85) colaría con 32, y eso
  // es justo el fallo que hay que cazar. El damero real da ~120 de media.
  expect(stats.negro, 'el canvas salió completamente negro').toBe(false);
  // Medido con la ROM de test: el damero da lumMedia ~118 y lumMax ~147; una
  // ventana sin dibujar da 0.08 y 0. El margen está entre medias, muy holgado.
  expect(stats.lumMedia, 'la imagen está casi apagada: parece un frame en negro').toBeGreaterThan(50);
  expect(stats.lumMax, 'no hay ningún píxel iluminado').toBeGreaterThan(100);
  expect(stats.colores, 'la imagen es plana: no parece un frame de juego').toBeGreaterThan(8);

  await page.close();
});

test('la emulación avanza: la imagen cambia entre fotogramas', async () => {
  test.skip(!romPath, 'devkitARM no disponible: no se puede compilar la ROM de prueba');

  const page = await browser.newPage();
  await abrirYEsperar(page);
  await page.waitForTimeout(600);

  // El cuadro central de la ROM de test lleva el contador de frames en el canal
  // rojo, así que dos muestras separadas tienen que diferir.
  const primera = await fotograma(page);
  await page.waitForTimeout(700);
  const segunda = await fotograma(page);

  expect(primera.buf.equals(segunda.buf), 'dos fotogramas seguidos son idénticos: la ROM no avanza').toBe(false);

  const st = await page.evaluate(() => window.__advanceEmu);
  expect(st.everDrawn, 'el core llegó a arrancar pero no drew ni un fotograma').toBe(true);
  expect(st.fps, 'no se detectaron fotogramas por segundo').toBeGreaterThan(10);

  await page.close();
});

test('la entrada llega a la ROM: pulsar A cambia el color del cuadro', async () => {
  test.skip(!romPath, 'devkitARM no disponible: no se puede compilar la ROM de prueba');

  const page = await browser.newPage();
  await abrirYEsperar(page);
  await page.waitForTimeout(500);

  const antes = await brilloCentro(page);
  // El cuadro va recorriendo el rojo mientras no se pulse nada, así que puede
  // estar bastante claro. La señal inequívoca es que se vuelva blanco del todo.
  expect(antes, 'el cuadro ya salía blanco antes de pulsar nada').toBeLessThan(200);

  // El botón A del GBA. El shell lo mapea a 'KeyZ' → BUTTON_1.
  await page.keyboard.down('KeyZ');
  await page.waitForTimeout(350);
  const durante = await brilloCentro(page);
  await page.keyboard.up('KeyZ');

  expect(durante, `pulsar A no puso el cuadro en blanco (brillo ${antes} → ${durante})`).toBeGreaterThan(240);

  await page.close();
});

test('los botones de la pantalla pulsan botones del juego', async () => {
  test.skip(!romPath, 'devkitARM no disponible: no se puede compilar la ROM de prueba');

  const page = await browser.newPage();
  await abrirYEsperar(page);
  await page.waitForTimeout(500);

  const antes = await brilloCentro(page);

  const start = page.locator('#btn-start');
  await expect(start).toBeVisible();
  const box = await start.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(350);
  const durante = await brilloCentro(page);
  await page.mouse.up();

  expect(durante, `el botón START de la pantalla no llegó a la ROM (brillo ${antes} → ${durante})`).toBeGreaterThan(240);

  await page.close();
});

test('sin ROM no se queda en negro: avisa', async () => {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${new URL(server.origin).port}/index.html`);

  const st = await page.evaluate(() => window.__advanceEmu);
  expect(st.state).toBe('error');
  await expect(page.locator('#error-overlay')).toHaveClass(/visible/);

  await page.close();
});

// Los botones de la GBA, en el orden de los bits de REG_KEYINPUT.
const BOTONES_GBA = ['A', 'B', 'SELECT', 'START', 'DERECHA', 'IZQUIERDA', 'ARRIBA', 'ABAJO', 'R', 'L'];

test('cada tecla del teclado llega a su botón de la GBA', async () => {
  test.skip(!romPath, 'devkitARM no disponible: no se puede compilar la ROM de prueba');

  const TECLAS = [
    ['KeyZ', 0], ['KeyX', 1], ['KeyV', 2], ['Enter', 3],
    ['ArrowRight', 4], ['ArrowLeft', 5], ['ArrowUp', 6], ['ArrowDown', 7],
    ['KeyS', 8], ['KeyA', 9],
  ];

  for (const [code, bit] of TECLAS) {
    const page = await browser.newPage();
    await abrirYEsperar(page);
    await page.waitForTimeout(350);

    await page.keyboard.down(code);
    const pressed = await esperarBotones(page, [bit]);
    await page.keyboard.up(code);

    expect(pressed, `${code} debería pulsar ${BOTONES_GBA[bit]} y solo eso`).toEqual([bit]);
    await page.close();
  }
});

test('el d-pad se mueve de verdad: el jugador camina hacia la derecha', async () => {
  test.skip(!romPath, 'devkitARM no disponible: no se puede compilar la ROM de prueba');

  // Con la ROM de test el d-pad no mueve nada (solo cambia colores), así que
  // esto mide la sincronía real: mantener la flecha tiene que mantener el bit.
  const page = await browser.newPage();
  await abrirYEsperar(page);
  await page.waitForTimeout(350);

  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(200);
  expect(await botonesPulsados(page)).toEqual([4]);
  await page.waitForTimeout(600);
  expect(await botonesPulsados(page), 'soltó la flecha solo tras 600 ms').toEqual([4]);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(200);
  expect(await botonesPulsados(page), 'soltar la flecha dejó el botón pegado').toEqual([]);

  await page.close();
});

test('las teclas también llegan con el foco en otro sitio', async () => {
  test.skip(!romPath, 'devkitARM no disponible: no se puede compilar la ROM de prueba');

  // Reproduce el fallo real: EJS escucha en el contenedor del emulador, así que
  // si el foco está en body (p.ej. tras hacer clic en la barra de título) las
  // teclas no le llegan y el juego no responde. Con el reenvío de respaldo
  // tienen que llegar igual.
  const page = await browser.newPage();
  await abrirYEsperar(page);
  await page.waitForTimeout(400);

  await page.evaluate(() => document.getElementById('game-fps').focus());
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('game-fps');

  await page.keyboard.down('KeyZ');
  await page.waitForTimeout(250);
  expect(await botonesPulsados(page), 'con el foco fuera del emulador, Z no llegó a la ROM').toEqual([0]);
  await page.keyboard.up('KeyZ');
  await page.waitForTimeout(200);
  expect(await botonesPulsados(page), 'soltar Z dejó el botón pegado').toEqual([]);

  // Y con dos teclas a la vez (correr hacia arriba mientras se salta).
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(250);
  // en orden de bit: DERECHA(4) antes que ARRIBA(6)
  expect(await botonesPulsados(page)).toEqual([4, 6]);
  await page.keyboard.up('ArrowUp');
  await page.keyboard.up('ArrowRight');

  await page.close();
});

test('cada botón en pantalla llega a su botón de la GBA', async () => {
  test.skip(!romPath, 'devkitARM no disponible: no se puede compilar la ROM de prueba');

  const BOTONES_UI = [
    ['#btn-a', 0], ['#btn-b', 1], ['#btn-select', 2], ['#btn-start', 3],
    ['#dpad-right', 4], ['#dpad-left', 5], ['#dpad-up', 6], ['#dpad-down', 7],
    ['#btn-r', 8], ['#btn-l', 9],
  ];

  for (const [sel, bit] of BOTONES_UI) {
    const page = await browser.newPage();
    await abrirYEsperar(page);
    await page.waitForTimeout(350);

    const el = page.locator(sel);
    await expect(el).toBeVisible();
    const box = await el.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    const pressed = await esperarBotones(page, [bit]);
    await page.mouse.up();

    expect(pressed, `${sel} debería pulsar ${BOTONES_GBA[bit]} y solo eso`).toEqual([bit]);
    await page.close();
  }
});

test('el contador de FPS y el nombre de la ROM se ven arriba del juego', async () => {
  test.skip(!romPath, 'devkitARM no disponible: no se puede compilar la ROM de prueba');

  const page = await browser.newPage();
  await abrirYEsperar(page);
  await page.waitForTimeout(1200);

  const info = page.locator('#game-info');
  await expect(info).toBeVisible();

  const romName = await page.locator('#game-rom').textContent();
  expect(romName).toContain('testrom');

  const fps = await page.locator('#game-fps').textContent();
  expect(fps).toMatch(/\d+ FPS/);

  await page.close();
});
