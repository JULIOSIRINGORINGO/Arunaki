const fs = require('fs');
const path = require('path');

async function runBenchmark() {
  console.log('🚀 Starting Arunaki Multi-Model Benchmark Test...');
  const startTime = Date.now();

  // 1. Fetch active workspaces
  const listRes = await fetch('http://127.0.0.1:3000/api/v1/workspaces', {
    headers: { 'x-api-key': 'arunaki-dev-key' },
  });
  const listData = await listRes.json();
  let workspaces = Array.isArray(listData) ? listData : (listData.data || listData.workspaces || []);
  let workspaceId = '';
  let workspacePath = '';

  if (workspaces.length === 0) {
    const createRes = await fetch('http://127.0.0.1:3000/api/v1/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': 'arunaki-dev-key' },
      body: JSON.stringify({
        name: 'Benchmark Workspace',
        rootPath: path.resolve('workspace-demo'),
        businessType: 'general',
      }),
    });
    const createJson = await createRes.json();
    console.log('Create Workspace Response:', createJson);
    const created = createJson.data || createJson;
    workspaceId = created.id;
    workspacePath = created.rootPath || path.resolve('workspace-demo');
  } else {
    workspaceId = workspaces[0].id;
    workspacePath = workspaces[0].rootPath || workspaces[0].path || path.resolve('workspace-demo');
  }
  if (!fs.existsSync(workspacePath)) {
    fs.mkdirSync(workspacePath, { recursive: true });
  }
  console.log(`📂 Using Workspace ID: ${workspaceId} (${workspacePath})`);

  // Copy sample file if needed
  const targetFile = path.join(workspacePath, 'REKAPAN TERBARU2.txt');
  const sourceContent = `CK AGUSTINO = 1.876RB(BRI) [ 45 PCS ]✅
CK ROLLER = 1.182RB(BCA) [ 17PCS ]✅

TOTAL = 3.058RB`;
  fs.writeFileSync(targetFile, sourceContent, 'utf-8');

  const goal = `update ini ke @REKAPAN TERBARU2.txt:
CK DEDI = 300RB(BCA) [ DTF ]✅
CK OWEN = 200RB(BNI) [10 PCS ]✅
CK BAMBANG = 450RB(BCA) [25 PCS ]✅
TOKO JAYA = 150RB(CASH) [ DTF ]✅
BUK RINA = 75RB(BCA) [5 PCS ]✅`;

  console.log(`🤖 Sending Goal: "${goal.substring(0, 60)}..."`);
  const streamRes = await fetch(`http://127.0.0.1:3000/api/v1/workspaces/${workspaceId}/agent/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': 'arunaki-dev-key' },
    body: JSON.stringify({ goal }),
  });

  const reader = streamRes.body.getReader();
  const decoder = new TextDecoder();
  let roundCount = 0;
  let toolCount = 0;

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
            console.log(`⚙️  [Tool Start]: ${event.data.toolName} (${JSON.stringify(event.data.args).substring(0, 80)})`);
          } else if (event.type === 'tool_done') {
            console.log(`✅ [Tool Done]: ${event.data.toolName} -> ${event.data.result?.preview?.substring(0, 100)}`);
          } else if (event.type === 'phase_change') {
            console.log(`🔄 [Phase]: ${event.data.from} -> ${event.data.to}`);
            if (event.data.to === 'analyzing') roundCount++;
          } else if (event.type === 'done') {
            console.log(`\n🎉 [Finished]: ${event.data.content}`);
          }
        } catch {}
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n========================================`);
  console.log(`⏱️ Total Time Elapsed: ${elapsed}s`);
  console.log(`🔄 Estimated Rounds: ${roundCount}`);
  console.log(`⚙️ Total Tools Executed: ${toolCount}`);

  // Verify file content
  const updatedContent = fs.readFileSync(targetFile, 'utf-8');
  console.log(`\n📄 Updated File Content:\n${updatedContent}`);
  console.log(`========================================\n`);
}

runBenchmark().catch(console.error);
