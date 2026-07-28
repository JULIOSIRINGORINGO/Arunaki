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
  const ready = await waitForApi('http://localhost:3000/api/v1/health', 30000);
  if (!ready) {
    console.error('[dev-app] API tidak merespon setelah 30 detik. Melanjutkan tetap...');
  } else {
    console.log('[dev-app] API siap.');
  }

  // 3. Start Web (Vite proxy needs API running)
  start('Web', ['run', 'dev:web']);

  // 4. Start Electron after Web is ready
  setTimeout(() => start('Desktop', ['run', 'dev:desktop']), 5000);
})();
