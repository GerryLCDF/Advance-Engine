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
  };
  // Shell
  shell: {
    openExternal: (url: string) => void;
  };
  // Ventana
  window: {
    minimize: () => void;
    maximize: () => void;
    maximizeEditor: () => void;
    restore: () => void;
    close: () => void;
  };
}

contextBridge.exposeInMainWorld('advanceAPI', {
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
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },
  window: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    maximizeEditor: () => ipcRenderer.send('window-maximize-editor'),
    restore: () => ipcRenderer.send('window-restore'),
    close: () => ipcRenderer.send('window-close'),
  },
} satisfies AdvanceAPI);
