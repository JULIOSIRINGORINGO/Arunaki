import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'http://127.0.0.1:3000/api/v1';
let WORKSPACE_ID = process.env.WORKSPACE_ID || '';
const TARGET_FILE = 'REKAPAN TERBARU2.txt';
let WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || '';

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

const LOG_FILE = path.join(process.cwd(), 'test-sentinel-output.log');

function log(msg: string) {
  console.log(msg);
  fs.appendFileSync(LOG_FILE, msg + '\n', 'utf-8');
}

async function sendAgentMessage(goal: string, history: Array<{ role: 'user' | 'assistant'; content: string }> = [], modelId = 'deepseek/deepseek-chat-v3-0324:free') {
  const apiKey = process.env.ARUNAKI_API_KEY || 'arunaki-dev-key';
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 180_000);
  const t0 = Date.now();
  let fullResponse = '';
  const calledTools: string[] = [];

  try {
    const response = await fetch(`${API_BASE}/workspaces/${WORKSPACE_ID}/agent/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({ goal, historyMessages: history, modelId }),
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
          log(`  [+${elapsed}s][tool_start] ${toolName}`);
        } else if (event.type === 'tool_done') {
          log(`  [+${elapsed}s][tool_done] ${event.data?.toolName} (${event.data?.result?.status})`);
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
  return { durationSec, fullResponse, calledTools };
}

async function runLearningLoop() {
  const apiKey = process.env.ARUNAKI_API_KEY || 'arunaki-dev-key';

  if (!WORKSPACE_ID || !WORKSPACE_ROOT) {
    const listRes = await fetch(`${API_BASE}/workspaces`, {
      headers: { 'x-api-key': apiKey },
    });
    const listData = await listRes.json();
    const workspaces = Array.isArray(listData) ? listData : (listData.data || []);
    if (workspaces.length === 0) throw new Error('No active workspace found');
    WORKSPACE_ID = workspaces[0].id;
    WORKSPACE_ROOT = workspaces[0].rootPath || workspaces[0].path || path.resolve('workspace-demo');
  }

  const targetFilePath = path.join(WORKSPACE_ROOT, TARGET_FILE);
  const arunakiMdPath = path.join(WORKSPACE_ROOT, '.arunaki', 'ARUNAKI.md');

  log(`========================================================================`);
  log(`🔄 MULTI-TURN TEACHING & LIVING SENTINEL EVOLUTION TEST`);
  log(`📂 Workspace: ${WORKSPACE_ID} (${WORKSPACE_ROOT})`);
  log(`========================================================================\n`);

  // --- STEP 1: INITIAL RAW INPUT ---
  log(`[TURN 1] 💬 Sending initial raw sales data without command...`);
  fs.writeFileSync(targetFilePath, INITIAL_TEMPLATE, 'utf-8');
  
  const rawInput1 = `CK DEDI = 300RB(BCA) [ DTF ]✅
CK OWEN = 200RB(BNI) [10 PCS ]✅
CK BAMBANG = 450RB(BCA) [25 PCS ]✅
TOKO JAYA = 150RB(CASH) [ DTF ]✅
BUK RINA = 75RB(BCA) [5 PCS ]✅`;

  const turn1 = await sendAgentMessage(rawInput1);
  log(`  ⏱️ Turn 1 finished in ${turn1.durationSec}s. Tools: ${turn1.calledTools.join(', ')}`);

  let fileContentAfterTurn1 = fs.readFileSync(targetFilePath, 'utf-8');
  log(`  📄 Turn 1 Header: ${fileContentAfterTurn1.split('\n')[0]}`);

  log(`  ⏳ Waiting 3s for Turn 1 background persistence to finalize...`);
  await new Promise((r) => setTimeout(r, 3000));

  // --- STEP 2: USER CORRECTION & TEACHING TURN ---
  log(`\n[TURN 2] 👩‍🏫 User teaches the agent: "Salah, tanggal judul di atas harus selalu diperbarui ke tanggal hari ini (17 AGUSTUS 2026), dan total BCA itu 1.182 + 300 + 450 + 75 = 2.007 RB."`);
  
  const correctionPrompt = `Salah, setiap kali ada rekap penjualan baru, tanggal judul di paling atas harus selalu kamu perbarui ke tanggal hari ini (17 AGUSTUS 2026). Dan total BCA harusnya 1.182 + 300 + 450 + 75 = 2.007 RB. Tolong perbaiki sekarang.`;

  const history = [
    { role: 'user' as const, content: rawInput1 },
    { role: 'assistant' as const, content: turn1.fullResponse || 'Sudah saya update ke laporan.' },
  ];

  const turn2 = await sendAgentMessage(correctionPrompt, history);
  log(`  ⏱️ Turn 2 finished in ${turn2.durationSec}s. Tools: ${turn2.calledTools.join(', ')}`);

  // Wait 4s for Sentinel Agent in background
  log(`  ⏳ Waiting 4s for Sentinel Agent to process correction event in background...`);
  await new Promise((r) => setTimeout(r, 4000));

  let fileContentAfterTurn2 = fs.readFileSync(targetFilePath, 'utf-8');
  log(`  📄 Turn 2 Header: ${fileContentAfterTurn2.split('\n')[0]}`);

  // --- STEP 3: CHECK ARUNAKI.MD EVOLUTION ---
  log(`\n[SENTINEL CHECK] 🛡️ Inspecting .arunaki/ARUNAKI.md for auto-learned rules...`);
  let arunakiMdContent = fs.existsSync(arunakiMdPath) ? fs.readFileSync(arunakiMdPath, 'utf-8') : '';
  log(`--- .arunaki/ARUNAKI.md Recent Rules ---`);
  log(arunakiMdContent.slice(-450));

  // --- STEP 4: VERIFICATION ON A FRESH TRANSACTION (AUTONOMOUS MEMORY TEST) ---
  log(`  ⏳ Waiting 3s before starting Turn 3...`);
  await new Promise((r) => setTimeout(r, 3000));

  log(`\n[TURN 3 - RETEST] 🚀 Testing fresh raw input on reset template to verify the agent now updates the date automatically!`);
  fs.writeFileSync(targetFilePath, INITIAL_TEMPLATE, 'utf-8');

  const rawInput2 = `CK HENDRA = 250RB(BCA) [ 10 PCS ]✅
TOKO MAJU = 100RB(CASH) [ DTF ]✅`;

  const turn3 = await sendAgentMessage(rawInput2);
  log(`  ⏱️ Turn 3 finished in ${turn3.durationSec}s. Tools: ${turn3.calledTools.join(', ')}`);

  let fileContentAfterTurn3 = fs.readFileSync(targetFilePath, 'utf-8');
  log(`\n📄 Turn 3 Resulting File (Header & Summary):\n`);
  log(fileContentAfterTurn3.slice(0, 500));

  // --- ASSERTIONS ---
  log(`\n📊 === LEARNING & CORRECTION ASSERTION MATRIX === 📊`);
  const checks = [
    {
      name: 'Turn 2: Date header successfully updated to 17 AGUSTUS 2026',
      pass: fileContentAfterTurn2.includes('17 AGUSTUS 2026'),
    },
    {
      name: 'Turn 2: Total BCA updated to 2.007 RB',
      pass: fileContentAfterTurn2.includes('2.007') || fileContentAfterTurn2.includes('2007'),
    },
    {
      name: 'Sentinel: ARUNAKI.md contains date/header evolution rule',
      pass: arunakiMdContent.toLowerCase().includes('tanggal') || arunakiMdContent.toLowerCase().includes('date') || arunakiMdContent.toLowerCase().includes('judul') || arunakiMdContent.toLowerCase().includes('17 agustus'),
    },
    {
      name: 'Turn 3: Fresh raw input autonomously set Date header to 17 AGUSTUS 2026 on first turn',
      pass: fileContentAfterTurn3.includes('17 AGUSTUS 2026'),
    },
    {
      name: 'Template Preservation: SISA DEPOSIT & BELANJA preserved across all turns',
      pass: fileContentAfterTurn3.includes('14.207.640'),
    },
  ];

  let passed = 0;
  for (const c of checks) {
    if (c.pass) {
      log(`✅ ${c.name}`);
      passed++;
    } else {
      log(`❌ ${c.name}`);
    }
  }

  log(`\n🎯 Final Score: ${passed}/${checks.length} assertions passed!`);
}

runLearningLoop().catch(console.error);
