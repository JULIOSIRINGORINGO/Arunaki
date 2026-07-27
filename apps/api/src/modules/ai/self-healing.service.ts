import { Injectable, Logger } from '@nestjs/common';
import { ToolRegistryService } from '../tools/tool-registry.service.js';
import { ToolResult } from '../tools/interfaces/tool-result.interface.js';

export interface HealingAttempt {
  originalError: string;
  strategy: string;
  success: boolean;
  result?: ToolResult;
  timestamp: Date;
}

export interface SelfHealingResult {
  finalResult: ToolResult;
  attempts: HealingAttempt[];
  healed: boolean;
}

/**
 * SelfHealingService — Auto Error Recovery & Tool Fallback.
 *
 * OpenClaw Pattern: When a tool execution fails, the agent automatically
 * diagnoses the error, applies a recovery strategy, and retries.
 *
 * Strategies:
 * 1. Retry with adjusted parameters (e.g., fix file path typos)
 * 2. Fallback to alternative tool (e.g., search → list_files)
 * 3. Skip and report (after max retries)
 */
@Injectable()
export class SelfHealingService {
  private readonly logger = new Logger(SelfHealingService.name);
  private readonly MAX_RETRIES = 3;

  /** Map of tool name → fallback tool names */
  private readonly fallbackMap: Record<string, string[]> = {
    workspace_search: ['workspace_list_files'],
    workspace_read: ['workspace_list_files'],
    workspace_analyze: ['workspace_read', 'workspace_list_files'],
  };

  /** Map of error patterns → recovery strategies */
  private readonly recoveryStrategies: Array<{
    pattern: RegExp;
    strategy: string;
    adjust: (args: Record<string, any>, error: string) => Record<string, any>;
  }> = [
    {
      pattern: /file.*not.*found|ENOENT|tidak.*ditemukan/i,
      strategy: 'path_correction',
      adjust: (args) => {
        // Try with normalized path separators
        const adjusted = { ...args };
        if (adjusted.path) {
          adjusted.path = adjusted.path.replace(/\\/g, '/');
        }
        if (adjusted.filePath) {
          adjusted.filePath = adjusted.filePath.replace(/\\/g, '/');
        }
        return adjusted;
      },
    },
    {
      pattern: /timeout|ETIMEOUT|terlalu.*lama/i,
      strategy: 'reduce_scope',
      adjust: (args) => {
        const adjusted = { ...args };
        // Reduce limit/count parameters
        if (adjusted.limit) adjusted.limit = Math.ceil(adjusted.limit / 2);
        if (adjusted.count) adjusted.count = Math.ceil(adjusted.count / 2);
        if (adjusted.maxResults)
          adjusted.maxResults = Math.ceil(adjusted.maxResults / 2);
        return adjusted;
      },
    },
    {
      pattern: /invalid.*arg|parameter|wajib.*diisi/i,
      strategy: 'fix_params',
      adjust: (args) => {
        // Strip empty strings, convert to proper types
        const adjusted: Record<string, any> = {};
        for (const [key, value] of Object.entries(args)) {
          if (value === '' || value === undefined) continue;
          adjusted[key] = value;
        }
        return adjusted;
      },
    },
  ];

  constructor(private readonly toolRegistryService: ToolRegistryService) {}

  /**
   * Execute a tool with self-healing wrapper.
   * If the tool fails, attempts automatic recovery before giving up.
   */
  async executeWithHealing(
    toolName: string,
    args: Record<string, any>,
  ): Promise<SelfHealingResult> {
    const attempts: HealingAttempt[] = [];

    // 1. First attempt — normal execution
    const firstResult = await this.toolRegistryService.executeTool(
      toolName,
      args,
    );

    if (firstResult.status === 'success') {
      return { finalResult: firstResult, attempts: [], healed: false };
    }

    this.logger.warn(
      `Tool "${toolName}" failed: ${firstResult.error?.message}. Attempting self-healing...`,
    );
    const errorMessage =
      firstResult.error?.message || firstResult.preview || 'Unknown error';

    // 2. Try recovery strategies based on error pattern
    for (let retry = 0; retry < this.MAX_RETRIES; retry++) {
      const strategy = this.findRecoveryStrategy(errorMessage);

      if (strategy) {
        const adjustedArgs = strategy.adjust(args, errorMessage);

        this.logger.log(
          `Healing attempt ${retry + 1}: strategy="${strategy.strategy}"`,
        );
        const retryResult = await this.toolRegistryService.executeTool(
          toolName,
          adjustedArgs,
        );

        const attempt: HealingAttempt = {
          originalError: errorMessage,
          strategy: strategy.strategy,
          success: retryResult.status === 'success',
          result: retryResult,
          timestamp: new Date(),
        };
        attempts.push(attempt);

        if (retryResult.status === 'success') {
          this.logger.log(
            `Self-healed with strategy "${strategy.strategy}" on attempt ${retry + 1}`,
          );
          return { finalResult: retryResult, attempts, healed: true };
        }
      }

      // 3. Try fallback tools
      const fallbacks = this.fallbackMap[toolName] || [];
      for (const fallbackTool of fallbacks) {
        this.logger.log(`Trying fallback tool: ${fallbackTool}`);
        const fallbackResult = await this.toolRegistryService.executeTool(
          fallbackTool,
          args,
        );

        const attempt: HealingAttempt = {
          originalError: errorMessage,
          strategy: `fallback:${fallbackTool}`,
          success: fallbackResult.status === 'success',
          result: fallbackResult,
          timestamp: new Date(),
        };
        attempts.push(attempt);

        if (fallbackResult.status === 'success') {
          this.logger.log(`Self-healed with fallback "${fallbackTool}"`);
          return { finalResult: fallbackResult, attempts, healed: true };
        }
      }
    }

    // 4. All recovery failed — return original error with healing context
    this.logger.warn(
      `Self-healing exhausted for "${toolName}" after ${attempts.length} attempts`,
    );

    const enrichedResult: ToolResult = {
      ...firstResult,
      data: {
        ...firstResult.data,
        healingAttempts: attempts.length,
        healingStrategies: attempts.map((a) => a.strategy),
      },
      preview: `${firstResult.preview} [Self-healing gagal setelah ${attempts.length} percobaan]`,
    };

    return { finalResult: enrichedResult, attempts, healed: false };
  }

  /**
   * Find the best recovery strategy for a given error.
   */
  private findRecoveryStrategy(errorMessage: string) {
    for (const strategy of this.recoveryStrategies) {
      if (strategy.pattern.test(errorMessage)) {
        return strategy;
      }
    }
    return null;
  }
}
