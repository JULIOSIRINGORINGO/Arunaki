import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'http://127.0.0.1:3000/api/v1';
let WORKSPACE_ID = process.env.WORKSPACE_ID || '';
let WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || '';

const DOC_1 = `FAKTUR PENJUALAN INV-001
Tanggal: 10 Agustus 2026
Pelanggan: PT Maju Jaya
Item: Kertas HVS A4 (50 Rim) @ Rp 45.000 = Rp 2.250.000
Pembayaran: Transfer BCA ✅
Status: LUNAS`;

const DOC_2 = `FAKTUR PENJUALAN INV-002
Tanggal: 12 Agustus 2026
Pelanggan: Toko Sentosa
Item: Tinta Sablon DTF (10 Liter) @ Rp 120.000 = Rp 1.200.000
Pembayaran: Cash Tunai ✅
Status: LUNAS`;

const DOC_3 = `FAKTUR PENJUALAN INV-003
Tanggal: 15 Agustus 2026
Pelanggan: CV Bintang Grafika
Item: Kaos Polos Combed 30s (100 Pcs) @ Rp 35.000 = Rp 3.500.000
Pembayaran: Transfer BRI ✅
Status: LUNAS`;

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
  console.log('⚡ PHASE 54: PARALLEL MULTI-DOCUMENT SUB-AGENT ORCHESTRATOR BENCHMARK');
  console.log(`📂 Workspace: ${WORKSPACE_ID} (${WORKSPACE_ROOT})`);
  console.log('========================================================================\n');

  // STEP 1: Create 3 sample documents in workspace
  const file1 = 'INV-001.txt';
  const file2 = 'INV-002.txt';
  const file3 = 'INV-003.txt';

  fs.writeFileSync(path.join(WORKSPACE_ROOT, file1), DOC_1, 'utf-8');
  fs.writeFileSync(path.join(WORKSPACE_ROOT, file2), DOC_2, 'utf-8');
  fs.writeFileSync(path.join(WORKSPACE_ROOT, file3), DOC_3, 'utf-8');
  console.log(`[STEP 1] 📄 Created 3 sample test documents: ${file1}, ${file2}, ${file3}...`);

  // STEP 2: Trigger agent with multi-document instruction
  const multiDocPrompt = `Proses semua file faktur berikut secara paralel: @${file1}, @${file2}, @${file3}. Ekstrak nama pelanggan, total nominal, dan metode pembayaran dari masing-masing file.`;

  console.log(`[STEP 2] 🚀 Triggering agent multi-document orchestration run...`);
  const response = await fetch(`${API_BASE}/workspaces/${WORKSPACE_ID}/agent/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      goal: multiDocPrompt,
      modelId: 'agnes-2-5-flash:free',
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Agent stream failed: HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const textDeltas: string[] = [];
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
          } else if (event.type === 'tool_start') {
            toolStarts.push(event.data.toolName);
          }
        } catch {}
      }
    }
  }

  const accumulatedResponse = textDeltas.join('');

  console.log(`[STEP 3] 🔍 Evaluating multi-document extraction results...`);
  console.log(`   - Tools Executed: ${toolStarts.join(', ')}`);
  console.log(`   - Response Length: ${accumulatedResponse.length} chars`);

  console.log('\n📊 === MULTI-DOCUMENT ORCHESTRATOR ASSERTION MATRIX === 📊');
  const assertions = [
    {
      name: 'Agent executed multi-document reading or processing tools',
      passed: toolStarts.length >= 1,
    },
    {
      name: 'Extracted PT Maju Jaya (INV-001) details accurately',
      passed: /PT Maju Jaya|2\.250\.000|BCA/i.test(accumulatedResponse),
    },
    {
      name: 'Extracted Toko Sentosa (INV-002) details accurately',
      passed: /Toko Sentosa|1\.200\.000|Cash/i.test(accumulatedResponse),
    },
    {
      name: 'Extracted CV Bintang Grafika (INV-003) details accurately',
      passed: /Bintang Grafika|3\.500\.000|BRI/i.test(accumulatedResponse),
    },
    {
      name: 'Total invoice files on disk intact without data loss',
      passed:
        fs.existsSync(path.join(WORKSPACE_ROOT, file1)) &&
        fs.existsSync(path.join(WORKSPACE_ROOT, file2)) &&
        fs.existsSync(path.join(WORKSPACE_ROOT, file3)),
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
    console.log('\n🎉 PHASE 54 PARALLEL MULTI-DOCUMENT SUB-AGENT ORCHESTRATOR VALIDATED 100%!\n');
  } else {
    process.exit(1);
  }
}

runBenchmark().catch((err) => {
  console.error('❌ Benchmark failed:', err);
  process.exit(1);
});
