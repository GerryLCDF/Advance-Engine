import type { Project } from './types';

interface AdvanceAPI {
  emu: {
    play: (romPath: string) => Promise<{ success: boolean; reason?: string }>;
    stop: () => Promise<{ success: boolean }>;
    isRunning: () => Promise<boolean>;
  };
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
    openVideo: () => Promise<{ path: string | null; size?: number }>;
  };
  shell: {
    openExternal: (url: string) => void;
    openPath: (dirPath: string) => Promise<string>;
  };
  system: {
    checkDevkitARM: () => Promise<{ found: boolean; path?: string; version?: string }>;
    runCommand: (cmd: string, cwd: string) => Promise<{ success: boolean; output: string }>;
  };
  window: {
    minimize: () => void;
    maximize: () => void;
    maximizeEditor: () => void;
    restore: () => void;
    close: () => void;
  };
  project: {
    ensureProjectsDir: () => Promise<string>;
    save: (projectId: string, data: { name: string; state: any }) => Promise<{ success: boolean; path?: string; reason?: string }>;
    load: (projectPath: string) => Promise<{ success: boolean; manifest?: any; state?: any; reason?: string }>;
    listLocal: () => Promise<{ success: boolean; projects?: any[]; reason?: string }>;
    deleteLocal: (projectPath: string) => Promise<{ success: boolean; reason?: string }>;
  };
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
  dir: {
    create: (dirPath: string) => Promise<{ success: boolean; reason?: string }>;
    list: (dirPath: string) => Promise<{ success: boolean; entries?: { name: string; isDirectory: boolean; path: string }[]; reason?: string }>;
  };
}

declare global {
  interface Window {
    advanceAPI: AdvanceAPI;
  }
}

export {};
