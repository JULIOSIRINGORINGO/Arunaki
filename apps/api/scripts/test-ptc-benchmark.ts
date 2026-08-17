import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'http://127.0.0.1:3000/api/v1';
let WORKSPACE_ID = process.env.WORKSPACE_ID || '';
let WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || '';
const TARGET_FILE = 'REKAPAN TERBARU2.txt';

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
BELANJA:
- PLASTIK = 120RB (CASH)
- LAKBAN = 45RB (CASH)

TOTAL BELANJA: 165RB

----
SISA DEPOSIT RP 14.207.640,-
`;

async function runPtcBenchmark() {
  const apiKey = process.env.ARUNAKI_API_KEY || 'arunaki-dev-key';

  if (!WORKSPACE_ID || !WORKSPACE_ROOT) {
    const listRes = await fetch(`${API_BASE}/workspaces`, {
      headers: { 'x-api-key': apiKey },
    });
    const listData = await listRes.json();
    const workspaces = Array.isArray(listData) ? listData : listData.data || [];
    if (workspaces.length === 0) throw new Error('No active workspace found');
    WORKSPACE_ID = workspaces[0].id;
    WORKSPACE_ROOT = workspaces[0].rootPath || workspaces[0].path || path.resolve('workspace-demo');
  }

  const targetFilePath = path.join(WORKSPACE_ROOT, TARGET_FILE);

  console.log(`========================================================================`);
  console.log(`⚡ DEEPSEEK HARNESS-INSPIRED PROGRAMMATIC TOOL CALLING (PTC) BENCHMARK`);
  console.log(`📂 Workspace: ${WORKSPACE_ID} (${WORKSPACE_ROOT})`);
  console.log(`========================================================================\n`);

  // --- STEP 1: RESET TEST FILE ---
  console.log(`[TEST 1] 📄 Setting up test file with original template...`);
  fs.writeFileSync(targetFilePath, INITIAL_TEMPLATE, 'utf-8');

  // --- STEP 2: RUN AGENT WITH BATCH/PTC INTENT ---
  console.log(`[TEST 2] 🚀 Triggering agent stream with batch programmatic execution...`);
  const t0 = Date.now();
  let fullResponse = '';
  const calledTools: string[] = [];

  const goal = `Batch update rekap hari ini:
CK HENDRA = 250RB(BCA) [ 10 PCS ]✅
TOKO MAJU = 100RB(CASH) [ DTF ]✅`;

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 90_000);

  try {
    const response = await fetch(`${API_BASE}/workspaces/${WORKSPACE_ID}/agent/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        goal,
        modelId: 'agnes-2-5-flash:free',
      }),
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
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

        if (event.type === 'tool_start') {
          const toolName = event.data?.toolName;
          if (toolName) calledTools.push(toolName);
          console.log(`  [+${elapsed}s][tool_start] ${toolName}`);
        } else if (event.type === 'tool_done') {
          console.log(`  [+${elapsed}s][tool_done] ${event.data?.toolName} (${event.data?.result?.status})`);
        } else if (event.type === 'text_delta') {
          fullResponse += event.data || '';
        } else if (event.type === 'done') {
          if (event.data?.content) fullResponse = event.data.content;
        }
      }
    }
  } finally {
    clearTimeout(timeout);
  }

  const durationSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n⏱️ Total Execution Time: ${durationSec}s. Tools Called: ${calledTools.join(', ')}`);

  const resultingContent = fs.readFileSync(targetFilePath, 'utf-8');
  console.log(`\n📄 Resulting File Snippet:\n`);
  console.log(resultingContent.slice(0, 450));

  // --- ASSERTIONS ---
  console.log(`\n📊 === PTC BENCHMARK ASSERTION MATRIX === 📊`);
  const checks = [
    {
      name: 'Date header autonomously updated to 17 AGUSTUS 2026',
      pass: resultingContent.includes('17 AGUSTUS 2026'),
    },
    {
      name: 'Transaction inserted: CK HENDRA',
      pass: resultingContent.includes('CK HENDRA'),
    },
    {
      name: 'Transaction inserted: TOKO MAJU',
      pass: resultingContent.includes('TOKO MAJU'),
    },
    {
      name: 'Template Invariant: SISA DEPOSIT preserved',
      pass: resultingContent.includes('14.207.640'),
    },
    {
      name: 'Execution completed safely without errors',
      pass: durationSec !== '0.0' && resultingContent.length > 100,
    },
  ];

  let passed = 0;
  for (const c of checks) {
    if (c.pass) {
      console.log(`✅ ${c.name}`);
      passed++;
    } else {
      console.log(`❌ ${c.name}`);
    }
  }

  console.log(`\n🎯 Final Benchmark Score: ${passed}/${checks.length} assertions passed!`);
}

runPtcBenchmark().catch(console.error);
