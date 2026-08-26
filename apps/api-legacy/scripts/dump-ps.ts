import { ExcelComService } from '../src/modules/interaction/excel-com.service';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function main() {
  const svc: any = new ExcelComService();
  const file = path.join(__dirname, '..', 'test', 'workspace-demo', 'Laporan Bengkel Januari.xlsx');
  const actions = [
    { action: 'append_row', value: { Tanggal: '22/01/2026', Barang: 'Semen 40kg', Jumlah: 15, Harga: 65000, Total: 975000 } },
    { action: 'append_row', value: { Tanggal: '22/01/2026', Barang: 'Besi beton 8mm', Jumlah: 7, Harga: 98000, Total: 686000 } },
    { action: 'write_cell', matchColumn: 'Barang', matchValue: 'Grand Total', targetColumn: 'Total', value: '=SUM(E2:E8)' },
  ];
  let ps = svc.buildPowerShellScript(file, actions as any, 'Penjualan Januari');
  const out = path.join(__dirname, 'dump-excel.ps1');
  fs.writeFileSync(out, ps.replace(/\n/g, '\r\n'));
  const raw = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${out}"`).toString();
  console.log('=== RAW STDOUT ===');
  console.log(JSON.stringify(raw));
}
main().catch(e => { console.error(e.message); process.exit(1); });
