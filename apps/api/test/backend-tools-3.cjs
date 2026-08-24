/**
 * Backend Tools Suite 3 - web_search, ask_user, desktop_open_* (graceful w/o bridge)
 * Usage: node test/backend-tools-3.cjs <modelId>
 */
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const API = 'http://127.0.0.1:3000/api/v1';
const WID = process.env.WORKSPACE_ID || 'cmt4e7xfh0001vgoc2mx8nf7n';
const KEY = '199710338e26f2127f7012001e927b4b';
const modelId = process.argv[2] || 'agnes-2-0-flash:free';

function psKill(proc) {
  execFile('taskkill', ['/IM', proc, '/F'], () => {});
}

async function send(goal, timeoutMs) {
  const t0 = Date.now();
  const res = await fetch(`${API}/workspaces/${WID}/agent/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': KEY },
    body: JSON.stringify({ goal, historyMessages: [], modelId }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader(); const dec = new TextDecoder();
  let buf = '', text = '', tools = [], doneEvents = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n'); buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      let ev; try { ev = JSON.parse(line.slice(6)); } catch { continue; }
      if (ev.type === 'tool_start') tools.push(ev.data?.toolName || '?');
      else if (ev.type === 'text_delta') text += ev.data || '';
      else if (ev.type === 'done' && ev.data?.content && ev.data.content.length > text.length) text = ev.data.content;
    }
  }
  return { text, tools, ms: Date.now() - t0 };
}

function ranClean(r) { return r.tools.length > 0 || r.text.length > 20; }

const CASES = [
  { id: 'H1-websearch', timeout: 360000,
    goal: 'Gunakan web_search untuk mencari kurs USD ke IDR hari ini, lalu sebutkan angkanya dan situs sumbernya.',
    verify: r => ({ ok: ranClean(r), why: `tools=${r.tools.join(',')}, len=${r.text.length}` }),
    softExpect: ['web_search'] },
  { id: 'H2-askuser', timeout: 300000,
    goal: 'Sebelum membuat apa pun: gunakan tool ask_user untuk menanyakan kepada saya, format laporan yang saya inginkan PDF atau Excel? Tunggu jawaban saya, jangan buat file dulu.',
    verify: r => ({ ok: r.tools.some(t => t.includes('ask_user')) && /pdf|excel/i.test(r.text), why: `tools=${r.tools.join(',')}, text=${r.text.slice(0,60)}` }),
    softExpect: ['ask_user'] },
  { id: 'H3-open-excel', timeout: 240000,
    goal: 'Buka Laporan Bengkel Januari.xlsx di aplikasi Excel supaya saya bisa melihatnya langsung.',
    post: () => psKill('EXCEL.EXE'),
    verify: r => ({
      ok: ranClean(r) && (/open/i.test(JSON.stringify(r.tools)) || /open|bridge|tidak tersedia|not connected/i.test(r.text)),
      why: `tools=${r.tools.join(',')}` }),
    softExpect: ['desktop_open_excel'] },
  { id: 'H4-open-word', timeout: 240000,
    goal: 'Buka Surat Penawaran.docx di Microsoft Word.',
    post: () => psKill('WINWORD.EXE'),
    verify: r => ({ ok: ranClean(r), why: `tools=${r.tools.join(',')}` }),
    softExpect: ['desktop_open_word'] },
  { id: 'H5-open-ppt', timeout: 240000,
    goal: 'Buka Presentasi Toko.pptx di PowerPoint.',
    post: () => psKill('POWERPNT.EXE'),
    verify: r => ({ ok: ranClean(r), why: `tools=${r.tools.join(',')}` }),
    softExpect: ['desktop_open_ppt'] },
];

async function main() {
  console.log(`=== BACKEND TOOLS SUITE 3 | model=${modelId} ===\n`);
  const only = process.argv.slice(3).flatMap(a => a.split(',')).filter(Boolean);
  const cases = only.length ? CASES.filter(c => only.some(f => c.id.includes(f))) : CASES;
  let P = 0;
  for (const c of cases) {
    process.stdout.write(`[${c.id}] ${c.goal.slice(0, 56)}... `);
    let r, err = null;
    try { r = await send(c.goal, c.timeout); }
    catch (e) { r = { text: '', tools: [], ms: 0 }; err = e.message.slice(0, 70); }
    await new Promise(s => setTimeout(s, 2000));
    let v; try { v = c.verify(r); } catch (e) { v = { ok: false, why: e.message }; }
    const pass = v.ok && !err;
    P += pass ? 1 : 0;
    console.log(pass ? 'PASS' : 'FAIL', `(${(r.ms / 1000).toFixed(1)}s)`, `tools=[${[...new Set(r.tools)].join(',')}]`, err ? `err=${err}` : '', !v.ok ? `why: ${v.why}` : '');
    if (c.post) c.post();
    await new Promise(s => setTimeout(s, 1000));
  }
  console.log(`\n=== SCORE: ${P}/${cases.length} | model=${modelId} ===`);
  process.exit(P === cases.length ? 0 : 1);
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
