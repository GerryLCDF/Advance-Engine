import { BrowserWindow, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let emuWindow: BrowserWindow | null = null;
/** ROM que se está emulando, para poder servirla como app://emu/rom/<nombre>. */
let currentRomPath: string | null = null;

type StatusSink = (level: 'info' | 'error', msg: string) => void;
let statusSink: StatusSink | null = null;

export function setEmulatorStatusSink(sink: StatusSink | null): void {
  statusSink = sink;
}

/**
 * Avisa al renderer del estado que publica el propio shell (window.__advanceEmu).
 * Exportado para que main.ts pueda conectarlo al IPC emu:status.
 */
export function reportEmulatorStatus(level: 'info' | 'error', msg: string): void {
  report(level, msg);
}

/**
 * Estado real de la ventana del emulador, para que el botón PLAY/STOP de la barra
 * sepa si está corriendo. Se manda al abrir, al arrancar el juego y al cerrar
 * (la puede cerrar el usuario con la X o con Esc).
 */
export function emitEmulatorState(state: 'starting' | 'started' | 'closed'): void {
  try {
    mainWindowRef?.webContents.send('emu:state', { state });
  } catch { /* best-effort */ }
}

let mainWindowRef: BrowserWindow | null = null;
export function setMainWindowRef(w: BrowserWindow | null): void {
  mainWindowRef = w;
}

function report(level: 'info' | 'error', msg: string): void {
  try {
    statusSink?.(level, msg);
  } catch {
    /* el log es best-effort: nunca debe romper el emulador */
  }

  // También a la ventana del emulador, para su pestaña Registro: si estás
  // mirando el juego tienes que ver el log sin cambiar de pestaña en el editor.
  try {
    emuWindow?.webContents.send('emu:log', { level, msg });
  } catch {
    /* la ventana puede estar cerrándose */
  }
}

/**
 * Log que se le pasa a la ventana del emulador para su pestaña Registro.
 *
 * Se guarda en un búfer y se entrega cuando la página ha cargado, porque
 * emu:play devuelve nada más crear la ventana: si se mandara el log en ese
 * momento, la página todavía no tiene preload escuchando y el mensaje se
 * pierde. (Costó un test en rojo descubrirlo.)
 */
let logPendiente: string[] | null = null;
let emuCargada = false;

export function pushLogToEmulator(lines: string[]): void {
  logPendiente = Array.isArray(lines) ? lines.slice(-400) : [];

  if (!emuCargada || !emuWindow || emuWindow.isDestroyed()) return;

  try {
    emuWindow.webContents.send('emu:log:snapshot', { lines: logPendiente });
    logPendiente = null;
  } catch { /* best-effort */ }
}

/**
 * Carpeta que contiene public/emulator/ (y por tanto ejs/ con los assets).
 * Sirve tanto en desarrollo como dentro de app.asar.
 */
export function emulatorRootDir(): string {
  const base = app.getAppPath();

  const candidates = [
    path.join(base, 'public', 'emulator'),
    path.join(base, '..', '..', 'public', 'emulator'), // dev: repo/ desde dist/electron/
    path.join(__dirname, '..', '..', '..', 'public', 'emulator'),
  ];

  for (const dir of candidates) {
    try {
      if (fs.existsSync(path.join(dir, 'index.html'))) return dir;
    } catch { /* siguiente */ }
  }
  return candidates[0];
}

/**
 * Traduce una URL app://emu/... a un archivo en disco.
 * Devuelve null si no corresponde (que es distinto de "existe pero vacío").
 *
 *   app://emu/index.html      → public/emulator/index.html
 *   app://emu/ejs/loader.js   → public/emulator/ejs/loader.js
 *   app://emu/rom/mi.gba      → la ROM en curso
 */
export function resolveEmulatorFile(requestUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  if (url.host !== 'emu') return null;

  const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';

  if (rel === 'rom' || rel.startsWith('rom/')) {
    return currentRomPath && fs.existsSync(currentRomPath) ? currentRomPath : null;
  }

  const root = emulatorRootDir();
  const file = path.join(root, rel);
  // Nada de salirse de public/emulator con '../'
  if (!file.startsWith(root + path.sep)) return null;

  try {
    return fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
  } catch {
    return null;
  }
}

export function createEmulatorWindow(romPath: string): void {
  closeEmulatorWindow();
  currentRomPath = romPath;

  emuWindow = new BrowserWindow({
    width: 780,
    // La altura no es arbitraria: 32 (título) + 31 (pestañas) + 24 (padding) +
    // 480 (pantalla) + 20 (huecos) + 104 (mandos) + 14 (estado) + 12 (ayuda)
    // ≈ 717. Con 660 la pantalla de juego quedaba cortada por arriba.
    height: 770,
    resizable: false,
    maximizable: false,
    minimizable: true,
    frame: false,
    title: 'Advance Studio — Emulador GBA',
    backgroundColor: '#0f0f1a',
    webPreferences: {
      // Sin nodeIntegration: la ROM y los assets llegan por app://, así que la
      // página no necesita tocar el sistema de ficheros.
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'emuPreload.js'),
    },
  });

  // Si algo falla, no podemos callárnoslo: el síntoma sería una ventana negra
  // sin explicación, que es justo lo que pasaba antes.
  emuWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    report('error', `[emulador] No se pudo cargar ${url} → ${desc} (código ${code})`);
  });
  // Ruido que NO es del emulador y no debe salir como [ERROR] en el log:
  //  - Wake Lock y audio automático: el navegador los rechaza sin gesto del usuario
  //  - "Electron Security Warning": aviso del propio runtime de Electron (que
  //    además llega con los códigos de estilo %c de DevTools pegados)
  //  - Autofill: avisos internos de Chromium
  const IGNORABLE =
    /Wake Lock|NotAllowedError|play\(\) request|user gesture|AudioContext|Electron Security Warning|Autofill/i;

  emuWindow.webContents.on('console-message', (_e, level, message, line, source) => {
    if (level < 2) return;
    if (IGNORABLE.test(message)) return;

    // Los avisos de Electron llegan con directives de estilo %c de DevTools
    // ("%cElectron Security Warning font-weight: bold;"). Se quitan para que el
    // texto que se lea sea el del problema, no el de su maquetación.
    const limpio = message.replace(/%c/g, '').replace(/\s{2,}/g, ' ').trim();
    report('error', `[emulador] ${limpio} (${String(source).split('/').pop()}:${line})`);
  });
  emuWindow.webContents.on('render-process-gone', (_e, details) => {
    report('error', `[emulador] el proceso de render murió (${details.reason})`);
    emitEmulatorState('closed');
  });

  emuCargada = false;
  emitEmulatorState('starting');

  emuWindow.webContents.on('did-finish-load', () => {
    emuCargada = true;
    if (logPendiente) pushLogToEmulator(logPendiente);
  });

  emuWindow.on('closed', () => {
    emuWindow = null;
    currentRomPath = null;
    emuCargada = false;
    logPendiente = null;
    emitEmulatorState('closed');
  });

  const romUrl = `app://emu/rom/${encodeURIComponent(path.basename(romPath))}`;
  emuWindow.loadURL(`app://emu/index.html?rom=${encodeURIComponent(romUrl)}&mode=editor`);
}

export function closeEmulatorWindow(): void {
  if (emuWindow && !emuWindow.isDestroyed()) {
    emuWindow.close();
    emuWindow = null;
  }
  currentRomPath = null;
}

export function isEmulatorRunning(): boolean {
  return emuWindow !== null && !emuWindow.isDestroyed();
}