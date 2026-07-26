const http = require('http');

async function testWorkspaceAgent() {
  console.log('🚀 Testing Arunaki Autonomous Workspace Agent from CLI...');

  // 1. Fetch active workspaces
  const listRes = await fetch('http://127.0.0.1:3000/api/v1/workspaces');
  const listData = await listRes.json();

  let workspaceId = '';
  if (listData.data && listData.data.length > 0) {
    workspaceId = listData.data[0].id;
    console.log(`✅ Using existing Workspace ID: ${workspaceId} (${listData.data[0].name})`);
  } else {
    // Create new workspace
    const createRes = await fetch('http://127.0.0.1:3000/api/v1/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'CLI Test Workspace', description: 'Testing via terminal CLI' }),
    });
    const createData = await createRes.json();
    workspaceId = createData.data.id;
    console.log(`✅ Created new Workspace ID: ${workspaceId}`);
  }

  console.log('\n🤖 Sending Goal to Autonomous Workspace Agent: "Pindai seluruh file di workspace dan buatkan laporan Excel"');
  console.log('-----------------------------------------------------------------------------------');

  const streamRes = await fetch(`http://127.0.0.1:3000/api/v1/workspaces/${workspaceId}/agent/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      goal: 'Pindai seluruh file di workspace ini, lakukan analisis, dan buatkan file Excel laporan_ringkasan.xlsx',
    }),
  });

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
          if (event.type === 'thinking') {
            console.log(`🧠 [THINKING]: ${event.data}`);
          } else if (event.type === 'plan_created') {
            console.log(`📋 [PLAN CREATED]: Goal="${event.data.goal}"`);
            event.data.steps.forEach((s) => console.log(`   ${s}`));
          } else if (event.type === 'tool_start') {
            console.log(`⚙️  [TOOL EXECUTION]: ${event.data.toolName}`);
          } else if (event.type === 'approval_required') {
            console.log(`🛡️  [APPROVAL GATE]: ${event.data.description}`);
          } else if (event.type === 'tool_done') {
            console.log(`✅ [TOOL COMPLETED]: ${event.data.toolName} -> ${event.data.result.preview}`);
          } else if (event.type === 'done') {
            console.log(`\n🎉 [AGENT WORK FINISHED]:\n${event.data.content}`);
            if (event.data.artifacts?.length > 0) {
              console.log('\n📦 Generated Artifacts:');
              event.data.artifacts.forEach((a) => console.log(`   - ${a.filename} (ID: ${a.id})`));
            }
          }
        } catch {
          // ignore non-json SSE lines
        }
      }
    }
  }
}

testWorkspaceAgent().catch(console.error);
