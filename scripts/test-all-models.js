const fs = require('fs');
const path = require('path');

const MODELS_TO_TEST = [
  { id: 'agnes-2-5-flash:free', label: 'agnes-2-5-flash:free' },
  { id: 'gpt-oss-20b', label: 'gpt-oss-20b' },
  { id: 'nemotron-3-super-120b-a12b:free', label: 'nemotron-3-super-120b-a12b:free' },
  { id: 'gpt-oss-120b', label: 'gpt-oss-120b' },
];

async function runModelTest(modelInfo, workspaceId, workspacePath) {
  console.log(`\n===============================================================`);
  console.log(`🧪 TESTING MODEL: ${modelInfo.label}`);
  console.log(`===============================================================`);

  const targetFile = path.join(workspacePath, 'REKAPAN TERBARU2.txt');
  const initialContent = `CK AGUSTINO = 1.876RB(BRI) [ 45 PCS ]✅
CK ROLLER = 1.182RB(BCA) [ 17PCS ]✅

TOTAL = 3.058RB`;
  fs.writeFileSync(targetFile, initialContent, 'utf-8');

  const goal = `update ini ke @REKAPAN TERBARU2.txt:
CK DEDI = 300RB(BCA) [ DTF ]✅
CK OWEN = 200RB(BNI) [10 PCS ]✅
CK BAMBANG = 450RB(BCA) [25 PCS ]✅
TOKO JAYA = 150RB(CASH) [ DTF ]✅
BUK RINA = 75RB(BCA) [5 PCS ]✅`;

  const startTime = Date.now();
  let toolCount = 0;
  let rounds = 0;
  let finalMessage = '';
  let errorMsg = '';

  try {
    const streamRes = await fetch(`http://127.0.0.1:3000/api/v1/workspaces/${workspaceId}/agent/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': 'arunaki-dev-key' },
      body: JSON.stringify({
        goal,
        modelId: modelInfo.id,
      }),
    });

    if (!streamRes.ok) {
      throw new Error(`HTTP Error: ${streamRes.status} ${streamRes.statusText}`);
    }

    const reader = streamRes.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      const lines = text.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.substring(6));
            if (event.type === 'tool_start') {
              toolCount++;
              console.log(`  ⚙️  [Tool Start]: ${event.data.toolName}`);
            } else if (event.type === 'tool_done') {
              console.log(`  ✅ [Tool Done]: ${event.data.toolName} -> ${event.data.result?.preview?.substring(0, 80)}`);
            } else if (event.type === 'phase_change' && event.data.to === 'analyzing') {
              rounds++;
            } else if (event.type === 'done') {
              finalMessage = event.data.content || '';
              console.log(`  🏁 [Done]: "${finalMessage.substring(0, 100)}..."`);
            } else if (event.type === 'error') {
              errorMsg = event.data?.message || 'Unknown error';
              console.log(`  ❌ [Error Event]: ${errorMsg}`);
            }
          } catch {}
        }
      }
    }
  } catch (err) {
    errorMsg = err.message;
    console.log(`  💥 [Fetch Exception]: ${err.message}`);
  }

  const durationSec = parseFloat(((Date.now() - startTime) / 1000).toFixed(1));
  const updatedContent = fs.existsSync(targetFile) ? fs.readFileSync(targetFile, 'utf-8') : '';

  // Validation checks
  const checks = {
    hasDedi: updatedContent.includes('CK DEDI'),
    hasOwen: updatedContent.includes('CK OWEN'),
    hasBambang: updatedContent.includes('CK BAMBANG'),
    hasTokoJaya: updatedContent.includes('TOKO JAYA'),
    hasBukRina: updatedContent.includes('BUK RINA'),
  };

  const allPassed = Object.values(checks).every(Boolean);

  console.log(`\n📊 RESULT FOR ${modelInfo.label}:`);
  console.log(`  ⏱️ Duration: ${durationSec}s`);
  console.log(`  🔄 Rounds: ${rounds || 1}`);
  console.log(`  ⚙️ Tools Executed: ${toolCount}`);
  console.log(`  📑 File Integrity (5/5 checks): ${allPassed ? '✅ ALL PASSED' : '⚠️ PARTIAL/FAILED'}`);
  if (!allPassed) {
    console.log(`     Checks breakdown:`, checks);
  }

  return {
    model: modelInfo.label,
    durationSec,
    rounds: rounds || 1,
    toolCount,
    success: allPassed,
    error: errorMsg,
  };
}

async function main() {
  console.log('🚀 ARUNAKI MULTI-MODEL COMPARISON TEST MATRIX');
  console.log('Testing each model 1 by 1 against standard document task...');

  const listRes = await fetch('http://127.0.0.1:3000/api/v1/workspaces', {
    headers: { 'x-api-key': 'arunaki-dev-key' },
  });
  const listData = await listRes.json();
  const workspaces = Array.isArray(listData) ? listData : (listData.data || []);
  const workspaceId = workspaces[0].id;
  const workspacePath = workspaces[0].rootPath || workspaces[0].path || path.resolve('workspace-demo');

  const summary = [];

  for (const model of MODELS_TO_TEST) {
    const result = await runModelTest(model, workspaceId, workspacePath);
    summary.push(result);
    // Pause 3 seconds between models
    await new Promise((r) => setTimeout(r, 3000));
  }

  console.log('\n===============================================================');
  console.log('🏆 FINAL COMPARISON TABLE:');
  console.log('===============================================================');
  console.table(summary);
}

main().catch(console.error);
