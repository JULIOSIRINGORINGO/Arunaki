import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { SecretsVaultService } from '../security/secrets-vault.service.js';
import { TrajectoryAuditService } from '../audit/trajectory-audit.service.js';
import { SubAgentRunnerService, SubAgentTask } from './sub-agent-runner.service.js';
import { ProviderService } from '../provider/provider.service.js';

describe('System Integration & Stress Testing', () => {
  describe('SecretsVaultService Stress Test', () => {
    beforeAll(() => {
      process.env.ARUNAKI_VAULT_KEY =
        'test-vault-key-0123456789abcdef0123456789abcdef';
    });

    it('should handle 1,000 rapid encryption & decryption cycles without failure or memory corruption', () => {
      const vault = new SecretsVaultService();
      const count = 1000;
      const keys: string[] = [];

      const startTime = Date.now();

      for (let i = 0; i < count; i++) {
        const keyName = `STRESS_KEY_${i}`;
        const secretValue = `sk-stress-test-value-${i}-${Math.random()}`;
        vault.storeSecret(keyName, secretValue);
        keys.push(keyName);
      }

      for (let i = 0; i < count; i++) {
        const retrieved = vault.getSecret(keys[i]);
        expect(retrieved).toContain(`sk-stress-test-value-${i}-`);
      }

      const durationMs = Date.now() - startTime;
      expect(durationMs).toBeLessThan(5000); // 1,000 ops in < 5 seconds
    });
  });

  describe('TrajectoryAuditService Stress Test', () => {
    it('should record 500 rapid trajectory steps and export clean JSON audit report', () => {
      const audit = new TrajectoryAuditService();
      const runId = 'stress_run_999';
      const chatId = 'chat_stress_1';

      audit.recordStep(runId, chatId, 'agent_start', { prompt: 'Stress test' });

      for (let i = 0; i < 498; i++) {
        audit.recordStep(runId, chatId, 'tool_done', {
          toolName: `tool_${i % 10}`,
          index: i,
        }, i % 50);
      }

      audit.recordStep(runId, chatId, 'agent_complete', { total: 500 });

      const exported = audit.exportTrajectoryJson(runId);

      expect(exported.totalSteps).toBe(500);
      expect(exported.summary.status).toBe('completed');
      expect(exported.summary.toolCallsCount).toBe(498);
    });
  });

  describe('SubAgentRunnerService High-Concurrency Stress Test', () => {
    it('should handle 30 parallel sub-agent tasks concurrently without deadlocks', async () => {
      const mockAiService = {
        chat: vi.fn().mockImplementation(async (messages) => {
          // Simulate micro delay
          await new Promise((r) => setTimeout(r, 10));
          return {
            content: `Hasil dari sub-tugas`,
            toolCalls: [],
            usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
          };
        }),
      };
      const mockToolRegistry = {
        getToolDefinitions: vi.fn().mockReturnValue([
          { function: { name: 'read' } },
        ]),
      };
      const mockSelfHealing = { executeWithIsolation: vi.fn() };

      const subAgentService = new SubAgentRunnerService(
        mockAiService as any,
        mockToolRegistry as any,
        mockSelfHealing as any,
      );

      const tasks: SubAgentTask[] = Array.from({ length: 30 }, (_, i) => ({
        taskId: `stress_sub_${i}`,
        taskName: `Sub Task ${i}`,
        taskDescription: `Deskripsi tugas ${i}`,
      }));

      const startTime = Date.now();
      const results = await subAgentService.spawnParallel(tasks);
      const durationMs = Date.now() - startTime;

      expect(results).toHaveLength(30);
      expect(results.every((r) => r.status === 'success')).toBe(true);
      expect(durationMs).toBeLessThan(3000); // 30 parallel sub-agents complete quickly
    });
  });

  describe('Provider Failover Stress & Cooldown Simulation', () => {
    it('should classify and rotate providers correctly under simulated 429 rate limit storm', async () => {
      const mockRepo = {
        findActive: vi.fn(),
        findAllEnabled: vi.fn(),
        findAvailable: vi.fn().mockResolvedValue([]),
        setCooldown: vi.fn(),
      };

      const providerService = new ProviderService(mockRepo as any);

      // Simulate 50 rapid rate-limit classifications
      for (let i = 0; i < 50; i++) {
        const classified = providerService.classifyError(429, `Rate limit hit ${i}`);
        expect(classified.action).toBe('rotate');
        expect(classified.cooldownSeconds).toBe(20);
      }

      // Next available rotation should fall back to alternate candidate pool
      mockRepo.findAvailable.mockResolvedValue([
        {
          id: 'kenari',
          name: 'Kenari',
          type: 'openai-compatible',
          baseUrl: 'https://kenari.id/v1',
          apiKey: 'kn-test-key',
          model: 'deepseek-v4-flash',
        },
      ]);
      const next = await providerService.getNextAvailable('openrouter/free');
      expect(next).not.toBeNull();
      expect(next?.model).toBe('deepseek-v4-flash');
    });
  });
});
