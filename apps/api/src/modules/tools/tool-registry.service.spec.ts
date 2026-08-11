import { describe, it, expect, vi } from 'vitest';
import { ToolRegistryService } from './tool-registry.service.js';
import { ToolAdapter } from './services/tool-adapter.js';

describe('ToolRegistryService.validateArgs', () => {
  const service = new ToolRegistryService();

  const parameters = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      qty: { type: 'number' },
      enabled: { type: 'boolean' },
      tags: { type: 'array', items: { type: 'string' } },
      meta: { type: 'object' },
    },
    required: ['name'],
  };

  it('accepts valid arguments', () => {
    const result = service.validateArgs(
      { name: 'Beras', qty: 5, enabled: true, tags: ['a'], meta: { k: 1 } },
      parameters,
    );
    expect(result.valid).toBe(true);
  });

  it('rejects a boolean of the wrong type', () => {
    const result = service.validateArgs({ name: 'x', enabled: 'true' }, parameters);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('enabled');
    expect(result.errors[0]).toContain('boolean');
  });

  it('rejects an object that is not an object (array)', () => {
    const asArray = service.validateArgs({ name: 'x', meta: [] }, parameters);
    expect(asArray.valid).toBe(false);
    expect(asArray.errors[0]).toContain('meta');
  });

  it('treats null for an optional field as absent (passes)', () => {
    const result = service.validateArgs({ name: 'x', meta: null }, parameters);
    expect(result.valid).toBe(true);
  });
});

describe('ToolRegistryService result cache (Gap #3)', () => {
  it('reuses cacheable read-only tool results within the same scope', async () => {
    const service = new ToolRegistryService();
    const handler = vi.fn().mockResolvedValue({
      status: 'success',
      data: { text: 'file contents' },
      preview: 'file contents',
      metadata: { toolName: 'read', displayName: 'x', executionTime: 0 },
    });
    service.register(
      ToolAdapter.from({
        name: 'read',
        displayName: 'x',
        description: 'reads a file',
        tags: ['read'],
        handler,
        parameters: { type: 'object', properties: { filePath: { type: 'string' } }, required: ['filePath'] },
        cacheable: true,
      }),
    );

    const args = { workspaceId: 'ws-1', filePath: 'a.txt' };
    const first = await service.executeTool('read', args);
    const second = await service.executeTool('read', args);
    expect(first.preview).toBe('file contents');
    expect(second.preview).toBe('file contents');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not cache non-cacheable tools', async () => {
    const service = new ToolRegistryService();
    const handler = vi.fn().mockResolvedValue({
      status: 'success',
      data: { text: 'ok' },
      preview: 'ok',
      metadata: { toolName: 'web_search', displayName: 'x', executionTime: 0 },
    });
    service.register(
      ToolAdapter.from({
        name: 'web_search',
        displayName: 'x',
        description: 'searches the web',
        tags: ['search'],
        handler,
        parameters: { type: 'object', properties: { query: { type: 'string' } } },
        cacheable: false,
      }),
    );

    await service.executeTool('web_search', { query: 'beras' });
    await service.executeTool('web_search', { query: 'beras' });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('invalidates the scope when a mutating tool runs', async () => {
    const service = new ToolRegistryService();
    const readHandler = vi.fn().mockResolvedValue({
      status: 'success',
      data: { text: 'file contents' },
      preview: 'file contents',
      metadata: { toolName: 'read', displayName: 'x', executionTime: 0 },
    });
    const writeHandler = vi.fn().mockResolvedValue({
      status: 'success',
      data: { text: 'written' },
      preview: 'written',
      metadata: { toolName: 'write', displayName: 'x', executionTime: 0 },
    });
    service.register(
      ToolAdapter.from({
        name: 'read',
        displayName: 'x',
        description: 'reads',
        tags: ['read'],
        handler: readHandler,
        parameters: { type: 'object', properties: {} },
        cacheable: true,
      }),
    );
    service.register(
      ToolAdapter.from({
        name: 'write',
        displayName: 'x',
        description: 'writes',
        tags: ['write'],
        handler: writeHandler,
        parameters: { type: 'object', properties: {} },
        cacheable: false,
        mutating: true,
      }),
    );

    const args = { workspaceId: 'ws-1' };
    await service.executeTool('read', args);
    await service.executeTool('write', args);
    await service.executeTool('read', args);
    // after invalidation the second read re-executes
    expect(readHandler).toHaveBeenCalledTimes(2);
  });
});
