import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'http://127.0.0.1:3000/api/v1';
const WORKSPACE_ID = 'cmshh81u8000bvg78c4ay5hgk';
const TARGET_FILE = 'REKAPAN TERBARU2.txt';
const WORKSPACE_ROOT = 'E:\\JS\\laporan-test';

const instruction = `update laporan hari ini ke file @${TARGET_FILE} ini datanya:

Pemasukan:
TOKO HARAPAN = 600RB(BCA) [ DTF ]✅
KAK MELLY = 350RB(BNI) [ 15 PCS ]✅
PAK HENDRA = 150RB(MANDIRI) [ 2 PCS ]✅
WARUNG BERKAH = 500RB(BCA) [ 30 PCS ]✅
BU MARIAM = 100RB(CASH) [ DTF ]✅

Pengeluaran:
GALON 10
PARKIR 5
FOTOCOPY 20
KERTAS HVS 45
KONSUMSI 70

Note Belum Bayar:
CI LISOI ( 2-2-2024)= 830RB✅
CI LISOI ( 8-02-2024)= 1.860RB✅
CI LISOI (9-02-2024)= 450RB✅
CI LISOI (10-02-2024) = 140RB✅
SOLAR (26-2-2025) = 970RB✅
BG ARIEL (6(3)/7(4)-2025) = 1.400RB✅
PAK MULA (15-04-2025) = 350RB✅`;

async function runTest() {
  console.log('🚀 Starting 2nd Blind Test (Different Customer Names)...');
  console.log('Instruksi:\n', instruction);
  const startTime = Date.now();

  try {
    const response = await fetch(`${API_BASE}/workspaces/${WORKSPACE_ID}/agent/stream`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-API-Key': process.env.ARUNAKI_API_KEY || '199710338e26f2127f7012001e927b4b'
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

    const streamDeadline = Date.now() + 180000;
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
            console.log(`[${event.type}]`, event.data);
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
      console.error('❌ Stream tidak menghasilkan event done dalam 120s');
      process.exit(1);
    }

  } catch (e: any) {
    console.error('❌ Request failed:', e.message);
    process.exit(1);
  }

  const durationMs = Date.now() - startTime;
  const durationSec = (durationMs / 1000).toFixed(1);

  // Small delay for file write
  await new Promise(r => setTimeout(r, 1000));

  // Load result file
  const resultPath = path.join(WORKSPACE_ROOT, TARGET_FILE);
  if (!fs.existsSync(resultPath)) {
    console.log('❌ File not found after agent run');
    process.exit(1);
  }

  const content = fs.readFileSync(resultPath, 'utf-8');
  console.log('\n=================== RESULT FILE CONTENT ===================');
  console.log(content);
  console.log('===========================================================\n');

  // Validation checks
  const now = new Date();
  const day = now.getDate();
  const monthLong = now.toLocaleDateString('id-ID', { month: 'long' }).toUpperCase();
  const year = now.getFullYear();
  const todayText = `${day} ${monthLong} ${year}`;
  
  const checks = [
    { name: 'Tanggal diperbarui ke hari ini', pass: content.toUpperCase().includes(todayText) },
    { name: 'Pemasukan TOKO HARAPAN, KAK MELLY, PAK HENDRA, WARUNG BERKAH, BU MARIAM ada', pass: content.includes('TOKO HARAPAN') && content.includes('KAK MELLY') && content.includes('PAK HENDRA') && content.includes('WARUNG BERKAH') && content.includes('BU MARIAM') },
    { name: 'Pengeluaran baru (GALON 10, PARKIR 5, FOTOCOPY 20, KERTAS HVS 45, KONSUMSI 70) ada', pass: content.includes('GALON') && content.includes('PARKIR') && content.includes('FOTOCOPY') && content.includes('KERTAS HVS') && content.includes('KONSUMSI') },
    { name: '7 Note Belum Bayar (CI LISOI, SOLAR, BG ARIEL, PAK MULA) ada', pass: content.includes('CI LISOI') && content.includes('SOLAR') && content.includes('BG ARIEL') && content.includes('PAK MULA') },
    { name: 'Mandiri Math: Total Note Belum Bayar = 6.000 RB', pass: /TOTAL\s*=\s*6[\.\,]?000\s*RB/i.test(content) || /TOTAL\s*[:=]\s*6[\.\,]?000/i.test(content) },
    { name: 'Mandiri Math: Total Pemasukan = 1.700 RB', pass: /TOTAL PEMASUKAN\s*[:=]\s*1[\.\,]?700\s*RB/i.test(content) },
    { name: 'Mandiri Math: Total BCA = 1.100 RB', pass: /TOTAL TF BCA\s*[:=]\s*1[\.\,]?100\s*RB/i.test(content) },
    { name: 'Mandiri Math: Total BNI = 350 RB', pass: /TOTAL TF BNI\s*[:=]\s*350\s*RB/i.test(content) },
    { name: 'Mandiri Math: Total MANDIRI = 150 RB', pass: /TOTAL MANDIRI\s*[:=]\s*150\s*RB/i.test(content) },
    { name: 'Mandiri Math: Total Cash = 100 RB', pass: /TOTAL CASH\s*[:=]\s*100\s*RB/i.test(content) },
    { name: 'Mandiri Math: Total Pengeluaran = 150 RB', pass: /TOTAL PENGELUARAN\s*[:=]\s*150\s*RB/i.test(content) },
    { name: 'Mandiri Math: Selisih = 1.550 RB', pass: /SELISIH\s*[:=]\s*1[\.\,]?550\s*RB/i.test(content) },
  ];

  let passed = 0;
  checks.forEach(c => {
    console.log(`${c.pass ? '✅' : '❌'} ${c.name}`);
    if (c.pass) passed++;
  });

  console.log(`\n⏱️ Execution Duration: ${durationSec} seconds`);
  console.log(`📊 Accuracy Score: ${passed}/${checks.length} checks passed`);
  process.exit(passed === checks.length ? 0 : 1);
}

runTest();