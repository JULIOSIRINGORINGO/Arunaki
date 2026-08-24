/**
 * Tool Stability Suite v2 - outcome-based verification (no hardcoded tool names as gate).
 * Usage: node test/tool-stability-test.cjs [modelId]
 */
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const API = 'http://127.0.0.1:3000/api/v1';
const WID = process.env.WORKSPACE_ID || 'cmt4e7xfh0001vgoc2mx8nf7n';
const WROOT = process.env.WORKSPACE_ROOT || 'E:\\JS\\Arunika\\workspace-demo';
const KEY = '199710338e26f2127f7012001e927b4b';
const XFILE = 'Laporan Bengkel Januari.xlsx';
const XPATH = path.join(WROOT, XFILE);
const NOTE = path.join(WROOT, 'catatan-tool-test.txt');

const modelId = process.argv[2] || 'agnes-2-0-flash:free';

function genTemplate() {
  const U = XLSX.utils;
  const wb = U.book_new();
  const p = [['LAPORAN PENJUALAN JANUARI 2026'], [], ['Tanggal','Barang','Qty','Harga Satuan','Total'],
    ['03/01/2026','Semen 40kg',10,65000,650000], ['05/01/2026','Besi beton 8mm',5,98000,490000],
    ['08/01/2026','Cat Tembok 5kg',8,45000,360000], ['12/01/2026','Paku 1 inch',20,8000,160000],
    ['15/01/2026','Seng Gelombang',4,75000,300000], [], ['TOTAL','','','',1960000]];
  const s = [['Kode Barang','Nama Barang','Stok Awal','Masuk','Keluar','Sisa'],
    ['BRG001','Semen 40kg',100,20,30,90], ['BRG002','Besi beton 8mm',60,10,25,45],
    ['BRG003','Cat Tembok 5kg',40,15,18,37], ['BRG004','Paku 1 inch',100,50,60,90],
    ['BRG005','Seng Gelombang',30,10,14,26]];
  const r = [['REKAP JANUARI 2026'], [], ['Total Penjualan (Rp)',''], ['Jumlah Transaksi','']];
  U.book_append_sheet(wb, U.aoa_to_sheet(p), 'Penjualan Januari');
  U.book_append_sheet(wb, U.aoa_to_sheet(s), 'Stok');
  U.book_append_sheet(wb, U.aoa_to_sheet(r), 'Rekap');
  XLSX.writeFile(wb, XPATH);
}

function grid(sheetName) {
  const wb = XLSX.readFile(XPATH);
  const ws = wb.Sheets[sheetName];
  if (!ws || !ws['!ref']) return [];
  const rg = XLSX.utils.decode_range(ws['!ref']);
  const out = [];
  for (let i = rg.s.r; i <= rg.e.r; i++) {
    const row = [];
    for (let j = rg.s.c; j <= rg.e.c; j++) {
      const a = XLSX.utils.encode_cell({ r: i, c: j });
      row.push(ws[a] ? String(ws[a].v) : '');
    }
    out.push(row);
  }
  return out;
}
function hasNum(g, val) {
  return g.some(row => row.some(c => Math.abs(parseFloat(String(c).replace(/[^\d.\-]/g, '')) - val) < 0.5));
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
  const reader = res.body.getReader();
  const dec = new TextDecoder();
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

const norm = s => String(s).replace(/\./g, '').replace(/\s+/g, ' ').toLowerCase();

const CASES = [
  { id: 'T1-list', timeout: 120000,
    goal: 'List semua file yang ada di workspace ini.',
    verify: r => ({ ok: r.tools.length > 0 && r.text.length > 10, why: 'perlu >=1 tool utk list nyata' }) },
  { id: 'T2-write', timeout: 120000,
    goal: 'Buat file catatan-tool-test.txt dengan isi persis: halo dari tool stability test',
    pre: () => { try { fs.unlinkSync(NOTE); } catch {} },
    verify: () => ({ ok: fs.existsSync(NOTE) && /halo dari tool stability test/i.test(fs.readFileSync(NOTE, 'utf8')), why: 'file harus ada & isi cocok' }) },
  { id: 'T3-read', timeout: 120000,
    goal: 'Baca isi file catatan-tool-test.txt lalu tuliskan isinya apa adanya.',
    verify: r => ({ ok: /halo dari tool stability test/i.test(r.text), why: 'jawaban harus berisi konten file asli' }) },
  { id: 'T4-edit', timeout: 120000,
    goal: 'Ubah seluruh isi file catatan-tool-test.txt menjadi: sudah diedit oleh agent',
    verify: () => ({ ok: fs.existsSync(NOTE) && /sudah diedit oleh agent/i.test(fs.readFileSync(NOTE, 'utf8')), why: 'isi file harus berubah' }) },
  { id: 'T5-extract', timeout: 150000,
    goal: 'Ekstrak data terstruktur dari teks ini: "Nama: Budi Santoso, Umur: 30, Kota: Medan, Total Belanja: Rp150.000". Tampilkan sebagai tabel.',
    verify: r => ({ ok: /budi santoso/i.test(r.text) && /150\.?000/.test(r.text) && /\b30\b/.test(r.text), why: 'nama+total+umur harus muncul' }) },
  { id: 'T6-unitconv', timeout: 150000,
    goal: 'Konversi 15 km ke meter dan 2 jam ke menit.',
    verify: r => ({ ok: /15000/.test(norm(r.text)) && /\b120\b/.test(r.text), why: 'harus 15000 meter & 120 menit' }) },
  { id: 'T7-docreader', timeout: 180000,
    goal: 'Sebutkan daftar sheet yang ada di dalam Laporan Bengkel Januari.xlsx beserta jumlah baris datanya.',
    verify: r => { const t = r.text.toLowerCase(); return { ok: t.includes('penjualan januari') && t.includes('stok') && t.includes('rekap'), why: '3 nama sheet asli harus disebut (tak mungkin tanpa baca file)' }; } },
  { id: 'T8-todo', timeout: 150000,
    goal: 'Susun rencana rekap penjualan bulanan menjadi 3 langkah kerja.',
    verify: r => ({ ok: r.text.length > 50, why: 'rencana tersusun (todo opsional dinilai dari coverage)' }),
    softExpect: ['todo_write'] },
  { id: 'T9-excel', timeout: 300000,
    goal: 'Catat penjualan tanggal 23/01/2026 di Laporan Bengkel Januari.xlsx: Cat Tembok 5kg terjual 6 kaleng harga 45000 per kaleng. Hitung dan perbarui juga total keseluruhan.',
    verify: () => { const g = grid('Penjualan Januari'); return { ok: hasNum(g, 270000) && hasNum(g, 2230000), why: `baris baru 270000 & total 2230000 | total ditemukan=${hasNum(g, 2230000)}, baris=${hasNum(g, 270000)}` }; },
    softExpect: ['desktop_excel_edit'] },
];

async function main() {
  console.log(`=== TOOL STABILITY SUITE v2 | model=${modelId} ===\n`);
  genTemplate();
  console.log('[setup] template xlsx diregenerasi\n');
  const only = process.argv.slice(3).flatMap(a => a.split(',')).filter(Boolean);
  const cases = only.length ? CASES.filter(c => only.some(f => c.id.includes(f))) : CASES;
  if (only.length) console.log(`[batch] running: ${cases.map(c => c.id).join(', ')}\n`);
  const results = [];
  for (const c of cases) {
    process.stdout.write(`[${c.id}] ${c.goal.slice(0, 58)}... `);
    if (c.pre) c.pre();
    let r, err = null;
    try { r = await send(c.goal, c.timeout); }
    catch (e) { r = { text: '', tools: [], ms: 0 }; err = e.message.slice(0, 80); }
    await new Promise(s => setTimeout(s, 2000));
    let v; try { v = c.verify(r); } catch (e) { v = { ok: false, why: e.message }; }
    const pass = v.ok && !err;
    results.push({ id: c.id, pass, tools: r.tools });
    console.log(pass ? 'PASS' : 'FAIL', `(${(r.ms / 1000).toFixed(1)}s)`,
      `tools=[${r.tools.join(',')}]`, err ? `err=${err}` : '', !v.ok ? `why: ${v.why}` : '');
  }
  const P = results.filter(x => x.pass).length;
  console.log(`\n=== SCORE: ${P}/${results.length} | model=${modelId} ===`);
  console.log('Coverage:', [...new Set(results.flatMap(x => x.tools))].join(', '));
  process.exit(P === results.length ? 0 : 1);
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
