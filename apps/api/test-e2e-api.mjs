import fs from 'fs';
import path from 'path';

const API_KEY = '199710338e26f2127f7012001e927b4b';
const headers = { 
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${API_KEY}`
};

async function run() {
  console.log('1. Creating/Fetching workspace for e:\\JS\\laporan-test ...');
  
  // Register the specific workspace
  let createRes = await fetch('http://localhost:3000/api/v1/workspaces', {
    method: 'POST',
    headers,
    body: JSON.stringify({ 
      name: 'Laporan Test Workspace', 
      rootPath: 'e:\\JS\\laporan-test'
    })
  });
  let createJson = await createRes.json();
  
  let workspaceId;
  if (createJson.error) {
    // If it already exists or fails, try to find it
    console.log('Failed to create or already exists, fetching workspaces...');
    const wsRes = await fetch('http://localhost:3000/api/v1/workspaces', { headers });
    const wsJson = await wsRes.json();
    const ws = wsJson.data.find(w => w.rootPath === 'e:\\JS\\laporan-test');
    if (!ws) {
      console.error('Could not find or create the workspace.');
      return;
    }
    workspaceId = ws.id;
  } else {
    workspaceId = createJson.data.id;
  }
  
  console.log('Workspace ID:', workspaceId);

  console.log('2. Creating chat session...');
  const chatRes = await fetch('http://localhost:3000/api/v1/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({ mode: 'workspace', workspaceId })
  });
  const chatJson = await chatRes.json();
  const chatId = chatJson.data.id;
  console.log('Chat ID:', chatId);

  console.log('3. Sending prompt to agent...');
  const prompt = `Gunakan tool desktop_excel_edit untuk menambahkan baris baru.
filePath: "e:\\JS\\laporan-test\\TABEL REKAPAN NEW2026-.xlsm"
sheetName: "AGUSTUS"
action: append_row
rowData: ["TOKO VIVI", 430, "BCA", "DTF", "", "", "sisa deposit kurangi belanja Bendong Rp30.000"]
Lakukan aksi ini sekarang dan berikan pesan 'Tugasnya sudah selesai!'.`;
  
  const sendRes = await fetch(`http://localhost:3000/api/v1/chat/${chatId}/send`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content: prompt })
  });
  
  const sendJson = await sendRes.json();
  console.log('\n--- FIRST TURN RESPONSE ---');
  if (sendJson.error) {
    console.error('Agent failed:', sendJson);
    return;
  }
  
  console.log(sendJson.data.message.content);
  console.log('\n--- TOOL CALLS EXECUTED ---');
  for (const tool of sendJson.data.toolOutputs || []) {
    console.log(`- ${tool.toolName}`);
    console.log(`  Args: ${JSON.stringify(tool.args)}`);
    console.log(`  Result: ${JSON.stringify(tool.result).substring(0, 150)}...`);
  }

  console.log('\n4. Waiting for background agent loop to finish...');
  await new Promise(r => setTimeout(r, 10000));
  
  const msgRes = await fetch(`http://localhost:3000/api/v1/chat/${chatId}/messages`, { headers });
  const msgJson = await msgRes.json();
  console.log('\n--- FINAL CHAT MESSAGES ---');
  for (const m of msgJson.data) {
    console.log(`[${m.role.toUpperCase()}] ${m.content}`);
  }
}

run().catch(console.error);
