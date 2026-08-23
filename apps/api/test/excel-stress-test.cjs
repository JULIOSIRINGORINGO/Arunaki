const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const API = 'http://127.0.0.1:3000/api/v1';
const WID = 'cmt4e7xfh0001vgoc2mx8nf7n';
const WROOT = path.join(__dirname, 'workspace-demo');
const XFILE = 'Laporan Bengkel Januari.xlsx';
const XPATH = path.join(WROOT, XFILE);
const KEY = '199710338e26f2127f7012001e927b4b';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const XU = XLSX.utils;

function readSheet(name) {
  const wb = XLSX.readFile(XPATH);
  return wb.Sheets[name] || null;
}

function grid(name) {
  const ws = readSheet(name);
  if (!ws || !ws['!ref']) return [];
  const r = XU.decode_range(ws['!ref']);
  const out = [];
  for (let i = r.s.r; i <= r.e.r; i++) {
    const row = [];
    for (let j = r.s.c; j <= r.e.c; j++) {
      const addr = XU.encode_cell({ r: i, c: j });
      row.push(String(ws[addr] != null ? ws[addr].v : ''));
    }
    out.push(row);
  }
  return out;
}

function sheets() {
  const wb = XLSX.readFile(XPATH);
  return wb.SheetNames;
}

function findNum(g, val, tol) {
  tol = tol || 0.5;
  const hits = [];
  for (let r = 0; r < g.length; r++)
    for (let c = 0; c < g[r].length; c++) {
      const n = parseFloat(String(g[r][c]).replace(/[^\d.\-]/g, ''));
      if (Math.abs(n - val) <= tol) hits.push({ r: r, c: c, v: g[r][c] });
    }
  return hits;
}

function findStr(g, s) {
  s = s.toLowerCase();
  const hits = [];
  for (let r = 0; r < g.length; r++)
    for (let c = 0; c < g[r].length; c++)
      if (g[r][c].toLowerCase().includes(s)) hits.push({ r: r, c: c, v: g[r][c] });
  return hits;
}

function findRow(g, col, s) {
  s = s.toLowerCase();
  for (const row of g)
    if (row[col] && row[col].toLowerCase().includes(s)) return row;
  return null;
}

function maxNumInCol(g, col) {
  let mx = 0;
  for (let r = 0; r < g.length; r++) {
    const n = parseFloat(String(g[r][col]).replace(/[^\d.\-]/g, ''));
    if (!isNaN(n) && n > mx) mx = n;
  }
  return mx;
}

function countNonEmptyRows(g, startRow) {
  let c = 0;
  for (let r = startRow; r < g.length; r++) {
    if (g[r].some(v => v.trim() !== '')) c++;
  }
  return c;
}

let PASS = 0, FAIL = 0;
function check(name, ok, detail) {
  if (ok) { PASS++; console.log('  PASS ' + name); }
  else { FAIL++; console.log('  FAIL ' + name + (detail ? ' | ' + detail : '')); }
}

async function send(goal) {
  console.log('\n> ' + goal.substring(0, 120) + '...');
  const t0 = Date.now();
  const res = await fetch(API + '/workspaces/' + WID + '/agent/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': KEY },
    body: JSON.stringify({ goal: goal, historyMessages: [], modelId: 'mistral-large:free' }),
    signal: AbortSignal.timeout(900000)
  });
  if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + await res.text());
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', full = '', lastTool = '';
  const tools = [], errs = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const ev = JSON.parse(line.slice(6));
      if (ev.type === 'tool_start') { lastTool = ev.data.toolName; tools.push(ev.data.toolName); console.log('    [tool]', ev.data.toolName, JSON.stringify(ev.data.args || {}).slice(0, 300)); }
      if (ev.type === 'tool_done') { lastTool = ev.data.toolName || lastTool; const st = ev.data.result && ev.data.result.status; if (st && st !== 'success') console.log('    [tool-error]', JSON.stringify(ev.data.result.error || ev.data).slice(0, 300)); }
      if (ev.type === 'text_delta') full += ev.data || '';
      if (ev.type === 'done' && ev.data.content) full = ev.data.content;
      if (ev.type === 'error') errs.push(JSON.stringify(ev.data));
    }
  }
  const ms = Date.now() - t0;
  console.log('  [' + (ms/1000).toFixed(1) + 's] tools=[' + tools.join(',') + '] errs=' + JSON.stringify(errs));
  return { content: full, tools: tools, errs: errs, lastTool: lastTool };
}

const { execSync } = require('child_process');

async function main() {
  console.log('=== STRESS TEST: EXCEL MULTI-SHEET (NO HINTS) ===');
  console.log('No cell/column/sheet hints in instructions.\n');

  // Selective turns: node excel-stress-test.cjs T1,T3  → only those turns run
  const ONLY = process.argv.slice(2).flatMap(a => a.split(',')).filter(Boolean);
  const want = t => ONLY.length === 0 || ONLY.includes(t);

  // Reset fixture so the test is idempotent (fresh workbook, no stale files)
  execSync(`node "${path.join(__dirname, 'create-excel.cjs')}"`, { stdio: 'inherit' });
  for (const f of fs.readdirSync(WROOT)) {
    if (f.toLowerCase().endsWith('.pdf')) fs.unlinkSync(path.join(WROOT, f));
  }

  await sleep(1000);

  // ── TURN 1: Add 2 transactions ──
  if (want('T1')) {
  console.log('--- T1: Catat penjualan hari ini ---');
  const t1 = await send(
    'Catat penjualan hari ini di @Laporan Bengkel Januari.xlsx: tanggal 22/01/2026, Semen 40kg terjual 15 sak harga 65000, dan Besi beton 8mm terjual 7 batang harga 98000. Jangan lupa update totalnya juga.'
  );
  await sleep(3000);
  const g1 = grid('Penjualan Januari');
  check('T1: Semen row (975000) exists', findNum(g1, 975000).length > 0);
  check('T1: Besi row (686000) exists', findNum(g1, 686000).length > 0);
  check('T1: Grand total (3621000)', findNum(g1, 3621000).length > 0);
  check('T1: Original data preserved (650000)', findNum(g1, 650000).length > 0);
  check('T1: Tool used is excel-related', t1.tools.some(t => t.includes('excel')));
  }

  // ── TURN 2: Update stock ──
  if (want('T2')) {
  console.log('\n--- T2: Update stok gudang ---');
  const t2 = await send(
    'Update stok gudang juga di @Laporan Bengkel Januari.xlsx, semen 15 sak dan besi 7 batang tadi keluar dari gudang.'
  );
  await sleep(3000);
  const g2 = grid('Stok');
  // Find Semen row: Keluar col should increase, Sisa = Awal + Masuk - Keluar
  const semenRow = findRow(g2, 1, 'semen');
  const besiRow = findRow(g2, 1, 'besi');
  let semenOk = false, besiOk = false;
  if (semenRow) {
    const awal = parseFloat(semenRow[2]) || 0;
    const masuk = parseFloat(semenRow[3]) || 0;
    const keluar = parseFloat(semenRow[4]) || 0;
    const sisa = parseFloat(semenRow[5]) || 0;
    semenOk = keluar > 30 && Math.abs(sisa - (awal + masuk - keluar)) < 0.5;
  }
  if (besiRow) {
    const awal = parseFloat(besiRow[2]) || 0;
    const masuk = parseFloat(besiRow[3]) || 0;
    const keluar = parseFloat(besiRow[4]) || 0;
    const sisa = parseFloat(besiRow[5]) || 0;
    besiOk = keluar > 25 && Math.abs(sisa - (awal + masuk - keluar)) < 0.5;
  }
  check('T2: Stok Semen updated (keluar>30, sisa=awal+masuk-keluar)', semenOk, semenRow ? 'keluar=' + semenRow[4] + ' sisa=' + semenRow[5] : 'row not found');
  check('T2: Stok Besi updated (keluar>25, sisa=awal+masuk-keluar)', besiOk, besiRow ? 'keluar=' + besiRow[4] + ' sisa=' + besiRow[5] : 'row not found');
  check('T2: Tool used is excel-related', t2.tools.some(t => t.includes('excel')));
  }

  // ── TURN 3: Complete rekap ──
  if (want('T3')) {
  console.log('\n--- T3: Lengkapi rekap bulanan ---');
  const t3 = await send(
    'Lengkapi rekap bulanannya di @Laporan Bengkel Januari.xlsx: isi total penjualan keseluruhan dan jumlah transaksi yang ada di laporan penjualan.'
  );
  await sleep(3000);
  const g3 = grid('Rekap');
  const rekapTotal = findNum(g3, 3621000);
  const rekapCount = findNum(g3, 7);
  check('T3: Rekap total penjualan (3621000)', rekapTotal.length > 0);
  check('T3: Rekap jumlah transaksi (7)', rekapCount.length > 0);
  check('T3: Tool used is excel-related', t3.tools.some(t => t.includes('excel')));
  }

  // ── TURN 4: Clone sheet for February ──
  if (want('T4')) {
  console.log('\n--- T4: Siapkan laporan Februari ---');
  const t4 = await send(
    'Bulan depan sudah Februari, buat sheet penjualan bulan baru di @Laporan Bengkel Januari.xlsx yang strukturnya sama persis tapi kosong datanya dan judulnya jadi Februari. Data januari jangan sampai hilang.'
  );
  await sleep(3000);
  const sn = sheets();
  const hasFeb = sn.some(n => /feb/i.test(n));
  const hasJan = sn.some(n => /jan/i.test(n));
  check('T4: New Februari sheet exists', hasFeb, 'sheets=' + sn.join(','));
  check('T4: Januari sheet preserved', hasJan, 'sheets=' + sn.join(','));
  if (hasJan) {
    const gJan = grid('Penjualan Januari');
    check('T4: Januari data intact (3621000)', findNum(gJan, 3621000).length > 0);
  }
  if (hasFeb) {
    const gFeb = grid(sn.find(n => /feb/i.test(n)));
    const febDataRows = gFeb.filter(r => r.some(v => v.trim() !== '' && /rb|sak|batang|pcs/i.test(v)));
    check('T4: Februari sheet is empty (no data rows)', febDataRows.length === 0, 'data rows found=' + febDataRows.length);
  }
  }

  // ── TURN 5: Bold headers ──
  if (want('T5')) {
  console.log('\n--- T5: Bold header semua tabel ---');
  const t5 = await send(
    'Biar rapi, baris header atau judul di semua tabel di semua sheet di @Laporan Bengkel Januari.xlsx di-bold ya.'
  );
  await sleep(3000);
  // Can't read styles via community xlsx; check tool event
  const formatTools = t5.tools.filter(t => t.includes('excel'));
  check('T5: Excel tool called for formatting', formatTools.length > 0);
  }

  // ── TURN 6: Export rekap to PDF ──
  if (want('T6')) {
  console.log('\n--- T6: Export rekap ke PDF ---');
  const t6 = await send(
    'Rekap bulanannya di @Laporan Bengkel Januari.xlsx tolong dijadikan file PDF juga.'
  );
  await sleep(3000);
  const pdfFiles = fs.readdirSync(WROOT).filter(f => f.toLowerCase().endsWith('.pdf'));
  check('T6: PDF file created', pdfFiles.length > 0, 'files=' + pdfFiles.join(','));
  }

  // ── FINAL: Workbook integrity ──
  if (ONLY.length === 0) {
  console.log('\n--- FINAL: Workbook integrity ---');
  try {
    const wbFinal = XLSX.readFile(XPATH);
    check('FINAL: Workbook opens without error', true);
    check('FINAL: >= 3 sheets', wbFinal.SheetNames.length >= 3, 'sheets=' + wbFinal.SheetNames.join(','));
  } catch (e) {
    check('FINAL: Workbook opens without error', false, e.message);
  }
  }

  // ── SCORE ──
  const total = PASS + FAIL;
  console.log('\n=== SCORE: ' + PASS + '/' + total + ' passed, ' + FAIL + ' failed ===');
  process.exit(FAIL > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });


