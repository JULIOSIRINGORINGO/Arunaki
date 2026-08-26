import { ExcelComService } from '../src/modules/interaction/excel-com.service';
const XLSX = require('xlsx');
const path = require('path');

async function main() {
  const svc = new ExcelComService();
  const file = path.join(__dirname, '..', 'test', 'workspace-demo', 'Laporan Bengkel Januari.xlsx');
  await svc.editExcel(file, { action: 'insert_row', row: 7, sheetName: 'Penjualan Januari' } as any);
  await svc.editExcel(file, { action: 'insert_row', row: 7, sheetName: 'Penjualan Januari' } as any);
  const res = await svc.editExcel(file, [
    { action: 'write_cell', cell: 'A7', value: '22/01/2026', sheetName: 'Penjualan Januari' },
    { action: 'write_cell', cell: 'B7', value: 'Semen 40kg', sheetName: 'Penjualan Januari' },
    { action: 'write_cell', cell: 'C7', value: 15, sheetName: 'Penjualan Januari' },
    { action: 'write_cell', cell: 'D7', value: 65000, sheetName: 'Penjualan Januari' },
    { action: 'write_cell', cell: 'E7', value: 975000, sheetName: 'Penjualan Januari' },
    { action: 'write_cell', cell: 'A8', value: '22/01/2026', sheetName: 'Penjualan Januari' },
    { action: 'write_cell', cell: 'B8', value: 'Besi beton 8mm', sheetName: 'Penjualan Januari' },
    { action: 'write_cell', cell: 'C8', value: 7, sheetName: 'Penjualan Januari' },
    { action: 'write_cell', cell: 'D8', value: 98000, sheetName: 'Penjualan Januari' },
    { action: 'write_cell', cell: 'E8', value: 686000, sheetName: 'Penjualan Januari' },
    { action: 'write_cell', cell: 'E9', value: 3621000, sheetName: 'Penjualan Januari' },
  ] as any);
  console.log(JSON.stringify(res.results.map((r: any) => r.success)));
  const wb = XLSX.readFile(file);
  console.log('PENJUALAN:', JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets['Penjualan Januari'], { header: 1 }).slice(4)));
  console.log('STOK:', JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets['Stok'], { header: 1 })));
}
main().catch(e => { console.error(e); process.exit(1); });
