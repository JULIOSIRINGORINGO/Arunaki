import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import { ToolRegistryService } from '../tool-registry.service.js';

export interface PtcOperation {
  tool: string;
  args: Record<string, any>;
  stepName?: string;
}

export interface PtcBatchResult {
  status: 'success' | 'partial_failure' | 'error';
  totalSteps: number;
  completedSteps: number;
  results: Array<{
    step: number;
    tool: string;
    status: 'success' | 'error';
    data?: any;
    error?: string;
  }>;
  rolledBack: boolean;
  message?: string;
}

@Injectable()
export class PtcExecutorService {
  private readonly logger = new Logger(PtcExecutorService.name);

  constructor(private readonly toolRegistry: ToolRegistryService) {}

  /**
   * Executes a batch of tool operations with atomic rollback guarantees.
   * If atomic is true and any mutation step fails, all touched files are restored.
   */
  async executeBatch(
    workspaceId: string,
    workspaceRoot: string,
    operations: PtcOperation[],
    options: { atomic?: boolean } = { atomic: true },
  ): Promise<PtcBatchResult> {
    if (!operations || operations.length === 0) {
      return {
        status: 'error',
        totalSteps: 0,
        completedSteps: 0,
        results: [],
        rolledBack: false,
        message: 'No operations provided in batch.',
      };
    }

    this.logger.log(
      `[PTC] ⚡ Starting Programmatic Tool Call batch: ${operations.length} step(s) (atomic: ${options.atomic})`,
    );

    const snapshots = new Map<string, string>(); // absolutePath -> fileContent
    const results: PtcBatchResult['results'] = [];
    let hadError = false;

    try {
      // Step 1: Pre-snapshot files that will be touched by mutating tools
      if (options.atomic && workspaceRoot) {
        for (const op of operations) {
          if (this.toolRegistry.isMutating(op.tool)) {
            const rawPath = op.args?.filePath || op.args?.path || op.args?.filename;
            if (rawPath) {
              const fullPath = path.isAbsolute(rawPath)
                ? rawPath
                : path.join(workspaceRoot, rawPath);
              if (fs.existsSync(fullPath) && !snapshots.has(fullPath)) {
                try {
                  const original = fs.readFileSync(fullPath, 'utf-8');
                  snapshots.set(fullPath, original);
                  this.logger.debug(`[PTC] 📸 Snapshot created for ${path.basename(fullPath)}`);
                } catch (snapErr) {
                  this.logger.warn(`[PTC] Could not create snapshot for ${fullPath}: ${snapErr}`);
                }
              }
            }
          }
        }
      }

      // Step 2: Execute operations sequentially, piping context if needed
      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        const stepNum = i + 1;
        const enrichedArgs = { ...op.args, workspaceId };

        this.logger.log(`[PTC] ▶️ Step ${stepNum}/${operations.length}: Executing "${op.tool}"`);

        const toolResult: ToolResult = await this.toolRegistry.executeTool(op.tool, enrichedArgs);

        if (toolResult.status === 'success') {
          results.push({
            step: stepNum,
            tool: op.tool,
            status: 'success',
            data: toolResult.data || toolResult.preview,
          });
        } else {
          hadError = true;
          const errorMsg = toolResult.error
            ? typeof toolResult.error === 'string'
              ? toolResult.error
              : toolResult.error.message
            : 'Unknown tool execution error';

          results.push({
            step: stepNum,
            tool: op.tool,
            status: 'error',
            error: errorMsg,
          });
          this.logger.warn(`[PTC] ⚠️ Step ${stepNum} ("${op.tool}") failed: ${errorMsg}`);

          if (options.atomic) {
            // Atomic mode: abort on first failure
            break;
          }
        }
      }

      // Step 3: Handle Rollback if atomic and error occurred
      let rolledBack = false;
      if (hadError && options.atomic && snapshots.size > 0) {
        this.logger.warn(`[PTC] 🔄 Rolling back ${snapshots.size} file(s) due to batch failure...`);
        for (const [filePath, originalContent] of snapshots.entries()) {
          try {
            fs.writeFileSync(filePath, originalContent, 'utf-8');
            this.logger.log(`[PTC] ⏪ Restored ${path.basename(filePath)} to snapshot state.`);
          } catch (restoreErr) {
            this.logger.error(`[PTC] ❌ Failed to restore ${filePath}: ${restoreErr}`);
          }
        }
        rolledBack = true;
      }

      const completedCount = results.filter((r) => r.status === 'success').length;
      return {
        status: !hadError ? 'success' : rolledBack ? 'error' : 'partial_failure',
        totalSteps: operations.length,
        completedSteps: completedCount,
        results,
        rolledBack,
        message: !hadError
          ? `All ${operations.length} batch operations executed successfully.`
          : rolledBack
            ? `Batch failed at step ${results.length}. All file mutations rolled back.`
            : `Batch completed with errors (${completedCount}/${operations.length} succeeded).`,
      };
    } catch (err: any) {
      this.logger.error(`[PTC] Fatal error during batch execution: ${err.message}`, err.stack);
      return {
        status: 'error',
        totalSteps: operations.length,
        completedSteps: results.filter((r) => r.status === 'success').length,
        results,
        rolledBack: false,
        message: `Batch aborted due to internal error: ${err.message}`,
      };
    }
  }
}
