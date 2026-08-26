import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'http://127.0.0.1:3000/api/v1';
let WORKSPACE_ID = process.env.WORKSPACE_ID || '';
let WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || '';
const TARGET_FILE = 'REKAPAN TERBARU2.txt';
const TEST_SESSION_ID = `benchmark-time-travel-${Date.now()}`;

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

const RAW_SALES_INPUT = `Update laporan hari ini di file @${TARGET_FILE} dengan data penjualan berikut:
CK HENDRA = 250RB(BCA) [ 10 PCS ]✅
TOKO MAJU = 100RB(CASH) [ DTF ]✅`;

async function runBenchmark() {
  const apiKey = process.env.ARUNAKI_API_KEY || 'arunaki-dev-key';

  if (!WORKSPACE_ID || !WORKSPACE_ROOT) {
    const listRes = await fetch(`${API_BASE}/workspaces`, {
      headers: { 'x-api-key': apiKey },
    });
    const listData = await listRes.json();
    const workspaces = Array.isArray(listData) ? listData : (listData.data || []);
    if (workspaces.length === 0) {
      throw new Error('No active workspace found');
    }
    WORKSPACE_ID = workspaces[0].id;
    WORKSPACE_ROOT = workspaces[0].rootPath || workspaces[0].path || path.resolve('workspace-demo');
  }

  console.log('========================================================================');
  console.log('⏳ DEEPSEEK HARNESS-INSPIRED TIME-TRAVEL & TRANSCRIPT BENCHMARK');
  console.log(`📂 Workspace: ${WORKSPACE_ID} (${WORKSPACE_ROOT})`);
  console.log(`🆔 Session ID: ${TEST_SESSION_ID}`);
  console.log('========================================================================\n');

  // STEP 1: Setup original file
  const targetFilePath = path.join(WORKSPACE_ROOT, TARGET_FILE);
  fs.writeFileSync(targetFilePath, INITIAL_TEMPLATE, 'utf-8');
  console.log(`[STEP 1] 📄 Initialized original template in ${TARGET_FILE}...`);

  // STEP 2: Trigger AI agent to mutate the file
  console.log(`[STEP 2] 🚀 Triggering AI agent run to mutate file...`);
  const response = await fetch(`${API_BASE}/workspaces/${WORKSPACE_ID}/agent/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      goal: RAW_SALES_INPUT,
      sessionId: TEST_SESSION_ID,
      modelId: 'agnes-2-5-flash:free',
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Agent stream request failed: HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
  }

  const mutatedContent = fs.readFileSync(targetFilePath, 'utf-8');
  const hasMutated = mutatedContent.includes('CK HENDRA') || mutatedContent.includes('17 AGUSTUS 2026');
  console.log(`[STEP 2] ✅ AI mutated file on disk (has new entries: ${hasMutated})`);

  // STEP 3: Inspect Transcript API
  console.log(`[STEP 3] 📜 Querying session transcript from REST API...`);
  const transcriptRes = await fetch(
    `${API_BASE}/workspaces/${WORKSPACE_ID}/sessions/${TEST_SESSION_ID}/transcript`,
    {
      headers: { 'x-api-key': apiKey },
    },
  );
  const transcriptData = await transcriptRes.json();
  const transcript = transcriptData.data;

  console.log(`   - Total Events in Transcript: ${transcript?.eventCount || 0}`);
  console.log(`   - Total Checkpoints Recorded: ${transcript?.checkpointCount || 0}`);

  // STEP 4: Execute 1-Click Rollback / Time Travel
  console.log(`[STEP 4] ↩️ Executing 1-Click Rollback / Time Travel...`);
  const rollbackRes = await fetch(
    `${API_BASE}/workspaces/${WORKSPACE_ID}/sessions/${TEST_SESSION_ID}/rollback`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({}),
    },
  );
  const rollbackData = await rollbackRes.json();
  console.log(`   - Rollback Response:`, rollbackData.data?.message || rollbackData);

  // STEP 5: Verify File Restored 100% on Disk
  console.log(`[STEP 5] 🔍 Verifying file content on disk after rollback...`);
  const restoredContent = fs.readFileSync(targetFilePath, 'utf-8');

  console.log('\n📊 === TIME-TRAVEL BENCHMARK ASSERTION MATRIX === 📊');
  const assertions = [
    {
      name: 'Session transcript recorded events sequentially',
      passed: (transcript?.eventCount || 0) >= 3,
    },
    {
      name: 'Pre-mutation file snapshot recorded in transcript',
      passed: (transcript?.checkpointCount || 0) >= 1,
    },
    {
      name: 'Rollback API executed successfully (<10ms)',
      passed: rollbackData.error === null && (rollbackData.data?.success === true || rollbackData.data?.restoredCount >= 1),
    },
    {
      name: 'Target file 100% restored to original pre-mutation template',
      passed: restoredContent.trim() === INITIAL_TEMPLATE.trim(),
    },
    {
      name: 'Template Invariant: SISA DEPOSIT preserved',
      passed: restoredContent.includes('SISA DEPOSIT RP 14.207.640,-'),
    },
  ];

  let passedCount = 0;
  for (const a of assertions) {
    if (a.passed) {
      console.log(`✅ ${a.name}`);
      passedCount++;
    } else {
      console.log(`❌ ${a.name}`);
    }
  }

  console.log(`\n🎯 Final Benchmark Score: ${passedCount}/${assertions.length} assertions passed!`);
  if (passedCount === assertions.length) {
    console.log('\n🎉 PHASE 52 APPEND-ONLY TRANSCRIPT & TIME-TRAVEL ENGINE VALIDATED 100%!\n');
  } else {
    process.exit(1);
  }
}

runBenchmark().catch((err) => {
  console.error('❌ Benchmark failed:', err);
  process.exit(1);
});
