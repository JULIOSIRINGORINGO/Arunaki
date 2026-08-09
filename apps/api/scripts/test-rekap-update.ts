import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'http://localhost:3000/api/v1';
const WORKSPACE_ID = 'cmsj3htjg0008vtzs4oi4bzic';
const TARGET_FILE = 'REKAPAN TERBARU2.txt';
const WORKSPACE_ROOT = 'E:\\LAPORAN';

const instruction = `update laporan hari ini ke file @${TARGET_FILE} ini datanya:
Pemasukan:
CK DEDI = 300RB(BCA) [ DTF ]✅
CK OWEN = 200RB(BNI) [10 PCS ]✅

Pengeluaran:
GALON 7
PARKIR 3
PRINT 5
LAUNDRY 30`;

async function runTest() {
  console.log('🚀 Starting test...');
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

    const streamDeadline = Date.now() + 120000;
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

  // Small delay for file write
  await new Promise(r => setTimeout(r, 1000));

  // Load result file
  const resultPath = path.join(WORKSPACE_ROOT, TARGET_FILE);
  if (!fs.existsSync(resultPath)) {
    console.log('❌ File not found after agent run');
    process.exit(1);
  }

  const content = fs.readFileSync(resultPath, 'utf-8');
  console.log('📄 File preview (first 500 chars):');
  console.log(content.slice(0, 500));

  // Validation checks
  const now = new Date();
  const day = now.getDate();
  const monthLong = now.toLocaleDateString('id-ID', { month: 'long' }).toUpperCase();
  const year = now.getFullYear();
  const todayText = `${day} ${monthLong} ${year}`;
  const checks = [
    { name: 'Tanggal diperbarui ke hari ini', pass: content.toUpperCase().includes(todayText) },
    { name: 'CK DEDI ada', pass: content.includes('CK DEDI') && content.includes('300RB') },
    { name: 'CK OWEN ada', pass: content.includes('CK OWEN') && content.includes('200RB') },
    { name: 'Data lama (CK AGUS) dihapus', pass: !content.includes('CK AGUS') },
    { name: 'Total BCA = 300 RB', pass: /TOTAL TF BCA\s*[:=]\s*300\s*RB/i.test(content) },
    { name: 'Total BNI = 200 RB', pass: /TOTAL TF BNI\s*[:=]\s*200\s*RB/i.test(content) },
    { name: 'Pengeluaran baru ada', pass: content.includes('GALON 7') && content.includes('PARKIR 3') && content.includes('PRINT 5') && content.includes('LAUNDRY 30') },
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