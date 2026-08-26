const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const wroot = path.join(__dirname, 'workspace-demo');
if (!fs.existsSync(wroot)) fs.mkdirSync(wroot);

const wb = XLSX.utils.book_new();

// Sheet 1: Penjualan Januari
const penjualanData = [
  ['Tanggal', 'Barang', 'Jumlah', 'Harga', 'Total'],
  ['10/01/2026', 'Cat Tembok', 5, 130000, 650000],
  ['12/01/2026', 'Kuas', 10, 31000, 310000],
  ['15/01/2026', 'Thinner', 10, 50000, 500000],
  ['18/01/2026', 'Paku Payung', 10, 20000, 200000],
  ['20/01/2026', 'Triplek', 2, 150000, 300000],
  ['', '', '', 'Grand Total', 1960000]
];
const wsPenjualan = XLSX.utils.aoa_to_sheet(penjualanData);
XLSX.utils.book_append_sheet(wb, wsPenjualan, 'Penjualan Januari');

// Sheet 2: Stok
const stokData = [
  ['Kode', 'Barang', 'Awal', 'Masuk', 'Keluar', 'Sisa'],
  ['BRG-01', 'Semen 40kg', 100, 50, 20, 130],
  ['BRG-02', 'Besi beton 8mm', 100, 50, 20, 130]
];
const wsStok = XLSX.utils.aoa_to_sheet(stokData);
XLSX.utils.book_append_sheet(wb, wsStok, 'Stok');

// Sheet 3: Rekap
const rekapData = [
  ['Keterangan', 'Nilai'],
  ['Total Penjualan', ''],
  ['Jumlah Transaksi', '']
];
const wsRekap = XLSX.utils.aoa_to_sheet(rekapData);
XLSX.utils.book_append_sheet(wb, wsRekap, 'Rekap');

wb.Workbook = { Views: [{ activeTab: 0 }] };

XLSX.writeFile(wb, path.join(wroot, 'Laporan Bengkel Januari.xlsx'));
console.log('Created Laporan Bengkel Januari.xlsx with 3 sheets');
