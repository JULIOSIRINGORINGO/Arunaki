/**
 * Backend Tools Stability Suite - file/domain tools without Desktop Bridge.
 * Usage: node test/backend-tools-stability.cjs <modelId> [F1|F2|...]
 */
const path = require('path');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');

const API = 'http://127.0.0.1:3000/api/v1';
const WID = process.env.WORKSPACE_ID || 'cmt4e7xfh0001vgoc2mx8nf7n';
const WROOT = process.env.WORKSPACE_ROOT || 'E:\\JS\\Arunika\\workspace-demo';
const KEY = '199710338e26f2127f7012001e927b4b';

const modelId = process.argv[2] || 'agnes-2-0-flash:free';
const REN_SRC = path.join(WROOT, 'arsip-lama.txt');
const REN_DST = path.join(WROOT, 'arsip-baru.txt');
const DEL_TGT = path.join(WROOT, 'hapus-saya.txt');
const V1 = path.join(WROOT, 'kontrak-v1.txt');
const V2 = path.join(WROOT, 'kontrak-v2.txt');
const PDF2 = path.join(WROOT, 'Dua Halaman.pdf');
const PDF_OUT = path.join(WROOT, 'Halaman Pertama.pdf');

async function makePdfFixture() {
  const doc = await PDFDocument.create();
  const f1 = await doc.embedFont('Helvetica');
  const p1 = doc.addPage([500, 700]);
  p1.drawText('HALAMAN SATU - isi penting', { x: 50, y: 600, size: 18, font: f1 });
  const p2 = doc.addPage([500, 700]);
  p2.drawText('HALAMAN DUA', { x: 50, y: 600, size: 18, font: f1 });
  const bytes = await doc.save();
  fs.writeFileSync(PDF2, bytes);
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

const CASES = [
  { id: 'F1-search', timeout: 300000,
    goal: 'Cari di seluruh workspace: di file mana kata PENAWARAN muncul?',
    verify: r => ({ ok: r.tools.length > 0 && /penawaran/i.test(r.text), why: 'perlu tool pencarian + jawaban menyebut file penawaran' }) },
  { id: 'F2-rename', timeout: 300000,
    goal: 'Ganti nama file arsip-lama.txt menjadi arsip-baru.txt',
    pre: () => { fs.writeFileSync(REN_SRC, 'isi arsip untuk uji rename'); try { fs.unlinkSync(REN_DST); } catch {} },
    verify: () => ({ ok: !fs.existsSync(REN_SRC) && fs.existsSync(REN_DST), why: `src ada=${fs.existsSync(REN_SRC)}, dst ada=${fs.existsSync(REN_DST)}` }),
    softExpect: ['rename'] },
  { id: 'F3-delete', timeout: 300000,
    goal: 'Hapus file hapus-saya.txt dari workspace.',
    pre: () => fs.writeFileSync(DEL_TGT, 'file ini harus dihapus'),
    verify: () => ({ ok: !fs.existsSync(DEL_TGT), why: 'file harus hilang (trash boleh)' }),
    softExpect: ['delete'] },
  { id: 'F4-compare', timeout: 360000,
    goal: 'Bandingkan kontrak-v1.txt dan kontrak-v2.txt, sebutkan apa bedanya.',
    pre: () => {
      fs.writeFileSync(V1, 'Nilai kontrak: Rp5.000.000\nMasa berlaku: 6 bulan\nPihak kedua: CV Maju');
      fs.writeFileSync(V2, 'Nilai kontrak: Rp7.500.000\nMasa berlaku: 12 bulan\nPihak kedua: CV Maju');
    },
    verify: r => ({ ok: /7\.?500\.?000|12 bulan/i.test(norm(r.text)), why: 'jawaban harus menyebut nilai baru atau masa berlaku baru' }),
    softExpect: ['doc_compare_versions'] },
  { id: 'F5-pdfpages', timeout: 420000,
    goal: `Ambil halaman pertama saja dari "Dua Halaman.pdf" dan simpan sebagai "Halaman Pertama.pdf".`,
    verify: () => ({ ok: fs.existsSync(PDF_OUT) && fs.statSync(PDF_OUT).size > 500, why: `out exists=${fs.existsSync(PDF_OUT)}` }),
    softExpect: ['pdf_manage_pages'] },
  { id: 'F6-export', timeout: 300000,
    goal: 'Buatkan file Ringkasan Stok.csv yang berisi daftar kode barang dan sisa stok dari sheet stok di Laporan Bengkel Januari.xlsx.',
    verify: () => { const p = path.join(WROOT, 'Ringkasan Stok.csv'); if (!fs.existsSync(p)) return { ok: false, why: 'csv tidak ada' }; const t = fs.readFileSync(p, 'utf8'); return { ok: /BRG001/i.test(t) && /\d{2,}/.test(t), why: `csv head: ${t.slice(0, 60)}` }; },
    softExpect: ['generate_export', 'write'] },
  { id: 'F7-draft', timeout: 300000,
    goal: 'Draftkan email penawaran singkat untuk Bapak Andi tentang paket katering Rp1.750.000.',
    verify: r => ({ ok: /andi/i.test(r.text) && /katering/i.test(r.text) && r.text.length > 80, why: 'draft harus menyebut penerima+produk' }),
    softExpect: ['draft_communication'] },
];

function norm(s) { return String(s).replace(/\./g, ''); }

async function main() {
  console.log(`=== BACKEND TOOLS SUITE | model=${modelId} ===\n`);
  await makePdfFixture();
  console.log('[setup] fixture PDF 2 halaman dibuat\n');
  const only = process.argv.slice(3).flatMap(a => a.split(',')).filter(Boolean);
  const cases = only.length ? CASES.filter(c => only.some(f => c.id.includes(f))) : CASES;
  if (only.length) console.log(`[batch] running: ${cases.map(c => c.id).join(', ')}\n`);
  let P = 0;
  for (const c of cases) {
    process.stdout.write(`[${c.id}] ${c.goal.slice(0, 58)}... `);
    if (c.pre) c.pre();
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
