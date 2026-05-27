import { app, BrowserWindow, ipcMain, dialog, shell, nativeImage, protocol, net } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { pathToFileURL } from 'url';

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
    resizable: false,
    maximizable: false,
    center: true,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#2a2a2e',
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
}

// ── IPC: Proyectos ──────────────────────────────────────────────────────────

ipcMain.handle('projects:getAll', () => readProjects());

ipcMain.handle('projects:create', async (_e, data: Omit<Project, 'id' | 'lastOpened'>) => {
  try {
    const projects = readProjects();
    const project: Project = {
      ...data,
      id: Date.now().toString(),
      lastOpened: new Date().toISOString(),
    };
    projects.unshift(project);
    writeProjects(projects);
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

ipcMain.handle('shell:openExternal', (_e, url: string) => {
  shell.openExternal(url);
});

// ── IPC: Ventana ────────────────────────────────────────────────────────────

ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-close', () => mainWindow?.close());

// ── App lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Registrar protocolo atom: para servir imágenes locales (portadas)
  protocol.handle('atom', (request) => {
    const filePath = decodeURIComponent(request.url.slice('atom://'.length));
    return net.fetch(pathToFileURL(filePath).href);
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
