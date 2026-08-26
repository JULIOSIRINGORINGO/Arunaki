import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MultiDocOrchestratorService } from './multi-doc-orchestrator.service';
import {
  SubAgentRunnerService,
  SubAgentTask,
  SubAgentResult,
} from '../../chat/sub-agent-runner.service';

describe('MultiDocOrchestratorService', () => {
  let orchestrator: MultiDocOrchestratorService;
  let mockSubAgentRunner: SubAgentRunnerService;

  beforeEach(() => {
    mockSubAgentRunner = {
      spawnSubAgent: vi.fn(
        async (task: SubAgentTask): Promise<SubAgentResult> => {
          const isFail = task.taskName.includes('broken.txt');
          return {
            taskId: task.taskId,
            taskName: task.taskName,
            status: isFail ? 'error' : 'success',
            content: isFail
              ? ''
              : `Extracted data from ${task.taskName}: Total = 100RB`,
            toolOutputs: isFail
              ? []
              : [
                  {
                    toolName: 'read',
                    args: {},
                    preview: 'read ok',
                    status: 'success',
                  },
                ],
            metadata: {
              rounds: 1,
              startedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              durationMs: 25,
            },
            error: isFail ? 'File corrupted' : undefined,
          };
        },
      ),
      spawnParallel: vi.fn(),
    } as unknown as SubAgentRunnerService;

    orchestrator = new MultiDocOrchestratorService(mockSubAgentRunner);
  });

  it('partitions multiple files into isolated sub-agents and consolidates results', async () => {
    const files = [
      'laporan-januari.txt',
      'laporan-februari.txt',
      'laporan-maret.txt',
    ];
    const progressEvents: any[] = [];

    const result = await orchestrator.processDocumentsParallel(
      {
        workspaceId: 'ws-123',
        files,
        instruction: 'Extract all monthly totals',
        maxConcurrency: 2,
      },
      (e) => progressEvents.push(e),
    );

    expect(result.totalFiles).toBe(3);
    expect(result.processedCount).toBe(3);
    expect(result.successCount).toBe(3);
    expect(result.failedCount).toBe(0);
    expect(result.results).toHaveLength(3);

    // Verify consolidated summary contains findings from all 3 files
    expect(result.consolidatedSummary).toContain(
      'laporan-januari.txt [SUCCESS]',
    );
    expect(result.consolidatedSummary).toContain(
      'laporan-februari.txt [SUCCESS]',
    );
    expect(result.consolidatedSummary).toContain('laporan-maret.txt [SUCCESS]');
    expect(result.consolidatedSummary).toContain('Total = 100RB');

    // Verify spawnSubAgent was called 3 times
    expect(mockSubAgentRunner.spawnSubAgent).toHaveBeenCalledTimes(3);
  });

  it('handles partial failures gracefully without aborting remaining workers', async () => {
    const files = ['good1.txt', 'broken.txt', 'good2.txt'];

    const result = await orchestrator.processDocumentsParallel({
      workspaceId: 'ws-123',
      files,
      instruction: 'Verify data',
      maxConcurrency: 3,
    });

    expect(result.totalFiles).toBe(3);
    expect(result.successCount).toBe(2);
    expect(result.failedCount).toBe(1);

    const failedWorker = result.results.find((r) => r.file === 'broken.txt');
    expect(failedWorker?.status).toBe('error');
    expect(failedWorker?.error).toBe('File corrupted');

    const successWorker = result.results.find((r) => r.file === 'good1.txt');
    expect(successWorker?.status).toBe('success');
  });

  it('returns empty result when no files are provided', async () => {
    const result = await orchestrator.processDocumentsParallel({
      workspaceId: 'ws-123',
      files: [],
      instruction: 'Do nothing',
    });

    expect(result.totalFiles).toBe(0);
    expect(result.results).toHaveLength(0);
    expect(mockSubAgentRunner.spawnSubAgent).not.toHaveBeenCalled();
  });
});
