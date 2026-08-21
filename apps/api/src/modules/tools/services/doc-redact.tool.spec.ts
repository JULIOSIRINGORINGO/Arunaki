import { describe, it, expect } from 'vitest';
import { DocRedactTool } from './doc-redact.tool.js';

describe('DocRedactTool', () => {
  const tool = new DocRedactTool();

  it('redacts Indonesian NIK/KTP (16-digit)', () => {
    const text = 'NIK: 3271234567890001 dan nama Budi';
    const result = tool.redact(text);

    expect(result.status).toBe('success');
    expect(result.data.totalRedacted).toBeGreaterThanOrEqual(1);
    expect(result.data.redactedText).not.toContain('3271234567890001');
    const nikDetection = result.data.detections.find(
      (d: any) => d.type === 'nik_ktp',
    );
    expect(nikDetection).toBeDefined();
    expect(nikDetection.count).toBeGreaterThanOrEqual(1);
  });

  it('redacts Indonesian phone numbers (08xx format)', () => {
    const text = 'Hubungi 081234567890 atau +6282198765432';
    const result = tool.redact(text);

    expect(result.status).toBe('success');
    expect(result.data.totalRedacted).toBeGreaterThanOrEqual(1);
    expect(result.data.redactedText).not.toContain('081234567890');
  });

  it('redacts email addresses', () => {
    const text = 'Email: budi.setiawan@example.com, CC: admin@company.co.id';
    const result = tool.redact(text);

    expect(result.status).toBe('success');
    const emailDetection = result.data.detections.find(
      (d: any) => d.type === 'email',
    );
    expect(emailDetection).toBeDefined();
    expect(emailDetection.count).toBeGreaterThanOrEqual(2);
    expect(result.data.redactedText).not.toContain('budi.setiawan@example.com');
  });

  it('returns no detections for clean text', () => {
    const text = 'Ini adalah teks biasa tanpa data sensitif apapun.';
    const result = tool.redact(text);

    expect(result.status).toBe('success');
    expect(result.data.totalRedacted).toBe(0);
    expect(result.data.redactedText).toBe(text);
  });

  it('supports scan-only mode without modification', () => {
    const text = 'NIK: 3271234567890001';
    const result = tool.scan(text);

    expect(result.status).toBe('success');
    expect(result.data.totalFound).toBeGreaterThanOrEqual(1);
    // scan mode should NOT return a modified text
    expect(result.data.redactedText).toBeUndefined();
  });

  it('supports filtering by specific PII patterns', () => {
    const text = 'NIK: 3271234567890001 Email: budi@test.com';
    const result = tool.redact(text, { patterns: ['email'] });

    expect(result.status).toBe('success');
    // Only email should be redacted
    const emailDet = result.data.detections.find(
      (d: any) => d.type === 'email',
    );
    expect(emailDet).toBeDefined();
    // NIK should NOT be detected (pattern not selected)
    const nikDet = result.data.detections.find(
      (d: any) => d.type === 'nik_ktp',
    );
    expect(nikDet).toBeUndefined();
  });

  it('returns error for empty input', () => {
    const result = tool.redact('');
    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('EMPTY_INPUT');
  });
});
