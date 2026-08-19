import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  Tool,
  ToolDefinition,
  ToolCapability,
} from './interfaces/tool.interface.js';
import {
  ToolResult,
  ToolResultChunk,
  StreamingToolResult,
} from './interfaces/tool-result.interface.js';
import { ToolResultCacheService } from './services/tool-result-cache.service.js';
import {
  validateToolArgs,
  normalizeToolArgs,
  buildCompactParameterSchema,
} from './utils/tool-validator.util.js';

interface RegisteredTool {
  tool: Tool;
  timeoutMs: number;
}

/**
 * ToolRegistryService — self-registering tool registry.
 *
 * Tools register themselves via OnModuleInit. The registry
 * provides tool discovery, validation, and execution.
 *
 * Supports parallel execution for independent tool calls.
 */
@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);
  private readonly tools = new Map<string, RegisteredTool>();
  private readonly cacheService: ToolResultCacheService;

  constructor(
    @Optional() cacheService?: ToolResultCacheService,
  ) {
    this.cacheService = cacheService || new ToolResultCacheService();
  }

  private scopeOf(args: Record<string, any>): string {
    return String(args?.workspaceId || args?.runId || 'default');
  }

  /**
   * Drop cached results for a scope (called when a mutating tool runs there).
   */
  invalidateCache(scope: string): void {
    this.cacheService?.invalidateScope(scope);
  }

  /**
   * Register a tool into the registry.
   * Called by tool services during OnModuleInit.
   */
  register(tool: Tool): void {
    const timeoutMs = tool.timeoutMs ?? 10000;
    this.tools.set(tool.name, { tool, timeoutMs });
    this.logger.log(`Tool registered: ${tool.name} (timeout: ${timeoutMs}ms)`);
  }

  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((r) => ({
      type: 'function' as const,
      function: {
        name: r.tool.name,
        description: r.tool.description.split('\n')[0],
        parameters: buildCompactParameterSchema(
          r.tool.definition.function.parameters,
        ),
      },
    }));
  }

  /**
   * Get dynamically filtered tool definitions based on context (Tool RAG).
   * Core tools are always included, plus the highest scoring tools matching the context.
   */
  getRelevantToolDefinitions(
    contextText: string,
    limit: number = 15,
  ): ToolDefinition[] {
    const allTools = Array.from(this.tools.values());

    const coreToolNames = new Set([
      'read',
      'search_workspace',
      'write',
      'invoke_subagent',
      'desktop_open_excel',
      'vision_ai',
      'knowledge_live_fetch',
      'stock_lookup',
      'ip_geolocation',
    ]);

    const ctx = contextText.toLowerCase();

    const scoredTools = allTools.map((r) => {
      let score = 0;
      if (coreToolNames.has(r.tool.name)) {
        score = 1000;
      } else {
        const cap = r.tool.capability as ToolCapability;
        if (cap) {
          for (const tag of cap.tags || []) {
            if (ctx.includes(tag.toLowerCase())) score += 5;
          }
        }
        if (ctx.includes(r.tool.name.replace(/_/g, ' '))) score += 5;
        if (ctx.includes(r.tool.name)) score += 10;
      }
      return { record: r, score };
    });

    scoredTools.sort((a, b) => b.score - a.score);

    const selected = scoredTools
      .filter((t, i) => i < limit || t.score >= 1000)
      .map((t) => t.record);

    return selected.map((r) => ({
      type: 'function' as const,
      function: {
        name: r.tool.name,
        description: r.tool.description.split('\n')[0],
        parameters: buildCompactParameterSchema(
          r.tool.definition.function.parameters,
        ),
      },
    }));
  }

  getToolCapabilities(): ToolCapability[] {
    return Array.from(this.tools.values()).map(
      (r) => r.tool.capability as ToolCapability,
    );
  }

  getToolsByTags(tags: string[]): ToolCapability[] {
    return this.getToolCapabilities().filter((cap) =>
      tags.some((tag) => cap.tags.includes(tag)),
    );
  }

  isMutating(name: string): boolean {
    const toolRecord = this.tools.get(name);
    return toolRecord ? !!toolRecord.tool.mutating : false;
  }

  validateArgs(
    args: Record<string, any>,
    parameters: Record<string, any>,
  ) {
    return validateToolArgs(args, parameters);
  }

  async executeTool(
    name: string,
    args: Record<string, any>,
  ): Promise<ToolResult> {
    const registered = this.tools.get(name);
    if (!registered) {
      return {
        status: 'error',
        data: {},
        preview: `Tool "${name}" is not recognized`,
        metadata: {
          toolName: name,
          displayName: name,
          executionTime: 0,
        },
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `Tool "${name}" not recognized`,
        },
      };
    }

    const { tool, timeoutMs } = registered;
    const normalizedArgs = normalizeToolArgs(args);

    const validation = validateToolArgs(
      normalizedArgs,
      tool.definition.function.parameters,
    );
    if (!validation.valid) {
      return {
        status: 'error',
        data: { receivedArgs: args },
        preview: `Invalid input: ${validation.errors.join('; ')}`,
        metadata: {
          toolName: name,
          displayName: tool.capability.displayName,
          executionTime: 0,
        },
        error: {
          code: 'INVALID_ARGS',
          message: validation.errors.join('; '),
        },
      };
    }

    this.logger.log(`Executing tool "${name}" (timeout: ${timeoutMs}ms)`);

    const scope = this.scopeOf(args);
    if (tool.cacheable && this.cacheService) {
      if (this.isMutating(name)) this.invalidateCache(scope);
      const cached = this.cacheService.get(scope, name, args);
      if (cached) {
        this.logger.log(`[CACHE HIT] tool "${name}" reused from per-run cache`);
        return cached;
      }
      const startTime = Date.now();
      try {
        const result = await this.executeWithTimeout(
          () => Promise.resolve(tool.execute(args)),
          timeoutMs,
        );
        result.metadata.executionTime = Date.now() - startTime;
        const finalResult = this.truncateResult(result);
        if (finalResult.status === 'success') {
          this.cacheService.set(scope, name, args, finalResult);
        }
        return finalResult;
      } catch (e: any) {
        const isTimeout = e.message?.includes('timeout');
        return {
          status: 'error',
          data: {},
          preview: isTimeout
            ? `Tool "${name}" timed out after ${timeoutMs}ms`
            : `Tool "${name}" failed: ${e.message}`,
          metadata: {
            toolName: name,
            displayName: tool.capability.displayName,
            executionTime: Date.now() - startTime,
          },
          error: {
            code: isTimeout ? 'TOOL_TIMEOUT' : 'EXECUTION_FAILED',
            message: e.message,
          },
        };
      }
    }

    if (this.isMutating(name)) this.invalidateCache(scope);
    const startTime = Date.now();

    try {
      const result = await this.executeWithTimeout(
        () => Promise.resolve(tool.execute(args)),
        timeoutMs,
      );
      result.metadata.executionTime = Date.now() - startTime;
      return this.truncateResult(result);
    } catch (e: any) {
      const isTimeout = e.message?.includes('timeout');
      return {
        status: 'error',
        data: {},
        preview: isTimeout
          ? `Tool "${name}" timed out after ${timeoutMs}ms`
          : `Tool "${name}" failed: ${e.message}`,
        metadata: {
          toolName: name,
          displayName: tool.capability.displayName,
          executionTime: Date.now() - startTime,
        },
        error: {
          code: isTimeout ? 'TOOL_TIMEOUT' : 'EXECUTION_FAILED',
          message: e.message,
        },
      };
    }
  }

  async executeParallel(
    toolCalls: Array<{ name: string; args: Record<string, any> }>,
  ): Promise<Array<{ name: string; result: ToolResult }>> {
    if (toolCalls.length === 0) return [];
    if (toolCalls.length === 1) {
      const { name, args } = toolCalls[0];
      const result = await this.executeTool(name, args);
      return [{ name, result }];
    }

    this.logger.log(`Executing ${toolCalls.length} tools in parallel`);
    const promises = toolCalls.map(async ({ name, args }) => {
      const result = await this.executeTool(name, args);
      return { name, result };
    });

    return Promise.all(promises);
  }

  async executeParallelLimited(
    toolCalls: Array<{ name: string; args: Record<string, any> }>,
    maxConcurrency = 5,
  ): Promise<Array<{ name: string; result: ToolResult }>> {
    if (toolCalls.length === 0) return [];
    if (toolCalls.length <= maxConcurrency) {
      return this.executeParallel(toolCalls);
    }

    this.logger.log(
      `Executing ${toolCalls.length} tools with concurrency limit ${maxConcurrency}`,
    );

    const results: Array<{ name: string; result: ToolResult }> = [];
    const queue = [...toolCalls];

    while (queue.length > 0) {
      const batch = queue.splice(0, maxConcurrency);
      const batchResults = await this.executeParallel(batch);
      results.push(...batchResults);
    }

    return results;
  }

  executeToolStreaming(
    name: string,
    args: Record<string, any>,
  ): StreamingToolResult {
    const registered = this.tools.get(name);
    if (!registered) {
      const errorChunk: ToolResultChunk = {
        type: 'error',
        toolName: name,
        error: { code: 'TOOL_NOT_FOUND', message: `Tool "${name}" not recognized` },
      };
      const asyncGen = (async function* () {
        yield errorChunk;
      })();
      return {
        stream: asyncGen,
        finalResult: Promise.resolve({
          status: 'error',
          data: {},
          preview: `Tool "${name}" is not recognized`,
          metadata: { toolName: name, displayName: name, executionTime: 0 },
          error: { code: 'TOOL_NOT_FOUND', message: `Tool "${name}" not recognized` },
        }),
      };
    }

    const { tool, timeoutMs } = registered;
    const validation = validateToolArgs(
      args,
      tool.definition.function.parameters,
    );
    if (!validation.valid) {
      const errorChunk: ToolResultChunk = {
        type: 'error',
        toolName: name,
        error: {
          code: 'INVALID_ARGS',
          message: validation.errors.join('; '),
        },
      };
      const asyncGen = (async function* () {
        yield errorChunk;
      })();
      return {
        stream: asyncGen,
        finalResult: Promise.resolve({
          status: 'error',
          data: { receivedArgs: args },
          preview: `Invalid input: ${validation.errors.join('; ')}`,
          metadata: {
            toolName: name,
            displayName: tool.capability.displayName,
            executionTime: 0,
          },
          error: { code: 'INVALID_ARGS', message: validation.errors.join('; ') },
        }),
      };
    }

    const stream = this.createToolStream(tool, name, args, timeoutMs);
    const finalResult = this.collectStreamResult(
      stream,
      name,
      tool.capability.displayName,
    );
    return { stream, finalResult };
  }

  private async *createToolStream(
    tool: any,
    name: string,
    args: Record<string, any>,
    timeoutMs: number,
  ): AsyncGenerator<ToolResultChunk> {
    const startTime = Date.now();
    let hasYieldedProgress = false;

    yield {
      type: 'progress',
      toolName: name,
      progress: 0,
      message: `Starting execution of ${tool.capability.displayName}...`,
    };

    try {
      if (tool.executeStreaming) {
        for await (const chunk of tool.executeStreaming(args)) {
          yield {
            type: 'progress',
            toolName: name,
            progress: chunk.progress,
            message: chunk.message,
            data: chunk.data,
            preview: chunk.preview,
            metadata: chunk.metadata,
          };
          hasYieldedProgress = true;
        }
      } else {
        let completed = false;
        const progressInterval = setInterval(() => {
          if (!completed && !hasYieldedProgress) {
            hasYieldedProgress = true;
          }
        }, 2000);

        try {
          const result = await this.executeWithTimeout(
            () => Promise.resolve(tool.execute(args)),
            timeoutMs,
          );
          completed = true;
          clearInterval(progressInterval);
          result.metadata.executionTime = Date.now() - startTime;

          yield {
            type: 'complete',
            toolName: name,
            progress: 100,
            message: `Completed: ${tool.capability.displayName}`,
            data: result.data,
            preview: result.preview,
            metadata: result.metadata,
          };
        } catch (e) {
          completed = true;
          clearInterval(progressInterval);
          throw e;
        }
      }
    } catch (e: any) {
      const isTimeout = e.message?.includes('timeout');
      yield {
        type: 'error',
        toolName: name,
        progress: 0,
        message: isTimeout
          ? `Tool "${name}" timed out after ${timeoutMs}ms`
          : `Tool "${name}" failed: ${e.message}`,
        error: {
          code: isTimeout ? 'TOOL_TIMEOUT' : 'EXECUTION_FAILED',
          message: e.message,
        },
      };
    }
  }

  private async collectStreamResult(
    stream: AsyncGenerator<ToolResultChunk>,
    name: string,
    displayName: string,
  ): Promise<ToolResult> {
    let finalResult: ToolResult | null = null;
    let lastProgressChunk: ToolResultChunk | null = null;

    for await (const chunk of stream) {
      lastProgressChunk = chunk;
      if (chunk.type === 'complete') {
        finalResult = {
          status: 'success',
          data: chunk.data || {},
          preview: chunk.preview || '',
          metadata: chunk.metadata || {
            toolName: name,
            displayName,
            executionTime: 0,
          },
        };
      } else if (chunk.type === 'error') {
        finalResult = {
          status: 'error',
          data: {},
          preview: chunk.message || '',
          metadata: {
            toolName: name,
            displayName,
            executionTime: 0,
          },
          error: chunk.error,
        };
      }
    }

    if (!finalResult && lastProgressChunk) {
      finalResult = {
        status: 'partial',
        data: lastProgressChunk.data || {},
        preview:
          lastProgressChunk.preview ||
          `Tool "${name}" completed without final result`,
        metadata: {
          toolName: name,
          displayName,
          executionTime: 0,
        },
      };
    }

    return finalResult!;
  }

  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Tool execution timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  private truncateResult(result: ToolResult): ToolResult {
    const MAX_RESULT_CHARS = 16000;
    const preview = result.preview || '';
    if (preview.length <= MAX_RESULT_CHARS) return result;

    const head = preview.slice(0, MAX_RESULT_CHARS * 0.7);
    const tail = preview.slice(-MAX_RESULT_CHARS * 0.2);
    return {
      ...result,
      preview: `${head}\n\n[...truncated ${preview.length - MAX_RESULT_CHARS} chars...]\n\n${tail}`,
    };
  }
}
