import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PdfStampTool } from './pdf-stamp.tool.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('PdfStampTool', () => {
  const tool = new PdfStampTool();
  let tmpDir: string;
  let samplePdf: string;
  let samplePng: string;

  beforeAll(async () => {
    tmpDir = path.join(os.tmpdir(), `arunaki-stamp-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    // Create a 2-page test PDF
    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.create();
    doc.addPage([595, 842]);
    doc.addPage([595, 842]);
    const pdfBytes = await doc.save();
    samplePdf = path.join(tmpDir, 'test.pdf');
    fs.writeFileSync(samplePdf, pdfBytes);

    // Create a minimal 1x1 transparent PNG
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    samplePng = path.join(tmpDir, 'signature.png');
    fs.writeFileSync(samplePng, Buffer.from(pngBase64, 'base64'));
  });

  afterAll(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('stamps an image onto the last page by default', async () => {
    const output = path.join(tmpDir, 'stamped_last.pdf');
    const result = await tool.stampImage(samplePdf, samplePng, output);

    expect(result.status).toBe('success');
    expect(result.data.targetPage).toBe(2); // 2-page doc -> page 2
    expect(result.data.stampImage).toBe('signature.png');
    expect(fs.existsSync(output)).toBe(true);
  });

  it('stamps onto a specific page with preset position', async () => {
    const output = path.join(tmpDir, 'stamped_p1_center.pdf');
    const result = await tool.stampImage(samplePdf, samplePng, output, {
      page: 1,
      position: 'center',
      width: 100,
      height: 50,
      opacity: 0.9,
    });

    expect(result.status).toBe('success');
    expect(result.data.targetPage).toBe(1);
    expect(result.data.position.width).toBe(100);
    expect(fs.existsSync(output)).toBe(true);
  });

  it('returns error when PDF file is missing', async () => {
    const result = await tool.stampImage(
      path.join(tmpDir, 'nonexistent.pdf'),
      samplePng,
      path.join(tmpDir, 'out.pdf'),
    );
    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('FILE_NOT_FOUND');
  });

  it('returns error when stamp image file is missing', async () => {
    const result = await tool.stampImage(
      samplePdf,
      path.join(tmpDir, 'missing.png'),
      path.join(tmpDir, 'out.pdf'),
    );
    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('IMAGE_NOT_FOUND');
  });
});
