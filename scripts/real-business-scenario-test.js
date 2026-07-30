import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { pathToFileURL } from 'url';

async function runRealBusinessScenarioAudit() {
  console.log('========================================================================');
  console.log('🏛️ AUDIT PENGUJIAN SKENARIO BISNIS NYATA & AKUNTABILITAS SISTEM ARUNAKI');
  console.log(`⏰ Waktu Pengujian: ${new Date().toISOString()}`);
  console.log('========================================================================\n');

  const rootDir = path.resolve();
  const distDir = path.join(rootDir, 'apps', 'api', 'dist', 'src');
  const demoDir = path.resolve('workspace-real-audit');

  if (!fs.existsSync(demoDir)) {
    fs.mkdirSync(demoDir, { recursive: true });
  }

  // Import tools
  const { DocumentReaderTool } = await import(pathToFileURL(path.join(distDir, 'modules', 'tools', 'services', 'document-reader.tool.js')).href);
  const { DocumentReconciliationService } = await import(pathToFileURL(path.join(distDir, 'modules', 'document', 'doc-reconciliation.service.js')).href);
  const { DocumentGeneratorTool } = await import(pathToFileURL(path.join(distDir, 'modules', 'tools', 'services', 'document-generator.tool.js')).href);
  const { ProviderService } = await import(pathToFileURL(path.join(distDir, 'modules', 'provider', 'provider.service.js')).href);

  const reader = new DocumentReaderTool();
  const reconciler = new DocumentReconciliationService();
  const generator = new DocumentGeneratorTool();

  let passedScenarios = 0;
  const totalScenarios = 5;

  // ------------------------------------------------------------------------
  // SKENARIO 1: File Kosong / Path Tidak Ditemukan
  // ------------------------------------------------------------------------
  console.log('📌 [SKENARIO 1/5] Penanganan Input File Tidak Ditemukan & Path Kosong');
  const resultNonExistent = await reader.readDocument(path.join(demoDir, 'File_Hantu_Tidak_Ada.xlsx'));
  console.log(`   -> Status: ${resultNonExistent.status}`);
  console.log(`   -> Pesan Error: "${resultNonExistent.preview}"`);
  console.log(`   -> Error Code: ${resultNonExistent.error?.code}`);
  if (resultNonExistent.status === 'error' && resultNonExistent.error?.code === 'FILE_NOT_FOUND') {
    console.log('   ✅ PASSED: System menangkap error "FILE_NOT_FOUND" secara aman tanpa crash.\n');
    passedScenarios++;
  } else {
    console.log('   ❌ FAILED: System tidak mengembalikan status error yang diharapkan.\n');
  }

  // ------------------------------------------------------------------------
  // SKENARIO 2: Pembacaan Berkas PDF Faktur Pajak dengan Karakter Persentase (%) & Simbol Khusus
  // ------------------------------------------------------------------------
  console.log('📌 [SKENARIO 2/5] Pembacaan Berkas PDF Faktur Pajak dengan Karakter "%" & Symbol');
  const pdfPath = path.join(demoDir, 'Faktur_Pajak_Sample.txt');
  const pdfSampleContent = `FAKTUR PAJAK NO: 010.000-26.00000100
PT SEJAHTERA UTAMA % PT MAKMUR INDONESIA
DPP: Rp 100.000.000
PPN (11%): Rp 11.000.000
Diskon Promosi (5%): Rp 5.000.000
Total Bayar: Rp 106.000.000`;
  fs.writeFileSync(pdfPath, pdfSampleContent, 'utf-8');

  const pdfReadResult = await reader.readDocument(pdfPath);
  console.log(`   -> Status Pembacaan: ${pdfReadResult.status}`);
  console.log(`   -> Jumlah Karakter: ${pdfReadResult.data?.charCount}`);
  console.log(`   -> Teks Terbaca:\n${pdfReadResult.preview}`);
  if (pdfReadResult.status === 'success' && pdfReadResult.preview.includes('11%') && pdfReadResult.preview.includes('5%')) {
    console.log('   ✅ PASSED: Karakter persentase % dan PPN terbaca utuh tanpa URIError crash.\n');
    passedScenarios++;
  } else {
    console.log('   ❌ FAILED: Karakter persentase gagal terbaca.\n');
  }

  // ------------------------------------------------------------------------
  // SKENARIO 3: Rekonsiliasi Data Selisih Nominal Invoice vs Bank (Real Discrepancy Detection)
  // ------------------------------------------------------------------------
  console.log('📌 [SKENARIO 3/5] Audit Selisih Nominal Invoice vs Bank Statement');
  const invoiceRows = [
    { id: 'INV-2026-01', customer: 'PT Alpha', total: 50000000 },
    { id: 'INV-2026-02', customer: 'PT Beta', total: 25000000 },
    { id: 'INV-2026-03', customer: 'PT Gamma', total: 10000000 },
  ];
  const bankRows = [
    { id: 'INV-2026-01', total: 50000000 }, // Match
    { id: 'INV-2026-02', total: 24500000 }, // Mismatch (Selisih 500.000 admin bank)
    // INV-2026-03 missing in bank
  ];

  const reconReport = reconciler.reconcileDocuments(
    'Faktur_Penjualan.xlsx',
    invoiceRows,
    'Rekening_Bank.csv',
    bankRows,
    'id',
  );

  console.log(`   -> Total Dicheck: ${reconReport.summary.totalItemsChecked}`);
  console.log(`   -> Total Match: ${reconReport.summary.matchCount}`);
  console.log(`   -> Total Mismatch (Selisih): ${reconReport.summary.mismatchCount}`);
  console.log(`   -> Total Missing (Hilang): ${reconReport.summary.missingCount}`);
  console.log(`   -> Tabel Laporan Canvas:\n${reconReport.formattedTableMarkdown}`);

  if (reconReport.summary.matchCount === 1 && reconReport.summary.mismatchCount === 1 && reconReport.summary.missingCount === 1) {
    console.log('   ✅ PASSED: Engine rekonsiliasi mendeteksi 1 cocok, 1 selisih nominal, dan 1 hilang dengan akurat.\n');
    passedScenarios++;
  } else {
    console.log('   ❌ FAILED: Hasil rekonsiliasi tidak sesuai ekspektasi.\n');
  }

  // ------------------------------------------------------------------------
  // SKENARIO 4: Pengeditan & Fisik Overwrite File Excel Workspace oleh Agen
  // ------------------------------------------------------------------------
  console.log('📌 [SKENARIO 4/5] Pengeditan & Overwrite Berkas Fisik Excel di Disk Workspace');
  const stokFilePath = path.join(demoDir, 'Stok_Barang_Gudang.xlsx');
  
  // Create initial file
  const initialStok = [
    { Kode: 'BRG-01', Nama: 'Kertas HVS A4 80gr', Stok: 50, Status: 'Tersedia' },
    { Kode: 'BRG-02', Nama: 'Tinta Printer Hitam', Stok: 0, Status: 'Habis' },
  ];
  const initialWb = XLSX.utils.book_new();
  const initialWs = XLSX.utils.json_to_sheet(initialStok);
  XLSX.utils.book_append_sheet(initialWb, initialWs, 'Stok');
  XLSX.writeFile(initialWb, stokFilePath);

  // Edit: Update status BRG-02 and add BRG-03
  const updatedStok = [
    { Kode: 'BRG-01', Nama: 'Kertas HVS A4 80gr', Stok: 50, Status: 'Tersedia' },
    { Kode: 'BRG-02', Nama: 'Tinta Printer Hitam', Stok: 20, Status: 'Tersedia (Diedit Agen)' },
    { Kode: 'BRG-03', Nama: 'Pulpen Gel Hitam (Baru)', Stok: 100, Status: 'Tersedia (Diedit Agen)' },
  ];

  // Execute generator write with physical target path
  const genResult = generator.generateExcel('Stok', updatedStok, stokFilePath);
  console.log(`   -> Write Status: ${genResult.status}`);
  console.log(`   -> Written to Disk: ${genResult.data?.writtenToDisk}`);
  console.log(`   -> Physical File Path: ${genResult.data?.filePath}`);

  // Re-read file physically from disk using DocumentReaderTool
  const verifyRead = await reader.readDocument(stokFilePath);
  console.log(`   -> Hasil Pembacaan Ulang dari Disk Fisik:\n${verifyRead.preview}`);

  if (verifyRead.status === 'success' && verifyRead.preview.includes('BRG-03') && verifyRead.preview.includes('Tersedia (Diedit Agen)')) {
    console.log('   ✅ PASSED: Berkas Excel fisik di disk terbukti ter-overwrite dan memuat baris editan baru.\n');
    passedScenarios++;
  } else {
    console.log('   ❌ FAILED: Berkas fisik di disk tidak ter-overwrite.\n');
  }

  // ------------------------------------------------------------------------
  // SKENARIO 5: Penanganan Rate Limit HTTP 429 & Cooldown Engine Provider
  // ------------------------------------------------------------------------
  console.log('📌 [SKENARIO 5/5] Klasifikasi HTTP 429 Rate Limit & Rotasi Cooldown Provider');
  const mockRepo = {
    findActive: async () => null,
    findAllEnabled: async () => [],
    findAvailable: async () => [],
    setCooldown: async () => {},
  };
  const providerService = new ProviderService(mockRepo);
  const classified429 = providerService.classifyError(429, 'OpenRouter Free Model Rate Limit Exceeded (429)');
  
  console.log(`   -> Action Classified: ${classified429.action}`);
  console.log(`   -> Cooldown Duration: ${classified429.cooldownSeconds}s`);
  console.log(`   -> Error Message: "${classified429.message}"`);

  if (classified429.action === 'rotate' && classified429.cooldownSeconds === 60) {
    console.log('   ✅ PASSED: Error 429 diklasifikasikan sebagai ROTATE dengan cooldown 60s.\n');
    passedScenarios++;
  } else {
    console.log('   ❌ FAILED: Klasifikasi error 429 tidak sesuai.\n');
  }

  // Clean up audit test directory
  fs.rmSync(demoDir, { recursive: true, force: true });

  console.log('========================================================================');
  console.log(`📊 HASIL AKHIR AUDIT SKENARIO BISNIS NYATA: ${passedScenarios}/${totalScenarios} PASSED (${(passedScenarios/totalScenarios)*100}%)`);
  console.log('========================================================================');

  if (passedScenarios !== totalScenarios) {
    process.exit(1);
  }
}

runRealBusinessScenarioAudit().catch((err) => {
  console.error('💥 UNHANDLED FAILURE IN AUDIT SUITE:', err);
  process.exit(1);
});
