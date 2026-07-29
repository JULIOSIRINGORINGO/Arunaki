const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');

const WEB_URL = process.env.ARUNAKI_WEB_URL || 'http://127.0.0.1:5173';
const WAIT_TIMEOUT_MS = 30000;
const WAIT_INTERVAL_MS = 500;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkUrl(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode && res.statusCode < 500);
    });

    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForWebApp(url) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < WAIT_TIMEOUT_MS) {
    if (await checkUrl(url)) {
      return true;
    }
    await wait(WAIT_INTERVAL_MS);
  }
  return false;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#111111',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent('<html><body style="margin:0;display:grid;place-items:center;background:#111;color:#fff;font:16px system-ui"><div>Menunggu Arunaki Web di 127.0.0.1:5173...</div></body></html>')}`);

  waitForWebApp(WEB_URL).then((isReady) => {
    if (isReady) {
      void win.loadURL(WEB_URL);
      return;
    }

    void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent('<html><body style="margin:0;display:grid;place-items:center;background:#111;color:#fff;font:16px system-ui"><div>Arunaki Web belum aktif. Jalankan npm run dev:web lalu buka ulang desktop.</div></body></html>')}`);
  });
}

app.whenReady().then(() => {
  ipcMain.handle('app:ping', () => 'desktop');

  ipcMain.handle('dialog:pickFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Pilih Folder Workspace',
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return { path: result.filePaths[0] };
    }
    return { path: null };
  });

  // VS Code-like: get full folder tree (structure only, no file content)
  ipcMain.handle('fs:getFolderTree', async (_event, folderPath) => {
    const IGNORED = new Set([
      'node_modules', '.git', 'dist', 'build', '.next', '.venv',
      '__pycache__', '.idea', '.vscode', 'coverage', '.cache', '.nuxt',
    ]);

    const buildTree = async (dir, depth = 0) => {
      if (depth > 6) return []; // max depth
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return [];
      }

      const nodes = [];
      for (const entry of entries) {
        if (entry.name.startsWith('.') || IGNORED.has(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const children = await buildTree(fullPath, depth + 1);
          nodes.push({
            name: entry.name,
            path: fullPath,
            type: 'directory',
            children,
          });
        } else if (entry.isFile()) {
          try {
            const stat = await fs.stat(fullPath);
            nodes.push({
              name: entry.name,
              path: fullPath,
              type: 'file',
              size: stat.size,
              ext: path.extname(entry.name).toLowerCase().replace('.', ''),
            });
          } catch {
            // skip
          }
        }
      }

      // Sort: directories first, then files, alphabetical
      nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      return nodes;
    };

    const tree = await buildTree(folderPath);
    return { tree, folderName: path.basename(folderPath), folderPath };
  });

  // Read individual file content on demand
  ipcMain.handle('fs:readFile', async (_event, filePath) => {
    try {
      const ext = path.extname(filePath).toLowerCase();
      const BINARY_EXT = new Set(['.pdf', '.docx', '.xlsx', '.xls', '.png', '.jpg', '.jpeg', '.gif']);
      if (BINARY_EXT.has(ext)) {
        const buf = await fs.readFile(filePath);
        return { content: buf.toString('base64'), encoding: 'base64' };
      }
      const content = await fs.readFile(filePath, 'utf-8');
      return { content, encoding: 'utf-8' };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('fs:writeFile', async (_event, filePath, content) => {
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('fs:createFolder', async (_event, folderPath) => {
    try {
      await fs.mkdir(folderPath, { recursive: true });
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('fs:deletePath', async (_event, targetPath) => {
    try {
      await fs.rm(targetPath, { recursive: true, force: true });
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
