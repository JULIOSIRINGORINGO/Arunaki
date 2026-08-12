import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'http://127.0.0.1:3000/api/v1';
const WORKSPACE_ID = process.env.WORKSPACE_ID || 'cmshh81u8000bvg78c4ay5hgk';
const TARGET_FILE = 'REKAPAN TERBARU2.txt';
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || 'E:\\JS\\laporan-test';

const instruction = `Update laporan hari ini di file @${TARGET_FILE} dengan data berikut, dan hitung ulang semua total secara otomatis:

PEMASUKAN:
CK DEDI = 300RB(BCA) [ DTF ]✅
CK OWEN = 200RB(BNI) [10 PCS ]✅
CK BAMBANG = 450RB(BCA) [25 PCS ]✅
TOKO JAYA = 150RB(CASH) [ DTF ]✅
BUK RINA = 75RB(BCA) [5 PCS ]✅

NOTE BELUM BAYAR:
CI LISOI (10-02-2024) = 140RB
CK TUKANG METER PLN(18-7-2026) = 50RB✅
BG JONO(28-7-2026) = 720RB✅

PENGELUARAN:
GALON 7
PARKIR 3
PRINT 5
LAUNDRY 30
LISTRIK 250
TOKO SEMBAKO 175
BENSIN 100`;

async function runTest() {
  console.log('🚀 Starting extended re-total test...');
  console.log('Instruksi:', instruction);

  let sawDone = false;
  let error: string | null = null;

  const apiKey = process.env.ARUNAKI_API_KEY;
  if (!apiKey) throw new Error('ARUNAKI_API_KEY is required');

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 90_000);
  const t0 = Date.now();
  try {
    const response = await fetch(`${API_BASE}/workspaces/${WORKSPACE_ID}/agent/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ goal: instruction, historyMessages: [], modelId: 'gpt-oss-120b' }),
      signal: abortController.signal,
    });
    if (!response.ok || !response.body) {
      throw new Error(`Agent stream failed: HTTP ${response.status} ${await response.text()}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (!abortController.signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const event = JSON.parse(line.slice(6));
        if (event.type === 'tool_start') console.log(`[tool_call] ${event.data?.toolName} ${JSON.stringify(event.data?.args)?.slice(0, 120)}`);
        if (event.type === 'llm' || event.type === 'message') console.log(`[llm]`, String(event.data).slice(0, 150));
        if (event.type === 'error') error = event.data?.message || 'unknown';
        if (event.type === 'done') sawDone = true;
      }
      if (sawDone) break;
    }
    if (abortController.signal.aborted) throw new Error(`Agent stream exceeded 90 seconds (${Math.round((Date.now() - t0) / 1000)}s elapsed) — HARNESS FAIL`);
    if (error) throw new Error(`Agent error: ${error}`);
    if (!sawDone) throw new Error('Agent stream ended without a done event');
  } catch (fetchErr: any) {
    console.error(`❌ ${fetchErr.message}`);
    process.exit(1);
  } finally {
    clearTimeout(timeout);
  }

  // Small delay for file write
  await new Promise(r => setTimeout(r, 1000));

  // Load result file
  const resultPath = path.join(WORKSPACE_ROOT, TARGET_FILE);
  if (!fs.existsSync(resultPath)) {
    console.log('❌ File not found after agent run');
    process.exit(1);
  }

  const content = fs.readFileSync(resultPath, 'utf-8');
  console.log('\n📄 File preview (first 900 chars):');
  console.log(content.slice(0, 900));

  // Validation checks
  const now = new Date();
  const day = now.getDate();
  const monthLong = now.toLocaleDateString('id-ID', { month: 'long' }).toUpperCase();
  const year = now.getFullYear();
  const todayText = `${day} ${monthLong} ${year}`;

  const checks = [
    { name: 'Tanggal diperbarui ke hari ini', pass: content.toUpperCase().includes(todayText) },
    { name: 'CK DEDI ada (300)', pass: content.includes('CK DEDI') && content.includes('300RB') },
    { name: 'CK OWEN ada (200)', pass: content.includes('CK OWEN') && content.includes('200RB') },
    { name: 'CK BAMBANG ada (450)', pass: content.includes('CK BAMBANG') && content.includes('450RB') },
    { name: 'TOKO JAYA ada (150)', pass: content.includes('TOKO JAYA') && content.includes('150RB') },
    { name: 'BUK RINA ada (75)', pass: content.includes('BUK RINA') && content.includes('75RB') },
    { name: 'Total BCA = 825 RB (300+450+75)', pass: /TOTAL TF BCA\s*[:=]\s*825\s*RB/i.test(content) },
    { name: 'Total BNI = 200 RB', pass: /TOTAL TF BNI\s*[:=]\s*200\s*RB/i.test(content) },
    { name: 'Total CASH = 150 RB', pass: /TOTAL CASH\s*[:=]\s*150\s*RB/i.test(content) },
    { name: 'Total Pengeluaran = 570 RB (7+3+5+30+250+175+100)', pass: /TOTAL PENGELUARAN\s*[:=]\s*570\s*RB/i.test(content) },
    { name: 'Total Uang di Laci = -420 RB (150 CASH - 570 PENGELUARAN)', pass: /TOTAL UANG DI LACI\s*[:=]\s*-420\s*RB/i.test(content) },
    { name: 'Pengeluaran LISTRIK 250 ada', pass: /LISTRIK[\s=:]*250/i.test(content) },
  ];

  let passed = 0;
  console.log('\n📊 === HASIL VERIFIKASI PENGUJIAN OTONOM === 📊');
  checks.forEach(c => {
    console.log(`${c.pass ? '✅' : '❌'} ${c.name}`);
    if (c.pass) passed++;
  });

  console.log(`\n${passed}/${checks.length} checks passed`);
  process.exit(passed === checks.length ? 0 : 1);
}

runTest();
