/**
 * Backend Tools Suite 2 - vision_ai, generate_export, redact, stamp, data_query, batch_execute
 * Usage: node test/backend-tools-2.cjs <modelId> [G1|G2|...]
 */
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const API = 'http://127.0.0.1:3000/api/v1';
const WID = process.env.WORKSPACE_ID || 'cmt4e7xfh0001vgoc2mx8nf7n';
const WROOT = process.env.WORKSPACE_ROOT || 'E:\\JS\\Arunika\\workspace-demo';
const KEY = '199710338e26f2127f7012001e927b4b';

const modelId = process.argv[2] || 'agnes-2-0-flash:free';

function ps(cmd) {
  return new Promise((resolve) => {
    const { execFile } = require('child_process');
    execFile('powershell', ['-NoProfile', '-Command', cmd], { timeout: 90000 }, () => resolve());
  });
}

async function makeStampFixture() {
  await ps([
    'Add-Type -AssemblyName System.Drawing',
    '$bmp = New-Object System.Drawing.Bitmap(360, 120)',
    '$g = [System.Drawing.Graphics]::FromImage($bmp)',
    '$g.Clear([System.Drawing.Color]::White)',
    '$f = New-Object System.Drawing.Font("Arial", 26, ([System.Drawing.FontStyle]::Bold))',
    '$g.DrawString("LUNAS", $f, [System.Drawing.Brushes]::Red, 100, 35)',
    '$bmp.Save("' + path.join(WROOT, 'stempel-lunas.png').replace(/\\/g, '\\\\') + '", [System.Drawing.Imaging.ImageFormat]::Png)',
    '$g.Dispose(); $bmp.Dispose()',
  ].join('; '));
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
  let buf = '', text = '', tools = [];
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

function newestPdf(exclude) {
  const pdfs = fs.readdirSync(WROOT).filter(f => f.toLowerCase().endsWith('.pdf'));
  return pdfs.filter(f => !exclude.includes(f));
}

const CASES = [
  { id: 'G1-visionai', timeout: 360000,
    goal: 'Gunakan vision_ai pada gambar struk-test.png: berapa total bayar di struk itu?',
    verify: r => ({ ok: /150/.test(r.text), why: `jawaban: ${r.text.slice(0, 80)}` }),
    softExpect: ['vision_ai'] },
  { id: 'G2-export', timeout: 420000,
    goal: 'Pakai tool generate_export untuk membuat file Excel baru bernama Rekap Stok Januari.xlsx berisi tabel dua kolom: Kode Barang dan Sisa, dengan baris BRG001=90, BRG002=45, BRG003=37, BRG004=90, BRG005=26.',
    pre: () => { try { fs.unlinkSync(path.join(WROOT, 'Rekap Stok Januari.xlsx')); } catch {} },
    verify: () => {
      const p = path.join(WROOT, 'Rekap Stok Januari.xlsx');
      if (!fs.existsSync(p)) return { ok: false, why: 'file tidak ada' };
      const wb = XLSX.readFile(p); const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = JSON.stringify(ws);
      return { ok: /BRG001/.test(raw) && /90/.test(raw), why: `sheets=${wb.SheetNames.join(',')}` };
    },
    softExpect: ['generate_export'] },
  { id: 'G3-redact', timeout: 420000,
    goal: 'Gunakan doc_redact_pii pada Dua Halaman.pdf: sembunyikan semua angka, hasilkan PDF baru.',
    pre: () => { global.__pdfBefore = fs.readdirSync(WROOT).filter(f => f.endsWith('.pdf')); },
    verify: r => {
      const before = global.__pdfBefore || [];
      const added = newestPdf(before);
      return { ok: added.length > 0 && r.tools.some(t => t.includes('redact')), why: `pdf baru=${added.join(',')}, tools=${r.tools.join(',')}` };
    },
    softExpect: ['doc_redact_pii'] },
  { id: 'G4-stamp', timeout: 420000,
    goal: 'Tempelkan gambar stempel-lunas.png ke dokumen Halaman Pertama.pdf menggunakan pdf_stamp_image, simpan hasilnya sebagai Halaman Lunas.pdf.',
    pre: async () => {},
    verify: () => ({ ok: fs.existsSync(path.join(WROOT, 'Halaman Lunas.pdf')), why: `exists=${fs.existsSync(path.join(WROOT, 'Halaman Lunas.pdf'))}` }),
    softExpect: ['pdf_stamp_image'] },
  { id: 'G5-dataquery', timeout: 300000,
    goal: 'Gunakan data_query action list_tables untuk melihat tabel database yang tersedia, lalu sebutkan nama-namanya.',
    verify: r => ({ ok: /(file|workspace|memory|provider|user)/i.test(r.text) && r.text.length > 30, why: `jawaban: ${r.text.slice(0, 80)}` }),
    softExpect: ['data_query'] },
  { id: 'G6-batch', timeout: 420000,
    goal: 'Gunakan batch_execute dengan operations: pertama read file kontrak-v2.txt, kedua write hasilnya ke file salinan-kontrak.txt.',
    pre: () => { try { fs.unlinkSync(path.join(WROOT, 'salinan-kontrak.txt')); } catch {} },
    verify: () => {
      const p = path.join(WROOT, 'salinan-kontrak.txt');
      if (!fs.existsSync(p)) return { ok: false, why: 'salinan tidak ada' };
      const t = fs.readFileSync(p, 'utf8');
      return { ok: /7\.500\.000|12 bulan/i.test(t), why: `isi: ${t.slice(0, 50)}` };
    },
    softExpect: ['batch_execute'] },
];

async function main() {
  console.log(`=== BACKEND TOOLS SUITE 2 | model=${modelId} ===\n`);
  console.log('[setup] membuat fixture stempel...');
  await makeStampFixture();
  const only = process.argv.slice(3).flatMap(a => a.split(',')).filter(Boolean);
  const cases = only.length ? CASES.filter(c => only.some(f => c.id.includes(f))) : CASES;
  if (only.length) console.log(`[batch] running: ${cases.map(c => c.id).join(', ')}\n`);
  let P = 0;
  for (const c of cases) {
    process.stdout.write(`[${c.id}] ${c.goal.slice(0, 56)}... `);
    if (c.pre) await c.pre();
    let r, err = null;
    try { r = await send(c.goal, c.timeout); }
    catch (e) { r = { text: '', tools: [], ms: 0 }; err = e.message.slice(0, 70); }
    await new Promise(s => setTimeout(s, 2000));
    let v; try { v = c.verify(r); } catch (e) { v = { ok: false, why: e.message }; }
    const pass = v.ok && !err;
    P += pass ? 1 : 0;
    console.log(pass ? 'PASS' : 'FAIL', `(${(r.ms / 1000).toFixed(1)}s)`, `tools=[${[...new Set(r.tools)].join(',')}]`, err ? `err=${err}` : '', !v.ok ? `why: ${v.why}` : '');
  }
  console.log(`\n=== SCORE: ${P}/${cases.length} | model=${modelId} ===`);
  process.exit(P === cases.length ? 0 : 1);
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
