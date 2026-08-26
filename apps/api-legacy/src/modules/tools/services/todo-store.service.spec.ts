import { describe, it, expect } from 'vitest';
import { TodoStoreService } from './todo-store.service.js';

describe('TodoStoreService', () => {
  const store = new TodoStoreService();

  it('set dan get per-run, clear menghapus', () => {
    store.set('run-1', [
      { id: '1', content: 'Baca file', status: 'completed' },
      { id: '2', content: 'Hitung total', status: 'in_progress' },
    ]);
    expect(store.get('run-1')).toHaveLength(2);
    expect(store.has('run-1')).toBe(true);

    store.clear('run-1');
    expect(store.has('run-1')).toBe(false);
    expect(store.get('run-1')).toEqual([]);
  });

  it('serialize menghasilkan format yang bisa di-inject ke prompt', () => {
    store.set('run-2', [
      { id: '1', content: 'Baca file', status: 'completed' },
      { id: '2', content: 'Hitung total', status: 'pending' },
    ]);
    const s = store.serialize('run-2');
    expect(s).toContain('=== TODO LIST ===');
    expect(s).toContain('- [completed] 1: Baca file');
    expect(s).toContain('- [pending] 2: Hitung total');
    expect(s).toContain('=== END TODO LIST ===');
    store.clear('run-2');
  });

  it('serialize kosong untuk run tanpa todos', () => {
    expect(store.serialize('run-3')).toBe('');
  });
});
