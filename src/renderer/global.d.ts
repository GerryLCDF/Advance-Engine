import type { Project } from './types';

interface AdvanceAPI {
  projects: {
    getAll: () => Promise<Project[]>;
    create: (data: Omit<Project, 'id' | 'lastOpened'>) => Promise<{ success: boolean; project?: Project; reason?: string }>;
    update: (id: string, data: Partial<Project>) => Promise<{ success: boolean; project?: Project; reason?: string }>;
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
    restore: () => void;
    close: () => void;
  };
}

declare global {
  interface Window {
    advanceAPI: AdvanceAPI;
  }
}

export {};
