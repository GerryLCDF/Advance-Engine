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
});