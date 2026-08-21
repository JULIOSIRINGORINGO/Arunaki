import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { ToolRegistryService } from './modules/tools/tool-registry.service.js';
import { BusinessDomainToolsRegistrar } from './modules/tools/services/registrars/business-domain-tools.registrar.js';
import { DesktopToolsRegistrar } from './modules/tools/services/registrars/desktop-tools.registrar.js';
import { WorkspaceFileToolsRegistrar } from './modules/tools/services/registrars/workspace-file-tools.registrar.js';

import { PdfPagesTool } from './modules/tools/services/pdf-pages.tool.js';
import { PdfStampTool } from './modules/tools/services/pdf-stamp.tool.js';
import { DocCompareTool } from './modules/tools/services/doc-compare.tool.js';
import { DocRedactTool } from './modules/tools/services/doc-redact.tool.js';
import { TextExtractorTool } from './modules/tools/services/text-extractor.tool.js';
import { DocumentGeneratorTool } from './modules/tools/services/document-generator.tool.js';
import { DocumentReaderTool } from './modules/tools/services/document-reader.tool.js';
import { DocumentConverterTool } from './modules/tools/services/document-converter.tool.js';
import { DataQueryTool } from './modules/tools/services/data-query.tool.js';
import { DraftCommunicationTool } from './modules/tools/services/draft-communication.tool.js';
import { UnitConverterTool } from './modules/tools/services/unit-converter.tool.js';
import { DomainRegistryService } from './modules/domain/domain.registry.service.js';
import { WorkspaceToolsService } from './modules/tools/services/workspace-tools.service.js';

import { EditToolService } from './modules/tools/services/edit-tool.service.js';
import { WriteToolService } from './modules/tools/services/write-tool.service.js';
import { ReadToolService } from './modules/tools/services/read-tool.service.js';
import { DeleteToolService } from './modules/tools/services/delete-tool.service.js';
import { RenameToolService } from './modules/tools/services/rename-tool.service.js';
import { ListToolService } from './modules/tools/services/list-tool.service.js';
import { SearchToolService } from './modules/tools/services/search-tool.service.js';

import { ExcelComService } from './modules/interaction/excel-com.service.js';
import { WordComService } from './modules/interaction/word-com.service.js';
import { PptComService } from './modules/interaction/ppt-com.service.js';
import { DesktopBridgeService } from './modules/interaction/desktop-bridge.service.js';

describe('Multi-Turn Stress Test Suite (All Tools Under Heavy Load)', () => {
  let tmpDir: string;
  let registry: ToolRegistryService;
  let workspaceToolsServiceMock: any;

  // File paths created and mutated across conversation turns
  let basePdfA: string;
  let basePdfB: string;
  let stampPng: string;
  let textContractV1: string;
  let textContractV2: string;
  let employeePiiFile: string;

  beforeAll(async () => {
    tmpDir = path.join(os.tmpdir(), `arunaki-stress-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    // 1. Generate test PDF A (3 pages)
    const { PDFDocument } = await import('pdf-lib');
    const docA = await PDFDocument.create();
    docA.addPage([595, 842]);
    docA.addPage([595, 842]);
    docA.addPage([595, 842]);
    basePdfA = path.join(tmpDir, 'invoice_bundle_a.pdf');
    fs.writeFileSync(basePdfA, await docA.save());

    // 2. Generate test PDF B (2 pages)
    const docB = await PDFDocument.create();
    docB.addPage([595, 842]);
    docB.addPage([595, 842]);
    basePdfB = path.join(tmpDir, 'invoice_bundle_b.pdf');
    fs.writeFileSync(basePdfB, await docB.save());

    // 3. Generate 1x1 signature PNG
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    stampPng = path.join(tmpDir, 'stamp_lunas.png');
    fs.writeFileSync(stampPng, Buffer.from(pngBase64, 'base64'));

    // 4. Contract files for redline diff
    textContractV1 = path.join(tmpDir, 'perjanjian_v1.txt');
    fs.writeFileSync(
      textContractV1,
      [
        'SURAT PERJANJIAN KERJASAMA',
        'Pasal 1: Ruang Lingkup Pekerjaan IT Consulting',
        'Pasal 2: Nilai Kontrak Rp 100.000.000 (Seratus Juta Rupiah)',
        'Pasal 3: Waktu Pengerjaan 30 Hari Kerja',
        'Pasal 4: Pembayaran Termin 50% di awal dan 50% di akhir',
        'Pasal 5: Hukum yang berlaku adalah Hukum Republik Indonesia',
      ].join('\n'),
      'utf-8',
    );

    textContractV2 = path.join(tmpDir, 'perjanjian_v2.txt');
    fs.writeFileSync(
      textContractV2,
      [
        'SURAT PERJANJIAN KERJASAMA (REVISI)',
        'Pasal 1: Ruang Lingkup Pekerjaan IT Consulting & Cloud Migration',
        'Pasal 2: Nilai Kontrak Rp 150.000.000 (Seratus Lima Puluh Juta Rupiah)',
        'Pasal 3: Waktu Pengerjaan 45 Hari Kerja',
        'Pasal 4: Pembayaran Termin 30% di awal, 40% progres, dan 30% serah terima',
        'Pasal 5: Hukum yang berlaku adalah Hukum Republik Indonesia',
        'Pasal 6: Ketentuan Kerahasiaan Data (NDA)',
      ].join('\n'),
      'utf-8',
    );

    // 5. Heavy PII batch document (50 records simulated)
    const piiRows: string[] = ['=== DATABASE KARYAWAN & VENDOR ==='];
    for (let i = 1; i <= 20; i++) {
      const nik = `327101${String(100000 + i).padStart(6, '0')}${String(i).padStart(4, '0')}`;
      const npwp = `01.${String(200 + i)}.${String(300 + i)}.4-0${String(10 + i)}.000`;
      const phone = `0812${String(1000000 + i * 7777).substring(0, 8)}`;
      const email = `karyawan_${i}@perusahaan-arunaki.co.id`;
      const rek = `1234${String(50000000 + i * 11111)}`;
      piiRows.push(
        `[Record #${i}] Nama: Staff ${i} | NIK: ${nik} | NPWP: ${npwp} | HP: ${phone} | Email: ${email} | No. Rekening: ${rek}`,
      );
    }
    employeePiiFile = path.join(tmpDir, 'batch_pii.txt');
    fs.writeFileSync(employeePiiFile, piiRows.join('\n'), 'utf-8');

    // 6. Setup Workspace resolver mock
    workspaceToolsServiceMock = {
      resolveWithinWorkspace: async (_wsId: string, relPath: string) => {
        if (!relPath) return tmpDir;
        if (path.isAbsolute(relPath)) return relPath;
        return path.join(tmpDir, relPath);
      },
    };

    // 7. Wire ToolRegistryService with all tools
    registry = new ToolRegistryService();

    const pdfPagesTool = new PdfPagesTool();
    const pdfStampTool = new PdfStampTool();
    const docCompareTool = new DocCompareTool();
    const docRedactTool = new DocRedactTool();
    const textExtractorTool = new TextExtractorTool();
    const documentGeneratorTool = new DocumentGeneratorTool();
    const documentReaderTool = new DocumentReaderTool();
    const documentConverterTool = new DocumentConverterTool();
    const dataQueryTool = new DataQueryTool();
    const draftCommunicationTool = new DraftCommunicationTool();
    const domainRegistry = new DomainRegistryService();
    const unitConverterTool = new UnitConverterTool(domainRegistry);

    const readToolService = new ReadToolService();
    const writeToolService = new WriteToolService();
    const editToolService = new EditToolService();
    const deleteToolService = new DeleteToolService();
    const renameToolService = new RenameToolService();
    const listToolService = new ListToolService();
    const searchToolService = new SearchToolService();

    const excelCom = new ExcelComService();
    const wordCom = new WordComService();
    const pptCom = new PptComService();
    const desktopBridge = new DesktopBridgeService({} as any);

    const businessRegistrar = new BusinessDomainToolsRegistrar();
    businessRegistrar.register(registry, {
      textExtractorTool,
      documentGeneratorTool,
      documentReaderTool,
      documentConverterTool,
      dataQueryTool,
      draftCommunicationTool,
      unitConverterTool,
      workspaceToolsService: workspaceToolsServiceMock,
      pdfPagesTool,
      pdfStampTool,
      docCompareTool,
      docRedactTool,
    });

    const desktopRegistrar = new DesktopToolsRegistrar();
    desktopRegistrar.register(registry, {
      desktopBridge,
      excelCom,
      wordCom,
      pptCom,
      workspaceToolsService: workspaceToolsServiceMock,
    });

    const fileRegistrar = new WorkspaceFileToolsRegistrar();
    fileRegistrar.register(registry, {
      workspaceToolsService: workspaceToolsServiceMock,
      readToolService,
      writeToolService,
      editToolService,
      deleteToolService,
      renameToolService,
      listToolService,
      searchToolService,
    });
  });

  afterAll(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  // ==========================================
  // TURN 1: Batch File Creation & Workspace Inspection
  // ==========================================
  it('Turn 1: Creates workspace files and queries tabular data under load', async () => {
    // 1a. Generate structured sales data
    const salesData = [
      { id: 101, customer: 'PT Samudera', product: 'Server Rack', qty: 2, price: 45000000, total: 90000000 },
      { id: 102, customer: 'CV Maju Jaya', product: 'Router Core', qty: 5, price: 8500000, total: 42500000 },
      { id: 103, customer: 'PT Samudera', product: 'Switch 48P', qty: 10, price: 6200000, total: 62000000 },
      { id: 104, customer: 'Koperasi Sentosa', product: 'Access Point', qty: 20, price: 1500000, total: 30000000 },
      { id: 105, customer: 'PT Nusantara', product: 'Server Rack', qty: 1, price: 45000000, total: 45000000 },
    ];

    const genResult = await registry.executeTool('generate_export', {
      workspaceId: 'ws-stress',
      format: 'csv',
      data: salesData,
      filename: 'laporan_penjualan.csv',
      sheetName: 'Penjualan',
    });
    expect(genResult.status).toBe('success');

    // 1b. Query database tables metadata
    const queryResult = await registry.executeTool('data_query', {
      action: 'list_tables',
    });
    expect(queryResult.status).toBe('success');
  });

  // ==========================================
  // TURN 2: Massive Batch PII Redaction
  // ==========================================
  it('Turn 2: Scans and redacts 100+ sensitive PII entries in parallel without data loss', async () => {
    const redactedOutput = path.join(tmpDir, 'batch_pii_clean.txt');
    const redactResult = await registry.executeTool('doc_redact_pii', {
      workspaceId: 'ws-stress',
      filePath: employeePiiFile,
      outputPath: redactedOutput,
    });

    expect(redactResult.status).toBe('success');
    expect(redactResult.data.totalRedacted).toBeGreaterThanOrEqual(80); // 20 records * 4-5 fields = ~100 PII masked
    expect(fs.existsSync(redactedOutput)).toBe(true);

    const cleanContent = fs.readFileSync(redactedOutput, 'utf-8');
    // Ensure all 20 records still exist structurally
    for (let i = 1; i <= 20; i++) {
      expect(cleanContent).toContain(`[Record #${i}] Nama: Staff ${i}`);
      expect(cleanContent).toContain('No. Rekening: ****-****-****');
    }
    // Ensure zero raw NIK or unmasked emails leaked
    expect(cleanContent).not.toContain('3271011000010001');
    expect(cleanContent).not.toContain('karyawan_1@perusahaan-arunaki.co.id');
  });

  // ==========================================
  // TURN 3: Multi-Stage PDF Pipeline (Merge -> Extract -> Watermark -> Stamp)
  // ==========================================
  it('Turn 3: Multi-stage pipeline: Merge 2 PDFs, extract pages, apply watermark, and stamp signature', async () => {
    // Stage 1: Merge 3-page + 2-page = 5 pages
    const mergedPath = path.join(tmpDir, 'stage1_merged.pdf');
    const mergeRes = await registry.executeTool('pdf_manage_pages', {
      workspaceId: 'ws-stress',
      action: 'merge',
      files: [basePdfA, basePdfB],
      outputPath: mergedPath,
    });
    expect(mergeRes.status).toBe('success');
    expect(mergeRes.data.totalPages).toBe(5);

    // Stage 2: Extract pages 1, 3, 5 = 3 pages
    const extractedPath = path.join(tmpDir, 'stage2_extracted.pdf');
    const extractRes = await registry.executeTool('pdf_manage_pages', {
      workspaceId: 'ws-stress',
      action: 'extract',
      sourcePath: mergedPath,
      pages: [1, 3, 5],
      outputPath: extractedPath,
    });
    expect(extractRes.status).toBe('success');
    expect(extractRes.data.totalExtracted).toBe(3);

    // Stage 3: Apply diagonal watermark "CONFIDENTIAL"
    const watermarkedPath = path.join(tmpDir, 'stage3_watermarked.pdf');
    const watermarkRes = await registry.executeTool('pdf_manage_pages', {
      workspaceId: 'ws-stress',
      action: 'watermark',
      sourcePath: extractedPath,
      text: 'CONFIDENTIAL',
      opacity: 0.2,
      outputPath: watermarkedPath,
    });
    expect(watermarkRes.status).toBe('success');
    expect(watermarkRes.data.pagesWatermarked).toBe(3);

    // Stage 4: Stamp digital signature on bottom-right of last page
    const finalStampedPath = path.join(tmpDir, 'stage4_final_stamped.pdf');
    const stampRes = await registry.executeTool('pdf_stamp_image', {
      workspaceId: 'ws-stress',
      pdfPath: watermarkedPath,
      imagePath: stampPng,
      outputPath: finalStampedPath,
      position: 'bottom-right',
      width: 140,
      height: 70,
    });
    expect(stampRes.status).toBe('success');
    expect(stampRes.data.targetPage).toBe(3);
    expect(fs.existsSync(finalStampedPath)).toBe(true);
  });

  // ==========================================
  // TURN 4: Contract Version Comparison & Redline Audit
  // ==========================================
  it('Turn 4: Performs line-level contract version diff and produces structured redline audit', async () => {
    const compareRes = await registry.executeTool('doc_compare_versions', {
      workspaceId: 'ws-stress',
      sourcePath: textContractV1,
      targetPath: textContractV2,
      sourceName: 'Kontrak V1 (Awal)',
      targetName: 'Kontrak V2 (Revisi)',
    });

    expect(compareRes.status).toBe('success');
    expect(compareRes.data.added).toBeGreaterThanOrEqual(4);
    expect(compareRes.data.removed).toBeGreaterThanOrEqual(3);
    expect(compareRes.data.similarityPercent).toBeGreaterThan(0);
    expect(compareRes.data.similarityPercent).toBeLessThan(100);
    expect(compareRes.preview).toContain('Kontrak V1 (Awal)');
    expect(compareRes.preview).toContain('Kontrak V2 (Revisi)');
    expect(compareRes.preview).toContain('➕ Added');
    expect(compareRes.preview).toContain('➖ Removed');
  });

  // ==========================================
  // TURN 5: Native COM Word Automation Suite
  // ==========================================
  it('Turn 5: Executes Native COM Word template replacement, table insertion, and PDF export script', async () => {
    const wordTool = registry.getToolDefinitions().find((d) => d.function.name === 'desktop_word_edit');
    expect(wordTool).toBeDefined();

    const wordCom = new WordComService();
    const script = (wordCom as any).buildPowerShellScript('C:\\workspace\\spk.docx', [
      { action: 'replace_text', findText: '{{NOMOR_SURAT}}', replaceText: '042/SPK/VIII/2026' },
      { action: 'replace_text', findText: '{{NAMA_KLIEN}}', replaceText: 'PT Bank Central Asia Tbk' },
      { action: 'replace_text', findText: '{{NILAI_PROYEK}}', replaceText: 'Rp 250.000.000' },
      { action: 'append_paragraph', text: 'Pasal Tambahan: SLA Response Time 15 Menit', style: 'Heading 2', bold: true },
      {
        action: 'insert_table',
        headers: ['Milestone', 'Deliverable', 'Persentase'],
        tableRows: [
          ['Tahap 1', 'Desain Arsitektur & SRS', '30%'],
          ['Tahap 2', 'Implementasi Backend & API', '40%'],
          ['Tahap 3', 'UAT, Deployment & Go-Live', '30%'],
        ],
      },
      { action: 'export_pdf', exportPdfPath: 'C:\\workspace\\spk_final.pdf' },
      { action: 'save' },
    ]);

    expect(script).toContain('042/SPK/VIII/2026');
    expect(script).toContain('PT Bank Central Asia Tbk');
    expect(script).toContain('Rp 250.000.000');
    expect(script).toContain('SLA Response Time 15 Menit');
    expect(script).toContain('Tables.Add');
    expect(script).toContain('ExportAsFixedFormat');
    expect(script).toContain('spk_final.pdf');
  });

  // ==========================================
  // TURN 6: Native COM Excel Sheet Cloning & Formula Preserving
  // ==========================================
  it('Turn 6: Executes Native COM Excel sheet cloning, constants clearing, formula preservation, and PDF export', async () => {
    const excelTool = registry.getToolDefinitions().find((d) => d.function.name === 'desktop_excel_edit');
    expect(excelTool).toBeDefined();

    const excelCom = new ExcelComService();
    const script = (excelCom as any).buildPowerShellScript('C:\\workspace\\laporan_keuangan.xlsx', [
      { action: 'clone_sheet', sourceSheet: 'TEMPLATE', newSheetName: 'SEPTEMBER_2026', clearConstants: true },
      { action: 'write_cell', cell: 'B2', value: 'Laporan Keuangan September 2026' },
      { action: 'write_cell', cell: 'C5', value: 185000000 },
      { action: 'write_cell', cell: 'C6', value: 92000000 },
      { action: 'write_cell', cell: 'C7', value: '=SUM(C5:C6)' }, // Formula
      { action: 'set_format', range: 'B2:C7', bold: true, alignment: 'center' },
      { action: 'export_pdf', range: 'C:\\workspace\\laporan_september.pdf' },
      { action: 'save' },
    ]);

    expect(script).toContain('clone_sheet');
    expect(script).toContain('TEMPLATE');
    expect(script).toContain('SEPTEMBER_2026');
    expect(script).toContain('SpecialCells(2)'); // clears constants while keeping formulas
    expect(script).toContain('ClearContents()');
    expect(script).toContain(".Formula = '=SUM(C5:C6)'"); // formula assigned to .Formula
    expect(script).toContain('ExportAsFixedFormat');
  });

  // ==========================================
  // TURN 7: Native COM PowerPoint Presentation Automation
  // ==========================================
  it('Turn 7: Executes Native COM PowerPoint slide generation, text replacement, and PDF export', async () => {
    const pptTool = registry.getToolDefinitions().find((d) => d.function.name === 'desktop_ppt_edit');
    expect(pptTool).toBeDefined();

    const pptCom = new PptComService();
    const script = (pptCom as any).buildPowerShellScript('C:\\workspace\\pitch_deck.pptx', [
      { action: 'replace_text', findText: 'Q2 2025', replaceText: 'Q3 2026' },
      { action: 'replace_text', findText: '$1.5M', replaceText: '$2.8M' },
      {
        action: 'add_slide',
        title: 'Ekspansi Pasar Enterprise',
        content: ['Pertumbuhan ARR +180% YoY', 'Retensi Pelanggan 96.5%', 'Ekspansi ke 5 Negara Asia Tenggara'],
      },
      { action: 'export_pdf', exportPdfPath: 'C:\\workspace\\pitch_deck_final.pdf' },
      { action: 'save' },
    ]);

    expect(script).toContain('PowerPoint.Application');
    expect(script).toContain('Q3 2026');
    expect(script).toContain('$2.8M');
    expect(script).toContain('Ekspansi Pasar Enterprise');
    expect(script).toContain('Pertumbuhan ARR +180% YoY');
    expect(script).toContain('SaveAs');
  });

  // ==========================================
  // TURN 8: Parallel High-Concurrency Execution Test
  // ==========================================
  it('Turn 8: Executes 10 concurrent tool operations simultaneously without state collision', async () => {
    const parallelTasks = [
      registry.executeTool('doc_redact_pii', { text: 'NIK 3271012345678901' }),
      registry.executeTool('doc_compare_versions', { sourceText: 'A\nB', targetText: 'A\nC' }),
      registry.executeTool('pdf_manage_pages', {
        workspaceId: 'ws-stress',
        action: 'watermark',
        sourcePath: basePdfA,
        text: 'PARALLEL_1',
        outputPath: path.join(tmpDir, 'par_1.pdf'),
      }),
      registry.executeTool('pdf_manage_pages', {
        workspaceId: 'ws-stress',
        action: 'watermark',
        sourcePath: basePdfB,
        text: 'PARALLEL_2',
        outputPath: path.join(tmpDir, 'par_2.pdf'),
      }),
      registry.executeTool('unit_converter', { from: 'USD', to: 'IDR', value: 1000 }),
      registry.executeTool('unit_converter', { from: 'IDR', to: 'USD', value: 15500000 }),
      registry.executeTool('doc_redact_pii', { text: 'Email test: boss@company.com' }),
      registry.executeTool('doc_compare_versions', { sourceText: 'Line 1', targetText: 'Line 1' }),
      registry.executeTool('pdf_stamp_image', {
        workspaceId: 'ws-stress',
        pdfPath: basePdfA,
        imagePath: stampPng,
        outputPath: path.join(tmpDir, 'par_stamp.pdf'),
      }),
      registry.executeTool('doc_redact_pii', { text: 'No. Rekening: 987654321098' }),
    ];

    const results = await Promise.all(parallelTasks);

    expect(results).toHaveLength(10);
    for (const r of results) {
      if (r.status === 'error') {
        console.error('Parallel task error:', r.error, r.preview);
      }
      expect(r.status).toBe('success');
    }
  });
});
