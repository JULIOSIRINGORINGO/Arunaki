const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const http = require('node:http');
const path = require('node:path');

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
