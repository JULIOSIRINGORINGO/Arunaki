const path = require('path');
const { execSync } = require('child_process');

const API = 'http://127.0.0.1:3000/api/v1';
const WID = 'cmt4e7xfh0001vgoc2mx8nf7n';
const KEY = '199710338e26f2127f7012001e927b4b';

async function main() {
  execSync(`node "${path.join(__dirname, '..', 'test', 'create-excel.cjs')}"`);
  const res = await fetch(`${API}/workspaces/${WID}/agent/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': KEY },
    body: JSON.stringify({ goal: process.argv[2] || 'Update stok gudang juga di @Laporan Bengkel Januari.xlsx, semen 15 sak dan besi 7 batang tadi keluar dari gudang.', historyMessages: [], modelId: process.argv[3] || 'agnes-2-5-flash:free' }),
  });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const ev = JSON.parse(line.slice(6));
      if (ev.type === 'tool_start') console.log('[TOOL]', ev.data.toolName, JSON.stringify(ev.data.args));
      if (ev.type === 'tool_done') console.log('[RESULT]', JSON.stringify(ev.data).slice(0, 500));
      if (ev.type === 'error') console.log('[ERR]', JSON.stringify(ev.data));
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });


