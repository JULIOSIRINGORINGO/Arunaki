const API_BASE = 'http://127.0.0.1:3000/api/v1';
let WORKSPACE_ID = process.env.WORKSPACE_ID || '';

async function sendAgentMessage(
  workspaceId: string,
  goal: string,
  model?: string,
  historyMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [],
): Promise<string> {
  const apiKey = process.env.ARUNAKI_API_KEY || 'arunaki-dev-key';
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/agent/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      goal,
      model,
      historyMessages,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No readable stream');

  const decoder = new TextDecoder();
  let buffer = '';
  let fullResponse = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const dataStr = trimmed.replace(/^data:\s*/, '');
      if (dataStr === '[DONE]') continue;
      try {
        const event = JSON.parse(dataStr);
        if (event.type === 'text_delta') {
          fullResponse += event.data;
        } else if (event.type === 'done' && event.data?.content && !fullResponse) {
          fullResponse = event.data.content;
        }
      } catch {}
    }
  }

  return fullResponse;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runMultiTurnAdaptiveLearningTest() {
  const apiKey = process.env.ARUNAKI_API_KEY || 'arunaki-dev-key';

  if (!WORKSPACE_ID) {
    const listRes = await fetch(`${API_BASE}/workspaces`, {
      headers: { 'x-api-key': apiKey },
    });
    const listData = (await listRes.json()) as any;
    const workspaces = Array.isArray(listData) ? listData : listData.data || [];
    if (workspaces.length === 0) {
      throw new Error('No active workspace found');
    }
    WORKSPACE_ID = workspaces[0].id;
  }

  const targetModel = process.argv[2] || process.env.TEST_MODEL || undefined;
  console.log(`🚀 Starting Multi-Turn Adaptive Learning & Consistency Benchmark on workspace ${WORKSPACE_ID}...`);
  if (targetModel) console.log(`🎯 Model: ${targetModel}\n`);

  // =========================================================================
  // DOMAIN 1: GARMENT CONVECTION (Multi-turn correction & consistency)
  // =========================================================================
  console.log(`=================================================================`);
  console.log(`📦 DOMAIN 1: Garment / Konveksi Order Workflow`);
  console.log(`=================================================================`);

  const garmentHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  console.log(`\n💬 [Turn 1] Initial Raw Input from User...`);
  const gPrompt1 = `bantu dong jadi gini buat kaos jalan2 kel adi adi m budi l citra s deni xl eka m fajar l gita s hani xl indra m joko 2xl eh lanjut rini s l xl xl 2xl nama nya rini andi bella chika dika terus eko m fina s galih l hendra xl intan m yg terakhir bima bima l nanda m oki xl putri s qori m raka l sinta xxl tono xl uli m vina s tolong direkap ukuran semua ya`;
  console.log(`User: "${gPrompt1.slice(0, 100)}..."`);
  const t1Res = await sendAgentMessage(WORKSPACE_ID, gPrompt1, targetModel, garmentHistory);
  garmentHistory.push({ role: 'user', content: gPrompt1 });
  garmentHistory.push({ role: 'assistant', content: t1Res });
  console.log(`🤖 Agent Turn 1 response: ${t1Res.slice(0, 150).replace(/\n/g, ' ')}...`);

  // Wait 3s
  await delay(3000);

  console.log(`\n💬 [Turn 2] User Teaches & Corrects Format Style (Natural Human Input - Zero Tech Terms)...`);
  const gPrompt2 = `Mulai sekarang kalau rekap kaos formatnya selalu buat seperti ini ya:
UKURAN
S [jumlah]
M [jumlah]
L [jumlah]
XL [jumlah]
2XL [jumlah]
3XL [jumlah]
TOTAL [jumlah] PCS
dan ukuran XXL selalu tulis sebagai 2XL`;
  console.log(`User Correction:\n${gPrompt2}`);
  const t2Res = await sendAgentMessage(WORKSPACE_ID, gPrompt2, targetModel, garmentHistory);
  garmentHistory.push({ role: 'user', content: gPrompt2 });
  garmentHistory.push({ role: 'assistant', content: t2Res });
  console.log(`🤖 Agent Turn 2 confirmation: ${t2Res.slice(0, 150).replace(/\n/g, ' ')}...`);

  // Wait 4s
  await delay(4000);

  console.log(`\n💬 [Turn 3] Testing Consistency on Brand New Unseen Order...`);
  const gPrompt3 = `rekap kaos futsal kelas: tono l, andi m, fajar xl, bayu s, reza xxl, dito m, dimas 2xl, rio s`;
  console.log(`User: "${gPrompt3}"`);
  const t3Res = await sendAgentMessage(WORKSPACE_ID, gPrompt3, targetModel, garmentHistory);
  console.log(`🤖 Agent Turn 3 response:\n${t3Res}`);

  const hasCanvasG = /\[CANVAS\]\s*([\s\S]*?)\s*\[\/CANVAS\]/i.test(t3Res);
  const canvasContentG = t3Res.match(/\[CANVAS\]\s*([\s\S]*?)\s*\[\/CANVAS\]/i)?.[1]?.trim() || t3Res;

  const hasS2 = /S\s*[:\-\[]?\s*2/i.test(canvasContentG);
  const hasM2 = /M\s*[:\-\[]?\s*2/i.test(canvasContentG);
  const hasL1 = /L\s*[:\-\[]?\s*1/i.test(canvasContentG);
  const hasXL1 = /XL\s*[:\-\[]?\s*1/i.test(canvasContentG);
  const has2XL2 = /2XL\s*[:\-\[]?\s*2/i.test(canvasContentG);
  const hasTotal8 = /TOTAL\s*[:\-\[]?\s*8/i.test(canvasContentG) || /8\s*PCS/i.test(canvasContentG);

  const domain1Passed = hasCanvasG && hasS2 && hasM2 && hasL1 && hasXL1 && has2XL2 && hasTotal8;
  console.log(`\n📊 Hasil Domain 1 (Garment): ${domain1Passed ? '✅ 100% KONSISTEN & PATUH FORMAT' : '❌ PERLU PENYESUAIAN'}`);
  console.log(`- Canvas Auto-Trigger: ${hasCanvasG ? '✅' : '❌'}`);
  console.log(`- Ukuran S=2, M=2, L=1, XL=1: ${hasS2 && hasM2 && hasL1 && hasXL1 ? '✅' : '❌'}`);
  console.log(`- Penyetaraan XXL -> 2XL (2 pcs): ${has2XL2 ? '✅' : '❌'}`);
  console.log(`- Total 8 PCS: ${hasTotal8 ? '✅' : '❌'}`);

  // =========================================================================
  // DOMAIN 2: BAKERY / TOKO KUE (Non-garment multi-turn learning)
  // =========================================================================
  console.log(`\n=================================================================`);
  console.log(`🍰 DOMAIN 2: Bakery / Toko Kue Order Workflow (Non-Garment)`);
  console.log(`=================================================================`);

  const bakeryHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  console.log(`\n💬 [Turn 1] User Teaches Bakery Format Rule (Natural Human Input)...`);
  const bPrompt1 = `Mulai sekarang di toko kue ini kalau ada pesanan format rekapnya selalu buat seperti ini:
REKAP PESANAN KUE
- [Nama Kue] : [Jumlah] [Satuan]
TOTAL ITEM: [Total] BOX/TOPLES/LOYANG`;
  console.log(`User Rule:\n${bPrompt1}`);
  const b1Res = await sendAgentMessage(WORKSPACE_ID, bPrompt1, targetModel, bakeryHistory);
  bakeryHistory.push({ role: 'user', content: bPrompt1 });
  bakeryHistory.push({ role: 'assistant', content: b1Res });
  console.log(`🤖 Agent Turn 1 confirmation: ${b1Res.slice(0, 150).replace(/\n/g, ' ')}...`);

  // Wait 4s
  await delay(4000);

  console.log(`\n💬 [Turn 2] Testing Consistency on Brand New Bakery Order...`);
  const bPrompt2 = `pesanan baru masuk ya: bu sarah roti sobek 4 box, pak hendra nastar 2 toples, bu tari lapis legit 1 box`;
  console.log(`User: "${bPrompt2}"`);
  const b2Res = await sendAgentMessage(WORKSPACE_ID, bPrompt2, targetModel, bakeryHistory);
  console.log(`🤖 Agent Turn 2 response:\n${b2Res}`);

  const hasCanvasB = /\[CANVAS\]\s*([\s\S]*?)\s*\[\/CANVAS\]/i.test(b2Res);
  const canvasContentB = b2Res.match(/\[CANVAS\]\s*([\s\S]*?)\s*\[\/CANVAS\]/i)?.[1]?.trim() || b2Res;

  const hasHeaderBakery = /REKAP PESANAN KUE/i.test(canvasContentB);
  const hasRotiSobek = /Roti Sobek\s*:\s*4\s*Box/i.test(canvasContentB);
  const hasNastar = /Nastar\s*:\s*2\s*Toples/i.test(canvasContentB);
  const hasLapisLegit = /Lapis Legit\s*:\s*1\s*Box/i.test(canvasContentB);
  const hasTotal7 = /TOTAL ITEM\s*:\s*7/i.test(canvasContentB) || /7\s*BOX/i.test(canvasContentB);

  const domain2Passed = hasCanvasB && hasHeaderBakery && hasRotiSobek && hasNastar && hasLapisLegit && hasTotal7;
  console.log(`\n📊 Hasil Domain 2 (Bakery): ${domain2Passed ? '✅ 100% KONSISTEN & PATUH FORMAT' : '❌ PERLU PENYESUAIAN'}`);
  console.log(`- Canvas Block: ${hasCanvasB ? '✅' : '❌'}`);
  console.log(`- Header REKAP PESANAN KUE: ${hasHeaderBakery ? '✅' : '❌'}`);
  console.log(`- Item Roti Sobek, Nastar, Lapis Legit: ${hasRotiSobek && hasNastar && hasLapisLegit ? '✅' : '❌'}`);
  console.log(`- Total 7 Item: ${hasTotal7 ? '✅' : '❌'}`);

  console.log(`\n=================================================================`);
  if (domain1Passed && domain2Passed) {
    console.log(`🎉 SEMUA PENGUJIAN MULTI-TURN ADAPTIVE LEARNING BERHASIL 100%!`);
  } else {
    console.log(`⚠️ Salah satu pengujian belum 100% konsisten.`);
    process.exit(1);
  }
  console.log(`=================================================================\n`);
}

runMultiTurnAdaptiveLearningTest().catch((err) => {
  console.error('Fatal multi-turn test error:', err);
  process.exit(1);
});
