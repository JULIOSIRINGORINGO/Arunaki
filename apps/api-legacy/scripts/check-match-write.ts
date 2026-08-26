import { ExcelComService } from '../src/modules/interaction/excel-com.service';
const XLSX = require('xlsx');
const path = require('path');

async function main() {
  const svc = new ExcelComService();
  const file = path.join(__dirname, '..', 'test', 'workspace-demo', 'Laporan Bengkel Januari.xlsx');
  const res = await svc.editExcel(file, [
    { action: 'write_cell', matchColumn: 'Barang', matchValue: 'Semen 40kg', targetColumn: 'Keluar', value: 35 },
    { action: 'write_cell', matchColumn: 'Barang', matchValue: 'Besi beton 8mm', targetColumn: 'Keluar', value: 27 },
    { action: 'write_cell', matchColumn: 'Barang', matchValue: 'Tidak Ada', targetColumn: 'Keluar', value: 99 },
  ], 'Stok');
  console.log(JSON.stringify(res, null, 2));
  const g: any[][] = XLSX.utils.sheet_to_json(XLSX.readFile(file).Sheets['Stok'], { header: 1 });
  console.log(JSON.stringify(g));
  if (g[1][4] !== 35 || g[2][4] !== 27) throw new Error('values not written');
  if (res.results[2].success !== false) throw new Error('missing match should fail');
  console.log('SELF-CHECK OK');
}
main().catch(e => { console.error(e); process.exit(1); });
