import { describe, it, expect } from 'vitest';
import { DocCompareTool } from './doc-compare.tool.js';

describe('DocCompareTool', () => {
  const tool = new DocCompareTool();

  it('detects identical documents with 100% similarity', () => {
    const text = 'Line 1\nLine 2\nLine 3';
    const result = tool.compare(text, text, 'V1', 'V2');

    expect(result.status).toBe('success');
    expect(result.data.similarityPercent).toBe(100);
    expect(result.data.added).toBe(0);
    expect(result.data.removed).toBe(0);
    expect(result.preview).toContain('no differences found');
  });

  it('detects added and removed lines', () => {
    const source = 'Line A\nLine B\nLine C';
    const target = 'Line A\nLine D\nLine C';
    const result = tool.compare(source, target, 'Original', 'Modified');

    expect(result.status).toBe('success');
    expect(result.data.added).toBeGreaterThan(0);
    expect(result.data.removed).toBeGreaterThan(0);
    expect(result.data.similarityPercent).toBeLessThan(100);
    expect(result.preview).toContain('Added');
    expect(result.preview).toContain('Removed');
  });

  it('handles empty vs non-empty document', () => {
    const result = tool.compare('', 'New content\nSecond line', 'Empty', 'New');

    expect(result.status).toBe('success');
    expect(result.data.added).toBe(2);
    // Empty string splits to [''] — 1 "empty" line that gets removed
    expect(result.data.removed).toBe(1);
  });

  it('returns error for both empty documents', () => {
    const result = tool.compare('', '', 'A', 'B');
    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('EMPTY_DOCS');
  });

  it('calculates similarity percentage correctly', () => {
    const source = 'A\nB\nC\nD\nE';
    const target = 'A\nB\nC\nX\nY';
    const result = tool.compare(source, target);

    // 3 of 5 lines unchanged = ~60%
    expect(result.data.similarityPercent).toBe(60);
    expect(result.data.unchanged).toBe(3);
  });

  it('generates Markdown report with document names', () => {
    const source = 'Clause 1: Payment terms net 30';
    const target = 'Clause 1: Payment terms net 60';
    const result = tool.compare(source, target, 'Contract_v1.docx', 'Contract_v2.docx');

    expect(result.preview).toContain('Contract_v1.docx');
    expect(result.preview).toContain('Contract_v2.docx');
    expect(result.preview).toContain('Comparison Report');
  });
});
