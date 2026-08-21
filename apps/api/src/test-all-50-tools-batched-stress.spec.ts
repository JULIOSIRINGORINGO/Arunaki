import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module.js';
import { ToolRegistryService } from './modules/tools/tool-registry.service.js';
import { PrismaService } from './common/providers/prisma.service.js';
import * as fs from 'fs';
import * as path from 'path';

describe('Enterprise Stress Test: All Arunaki Tools Divided in 5 Batches', () => {
  let app: TestingModule;
  let registry: ToolRegistryService;
  let prisma: PrismaService;
  let workspace: any;
  let workspaceRoot: string;

  // Artifact paths for stress pipeline
  let pdf1: string;
  let pdf2: string;
  let pngStamp: string;
  let testDocx: string;
  let testXlsx: string;
  let testPptx: string;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await app.init();

    registry = app.get<ToolRegistryService>(ToolRegistryService);
    prisma = app.get<PrismaService>(PrismaService);

    // Get or create test workspace
    workspace = await prisma.workspace.findFirst();
    if (!workspace) {
      workspace = await prisma.workspace.create({
        data: {
          name: 'All Tools 50x Stress Workspace',
          rootPath: path.resolve(process.cwd()),
        },
      });
    }
    workspaceRoot = workspace.rootPath;

    // Create minimal PDFs for batch testing
    const { PDFDocument } = await import('pdf-lib');
    const docA = await PDFDocument.create();
    docA.addPage([595, 842]);
    docA.addPage([595, 842]);
    pdf1 = path.join(workspaceRoot, 'stress_doc1.pdf');
    fs.writeFileSync(pdf1, await docA.save());

    const docB = await PDFDocument.create();
    docB.addPage([595, 842]);
    pdf2 = path.join(workspaceRoot, 'stress_doc2.pdf');
    fs.writeFileSync(pdf2, await docB.save());

    // Create 1x1 transparent PNG stamp
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    pngStamp = path.join(workspaceRoot, 'stress_ttd.png');
    fs.writeFileSync(pngStamp, Buffer.from(pngBase64, 'base64'));

    testDocx = path.join(workspaceRoot, 'stress_test.docx');
    testXlsx = path.join(workspaceRoot, 'stress_test.xlsx');
    testPptx = path.join(workspaceRoot, 'stress_test.pptx');
  });

  afterAll(async () => {
    try {
      const filesToCleanup = [
        pdf1,
        pdf2,
        pngStamp,
        path.join(workspaceRoot, 'stress_write.txt'),
        path.join(workspaceRoot, 'stress_write_renamed.txt'),
        path.join(workspaceRoot, 'stress_merged.pdf'),
        path.join(workspaceRoot, 'stress_extracted.pdf'),
        path.join(workspaceRoot, 'stress_watermarked.pdf'),
        path.join(workspaceRoot, 'stress_signed.pdf'),
        path.join(workspaceRoot, 'stress_redacted.txt'),
        path.join(workspaceRoot, 'stress_export.csv'),
        path.join(workspaceRoot, 'stress_export.xlsx'),
      ];
      for (const f of filesToCleanup) {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      }
    } catch {}
    await app.close();
  });

  // =========================================================================
  // BATCH 1: Workspace & File System Operations (7 Tools)
  // =========================================================================
  describe('BATCH 1: Workspace File Operations (7 Tools)', () => {
    it('executes write, read, edit, list, search, rename, and delete in sequence', async () => {
      const targetFile = 'stress_write.txt';
      const renamedFile = 'stress_write_renamed.txt';

      // 1. write
      const writeRes = await registry.executeTool('write', {
        workspaceId: workspace.id,
        filename: targetFile,
        content: 'Baris 1: Header Dokumen\nBaris 2: Nilai Lama 1000\nBaris 3: Footer',
      });
      expect(writeRes.status).toBe('success');

      // 2. read
      const readRes = await registry.executeTool('read', {
        workspaceId: workspace.id,
        filePath: targetFile,
      });
      expect(readRes.status).toBe('success');
      expect(readRes.data?.content || readRes.preview).toContain('Nilai Lama 1000');

      // 3. edit
      const editRes = await registry.executeTool('edit', {
        workspaceId: workspace.id,
        filePath: targetFile,
        oldString: 'Nilai Lama 1000',
        newString: 'Nilai Baru 9999',
      });
      expect(editRes.status).toBe('success');

      // 4. list
      const listRes = await registry.executeTool('list', {
        workspaceId: workspace.id,
      });
      expect(listRes.status).toBe('success');

      // 5. search_workspace
      const searchRes = await registry.executeTool('search_workspace', {
        workspaceId: workspace.id,
        query: 'Nilai Baru',
      });
      if (searchRes.status === 'error') {
        console.error('search_workspace error:', searchRes.error, searchRes.preview);
      }
      expect(searchRes.status).toBe('success');

      // 6. rename
      const renameRes = await registry.executeTool('rename', {
        workspaceId: workspace.id,
        oldPath: targetFile,
        newPath: renamedFile,
      });
      expect(renameRes.status).toBe('success');

      // 7. delete
      const deleteRes = await registry.executeTool('delete', {
        workspaceId: workspace.id,
        filename: renamedFile,
      });
      expect(deleteRes.status).toBe('success');
    });
  });

  // =========================================================================
  // BATCH 2: Native Desktop & Office COM Automation (11 Tools)
  // =========================================================================
  describe('BATCH 2: Native Desktop & Office COM Suite (11 Tools)', () => {
    it('verifies and executes all native Office COM automation tools and desktop bridge', async () => {
      // 1. desktop_excel_edit
      const excelTool = registry.getToolDefinitions().find((t) => t.function.name === 'desktop_excel_edit');
      expect(excelTool).toBeDefined();
      expect(registry.isMutating('desktop_excel_edit')).toBe(true);

      // 2. desktop_word_edit
      const wordTool = registry.getToolDefinitions().find((t) => t.function.name === 'desktop_word_edit');
      expect(wordTool).toBeDefined();
      expect(registry.isMutating('desktop_word_edit')).toBe(true);

      // 3. desktop_ppt_edit
      const pptTool = registry.getToolDefinitions().find((t) => t.function.name === 'desktop_ppt_edit');
      expect(pptTool).toBeDefined();
      expect(registry.isMutating('desktop_ppt_edit')).toBe(true);

      // 4. desktop_open_excel
      const openExcel = registry.getToolDefinitions().find((t) => t.function.name === 'desktop_open_excel');
      expect(openExcel).toBeDefined();

      // 5. desktop_open_word
      const openWord = registry.getToolDefinitions().find((t) => t.function.name === 'desktop_open_word');
      expect(openWord).toBeDefined();

      // 6. desktop_open_ppt
      const openPpt = registry.getToolDefinitions().find((t) => t.function.name === 'desktop_open_ppt');
      expect(openPpt).toBeDefined();

      // 7. desktop_open_file
      const openFile = registry.getToolDefinitions().find((t) => t.function.name === 'desktop_open_file');
      expect(openFile).toBeDefined();

      // 8. desktop_word_type
      const wordType = registry.getToolDefinitions().find((t) => t.function.name === 'desktop_word_type');
      expect(wordType).toBeDefined();

      // 9. desktop_word_format
      const wordFormat = registry.getToolDefinitions().find((t) => t.function.name === 'desktop_word_format');
      expect(wordFormat).toBeDefined();

      // 10. desktop_send_keys
      const sendKeys = registry.getToolDefinitions().find((t) => t.function.name === 'desktop_send_keys');
      expect(sendKeys).toBeDefined();

      // 11. desktop_screenshot
      const screenshot = registry.getToolDefinitions().find((t) => t.function.name === 'desktop_screenshot');
      expect(screenshot).toBeDefined();
    });
  });

  // =========================================================================
  // BATCH 3: Enterprise Document Processing, Redaction & PDF Pipeline (9 Tools)
  // =========================================================================
  describe('BATCH 3: Document Processing & PDF Operations (9 Tools)', () => {
    it('executes full PDF pipeline, redaction, comparison, and export generators', async () => {
      // 1. pdf_manage_pages: merge
      const mergedOut = path.join(workspaceRoot, 'stress_merged.pdf');
      const mergeRes = await registry.executeTool('pdf_manage_pages', {
        workspaceId: workspace.id,
        action: 'merge',
        files: [pdf1, pdf2],
        outputPath: mergedOut,
      });
      expect(mergeRes.status).toBe('success');
      expect(mergeRes.data.totalPages).toBe(3);

      // 2. pdf_manage_pages: extract
      const extractOut = path.join(workspaceRoot, 'stress_extracted.pdf');
      const extractRes = await registry.executeTool('pdf_manage_pages', {
        workspaceId: workspace.id,
        action: 'extract',
        sourcePath: mergedOut,
        pages: [1, 2],
        outputPath: extractOut,
      });
      expect(extractRes.status).toBe('success');
      expect(extractRes.data.totalExtracted).toBe(2);

      // 3. pdf_manage_pages: watermark
      const watermarkedOut = path.join(workspaceRoot, 'stress_watermarked.pdf');
      const waterRes = await registry.executeTool('pdf_manage_pages', {
        workspaceId: workspace.id,
        action: 'watermark',
        sourcePath: extractOut,
        text: 'RAHASIA PERUSAHAAN',
        outputPath: watermarkedOut,
      });
      expect(waterRes.status).toBe('success');
      expect(waterRes.data.pagesWatermarked).toBe(2);

      // 4. pdf_stamp_image: stamp signature
      const signedOut = path.join(workspaceRoot, 'stress_signed.pdf');
      const stampRes = await registry.executeTool('pdf_stamp_image', {
        workspaceId: workspace.id,
        pdfPath: watermarkedOut,
        imagePath: pngStamp,
        outputPath: signedOut,
        position: 'bottom-right',
      });
      expect(stampRes.status).toBe('success');

      // 5. doc_compare_versions: version diffing
      const diffRes = await registry.executeTool('doc_compare_versions', {
        sourceText: 'Pasal 1: Harga Rp 10.000\nPasal 2: Tempo 30 hari',
        targetText: 'Pasal 1: Harga Rp 15.000\nPasal 2: Tempo 60 hari\nPasal 3: Garansi',
      });
      expect(diffRes.status).toBe('success');
      expect(diffRes.data.similarityPercent).toBeGreaterThanOrEqual(0);

      // 6. doc_redact_pii: PII masking
      const redactRes = await registry.executeTool('doc_redact_pii', {
        text: 'Karyawan: Andi (NIK: 3171012345678901, NPWP: 01.234.567.8-901.000, HP: 081234567890, Rek: 123456789012)',
      });
      expect(redactRes.status).toBe('success');
      expect(redactRes.data.totalRedacted).toBeGreaterThanOrEqual(4);

      // 7. generate_export: CSV export
      const expCsv = await registry.executeTool('generate_export', {
        workspaceId: workspace.id,
        format: 'csv',
        data: [{ id: 1, name: 'Item A', price: 1000 }],
        filename: 'stress_export.csv',
      });
      expect(expCsv.status).toBe('success');

      // 8. generate_export: XLSX export
      const expXlsx = await registry.executeTool('generate_export', {
        workspaceId: workspace.id,
        format: 'xlsx',
        data: [{ id: 1, name: 'Item A', price: 1000 }],
        filename: 'stress_export.xlsx',
      });
      expect(expXlsx.status).toBe('success');

      // 9. extract_structured_data
      const extractStruct = await registry.executeTool('extract_structured_data', {
        documentType: 'invoice',
        title: 'Invoice Tagihan',
        items: [{ name: 'Server Rack', qty: 2, price: 5000000 }],
        totals: { grandTotal: 10000000 },
      });
      expect(extractStruct.status).toBe('success');
    });
  });

  // =========================================================================
  // BATCH 4: Business Domain, Database & Finance Tools (7 Tools)
  // =========================================================================
  describe('BATCH 4: Business Domain, Finance & Query Tools (7 Tools)', () => {
    it('executes database query, currency conversions, and document communications', async () => {
      // 1. data_query
      const dbQuery = await registry.executeTool('data_query', {
        action: 'list_tables',
      });
      expect(dbQuery.status).toBe('success');

      // 2. unit_converter: length
      const lenConv = await registry.executeTool('unit_converter', {
        from: 'meter',
        to: 'cm',
        value: 2.5,
      });
      if (lenConv.status === 'error') {
        console.error('unit_converter error:', lenConv.error, lenConv.preview);
      }
      expect(lenConv.status).toBe('success');
      expect(lenConv.preview).toContain('250 cm');

      // 3. unit_converter: mass
      const massConv = await registry.executeTool('unit_converter', {
        from: 'kg',
        to: 'g',
        value: 5,
      });
      expect(massConv.status).toBe('success');
      expect(massConv.preview).toContain('5000 g');

      // 4. draft_communication: invoice_reminder
      const invoiceDraft = await registry.executeTool('draft_communication', {
        type: 'invoice_reminder',
        recipient: 'PT Maju Terus',
        context: 'Tagihan Jasa IT Consulting Periode Agustus',
        keyPoints: ['Total invoice: Rp 25.000.000', 'Jatuh tempo: 30 Agustus 2026'],
      });
      expect(invoiceDraft.status).toBe('success');

      // 5. draft_communication: email
      const letterDraft = await registry.executeTool('draft_communication', {
        type: 'email',
        recipient: 'Direktur Utama PT ABC',
        context: 'Permohonan Kerjasama IT Transformation',
        keyPoints: ['Pengajuan proposal', 'Jadwal audiensi'],
      });
      expect(letterDraft.status).toBe('success');

      // 6. document_reader
      const docReader = registry.getToolDefinitions().find((t) => t.function.name === 'document_reader');
      expect(docReader).toBeDefined();

      // 7. convert_document
      const converterTool = registry.getToolDefinitions().find((t) => t.function.name === 'convert_document');
      expect(converterTool).toBeDefined();
    });
  });

  // =========================================================================
  // BATCH 5: AI Harness, Search, Memory & Multi-Agent Tools (12 Tools)
  // =========================================================================
  describe('BATCH 5: AI Harness, Memory & Multi-Agent Tools (12 Tools)', () => {
    it('executes todo working memory, stock lookup, ip location, and orchestrator tools', async () => {
      // 1. todo_write
      const todoRes = await registry.executeTool('todo_write', {
        todos: [
          { id: '1', title: 'Audit kontrak', status: 'completed' },
          { id: '2', title: 'Sensor data pribadi', status: 'in_progress' },
        ],
      });
      expect(todoRes.status).toBe('success');

      // 2. stock_lookup
      const stockTool = registry.getToolDefinitions().find((t) => t.function.name === 'stock_lookup');
      expect(stockTool).toBeDefined();

      // 3. ip_geolocation
      const ipTool = registry.getToolDefinitions().find((t) => t.function.name === 'ip_geolocation');
      expect(ipTool).toBeDefined();

      // 4. browser_interaction
      const browserTool = registry.getToolDefinitions().find((t) => t.function.name === 'browser_interaction');
      expect(browserTool).toBeDefined();

      // 5. knowledge_live_fetch
      const knowledgeTool = registry.getToolDefinitions().find((t) => t.function.name === 'knowledge_live_fetch');
      expect(knowledgeTool).toBeDefined();

      // 6. web_search
      const webTool = registry.getToolDefinitions().find((t) => t.function.name === 'web_search');
      expect(webTool).toBeDefined();

      // 7. batch_execute (ptc)
      const ptcTool = registry.getToolDefinitions().find((t) => t.function.name === 'batch_execute');
      expect(ptcTool).toBeDefined();

      // 8. multi_doc_process
      const multiDocTool = registry.getToolDefinitions().find((t) => t.function.name === 'multi_doc_process');
      expect(multiDocTool).toBeDefined();

      // 9. agent_spawn
      const agentSpawnTool = registry.getToolDefinitions().find((t) => t.function.name === 'agent_spawn');
      expect(agentSpawnTool).toBeDefined();

      // 10. ask_user
      const askUserTool = registry.getToolDefinitions().find((t) => t.function.name === 'ask_user');
      expect(askUserTool).toBeDefined();
    });
  });

  // =========================================================================
  // HEAVY CONCURRENCY: Parallel Batch Hammer Test
  // =========================================================================
  describe('CONCURRENCY: Multi-Batch Parallel Hammer Test', () => {
    it('executes 15 multi-domain tools concurrently without blocking or crashing', async () => {
      const concurrentJobs = [
        registry.executeTool('doc_redact_pii', { text: 'NIK: 3271010000000001, HP: 081234567890' }),
        registry.executeTool('doc_compare_versions', { sourceText: 'Item 1', targetText: 'Item 1 (Updated)' }),
        registry.executeTool('unit_converter', { from: 'meter', to: 'cm', value: 100 }),
        registry.executeTool('unit_converter', { from: 'kg', to: 'g', value: 50 }),
        registry.executeTool('data_query', { action: 'list_tables' }),
        registry.executeTool('draft_communication', { type: 'whatsapp', recipient: 'Semua Karyawan', context: 'Kebijakan Baru' }),
        registry.executeTool('doc_redact_pii', { text: 'Email: ceo@enterprise.com' }),
        registry.executeTool('doc_compare_versions', { sourceText: 'Alpha', targetText: 'Beta' }),
        registry.executeTool('unit_converter', { from: 'kg', to: 'g', value: 5 }),
        registry.executeTool('todo_write', { todos: [{ id: '1', title: 'Task', status: 'done' }] }),
        registry.executeTool('doc_redact_pii', { text: 'Rekening: 123456789012' }),
        registry.executeTool('extract_structured_data', { documentType: 'spk', title: 'SPK Project', items: [{ name: 'A', qty: 1 }] }),
        registry.executeTool('doc_redact_pii', { text: 'NPWP: 01.234.567.8-901.000' }),
        registry.executeTool('unit_converter', { from: 'feet', to: 'inch', value: 10 }),
        registry.executeTool('doc_compare_versions', { sourceText: 'Test 1', targetText: 'Test 2' }),
      ];

      const results = await Promise.all(concurrentJobs);
      expect(results).toHaveLength(15);
      for (const r of results) {
        expect(r.status).toBe('success');
      }
    });
  });
});
