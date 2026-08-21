import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PdfPagesTool } from './pdf-pages.tool.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('PdfPagesTool', () => {
  const tool = new PdfPagesTool();
  let tmpDir: string;
  let samplePdfA: string;
  let samplePdfB: string;

  beforeAll(async () => {
    tmpDir = path.join(os.tmpdir(), `arunaki-pdf-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    // Create minimal valid PDFs using pdf-lib
    const { PDFDocument } = await import('pdf-lib');

    const docA = await PDFDocument.create();
    docA.addPage([595, 842]); // A4
    docA.addPage([595, 842]);
    const bytesA = await docA.save();
    samplePdfA = path.join(tmpDir, 'sample_a.pdf');
    fs.writeFileSync(samplePdfA, bytesA);

    const docB = await PDFDocument.create();
    docB.addPage([595, 842]);
    const bytesB = await docB.save();
    samplePdfB = path.join(tmpDir, 'sample_b.pdf');
    fs.writeFileSync(samplePdfB, bytesB);
  });

  afterAll(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it('merges 2 PDF files into one', async () => {
    const output = path.join(tmpDir, 'merged.pdf');
    const result = await tool.merge([samplePdfA, samplePdfB], output);

    expect(result.status).toBe('success');
    expect(result.data.totalPages).toBe(3); // 2 + 1
    expect(fs.existsSync(output)).toBe(true);
  });

  it('returns error when merging fewer than 2 files', async () => {
    const result = await tool.merge([samplePdfA], path.join(tmpDir, 'out.pdf'));
    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('INSUFFICIENT_FILES');
  });

  it('extracts specific pages from a PDF', async () => {
    const output = path.join(tmpDir, 'extracted.pdf');
    const result = await tool.extractPages(samplePdfA, [1], output);

    expect(result.status).toBe('success');
    expect(result.data.totalExtracted).toBe(1);
    expect(result.data.extractedPages).toEqual([1]);
    expect(fs.existsSync(output)).toBe(true);
  });

  it('handles invalid page numbers gracefully', async () => {
    const output = path.join(tmpDir, 'invalid_extract.pdf');
    const result = await tool.extractPages(samplePdfA, [99, 100], output);

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('INVALID_PAGES');
  });

  it('applies watermark to all pages', async () => {
    const output = path.join(tmpDir, 'watermarked.pdf');
    const result = await tool.watermark(
      samplePdfA,
      'CONFIDENTIAL',
      output,
      { opacity: 0.2, fontSize: 50 },
    );

    expect(result.status).toBe('success');
    expect(result.data.watermarkText).toBe('CONFIDENTIAL');
    expect(result.data.pagesWatermarked).toBe(2);
    expect(fs.existsSync(output)).toBe(true);
  });

  it('returns error for non-existent source file', async () => {
    const result = await tool.watermark(
      '/nonexistent/file.pdf',
      'DRAFT',
      path.join(tmpDir, 'out.pdf'),
    );
    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('FILE_NOT_FOUND');
  });
});
