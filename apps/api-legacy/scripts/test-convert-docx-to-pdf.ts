import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'http://127.0.0.1:3000/api/v1';
let WORKSPACE_ID = process.env.WORKSPACE_ID || '';
let WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || '';

async function runConvertDocxBenchmark() {
  const apiKey = process.env.ARUNAKI_API_KEY || 'arunaki-dev-key';

  if (!WORKSPACE_ID || !WORKSPACE_ROOT) {
    const listRes = await fetch(`${API_BASE}/workspaces`, {
      headers: { 'x-api-key': apiKey },
    });
    const listData = (await listRes.json()) as any;
    const workspaces = Array.isArray(listData) ? listData : listData.data || [];
    if (workspaces.length === 0) {
      throw new Error('No active workspace found');
    }
    WORKSPACE_ID = workspaces[0].id;
    WORKSPACE_ROOT = workspaces[0].rootPath;
  }

  console.log(`🚀 Starting Word to PDF Converter Benchmark on workspace ${WORKSPACE_ID} (${WORKSPACE_ROOT})...`);

  const sourceDocx = path.join(WORKSPACE_ROOT, 'INVOICE-MAJU-JAYA.docx');
  const targetPdf = path.join(WORKSPACE_ROOT, 'INVOICE-MAJU-JAYA-CONVERTED.pdf');

  if (!fs.existsSync(sourceDocx)) {
    throw new Error(`Source DOCX file not found at ${sourceDocx}. Please run test-word-pdf-invoice.ts first.`);
  }

  if (fs.existsSync(targetPdf)) fs.unlinkSync(targetPdf);

  const targetModel = process.argv[2] || process.env.TEST_MODEL || undefined;
  if (targetModel) {
    console.log(`🎯 Requesting explicit model: ${targetModel}`);
  }

  const prompt = `Tolong convert file @INVOICE-MAJU-JAYA.docx menjadi PDF seperti fitur iLovePDF dengan nama file 'INVOICE-MAJU-JAYA-CONVERTED.pdf'`;

  const startTime = Date.now();
  const res = await fetch(`${API_BASE}/workspaces/${WORKSPACE_ID}/agent/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      goal: prompt,
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
  let finalDone = false;
  const toolsInvoked: string[] = [];

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

        if (event.type === 'tool_start') {
          console.log(`[+${elapsed}s][event:tool_start]`, JSON.stringify(event.data));
          if (event.data?.toolName) toolsInvoked.push(event.data.toolName);
        } else if (event.type === 'tool_done') {
          console.log(`[+${elapsed}s][event:tool_done]`, JSON.stringify(event.data).slice(0, 150));
        } else if (event.type === 'thinking') {
          process.stdout.write(`\r[+${elapsed}s][thinking] ${String(event.data || '').slice(0, 80)}`);
        } else if (event.type === 'text_delta') {
          process.stdout.write(event.data || '');
        } else if (event.type === 'done') {
          console.log(`\n[+${elapsed}s][event:done]`, JSON.stringify(event.data).slice(0, 150));
          finalDone = true;
        } else if (event.type === 'error') {
          console.error(`\n❌ Agent error: ${JSON.stringify(event.data)}`);
        }
      } catch {
        // partial json
      }
    }
  }

  const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n⏱️ Converter agent completed in ${totalSec}s (done=${finalDone})`);

  console.log('\n📊 === HASIL VERIFIKASI KONVERSI WORD TO PDF (ILOVEPDF STYLE) === 📊');
  const checks: { label: string; pass: boolean }[] = [];

  const convertToolUsed = toolsInvoked.some(
    (t) => t.includes('convert_document') || t.includes('generate_export') || t.includes('export'),
  );
  checks.push({
    label: 'Tool: Otonom memanggil tool convert_document / export',
    pass: convertToolUsed,
  });

  const pdfExists = fs.existsSync(targetPdf);
  const pdfSize = pdfExists ? fs.statSync(targetPdf).size : 0;
  checks.push({
    label: `PDF Converted: File INVOICE-MAJU-JAYA-CONVERTED.pdf terbentuk di disk (${pdfSize} bytes)`,
    pass: pdfExists && pdfSize > 500,
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
  if (passCount < checks.length) {
    process.exit(1);
  }
}

runConvertDocxBenchmark().catch((err) => {
  console.error('Fatal converter error:', err);
  process.exit(1);
});
