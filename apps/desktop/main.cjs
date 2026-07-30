const { app, BrowserWindow, ipcMain, shell, dialog, desktopCapturer } = require('electron');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');
const WebSocket = require('ws');

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

  ipcMain.handle('fs:renamePath', async (_event, oldPath, newPath) => {
    try {
      await fs.rename(oldPath, newPath);
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('app:openPath', async (_event, targetPath) => {
    try {
      await shell.openPath(targetPath);
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('excel:openNative', async (_event, filePath) => {
    try {
      const winax = require('winax');
      const excel = new winax.Object('Excel.Application');
      excel.Visible = true;
      const workbook = excel.Workbooks.Open(filePath);
      const hwnd = excel.Hwnd;
      
      return { success: true, hwnd: hwnd.toString() };
    } catch (err) {
      try {
        await shell.openPath(filePath);
        return { success: true, fallback: 'shell' };
      } catch {
        return { error: err.message };
      }
    }
  });



  ipcMain.handle('fs:parseExcel', async (_event, filePath) => {
    try {
      const xlsx = require('xlsx');
      const workbook = xlsx.readFile(filePath, { cellDates: true, cellStyles: true, cellNF: true, cellFormulas: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      if (!worksheet['!ref']) {
        return { success: true, sheetName, sheets: workbook.SheetNames, rows: [] };
      }

      const range = xlsx.utils.decode_range(worksheet['!ref']);
      const rows = [];

      for (let R = range.s.r; R <= range.e.r; ++R) {
        const row = [];
        let hasData = false;
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = xlsx.utils.encode_cell({ r: R, c: C });
          const cell = worksheet[cellAddress];
          if (!cell) {
            row.push(null);
          } else {
            hasData = true;
            row.push({
              v: cell.v,
              w: cell.w !== undefined ? String(cell.w) : (cell.v !== undefined ? String(cell.v) : ''),
              t: cell.t,
              f: cell.f
            });
          }
        }
        rows.push(row);
      }

      return { success: true, sheetName, sheets: workbook.SheetNames, rows };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('fs:writeExcel', async (_event, filePath, rows) => {
    try {
      const xlsx = require('xlsx');
      const worksheet = xlsx.utils.aoa_to_sheet(rows);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      xlsx.writeFile(workbook, filePath);
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('fs:readBinaryFile', async (_event, filePath) => {
    try {
      const data = await fs.readFile(filePath);
      return { success: true, base64: data.toString('base64') };
    } catch (err) {
      return { error: err.message };
    }
  });

  // ─── Backend Bridge (WebSocket client) ─────────────────────────
  let ws = null;
  let reconnectTimer = null;

  function connectToBackend() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    ws = new WebSocket('ws://127.0.0.1:31524');
    ws.on('open', () => console.log('[desktop-bridge] Connected to backend'));
    ws.on('close', () => {
      console.log('[desktop-bridge] Disconnected, reconnecting in 5s...');
      ws = null;
      reconnectTimer = setTimeout(connectToBackend, 5000);
    });
    ws.on('error', (err) => {
      console.error('[desktop-bridge] Error:', err.message);
    });
    ws.on('message', async (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg.type !== 'call' || !msg.id || !msg.method) return;

      let result = {};
      let error = null;

      try {
        const targetPath = msg.args && msg.args.path ? path.resolve(msg.args.path) : null;

        switch (msg.method) {
          case 'openFile': {
            if (!targetPath) { error = 'Path file tidak boleh kosong'; break; }
            const r = await shell.openPath(targetPath);
            if (r) error = r;
            break;
          }
          case 'openExcel': {
            if (!targetPath) { error = 'Path file Excel tidak boleh kosong'; break; }
            try {
              const winax = require('winax');
              const excel = new winax.Object('Excel.Application');
              excel.Visible = true;
              excel.Workbooks.Open(targetPath);
              result = { hwnd: String(excel.Hwnd) };
            } catch {
              // Fallback to shell openPath if winax / Office COM is unavailable
              const r = await shell.openPath(targetPath);
              if (r) error = r;
              else result = { fallback: 'shell' };
            }
            break;
          }
          case 'openWord': {
            if (!targetPath) { error = 'Path file Word tidak boleh kosong'; break; }
            try {
              const winax = require('winax');
              const word = new winax.Object('Word.Application');
              word.Visible = true;
              word.Documents.Open(targetPath);
              result = { hwnd: String(word.Hwnd) };
            } catch {
              // Fallback to shell openPath
              const r = await shell.openPath(targetPath);
              if (r) error = r;
              else result = { fallback: 'shell' };
            }
            break;
          }
          case 'openPpt': {
            if (!targetPath) { error = 'Path file PowerPoint tidak boleh kosong'; break; }
            try {
              const winax = require('winax');
              const ppt = new winax.Object('PowerPoint.Application');
              ppt.Visible = true;
              ppt.Presentations.Open(targetPath);
              result = {};
            } catch {
              // Fallback to shell openPath
              const r = await shell.openPath(targetPath);
              if (r) error = r;
              else result = { fallback: 'shell' };
            }
            break;
          }
          case 'excelWriteCell': {
            try {
              const winax = require('winax');
              const excel = new winax.Object('Excel.Application');
              excel.Visible = true;
              if (excel.Workbooks.Count === 0) {
                if (targetPath) {
                  excel.Workbooks.Open(targetPath);
                } else {
                  excel.Workbooks.Add();
                }
              }
              const targetCell = msg.args.cell || 'A1';
              excel.ActiveSheet.Range(targetCell).Value = msg.args.value;
              result = { success: true, cell: targetCell, value: msg.args.value };
            } catch (err) {
              error = `Gagal menulis cell Excel: ${err.message}`;
            }
            break;
          }
          case 'excelSetFormat': {
            try {
              const winax = require('winax');
              const excel = new winax.Object('Excel.Application');
              excel.Visible = true;
              if (excel.Workbooks.Count === 0) {
                if (targetPath) {
                  excel.Workbooks.Open(targetPath);
                } else {
                  excel.Workbooks.Add();
                }
              }
              const rangeStr = msg.args.range || 'A1';
              const rng = excel.ActiveSheet.Range(rangeStr);
              if (msg.args.bold !== undefined) rng.Font.Bold = msg.args.bold;
              if (msg.args.italic !== undefined) rng.Font.Italic = msg.args.italic;
              if (msg.args.fontSize) rng.Font.Size = msg.args.fontSize;
              if (msg.args.bgColor) rng.Interior.ColorIndex = msg.args.bgColor;
              if (msg.args.alignment) {
                if (msg.args.alignment === 'center') rng.HorizontalAlignment = -4108;
                else if (msg.args.alignment === 'right') rng.HorizontalAlignment = -4152;
                else if (msg.args.alignment === 'left') rng.HorizontalAlignment = -4131;
              }
              result = { success: true, range: rangeStr };
            } catch (err) {
              error = `Gagal memformat cell Excel: ${err.message}`;
            }
            break;
          }
          case 'wordType': {
            try {
              const winax = require('winax');
              const word = new winax.Object('Word.Application');
              word.Visible = true;
              if (word.Documents.Count === 0) {
                word.Documents.Add();
              }
              const sel = word.Selection;
              sel.TypeText(msg.args.text || '');
              if (msg.args.addNewline) sel.TypeParagraph();
              result = { success: true, textLength: (msg.args.text || '').length };
            } catch (err) {
              error = `Gagal mengetik di Word: ${err.message}`;
            }
            break;
          }
          case 'wordFormat': {
            try {
              const winax = require('winax');
              const word = new winax.Object('Word.Application');
              word.Visible = true;
              if (word.Documents.Count === 0) {
                word.Documents.Add();
              }
              const sel = word.Selection;
              if (msg.args.style) sel.Style = msg.args.style;
              if (msg.args.bold !== undefined) sel.Font.Bold = msg.args.bold ? 1 : 0;
              if (msg.args.italic !== undefined) sel.Font.Italic = msg.args.italic ? 1 : 0;
              if (msg.args.fontSize) sel.Font.Size = msg.args.fontSize;
              result = { success: true };
            } catch (err) {
              error = `Gagal memformat dokumen Word: ${err.message}`;
            }
            break;
          }
          case 'sendKeys': {
            try {
              if (!msg.args.keys) {
                error = 'Shortcut keyboard (keys) tidak boleh kosong';
                break;
              }
              const winax = require('winax');
              const sh = new winax.Object('WScript.Shell');
              sh.SendKeys(msg.args.keys);
              result = { success: true, keys: msg.args.keys };
            } catch (err) {
              error = `Gagal mengirim shortcut keyboard: ${err.message}`;
            }
            break;
          }
          case 'screenshot': {
            const sources = await desktopCapturer.getSources({
              types: ['screen'],
              thumbnailSize: { width: 1920, height: 1080 },
            });
            if (sources.length > 0) {
              const img = sources[0].thumbnail.toDataURL();
              result = { screenshot: img };
            } else {
              error = 'No screen sources found';
            }
            break;
          }
          case 'ping': {
            result = { pong: true };
            break;
          }
          default:
            error = `Unknown method: ${msg.method}`;
        }
      } catch (err) {
        error = err.message;
      }

      try {
        ws.send(JSON.stringify({ type: 'result', id: msg.id, data: result, error }));
      } catch { /* ignore */ }
    });
  }

  connectToBackend();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (ws) { try { ws.close(); } catch {} }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
