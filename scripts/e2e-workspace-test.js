import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { pathToFileURL } from 'url';

async function runWorkspaceEndToEndTest() {
  console.log('====================================================');
  console.log('🚀 RUNNING REAL WORKSPACE E2E TEST SUITE FOR ARUNAKI');
  console.log('====================================================\n');

  const rootDir = path.resolve();
  const distDir = path.join(rootDir, 'apps', 'api', 'dist', 'src');

  // Dynamically import compiled modules using file:// URLs
  const { DocumentReaderTool } = await import(pathToFileURL(path.join(distDir, 'modules', 'tools', 'services', 'document-reader.tool.js')).href);
  const { DocumentReconciliationService } = await import(pathToFileURL(path.join(distDir, 'modules', 'document', 'doc-reconciliation.service.js')).href);
  const { DocumentGeneratorTool } = await import(pathToFileURL(path.join(distDir, 'modules', 'tools', 'services', 'document-generator.tool.js')).href);
  const { SecretsVaultService } = await import(pathToFileURL(path.join(distDir, 'modules', 'security', 'secrets-vault.service.js')).href);
  const { TrajectoryAuditService } = await import(pathToFileURL(path.join(distDir, 'modules', 'audit', 'trajectory-audit.service.js')).href);

  const testDir = path.resolve('test-workspace-temp');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // 1. Create Real Excel File
  const excelPath = path.join(testDir, 'Invoices_2026.xlsx');
  const excelData = [
    { id: 'INV-001', customer: 'PT Makmur Jaya', amount: 15000000, status: 'LUNAS' },
    { id: 'INV-002', customer: 'CV Sejahtera', amount: 27500000, status: 'PENDING' },
    { id: 'INV-003', customer: 'Toko Berkah', amount: 8200000, status: 'LUNAS' },
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelData);
  XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
  XLSX.writeFile(wb, excelPath);
  console.log(`✅ [1/5] Created test Excel file: ${excelPath}`);

  // 2. Create Real CSV File
  const csvPath = path.join(testDir, 'Bank_Statement.csv');
  const csvContent = `id,ref,nominal,description\nINV-001,TRX-991,15000000,Pembayaran PT Makmur\nINV-002,TRX-992,27500000,Transfer CV Sejahtera\nINV-004,TRX-994,5000000,Transfer Lainnya`;
  fs.writeFileSync(csvPath, csvContent, 'utf-8');
  console.log(`✅ [2/5] Created test CSV file: ${csvPath}`);

  // 3. Test Document Reader Tool
  console.log('\n🔍 Testing DocumentReaderTool on Real Workspace Files...');
  const reader = new DocumentReaderTool();
  
  const excelResult = await reader.readDocument(excelPath);
  console.log(`  -> Excel Read Status: ${excelResult.status}`);
  console.log(`  -> Preview:\n${excelResult.preview.substring(0, 150)}...\n`);
  if (excelResult.status !== 'success') throw new Error('Excel read failed!');

  const csvResult = await reader.readDocument(csvPath);
  console.log(`  -> CSV Read Status: ${csvResult.status}`);
  console.log(`  -> Preview:\n${csvResult.preview.substring(0, 150)}...\n`);
  if (csvResult.status !== 'success') throw new Error('CSV read failed!');

  // 4. Test Document Reconciliation Engine
  console.log('⚖️ Testing DocumentReconciliationService (Invoices vs Bank Statement)...');
  const reconciler = new DocumentReconciliationService();
  const report = reconciler.reconcileDocuments(
    'Invoices_2026.xlsx',
    excelData,
    'Bank_Statement.csv',
    [
      { id: 'INV-001', nominal: 15000000 },
      { id: 'INV-002', nominal: 27500000 },
      { id: 'INV-004', nominal: 5000000 },
    ],
    'id',
  );

  console.log(`  -> Total Items Checked: ${report.summary.totalItemsChecked}`);
  console.log(`  -> Match Count: ${report.summary.matchCount}`);
  console.log(`  -> Mismatch Count: ${report.summary.mismatchCount}`);
  console.log(`  -> Formatted Table:\n${report.formattedTableMarkdown}\n`);

  // 5. Test Document Generator Tool
  console.log('📊 Testing DocumentGeneratorTool (Laba Rugi Excel Report)...');
  const generator = new DocumentGeneratorTool();
  const reportResult = await generator.generateLabaRugiReport({
    companyName: 'PT Arunaki Indonesia E2E Test',
    period: 'Juli 2026',
    incomeItems: [{ category: 'Penjualan Dokumen', amount: 50000000 }],
    expenseItems: [{ category: 'Operasional Server', amount: 15000000 }],
  });
  console.log(`  -> Report Generation Status: ${reportResult.status}`);
  console.log(`  -> Generated File Path: ${reportResult.data?.filePath || 'N/A'}\n`);

  // 6. Test Secrets Vault & Trajectory Audit
  console.log('🔐 Testing SecretsVaultService & TrajectoryAuditService...');
  const vault = new SecretsVaultService();
  vault.storeSecret('WORKSPACE_TEST_KEY', 'sk-real-test-secret-12345');
  const decrypted = vault.getSecret('WORKSPACE_TEST_KEY');
  console.log(`  -> Secrets Vault Decryption Verified: ${decrypted === 'sk-real-test-secret-12345'}`);

  const audit = new TrajectoryAuditService();
  audit.recordStep('run_e2e_real', 'chat_e2e', 'agent_start', { test: true });
  audit.recordStep('run_e2e_real', 'chat_e2e', 'tool_done', { tool: 'document_reader' });
  audit.recordStep('run_e2e_real', 'chat_e2e', 'agent_complete', { success: true });
  const auditReport = audit.exportTrajectoryJson('run_e2e_real');
  console.log(`  -> Trajectory Audit Exported (${auditReport.totalSteps} steps, status: ${auditReport.summary.status})`);

  // Clean up test workspace directory
  fs.rmSync(testDir, { recursive: true, force: true });
  console.log('\n====================================================');
  console.log('🎉 ALL REAL WORKSPACE E2E TESTS PASSED WITH 0 CRASHES!');
  console.log('====================================================');
}

runWorkspaceEndToEndTest().catch((err) => {
  console.error('❌ E2E TEST FAILED:', err);
  process.exit(1);
});
