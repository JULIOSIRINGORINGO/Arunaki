import { Injectable, Logger } from '@nestjs/common';
import {
  Tool,
  ToolDefinition,
  ToolCapability,
} from './interfaces/tool.interface.js';
import { ToolResult, ToolResultChunk, StreamingToolResult } from './interfaces/tool-result.interface.js';

interface RegisteredTool {
  tool: Tool;
  timeoutMs: number;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
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

  /**
   * Register a tool into the registry.
   * Called by tool services during OnModuleInit.
   */
  register(tool: Tool): void {
    const timeoutMs = tool.timeoutMs ?? 10000;
    this.tools.set(tool.name, { tool, timeoutMs });
    this.logger.log(`Tool registered: ${tool.name} (timeout: ${timeoutMs}ms)`);
  }

  /**
   * Get all tool definitions for LLM.
   */
  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((r) => r.tool.definition);
  }

  /**
   * Get all tool capabilities for discovery.
   */
  getToolCapabilities(): ToolCapability[] {
    return Array.from(this.tools.values()).map(
      (r) => r.tool.capability,
    ) as ToolCapability[];
  }

  /**
   * Get tools filtered by tags.
   */
  getToolsByTags(tags: string[]): ToolCapability[] {
    return this.getToolCapabilities().filter((cap) =>
      tags.some((tag) => cap.tags.includes(tag)),
    );
  }

  /**
   * Validate tool arguments against parameter schema.
   */
  validateArgs(
    args: Record<string, any>,
    parameters: Record<string, any>,
  ): ValidationResult {
    const errors: string[] = [];
    const required: string[] = parameters.required || [];
    const properties: Record<string, any> = parameters.properties || {};

    for (const field of required) {
      if (args[field] === undefined || args[field] === null) {
        errors.push(`Field "${field}" wajib diisi`);
      }
    }

    for (const [key, schema] of Object.entries(properties)) {
      const value = args[key];
      if (value === undefined || value === null) continue;

      const expectedType = schema.type;
      if (expectedType === 'string' && typeof value !== 'string') {
        errors.push(`Field "${key}" harus bertipe string`);
      }
      if (expectedType === 'number' && typeof value !== 'number') {
        errors.push(`Field "${key}" harus bertipe number`);
      }
      if (expectedType === 'array' && !Array.isArray(value)) {
        errors.push(`Field "${key}" harus berupa array`);
      }

      const enumValues = schema.enum;
      if (
        enumValues &&
        Array.isArray(enumValues) &&
        !enumValues.includes(value)
      ) {
        errors.push(
          `Field "${key}" harus salah satu dari: ${enumValues.join(', ')}`,
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Execute a single tool.
   */
  async executeTool(
    name: string,
    args: Record<string, any>,
  ): Promise<ToolResult> {
    const registered = this.tools.get(name);
    if (!registered) {
      return {
        status: 'error',
        data: {},
        preview: `Tool "${name}" tidak dikenali`,
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

    const validation = this.validateArgs(
      args,
      tool.definition.function.parameters,
    );
    if (!validation.valid) {
      return {
        status: 'error',
        data: { receivedArgs: args },
        preview: `Input tidak valid: ${validation.errors.join('; ')}`,
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
    const startTime = Date.now();

    try {
      const result = await this.executeWithTimeout(
        () => Promise.resolve(tool.execute(args)),
        timeoutMs,
      );
      result.metadata.executionTime = Date.now() - startTime;
      return result;
    } catch (e) {
      const isTimeout = e.message?.includes('timeout');
      return {
        status: 'error',
        data: {},
        preview: isTimeout
          ? `Tool "${name}" timeout setelah ${timeoutMs}ms`
          : `Tool "${name}" gagal: ${e.message}`,
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

  /**
   * Execute multiple tools in parallel.
   *
   * Tools are executed concurrently with independent timeouts.
   * Failed tools don't block other tools.
   *
   * @param toolCalls - Array of { name, args } to execute
   * @returns Array of results in same order as input
   */
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

  /**
   * Execute multiple tools with controlled concurrency.
   *
   * Limits concurrent executions to prevent resource exhaustion.
   * Useful when executing many tools simultaneously.
   *
   * @param toolCalls - Array of { name, args } to execute
   * @param maxConcurrency - Max parallel executions (default: 5)
   * @returns Array of results in same order as input
   */
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

  /**
   * Execute a tool with streaming results.
   * Yields progress chunks as the tool executes.
   *
   * @param name - Tool name
   * @param args - Tool arguments
   * @returns StreamingToolResult with async generator for chunks and promise for final result
   */
  executeToolStreaming(
    name: string,
    args: Record<string, any>,
  ): StreamingToolResult {
    const registered = this.tools.get(name);
    if (!registered) {
      // Return immediately with error
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
          preview: `Tool "${name}" tidak dikenali`,
          metadata: { toolName: name, displayName: name, executionTime: 0 },
          error: { code: 'TOOL_NOT_FOUND', message: `Tool "${name}" not recognized` },
        }),
      };
    }

    const { tool, timeoutMs } = registered;

    const validation = this.validateArgs(
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
          preview: `Input tidak valid: ${validation.errors.join('; ')}`,
          metadata: {
            toolName: name,
            displayName: tool.capability.displayName,
            executionTime: 0,
          },
          error: { code: 'INVALID_ARGS', message: validation.errors.join('; ') },
        }),
      };
    }

    // Create the async generator for streaming
    const stream = this.createToolStream(tool, name, args, timeoutMs);

    const finalResult = this.collectStreamResult(stream, name, tool.capability.displayName);

    return { stream, finalResult };
  }

  /**
   * Creates an async generator that yields progress chunks during tool execution.
   */
  private async *createToolStream(
    tool: any,
    name: string,
    args: Record<string, any>,
    timeoutMs: number,
  ): AsyncGenerator<ToolResultChunk> {
    const startTime = Date.now();
    let hasYieldedProgress = false;

    // Initial progress chunk
    yield {
      type: 'progress',
      toolName: name,
      progress: 0,
      message: `Memulai eksekusi ${tool.capability.displayName}...`,
    };

    try {
      // If tool has a streaming method, use it
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
        // For non-streaming tools, execute with timeout and yield progress
        let completed = false;
        const progressInterval = setInterval(() => {
          if (!completed && !hasYieldedProgress) {
            // Yield indeterminate progress
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

          // Yield completion
          yield {
            type: 'complete',
            toolName: name,
            progress: 100,
            message: `Selesai: ${tool.capability.displayName}`,
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
    } catch (e) {
      const isTimeout = e.message?.includes('timeout');
      yield {
        type: 'error',
        toolName: name,
        progress: 0,
        message: isTimeout
          ? `Tool "${name}" timeout setelah ${timeoutMs}ms`
          : `Tool "${name}" gagal: ${e.message}`,
        error: {
          code: isTimeout ? 'TOOL_TIMEOUT' : 'EXECUTION_FAILED',
          message: e.message,
        },
      };
    }
  }

  /**
   * Consumes the stream and returns the final ToolResult.
   */
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
      // No completion chunk received - construct from last progress
      finalResult = {
        status: 'partial',
        data: lastProgressChunk.data || {},
        preview: lastProgressChunk.preview || `Tool "${name}" completed without final result`,
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
}
