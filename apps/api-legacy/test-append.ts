import { ExcelComService } from './src/modules/interaction/excel-com.service';

async function testAppend() {
  const excelCom = new ExcelComService();
  const filePath = 'E:\\JS\\laporan-test\\TABEL REKAPAN NEW2026-.xlsm';
  console.log('Testing append_row on:', filePath);
  
  try {
    const result = await excelCom.editExcel(
      filePath,
      [{
        action: 'append_row',
        column: 2, // Search for empty row starting in column B
        rowData: ['TOKO VIVI', 430, 'BCA', 'DTF', '', '', 'sisa deposit kurangi belanja Bendong Rp30.000']
      }],
      'AGUSTUS'
    );
    console.log('\\n✅ APPEND SUCCESS:');
    console.dir(result, { depth: null });
  } catch (error) {
    console.error('\\n❌ ERROR:');
    console.error(error);
  }
}

testAppend();
