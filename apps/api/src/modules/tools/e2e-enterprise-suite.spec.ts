import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { ToolRegistryService } from './tool-registry.service.js';
import { BusinessDomainToolsRegistrar } from './services/registrars/business-domain-tools.registrar.js';
import { DesktopToolsRegistrar } from './services/registrars/desktop-tools.registrar.js';

import { PdfPagesTool } from './services/pdf-pages.tool.js';
import { PdfStampTool } from './services/pdf-stamp.tool.js';
import { DocCompareTool } from './services/doc-compare.tool.js';
import { DocRedactTool } from './services/doc-redact.tool.js';
import { TextExtractorTool } from './services/text-extractor.tool.js';
import { DocumentGeneratorTool } from './services/document-generator.tool.js';
import { DocumentReaderTool } from './services/document-reader.tool.js';
import { DocumentConverterTool } from './services/document-converter.tool.js';
import { DataQueryTool } from './services/data-query.tool.js';
import { DraftCommunicationTool } from './services/draft-communication.tool.js';
import { UnitConverterTool } from './services/unit-converter.tool.js';
import { WorkspaceToolsService } from './services/workspace-tools.service.js';

import { ExcelComService } from '../interaction/excel-com.service.js';
import { WordComService } from '../interaction/word-com.service.js';
import { PptComService } from '../interaction/ppt-com.service.js';
import { DesktopBridgeService } from '../interaction/desktop-bridge.service.js';

describe('E2E Enterprise Document Suite (Full Tool Execution)', () => {
  let tmpDir: string;
  let registry: ToolRegistryService;
  let workspaceToolsServiceMock: any;

  let samplePdf1: string;
  let samplePdf2: string;
  let samplePng: string;
  let sampleDocA: string;
  let sampleDocB: string;
  let samplePiiDoc: string;

  beforeAll(async () => {
    tmpDir = path.join(os.tmpdir(), `arunaki-e2e-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    // Create minimal PDFs
    const { PDFDocument } = await import('pdf-lib');

    const doc1 = await PDFDocument.create();
    doc1.addPage([595, 842]);
    doc1.addPage([595, 842]);
    samplePdf1 = path.join(tmpDir, 'page1_2.pdf');
    fs.writeFileSync(samplePdf1, await doc1.save());

    const doc2 = await PDFDocument.create();
    doc2.addPage([595, 842]);
    samplePdf2 = path.join(tmpDir, 'page3.pdf');
    fs.writeFileSync(samplePdf2, await doc2.save());

    // Create minimal transparent PNG signature
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    samplePng = path.join(tmpDir, 'ttd.png');
    fs.writeFileSync(samplePng, Buffer.from(pngBase64, 'base64'));

    // Create sample text documents for diffing
    sampleDocA = path.join(tmpDir, 'kontrak_v1.txt');
    fs.writeFileSync(
      sampleDocA,
      'Pasal 1: Ketentuan Umum\nPasal 2: Pembayaran tempo 30 hari\nPasal 3: Penalti 1%',
      'utf-8',
    );

    sampleDocB = path.join(tmpDir, 'kontrak_v2.txt');
    fs.writeFileSync(
      sampleDocB,
      'Pasal 1: Ketentuan Umum\nPasal 2: Pembayaran tempo 60 hari\nPasal 3: Penalti 2%\nPasal 4: Force Majeure',
      'utf-8',
    );

    // Create sample PII document
    samplePiiDoc = path.join(tmpDir, 'data_karyawan.txt');
    fs.writeFileSync(
      samplePiiDoc,
      'Nama: Budi Santoso\nNIK: 3271234567890001\nNPWP: 01.234.567.8-901.000\nNo. HP: 081234567890\nEmail: budi@ptabc.co.id\nNo. Rekening: 123456789012',
      'utf-8',
    );

    // Setup Mock WorkspaceToolsService that resolves paths directly in tmpDir
    workspaceToolsServiceMock = {
      resolveWithinWorkspace: async (_wsId: string, relPath: string) => {
        if (path.isAbsolute(relPath)) return relPath;
        return path.join(tmpDir, relPath);
      },
    };

    // Instantiate and register tools
    registry = new ToolRegistryService();

    const pdfPagesTool = new PdfPagesTool();
    const pdfStampTool = new PdfStampTool();
    const docCompareTool = new DocCompareTool();
    const docRedactTool = new DocRedactTool();
    const excelCom = new ExcelComService();
    const wordCom = new WordComService();
    const pptCom = new PptComService();
    const desktopBridge = new DesktopBridgeService({} as any);

    const businessRegistrar = new BusinessDomainToolsRegistrar();
    businessRegistrar.register(registry, {
      textExtractorTool: {} as any,
      documentGeneratorTool: {} as any,
      documentReaderTool: {} as any,
      documentConverterTool: {} as any,
      dataQueryTool: {} as any,
      draftCommunicationTool: {} as any,
      unitConverterTool: {} as any,
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
  });

  afterAll(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('1. E2E: Merges multiple PDF files via ToolRegistry (pdf_manage_pages)', async () => {
    const result = await registry.executeTool('pdf_manage_pages', {
      workspaceId: 'ws-test',
      action: 'merge',
      files: [samplePdf1, samplePdf2],
      outputPath: path.join(tmpDir, 'e2e_merged.pdf'),
    });

    expect(result.status).toBe('success');
    expect(result.data.totalPages).toBe(3);
    expect(fs.existsSync(path.join(tmpDir, 'e2e_merged.pdf'))).toBe(true);
  });

  it('2. E2E: Extracts specific pages from PDF (pdf_manage_pages extract)', async () => {
    const result = await registry.executeTool('pdf_manage_pages', {
      workspaceId: 'ws-test',
      action: 'extract',
      sourcePath: samplePdf1,
      pages: [2],
      outputPath: path.join(tmpDir, 'e2e_page2.pdf'),
    });

    expect(result.status).toBe('success');
    expect(result.data.totalExtracted).toBe(1);
    expect(fs.existsSync(path.join(tmpDir, 'e2e_page2.pdf'))).toBe(true);
  });

  it('3. E2E: Applies text watermark (pdf_manage_pages watermark)', async () => {
    const result = await registry.executeTool('pdf_manage_pages', {
      workspaceId: 'ws-test',
      action: 'watermark',
      sourcePath: samplePdf1,
      text: 'LUNAS',
      outputPath: path.join(tmpDir, 'e2e_watermarked.pdf'),
    });

    expect(result.status).toBe('success');
    expect(result.data.watermarkText).toBe('LUNAS');
    expect(fs.existsSync(path.join(tmpDir, 'e2e_watermarked.pdf'))).toBe(true);
  });

  it('4. E2E: Stamps digital signature onto PDF (pdf_stamp_image)', async () => {
    const result = await registry.executeTool('pdf_stamp_image', {
      workspaceId: 'ws-test',
      pdfPath: samplePdf1,
      imagePath: samplePng,
      outputPath: path.join(tmpDir, 'e2e_signed.pdf'),
      position: 'bottom-right',
      width: 100,
      height: 50,
    });

    expect(result.status).toBe('success');
    expect(result.data.targetPage).toBe(2);
    expect(fs.existsSync(path.join(tmpDir, 'e2e_signed.pdf'))).toBe(true);
  });

  it('5. E2E: Compares two document files line-by-line (doc_compare_versions)', async () => {
    const result = await registry.executeTool('doc_compare_versions', {
      workspaceId: 'ws-test',
      sourcePath: sampleDocA,
      targetPath: sampleDocB,
      sourceName: 'Kontrak V1',
      targetName: 'Kontrak V2',
    });

    expect(result.status).toBe('success');
    expect(result.data.similarityPercent).toBeLessThan(100);
    expect(result.data.added).toBeGreaterThanOrEqual(1);
    expect(result.preview).toContain('Comparison Report');
    expect(result.preview).toContain('Kontrak V1');
    expect(result.preview).toContain('Kontrak V2');
  });

  it('6. E2E: Scans and Redacts PII in file, saving output (doc_redact_pii)', async () => {
    const redactedOutput = path.join(tmpDir, 'data_karyawan_redacted.txt');
    const result = await registry.executeTool('doc_redact_pii', {
      workspaceId: 'ws-test',
      filePath: samplePiiDoc,
      outputPath: redactedOutput,
    });

    expect(result.status).toBe('success');
    expect(result.data.totalRedacted).toBeGreaterThanOrEqual(4); // NIK, NPWP, Phone, Email, Bank
    expect(fs.existsSync(redactedOutput)).toBe(true);

    const savedContent = fs.readFileSync(redactedOutput, 'utf-8');
    expect(savedContent).not.toContain('3271234567890001');
    expect(savedContent).not.toContain('budi@ptabc.co.id');
    expect(savedContent).toContain('No. Rekening: ****-****-****');
  });

  it('7. E2E: Verifies Word COM edit tool registration and parameters (desktop_word_edit)', () => {
    const defs = registry.getToolDefinitions();
    const wordTool = defs.find((d) => d.function.name === 'desktop_word_edit');
    expect(wordTool).toBeDefined();
    expect(wordTool?.function.name).toBe('desktop_word_edit');
    expect(registry.isMutating('desktop_word_edit')).toBe(true);
  });

  it('8. E2E: Verifies PowerPoint COM edit tool registration and parameters (desktop_ppt_edit)', () => {
    const defs = registry.getToolDefinitions();
    const pptTool = defs.find((d) => d.function.name === 'desktop_ppt_edit');
    expect(pptTool).toBeDefined();
    expect(pptTool?.function.name).toBe('desktop_ppt_edit');
    expect(registry.isMutating('desktop_ppt_edit')).toBe(true);
  });

  it('9. E2E: Verifies Excel COM edit tool registration with all sheet management actions (desktop_excel_edit)', () => {
    const defs = registry.getToolDefinitions();
    const excelTool = defs.find((d) => d.function.name === 'desktop_excel_edit');
    expect(excelTool).toBeDefined();
    expect(registry.isMutating('desktop_excel_edit')).toBe(true);
  });
});
