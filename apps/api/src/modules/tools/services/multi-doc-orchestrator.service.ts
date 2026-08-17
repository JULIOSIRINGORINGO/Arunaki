import { Injectable, Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { SubAgentRunnerService, SubAgentTask, SubAgentResult } from '../../chat/sub-agent-runner.service.js';
import { StorageService } from '../../storage/storage.service.js';
import { TranscriptEngineService } from '../../workspace/services/transcript-engine.service.js';

export interface MultiDocProcessParams {
  workspaceId: string;
  files: string[];
  instruction: string;
  maxConcurrency?: number;
  allowedTools?: string[];
  sessionId?: string;
}

export interface WorkerDocResult {
  file: string;
  status: 'success' | 'error' | 'skipped';
  summary: string;
  structuredData?: any;
  toolsUsed: string[];
  durationMs: number;
  error?: string;
}

export interface MultiDocProcessResult {
  totalFiles: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  results: WorkerDocResult[];
  consolidatedSummary: string;
  totalDurationMs: number;
}

@Injectable()
export class MultiDocOrchestratorService {
  private readonly logger = new Logger(MultiDocOrchestratorService.name);

  constructor(
    @Optional() @Inject(ModuleRef) private readonly moduleRef?: ModuleRef,
    @Optional()
    @Inject(forwardRef(() => SubAgentRunnerService))
    private subAgentRunner?: SubAgentRunnerService,
  ) {
    // If first argument is a SubAgentRunner (e.g. in tests)
    if (this.moduleRef && typeof (this.moduleRef as any).spawnSubAgent === 'function') {
      this.subAgentRunner = this.moduleRef as unknown as SubAgentRunnerService;
    }
  }

  private getRunner(): SubAgentRunnerService | null {
    if (this.subAgentRunner) return this.subAgentRunner;
    if (this.moduleRef && typeof (this.moduleRef as any).get === 'function') {
      try {
        this.subAgentRunner = (this.moduleRef as any).get(SubAgentRunnerService, { strict: false });
        return this.subAgentRunner || null;
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Dispatches parallel sandboxed sub-agents to process multiple documents concurrently
   * with concurrency throttling to prevent context bloat and API rate-limiting.
   */
  async processDocumentsParallel(
    params: MultiDocProcessParams,
    onProgress?: (event: { type: 'worker_started' | 'worker_completed' | 'worker_failed'; file: string; progress: number }) => void,
  ): Promise<MultiDocProcessResult> {
    const startedAt = Date.now();
    const { workspaceId, files, instruction, maxConcurrency = 3, allowedTools, sessionId } = params;

    if (!files || files.length === 0) {
      return {
        totalFiles: 0,
        processedCount: 0,
        successCount: 0,
        failedCount: 0,
        results: [],
        consolidatedSummary: 'No documents provided for processing.',
        totalDurationMs: 0,
      };
    }

    this.logger.log(
      `[MultiDocOrchestrator] Starting parallel processing for ${files.length} documents (concurrency: ${maxConcurrency}, workspace: ${workspaceId})`,
    );

    const tasks: SubAgentTask[] = files.map((file, idx) => ({
      taskId: `worker-${idx + 1}-${Date.now().toString(36)}`,
      taskName: `Document Worker: ${file}`,
      taskDescription: `You are an isolated document sub-agent worker.
Target File: ${file}
Your Instruction: ${instruction}

Steps:
1. Read file ${file} using available reading tools.
2. Execute the requested analysis / extraction.
3. Return a clear, structured summary of findings for ${file}.`,
      allowedTools: allowedTools || ['read', 'data_query', 'extract_structured_data', 'document_reader'],
      maxRounds: 4,
      workspaceId,
      additionalContext: `Target File: ${file}\nWorkspace ID: ${workspaceId}`,
    }));

    // Concurrency-limited execution pool
    const results: WorkerDocResult[] = [];
    let completedCount = 0;

    const executeWorker = async (task: SubAgentTask, file: string): Promise<WorkerDocResult> => {
      onProgress?.({
        type: 'worker_started',
        file,
        progress: Math.round((completedCount / files.length) * 100),
      });

      const workerStart = Date.now();
      try {
        const runner = this.getRunner();
        if (!runner) {
          throw new Error('SubAgentRunner is not available in runtime');
        }
        const subResult: SubAgentResult = await runner.spawnSubAgent(task);
        const durationMs = Date.now() - workerStart;

        completedCount++;
        const isSuccess = subResult.status === 'success';

        onProgress?.({
          type: isSuccess ? 'worker_completed' : 'worker_failed',
          file,
          progress: Math.round((completedCount / files.length) * 100),
        });

        return {
          file,
          status: isSuccess ? 'success' : 'error',
          summary: subResult.content || (isSuccess ? 'Completed successfully' : (subResult.error || 'Execution failed')),
          toolsUsed: subResult.toolOutputs?.map((t) => t.toolName) || [],
          durationMs,
          error: subResult.error,
        };
      } catch (err: any) {
        completedCount++;
        onProgress?.({
          type: 'worker_failed',
          file,
          progress: Math.round((completedCount / files.length) * 100),
        });

        return {
          file,
          status: 'error',
          summary: `Worker error: ${err.message}`,
          toolsUsed: [],
          durationMs: Date.now() - workerStart,
          error: err.message,
        };
      }
    };

    // Run pool
    const executing: Promise<any>[] = [];
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const file = files[i];
      const p = executeWorker(task, file).then((res) => {
        results.push(res);
        executing.splice(executing.indexOf(p), 1);
      });
      executing.push(p);

      if (executing.length >= maxConcurrency) {
        await Promise.race(executing);
      }
    }
    await Promise.all(executing);

    const totalDurationMs = Date.now() - startedAt;
    const successCount = results.filter((r) => r.status === 'success').length;
    const failedCount = results.filter((r) => r.status === 'error').length;

    // Generate consolidated summary
    const consolidatedSummary = results
      .map((r, idx) => `### ${idx + 1}. ${r.file} [${r.status.toUpperCase()}]\n${r.summary}`)
      .join('\n\n');

    this.logger.log(
      `[MultiDocOrchestrator] Batch completed in ${totalDurationMs}ms (${successCount}/${files.length} succeeded)`,
    );

    return {
      totalFiles: files.length,
      processedCount: results.length,
      successCount,
      failedCount,
      results,
      consolidatedSummary,
      totalDurationMs,
    };
  }
}
