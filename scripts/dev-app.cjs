const { spawn } = require('node:child_process');

const processes = [];
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function start(name, args) {
  const child = spawn(npm, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    windowsHide: false,
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

process.on('SIGINT', () => {
  stopAll();
  process.exit(0);
});
process.on('SIGTERM', () => {
  stopAll();
  process.exit(0);
});

start('API', ['run', 'dev:api']);
start('Web', ['run', 'dev:web']);
setTimeout(() => start('Desktop', ['run', 'dev:desktop']), 3000);
