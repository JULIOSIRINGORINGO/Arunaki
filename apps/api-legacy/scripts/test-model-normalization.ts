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
BELANJAAN KE LABURA:
DTF         = 147 RB
BAJU        = 2.544 RB 50 [PCS]
 
Sablon      = 2 PCS
 
TOTAL       = 2.691 RB
=========================================
TOTAL BELANJA KE BENDONG RP 98.000,-
SISA DEPOSIT RP 14.207.640,-
`;

const USER_DIRECTIVE = `update rekap @${TARGET_FILE}:
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
  console.log('⚡ PHASE 53: MODEL NORMALIZATION & STREAM RESILIENCE BENCHMARK');
  console.log(`📂 Workspace: ${WORKSPACE_ID} (${WORKSPACE_ROOT})`);
  console.log('========================================================================\n');

  // STEP 1: Initialize template
  const targetFilePath = path.join(WORKSPACE_ROOT, TARGET_FILE);
  fs.writeFileSync(targetFilePath, INITIAL_TEMPLATE, 'utf-8');
  console.log(`[STEP 1] 📄 Initialized original template in ${TARGET_FILE}...`);

  // STEP 2: Stream agent with model normalization
  console.log(`[STEP 2] 🚀 Streaming agent run via ModelStreamNormalizer...`);
  const response = await fetch(`${API_BASE}/workspaces/${WORKSPACE_ID}/agent/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      goal: USER_DIRECTIVE,
      modelId: 'agnes-2-5-flash:free',
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Agent stream failed: HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const textDeltas: string[] = [];
  const thinkingEvents: string[] = [];
  const toolStarts: string[] = [];
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const event = JSON.parse(line.slice(6));
          if (event.type === 'text_delta') {
            textDeltas.push(event.data);
          } else if (event.type === 'thinking') {
            thinkingEvents.push(event.data);
          } else if (event.type === 'tool_start') {
            toolStarts.push(event.data.toolName);
          }
        } catch {}
      }
    }
  }

  const accumulatedText = textDeltas.join('');
  const finalFileContent = fs.readFileSync(targetFilePath, 'utf-8');

  console.log(`[STEP 3] 🔍 Evaluating streaming events & file integrity...`);
  console.log(`   - Text Deltas received: ${textDeltas.length} chunks (${accumulatedText.length} chars)`);
  console.log(`   - Thinking Events received: ${thinkingEvents.length}`);
  console.log(`   - Tools Executed: ${toolStarts.join(', ')}`);

  console.log('\n📊 === MODEL NORMALIZATION ASSERTION MATRIX === 📊');
  const assertions = [
    {
      name: 'Agent executed at least 1 mutating tool (edit/write)',
      passed: toolStarts.some((t) => ['edit', 'write', 'batch_execute'].includes(t)),
    },
    {
      name: 'Streamed text delta contains ZERO raw <think> tags',
      passed: !accumulatedText.includes('<think>') && !accumulatedText.includes('</think>'),
    },
    {
      name: 'Streamed text delta contains ZERO leaked [Assistant tool call] syntax',
      passed: !accumulatedText.includes('[Assistant tool call]'),
    },
    {
      name: 'Target file successfully updated with new customer transactions',
      passed: finalFileContent.includes('CK HENDRA') && finalFileContent.includes('TOKO MAJU'),
    },
    {
      name: 'Template Invariant: SISA DEPOSIT preserved with zero corruption',
      passed: finalFileContent.includes('SISA DEPOSIT RP 14.207.640,-'),
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
    console.log('\n🎉 PHASE 53 MODEL NORMALIZATION & RESILIENT ADAPTER VALIDATED 100%!\n');
  } else {
    process.exit(1);
  }
}

runBenchmark().catch((err) => {
  console.error('❌ Benchmark failed:', err);
  process.exit(1);
});
