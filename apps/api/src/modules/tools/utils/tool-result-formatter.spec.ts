import { describe, expect, it } from 'vitest';
import { ToolResultFormatter } from './tool-result-formatter.js';

describe('ToolResultFormatter', () => {
  it('returns full read content to the model within the context limit', () => {
    expect(
      ToolResultFormatter.formatForLlm('read', {
        status: 'success',
        data: { content: 'full document content' },
        preview: 'short preview',
      }),
    ).toContain('full document content');
  });

  it('keeps non-read results on their preview', () => {
    expect(
      ToolResultFormatter.formatForLlm('list', {
        status: 'success',
        data: { content: 'hidden content' },
        preview: 'file list',
      }),
    ).toBe('[TOOL_SUCCESS] list: file list');
  });
});
