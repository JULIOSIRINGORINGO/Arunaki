import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { encoding_for_model } from 'tiktoken';
import * as fs from 'fs';
import * as path from 'path';
import { generateText, streamText, tool, jsonSchema, type ToolSet } from 'ai';
import type { ModelMessage } from '@ai-sdk/provider-utils';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { repairToolCalls } from './tool-call-repair.js';
import {
  ProviderService,
  ProviderConfig,
} from '../provider/provider.service.js';
import { ContextManager, ESTIMATED_CHARS_PER_TOKEN } from './context-manager.js';
import { countTokens as tokenize } from './tokenizer.js';
import { ModelRouterService, ModelHints } from './model-router.service.js';
import {
  AutoPostureDetector,
  PostureDetectionResult,
} from './auto-posture-detector.service.js';
import { streamWithFallback, StreamChunk } from './stream-chat.js';

export type { ProviderConfig, StreamChunk };
import { runWithModelFallback } from './model-fallback.js';
import { modelSupportsTools, scaleMaxTokens, getModelCapability } from './model-capability.js';
import {
  cacheStablePromptPrefix,
  hashStablePromptInput,
  SYSTEM_PROMPT_CACHE_BOUNDARY,
} from './system-prompt-cache.js';
import { ToolRegistryService } from '../tools/tool-registry.service.js';

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface AiAttempt {
  providerId: string;
  providerName: string;
  retry: number;
  rotation: number;
  outcome: 'success' | 'retry' | 'rotate' | 'fatal';
  statusCode?: number;
  error?: string;
}

export interface AiResponse {
  content: string;
  model: string;
  toolCalls: ToolCall[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  attempts: AiAttempt[];
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

import { SystemPromptBuilderService } from './system-prompt-builder.service.js';
import {
  toSdkMessages,
  toSdkTools,
  buildProviderOptions,
  makeSdkRequest,
  makeSdkRequestStream,
} from './sdk-transformer.util.js';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly enc: ReturnType<typeof encoding_for_model>;
  private readonly contextManager: ContextManager;
  private readonly modelRouter: ModelRouterService;
  private readonly postureDetector: AutoPostureDetector;

  // Fallback values from .env (used if no provider configured in DB)
  private readonly fallbackApiKey: string;
  private readonly fallbackBaseUrl: string;
  private readonly fallbackModel: string;

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(ProviderService) private readonly providerService: ProviderService,
    @Optional() @Inject(forwardRef(() => ToolRegistryService)) private readonly toolRegistryService?: ToolRegistryService,
    @Optional() @Inject(SystemPromptBuilderService) private readonly systemPromptBuilder?: SystemPromptBuilderService,
  ) {
    this.fallbackApiKey = this.config.get<string>('AI_API_KEY') || '';
    this.fallbackBaseUrl =
      this.config.get<string>('AI_BASE_URL') || 'https://kenari.id/v1';
    this.fallbackModel =
      this.config.get<string>('AI_MODEL') ||
      'deepseek-v4-flash';
    this.enc = this.getEncodingForModel(this.fallbackModel);

    // Initialize services
    this.contextManager = new ContextManager(
      {
        // Model-window-aware default (OpenClaw compaction): the pre-prompt
        // guard already derives the live window from the provider model via
        // getModelCapability; this constructor default only matters when no
        // explicit window is passed (e.g. legacy context engine fallback).
        contextLength: getModelCapability(this.fallbackModel).contextWindow ?? 32000,
        threshold: 0.25,
        targetRatio: 0.2,
        toolPruneChars: 1000,
        toolPreviewChars: 250,
        injectionMaxChars: 2000,
        useLlmSummary: true,
      },
      { chat: this.chat.bind(this) },
    );
    this.modelRouter = new ModelRouterService();
    this.postureDetector = new AutoPostureDetector();
  }

  /**
   * Get active provider config from DB, fallback to .env
   */
  private async getProviderConfig(): Promise<ProviderConfig> {
    try {
      // Try active DB provider, but skip if it is cooling down (to avoid repeated hangs)
    const dbConfig = await this.providerService.getActiveConfigRespectingCooldown();
      if (dbConfig) {
        const primaryModel = dbConfig.model
          ? dbConfig.model.split(',')[0].trim()
          : dbConfig.model;
        return {
          ...dbConfig,
          baseUrl: dbConfig.baseUrl.replace(/\/$/, ''),
          model: primaryModel,
        };
      }
    } catch (err: any) {
      this.logger.warn(`Failed to load provider from DB: ${err.message}`);
    }

    // Fallback to .env
    return {
      id: 'env-fallback',
      name: '.env Fallback',
      type: 'openai-compatible',
      baseUrl: this.fallbackBaseUrl.replace(/\/$/, ''),
      apiKey: this.fallbackApiKey,
      model: this.fallbackModel,
    };
  }

  /**
   * Resolve the active provider's model and its context budget. Lets callers
   * (workspace runner, compaction) scale context/compaction thresholds to the
   * real model window (e.g. 32K for deepseek-v4-flash) instead of a fixed
   * 128K default — the LLM is never handed a history larger than it can see.
   */
  async getActiveModelContext(): Promise<{
    model: string;
    contextWindow: number;
    maxTokens: number;
  }> {
    const provider = await this.getProviderConfig();
    const cap = getModelCapability(provider.model);
    return {
      model: provider.model,
      contextWindow: cap.contextWindow ?? 32000,
      maxTokens: scaleMaxTokens(provider.model),
    };
  }



  /**
   * Sleep with jittered exponential backoff.
   * attempt 1 → 1-2s, attempt 2 → 2-4s, attempt 3 → 4-8s
   */
  private async jitteredBackoff(attempt: number, baseMs = 1000): Promise<void> {
    const maxDelay = baseMs * Math.pow(2, attempt);
    const delay = Math.floor(Math.random() * maxDelay) + baseMs;
    this.logger.log(`Backoff: waiting ${delay}ms (attempt ${attempt})`);
    await new Promise((r) => setTimeout(r, delay));
  }

  /**
   * Get appropriate tiktoken encoding for a model.
   * Defaults to cl100k_base (compatible with GPT-4, most modern models).
   */
  private getEncodingForModel(model: string): ReturnType<typeof encoding_for_model> {
    try {
      // Try exact model match first
      return encoding_for_model(model as any);
    } catch {
      // Fallback: use cl100k_base for most modern models
      return encoding_for_model('gpt-4');
    }
  }

  /**
   * Count tokens in a string using tiktoken.
   * Shared with ContextManager via tokenizer util (cached, char/4 fallback).
   */
  countTokens(text: string): number {
    return tokenize(text);
  }

  /**
   * Count tokens in a message array.
   * Delegates to ContextManager's char-based estimation for speed.
   */
  countMessageTokens(messages: ChatMessage[]): number {
    return this.contextManager.estimateTokens(messages);
  }

  /**
   * Limit injected content (skills, memory, knowledge) to safe size.
   * Prevents large injections from eating context budget.
   */
  limitInjection(content: string, label: string): string {
    return this.contextManager.limitInjection(content, label);
  }

  /**
   * Pre-prompt context guard (OpenClaw preemptive-compaction + aggregate
   * tool-result budget). Runs BEFORE the provider request:
   * 1. Strips `<think>` blocks from all but the latest assistant message.
   * 2. Truncates old tool results so their total ≤ 50% of the context window.
   * 3. Estimates prompt pressure; when over the context budget minus the
   *    max_tokens reserve, chooses the cheapest route that fits:
   *    - truncate-only: old tool results alone cover the overflow (history
   *      structure preserved)
   *    - compact: full compression pipeline
   */
  private async preemptivelyCompact(
    messages: ChatMessage[],
    model: string,
  ): Promise<ChatMessage[]> {
    const contextWindow = getModelCapability(model).contextWindow ?? 32000;

    const deReasoned = this.contextManager.stripThinkingFromContext(messages);

    const budgeted = this.contextManager.enforceAggregateToolResultBudget(
      deReasoned,
      contextWindow,
    );
    if (budgeted.truncatedCount > 0) {
      this.logger.log(
        `[aggregate-tool-result] truncated ${budgeted.truncatedCount} old tool result(s) to stay within 50% of ${contextWindow}-token context`,
      );
    }

    const reserve = scaleMaxTokens(model);
    const budgetBeforeReserve = Math.max(1, contextWindow - reserve);
    const estimated = this.contextManager.estimatePromptTokens(budgeted.messages);
    if (estimated <= budgetBeforeReserve) {
      return budgeted.messages;
    }

    const overflowTokens = estimated - budgetBeforeReserve;
    const overflowChars = overflowTokens * ESTIMATED_CHARS_PER_TOKEN;
    // Buffer (OpenClaw TRUNCATION_ROUTE_BUFFER_TOKENS=512): require the
    // truncate-only route to comfortably exceed the overflow before choosing
    // it, so we don't thrash between routes on every turn.
    const truncateOnlyThresholdChars = Math.max(
      overflowChars + 2048,
      Math.ceil(overflowChars * 1.5),
    );
    const reducible = this.contextManager.estimateToolResultReduction(
      budgeted.messages,
    );

    if (reducible >= truncateOnlyThresholdChars) {
      this.logger.warn(
        `[preemptive-compaction] truncate-only route: ${reducible} reducible tool-result chars ≥ ${truncateOnlyThresholdChars} needed — pruning tool results instead of compacting (${estimated} tokens > ${budgetBeforeReserve})`,
      );
      return this.contextManager.truncateToolResultsOnly(budgeted.messages);
    }

    this.logger.warn(
      `[preemptive-compaction] compact route: ${reducible} reducible tool-result chars < ${truncateOnlyThresholdChars} needed — running full compression (${estimated} tokens > ${budgetBeforeReserve})`,
    );
    return this.contextManager.compress(budgeted.messages, contextWindow);
  }

  /**
   * Main chat method with credential pool + error classification.
   *
   * Flow:
   * 1. Get active provider
   * 2. (Light) trim messages if needed — skip 4-phase compression for free models
   * 3. Make request
   * 4. On error: classify → retry (same provider) or rotate (next provider)
   * 5. Max 3 retries per provider, max 3 provider rotations
   */
  async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: { preferredProviderId?: string },
  ): Promise<AiResponse> {
    const trimmedMessages = messages;

    // Get starting provider (optionally pinned for logical failover retries)
    let provider = options?.preferredProviderId
      ? await this.providerService.getById(options.preferredProviderId)
      : null;
    if (!provider) {
      provider = await this.getProviderConfig();
    }

    if (!provider.apiKey) {
      throw new Error(
        'No API key configured. Go to Settings → AI Models to add a provider.',
      );
    }

    // Pre-prompt guard: aggregate tool-result budget + pressure estimate.
    // Compact before sending instead of letting the provider reject an
    // over-budget prompt.
    const preparedMessages = await this.preemptivelyCompact(
      trimmedMessages,
      provider.model,
    );

    const body: Record<string, any> = {
      messages: preparedMessages,
      temperature: 0.7,
      maxOutputTokens: scaleMaxTokens(provider.model),
      providerOptions: buildProviderOptions(provider, provider.model),
    };

    const canUseTools = tools && tools.length > 0 && modelSupportsTools(provider.model);
    if (canUseTools) {
      body.tools = tools;
    }

    const result = await runWithModelFallback({
      provider,
      body,
      makeRequest: (p, b) => makeSdkRequest(p, b),
      getNextProvider: (currentId, triedIds = []) => this.providerService.getNextAvailable(currentId, triedIds),
      classifyError: (statusCode, errorBody) =>
        this.providerService.classifyError(statusCode, errorBody),
      recordUsage: (id) => this.providerService.recordUsage(id),
      recordError: (id, err) => this.providerService.recordError(id, err),
      setCooldown: (id, seconds) => this.providerService.setCooldown(id, seconds),
      logger: this.logger,
    });

    const data = result.data;

    let content = data.text || '';

    // Model fallback often generates HTML-escaped tags (e.g. &lt;function)
    // We must unescape them so repairToolCalls and stripping regex can catch them.
    content = content
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&amp;/g, '&');

    const cleanContent = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    content = cleanContent || content.replace(/<\/?think>/gi, '').trim();

    let rawToolCalls: ToolCall[] = (data.toolCalls || []).map((tc: any) => ({
      id: tc.toolCallId,
      type: 'function',
      function: {
        name: tc.toolName,
        arguments:
          typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input ?? {}),
      },
    }));

    // Tool Call Repair (OpenClaw tool-call-repair approach): cheap/free models
    // often leak tool calls as TEXT in various formats instead of the native
    // tool_calls array. Normalize them so a leaked call still executes.
    if (rawToolCalls.length === 0 && content) {
      rawToolCalls = repairToolCalls(content);
      if (rawToolCalls.length > 0) {
        this.logger.log(
          `[tool-call-repair] repaired ${rawToolCalls.length} leaked tool call(s) from text`,
        );
        // Strip bare json blocks only if they were repaired into tool calls
        content = content
          .replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```/g, '')
          .trim();
      }
    }

    if (content) {
      // Always strip hallucinated XML-ish tags (Gemini/DeepSeek often leak these)
      content = content
        .replace(/<\s*tool_call\s*>[\s\S]*?<\/\s*tool_call\s*>/gi, '')
        .replace(/<\s*function_call\s*>[\s\S]*?<\/\s*function_call\s*>/gi, '')
        .replace(/<\s*function(?:[^>]*)>[\s\S]*?<\/\s*function\s*>/gi, '')
        .trim();
    }

    if (!content && rawToolCalls.length === 0) {
      content =
        'Sorry, I am unable to provide an answer right now. Please try again.';
    }

    const promptTokens = data.usage?.inputTokens ?? 0;
    const completionTokens = data.usage?.outputTokens ?? 0;

    return {
      content,
      model: result.model,
      toolCalls: rawToolCalls,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      attempts: result.attempts.map((a) => ({
        providerId: a.providerId,
        providerName: a.providerName,
        retry: a.retry,
        rotation: a.rotation,
        outcome: a.outcome,
        statusCode: a.statusCode,
        error: a.error,
      })),
    };
  }

  /**
   * Streaming chat with provider fallback.
   * Returns async generator yielding StreamChunk objects.
   */
  async *chatStream(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
  ): AsyncGenerator<StreamChunk> {
    const trimmedMessages = messages;

    const provider = await this.getProviderConfig();
    if (!provider.apiKey) {
      throw new Error(
        'No API key configured. Go to Settings → AI Models to add a provider.',
      );
    }

    const preparedMessages = await this.preemptivelyCompact(
      trimmedMessages,
      provider.model,
    );

    const body: Record<string, any> = {
      messages: preparedMessages,
      temperature: 0.7,
      maxOutputTokens: scaleMaxTokens(provider.model),
      providerOptions: buildProviderOptions(provider, provider.model),
    };
    const canUseTools = tools && tools.length > 0 && modelSupportsTools(provider.model);
    if (canUseTools) {
      body.tools = tools;
    }

    for await (const chunk of streamWithFallback({
      provider,
      body,
      makeRequest: (p, b) => makeSdkRequestStream(p, b),
      getNextProvider: (currentId) => this.providerService.getNextAvailable(currentId),
      classifyError: (statusCode, errorBody) =>
        this.providerService.classifyError(statusCode, errorBody),
      recordUsage: (id) => this.providerService.recordUsage(id),
      recordError: (id, err) => this.providerService.recordError(id, err),
      setCooldown: (id, seconds) => this.providerService.setCooldown(id, seconds),
    })) {
      if (chunk.type === 'content' && chunk.content) {
        const cleaned = chunk.content.replace(/<think>[\s\S]*?<\/think>/gi, '');
        if (cleaned) {
          yield { type: 'content', content: cleaned };
        }
      } else {
        yield chunk;
      }
    }
  }



  getSystemPrompt(
    mode: 'chat' | 'workspace',
    workspaceContext?: string,
    knowledgeContext?: string,
    historyMessages?: Array<{ role: string; content: string }>,
    tools?: any[],
  ): string {
    const providerConfig = this.getProviderConfigSync();
    const currentModel = providerConfig?.model || this.fallbackModel;
    if (this.systemPromptBuilder) {
      return this.systemPromptBuilder.getSystemPrompt(
        mode,
        this.fallbackModel,
        currentModel,
        workspaceContext,
        knowledgeContext,
        historyMessages,
        tools,
      );
    }
    return '';
  }

  /**
   * Synchronous getter for provider config (used in sync getSystemPrompt).
   * Falls back to .env values.
   */
  private getProviderConfigSync(): ProviderConfig | null {
    try {
      return {
        id: 'env-fallback',
        name: '.env Fallback',
        type: 'openai-compatible',
        baseUrl: this.fallbackBaseUrl.replace(/\/$/, ''),
        apiKey: this.fallbackApiKey,
        model: this.fallbackModel,
      };
    } catch {
      return null;
    }
  }
}
