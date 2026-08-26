import { ExcelComService } from '../src/modules/interaction/excel-com.service';
const XLSX = require('xlsx');
const path = require('path');

async function main() {
  const svc = new ExcelComService();
  const file = path.join(__dirname, '..', 'test', 'workspace-demo', 'Laporan Bengkel Januari.xlsx');
  const res = await svc.editExcel(file, [
    { action: 'append_row', value: { Tanggal: '22/01/2026', Barang: 'Semen 40kg', Jumlah: 15, Harga: 65000, Total: 975000 } },
    { action: 'append_row', value: { Tanggal: '22/01/2026', Barang: 'Besi beton 8mm', Jumlah: 7, Harga: 98000, Total: 686000 } },
    { action: 'write_cell', matchColumn: 'Barang', matchValue: 'Grand Total', targetColumn: 'Total', value: '=SUM(E2:E8)' },
  ] as any, 'Penjualan Januari');
  console.log(JSON.stringify(res).slice(0, 900));
  const wb = XLSX.readFile(file);
  console.log(JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets['Penjualan Januari'], { header: 1 }).slice(-4)));
}
main().catch(e => { console.error(e.message); process.exit(1); });
