import { describe, it, expect } from 'vitest';
import {
  repairToolCalls,
  parseCallObject,
  repairJson,
} from '../src/modules/ai/tool-call-repair.js';

describe('ToolCallRepair (Universal Mature Harness)', () => {
  it('should parse native XML function tags', () => {
    const text =
      '<function_call name="edit">{"filePath": "laporan.txt", "oldString": "100", "newString": "200"}</function_call>';
    const calls = repairToolCalls(text);
    expect(calls.length).toBe(1);
    expect(calls[0].function.name).toBe('edit');
    const args = JSON.parse(calls[0].function.arguments);
    expect(args.filePath).toBe('laporan.txt');
    expect(args.newString).toBe('200');
  });

  it('should parse DeepSeek / OpenCode slash and colon function tags', () => {
    const text1 =
      '<function/edit>{"filePath": "rekap.txt", "patchText": "*** Update"}</function>';
    const calls1 = repairToolCalls(text1);
    expect(calls1.length).toBe(1);
    expect(calls1[0].function.name).toBe('edit');

    const text2 = '<function:read>{"filePath": "file.txt"}</function>';
    const calls2 = repairToolCalls(text2);
    expect(calls2.length).toBe(1);
    expect(calls2[0].function.name).toBe('read');
  });

  it('should parse markdown fenced JSON codeblocks from open-weights models (GPT-OSS-120B)', () => {
    const text = `Tentu, saya akan mengedit dokumen laporan:
\`\`\`json
{
  "name": "edit",
  "filePath": "REKAPAN TERBARU2.txt",
  "oldString": "TOTAL = 4.250RB",
  "newString": "TOTAL = 5.000RB"
}
\`\`\``;
    const calls = repairToolCalls(text);
    expect(calls.length).toBe(1);
    expect(calls[0].function.name).toBe('edit');
    const args = JSON.parse(calls[0].function.arguments);
    expect(args.filePath).toBe('REKAPAN TERBARU2.txt');
    expect(args.newString).toBe('TOTAL = 5.000RB');
  });

  it('should parse alias keys like "tool" and "parameters"', () => {
    const text = `\`\`\`json
{
  "tool": "edit",
  "parameters": {
    "filePath": "data.csv",
    "oldString": "A,B",
    "newString": "A,C"
  }
}
\`\`\``;
    const calls = repairToolCalls(text);
    expect(calls.length).toBe(1);
    expect(calls[0].function.name).toBe('edit');
    const args = JSON.parse(calls[0].function.arguments);
    expect(args.filePath).toBe('data.csv');
  });

  it('should parse flat JSON objects where parameters are at top-level', () => {
    const flatObj = {
      action: 'edit',
      filePath: 'laporan.txt',
      oldString: 'old',
      newString: 'new',
    };
    const parsed = parseCallObject(flatObj);
    expect(parsed).not.toBeNull();
    expect(parsed?.name).toBe('edit');
    expect((parsed?.args as any).filePath).toBe('laporan.txt');
  });

  it('should parse ReAct Action and Action Input syntax', () => {
    const text = `Thought: I should update the file.
Action: edit
Action Input: {"filePath": "REKAPAN.txt", "oldString": "foo", "newString": "bar"}`;
    const calls = repairToolCalls(text);
    expect(calls.length).toBe(1);
    expect(calls[0].function.name).toBe('edit');
    const args = JSON.parse(calls[0].function.arguments);
    expect(args.filePath).toBe('REKAPAN.txt');
  });

  it('should heal trailing commas and malformed JSON safely', () => {
    const raw = '{"name": "read", "filePath": "test.txt",}';
    const cleaned = repairJson(raw);
    expect(cleaned).toBe('{"name": "read", "filePath": "test.txt"}');
  });
});
