const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('arunakiDesktop', {
  ping: () => ipcRenderer.invoke('app:ping').catch(() => 'desktop'),
  pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
  getFolderTree: (folderPath) => ipcRenderer.invoke('fs:getFolderTree', folderPath),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  createFolder: (folderPath) => ipcRenderer.invoke('fs:createFolder', folderPath),
  deletePath: (targetPath) => ipcRenderer.invoke('fs:deletePath', targetPath),
  renamePath: (oldPath, newPath) => ipcRenderer.invoke('fs:renamePath', oldPath, newPath),
  openPath: (targetPath) => ipcRenderer.invoke('app:openPath', targetPath),
  openExcelNative: (filePath) => ipcRenderer.invoke('excel:openNative', filePath),
  parseExcel: (filePath) => ipcRenderer.invoke('fs:parseExcel', filePath),
  writeExcel: (filePath, rows) => ipcRenderer.invoke('fs:writeExcel', filePath, rows),
  readBinaryFile: (filePath) => ipcRenderer.invoke('fs:readBinaryFile', filePath),
});
