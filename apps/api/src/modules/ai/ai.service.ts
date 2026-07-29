import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { encoding_for_model } from 'tiktoken';
import * as fs from 'fs';
import * as path from 'path';
import {
  ProviderService,
  ProviderConfig,
} from '../provider/provider.service.js';
import { ContextManager } from './context-manager.js';
import { ContextRegistry } from './context/context-registry.service.js';
import { ModelRouterService, ModelHints } from './model-router.service.js';
import {
  AutoPostureDetector,
  PostureDetectionResult,
} from './auto-posture-detector.service.js';
import { runWithModelFallback } from './model-fallback.js';
import { streamWithFallback, StreamChunk } from './stream-chat.js';

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
    private readonly config: ConfigService,
    private readonly providerService: ProviderService,
    @Optional() @Inject(ContextRegistry) private readonly contextRegistry?: ContextRegistry,
  ) {
    this.fallbackApiKey = this.config.get<string>('AI_API_KEY') || '';
    this.fallbackBaseUrl =
      this.config.get<string>('AI_BASE_URL') || 'https://openrouter.ai/api/v1';
    this.fallbackModel =
      this.config.get<string>('AI_MODEL') ||
      'nvidia/nemotron-3-ultra-550b-a55b:free';
    this.enc = this.getEncodingForModel(this.fallbackModel);

    // Initialize services
    this.contextManager = new ContextManager(
      {
        contextLength: 128000,
        threshold: 0.5,
        targetRatio: 0.2,
        useLlmSummary: false,
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
      const dbConfig = await this.providerService.getActiveConfig();
      if (dbConfig) {
        return {
          ...dbConfig,
          baseUrl: dbConfig.baseUrl.replace(/\/$/, ''),
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
   * Build request headers for a provider.
   */
  private buildHeaders(provider: ProviderConfig): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
    };

    // OpenRouter requires HTTP-Referer
    if (provider.baseUrl.includes('openrouter.ai')) {
      headers['HTTP-Referer'] = 'https://arunaki.app';
      headers['X-Title'] = 'Arunaki AI Assistant';
    }

    // Custom headers from provider config
    if (provider.headerPrefix) {
      headers['HTTP-Referer'] = provider.headerPrefix;
    }
    if (provider.headerTitle) {
      headers['X-Title'] = provider.headerTitle;
    }

    return headers;
  }

  /**
   * Make a single API request to a provider.
   * Returns the response or throws on network/timeout errors.
   */
  private async makeRequest(
    provider: ProviderConfig,
    body: Record<string, any>,
    timeoutMs = 60000,
  ): Promise<{ response: Response; statusCode: number }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.buildHeaders(provider),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return { response, statusCode: response.status };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isAbort = err.name === 'AbortError';
      throw new Error(
        isAbort ? `Request timed out after ${timeoutMs}ms` : err.message,
      );
    }
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
   * Count tokens in a string using tiktoken
   */
  countTokens(text: string): number {
    try {
      return this.enc.encode(text).length;
    } catch {
      // Fallback: rough estimate (4 chars per token)
      return Math.ceil(text.length / 4);
    }
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
   * Prepare messages for API call using 4-phase context compression.
   *
   * Phase 1: Prune old tool results (keep last 3 unpruned)
   * Phase 2: Strip old images
   * Phase 3: Sanitize orphaned tool_call/tool_result pairs
   * Phase 4: Token-aware tail protection + structured summary (LLM or template)
   */
  async prepareMessages(
    messages: ChatMessage[],
    maxContextTokens?: number,
  ): Promise<ChatMessage[]> {
    if (this.contextRegistry) {
      return this.contextRegistry.getActive().compress(messages);
    }

    if (maxContextTokens && maxContextTokens !== 128000) {
      // Allow override — create temporary ContextManager
      const tempManager = new ContextManager(
        { contextLength: maxContextTokens },
        { chat: this.chat.bind(this) },
      );
      return tempManager.compress(messages);
    }
    return this.contextManager.compress(messages);
  }

  /**
   * Main chat method with credential pool + error classification.
   *
   * Flow:
   * 1. Get active provider
   * 2. Make request
   * 3. On error: classify → retry (same provider) or rotate (next provider)
   * 4. Max 3 retries per provider, max 3 provider rotations
   */
  async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
  ): Promise<AiResponse> {
    // Apply context management: prune large outputs + truncate if needed
    const preparedMessages = await this.prepareMessages(messages);

    // Get starting provider
    let provider = await this.getProviderConfig();

    if (!provider.apiKey) {
      throw new Error(
        'No API key configured. Go to Settings → AI Models to add a provider.',
      );
    }

    const body: Record<string, any> = {
      model: provider.model,
      messages: preparedMessages,
      temperature: 0.7,
      max_tokens: 4096,
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    const result = await runWithModelFallback({
      provider,
      body,
      makeRequest: (p, b) => this.makeRequest(p, b),
      getNextProvider: (currentId) => this.providerService.getNextAvailable(currentId),
      classifyError: (statusCode, errorBody) =>
        this.providerService.classifyError(statusCode, errorBody),
      recordUsage: (id) => this.providerService.recordUsage(id),
      recordError: (id, err) => this.providerService.recordError(id, err),
      setCooldown: (id, seconds) => this.providerService.setCooldown(id, seconds),
      logger: this.logger,
    });

    const choice = result.data.choices?.[0];
    if (!choice) {
      throw new Error('No response from AI');
    }

    let content = choice.message?.content || '';
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    if (!content && choice.message?.tool_calls?.length === 0) {
      content =
        'Maaf, saya tidak dapat memberikan jawaban saat ini. Silakan coba lagi.';
    }

    return {
      content,
      model: result.model,
      toolCalls: choice.message?.tool_calls || [],
      usage: {
        promptTokens: result.data.usage?.prompt_tokens || 0,
        completionTokens: result.data.usage?.completion_tokens || 0,
        totalTokens: result.data.usage?.total_tokens || 0,
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
    const preparedMessages = await this.prepareMessages(messages);

    const provider = await this.getProviderConfig();
    if (!provider.apiKey) {
      throw new Error(
        'No API key configured. Go to Settings → AI Models to add a provider.',
      );
    }

    const body: Record<string, any> = {
      model: provider.model,
      messages: preparedMessages,
      temperature: 0.7,
      max_tokens: 4096,
    };
    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    for await (const chunk of streamWithFallback({
      provider,
      body,
      makeRequest: (p, b) => this.makeRequest(p, b),
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
      } else if (chunk.type === 'tool_call') {
        yield chunk;
      } else if (chunk.type === 'done') {
        yield chunk;
      } else if (chunk.type === 'error') {
        yield chunk;
      }
    }
  }

  /**
   * Load a prompt file from the prompts directory.
   */
  private loadPrompt(filename: string): string {
    try {
      // Try dist/src/prompts (production) first, then src/prompts (dev)
      const distPath = path.join(
        __dirname,
        '..',
        '..',
        'src',
        'prompts',
        filename,
      );
      const srcPath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'src',
        'prompts',
        filename,
      );
      const filePath = fs.existsSync(distPath) ? distPath : srcPath;
      return fs.readFileSync(filePath, 'utf-8').trim();
    } catch (err: any) {
      this.logger.error(
        `Failed to load prompt file "${filename}": ${err.message}`,
      );
      return `<!-- Failed to load ${filename} -->`;
    }
  }

  getSystemPrompt(
    mode: 'chat' | 'workspace',
    workspaceContext?: string,
    knowledgeContext?: string,
    historyMessages?: Array<{ role: string; content: string }>,
  ): string {
    // Get model hints for current provider
    const providerConfig = this.getProviderConfigSync();

    // Detect posture from conversation history (chat mode only)
    let posturePrompt = '';
    if (mode === 'chat' && historyMessages && historyMessages.length > 0) {
      const postureResult =
        this.postureDetector.detectPostureFromHistory(historyMessages);
      posturePrompt = this.postureDetector.getPosturePrompt(
        postureResult.posture,
      );
      this.logger.debug(
        `Auto-posture: ${postureResult.posture} (${(postureResult.confidence * 100).toFixed(1)}%)`,
      );
    }

    // Apply model-specific formatting
    const modelAdditions = this.modelRouter.getSystemPromptAdditions(
      providerConfig?.model || this.fallbackModel,
    );

    if (mode === 'workspace' && workspaceContext) {
      // Workspace mode — load 6 modular prompt files
      const identity = this.loadPrompt('identity.md');
      const rules = this.loadPrompt('rules.md');
      const workspaceRules = this.loadPrompt('workspace-rules.md');
      const workspaceFlow = this.loadPrompt('workspace-flow.md');
      const verification = this.loadPrompt('verification.md');
      const memoryContext = this.loadPrompt('memory-context.md');

      const safeWorkspaceContext = this.limitInjection(
        workspaceContext,
        'workspace-context',
      );

      return `${identity}

${safeWorkspaceContext}

${rules}

${workspaceRules}

${workspaceFlow}

${memoryContext}

${verification}

${modelAdditions}`;
    }

    // Chat mode — load 3 modular prompt files
    const identity = this.loadPrompt('chat-identity.md');
    const rules = this.loadPrompt('chat-rules.md');
    const knowledgeBuilder = this.loadPrompt('chat-knowledge-builder.md');

    // Inject knowledge base into rules template
    const safeKnowledgeContext = knowledgeContext
      ? this.limitInjection(knowledgeContext, 'knowledge-base')
      : '(No active Knowledge Base)';
    const rulesWithKB = rules.replace('{KNOWLEDGE_BASE}', safeKnowledgeContext);

    return `${identity}

${rulesWithKB}

${knowledgeBuilder}

${modelAdditions}

${posturePrompt}`;
  }

  /**
   * Synchronous getter for provider config (used in sync getSystemPrompt).
   * Falls back to .env values.
   */
  private getProviderConfigSync(): ProviderConfig | null {
    try {
      // We can't use async here, so use fallback directly
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
