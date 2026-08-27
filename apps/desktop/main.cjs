const { app, BrowserWindow, ipcMain, shell, dialog, desktopCapturer, nativeTheme, Notification } = require('electron');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const WebSocket = require('ws');

// Disable GPU hardware acceleration and GPU compositing to prevent white screen hang on Windows
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu-compositing');

// Load .env manually since dotenv might not be installed
try {
  // Try apps/desktop/.env first, then root .env
  const candidatePaths = [
    path.join(__dirname, '.env'),
    path.join(__dirname, '..', '..', '.env'),
  ];
  for (const envPath of candidatePaths) {
    try {
      const envContent = fsSync.readFileSync(envPath, 'utf-8');
      envContent.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = match[2] || '';
          value = value.replace(/^['"]|['"]$/g, '');
          if (!process.env[key]) process.env[key] = value;
        }
      });
      break;
    } catch (e) {
      // Try next path
    }
  }
} catch (e) {
  // Ignore if .env doesn't exist
}

const WEB_URL = process.env.ARUNAKI_WEB_URL || 'http://127.0.0.1:5173';
const WAIT_TIMEOUT_MS = 15000;
const WAIT_INTERVAL_MS = 500;

// Workspace root, learned from the first fs:getFolderTree call (folder picked by user).
// All fs/office IPC handlers must stay inside it.
let workspaceRoot = null;

function resolveInsideWorkspace(p) {
  const resolved = path.resolve(p);
  if (!workspaceRoot) return resolved; // no workspace selected yet (dev/offline) — allow
  const rel = path.relative(workspaceRoot, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Path outside workspace is not allowed');
  }
  return resolved;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkUrl(url) {
  if (url.startsWith('file:')) return Promise.resolve(true);
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

let mainWindow = null;

function createWindow() {
  const isDark = nativeTheme ? nativeTheme.shouldUseDarkColors : true;
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF',
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: isDark ? '#121214' : '#FFFFFF',
      symbolColor: isDark ? '#FFFFFF' : '#111827',
      height: 35,
    },
    webPreferences: {
      backgroundThrottling: true,
      spellcheck: false,
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  mainWindow = win;

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Auto-reload if network service / renderer process crashes or fails to load
  win.webContents.on('render-process-gone', (_event, details) => {
    console.warn('[main] Render process gone, reloading...', details);
    setTimeout(() => {
      try { win.reload(); } catch {}
    }, 1000);
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.warn(`[main] did-fail-load (${errorCode}: ${errorDescription}), retrying...`);
    setTimeout(() => {
      try { void win.loadURL(WEB_URL); } catch {}
    }, 1500);
  });

  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent('<html><body style="margin:0;display:grid;place-items:center;background:#F4EFE6;color:#1A191B;font:16px system-ui"><div>Menunggu Arunaki Web di 127.0.0.1:5173...</div></body></html>')}`);

  waitForWebApp(WEB_URL).then((isReady) => {
    if (isReady) {
      void win.loadURL(WEB_URL);
      return;
    }
    const distIndexPath = path.join(__dirname, '../web/dist/index.html');
    if (fsSync.existsSync(distIndexPath)) {
      void win.loadFile(distIndexPath);
      return;
    }
    void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent('<html><body style="margin:0;display:grid;place-items:center;background:#F4EFE6;color:#1A191B;font:16px system-ui"><div>Arunaki Web belum aktif. Jalankan npm run dev:web lalu buka ulang desktop.</div></body></html>')}`);
  }).catch((err) => {
    console.error('[main] Error loading web app:', err);
    void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<html><body style="margin:0;display:grid;place-items:center;background:#F4EFE6;color:#FF5E38;font:16px system-ui"><div>Gagal memuat aplikasi: ${err.message}</div></body></html>`)}`);
  });
}


app.whenReady().then(() => {
  ipcMain.handle('app:ping', () => 'desktop');

  ipcMain.handle('theme:set', async (_event, theme) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const isLight = theme === 'light';
    try {
      if (nativeTheme) {
        nativeTheme.themeSource = isLight ? 'light' : 'dark';
      }
      mainWindow.setBackgroundColor(isLight ? '#FFFFFF' : '#0A0A0A');
      if (process.platform === 'win32' || process.platform === 'darwin') {
        mainWindow.setTitleBarOverlay({
          color: isLight ? '#FFFFFF' : '#121214',
          symbolColor: isLight ? '#111827' : '#FFFFFF',
          height: 35,
        });
      }
    } catch (e) {
      console.warn('[main] setTitleBarOverlay error:', e);
    }
  });

  ipcMain.handle('app:notify', async (_event, payload) => {
    try {
      const { title, body, silent } = payload || {};
      if (Notification && Notification.isSupported()) {
        const notif = new Notification({
          title: title || 'Arunaki',
          body: body || 'Tugas dokumen selesai.',
          silent: !!silent,
        });
        notif.show();
        return { success: true };
      }
    } catch (e) {
      console.warn('[main] app:notify error:', e);
    }
    return { success: false };
  });

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
    // Normalize the incoming path so Windows backslash paths work correctly
    const normalizedPath = path.normalize(folderPath);
    console.log(`[main] fs:getFolderTree called with: "${folderPath}" → normalized: "${normalizedPath}"`);

    // Verify the folder actually exists before scanning
    try {
      const stat = await fs.stat(normalizedPath);
      if (!stat.isDirectory()) {
        console.warn(`[main] fs:getFolderTree: path is not a directory: "${normalizedPath}"`);
        return { tree: [], folderName: path.basename(normalizedPath), folderPath: normalizedPath, error: 'Not a directory' };
      }
    } catch (err) {
      console.error(`[main] fs:getFolderTree: cannot stat path "${normalizedPath}":`, err.message);
      return { tree: [], folderName: path.basename(normalizedPath), folderPath: normalizedPath, error: err.message };
    }

    const IGNORED = new Set([
      'node_modules', '.git', 'dist', 'build', '.next', '.venv',
      '__pycache__', '.idea', '.vscode', 'coverage', '.cache', '.nuxt',
    ]);

    const buildTree = async (dir, depth = 0) => {
      if (depth > 6) return []; // max depth
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch (err) {
        console.warn(`[main] readdir failed for "${dir}":`, err.message);
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
            // skip unreadable files silently
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

    const tree = await buildTree(normalizedPath);
    workspaceRoot = path.resolve(normalizedPath);
    console.log(`[main] fs:getFolderTree done — ${tree.length} root entries, workspaceRoot set to "${workspaceRoot}"`);
    return { tree, folderName: path.basename(normalizedPath), folderPath: normalizedPath };
  });

  // Read individual file content on demand
  ipcMain.handle('fs:readFile', async (_event, filePath) => {
    try {
      const safePath = resolveInsideWorkspace(filePath);
      const ext = path.extname(safePath).toLowerCase();
      const BINARY_EXT = new Set(['.pdf', '.doc', '.docx', '.xlsx', '.xls', '.xlsm', '.pptx', '.ppt', '.odt', '.ods', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.zip', '.rar', '.7z', '.mp4', '.mp3']);
      if (BINARY_EXT.has(ext)) {
        const buf = await fs.readFile(safePath);
        return { content: buf.toString('base64'), encoding: 'base64' };
      }
      const content = await fs.readFile(safePath, 'utf-8');
      return { content, encoding: 'utf-8' };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('fs:writeFile', async (_event, filePath, content) => {
    try {
      const safePath = resolveInsideWorkspace(filePath);
      await fs.writeFile(safePath, content, 'utf-8');
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('fs:createFolder', async (_event, folderPath) => {
    try {
      const safePath = resolveInsideWorkspace(folderPath);
      await fs.mkdir(safePath, { recursive: true });
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('fs:deletePath', async (_event, targetPath) => {
    try {
      const safePath = resolveInsideWorkspace(targetPath);
      await fs.rm(safePath, { recursive: true, force: true });
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('fs:renamePath', async (_event, oldPath, newPath) => {
    try {
      const safeOld = resolveInsideWorkspace(oldPath);
      const safeNew = resolveInsideWorkspace(newPath);
      await fs.rename(safeOld, safeNew);
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('app:openPath', async (_event, targetPath) => {
    try {
      const safePath = resolveInsideWorkspace(targetPath);
      const r = await shell.openPath(safePath);
      if (r) return { error: r };
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('excel:openNative', async (_event, filePath) => {
    try {
      const safePath = resolveInsideWorkspace(filePath);
      const winax = require('winax');
      const excel = new winax.Object('Excel.Application');
      excel.Visible = true;
      const workbook = excel.Workbooks.Open(safePath);
      const hwnd = excel.Hwnd;
      
      return { success: true, hwnd: hwnd.toString() };
    } catch (err) {
      try {
        const safePath = resolveInsideWorkspace(filePath);
        const r = await shell.openPath(safePath);
        if (r) return { error: r };
        return { success: true, fallback: 'shell' };
      } catch {
        return { error: err.message };
      }
    }
  });



  ipcMain.handle('fs:parseExcel', async (_event, filePath) => {
    try {
      const safePath = resolveInsideWorkspace(filePath);
      const xlsx = require('xlsx');
      const workbook = xlsx.readFile(safePath, { cellDates: true, cellStyles: true, cellNF: true, cellFormulas: true });
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
      const safePath = resolveInsideWorkspace(filePath);
      const xlsx = require('xlsx');
      const worksheet = xlsx.utils.aoa_to_sheet(rows);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      xlsx.writeFile(workbook, safePath);
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('fs:readBinaryFile', async (_event, filePath) => {
    try {
      const safePath = resolveInsideWorkspace(filePath);
      const data = await fs.readFile(safePath);
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

    const token = process.env.ARUNAKI_API_KEY ? `?token=${process.env.ARUNAKI_API_KEY}` : '';
    ws = new WebSocket(`ws://127.0.0.1:31524${token}`);
    ws.on('open', () => console.log('[desktop-bridge] Connected to backend'));
    ws.on('close', () => {
      ws = null;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connectToBackend, 3000);
    });
    ws.on('error', (err) => {
      if (!err.message?.includes('ECONNREFUSED')) {
        console.error('[desktop-bridge] Error:', err.message);
      }
    });
    ws.on('message', async (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg.type !== 'call' || !msg.id || !msg.method) return;

      let result = {};
      let error = null;

      try {
        const rawPath = msg.args && msg.args.path ? msg.args.path : null;
        const targetPath = rawPath ? resolveInsideWorkspace(rawPath) : null;

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
              if (targetPath) {
                let found = false;
                for (let i = 1; i <= excel.Workbooks.Count; i++) {
                  try {
                    if (excel.Workbooks.Item(i).FullName.toLowerCase() === targetPath.toLowerCase()) {
                      excel.Workbooks.Item(i).Activate();
                      found = true;
                      break;
                    }
                  } catch { /* ignore */ }
                }
                if (!found) {
                  excel.Workbooks.Open(targetPath);
                }
              } else if (excel.Workbooks.Count === 0) {
                excel.Workbooks.Add();
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
              if (targetPath) {
                let found = false;
                for (let i = 1; i <= excel.Workbooks.Count; i++) {
                  try {
                    if (excel.Workbooks.Item(i).FullName.toLowerCase() === targetPath.toLowerCase()) {
                      excel.Workbooks.Item(i).Activate();
                      found = true;
                      break;
                    }
                  } catch { /* ignore */ }
                }
                if (!found) {
                  excel.Workbooks.Open(targetPath);
                }
              } else if (excel.Workbooks.Count === 0) {
                excel.Workbooks.Add();
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
          case 'excelEdit': {
            try {
              const winax = require('winax');
              const excel = new winax.Object('Excel.Application');
              excel.Visible = true;
              if (targetPath) {
                let found = false;
                for (let i = 1; i <= excel.Workbooks.Count; i++) {
                  try {
                    if (excel.Workbooks.Item(i).FullName.toLowerCase() === targetPath.toLowerCase()) {
                      excel.Workbooks.Item(i).Activate();
                      found = true;
                      break;
                    }
                  } catch { /* ignore */ }
                }
                if (!found) {
                  excel.Workbooks.Open(targetPath);
                }
              } else if (excel.Workbooks.Count === 0) {
                excel.Workbooks.Add();
              }

              if (msg.args.sheetName) {
                try {
                  for (let s = 1; s <= excel.ActiveWorkbook.Worksheets.Count; s++) {
                    const ws = excel.ActiveWorkbook.Worksheets.Item(s);
                    if (ws.Name.toLowerCase() === String(msg.args.sheetName).toLowerCase()) {
                      ws.Activate();
                      break;
                    }
                  }
                } catch { /* ignore */ }
              }

              const actions = msg.args.actions || [];
              const results = [];
              for (const act of actions) {
                try {
                  switch (act.action) {
                    case 'write_cell':
                      excel.ActiveSheet.Range(act.cell).Value = act.value;
                      results.push({ action: 'write_cell', cell: act.cell, success: true });
                      break;
                    case 'insert_row':
                      excel.ActiveSheet.Rows(act.row).Insert();
                      results.push({ action: 'insert_row', row: act.row, success: true });
                      break;
                    case 'delete_row':
                      excel.ActiveSheet.Rows(act.row).Delete();
                      results.push({ action: 'delete_row', row: act.row, success: true });
                      break;
                    case 'insert_column':
                      excel.ActiveSheet.Columns(act.column).Insert();
                      results.push({ action: 'insert_column', column: act.column, success: true });
                      break;
                    case 'delete_column':
                      excel.ActiveSheet.Columns(act.column).Delete();
                      results.push({ action: 'delete_column', column: act.column, success: true });
                      break;
                    case 'set_format': {
                      const rng = excel.ActiveSheet.Range(act.range || 'A1');
                      if (act.bold !== undefined) rng.Font.Bold = act.bold;
                      if (act.italic !== undefined) rng.Font.Italic = act.italic;
                      if (act.fontSize) rng.Font.Size = act.fontSize;
                      if (act.bgColor) rng.Interior.ColorIndex = act.bgColor;
                      if (act.alignment) {
                        if (act.alignment === 'center') rng.HorizontalAlignment = -4108;
                        else if (act.alignment === 'right') rng.HorizontalAlignment = -4152;
                        else if (act.alignment === 'left') rng.HorizontalAlignment = -4131;
                      }
                      results.push({ action: 'set_format', range: act.range, success: true });
                      break;
                    }
                    case 'save':
                      excel.ActiveWorkbook.Save();
                      results.push({ action: 'save', success: true });
                      break;
                    default:
                      results.push({ action: act.action, success: false, error: 'Unknown action' });
                  }
                } catch (actErr) {
                  results.push({ action: act.action, success: false, error: actErr.message });
                }
              }
              result = { success: true, actionsExecuted: results.length, results };
            } catch (err) {
              error = `Gagal mengedit Excel via COM: ${err.message}`;
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
              const rawText = msg.args.text || '';
              if (msg.args.smoothStream) {
                const words = rawText.split(' ');
                const delay = msg.args.delayMs || 25;
                for (let i = 0; i < words.length; i++) {
                  const chunk = i < words.length - 1 ? words[i] + ' ' : words[i];
                  sel.TypeText(chunk);
                  if (delay > 0) {
                    await new Promise((r) => setTimeout(r, delay));
                  }
                }
              } else {
                sel.TypeText(rawText);
              }
              if (msg.args.addNewline) sel.TypeParagraph();
              result = { success: true, textLength: rawText.length, smoothStream: !!msg.args.smoothStream };
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
          case 'clickCoordinate': {
            try {
              const x = parseInt(msg.args.x, 10);
              const y = parseInt(msg.args.y, 10);
              if (isNaN(x) || isNaN(y)) {
                error = 'Koordinat x dan y harus berupa angka valid';
                break;
              }
              const clickType = msg.args.clickType || 'left';
              const { execSync } = require('child_process');
              let flags = '0x02,0,0,0,0; [Win32Utils.Win32]::mouse_event(0x04,0,0,0,0)';
              if (clickType === 'right') {
                flags = '0x08,0,0,0,0; [Win32Utils.Win32]::mouse_event(0x10,0,0,0,0)';
              }
              let psCmd = `Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y); [DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);' -Name Win32 -Namespace Win32Utils; [Win32Utils.Win32]::SetCursorPos(${x}, ${y}); [Win32Utils.Win32]::mouse_event(${flags})`;
              if (clickType === 'double') {
                psCmd += `; Start-Sleep -Milliseconds 50; [Win32Utils.Win32]::mouse_event(${flags})`;
              }
              execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCmd.replace(/"/g, '`"')}"`);
              result = { success: true, x, y, clickType };
            } catch (err) {
              error = `Gagal mengeklik koordinat mouse (${msg.args.x}, ${msg.args.y}): ${err.message}`;
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
