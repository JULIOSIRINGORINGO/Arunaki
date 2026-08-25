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
import { normalizeArgs } from './services/args-normalizer.util.js';
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

  constructor(@Optional() cacheService?: ToolResultCacheService) {
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
      'desktop_excel_edit',
      'desktop_word_edit',
      'desktop_ppt_edit',
      'pdf_manage_pages',
      'pdf_stamp_image',
      'doc_compare_versions',
      'doc_redact_pii',
      'convert_document',
      'text_extractor',
      'desktop_open_excel',
      'desktop_open_word',
      'desktop_open_ppt',
      'vision_ai',
      'knowledge_live_fetch',
      'web_search',
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

  resolveToolAlias(name: string): string {
    if (!name) return name;
    const clean = name.toLowerCase().trim().replace(/[- ]/g, '_');
    const ALIAS_MAP: Record<string, string> = {
      // File tools
      read_file: 'read',
      read_file_lines: 'read',
      read_lines: 'read',
      view_file_lines: 'read',
      read_workspace_file: 'read',
      view_file: 'read',
      cat: 'read',
      write_file: 'write',
      write_workspace_file: 'write',
      create_file: 'write',
      edit_file: 'edit',
      edit_workspace_file: 'edit',
      patch_file: 'edit',
      modify_file: 'edit',
      delete_file: 'delete',
      remove_file: 'delete',
      rename_file: 'rename',
      move_file: 'rename',
      list_files: 'list',
      dir: 'list',
      ls: 'list',
      search_files: 'search_workspace',
      search: 'search_workspace',
      grep: 'search_workspace',
      find_in_files: 'search_workspace',

      // PII Redaction
      redact: 'doc_redact_pii',
      redact_pii: 'doc_redact_pii',
      doc_redact: 'doc_redact_pii',
      pii_redact: 'doc_redact_pii',
      mask_pii: 'doc_redact_pii',
      mask_data: 'doc_redact_pii',
      sensor_data: 'doc_redact_pii',

      // Document diffing
      diff: 'doc_compare_versions',
      compare: 'doc_compare_versions',
      compare_document: 'doc_compare_versions',
      compare_documents: 'doc_compare_versions',
      compare_versions: 'doc_compare_versions',
      compare_files: 'doc_compare_versions',
      diff_files: 'doc_compare_versions',
      document_diff: 'doc_compare_versions',
      doc_diff: 'doc_compare_versions',

      // PDF operations
      merge_pdf: 'pdf_manage_pages',
      pdf_merge: 'pdf_manage_pages',
      split_pdf: 'pdf_manage_pages',
      watermark_pdf: 'pdf_manage_pages',
      pdf_tool: 'pdf_manage_pages',
      pdf_util: 'pdf_manage_pages',
      pdf_utility: 'pdf_manage_pages',
      pdf: 'pdf_manage_pages',
      stamp_pdf: 'pdf_stamp_image',
      pdf_stamp: 'pdf_stamp_image',
      stamp_image: 'pdf_stamp_image',
      sign_pdf: 'pdf_stamp_image',

      // Office Native COM
      edit_excel: 'desktop_excel_edit',
      excel_edit: 'desktop_excel_edit',
      excel: 'desktop_excel_edit',
      read_excel: 'desktop_excel_edit',
      read_cell: 'desktop_excel_edit',
      read_range: 'desktop_excel_edit',
      list_sheets: 'desktop_excel_edit',
      write_cell: 'desktop_excel_edit',
      clone_sheet: 'desktop_excel_edit',
      clear_constants: 'desktop_excel_edit',
      open_excel: 'desktop_open_excel',
      edit_word: 'desktop_word_edit',
      word_edit: 'desktop_word_edit',
      word: 'desktop_word_edit',
      open_word: 'desktop_open_word',
      edit_ppt: 'desktop_ppt_edit',
      ppt_edit: 'desktop_ppt_edit',
      powerpoint: 'desktop_ppt_edit',
      open_ppt: 'desktop_open_ppt',

      // Conversion & Export
      convert: 'convert_document',
      export: 'generate_export',
      export_document: 'generate_export',
    };
    return ALIAS_MAP[clean] || clean;
  }

  isMutating(name: string, args?: Record<string, any>): boolean {
    const resolvedName = this.resolveToolAlias(name);
    const toolRecord = this.tools.get(resolvedName) || this.tools.get(name);
    if (!toolRecord) return false;
    if (!toolRecord.tool.mutating) return false;
    // Office COM editors are registered mutating, but a call whose actions are
    // ALL read-only is inspection, not mutation — miscounting it breaks the
    // Fast Cut-Off and post-mutation verification logic downstream.
    if (
      (name === 'desktop_excel_edit' ||
        name === 'desktop_word_edit' ||
        name === 'desktop_ppt_edit')
    ) {
      // Models send EITHER actions:[...] OR a flat single action:{action:...}.
      const effectiveActions: any[] = Array.isArray(args?.actions)
        ? args.actions
        : args?.action
          ? [{ action: args.action }]
          : [];
      if (effectiveActions.length > 0) {
        const READ_ONLY = new Set([
          'read_range',
          'read_cell',
          'find_cell',
          'list_sheets',
        ]);
        const allReadonly = effectiveActions.every(
          (a: any) => a && READ_ONLY.has(a.action),
        );
        if (allReadonly) return false;
      }
    }
    return true;
  }

  validateArgs(args: Record<string, any>, parameters: Record<string, any>) {
    return validateToolArgs(args, parameters);
  }

  async executeTool(
    name: string,
    rawArgs: Record<string, any>,
  ): Promise<ToolResult> {
    // Harness guidance choke point: normalize model-supplied args once for
    // every tool (trim/@-strip/numeric coercion/empty-drop) before validation.
    const args = normalizeArgs(name, rawArgs);
    const resolvedName = this.resolveToolAlias(name);
    const registered =
      this.tools.get(resolvedName) || this.tools.get(name);
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
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `Tool "${name}" not recognized`,
        },
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
          error: {
            code: 'TOOL_NOT_FOUND',
            message: `Tool "${name}" not recognized`,
          },
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
          error: {
            code: 'INVALID_ARGS',
            message: validation.errors.join('; '),
          },
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
