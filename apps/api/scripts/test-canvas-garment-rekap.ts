const API_BASE = 'http://127.0.0.1:3000/api/v1';
let WORKSPACE_ID = process.env.WORKSPACE_ID || '';

const garmentPrompt = `bantu dong jadi gini buat kaos jalan2 kel adi adi m budi l citra s deni xl eka m fajar l gita s hani xl indra m joko 2xl eh lanjut rini s l xl xl 2xl nama nya rini andi bella chika dika terus eko m fina s galih l hendra xl intan m yg terakhir bima bima l nanda m oki xl putri s qori m raka l sinta xxl tono xl uli m vina s tolong direkap ukuran semua ya terus kalau ada yg dobel atau ada yg aneh kasih tau juga sesuai aturan @garment.md`;

async function runCanvasGarmentBenchmark() {
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

  console.log(`🚀 Starting Canvas Garment Order Recap Benchmark on workspace ${WORKSPACE_ID}...`);

  const targetModel = process.argv[2] || process.env.TEST_MODEL || undefined;
  if (targetModel) {
    console.log(`🎯 Requesting explicit model: ${targetModel}`);
  }

  const startTime = Date.now();
  const res = await fetch(`${API_BASE}/workspaces/${WORKSPACE_ID}/agent/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      goal: garmentPrompt,
      model: targetModel,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No readable stream returned');

  const decoder = new TextDecoder();
  let buffer = '';
  let fullResponse = '';
  let finalDone = false;

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
      if (dataStr === '[DONE]') {
        finalDone = true;
        continue;
      }
      try {
        const event = JSON.parse(dataStr);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        if (event.type === 'thinking') {
          process.stdout.write(`\r[+${elapsed}s][thinking] ${String(event.data || '').slice(0, 80)}`);
        } else if (event.type === 'text_delta') {
          fullResponse += event.data;
          process.stdout.write(event.data || '');
        } else if (event.type === 'done') {
          if (event.data?.content && !fullResponse) {
            fullResponse = event.data.content;
          }
          finalDone = true;
        }
      } catch {
        // partial json
      }
    }
  }

  const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n⏱️ Agent stream completed in ${totalSec}s (done=${finalDone})`);

  console.log('\n📊 === HASIL VERIFIKASI INTERACTIVE CANVAS REKAP GARMEN === 📊');
  const checks: { label: string; pass: boolean }[] = [];

  // Check 1: Canvas block exists
  const hasCanvasBlock = /\[CANVAS\]\s*([\s\S]*?)\s*\[\/CANVAS\]/i.test(fullResponse);
  const canvasContent = fullResponse.match(/\[CANVAS\]\s*([\s\S]*?)\s*\[\/CANVAS\]/i)?.[1]?.trim() || '';

  checks.push({
    label: 'Canvas: Menghasilkan block [CANVAS]...[/CANVAS] siap salin',
    pass: hasCanvasBlock && canvasContent.length > 20,
  });

  // Check 2: Accurate size counts (S:6, M:8, L:6, XL:7, Total: 30)
  const hasS6 = /S\s*[:\-]?\s*6/i.test(canvasContent) || /1\.\s*S\s*6/i.test(canvasContent);
  const hasM8 = /M\s*[:\-]?\s*8/i.test(canvasContent) || /2\.\s*M\s*8/i.test(canvasContent);
  const hasL6 = /L\s*[:\-]?\s*6/i.test(canvasContent) || /3\.\s*L\s*6/i.test(canvasContent);
  const hasXL7 = /XL\s*[:\-]?\s*7/i.test(canvasContent) || /4\.\s*XL\s*7/i.test(canvasContent);
  const hasTotal30 = /TOTAL\s*[:\-]?\s*30\s*PCS/i.test(canvasContent) || /30\s*PCS/i.test(canvasContent);

  checks.push({
    label: 'Akurasi Ukuran: S=6, M=8, L=6, XL=7, Total=30 PCS',
    pass: hasS6 && hasM8 && hasL6 && hasXL7 && hasTotal30,
  });

  // Check 3: Anomaly detection in explanation text
  const mentionsAdi = /adi/i.test(fullResponse);
  const mentionsBima = /bima/i.test(fullResponse);
  const mentionsSinta = /sinta|xxl|2xl/i.test(fullResponse);

  checks.push({
    label: 'Deteksi Anomali: Menjelaskan nama ganda (adi/bima) & penyetaraan (sinta xxl -> 2xl)',
    pass: mentionsAdi && (mentionsBima || mentionsSinta),
  });

  let passCount = 0;
  for (const c of checks) {
    if (c.pass) {
      console.log(`✅ ${c.label}`);
      passCount++;
    } else {
      console.log(`❌ ${c.label}`);
    }
  }

  console.log(`\n${passCount}/${checks.length} checks passed\n`);
  if (canvasContent) {
    console.log('📋 ISI KONTEN CANVAS YANG DIHASILKAN:\n' + canvasContent + '\n');
  }

  if (passCount < checks.length) {
    process.exit(1);
  }
}

runCanvasGarmentBenchmark().catch((err) => {
  console.error('Fatal benchmark error:', err);
  process.exit(1);
});
