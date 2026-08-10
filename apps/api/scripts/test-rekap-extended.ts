import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'http://localhost:3000/api/v1';
const WORKSPACE_ID = 'cmshh81u8000bvg78c4ay5hgk';
const TARGET_FILE = 'REKAPAN TERBARU2.txt';
const WORKSPACE_ROOT = 'E:\\JS\\laporan-test';

const instruction = `Update laporan hari ini di file @${TARGET_FILE} dengan data berikut, dan HITUNG ULANG SEMUA TOTAL dengan benar:

PEMASUKAN baru:
CK DEDI = 300RB(BCA) [ DTF ]✅
CK OWEN = 200RB(BNI) [10 PCS ]✅
CK BAMBANG = 450RB(BCA) [25 PCS ]✅
TOKO JAYA = 150RB(CASH) [ DTF ]✅
BUK RINA = 75RB(BCA) [5 PCS ]✅

NOTE BELUM BAYAR (tambahkan 3 entri baru, jangan hapus yang lama):
CI LISOI (2-2-2024)= 830RB✅
CI LISOI (8-02-2024)= 1.860RB✅
CI LISOI (9-02-2024)= 450RB✅
CI LISOI (10-02-2024) = 140RB
SOLAR (26-2-2025) = 970RB✅
KAK EVA (31-7-2025)  = 410RB✅
KAK EVA(20-9-2025) = 360RB✅
KAK EVA(12-12-2025) = 236RB✅
KAK IIN(15-12-2025) = 40RB✅
KAK KIKI(22-1-2026) = 587RB✅
KAK KIKI (9-2-2026) = 1.088RB✅
CK SJE (27-2-2026) = 1.325RB✅
BG FRAN (26-3-2026) = 390RB✅
KAK KIKI (6-4-2026) = 2.552RB✅
KAK KIKI(9-4-2026) = 691RB✅
KAK RIRIN(15-4-2026) = 3.240RB✅
KAK KIKI(24-4-2026) = 1.035RB✅
KAK RIRIN(25-4-2026) = 1.057RB✅
KAK KIKI(13-5-2026) = 132RB✅
KAK RIRIN(21-5-2026) = 1.635RB✅
KAK RIRIN(30-5-2026) = 3.730RB✅
KAK KIKI(20-6-2026) = 1.942RB✅
KAK RIRIN(27-6-2026) = 114RB✅
BG ARIL(2-7-2026) = 630RB✅
KAK EVA (4-7-2026) =208RB✅
CK CAPPELA(6-7-2026) = 1.684RB✅
CK TUKANG METER PLN(18-7-2026) = 50RB✅
BU DITA(19-7-2026) = 1.240RB✅
CK HENDRA(21-7-2026) = 860RB✅
KAK TITIN(25-7-2026) = 3.450RB✅
BG JONO(28-7-2026) = 720RB✅

PENGELUARAN baru:
GALON 7
PARKIR 3
PRINT 5
LAUNDRY 30
LISTRIK 250
TOKO SEMBAKO 175
BENSIN 100

HITUNG ULANG dengan benar:
1. TOTAL NOTE BELUM BAYAR = jumlah semua angka NOTE BELUM BAYAR (yang sudah bayar, semua pakai tanda ✅). Tulis hasilnya di baris "TOTAL = ...RB" di bagian NOTE BELUM BAYAR.
2. TOTAL PEMASUKAN BCA = 300 + 450 + 75
3. TOTAL PEMASUKAN BNI = 200
4. TOTAL CASH = 150
5. TOTAL PENGELUARAN = 7 + 3 + 5 + 30 + 250 + 175 + 100
6. TOTAL UANG DI LACI = TOTAL PEMASUKAN - TOTAL PENGELUARAN

Jangan hapus struktur laporan. Tulis TOTAL PEMASUKAN, TOTAL TF BCA, TOTAL TF BNI, TOTAL CASH, TOTAL PENGELUARAN, dan TOTAL UANG DI LACI yang benar di bagian bawah.`;

async function runTest() {
  console.log('🚀 Starting extended re-total test...');
  console.log('Instruksi:', instruction);

  try {
    const response = await fetch(`${API_BASE}/workspaces/${WORKSPACE_ID}/agent/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.ARUNAKI_API_KEY || '199710338e26f2127f7012001e927b4b'
      },
      body: JSON.stringify({ goal: instruction, historyMessages: [] }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('❌ HTTP error:', response.status, text);
      process.exit(1);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      console.error('❌ No response body');
      process.exit(1);
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let error: string | null = null;
    let sawDone = false;

    const streamDeadline = Date.now() + 300000;
    while (Date.now() < streamDeadline) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'tool_call') console.log(`[tool_call] ${event.data?.name} ${JSON.stringify(event.data?.args)?.slice(0, 120)}`);
            if (event.type === 'llm' || event.type === 'message') console.log(`[llm]`, String(event.data).slice(0, 150));
            if (event.type === 'error') error = event.data?.message || 'unknown';
            if (event.type === 'done') sawDone = true;
          } catch (e) {
            // ignore parse errors
          }
        }
      }

      if (sawDone) {
        await new Promise(r => setTimeout(r, 2000));
        break;
      }
    }

    if (error) {
      console.error('❌ Agent error:', error);
      process.exit(1);
    }

    if (!sawDone) {
      console.error('❌ Stream tidak menghasilkan event done dalam 300s');
      process.exit(1);
    }

  } catch (e: any) {
    console.error('❌ Request failed:', e.message);
    process.exit(1);
  }

  // Small delay for file write
  await new Promise(r => setTimeout(r, 1000));

  // Load result file
  const resultPath = path.join(WORKSPACE_ROOT, TARGET_FILE);
  if (!fs.existsSync(resultPath)) {
    console.log('❌ File not found after agent run');
    process.exit(1);
  }

  const content = fs.readFileSync(resultPath, 'utf-8');
  console.log('📄 File preview (first 900 chars):');
  console.log(content.slice(0, 900));

  // Validation checks
  const now = new Date();
  const day = now.getDate();
  const monthLong = now.toLocaleDateString('id-ID', { month: 'long' }).toUpperCase();
  const year = now.getFullYear();
  const todayText = `${day} ${monthLong} ${year}`;

  // NOTE BELUM BAYAR total: 830+1860+450+140+970+410+360+236+40+587+1088+1325+390+2552+691+3240+1035+1057+132+1635+3730+1942+114+630+208+1684+50+1240+860+3450+720
  const noteBelumBayar = 830+1860+450+140+970+410+360+236+40+587+1088+1325+390+2552+691+3240+1035+1057+132+1635+3730+1942+114+630+208+1684+50+1240+860+3450+720;

  const checks = [
    { name: 'Tanggal diperbarui ke hari ini', pass: content.toUpperCase().includes(todayText) },
    { name: 'CK DEDI ada (300)', pass: content.includes('CK DEDI') && content.includes('300RB') },
    { name: 'CK OWEN ada (200)', pass: content.includes('CK OWEN') && content.includes('200RB') },
    { name: 'CK BAMBANG ada (450)', pass: content.includes('CK BAMBANG') && content.includes('450RB') },
    { name: 'TOKO JAYA ada (150)', pass: content.includes('TOKO JAYA') && content.includes('150RB') },
    { name: 'BUK RINA ada (75)', pass: content.includes('BUK RINA') && content.includes('75RB') },
    { name: 'Entri NOTE BELUM BAYAR baru ada', pass: content.includes('BU DITA') && content.includes('CK HENDRA') && content.includes('KAK TITIN') && content.includes('BG JONO') },
    { name: 'Total BCA = 825 RB (300+450+75)', pass: /TOTAL TF BCA\s*[:=]\s*825\s*RB/i.test(content) },
    { name: 'Total BNI = 200 RB', pass: /TOTAL TF BNI\s*[:=]\s*200\s*RB/i.test(content) },
    { name: 'Total CASH = 150 RB', pass: /TOTAL CASH\s*[:=]\s*150\s*RB/i.test(content) },
    { name: 'Total Pengeluaran = 570 RB (7+3+5+30+250+175+100)', pass: /TOTAL PENGELUARAN\s*[:=]\s*570\s*RB/i.test(content) },
    { name: 'Total Uang di Laci = 605 RB (825+200+150-570)', pass: /TOTAL UANG DI LACI\s*[:=]\s*605\s*RB/i.test(content) },
    { name: 'Total NOTE BELUM BAYAR benar', pass: content.includes(`${noteBelumBayar}RB`) || content.includes(`${noteBelumBayar} RB`) || content.includes(`${noteBelumBayar.toLocaleString('id-ID')}RB`) },
    { name: 'Pengeluaran LISTRIK ada', pass: content.includes('LISTRIK 250') },
    { name: 'Bagian BELANJAAN KE LABURA ada', pass: content.includes('BELANJAAN KE LABURA:') },
    { name: 'TOTAL BELANJA KE BENDONG ada', pass: content.includes('TOTAL BELANJA KE BENDONG RP 742.000,-') },
    { name: 'SISA DEPOSIT ada', pass: content.includes('SISA DEPOSIT RP 3.405.640,-') },
  ];

  let passed = 0;
  checks.forEach(c => {
    console.log(`${c.pass ? '✅' : '❌'} ${c.name}`);
    if (c.pass) passed++;
  });

  console.log(`\n${passed}/${checks.length} checks passed`);
  process.exit(passed === checks.length ? 0 : 1);
}

runTest();
