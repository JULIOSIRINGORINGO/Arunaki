import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'http://127.0.0.1:3000/api/v1';
let WORKSPACE_ID = process.env.WORKSPACE_ID || '';
const TARGET_FILE = 'testing.xlsx';
let WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || '';

// Benchmark instruction for Excel spreadsheet rekap
const instruction = `Update laporan di spreadsheet @${TARGET_FILE} untuk data hari ini (17 Agustus 2026):
1. Ubah judul di header sel B1 menjadi 'REKAPAN AGUSTUS 2026'
2. Masukkan data rekap pada kolom tanggal 17 (Kolom S / Tanggal 17):
   - Total Pemasukan (sel S4) = 1175
   - Rincian Pemasukan 1 (sel S5) = "CK DEDI = 300RB(BCA) [ DTF ]"
   - Rincian Pemasukan 2 (sel S6) = "CK OWEN = 200RB(BNI) [ 10 PCS ]"
   - Rincian Pemasukan 3 (sel S7) = "CK BAMBANG = 450RB(BCA) [ 25 PCS ]"
   - Rincian Pemasukan 4 (sel S8) = "TOKO JAYA = 150RB(CASH) [ DTF ]"
   - Rincian Pemasukan 5 (sel S9) = "BUK RINA = 75RB(BCA) [ 5 PCS ]"
   - TOTAL TF BCA (sel S14) = 825
   - TOTAL TF BNI (sel S13) = 200
   - TOTAL TF CASH (sel S16) = 150
   - TOTAL PENGELUARAN (sel S19) = 570
   - LISTRIK (sel S24) = 250
   - SELISIH OMSET (sel S38) = 605
(Pastikan data kolom tanggal lainnya dan struktur sheet tetap utuh)`;

async function runTest() {
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

  console.log(`🚀 Starting Excel rekap benchmark on workspace ${WORKSPACE_ID} (${WORKSPACE_ROOT})...`);

  const filePath = path.join(WORKSPACE_ROOT, TARGET_FILE);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Target excel file not found at ${filePath}`);
  }

  // Backup original file for safe verification
  const backupPath = filePath + '.bak';
  fs.copyFileSync(filePath, backupPath);
  console.log(`📋 Backed up ${TARGET_FILE} (${fs.statSync(filePath).size} bytes)`);

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
          console.log(`[+${elapsed}s][event:tool_done]`, JSON.stringify(event.data));
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

  // Read updated Excel file with XLSX library
  const xlsxModule = await import('xlsx');
  const XLSX = (xlsxModule as any).default || xlsxModule;
  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  // Helper to read cell value
  const getVal = (cellRef: string) => {
    const c = ws[cellRef.toUpperCase()];
    return c ? c.v : undefined;
  };

  const getStr = (cellRef: string) => {
    const v = getVal(cellRef);
    return v !== undefined ? String(v).trim() : '';
  };

  console.log('\n📊 === HASIL VERIFIKASI PENGUJIAN EXCEL OTONOM === 📊');
  const checks: { label: string; pass: boolean }[] = [];

  // Check 1: Tool desktop_excel_edit or edit invoked
  checks.push({
    label: 'Tool: Menggunakan desktop_excel_edit / edit tool',
    pass: toolsInvoked.some((t) => t.includes('desktop_excel_edit') || t.includes('edit')),
  });

  // Check 2: Header cell B1 or title updated
  const b1 = getStr('B1');
  checks.push({
    label: `Header judul di sel B1 = "${b1}" (mengandung AGUSTUS 2026)`,
    pass: /AGUSTUS\s*2026/i.test(b1),
  });

  // Check 3: Pemasukan sel S4 (or R4)
  const s4 = Number(getVal('S4') ?? getVal('R4') ?? 0);
  checks.push({
    label: `Total Pemasukan tanggal 17 (sel S4/R4) = ${s4} (expected: 1175)`,
    pass: s4 === 1175,
  });

  // Check 4: Total TF BCA (S14/R14) = 825
  const s14 = Number(getVal('S14') ?? getVal('R14') ?? 0);
  checks.push({
    label: `Total TF BCA (sel S14/R14) = ${s14} (expected: 825)`,
    pass: s14 === 825,
  });

  // Check 5: Total TF BNI (S13/R13) = 200
  const s13 = Number(getVal('S13') ?? getVal('R13') ?? 0);
  checks.push({
    label: `Total TF BNI (sel S13/R13) = ${s13} (expected: 200)`,
    pass: s13 === 200,
  });

  // Check 6: Total TF CASH (S16/R16) = 150
  const s16 = Number(getVal('S16') ?? getVal('R16') ?? 0);
  checks.push({
    label: `Total TF CASH (sel S16/R16) = ${s16} (expected: 150)`,
    pass: s16 === 150,
  });

  // Check 7: Total Pengeluaran (S19/R19) = 570
  const s19 = Number(getVal('S19') ?? getVal('R19') ?? 0);
  checks.push({
    label: `Total Pengeluaran (sel S19/R19) = ${s19} (expected: 570)`,
    pass: s19 === 570,
  });

  // Check 8: Pengeluaran Listrik (S24/R24) = 250
  const s24 = Number(getVal('S24') ?? getVal('R24') ?? 0);
  checks.push({
    label: `Pengeluaran LISTRIK (sel S24/R24) = ${s24} (expected: 250)`,
    pass: s24 === 250,
  });

  // Check 9: Selisih Omset (S38/R38) = 605
  const s38 = Number(getVal('S38') ?? getVal('R38') ?? 0);
  checks.push({
    label: `Selisih Omset (sel S38/R38) = ${s38} (expected: 605)`,
    pass: s38 === 605,
  });

  // Check 10: Rincian transaksi CK Dedi ada di cell S5..S9
  const rincianStr = [getStr('S5'), getStr('S6'), getStr('S7'), getStr('S8'), getStr('S9'), getStr('R5'), getStr('R6'), getStr('R7')].join(' ');
  checks.push({
    label: 'Rincian transaksi CK DEDI / CK OWEN / CK BAMBANG tersimpan di sel',
    pass: /CK DEDI/i.test(rincianStr) && /CK BAMBANG/i.test(rincianStr),
  });

  // Check 11: Format file valid & tidak korup
  checks.push({
    label: 'Integritas Workbook: File .xlsx valid dan tidak korup',
    pass: wb.SheetNames.length > 0 && fs.statSync(filePath).size > 1000,
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

runTest().catch((err) => {
  console.error('Fatal benchmark error:', err);
  process.exit(1);
});
