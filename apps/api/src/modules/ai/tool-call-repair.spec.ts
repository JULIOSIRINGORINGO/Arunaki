import { describe, it, expect } from 'vitest';
import { repairToolCalls, repairJson, repairOneToolCall } from './tool-call-repair.js';

describe('tool-call-repair', () => {
  it('repairs JSON fenced tool call', () => {
    const content = '```json\n{"name": "read_workspace_file", "arguments": {"filePath": "a.txt"}}\n```';
    const calls = repairToolCalls(content);
    expect(calls).toHaveLength(1);
    expect(calls[0].function.name).toBe('read_workspace_file');
    expect(JSON.parse(calls[0].function.arguments).filePath).toBe('a.txt');
  });

  it('repairs <tool_call> XML tag', () => {
    const content = 'Saya cek dulu <tool_call>{"name":"list_workspace_files","arguments":{"workspaceId":"w1"}}</tool_call>';
    const calls = repairToolCalls(content);
    expect(calls).toHaveLength(1);
    expect(calls[0].function.name).toBe('list_workspace_files');
  });

  it('repairs <function_call name=...> attribute form', () => {
    const content = '<function_call name="edit_workspace_file">{"workspaceId":"w1","filename":"x.txt","instructions":"update"}</function_call>';
    const calls = repairToolCalls(content);
    expect(calls).toHaveLength(1);
    expect(calls[0].function.name).toBe('edit_workspace_file');
    expect(JSON.parse(calls[0].function.arguments).filename).toBe('x.txt');
  });

  it('repairs bare JSON object', () => {
    const content = 'Saya akan gunakan tool berikut: {"name": "calculate", "arguments": {"items": []}}';
    const calls = repairToolCalls(content);
    expect(calls).toHaveLength(1);
    expect(calls[0].function.name).toBe('calculate');
  });

  it('repairs function wrapper object', () => {
    const content = '{"function": {"name": "search_workspace", "arguments": {"query": "rekap"}}}';
    const calls = repairToolCalls(content);
    expect(calls).toHaveLength(1);
    expect(calls[0].function.name).toBe('search_workspace');
  });

  it('repairs multiple calls in one message', () => {
    const content = '<tool_call>{"name":"list_workspace_files","arguments":{}}</tool_call> <tool_call>{"name":"read_workspace_file","arguments":{"filePath":"a"}}</tool_call>';
    const calls = repairToolCalls(content);
    expect(calls).toHaveLength(2);
    expect(calls[0].function.name).toBe('list_workspace_files');
    expect(calls[1].function.name).toBe('read_workspace_file');
  });

  it('repairs trailing comma in JSON', () => {
    const cleaned = repairJson('{"name": "x", "arguments": {"a": 1,},}');
    expect(() => JSON.parse(cleaned)).not.toThrow();
  });

  it('repairs tool_call: prefix', () => {
    const content = 'tool_call: {"name": "delete_workspace_file", "arguments": {"filename": "b.txt"}}';
    const calls = repairToolCalls(content);
    expect(calls).toHaveLength(1);
    expect(calls[0].function.name).toBe('delete_workspace_file');
  });

  it('returns empty for plain text without tool call', () => {
    const calls = repairToolCalls('Halo, ini jawaban biasa tanpa tool.');
    expect(calls).toHaveLength(0);
  });

  it('repairOneToolCall handles attribute + args', () => {
    const call = repairOneToolCall('name="write_workspace_file" {"filename":"x.txt","content":"hi"}', 0);
    expect(call).not.toBeNull();
    expect(call!.function.name).toBe('write_workspace_file');
  });
});
