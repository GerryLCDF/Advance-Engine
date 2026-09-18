import { app, BrowserWindow, ipcMain, dialog, shell, nativeImage, protocol, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { exec, execFileSync, spawn } from 'child_process';
import { createEmulatorWindow, closeEmulatorWindow, isEmulatorRunning } from './emuWindow';

// isDev: true cuando se corre con NODE_ENV=development (npm run dev)
// app.isPackaged es seguro de leer en cualquier momento del proceso principal
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Datos en JSON local — se inicializa cuando app está lista
let projectsFile = '';

function initPaths() {
  const userDataPath = app.getPath('userData');
  projectsFile = path.join(userDataPath, 'projects.json');
}

function readProjects(): Project[] {
  try {
    if (fs.existsSync(projectsFile)) {
      return JSON.parse(fs.readFileSync(projectsFile, 'utf-8'));
    }
  } catch { /* ignore */ }
  return [];
}

function writeProjects(projects: Project[]): void {
  fs.writeFileSync(projectsFile, JSON.stringify(projects, null, 2), 'utf-8');
}

interface Project {
  id: string;
  name: string;
  author: string;
  path: string;
  template: string;
  coverPath: string;
  lastOpened: string;
}

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 820,
    height: 580,
    resizable: true,
    maximizable: true,
    minWidth: 820,
    minHeight: 580,
    center: true,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#2a2a2e',
    icon: path.join(__dirname, '../../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });

  // ── Window Snapping (like Windows Aero Snap) ──────────────────────────────
  if (process.platform === 'win32') {
    const SNAP_THRESHOLD = 20;
    let snapTimeout: NodeJS.Timeout | null = null;

    const applySnap = () => {
      if (!mainWindow || mainWindow.isMaximized()) return;
      const [wx, wy] = mainWindow.getPosition();
      const [ww, wh] = mainWindow.getSize();
      const cursor = screen.getCursorScreenPoint();
      const display = screen.getDisplayNearestPoint(cursor);
      const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
      const [minW, minH] = mainWindow.getMinimumSize();

      const nearLeft = Math.abs(wx - dx) < SNAP_THRESHOLD;
      const nearRight = Math.abs((wx + ww) - (dx + dw)) < SNAP_THRESHOLD;
      const nearTop = Math.abs(wy - dy) < SNAP_THRESHOLD;
      const nearBottom = Math.abs((wy + wh) - (dy + dh)) < SNAP_THRESHOLD;

      let newX = wx, newY = wy, newW = ww, newH = wh;
      let snap = false;

      if (nearTop && !nearLeft && !nearRight) {
        newX = dx; newY = dy; newW = dw; newH = dh; snap = true;
      } else if (nearLeft && nearTop) {
        newX = dx; newY = dy; newW = Math.floor(dw / 2); newH = Math.floor(dh / 2); snap = true;
      } else if (nearRight && nearTop) {
        newX = dx + Math.floor(dw / 2); newY = dy; newW = Math.floor(dw / 2); newH = Math.floor(dh / 2); snap = true;
      } else if (nearLeft && nearBottom) {
        newX = dx; newY = dy + Math.floor(dh / 2); newW = Math.floor(dw / 2); newH = Math.floor(dh / 2); snap = true;
      } else if (nearRight && nearBottom) {
        newX = dx + Math.floor(dw / 2); newY = dy + Math.floor(dh / 2); newW = Math.floor(dw / 2); newH = Math.floor(dh / 2); snap = true;
      } else if (nearLeft) {
        newX = dx; newY = dy; newW = Math.floor(dw / 2); newH = dh; snap = true;
      } else if (nearRight) {
        newX = dx + Math.floor(dw / 2); newY = dy; newW = Math.floor(dw / 2); newH = dh; snap = true;
      } else if (nearBottom) {
        newX = dx; newY = dy + Math.floor(dh / 2); newW = dw; newH = Math.floor(dh / 2); snap = true;
      }

      if (snap && newW >= minW && newH >= minH) {
        mainWindow.setBounds({ x: newX, y: newY, width: newW, height: newH });
      }
    };

    // Live snap during drag (throttled)
    mainWindow.on('move', () => {
      if (snapTimeout) clearTimeout(snapTimeout);
      snapTimeout = setTimeout(applySnap, 50);
    });

    // Snap on release
    mainWindow.on('moved', applySnap);
  }
}

// ── Helpers de sistema de archivos ──────────────────────────────────────────

const GBA_PROJECTS_DIR = path.join(app.getPath('documents'), 'AdvanceEngineProjects');
const PROJECT_FOLDERS = ['backgrounds', 'fonts', 'music', 'sounds', 'sprites', 'tilesets', 'ui', 'avatars', 'script', 'dialog', 'fx'];

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Normaliza rutas recibidas del frontend: los separadores `\` (Windows) se
// convierten a `/` para que funcionen igual en Linux y en Windows.
function normPath(p: string | undefined): string {
  return (p ?? '').replace(/\\/g, '/');
}

ipcMain.handle('project:ensureProjectsDir', () => {
  ensureDir(GBA_PROJECTS_DIR);
  return GBA_PROJECTS_DIR;
});

ipcMain.handle('project:save', async (_e, projectId: string, data: { name: string; state: any }) => {
  try {
    const dir = path.join(GBA_PROJECTS_DIR, data.name);
    ensureDir(dir);
    for (const folder of PROJECT_FOLDERS) {
      ensureDir(path.join(dir, folder));
    }

    // Save project.json
    const manifest = {
      id: projectId,
      name: data.name,
      path: dir,
      version: '0.26.0',
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify(manifest, null, 2), 'utf-8');

    // Save editor state
    fs.writeFileSync(path.join(dir, 'editor-state.json'), JSON.stringify(data.state, null, 2), 'utf-8');

    return { success: true, path: dir };
  } catch (err) {
    return { success: false, reason: String(err) };
  }
});

ipcMain.handle('project:load', async (_e, projectPath: string) => {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(projectPath, 'project.json'), 'utf-8'));
    const stateRaw = fs.readFileSync(path.join(projectPath, 'editor-state.json'), 'utf-8');
    let state: any;
    try { state = JSON.parse(stateRaw); } catch { state = null; }
    return { success: true, manifest, state };
  } catch (err) {
    return { success: false, reason: String(err) };
  }
});

ipcMain.handle('project:listLocal', () => {
  try {
    ensureDir(GBA_PROJECTS_DIR);
    const entries = fs.readdirSync(GBA_PROJECTS_DIR, { withFileTypes: true });
    const projects = entries
      .filter(e => e.isDirectory())
      .map(e => {
        const manPath = path.join(GBA_PROJECTS_DIR, e.name, 'project.json');
        try {
          const man = JSON.parse(fs.readFileSync(manPath, 'utf-8'));
          return man;
        } catch { return null; }
      })
      .filter(Boolean);
    return { success: true, projects };
  } catch (err) {
    return { success: false, reason: String(err) };
  }
});

ipcMain.handle('project:deleteLocal', async (_e, projectPath: string) => {
  try {
    fs.rmSync(projectPath, { recursive: true, force: true });
    return { success: true };
  } catch (err) {
    return { success: false, reason: String(err) };
  }
});

// File I/O helpers for assets
ipcMain.handle('file:readText', async (_e, filePath: string) => {
  try {
    return { success: true, data: fs.readFileSync(filePath, 'utf-8') };
  } catch (err) {
    return { success: false, reason: String(err) };
  }
});

ipcMain.handle('file:writeText', async (_e, filePath: string, content: string) => {
  try {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (err) {
    return { success: false, reason: String(err) };
  }
});

ipcMain.handle('file:copy', async (_e, src: string, dest: string) => {
  try {
    const normalizedDest = path.resolve(normPath(dest));
    ensureDir(path.dirname(normalizedDest));
    fs.copyFileSync(path.resolve(normPath(src)), normalizedDest);
    return { success: true };
  } catch (err) {
    return { success: false, reason: String(err) };
  }
});

ipcMain.handle('file:copyCover', async (_e, srcPath: string, projectDir: string) => {
  try {
    const src = path.resolve(normPath(srcPath));
    const dest = path.join(normPath(projectDir), 'cover.png');
    if (!fs.existsSync(src)) return { success: false, reason: 'Origen no encontrado' };
    ensureDir(normPath(projectDir));
    fs.copyFileSync(src, dest);
    return { success: true, destPath: dest };
  } catch (err) {
    return { success: false, reason: String(err) };
  }
});

ipcMain.handle('file:readImage', async (_e, filePath: string) => {
  try {
    const normalized = path.resolve(normPath(filePath));
    const img = nativeImage.createFromPath(normalized);
    if (img.isEmpty()) return { success: false, reason: 'No se pudo leer la imagen' };
    return { success: true, dataUrl: img.toDataURL(), width: img.getSize().width, height: img.getSize().height };
  } catch (err) {
    return { success: false, reason: String(err) };
  }
});

ipcMain.handle('file:readVideo', async (_e, filePath: string) => {
  try {
    const normalized = path.resolve(normPath(filePath));
    if (!fs.existsSync(normalized)) return { success: false, reason: 'Archivo no encontrado' };
    const stat = fs.statSync(normalized);
    // Read file and return as data URL
    const ext = path.extname(normalized).toLowerCase();
    const mimeMap: Record<string, string> = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.avi': 'video/x-msvideo', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska' };
    const mime = mimeMap[ext] || 'video/mp4';
    const buf = fs.readFileSync(normalized);
    const base64 = buf.toString('base64');
    const dataUrl = `data:${mime};base64,${base64}`;
    return { success: true, dataUrl, size: stat.size };
  } catch (err) {
    return { success: false, reason: String(err) };
  }
});

ipcMain.handle('file:writeBinary', async (_e, filePath: string, base64: string) => {
  try {
    ensureDir(path.dirname(filePath));
    const buf = Buffer.from(base64, 'base64');
    fs.writeFileSync(filePath, buf);
    return { success: true };
  } catch (err) {
    return { success: false, reason: String(err) };
  }
});

ipcMain.handle('file:readBinary', async (_e, filePath: string) => {
  try {
    const buf = fs.readFileSync(filePath);
    return { success: true, base64: buf.toString('base64') };
  } catch (err) {
    return { success: false, reason: String(err) };
  }
});

ipcMain.handle('file:delete', async (_e, filePath: string) => {
  try {
    const resolved = path.resolve(filePath);
    if (fs.existsSync(resolved)) {
      fs.unlinkSync(resolved);
    }
    // Also delete companion .gba.raw if it exists
    const rawPath = resolved.replace(/\.\w+$/, '.gba.raw');
    if (fs.existsSync(rawPath)) {
      fs.unlinkSync(rawPath);
    }
    return { success: true };
  } catch (err) {
    return { success: false, reason: String(err) };
  }
});

const GBA_SCREEN_W = 240;
const GBA_SCREEN_H = 160;
const GBA_PIXEL_COUNT = GBA_SCREEN_W * GBA_SCREEN_H;

function convertToGbaBitmapBuffer(imagePath: string): { buffer: Buffer; width: number; height: number } | null {
  const resolvedPath = path.resolve(imagePath);
  if (!fs.existsSync(resolvedPath)) return null;
  const img = nativeImage.createFromPath(resolvedPath);
  if (img.isEmpty()) return null;
  const origSize = img.getSize();
  const resized = img.resize({ width: GBA_SCREEN_W, height: GBA_SCREEN_H });
  const bitmap = resized.toBitmap();
  const gbaBuf = Buffer.alloc(GBA_PIXEL_COUNT * 2);
  for (let i = 0; i < GBA_PIXEL_COUNT; i++) {
    const off = i * 4;
    const b = bitmap[off];
    const g = bitmap[off + 1];
    const r = bitmap[off + 2];
    const gbaColor = ((r >> 3) | ((g >> 3) << 5) | ((b >> 3) << 10)) & 0x7FFF;
    gbaBuf.writeUInt16LE(gbaColor, i * 2);
  }
  return { buffer: gbaBuf, width: origSize.width, height: origSize.height };
}

function cropToGbaBitmapBuffer(imagePath: string, cropX: number, cropY: number): { buffer: Buffer; width: number; height: number } | null {
  const resolvedPath = path.resolve(imagePath);
  if (!fs.existsSync(resolvedPath)) return null;
  const img = nativeImage.createFromPath(resolvedPath);
  if (img.isEmpty()) return null;
  const origSize = img.getSize();
  // If image is smaller than or equal to GBA, just resize full image
  if (origSize.width <= GBA_SCREEN_W && origSize.height <= GBA_SCREEN_H) {
    const resized = img.resize({ width: GBA_SCREEN_W, height: GBA_SCREEN_H });
    const bmp = resized.toBitmap();
    const buf = Buffer.alloc(GBA_PIXEL_COUNT * 2);
    for (let i = 0; i < GBA_PIXEL_COUNT; i++) {
      const off = i * 4;
      const gbaColor = ((bmp[off + 2] >> 3) | ((bmp[off + 1] >> 3) << 5) | ((bmp[off] >> 3) << 10)) & 0x7FFF;
      buf.writeUInt16LE(gbaColor, i * 2);
    }
    return { buffer: buf, width: GBA_SCREEN_W, height: GBA_SCREEN_H };
  }
  // Clamp crop to image bounds
  const clampX = Math.max(0, Math.min(cropX, origSize.width - GBA_SCREEN_W));
  const clampY = Math.max(0, Math.min(cropY, origSize.height - GBA_SCREEN_H));
  // Get full bitmap and manually extract the crop region
  const fullBmp: any = img.toBitmap();
  const bmpW = fullBmp.width ?? origSize.width;
  const bmpH = fullBmp.height ?? origSize.height;
  const rowStride = fullBmp.rowStride ?? bmpW * 4;
  const scaleX = bmpW / origSize.width;
  const scaleY = bmpH / origSize.height;
  const sx = Math.round(clampX * scaleX);
  const sy = Math.round(clampY * scaleY);
  const gbaBuf = Buffer.alloc(GBA_PIXEL_COUNT * 2);
  for (let y = 0; y < GBA_SCREEN_H; y++) {
    for (let x = 0; x < GBA_SCREEN_W; x++) {
      const px = sx + Math.round(x * scaleX);
      const py = sy + Math.round(y * scaleY);
      if (px >= bmpW || py >= bmpH) {
        gbaBuf.writeUInt16LE(0, (y * GBA_SCREEN_W + x) * 2);
        continue;
      }
      const off = py * rowStride + px * 4;
      const b = fullBmp[off];
      const g = fullBmp[off + 1];
      const r = fullBmp[off + 2];
      const gbaColor = ((r >> 3) | ((g >> 3) << 5) | ((b >> 3) << 10)) & 0x7FFF;
      gbaBuf.writeUInt16LE(gbaColor, (y * GBA_SCREEN_W + x) * 2);
    }
  }
  return { buffer: gbaBuf, width: GBA_SCREEN_W, height: GBA_SCREEN_H };
}

ipcMain.handle('file:convertImageToGbaBitmap', async (_e, imagePath: string, outputPath: string) => {
  try {
    const result = convertToGbaBitmapBuffer(imagePath);
    if (!result) return { success: false, reason: 'No se pudo cargar la imagen' };
    ensureDir(path.dirname(outputPath));
    fs.writeFileSync(outputPath, result.buffer);
    return { success: true, width: result.width, height: result.height };
  } catch (err) {
    return { success: false, reason: String(err) };
  }
});

ipcMain.handle('file:convertImageToGbaBase64', async (_e, imagePath: string) => {
  try {
    const result = convertToGbaBitmapBuffer(imagePath);
    if (!result) return { success: false, reason: 'No se pudo cargar la imagen' };
    return { success: true, base64: result.buffer.toString('base64'), width: result.width, height: result.height };
  } catch (err) {
    return { success: false, reason: String(err) };
  }
});

function convertToGbaBitmapBufferExact(imagePath: string): { buffer: Buffer; width: number; height: number } | null {
  const resolvedPath = path.resolve(imagePath);
  if (!fs.existsSync(resolvedPath)) return null;
  const img = nativeImage.createFromPath(resolvedPath);
  if (img.isEmpty()) return null;
  const size = img.getSize();
  const bitmap = img.toBitmap();
  const gbaBuf = Buffer.alloc(size.width * size.height * 2);
  for (let y = 0; y < size.height; y++) {
    for (let x = 0; x < size.width; x++) {
      const off = (y * size.width + x) * 4;
      const b = bitmap[off];
      const g = bitmap[off + 1];
      const r = bitmap[off + 2];
      const gbaColor = ((r >> 3) | ((g >> 3) << 5) | ((b >> 3) << 10)) & 0x7FFF;
      gbaBuf.writeUInt16LE(gbaColor, (y * size.width + x) * 2);
    }
  }
  return { buffer: gbaBuf, width: size.width, height: size.height };
}

ipcMain.handle('file:convertImageToGbaBase64Exact', async (_e, imagePath: string) => {
  try {
    const result = convertToGbaBitmapBufferExact(imagePath);
    if (!result) return { success: false, reason: 'No se pudo cargar la imagen' };
    return { success: true, base64: result.buffer.toString('base64'), width: result.width, height: result.height };
  } catch (err) {
    return { success: false, reason: String(err) };
  }
});

ipcMain.handle('file:cropImageToGbaBase64', async (_e, imagePath: string, cropX: number, cropY: number) => {
  try {
    const result = cropToGbaBitmapBuffer(imagePath, cropX, cropY);
    if (!result) return { success: false, reason: 'No se pudo cargar la imagen' };
    return { success: true, base64: result.buffer.toString('base64'), width: result.width, height: result.height };
  } catch (err) {
    return { success: false, reason: String(err) };
  }
});

ipcMain.handle('file:extractVideoFrames', async (_e, videoPath: string, fps: number) => {
  try {
    const normalized = path.resolve(videoPath);
    if (!fs.existsSync(normalized)) return { success: false, reason: 'Video no encontrado' };

    // Get video duration via ffprobe
    let duration: number;
    try {
      const probeOut = execFileSync('ffprobe', [
        '-v', 'error', '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1', normalized,
      ], { encoding: 'utf8', timeout: 15000 });
      duration = parseFloat(probeOut.trim());
      if (!isFinite(duration) || duration <= 0) duration = 3;
    } catch {
      duration = 3; // fallback
    }

    const effectiveFps = Math.min(Math.max(1, fps || 15), 30);
    const frameCount = Math.max(1, Math.ceil(duration * effectiveFps));

    // Temp directory for frames
    const tmpDir = path.join(os.tmpdir(), `advance_splash_${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    try {
      // Extract frames as PNG using ffmpeg
      execFileSync('ffmpeg', [
        '-i', normalized,
        '-vf', `fps=${effectiveFps},scale=240:160:flags=bilinear`,
        '-pix_fmt', 'rgb24',
        '-y',
        path.join(tmpDir, 'frame_%04d.png'),
      ], { timeout: 120000 });

      // Read and convert each frame
      const frames: string[] = [];
      for (let i = 1; i <= frameCount; i++) {
        const framePath = path.join(tmpDir, `frame_${String(i).padStart(4, '0')}.png`);
        if (!fs.existsSync(framePath)) continue;
        const result = convertToGbaBitmapBuffer(framePath);
        if (result) frames.push(result.buffer.toString('base64'));
      }

      return {
        success: true,
        frames,
        frameCount: frames.length,
        duration,
        fps: effectiveFps,
      };
    } finally {
      // Cleanup temp directory
      try {
        const entries = fs.readdirSync(tmpDir);
        for (const e of entries) fs.unlinkSync(path.join(tmpDir, e));
        fs.rmdirSync(tmpDir);
      } catch { /* ignore cleanup errors */ }
    }
  } catch (err) {
    return { success: false, reason: String(err) };
  }
});

ipcMain.handle('dir:create', async (_e, dirPath: string) => {
  try {
    ensureDir(normPath(dirPath));
    return { success: true };
  } catch (err) {
    return { success: false, reason: String(err) };
  }
});

ipcMain.handle('dir:list', async (_e, dirPath: string) => {
  try {
    if (!fs.existsSync(dirPath)) return { success: true, entries: [] };
    const entries = fs.readdirSync(dirPath, { withFileTypes: true }).map(e => ({
      name: e.name,
      isDirectory: e.isDirectory(),
      path: path.join(dirPath, e.name),
    }));
    return { success: true, entries };
  } catch (err) {
    return { success: false, reason: String(err) };
  }
});

// ── IPC: Proyectos ──────────────────────────────────────────────────────────

ipcMain.handle('projects:getAll', () => readProjects());

ipcMain.handle('projects:create', async (_e, data: Omit<Project, 'id' | 'lastOpened'>) => {
  try {
    const projects = readProjects();
    const project: Project = {
      ...data,
      id: Date.now().toString(),
      lastOpened: new Date().toISOString(),
      path: path.join(GBA_PROJECTS_DIR, data.name),
    };
    projects.unshift(project);
    writeProjects(projects);
    // Crear carpeta del proyecto con subdirectorios
    const dir = path.join(GBA_PROJECTS_DIR, data.name);
    ensureDir(dir);
    for (const folder of PROJECT_FOLDERS) {
      ensureDir(path.join(dir, folder));
    }
    return { success: true, project };
  } catch (err) {
    return { success: false, reason: String(err) };
  }
});

ipcMain.handle('projects:update', (_e, id: string, data: Partial<Project>) => {
  const projects = readProjects();
  const idx = projects.findIndex(p => p.id === id);
  if (idx === -1) return { success: false, reason: 'not found' };
  projects[idx] = { ...projects[idx], ...data, lastOpened: new Date().toISOString() };
  writeProjects(projects);
  return { success: true, project: projects[idx] };
});

ipcMain.handle('projects:delete', (_e, id: string) => {
  const projects = readProjects().filter(p => p.id !== id);
  writeProjects(projects);
  return { success: true };
});

ipcMain.handle('projects:setLastOpened', (_e, id: string) => {
  const projects = readProjects();
  const idx = projects.findIndex(p => p.id === id);
  if (idx !== -1) {
    projects[idx].lastOpened = new Date().toISOString();
    writeProjects(projects);
  }
  return { success: true };
});

// ── IPC: Diálogos ───────────────────────────────────────────────────────────

ipcMain.handle('dialog:openVideo', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Seleccionar video para SplashScreen',
    filters: [{ name: 'Videos', extensions: ['mp4', 'webm', 'avi', 'mov', 'mkv'] }],
    properties: ['openFile'],
  });
  if (canceled || filePaths.length === 0) return { path: null };
  const filePath = filePaths[0];
  const stat = fs.statSync(filePath);
  return { path: filePath, size: stat.size };
});

ipcMain.handle('dialog:openFolder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Seleccionar carpeta del proyecto',
    properties: ['openDirectory', 'createDirectory'],
  });
  return canceled ? null : filePaths[0];
});

ipcMain.handle('dialog:openImage', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Seleccionar portada (480×270 PNG)',
    filters: [{ name: 'Imágenes PNG', extensions: ['png'] }],
    properties: ['openFile'],
  });

  if (canceled || filePaths.length === 0) {
    return { path: null, error: null };
  }

  const filePath = filePaths[0];
  const img = nativeImage.createFromPath(filePath);

  if (img.isEmpty()) {
    return {
      path: null,
      error: 'No se pudo leer la imagen. Asegúrate de que sea un archivo PNG válido.',
    };
  }

  const { width, height } = img.getSize();

  if (width !== 480 || height !== 270) {
    return {
      path: null,
      error: `La imagen seleccionada mide ${width}×${height} px. Debe ser exactamente 480×270 px.`,
    };
  }

  return { path: filePath, error: null };
});

ipcMain.handle('dialog:openAnyImage', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Seleccionar imagen',
    filters: [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp'] }],
    properties: ['openFile'],
  });
  if (canceled || filePaths.length === 0) return { path: null, error: null };
  const filePath = filePaths[0];
  const img = nativeImage.createFromPath(filePath);
  if (img.isEmpty()) return { path: null, error: 'No se pudo leer la imagen.' };
  return { path: filePath, error: null };
});

ipcMain.handle('dialog:openAudio', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Seleccionar audio',
    filters: [{ name: 'Audio', extensions: ['wav', 'mp3', 'ogg', 'flac'] }],
    properties: ['openFile'],
  });
  if (canceled || filePaths.length === 0) return { path: null };
  return { path: filePaths[0] };
});

ipcMain.handle('shell:openExternal', (_e, url: string) => {
  shell.openExternal(url);
});

// Detecta si algún administrador de archivos ya tiene esta carpeta abierta,
// para no abrir una ventana nueva cada vez (Linux usa `ps`, otros SO devuelven false).
function isFolderOpenInFM(dirPath: string): boolean {
  if (process.platform !== 'linux') return false;
  const norm = path.normalize(dirPath).replace(/\/+$/, '');
  if (!norm) return false;
  const fms = ['nautilus', 'org.gnome.Nautilus', 'dolphin', 'thunar', 'nemo', 'caja', 'pcmanfm'];
  try {
    const out = execFileSync('ps', ['ax', '-o', 'args='], { timeout: 5000, maxBuffer: 16 * 1024 * 1024 }).toString();
    return out.split('\n').some((line) => {
      const t = line.trim();
      return fms.some((fm) => t.startsWith(fm) && t.includes(norm));
    });
  } catch {
    return false;
  }
}

ipcMain.handle('shell:openPath', async (_e, dirPath: string) => {
  if (isFolderOpenInFM(dirPath)) return 'ya-abierta';
  return await shell.openPath(dirPath);
});

// ── IPC: Sistema ────────────────────────────────────────────────────────────

async function checkDevkitARM(): Promise<{ found: boolean; path?: string; version?: string }> {
  const commonPaths = [
    'C:\\devkitPro\\devkitARM\\bin\\arm-none-eabi-gcc.exe',
    'C:\\devkitPro\\devkitARM\\bin\\arm-none-eabi-gcc',
    '/opt/devkitpro/devkitARM/bin/arm-none-eabi-gcc',
    '/usr/local/opt/devkitpro/devkitARM/bin/arm-none-eabi-gcc',
  ];
  try {
    const cmd = process.platform === 'win32' ? 'where arm-none-eabi-gcc' : 'which arm-none-eabi-gcc';
    const out = await new Promise<string>((resolve, reject) => {
      exec(cmd, { timeout: 5000 }, (err, stdout) => {
        if (err) reject(err); else resolve(stdout.trim());
      });
    });
    return { found: true, path: out.split('\n')[0].trim() };
  } catch {
    for (const p of commonPaths) {
      if (fs.existsSync(p)) {
        try {
          const ver = await new Promise<string>((resolve, reject) => {
            exec(`"${p}" --version`, { timeout: 3000 }, (err, stdout) => {
              if (err) reject(err); else resolve(stdout.trim().split('\n')[0]);
            });
          });
          return { found: true, path: p, version: ver };
        } catch { return { found: true, path: p }; }
      }
    }
  }
  return { found: false };
}

ipcMain.handle('system:checkDevkitARM', async () => {
  return checkDevkitARM();
});

// Detecta la raíz de devkitPro y devuelve un entorno con DEVKITPRO/DEVKITARM
// y el PATH de binarios, para que `make` encuentre arm-none-eabi-gcc y pueda
// expandir $(DEVKITPRO) aunque la app no herede las variables del shell.
function detectDevkitRoot(): string | undefined {
  if (process.env.DEVKITPRO && fs.existsSync(path.join(process.env.DEVKITPRO, 'devkitARM'))) {
    return process.env.DEVKITPRO;
  }
  const candidates = process.platform === 'win32'
    ? ['C:\\devkitPro', 'C:\\devkitpro']
    : ['/opt/devkitpro', '/usr/local/opt/devkitpro', '/usr/local/devkitpro'];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'devkitARM', 'bin'))) return c;
  }
  return undefined;
}

function withDevkitEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const root = detectDevkitRoot();
  if (!root) return base;
  const sep = process.platform === 'win32' ? ';' : ':';
  const devkitArm = path.join(root, 'devkitARM');
  const extra = [path.join(devkitArm, 'bin'), path.join(root, 'tools', 'bin')].join(sep);
  const env: NodeJS.ProcessEnv = { ...base };
  env.DEVKITPRO = root;
  env.DEVKITARM = devkitArm;
  env.PATH = `${extra}${sep}${base.PATH ?? ''}`;
  return env;
}

ipcMain.handle('system:runCommand', async (_e, cmd: string, cwd: string) => {
  try {
    const result = await new Promise<{ success: boolean; output: string }>((resolve) => {
      exec(cmd, { cwd, timeout: 120000, maxBuffer: 1024 * 1024, env: withDevkitEnv() }, (err, stdout, stderr) => {
        const output = (stdout || '') + (stderr ? `\n${stderr}` : '');
        resolve({
          success: !err,
          output: output.trim(),
        });
      });
    });
    return result;
  } catch (err) {
    return { success: false, output: String(err) };
  }
});

// ── IPC: Instalación automática de devkitPro ────────────────────────────────

const DEVKIT_WIN_INSTALLER_URL = 'https://github.com/devkitPro/installer/releases/download/v3.0.3/devkitProUpdater-3.0.3.exe';
const DEVKIT_KEY_ID = 'BC26F752D25B92CE272E0F44F7FD5492264BB9D0';

const LINUX_INSTALL_SCRIPT = `
set -e
exec 2>&1
echo "==> [1/5] Verificando pacman..."
if ! command -v pacman >/dev/null 2>&1; then
  echo "==> pacman no encontrado, instalandolo..."
  if command -v dnf >/dev/null 2>&1; then
    dnf install -y pacman
  elif command -v apt-get >/dev/null 2>&1; then
    apt-get update && apt-get install -y pacman
  else
    echo "==> ERROR: no se encontro un gestor para instalar pacman"
    exit 3
  fi
fi
echo "==> [2/5] Inicializando y confiando claves de pacman..."
pacman-key --init
pacman-key --recv ${DEVKIT_KEY_ID} --keyserver keyserver.ubuntu.com
pacman-key --lsign ${DEVKIT_KEY_ID}
echo "==> [3/5] Instalando keyring de devkitPro..."
pacman -U --noconfirm https://pkg.devkitpro.org/devkitpro-keyring.pkg.tar.zst || echo "==> keyring ya estaba o fallo menor"
echo "==> [4/5] Anadiendo repositorios dkp a pacman.conf..."
if ! grep -q '\\[dkp-libs\\]' /etc/pacman.conf; then
cat >> /etc/pacman.conf <<'CONFEOF'

[dkp-libs]
Server = https://pkg.devkitpro.org/packages

[dkp-linux]
Server = https://pkg.devkitpro.org/packages/linux/$arch/
CONFEOF
fi
echo "==> [5/5] Instalando gba-dev (devkitARM + libgba)..."
pacman -Syu --noconfirm
pacman -S --noconfirm gba-dev
echo "==> Variables de entorno para el usuario..."
U_ID="$PKEXEC_UID"
if [ -n "$U_ID" ]; then
  U_HOME="$(getent passwd "$U_ID" | cut -d: -f6)"
  if [ -n "$U_HOME" ] && [ -f "$U_HOME/.bashrc" ]; then
    grep -q 'DEVKITPRO=/opt/devkitpro' "$U_HOME/.bashrc" || cat >> "$U_HOME/.bashrc" <<'ENVEOF'

export DEVKITPRO=/opt/devkitpro
export DEVKITARM=$DEVKITPRO/devkitARM
export PATH=$DEVKITARM/bin:$DEVKITPRO/tools/bin:$PATH
ENVEOF
    echo "==> Variables de entorno anadidas a $U_HOME/.bashrc"
  fi
fi
echo "==> INSTALL_DONE"
`.trim();

function runStream(cmd: string, args: string[], onLine: (line: string) => void, timeoutMs: number): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    let output = '';
    const child = spawn(cmd, args, { env: process.env });
    const timer = setTimeout(() => {
      child.kill();
      resolve({ code: -1, output: output.trim() + '\n[TIMEOUT]' });
    }, timeoutMs);
    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      for (const line of text.split(/\r?\n/)) {
        if (line.trim()) onLine(line.trim());
      }
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, output: output.trim() });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: -2, output: output.trim() + '\n' + err.message });
    });
  });
}

async function installDevkitPro(): Promise<{ success: boolean; cancelled?: boolean; reason?: string; path?: string; version?: string }> {
  const win = mainWindow;
  const emit = (line: string) => win?.webContents.send('system:devkit-install-progress', { line });

  try {
    if (process.platform === 'linux') {
      emit('Iniciando instalacion en Linux');
      emit('Puede aparecer una ventana del sistema para escribir tu contrasena (pkexec)');
      const res = await runStream('pkexec', ['bash', '-c', LINUX_INSTALL_SCRIPT], emit, 15 * 60 * 1000);
      if (res.code === 0) {
        const check = await checkDevkitARM();
        if (check.found) {
          emit('devkitARM instalado correctamente. Relanza la app si el modal no cambia.');
          return { success: true, path: check.path, version: check.version };
        }
        return { success: false, reason: 'La instalacion termino pero no se encontro arm-none-eabi-gcc' };
      }
      const cancelled = res.code === 126 || res.code === 127;
      return {
        success: false,
        cancelled,
        reason: `${cancelled ? 'Autenticacion cancelada o denegada.' : 'Fallo la instalacion.'}\n${res.output.slice(-600)}`,
      };
    }

    if (process.platform === 'win32') {
      if (process.arch === 'ia32') {
        return { success: false, reason: 'devkitPro requiere Windows de 64 bits.' };
      }
      const tmpExe = path.join(os.tmpdir(), 'devkitProUpdater.exe');
      emit('Descargando instalador de devkitPro...');
      const dl = await runStream(
        'powershell',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', `Invoke-WebRequest -Uri '${DEVKIT_WIN_INSTALLER_URL}' -OutFile '${tmpExe}'`],
        emit,
        5 * 60 * 1000,
      );
      if (dl.code !== 0) {
        return { success: false, reason: 'Fallo la descarga del instalador:\n' + dl.output.slice(-400) };
      }
      emit('Ejecutando instalador en modo silencioso (puede tardar varios minutos)...');
      const inst = await runStream(tmpExe, ['/S'], emit, 20 * 60 * 1000);
      const check = await checkDevkitARM();
      if (check.found) {
        emit('devkitARM instalado correctamente.');
        return { success: true, path: check.path, version: check.version };
      }
      return { success: false, reason: 'El instalador termino pero no se encontro el compilador:\n' + inst.output.slice(-400) };
    }

    if (process.platform === 'darwin') {
      const pkgPath = path.join(os.tmpdir(), 'devkitpro-pacman-installer.pkg');
      const pkgUrl = 'https://github.com/devkitPro/pacman/releases/download/v6.0.2/devkitpro-pacman-installer.pkg';
      emit('Descargando instalador de devkitPro (pkg oficial)...');
      const dl = await runStream('curl', ['-L', '-sS', '-o', pkgPath, pkgUrl], emit, 5 * 60 * 1000);
      if (!fs.existsSync(pkgPath)) {
        return { success: false, reason: 'Fallo la descarga del instalador (curl):\n' + (dl.output.slice(-300) || 'sin output') };
      }
      emit('Instalando con permisos de administrador (aparecera un dialogo del sistema)...');
      const installScript = [
        `installer -pkg '${pkgPath}' -target /`,
        'PATH="/opt/devkitpro/pacman/bin:$PATH" dkp-pacman-key --init 2>/dev/null || true',
        'PATH="/opt/devkitpro/pacman/bin:$PATH" dkp-pacman -S --noconfirm gba-dev',
        `rm -f '${pkgPath}'`,
      ].join(' && ');
      const inst = await runStream(
        'osascript',
        ['-e', `do shell script "${installScript}" with administrator privileges`],
        emit,
        20 * 60 * 1000,
      );
      const check = await checkDevkitARM();
      if (check.found) {
        emit('devkitARM instalado correctamente.');
        return { success: true, path: check.path, version: check.version };
      }
      return {
        success: false,
        reason: 'El instalador termino pero no se encontro el compilador:\n' + inst.output.slice(-500),
      };
    }

    return { success: false, reason: `Plataforma no soportada: ${process.platform}` };
  } catch (err) {
    return { success: false, reason: String(err) };
  }
}

ipcMain.handle('system:installDevkitPro', async () => installDevkitPro());

// ── IPC: Emulador ───────────────────────────────────────────────────────────

ipcMain.handle('emu:play', async (_e, romPath: string) => {
  try {
    if (!fs.existsSync(romPath)) {
      return { success: false, reason: `ROM no encontrada: ${romPath}` };
    }
    closeEmulatorWindow();
    createEmulatorWindow(romPath);
    return { success: true };
  } catch (err) {
    return { success: false, reason: String(err) };
  }
});

ipcMain.handle('emu:stop', () => {
  closeEmulatorWindow();
  return { success: true };
});

ipcMain.handle('emu:isRunning', () => {
  return isEmulatorRunning();
});

// ── IPC: Ventana ────────────────────────────────────────────────────────────

ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window-close', () => mainWindow?.close());
ipcMain.on('window-maximize-editor', () => mainWindow?.maximize());
ipcMain.on('window-restore', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
});

// ── App lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Registrar protocolo atom: para servir imágenes locales (portadas)
  // Formato: atom://local/<ruta-absoluta-con-barras-normales>
  protocol.handle('atom', (request) => {
    try {
      const url = new URL(request.url);
      // url.pathname incluye / inicial, lo removemos
      const rawPath = decodeURIComponent(url.pathname).slice(1);
      const filePath = path.resolve(rawPath);
      const data = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mime = ext === '.png' ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
        : ext === '.gif' ? 'image/gif'
        : ext === '.webp' ? 'image/webp'
        : 'application/octet-stream';
      return new Response(data, { headers: { 'Content-Type': mime } });
    } catch (err) {
      return new Response(null, { status: 404, statusText: 'Not found' });
    }
  });

  initPaths();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
