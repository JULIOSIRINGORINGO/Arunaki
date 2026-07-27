const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('arunakiDesktop', {
  ping: () => ipcRenderer.invoke('app:ping').catch(() => 'desktop'),
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
});
