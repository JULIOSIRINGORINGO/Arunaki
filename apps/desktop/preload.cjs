const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('arunakiDesktop', {
  ping: () => ipcRenderer.invoke('app:ping').catch(() => 'desktop'),
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  getFolderTree: (folderPath) => ipcRenderer.invoke('fs:getFolderTree', folderPath),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
});
