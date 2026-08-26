/**
 * Office (Word/PPT) Stability Suite - outcome-based, COM fixtures.
 * Usage: node test/office-stability-test.cjs <modelId> [D|E|D1|E2...]
 */
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const API = 'http://127.0.0.1:3000/api/v1';
const WID = process.env.WORKSPACE_ID || 'cmt4e7xfh0001vgoc2mx8nf7n';
const WROOT = process.env.WORKSPACE_ROOT || 'E:\\JS\\Arunika\\workspace-demo';
const KEY = '199710338e26f2127f7012001e927b4b';
const DOCX = path.join(WROOT, 'Surat Penawaran.docx');
const PPTX = path.join(WROOT, 'Presentasi Toko.pptx');

const modelId = process.argv[2] || 'agnes-2-0-flash:free';

function ps(cmd) {
  return new Promise((resolve) => {
    execFile('powershell', ['-NoProfile', '-Command', cmd], { timeout: 90000 }, (err, stdout) => resolve({ err, out: String(stdout || '').trim() }));
  });
}

async function makeDocxFixture() {
  const docPath = DOCX.replace(/\\/g, '\\\\');
  const c = [
    '$w = New-Object -ComObject Word.Application; $w.Visible = $false',
    '$d = $w.Documents.Add()',
    `$cr = [char]13`,
    `$d.Content.Text = ("SURAT PENAWARAN HARGA" + $cr + $cr + "Kepada Yth. Bapak Andi," + $cr + "Harga total untuk paket katering ini adalah Rp1.500.000 sudah termasuk pajak.")`,
    `$d.SaveAs('${docPath}', 16)`,
    '$d.Close(); $w.Quit()',
  ].join('\n');
  await ps(c);
}

async function makePptxFixture() {
  const c = `
$p = New-Object -ComObject PowerPoint.Application
$pres = $p.Presentations.Add(0)
$s1 = $pres.Slides.Add(1, 12); $s1.Shapes.Title.TextFrame.TextRange.Text = "Toko Roti Manis"
$s2 = $pres.Slides.Add(2, 12); $s2.Shapes.Title.TextFrame.TextRange.Text = "Menu Unggulan"
$pres.SaveAs('${PPTX.replace(/\\/g, '\\\\')}')
$pres.Close(); $p.Quit()
`;
  await ps(c);
}

function psQuote(s) { return s.replace(/'/g, "''"); }

async function docxText() {
  const mammoth = require('mammoth');
  const r = await mammoth.extractRawText({ path: DOCX });
  return r.value || '';
}

async function pptSlideCount() {
  const r = await ps(`$p = New-Object -ComObject PowerPoint.Application; $pres = $p.Presentations.Open('${psQuote(PPTX)}', $true, $true, $false); Write-Output $pres.Slides.Count; $pres.Close(); $p.Quit()`);
  return parseInt(r.out, 10) || 0;
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
  { id: 'D1-replace', timeout: 360000,
    goal: 'Di dokumen Surat Penawaran.docx, ganti tulisan Rp1.500.000 menjadi Rp1.750.000.',
    verify: async () => { const t = await docxText(); return { ok: t.includes('Rp1.750.000') && !t.includes('Rp1.500.000'), why: `docx now: ${t.slice(0,80)}` }; },
    softExpect: ['desktop_word_edit'] },
  { id: 'D2-append', timeout: 360000,
    goal: 'Tambahkan paragraf penutup baru di akhir Surat Penawaran.docx dengan isi: Demikian surat penawaran ini kami sampaikan, atas perhatian Bapak kami ucapkan terima kasih.',
    verify: async () => { const t = await docxText(); return { ok: /Demikian surat penawaran ini/i.test(t), why: 'paragraf harus ada di dokumen' }; },
    softExpect: ['desktop_word_edit'] },
  { id: 'D3-pdf', timeout: 360000,
    goal: 'Ubah Surat Penawaran.docx menjadi file PDF bernama Surat Penawaran.pdf di folder yang sama.',
    verify: async () => ({ ok: fs.existsSync(path.join(WROOT, 'Surat Penawaran.pdf')), why: 'PDF harus ada' }),
    softExpect: ['desktop_word_edit'] },
  { id: 'E1-addslide', timeout: 360000,
    goal: 'Di Presentasi Toko.pptx, tambahkan satu slide baru dengan judul Terima Kasih di urutan paling akhir.',
    pre: async () => { /* capture base count */ },
    verify: async () => { const n = await pptSlideCount(); global.__baseSlides = global.__baseSlides || 2; return { ok: n >= 3, why: `slides=${n} (butuh >=3)` }; },
    softExpect: ['desktop_ppt_edit'] },
];

async function main() {
  console.log(`=== OFFICE STABILITY SUITE | model=${modelId} ===\n`);
  console.log('[setup] membuat fixture Word + PPT via COM...');
  await makeDocxFixture(); await makePptxFixture();
  console.log(`[setup] docx exists=${fs.existsSync(DOCX)}, pptx exists=${fs.existsSync(PPTX)}\n`);
  try { global.__baseSlides = await pptSlideCount(); } catch { global.__baseSlides = 2; }
  const only = process.argv.slice(3).flatMap(a => a.split(',')).filter(Boolean);
  const cases = only.length ? CASES.filter(c => only.some(f => c.id.includes(f))) : CASES;
  if (only.length) console.log(`[batch] running: ${cases.map(c => c.id).join(', ')}\n`);
  let P = 0, T = 0;
  for (const c of cases) {
    process.stdout.write(`[${c.id}] ${c.goal.slice(0, 58)}... `);
    if (c.pre) await c.pre();
    let r, err = null;
    try { r = await send(c.goal, c.timeout); }
    catch (e) { r = { text: '', tools: [], ms: 0 }; err = e.message.slice(0, 70); }
    await new Promise(s => setTimeout(s, 2000));
    let v; try { v = await c.verify(r); } catch (e) { v = { ok: false, why: e.message }; }
    const pass = v.ok && !err;
    P += pass ? 1 : 0; T++;
    console.log(pass ? 'PASS' : 'FAIL', `(${(r.ms / 1000).toFixed(1)}s)`, `tools=[${[...new Set(r.tools)].join(',')}]`, err ? `err=${err}` : '', !v.ok ? `why: ${v.why}` : '');
  }
  console.log(`\n=== SCORE: ${P}/${T} | model=${modelId} ===`);
  process.exit(P === T ? 0 : 1);
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
