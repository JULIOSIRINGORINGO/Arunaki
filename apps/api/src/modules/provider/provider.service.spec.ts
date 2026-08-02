import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProviderService } from './provider.service.js';

describe('ProviderService — Failover & Error Classification', () => {
  let service: ProviderService;
  let mockRepository: any;

  beforeEach(() => {
    process.env.APP_SECRET = '01234567890123456789012345678901';
    mockRepository = {
      findActive: vi.fn(),
      findAllEnabled: vi.fn(),
      findAvailable: vi.fn().mockResolvedValue([]),
      setActive: vi.fn(),
      recordUsage: vi.fn(),
      recordError: vi.fn(),
      setCooldown: vi.fn(),
    };

    service = new ProviderService(mockRepository);
  });

  describe('classifyError', () => {
    it('should classify HTTP 429 (Rate Limit) as rotate with 20s cooldown', () => {
      const classified = service.classifyError(429, 'Rate limit exceeded');

      expect(classified.action).toBe('rotate');
      expect(classified.statusCode).toBe(429);
      expect(classified.cooldownSeconds).toBe(20);
      expect(classified.message).toContain('HTTP 429');
    });

    it('should classify HTTP 401 (Unauthorized) as rotate with 300s cooldown', () => {
      const classified = service.classifyError(401, 'Invalid API Key');

      expect(classified.action).toBe('rotate');
      expect(classified.statusCode).toBe(401);
      expect(classified.cooldownSeconds).toBe(300);
    });

    it('should classify HTTP 403 (Forbidden) as rotate with 300s cooldown', () => {
      const classified = service.classifyError(403, 'Access denied for model');

      expect(classified.action).toBe('rotate');
      expect(classified.statusCode).toBe(403);
      expect(classified.cooldownSeconds).toBe(300);
    });

    it('should classify HTTP 503 (Service Unavailable) as rotate with 20s cooldown', () => {
      const classified = service.classifyError(503, 'Model server overloaded');

      expect(classified.action).toBe('rotate');
      expect(classified.statusCode).toBe(503);
      expect(classified.cooldownSeconds).toBe(20);
    });

    it('should classify HTTP 500 (Internal Server Error) as retry with backoff', () => {
      const classified = service.classifyError(500, 'Internal server error');

      expect(classified.action).toBe('retry');
      expect(classified.statusCode).toBe(500);
    });

    it('should classify HTTP 502 (Bad Gateway) as retry with backoff', () => {
      const classified = service.classifyError(502, 'Bad gateway');

      expect(classified.action).toBe('retry');
      expect(classified.statusCode).toBe(502);
    });
  });

  describe('getNextAvailable', () => {
    it('should return next enabled provider if available', async () => {
      mockRepository.findAvailable.mockResolvedValue([
        {
          id: 'p1',
          name: 'Primary Provider',
          type: 'openai-compatible',
          baseUrl: 'https://openrouter.ai/api/v1',
          apiKey: 'key1',
          model: 'openrouter/free',
        },
        {
          id: 'p2',
          name: 'Secondary Provider',
          type: 'openai-compatible',
          baseUrl: 'https://openrouter.ai/api/v1',
          apiKey: 'key2',
          model: 'google/gemma-4-31b-it:free',
        },
      ]);

      const next = await service.getNextAvailable('p1');

      expect(next).not.toBeNull();
      expect(next?.id).toBe('p2');
      expect(next?.model).toBe('google/gemma-4-31b-it:free');
    });

    it('should rotate to free candidate pool if no database provider available', async () => {
      mockRepository.findAvailable.mockResolvedValue([]);
      mockRepository.findAllEnabled.mockResolvedValue([
        {
          id: 'openrouter',
          name: 'OpenRouter',
          type: 'openai-compatible',
          baseUrl: 'https://openrouter.ai/api/v1',
          apiKey: 'sk-or-test-key',
          model: 'openrouter/auto',
        },
      ]);

      const next = await service.getNextAvailable('openrouter/free');

      expect(next).not.toBeNull();
      expect(next?.id).toContain('fallback-');
      expect(next?.baseUrl).toBe('https://openrouter.ai/api/v1');
      expect(next?.model).toBe('openrouter/auto');
    });

    it('should set cooldown for provider on rotate error', async () => {
      await service.setCooldown('p1', 60);

      expect(mockRepository.setCooldown).toHaveBeenCalledWith('p1', 60);
    });
  });
});
