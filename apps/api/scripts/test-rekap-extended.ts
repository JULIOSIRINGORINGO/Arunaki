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

const INITIAL_TEMPLATE = `REKAPAN PENJUALAN 10 AGUSTUS 2026
----
PEMASUKAN :

CK AGUSTINO = 1.876RB(BRI) [ 45 PCS ]✅
CK ROLLER = 1.182RB(BCA) [ 17PCS ]✅

NOTE BELUM BAYAR :
CI LISOI ( 2-2-2024)= 830RB✅
CI LISOI ( 8-02-2024)= 1.860RB✅
CI LISOI (9-02-2024)= 450RB✅
CI LISOI (10-02-2024) = 140RB
SOLAR (26-2-2025) = 970RB✅

TOTAL = 4.250RB 

----

SISA PEMBAYARAN :
PAK ARNOL = 402RB


TOTAL =  402RB

----
PENGELUARAN :

----
TOTAL PEMASUKAN: 3.058 RB
TOTAL TF BRI : 1.876 RB
TOTAL TF BNI :  RB
TOTAL TF BCA : 1.182 RB
TOTAL TF MANDIRI : RB
TOTAL CASH : RB 
TOTAL TOKPED :  RB
TOTAL SHOOPE :RB
TOTAL PENGELUARAN : 0 RB
TOTAL UANG DI LACI: 3.058 RB 
         
---- 
SELISIH : 3.058 RB
----        	
BELANJAAN KE LABURA:
DTF         = 147 RB
BAJU        = 2.544 RB 50 [PCS]
 
Sablon      = 2 PCS
 
TOTAL       = 2.691 RB
=========================================
TOTAL BELANJA KE BENDONG RP 98.000,-
SISA DEPOSIT RP 14.207.640,-
`;

async function runTest() {
  console.log('🚀 Starting extended re-total test...');
  
  // Setup: Reset target file to original full template
  const targetFilePath = path.join(WORKSPACE_ROOT, TARGET_FILE);
  fs.writeFileSync(targetFilePath, INITIAL_TEMPLATE, 'utf-8');
  console.log(`📋 Initialized ${TARGET_FILE} with full original template (${INITIAL_TEMPLATE.length} chars)`);

  console.log('Instruksi:', instruction);

  let sawDone = false;
  let error: string | null = null;
  const calledTools: string[] = [];

  const apiKey = process.env.ARUNAKI_API_KEY;
  if (!apiKey) throw new Error('ARUNAKI_API_KEY is required');

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 360_000);
  const t0 = Date.now();
  let doneAt = 0;
  try {
    const response = await fetch(`${API_BASE}/workspaces/${WORKSPACE_ID}/agent/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ goal: instruction, historyMessages: [], modelId: 'deepseek-v4-flash' }),
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
        console.log(`[event:${event.type}]`, JSON.stringify(event.data)?.slice(0, 200));
        if (event.type === 'tool_start') {
          const toolName = event.data?.toolName;
          if (toolName) calledTools.push(toolName);
          console.log(`[tool_call] ${toolName} ${JSON.stringify(event.data?.args)?.slice(0, 120)}`);
        }
        if (event.type === 'llm' || event.type === 'message') console.log(`[llm]`, String(event.data).slice(0, 150));
        if (event.type === 'error') error = event.data?.message || 'unknown';
        if (event.type === 'done') { sawDone = true; doneAt = Date.now(); }
      }
      if (sawDone) break;
    }
    if (abortController.signal.aborted) throw new Error(`Agent stream exceeded 240 seconds (${Math.round((Date.now() - t0) / 1000)}s elapsed) — HARNESS FAIL`);
    if (error) throw new Error(`Agent error: ${error}`);
    if (!sawDone) throw new Error('Agent stream ended without a done event');
    console.log(`⏱️ Agent stream completed in ${Math.round((doneAt - t0) / 100) / 10}s (done event)`);
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
  console.log('\n📄 File preview (first 1200 chars):');
  console.log(content.slice(0, 1200));

  // Validation checks
  const now = new Date();
  const day = now.getDate();
  const monthLong = now.toLocaleDateString('id-ID', { month: 'long' }).toUpperCase();
  const year = now.getFullYear();
  const todayText = `${day} ${monthLong} ${year}`;

  const checks = [
    // 1. Calculations & New Transactions
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
    { name: 'Pengeluaran LISTRIK 250 ada', pass: /LISTRIK[\s=:]*250/i.test(content) },

    // 2. Template Structure Integrity (No Lost/Corrupted Sections)
    { name: 'Template: SISA PEMBAYARAN (PAK ARNOL) tidak terhapus', pass: content.includes('SISA PEMBAYARAN') && content.includes('PAK ARNOL') },
    { name: 'Template: BELANJAAN KE LABURA tidak terhapus', pass: content.includes('BELANJAAN KE LABURA') && content.includes('147 RB') && content.includes('2.544 RB') },
    { name: 'Template: TOTAL BELANJA KE BENDONG tidak terhapus', pass: content.includes('TOTAL BELANJA KE BENDONG') && content.includes('98.000') },
    { name: 'Template: SISA DEPOSIT RP 14.207.640,- tidak terhapus', pass: content.includes('SISA DEPOSIT') && content.includes('14.207.640') },
    { name: 'Template: CI LISOI (10-02-2024) uncompleted note tetap terjaga', pass: content.includes('CI LISOI') && content.includes('10-02-2024') },

    // 3. Tool Integrity (Must use edit, never write on existing files)
    { name: 'Tool: Menggunakan tool "edit" (bukan overwrite "write")', pass: calledTools.some(t => t.includes('edit')) && !calledTools.some(t => t.includes('write')) },
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
