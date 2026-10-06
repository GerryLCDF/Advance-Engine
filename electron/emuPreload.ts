// Preload de la ventana del emulador.
//
// Con contextIsolation:true la página no ve window.require ni ipcRenderer, así
// que esto es lo único que cruza la frontera. El shell publica
// window.__advanceEmuBridge.report(estado, error) y Electron lo recibe por IPC.
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('__advanceEmuBridge', {
  report(state: string, error: string | null) {
    ipcRenderer.send('emu:status', { state, error: error ?? null });
  },
  /** Mensajes de log que llegan en vivo (main → emulador). */
  onLog(cb: (msg: { level: 'info' | 'error'; msg: string }) => void) {
    const a = (_e: unknown, p: { level: 'info' | 'error'; msg: string }) => cb(p);
    const b = (_e: unknown, p: { lines: string[] }) => p.lines.forEach((m) => cb({ level: 'info', msg: m }));
    ipcRenderer.on('emu:log', a);
    ipcRenderer.on('emu:log:snapshot', b);
    return () => {
      ipcRenderer.removeListener('emu:log', a);
      ipcRenderer.removeListener('emu:log:snapshot', b);
    };
  },
});