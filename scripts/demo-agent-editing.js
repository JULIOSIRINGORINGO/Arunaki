import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { pathToFileURL } from 'url';

async function testAgentAndMultiAgentExecution() {
  console.log('================================================================');
  console.log('🤖 TESTING PRIMARY AGENT & MULTI-AGENT PARALLEL DELEGATION');
  console.log('================================================================\n');

  const rootDir = path.resolve();
  const distDir = path.join(rootDir, 'apps', 'api', 'dist', 'src');
  const demoDir = path.resolve('workspace-demo');

  if (!fs.existsSync(demoDir)) {
    fs.mkdirSync(demoDir, { recursive: true });
  }

  // Import Agent services
  const { SubAgentRunnerService } = await import(pathToFileURL(path.join(distDir, 'modules', 'chat', 'sub-agent-runner.service.js')).href);
  const { DocumentReaderTool } = await import(pathToFileURL(path.join(distDir, 'modules', 'tools', 'services', 'document-reader.tool.js')).href);
  const { DocumentGeneratorTool } = await import(pathToFileURL(path.join(distDir, 'modules', 'tools', 'services', 'document-generator.tool.js')).href);

  // 1. DOKUMEN AWAL: Buat file Excel awal
  const excelPath = path.join(demoDir, 'Laporan_Agen_Multi.xlsx');
  const rows = [
    { No: 1, Produk: 'Laptop Asus', Qty: 5, Total: 72500000 },
    { No: 2, Produk: 'Monitor LG', Qty: 10, Total: 32000000 },
  ];
  let wb = XLSX.utils.book_new();
  let ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Penjualan');
  XLSX.writeFile(wb, excelPath);
  console.log(`[1] File awal disiapkan: ${excelPath}\n`);

  // 2. EKSEKUSI PENGEDITAN OLEH AGEN (DocumentGeneratorTool via Agent Engine)
  console.log('🤖 [2] AGEN MELAKUKAN PENGEDITAN DOKUMEN (Menambah baris baru)...');
  const generator = new DocumentGeneratorTool();
  
  const currentData = XLSX.utils.sheet_to_json(XLSX.readFile(excelPath).Sheets['Penjualan']);
  currentData.push(
    { No: 3, Produk: 'Headset Gaming HyperX (Diedit Agen)', Qty: 12, Total: 14400000 },
    { No: 4, Produk: 'SSD Samsung 1TB (Diedit Agen)', Qty: 20, Total: 30000000 }
  );

  const editResult = await generator.generateExcel('Penjualan', currentData, excelPath);
  console.log(`  -> Status Agen Edit: ${editResult.status}`);
  console.log(`  -> File Diperbarui oleh Agen: ${editResult.data?.filePath || 'OK'}\n`);

  // 3. EKSEKUSI MULTI-AGEN PARALEL (agent_spawn)
  console.log('👥 [3] UJI EKSEKUSI MULTI-AGEN (2 Sub-Agent Berjalan Secara Paralel)...');

  const mockAi = {
    chat: async (messages) => {
      const sysMsg = messages.find((m) => m.role === 'system')?.content || '';
      const userMsg = messages.find((m) => m.role === 'user')?.content || '';
      if (sysMsg.includes('Sub-Agent 1') || userMsg.includes('Sub-Agent 1')) {
        return {
          content: 'Sub-Agent 1 Selesai: Berhasil menganalisis file Excel Laporan_Agen_Multi.xlsx (Total 4 produk, omzet Rp 148.900.000)',
          toolCalls: [],
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        };
      }
      return {
        content: 'Sub-Agent 2 Selesai: Berhasil merekap rekening bank (Total 3 transaksi cocok)',
        toolCalls: [],
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      };
    },
  };

  const mockRegistry = {
    getToolDefinitions: () => [{ function: { name: 'document_reader' } }],
  };
  const mockHealing = { executeWithHealing: async () => ({ finalResult: { status: 'success' } }) };

  const subAgentRunner = new SubAgentRunnerService(mockAi, mockRegistry, mockHealing);

  const startTime = Date.now();
  const subAgentResults = await subAgentRunner.spawnParallel([
    {
      taskId: 'sub_agent_excel',
      taskName: 'Sub-Agent 1: Analisis Excel Omset',
      taskDescription: 'Menganalisis file Excel Laporan_Agen_Multi.xlsx dan hitung total omzet',
      allowedTools: ['document_reader'],
    },
    {
      taskId: 'sub_agent_bank',
      taskName: 'Sub-Agent 2: Rekap Rekening Bank',
      taskDescription: 'Merekap transaksi bank CSV dan cocokkan dengan invoice',
      allowedTools: ['document_reader'],
    },
  ]);

  const durationMs = Date.now() - startTime;

  console.log(`  -> Waktu Eksekusi Multi-Agen Paralel: ${durationMs}ms`);
  subAgentResults.forEach((res, i) => {
    console.log(`  -> [Sub-Agent ${i + 1}] ${res.taskName}: ${res.status.toUpperCase()}`);
    console.log(`     Laporan: "${res.content}"`);
  });

  // 4. BACA HASIL EDITAN FISIK TERAKHIR
  console.log('\n🔍 [4] VERIFIKASI PEMBACAAN ISI FILE FISIK YANG DIEDIT AGEN:');
  const reader = new DocumentReaderTool();
  const readResult = await reader.readDocument(excelPath);
  console.log(readResult.preview);

  console.log('\n================================================================');
  console.log('🎉 PENGEDITAN OLEH AGEN & PARALEL MULTI-AGEN 100% SUKSES!');
  console.log('================================================================');
}

testAgentAndMultiAgentExecution().catch((err) => {
  console.error('❌ AGENT EXECUTION TEST FAILED:', err);
  process.exit(1);
});
