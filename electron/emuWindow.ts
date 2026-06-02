import { BrowserWindow, app } from 'electron';
import * as path from 'path';

let emuWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

export function createEmulatorWindow(romPath: string): void {
  if (emuWindow && !emuWindow.isDestroyed()) {
    emuWindow.close();
    emuWindow = null;
  }

  emuWindow = new BrowserWindow({
    width: 780,
    height: 660,
    resizable: false,
    maximizable: false,
    minimizable: true,
    frame: false,
    title: 'Advance Studio — Emulador GBA',
    backgroundColor: '#0f0f1a',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const emuPagePath = path.join(
    isDev ? app.getAppPath() : __dirname,
    'public', 'emulator', 'index.html'
  );

  emuWindow.loadFile(emuPagePath, { query: { rom: romPath } });

  emuWindow.on('closed', () => {
    emuWindow = null;
  });
}

export function closeEmulatorWindow(): void {
  if (emuWindow && !emuWindow.isDestroyed()) {
    emuWindow.close();
    emuWindow = null;
  }
}

export function isEmulatorRunning(): boolean {
  return emuWindow !== null && !emuWindow.isDestroyed();
}
