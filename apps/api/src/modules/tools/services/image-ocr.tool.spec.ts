import { describe, it, expect } from 'vitest';
import { ImageOcrTool } from './image-ocr.tool.js';
import { DocumentReaderTool } from './document-reader.tool.js';

describe('Image OCR & Document Reader Tools', () => {
  it('ImageOcrTool should handle empty path gracefully', async () => {
    const ocr = new ImageOcrTool();
    const res = await ocr.recognizeText('');
    expect(res.status).toBe('error');
    expect(res.error?.code).toBe('EMPTY_PATH');
  });

  it('ImageOcrTool should handle non-existent file gracefully', async () => {
    const ocr = new ImageOcrTool();
    const res = await ocr.recognizeText('non_existent_image_12345.png');
    expect(res.status).toBe('error');
    expect(res.error?.code).toBe('FILE_NOT_FOUND');
  });

  it('DocumentReaderTool should handle non-existent image gracefully', async () => {
    const reader = new DocumentReaderTool();
    const res = await reader.readDocument('missing_image.png');
    expect(res.status).toBe('error');
    expect(res.error?.code).toBe('FILE_NOT_FOUND');
  });
});
