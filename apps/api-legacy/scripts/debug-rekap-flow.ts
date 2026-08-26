import 'dotenv/config';

const API_BASE = 'http://127.0.0.1:3000/api/v1';
const WORKSPACE_ID = process.env.WORKSPACE_ID || 'cmshh81u8000bvg78c4ay5hgk';

const instruction = `Update laporan hari ini di file @REKAPAN TERBARU2.txt dengan data berikut, dan hitung ulang semua total secara otomatis:

PEMASUKAN:
CK DEDI = 300RB(BCA) [ DTF ]✅
CK OWEN = 200RB(BNI) [10 PCS ]✅
CK BAMBANG = 450RB(BCA) [25 PCS ]✅
TOKO JAYA = 150RB(CASH) [ DTF ]✅
BUK RINA = 75RB(BCA) [5 PCS ]✅

NOTE BELUM BAYAR:
CI LISOI (10-02-2024) = 140RB
CK TUKANG METER PLN(18-7-2026) = 50RB✅
BG JONO(28-7-2026) = 720RB✅

PENGELUARAN:
GALON 7
PARKIR 3
PRINT 5
LAUNDRY 30
LISTRIK 250
TOKO SEMBAKO 175
BENSIN 100`;

async function main() {
  const apiKey = process.env.ARUNAKI_API_KEY;
  if (!apiKey) throw new Error('ARUNAKI_API_KEY is required');

  console.log('Goal (first 200):', instruction.slice(0, 200));

  const response = await fetch(`${API_BASE}/workspaces/${WORKSPACE_ID}/agent/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify({ goal: instruction, historyMessages: [], modelId: 'gpt-oss-120b' }),
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
        const d = event.data;
        const label = event.type;
        if (label === 'tool_start') console.log(`[tool_start] ${d?.toolName} ${JSON.stringify(d?.args)?.slice(0, 200)}`);
        else if (label === 'tool_done') console.log(`[tool_done] ${d?.toolName} → ${String(d?.result?.status)}: ${String(d?.result?.preview ?? '').slice(0, 150)}`);
        else if (label === 'error') console.log(`[error] ${JSON.stringify(d)}`);
        else if (label === 'thinking') console.log(`[thinking] ${String(d).slice(0, 400)}`);
        else if (label === 'llm' || label === 'message' || label === 'text_delta') console.log(`[${label}] ${String(d).slice(0, 300)}`);
        else if (label === 'done') console.log(`[done] content=${String(d?.content).slice(0, 200)}`);
        else if (label === 'phase_changed' || label === 'state_changed') console.log(`[${label}] ${JSON.stringify(d).slice(0, 120)}`);
        else console.log(`[${label}] ${JSON.stringify(d)?.slice(0, 150)}`);
      } catch {
        console.log('RAW:', line.slice(0, 200));
      }
    }
  }
  console.log('=== STREAM END ===');
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
