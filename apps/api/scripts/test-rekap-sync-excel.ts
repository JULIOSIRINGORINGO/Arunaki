import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'http://127.0.0.1:3000/api/v1';
let WORKSPACE_ID = process.env.WORKSPACE_ID || '';
let WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || '';
const TXT_FILE = 'REKAPAN TERBARU2.txt';
const EXCEL_FILE = 'testing.xlsx';

const instruction = `Update data rekapan harian 17 Agustus 2026:
Data Transaksi:
- CK AGUSTINO = 1.876RB(BRI) [ 45 PCS ]
- CK ROLLER = 1.182RB(BCA) [ 17 PCS ]
- CK DEDI = 300RB(BCA) [ DTF ]
- CK OWEN = 200RB(BNI) [ 10 PCS ]
- CK BAMBANG = 450RB(BCA) [ 25 PCS ]
- TOKO JAYA = 150RB(CASH) [ DTF ]
- BUK RINA = 75RB(BCA) [ 5 PCS ]
Pengeluaran: LISTRIK = 250RB, BENSIN = 100RB, LAUNDRY = 30RB, SEMBAKO = 175RB, LAINNYA = 15RB (Total: 570RB)

Instruksi:
1. Update laporan teks @${TXT_FILE} dengan data di atas dan hitung totalnya (Total Pemasukan: 4.233 RB, BCA: 2.007 RB, BRI: 1.876 RB, BNI: 200 RB, Cash: 150 RB, Pengeluaran: 570 RB, Selisih: 3.663 RB).
2. Otomatis sinkronkan dan isi juga data & angka total tersebut ke file spreadsheet @${EXCEL_FILE} pada kolom tanggal 17 (Kolom S / Day 17) menggunakan desktop_excel_edit (Judul B1: 'REKAPAN AGUSTUS 2026', S4: 4233, S13: 200, S14: 2007, S16: 150, S19: 570, S24: 250, S38: 3663).`;

async function runMultiDocSyncTest() {
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

  console.log(`🚀 Starting Multi-Doc Sync (TXT + Excel) Benchmark on workspace ${WORKSPACE_ID} (${WORKSPACE_ROOT})...`);

  const txtPath = path.join(WORKSPACE_ROOT, TXT_FILE);
  const excelPath = path.join(WORKSPACE_ROOT, EXCEL_FILE);

  if (!fs.existsSync(txtPath)) {
    throw new Error(`Target text file not found at ${txtPath}`);
  }
  if (!fs.existsSync(excelPath)) {
    throw new Error(`Target excel file not found at ${excelPath}`);
  }

  // Backup files
  fs.copyFileSync(txtPath, txtPath + '.bak');
  fs.copyFileSync(excelPath, excelPath + '.bak');
  console.log(`📋 Backed up ${TXT_FILE} and ${EXCEL_FILE}`);

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
      goal: instruction,
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

  // Read updated text file
  const updatedTxt = fs.readFileSync(txtPath, 'utf8');

  // Read updated Excel file
  const xlsxModule = await import('xlsx');
  const XLSX = (xlsxModule as any).default || xlsxModule;
  const wb = XLSX.readFile(excelPath);
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  const getVal = (cellRef: string) => {
    const c = ws[cellRef.toUpperCase()];
    return c ? c.v : undefined;
  };

  const getStr = (cellRef: string) => {
    const v = getVal(cellRef);
    return v !== undefined ? String(v).trim() : '';
  };

  console.log('\n📊 === HASIL VERIFIKASI SINKRONISASI MULTI-DOKUMEN (TXT + EXCEL) === 📊');
  const checks: { label: string; pass: boolean }[] = [];

  // Check 1: Tool invocation for both TXT and Excel
  const txtToolUsed = toolsInvoked.some((t) => t === 'edit' || t === 'write');
  const excelToolUsed = toolsInvoked.some((t) => t.includes('excel') || t.includes('desktop_excel_edit'));
  checks.push({
    label: 'Tool Orchestration: Mengeksekusi tool untuk TXT dan Excel',
    pass: txtToolUsed && excelToolUsed,
  });

  // TXT Verifications
  checks.push({
    label: 'TXT: Judul / Header 17 Agustus ter-update',
    pass: /17\s*AGUSTUS/i.test(updatedTxt),
  });

  checks.push({
    label: 'TXT: Total Pemasukan 4.233 RB ter-update',
    pass: /4\.?233\s*RB/i.test(updatedTxt),
  });

  checks.push({
    label: 'TXT: Rincian Bank BCA (2.007 RB) & BRI (1.876 RB) akurat',
    pass: /2\.?007\s*RB/i.test(updatedTxt) && /1\.?876\s*RB/i.test(updatedTxt),
  });

  checks.push({
    label: 'TXT: Total Pengeluaran (570 RB) & Selisih (3.663 RB) sinkron',
    pass: /570\s*RB/i.test(updatedTxt) && /3\.?663\s*RB/i.test(updatedTxt),
  });

  // Excel Verifications
  const b1 = getStr('B1');
  checks.push({
    label: `Excel: Header sel B1 = "${b1}" (mengandung AGUSTUS 2026)`,
    pass: /AGUSTUS\s*2026/i.test(b1),
  });

  const s4 = Number(getVal('S4') ?? getVal('R4') ?? 0);
  checks.push({
    label: `Excel: Total Pemasukan (sel S4) = ${s4} (expected: 4233)`,
    pass: s4 === 4233 || s4 === 4.233,
  });

  const s14 = Number(getVal('S14') ?? getVal('R14') ?? 0);
  checks.push({
    label: `Excel: Total TF BCA (sel S14) = ${s14} (expected: 2007)`,
    pass: s14 === 2007 || s14 === 2.007,
  });

  const s13 = Number(getVal('S13') ?? getVal('R13') ?? 0);
  checks.push({
    label: `Excel: Total TF BNI (sel S13) = ${s13} (expected: 200)`,
    pass: s13 === 200,
  });

  const s16 = Number(getVal('S16') ?? getVal('R16') ?? 0);
  checks.push({
    label: `Excel: Total CASH (sel S16) = ${s16} (expected: 150)`,
    pass: s16 === 150,
  });

  const s19 = Number(getVal('S19') ?? getVal('R19') ?? 0);
  checks.push({
    label: `Excel: Total Pengeluaran (sel S19) = ${s19} (expected: 570)`,
    pass: s19 === 570,
  });

  const s38 = Number(getVal('S38') ?? getVal('R38') ?? 0);
  checks.push({
    label: `Excel: Selisih Omset (sel S38) = ${s38} (expected: 3663)`,
    pass: s38 === 3663 || s38 === 3.663,
  });

  checks.push({
    label: 'Integritas File: File .txt dan .xlsx tidak korup',
    pass: updatedTxt.length > 200 && wb.SheetNames.length > 0,
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

runMultiDocSyncTest().catch((err) => {
  console.error('Fatal benchmark error:', err);
  process.exit(1);
});
