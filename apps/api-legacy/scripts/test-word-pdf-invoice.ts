import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'http://127.0.0.1:3000/api/v1';
let WORKSPACE_ID = process.env.WORKSPACE_ID || '';
let WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || '';

const invoiceInstruction = `Buat dokumen invoice formal untuk klien PT MAJU JAYA BERSAMA:
- Nomor Invoice: INV-2026-0817
- Tanggal: 17 Agustus 2026
- Rincian Item:
  1. Jasa Sablon Kaos Katun Combed 30s (50 PCS @ Rp 45.000) = Rp 2.250.000
  2. Cetak DTF Premium High Resolution (10 Lembar @ Rp 35.000) = Rp 350.000
  3. Biaya Finishing & Packaging = Rp 150.000
- Total Tagihan: Rp 2.750.000
- Rekening Pembayaran: BCA 123-456-7890 a.n PT ARUNAKI TEKNOLOGI

Tolong:
1. Buat file Word (.docx) dengan nama 'INVOICE-MAJU-JAYA.docx' menggunakan generate_export format 'docx'
2. Buat file PDF (.pdf) dengan nama 'INVOICE-MAJU-JAYA.pdf' menggunakan generate_export format 'pdf'`;

async function runWordPdfBenchmark() {
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

  console.log(`🚀 Starting Word (.docx) & PDF (.pdf) Invoice Generation Benchmark on workspace ${WORKSPACE_ID} (${WORKSPACE_ROOT})...`);

  const docxFile = path.join(WORKSPACE_ROOT, 'INVOICE-MAJU-JAYA.docx');
  const pdfFile = path.join(WORKSPACE_ROOT, 'INVOICE-MAJU-JAYA.pdf');

  // Clean old outputs if any
  if (fs.existsSync(docxFile)) fs.unlinkSync(docxFile);
  if (fs.existsSync(pdfFile)) fs.unlinkSync(pdfFile);

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
      goal: invoiceInstruction,
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
  console.log(`\n⏱️ Agent stream completed in ${totalSec}s (done=${finalDone})`);

  console.log('\n📊 === HASIL VERIFIKASI PEMBUATAN DOKUMEN WORD & PDF === 📊');
  const checks: { label: string; pass: boolean }[] = [];

  // Check 1: Tool invocation
  const generateExportUsed = toolsInvoked.some((t) => t.includes('generate_export') || t.includes('export'));
  checks.push({
    label: 'Tool: Menggunakan generate_export tool',
    pass: generateExportUsed,
  });

  // Check 2: Word (.docx) file exists on disk
  const docxExists = fs.existsSync(docxFile);
  const docxSize = docxExists ? fs.statSync(docxFile).size : 0;
  checks.push({
    label: `Word: File INVOICE-MAJU-JAYA.docx terbentuk di disk (${docxSize} bytes)`,
    pass: docxExists && docxSize > 1000,
  });

  // Check 3: PDF (.pdf) file exists on disk
  const pdfExists = fs.existsSync(pdfFile);
  const pdfSize = pdfExists ? fs.statSync(pdfFile).size : 0;
  checks.push({
    label: `PDF: File INVOICE-MAJU-JAYA.pdf terbentuk di disk (${pdfSize} bytes)`,
    pass: pdfExists && pdfSize > 1000,
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

runWordPdfBenchmark().catch((err) => {
  console.error('Fatal benchmark error:', err);
  process.exit(1);
});
