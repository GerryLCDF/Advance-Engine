// Tipos del API expuesto por el preload via contextBridge
// Debe mantenerse sincronizado con electron/preload.ts

interface AdvanceAPIProject {
  id: string;
  name: string;
  author: string;
  path: string;
  template: string;
  coverPath: string;
  lastOpened: string;
}

interface AdvanceAPI {
  projects: {
    getAll: () => Promise<AdvanceAPIProject[]>;
    create: (data: Omit<AdvanceAPIProject, 'id' | 'lastOpened'>) => Promise<{ success: boolean; project?: AdvanceAPIProject; reason?: string }>;
    update: (id: string, data: Partial<AdvanceAPIProject>) => Promise<{ success: boolean; project?: AdvanceAPIProject; reason?: string }>;
    delete: (id: string) => Promise<{ success: boolean }>;
    setLastOpened: (id: string) => Promise<{ success: boolean }>;
  };
  dialog: {
    openFolder: () => Promise<string | null>;
    openImage: () => Promise<{ path: string | null; error: string | null }>;
  };
  shell: {
    openExternal: (url: string) => void;
  };
  window: {
    minimize: () => void;
    maximize: () => void;
    maximizeEditor: () => void;
    close: () => void;
  };
}

declare global {
  interface Window {
    advanceAPI: AdvanceAPI;
  }
}

export {};
