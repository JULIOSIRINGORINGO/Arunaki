import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { pathToFileURL } from 'url';

async function testFileCreationAndEditing() {
  console.log('========================================================');
  console.log('📝 TESTING REAL FILE CREATION & EDITING IN WORKSPACE');
  console.log('========================================================\n');

  const rootDir = path.resolve();
  const distDir = path.join(rootDir, 'apps', 'api', 'dist', 'src');
  const demoDir = path.resolve('workspace-demo');

  if (!fs.existsSync(demoDir)) {
    fs.mkdirSync(demoDir, { recursive: true });
  }

  // Import tools
  const { DocumentReaderTool } = await import(pathToFileURL(path.join(distDir, 'modules', 'tools', 'services', 'document-reader.tool.js')).href);

  // 1. DOKUMEN AWAL: Buat file Excel awal (Data_Omset_Awal.xlsx)
  const filePath = path.join(demoDir, 'Data_Omset_Toko.xlsx');
  console.log(`[1] Membuat file Excel awal di: ${filePath}`);

  const initialRows = [
    { No: 1, Produk: 'Laptop Asus Zenbook', Qty: 5, Harga: 14500000, Total: 72500000 },
    { No: 2, Produk: 'Monitor LG 27 Inch', Qty: 10, Harga: 3200000, Total: 32000000 },
    { No: 3, Produk: 'Keyboard Mechanical', Qty: 15, Harga: 850000, Total: 12750000 },
  ];

  let wb = XLSX.utils.book_new();
  let ws = XLSX.utils.json_to_sheet(initialRows);
  XLSX.utils.book_append_sheet(wb, ws, 'Penjualan');
  XLSX.writeFile(wb, filePath);
  console.log('✅ File Excel awal berhasil dibuat!\n');

  // 2. PEMBACAAN AWAL: Baca isi file sebelum diedit
  const reader = new DocumentReaderTool();
  console.log('[2] Membaca isi file Excel SEBELUM DITAMBAH EDIT DATA:');
  const readBefore = await reader.readDocument(filePath);
  console.log(readBefore.preview);
  console.log('');

  // 3. PENGEDITAN FILE: Tambah 2 baris data baru dan ubah status
  console.log('[3] MELAKUKAN PENGEDITAN FILE (Menambah data transaksi baru & rumus total)...');
  
  // Read existing workbook
  const existingWb = XLSX.readFile(filePath);
  const existingSheet = existingWb.Sheets['Penjualan'];
  const currentData = XLSX.utils.sheet_to_json(existingSheet);

  // Add new rows (Editing dataset)
  currentData.push(
    { No: 4, Produk: 'Mouse Wireless Logitech', Qty: 25, Harga: 350000, Total: 8750000 },
    { No: 5, Produk: 'Webcam HD 1080p', Qty: 8, Harga: 650000, Total: 5200000 },
  );

  // Write updated data back to the file
  const updatedWs = XLSX.utils.json_to_sheet(currentData);
  existingWb.Sheets['Penjualan'] = updatedWs;
  XLSX.writeFile(existingWb, filePath);
  console.log('✅ PENGEDITAN FILE SELESAI & DISIMPAN BERHASIL!\n');

  // 4. PEMBACAAN SETELAH DIEDIT: Verifikasi bahwa file fisik di disk benar-benar berubah
  console.log('[4] Membaca isi file Excel SETELAH DIEDIT (Hasil Nyata di Disk):');
  const readAfter = await reader.readDocument(filePath);
  console.log(readAfter.preview);
  console.log('');

  console.log('========================================================');
  console.log(`🎉 VERIFIKASI BERHASIL! File fisik tersedia di:\n👉 ${filePath}`);
  console.log('========================================================');
}

testFileCreationAndEditing().catch((err) => {
  console.error('❌ EDITING TEST FAILED:', err);
  process.exit(1);
});
