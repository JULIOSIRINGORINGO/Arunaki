import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'http://localhost:3000/api/v1';
const WORKSPACE_ID = 'cmsj3htjg0008vtzs4oi4bzic';
const TARGET_FILE = 'REKAPAN TERBARU2.txt';
const WORKSPACE_ROOT = 'E:\\LAPORAN';

const instruction = `@${TARGET_FILE} update dong rekapnya, ini yang masuk:
ANDI = 400RB(BCA) [ DTF ]✅
BUDI = 250RB(BNI) [10 PCS ]✅
CITRA = 150RB(BCA) [ DTF ]✅
DEDI = 300RB(MANDIRI) [5 PCS ]✅
EKA = 200RB(CASH) [ DTF ]✅

terus ini pengeluarannya:
SNACK 12
MINUM 8
FOTOCOPY 15
PAKET 45
TAGIHAN AIR 80
TOKO KELONTONG 220
BBM 130

oh iya ini juga yang belum dibayar customer:
AYU (3-1-2025) = 120RB✅
BAYU (14-2-2025) = 340RB✅
CICI (25-3-2025) = 210RB
DINI (6-4-2025) = 180RB✅
ERWIN (17-5-2025) = 560RB✅
FITRI (28-6-2025) = 90RB✅
GALIH (9-7-2025) = 430RB✅
HENI (20-8-2025) = 275RB✅
IMAM (1-9-2025) = 620RB✅
JULIA (12-10-2025) = 380RB✅
KARIN (23-11-2025) = 150RB✅`;

async function runTest() {
  console.log('🚀 Starting dummy re-total test (data baru total beda)...');
  console.log('Instruksi:', instruction);

  try {
    const response = await fetch(`${API_BASE}/workspaces/${WORKSPACE_ID}/agent/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'arunaki-dev-key'
      },
      body: JSON.stringify({ goal: instruction, historyMessages: [] }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('❌ HTTP error:', response.status, text);
      process.exit(1);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      console.error('❌ No response body');
      process.exit(1);
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let error: string | null = null;
    let sawDone = false;

    const streamDeadline = Date.now() + 300000;
    while (Date.now() < streamDeadline) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'tool_call') console.log(`[tool_call] ${event.data?.name} ${JSON.stringify(event.data?.args)?.slice(0, 120)}`);
            if (event.type === 'llm' || event.type === 'message') console.log(`[llm]`, String(event.data).slice(0, 150));
            if (event.type === 'error') error = event.data?.message || 'unknown';
            if (event.type === 'done') sawDone = true;
          } catch (e) {
            // ignore parse errors
          }
        }
      }

      if (sawDone) {
        await new Promise(r => setTimeout(r, 2000));
        break;
      }
    }

    if (error) {
      console.error('❌ Agent error:', error);
      process.exit(1);
    }

    if (!sawDone) {
      console.error('❌ Stream tidak menghasilkan event done dalam 300s');
      process.exit(1);
    }

  } catch (e: any) {
    console.error('❌ Request failed:', e.message);
    process.exit(1);
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
  console.log('📄 File preview (first 900 chars):');
  console.log(content.slice(0, 900));

  // Validation checks
  const now = new Date();
  const day = now.getDate();
  const monthLong = now.toLocaleDateString('id-ID', { month: 'long' }).toUpperCase();
  const year = now.getFullYear();
  const todayText = `${day} ${monthLong} ${year}`;

  // NOTE BELUM BAYAR total: 120+340+210+180+560+90+430+275+620+380+150
  const noteBelumBayar = 120+340+210+180+560+90+430+275+620+380+150;

  const checks = [
    { name: 'Tanggal diperbarui ke hari ini', pass: content.toUpperCase().includes(todayText) },
    { name: 'ANDI ada (400)', pass: content.includes('ANDI') && content.includes('400RB') },
    { name: 'BUDI ada (250)', pass: content.includes('BUDI') && content.includes('250RB') },
    { name: 'CITRA ada (150)', pass: content.includes('CITRA') && content.includes('150RB') },
    { name: 'DEDI ada (300)', pass: content.includes('DEDI') && content.includes('300RB') },
    { name: 'EKA ada (200)', pass: content.includes('EKA') && content.includes('200RB') },
    { name: 'Entri NOTE BELUM BAYAR baru ada', pass: content.includes('JULIA') && content.includes('KARIN') && content.includes('IMAM') },
    { name: 'Total BCA = 550 RB (400+150)', pass: /TOTAL TF BCA\s*[:=]\s*550\s*RB/i.test(content) },
    { name: 'Total BNI = 250 RB', pass: /TOTAL TF BNI\s*[:=]\s*250\s*RB/i.test(content) },
    { name: 'Total MANDIRI = 300 RB', pass: /TOTAL TF MANDIRI\s*[:=]\s*300\s*RB/i.test(content) },
    { name: 'Total CASH = 200 RB', pass: /TOTAL CASH\s*[:=]\s*200\s*RB/i.test(content) },
    { name: 'Total Pemasukan = 1300 RB', pass: /TOTAL PEMASUKAN\s*[:=]\s*1300\s*RB/i.test(content) },
    { name: 'Total Pengeluaran = 510 RB (12+8+15+45+80+220+130)', pass: /TOTAL PENGELUARAN\s*[:=]\s*510\s*RB/i.test(content) },
    { name: 'Total Uang di Laci = 790 RB (1300-510)', pass: /TOTAL UANG DI LACI\s*[:=]\s*790\s*RB/i.test(content) },
    { name: 'Total NOTE BELUM BAYAR benar', pass: content.includes(`${noteBelumBayar}RB`) || content.includes(`${noteBelumBayar} RB`) || content.includes(`${noteBelumBayar.toLocaleString('id-ID')}RB`) },
    { name: 'Pengeluaran TAGIHAN AIR ada', pass: content.includes('TAGIHAN AIR 80') },
  ];

  let passed = 0;
  checks.forEach(c => {
    console.log(`${c.pass ? '✅' : '❌'} ${c.name}`);
    if (c.pass) passed++;
  });

  console.log(`\n${passed}/${checks.length} checks passed`);
  process.exit(passed === checks.length ? 0 : 1);
}

runTest();
