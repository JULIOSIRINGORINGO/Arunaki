import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'http://127.0.0.1:3000/api/v1';
const TARGET_FILE = 'REKAPAN TERBARU2.txt';

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
BENSIN 100

(Catatan: Pertahankan section SISA PEMBAYARAN PAK ARNOL dan template belanjaan tetap seperti semula)`;

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

const MODELS = [
  { id: 'agnes-2-5-flash:free', label: 'agnes-2-5-flash:free' },
  { id: 'gpt-oss-20b', label: 'gpt-oss-20b' },
  { id: 'nemotron-3-super-120b-a12b:free', label: 'nemotron-3-super-120b-a12b:free' },
  { id: 'gpt-oss-120b', label: 'gpt-oss-120b' },
];

async function testSingleModel(model: { id: string; label: string }, workspaceId: string, workspaceRoot: string) {
  console.log(`\n===============================================================`);
  console.log(`🧪 TESTING MODEL ON test-rekap-extended: ${model.label}`);
  console.log(`===============================================================`);

  const targetFilePath = path.join(workspaceRoot, TARGET_FILE);
  fs.writeFileSync(targetFilePath, INITIAL_TEMPLATE, 'utf-8');

  const apiKey = process.env.ARUNAKI_API_KEY || 'arunaki-dev-key';
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 360_000);
  const t0 = Date.now();
  let doneAt = 0;
  let sawDone = false;
  let error: string | null = null;
  const calledTools: string[] = [];

  try {
    const response = await fetch(`${API_BASE}/workspaces/${workspaceId}/agent/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ goal: instruction, historyMessages: [], modelId: model.id }),
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
        if (event.type === 'tool_start') {
          const toolName = event.data?.toolName;
          if (toolName) calledTools.push(toolName);
          console.log(`  ⚙️ [Tool Start]: ${toolName}`);
        }
        if (event.type === 'tool_done') {
          console.log(`  ✅ [Tool Done]: ${event.data?.toolName}`);
        }
        if (event.type === 'error') error = event.data?.message || 'unknown';
        if (event.type === 'done') { sawDone = true; doneAt = Date.now(); }
      }
      if (sawDone) break;
    }
  } catch (err: any) {
    error = err.message;
  } finally {
    clearTimeout(timeout);
  }

  const durationSec = Math.round(((doneAt || Date.now()) - t0) / 100) / 10;
  await new Promise(r => setTimeout(r, 1000));

  const content = fs.existsSync(targetFilePath) ? fs.readFileSync(targetFilePath, 'utf-8') : '';

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
    { name: 'Total BCA = 825 RB', pass: /TOTAL TF BCA\s*[:=]\s*825\s*RB/i.test(content) },
    { name: 'Total BNI = 200 RB', pass: /TOTAL TF BNI\s*[:=]\s*200\s*RB/i.test(content) },
    { name: 'Total CASH = 150 RB', pass: /TOTAL CASH\s*[:=]\s*150\s*RB/i.test(content) },
    { name: 'Total Pengeluaran = 570 RB', pass: /TOTAL PENGELUARAN\s*[:=]\s*570\s*RB/i.test(content) },
    { name: 'Pengeluaran LISTRIK 250 ada', pass: /LISTRIK[\s=:]*250/i.test(content) },
    { name: 'SISA PEMBAYARAN PAK ARNOL terjaga', pass: content.includes('SISA PEMBAYARAN') && content.includes('PAK ARNOL') },
    { name: 'BELANJAAN KE LABURA terjaga', pass: content.includes('BELANJAAN KE LABURA') && content.includes('147 RB') },
    { name: 'TOTAL BELANJA KE BENDONG terjaga', pass: content.includes('TOTAL BELANJA KE BENDONG') && content.includes('98.000') },
    { name: 'SISA DEPOSIT terjaga', pass: content.includes('SISA DEPOSIT') && content.includes('14.207.640') },
    { name: 'CI LISOI uncompleted note terjaga', pass: content.includes('CI LISOI') && content.includes('10-02-2024') },
    { name: 'Tool edit used (no overwrite write)', pass: calledTools.some(t => t.includes('edit')) && !calledTools.some(t => t.includes('write')) },
  ];

  let passed = 0;
  checks.forEach(c => {
    if (c.pass) passed++;
  });

  console.log(`\n📊 RESULT FOR ${model.label}:`);
  console.log(`  ⏱️ Duration: ${durationSec}s`);
  console.log(`  📑 Score: ${passed}/${checks.length} checks passed`);
  console.log(`  ⚙️ Tools Called: ${calledTools.join(', ')}`);
  if (error) console.log(`  ⚠️ Error: ${error}`);

  return {
    model: model.label,
    durationSec,
    score: `${passed}/${checks.length}`,
    passedAll: passed === checks.length,
    tools: calledTools.length,
    error: error || '',
  };
}

async function main() {
  console.log('🚀 Running test-rekap-extended across all models...');

  const apiKey = process.env.ARUNAKI_API_KEY || 'arunaki-dev-key';
  const listRes = await fetch(`${API_BASE}/workspaces`, {
    headers: { 'x-api-key': apiKey },
  });
  const listData = await listRes.json();
  const workspaces = Array.isArray(listData) ? listData : (listData.data || []);
  const workspaceId = workspaces[0].id;
  const workspaceRoot = workspaces[0].rootPath || workspaces[0].path || path.resolve('workspace-demo');

  const results = [];
  for (const model of MODELS) {
    const res = await testSingleModel(model, workspaceId, workspaceRoot);
    results.push(res);
    await new Promise(r => setTimeout(r, 3000));
  }

  console.log('\n===============================================================');
  console.log('🏆 EXTENDED TEST REKAP COMPARISON MATRIX:');
  console.log('===============================================================');
  console.table(results);
}

main().catch(console.error);
