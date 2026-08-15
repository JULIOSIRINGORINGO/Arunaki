import { describe, it, expect, vi } from 'vitest';
import { streamWithFallback } from './stream-chat.js';

function throwingStream(err: any) {
  return async function* () {
    throw err;
  };
}

describe('streamWithFallback', () => {
  it('rotates immediately on provider timeout (no 3x retry) and sets cooldown', async () => {
    const makeRequest = vi.fn(
      throwingStream(Object.assign(new Error('timeout'), { statusCode: 0, isTimeout: true })),
    );
    const getNextProvider = vi
      .fn()
      .mockResolvedValueOnce({ id: 'p2', name: 'p2' })
      .mockResolvedValueOnce(null);
    const setCooldown = vi.fn().mockResolvedValue(undefined);

    const chunks: any[] = [];
    for await (const c of streamWithFallback({
      provider: { id: 'p1', name: 'p1' },
      body: { messages: [] },
      makeRequest: makeRequest as any,
      getNextProvider,
      classifyError: () => ({ action: 'fatal' }),
      setCooldown,
    })) {
      chunks.push(c);
    }

    expect(makeRequest).toHaveBeenCalledTimes(2);
    expect(setCooldown).toHaveBeenCalledWith('p1', 300);
    expect(chunks.some((c) => c.type === 'error')).toBe(true);
  });
  it('still retries non-timeout network errors before rotating', async () => {
    let call = 0;
    const makeRequest = vi.fn(async function* () {
      call++;
      if (call <= 3) {
        throw Object.assign(new Error('ECONNRESET'), { statusCode: 0 });
      }
      yield { type: 'done' };
    });
    const getNextProvider = vi.fn().mockResolvedValue({ id: 'p2', name: 'p2' });
    const setCooldown = vi.fn().mockResolvedValue(undefined);

    const chunks: any[] = [];
    for await (const c of streamWithFallback({
      provider: { id: 'p1', name: 'p1' },
      body: { messages: [] },
      makeRequest: makeRequest as any,
      getNextProvider,
      classifyError: () => ({ action: 'fatal' }),
      setCooldown,
    })) {
      chunks.push(c);
    }

    expect(makeRequest).toHaveBeenCalledTimes(4);
    expect(setCooldown).not.toHaveBeenCalled();
    expect(chunks.some((c) => c.type === 'done')).toBe(true);
  }, 15000);
});
