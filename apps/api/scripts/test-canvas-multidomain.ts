const API_BASE = 'http://127.0.0.1:3000/api/v1';
let WORKSPACE_ID = process.env.WORKSPACE_ID || '';

interface TestCase {
  name: string;
  prompt: string;
  expectCanvas: boolean;
}

const testCases: TestCase[] = [
  {
    name: '1. Quotation Document Draft',
    prompt: 'Tolong buatkan draf penawaran harga (quotation) formal di chat/canvas untuk pengadaan 10 unit laptop kantor ke PT Surya Abadi dengan total budget 85 juta',
    expectCanvas: true,
  },
  {
    name: '2. Event Rundown Schedule Table',
    prompt: 'Bikin rundown acara workshop digital marketing dari jam 8 pagi sampai 3 sore lengkap dengan coffee break dan sesi tanya jawab',
    expectCanvas: true,
  },
  {
    name: '3. Conversational Concept Q&A',
    prompt: 'Apa perbedaan bahan kain katun combed 24s dan 30s untuk kaos distro dan mana yang lebih adem?',
    expectCanvas: false,
  },
];

async function runMultiDomainCanvasBenchmark() {
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

  console.log(`🚀 Starting Multi-Domain Smart Canvas Selection Benchmark on workspace ${WORKSPACE_ID}...\n`);

  const targetModel = process.argv[2] || process.env.TEST_MODEL || undefined;
  if (targetModel) {
    console.log(`🎯 Requesting explicit model: ${targetModel}\n`);
  }

  let passedTests = 0;

  for (const tc of testCases) {
    console.log(`----------------------------------------------------------------`);
    console.log(`🧪 Testing: ${tc.name}`);
    console.log(`💬 Prompt: "${tc.prompt}"`);

    const startTime = Date.now();
    const res = await fetch(`${API_BASE}/workspaces/${WORKSPACE_ID}/agent/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        goal: tc.prompt,
        model: targetModel,
      }),
    });

    if (!res.ok) {
      console.error(`❌ Request failed: HTTP ${res.status}`);
      continue;
    }

    const reader = res.body?.getReader();
    if (!reader) continue;

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

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const hasCanvas = /\[CANVAS\]\s*([\s\S]*?)\s*\[\/CANVAS\]/i.test(fullResponse);

    if (tc.expectCanvas) {
      if (hasCanvas) {
        console.log(`✅ Passed: Canvas terpicu secara cerdas (${duration}s)`);
        passedTests++;
      } else {
        console.log(`❌ Failed: Seharusnya memicu Canvas tapi tidak (${duration}s)`);
      }
    } else {
      if (!hasCanvas) {
        console.log(`✅ Passed: Chat percakapan normal (tanpa Canvas) sesuai konteks (${duration}s)`);
        passedTests++;
      } else {
        console.log(`❌ Failed: Seharusnya chat biasa tapi malah memicu Canvas (${duration}s)`);
      }
    }
  }

  console.log(`\n================================================================`);
  console.log(`📊 Hasil Akhir: ${passedTests}/${testCases.length} skenario berhasil!`);
  console.log(`================================================================\n`);

  if (passedTests < testCases.length) {
    process.exit(1);
  }
}

runMultiDomainCanvasBenchmark().catch((err) => {
  console.error('Fatal multi-domain benchmark error:', err);
  process.exit(1);
});
