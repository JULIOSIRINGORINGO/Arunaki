import { describe, it, expect } from 'vitest';
import { ToolRegistryService } from './tool-registry.service.js';

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

  it('menerima argumen yang valid', () => {
    const result = service.validateArgs(
      { name: 'Beras', qty: 5, enabled: true, tags: ['a'], meta: { k: 1 } },
      parameters,
    );
    expect(result.valid).toBe(true);
  });

  it('menolak boolean yang salah tipe', () => {
    const result = service.validateArgs({ name: 'x', enabled: 'true' }, parameters);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('enabled');
    expect(result.errors[0]).toContain('boolean');
  });

  it('menolak object yang bukan object (array)', () => {
    const asArray = service.validateArgs({ name: 'x', meta: [] }, parameters);
    expect(asArray.valid).toBe(false);
    expect(asArray.errors[0]).toContain('meta');
  });

  it('null untuk field optional dianggap absent (lolos)', () => {
    const result = service.validateArgs({ name: 'x', meta: null }, parameters);
    expect(result.valid).toBe(true);
  });
});
