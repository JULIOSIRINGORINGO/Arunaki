import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { ProgrammaticVerifierService } from '../tools/services/programmatic-verifier.service.js';

describe('Skenario Real: Daily Report Agent Task', () => {
  let tempWorkspaceDir: string;
  let verifierService: ProgrammaticVerifierService;

  const templateContent = `REKAPAN PENJUALAN [TANGGAL]

PEMASUKAN :

[DATA PENJUALAN]

NOTE BELUM BAYAR :

TOTAL = 0

PENGELUARAN :

TOTAL PEMASUKAN: 0
TOTAL TF BRI: 0
TOTAL TF BNI: 0
TOTAL TF BCA: 0
TOTAL CASH: 0
TOTAL PENGELUARAN: 0

SELISIH: 0`;

  beforeEach(async () => {
    verifierService = new ProgrammaticVerifierService();
    tempWorkspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'arunaki-report-test-'));

    // Buat file template REKAPAN TERBARU1.txt di workspace
    await fs.writeFile(
      path.join(tempWorkspaceDir, 'REKAPAN TERBARU1.txt'),
      templateContent,
      'utf-8',
    );
  });

  afterEach(async () => {
    await fs.rm(tempWorkspaceDir, { recursive: true, force: true });
  });

  it('harus dapat membaca template, menghitung total transfer bank, dan menghasilkan laporan terverifikasi', async () => {
    // 1. User input data
    const inputPrompt = `Buat laporan hari ini tanggal 31 Juli 2026

CK FAUZAN = 1.315RB(BCA) [ 37PCS ]✅
CK FADLAN = 974RB(BNI) [ 14 PCS ]✅
PAK ARNOL = 1.500RB(BRI) [ 20PCS + DTF ]✅`;

    // 2. Pembacaan Template (Simulasi DocumentReaderTool)
    const templatePath = path.join(tempWorkspaceDir, 'REKAPAN TERBARU1.txt');
    const templateText = await fs.readFile(templatePath, 'utf-8');
    expect(templateText).toContain('REKAPAN PENJUALAN');

    // 3. Kalkulasi & Parsing Data (Simulasi AI Reasoning & Calculator)
    const bca = 1315000;
    const bni = 974000;
    const bri = 1500000;
    const totalPemasukan = bca + bni + bri; // 3.789.000

    const generatedReportText = `REKAPAN PENJUALAN 31 Juli 2026

PEMASUKAN :
CK FAUZAN = 1.315.000 (BCA) [ 37 PCS ]
CK FADLAN = 974.000 (BNI) [ 14 PCS ]
PAK ARNOL = 1.500.000 (BRI) [ 20 PCS + DTF ]

PENGELUARAN :
-

TOTAL PEMASUKAN: Rp 3.789.000
TOTAL TF BRI: Rp 1.500.000
TOTAL TF BNI: Rp 974.000
TOTAL TF BCA: Rp 1.315.000
TOTAL CASH: Rp 0
TOTAL PENGELUARAN: Rp 0

SELISIH: Rp 0`;

    // 4. Penulisan Laporan Baru ke Workspace (Simulasi write_workspace_file)
    const reportPath = path.join(tempWorkspaceDir, 'REKAPAN_2026_07_31.txt');
    await fs.writeFile(reportPath, generatedReportText, 'utf-8');

    // 5. Instan Programmatic Verification (0-Token)
    const verification = await verifierService.verifyFile(reportPath, {
      mustExist: true,
      minSizeBytes: 50,
      mustContainRegex: /TOTAL PEMASUKAN: Rp 3\.789\.000/,
    });

    expect(verification.verified).toBe(true);
    expect(verification.checksPassed).toContain('FILE_EXISTS');
    expect(verification.checksPassed).toContain('REGEX_MATCH');
  });
});
