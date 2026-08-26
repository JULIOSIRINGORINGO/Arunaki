import 'dotenv/config';

const API_BASE = 'http://127.0.0.1:3000/api/v1';
const WORKSPACE_ID = process.env.WORKSPACE_ID || 'cmshh81u8000bvg78c4ay5hgk';

async function main() {
  const apiKey = process.env.ARUNAKI_API_KEY;
  if (!apiKey) throw new Error('ARUNAKI_API_KEY is required');

  const goal = 'Tambahkan baris "TEST SELESAI" di paling bawah file @test1.txt lalu selesai.';
  console.log('Goal:', goal);

  const response = await fetch(`${API_BASE}/workspaces/${WORKSPACE_ID}/agent/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({ goal, historyMessages: [], modelId: 'gpt-oss-120b' }),
  });
  if (!response.ok || !response.body) {
    throw new Error(`Agent stream failed: HTTP ${response.status} ${await response.text()}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const event = JSON.parse(line.slice(6));
        console.log(`[${event.type}]`, JSON.stringify(event.data ?? null).slice(0, 300));
      } catch {
        console.log('RAW:', line.slice(0, 200));
      }
    }
  }
  console.log('=== DONE ===');
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
