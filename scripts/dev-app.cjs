const { spawn } = require('node:child_process');
const http = require('node:http');

const processes = [];
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function start(name, args) {
  const child = spawn(npm, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    windowsHide: false,
    shell: true,
  });
  processes.push(child);
  child.on('exit', (code, signal) => {
    if (code !== 0 && signal !== 'SIGTERM') {
      console.error(`${name} berhenti (${code ?? signal})`);
    }
  });
  return child;
}

function stopAll() {
  for (const child of processes) {
    if (!child.killed) child.kill();
  }
}

function waitForApi(url, timeoutMs = 30000, intervalMs = 1000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve(true);
        } else {
          retry();
        }
      });
      req.on('error', () => retry());
      req.setTimeout(2000, () => { req.destroy(); retry(); });
    };
    const retry = () => {
      if (Date.now() - start >= timeoutMs) {
        resolve(false);
        return;
      }
      setTimeout(check, intervalMs);
    };
    check();
  });
}

process.on('SIGINT', () => {
  stopAll();
  process.exit(0);
});
process.on('SIGTERM', () => {
  stopAll();
  process.exit(0);
});

(async () => {
  // 1. Start API first
  start('API', ['run', 'dev:api']);

  // 2. Wait until API is reachable
  console.log('[dev-app] Menunggu API di port 3000...');
  const ready = await waitForApi('http://127.0.0.1:3000/api/v1/health', 60000);
  if (!ready) {
    console.error('[dev-app] GAGAL: API tidak merespon setelah 60 detik. Membatalkan startup.');
    stopAll();
    process.exit(1);
  }
  console.log('[dev-app] API siap.');

  // 3. Start Web (Vite proxy needs API running)
  start('Web', ['run', 'dev:web']);

  // 4. Wait for Vite to be ready before starting Electron
  console.log('[dev-app] Menunggu Frontend (Vite) di port 5173...');
  const webReady = await waitForApi('http://127.0.0.1:5173', 30000);
  if (!webReady) {
    console.error('[dev-app] GAGAL: Vite tidak merespon setelah 30 detik. Membatalkan startup.');
    stopAll();
    process.exit(1);
  }
  
  console.log('[dev-app] Frontend siap, memulai Desktop (Electron)...');
  start('Desktop', ['run', 'dev:desktop']);
})();
