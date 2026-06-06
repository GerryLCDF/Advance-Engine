import { contextBridge, ipcRenderer } from 'electron';

export interface Project {
  id: string;
  name: string;
  author: string;
  path: string;
  template: string;   // 'cartucho' | 'cartuchotransparente' | 'cartucho_color'
  coverPath: string;  // ruta local a la portada .png
  lastOpened: string; // ISO date string
}

export interface AdvanceAPI {
  // Emulador GBA
  emu: {
    play: (romPath: string) => Promise<{ success: boolean; reason?: string }>;
    stop: () => Promise<{ success: boolean }>;
    isRunning: () => Promise<boolean>;
  };
  // Proyectos
  projects: {
    getAll: () => Promise<Project[]>;
    create: (data: Omit<Project, 'id' | 'lastOpened'>) => Promise<{ success: boolean; project?: Project; reason?: string }>;
    update: (id: string, data: Partial<Project>) => Promise<{ success: boolean; project?: Project; reason?: string }>;
    delete: (id: string) => Promise<{ success: boolean }>;
    setLastOpened: (id: string) => Promise<{ success: boolean }>;
  };
  // Diálogos
  dialog: {
    openFolder: () => Promise<string | null>;
    openImage: () => Promise<{ path: string | null; error: string | null }>;
    openVideo: () => Promise<{ path: string | null; size?: number }>;
  };
  // Shell
  shell: {
    openExternal: (url: string) => void;
    openPath: (dirPath: string) => Promise<string>;
  };
  // Sistema
  system: {
    checkDevkitARM: () => Promise<{ found: boolean; path?: string; version?: string }>;
    runCommand: (cmd: string, cwd: string) => Promise<{ success: boolean; output: string }>;
  };
  // Ventana
  window: {
    minimize: () => void;
    maximize: () => void;
    maximizeEditor: () => void;
    restore: () => void;
    close: () => void;
  };
  // Proyecto local (pipeline)
  project: {
    ensureProjectsDir: () => Promise<string>;
    save: (projectId: string, data: { name: string; state: any }) => Promise<{ success: boolean; path?: string; reason?: string }>;
    load: (projectPath: string) => Promise<{ success: boolean; manifest?: any; state?: any; reason?: string }>;
    listLocal: () => Promise<{ success: boolean; projects?: any[]; reason?: string }>;
    deleteLocal: (projectPath: string) => Promise<{ success: boolean; reason?: string }>;
  };
  // Archivos
  file: {
    readText: (filePath: string) => Promise<{ success: boolean; data?: string; reason?: string }>;
    writeText: (filePath: string, content: string) => Promise<{ success: boolean; reason?: string }>;
    copy: (src: string, dest: string) => Promise<{ success: boolean; reason?: string }>;
    copyCover: (srcPath: string, projectDir: string) => Promise<{ success: boolean; destPath?: string; reason?: string }>;
    readImage: (filePath: string) => Promise<{ success: boolean; dataUrl?: string; width?: number; height?: number; reason?: string }>;
    readVideo: (filePath: string) => Promise<{ success: boolean; dataUrl?: string; size?: number; reason?: string }>;
    extractVideoFrames: (videoPath: string, fps: number) => Promise<{ success: boolean; frames?: string[]; frameCount?: number; duration?: number; fps?: number; reason?: string }>;
    writeBinary: (filePath: string, base64: string) => Promise<{ success: boolean; reason?: string }>;
    readBinary: (filePath: string) => Promise<{ success: boolean; base64?: string; reason?: string }>;
    convertImageToGbaBitmap: (imagePath: string, outputPath: string) => Promise<{ success: boolean; width?: number; height?: number; reason?: string }>;
    convertImageToGbaBase64: (imagePath: string) => Promise<{ success: boolean; base64?: string; width?: number; height?: number; reason?: string }>;
    delete: (filePath: string) => Promise<{ success: boolean; reason?: string }>;
  };
  // Directorios
  dir: {
    create: (dirPath: string) => Promise<{ success: boolean; reason?: string }>;
    list: (dirPath: string) => Promise<{ success: boolean; entries?: { name: string; isDirectory: boolean; path: string }[]; reason?: string }>;
  };
}

contextBridge.exposeInMainWorld('advanceAPI', {
  emu: {
    play: (romPath: string) => ipcRenderer.invoke('emu:play', romPath),
    stop: () => ipcRenderer.invoke('emu:stop'),
    isRunning: () => ipcRenderer.invoke('emu:isRunning'),
  },
  projects: {
    getAll: () => ipcRenderer.invoke('projects:getAll'),
    create: (data: Omit<Project, 'id' | 'lastOpened'>) => ipcRenderer.invoke('projects:create', data),
    update: (id: string, data: Partial<Project>) => ipcRenderer.invoke('projects:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('projects:delete', id),
    setLastOpened: (id: string) => ipcRenderer.invoke('projects:setLastOpened', id),
  },
  dialog: {
    openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
    openImage: () => ipcRenderer.invoke('dialog:openImage'),
    openVideo: () => ipcRenderer.invoke('dialog:openVideo'),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
    openPath: (dirPath: string) => ipcRenderer.invoke('shell:openPath', dirPath),
  },
  system: {
    checkDevkitARM: () => ipcRenderer.invoke('system:checkDevkitARM'),
    runCommand: (cmd: string, cwd: string) => ipcRenderer.invoke('system:runCommand', cmd, cwd),
  },
  window: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    maximizeEditor: () => ipcRenderer.send('window-maximize-editor'),
    restore: () => ipcRenderer.send('window-restore'),
    close: () => ipcRenderer.send('window-close'),
  },
  project: {
    ensureProjectsDir: () => ipcRenderer.invoke('project:ensureProjectsDir'),
    save: (projectId: string, data: { name: string; state: any }) => ipcRenderer.invoke('project:save', projectId, data),
    load: (projectPath: string) => ipcRenderer.invoke('project:load', projectPath),
    listLocal: () => ipcRenderer.invoke('project:listLocal'),
    deleteLocal: (projectPath: string) => ipcRenderer.invoke('project:deleteLocal', projectPath),
  },
  file: {
    readText: (filePath: string) => ipcRenderer.invoke('file:readText', filePath),
    writeText: (filePath: string, content: string) => ipcRenderer.invoke('file:writeText', filePath, content),
    copy: (src: string, dest: string) => ipcRenderer.invoke('file:copy', src, dest),
    copyCover: (srcPath: string, projectDir: string) => ipcRenderer.invoke('file:copyCover', srcPath, projectDir),
    readImage: (filePath: string) => ipcRenderer.invoke('file:readImage', filePath),
    readVideo: (filePath: string) => ipcRenderer.invoke('file:readVideo', filePath),
    extractVideoFrames: (videoPath: string, fps: number) => ipcRenderer.invoke('file:extractVideoFrames', videoPath, fps),
    writeBinary: (filePath: string, base64: string) => ipcRenderer.invoke('file:writeBinary', filePath, base64),
    readBinary: (filePath: string) => ipcRenderer.invoke('file:readBinary', filePath),
    convertImageToGbaBitmap: (imagePath: string, outputPath: string) => ipcRenderer.invoke('file:convertImageToGbaBitmap', imagePath, outputPath),
    convertImageToGbaBase64: (imagePath: string) => ipcRenderer.invoke('file:convertImageToGbaBase64', imagePath),
    delete: (filePath: string) => ipcRenderer.invoke('file:delete', filePath),
  },
  dir: {
    create: (dirPath: string) => ipcRenderer.invoke('dir:create', dirPath),
    list: (dirPath: string) => ipcRenderer.invoke('dir:list', dirPath),
  },
} satisfies AdvanceAPI);
