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
import { modelSupportsTools } from './model-capability.js';
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
    @Optional() private readonly toolRegistryService?: ToolRegistryService,
    @Optional() @Inject(ContextRegistry) private readonly contextRegistry?: ContextRegistry,
  ) {
    this.fallbackApiKey = this.config.get<string>('AI_API_KEY') || '';
    this.fallbackBaseUrl =
      this.config.get<string>('AI_BASE_URL') || 'https://openrouter.ai/api/v1';
    this.fallbackModel =
      this.config.get<string>('AI_MODEL') ||
      'openrouter/free';
    this.enc = this.getEncodingForModel(this.fallbackModel);

    // Initialize services
    this.contextManager = new ContextManager(
      {
        contextLength: 128000,
        threshold: 0.25,
        targetRatio: 0.2,
        toolPruneChars: 1000,
        toolPreviewChars: 250,
        injectionMaxChars: 2000,
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
    // Light trim: keep last 40 messages, skip 4-phase compression
    const trimmedMessages = messages.length > 40
      ? messages.slice(-40)
      : messages;

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

    const body: Record<string, any> = {
      model: provider.model,
      messages: trimmedMessages,
      temperature: 0.7,
      max_tokens: 4096,
    };

    const canUseTools = tools && tools.length > 0 && modelSupportsTools(provider.model);
    if (canUseTools) {
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
      const providerError = result.data?.error?.message || result.data?.message;
      const errorDetail = providerError
        ? `: ${providerError}`
        : ' (Penyedia AI memberikan respon kosong / server model gratis sedang sibuk)';
      throw new Error(`Gagal menerima respon dari AI${errorDetail}`);
    }

    let content = choice.message?.content || '';
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    let rawToolCalls = choice.message?.tool_calls || [];

    // OpenClaw Text Tool Call Extractor: If model outputted tool call in content text instead of native tool_calls array
    if (rawToolCalls.length === 0 && content) {
      const jsonBlockMatch =
        content.match(/```(?:json)?\s*(\{\s*"name"[\s\S]*?\})\s*```/i) ||
        content.match(/(\{\s*"name"\s*:\s*"[^"]+"[\s\S]*?\})/i) ||
        content.match(/(<tool_call>[\s\S]*?<\/tool_call>)/i);

      if (jsonBlockMatch && jsonBlockMatch[1]) {
        try {
          const rawString = jsonBlockMatch[1].replace(/<\/?tool_call>/gi, '').trim();
          const parsed = JSON.parse(rawString);
          if (parsed.name || parsed.function) {
            const name = parsed.name || (typeof parsed.function === 'string' ? parsed.function : parsed.function?.name);
            const args = parsed.arguments || parsed.parameters || parsed.args || {};
            if (name) {
              rawToolCalls = [
                {
                  id: `extracted-tool-${Date.now()}`,
                  type: 'function',
                  function: {
                    name,
                    arguments: typeof args === 'string' ? args : JSON.stringify(args),
                  },
                },
              ];
            }
          }
        } catch {
          // ignore parse failure
        }
      }
    }

    if (!content && rawToolCalls.length === 0) {
      content =
        'Maaf, saya tidak dapat memberikan jawaban saat ini. Silakan coba lagi.';
    }

    return {
      content,
      model: result.model,
      toolCalls: rawToolCalls,
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
    // Light trim, skip heavy 4-phase compression
    const trimmedMessages = messages.length > 40
      ? messages.slice(-40)
      : messages;

    const provider = await this.getProviderConfig();
    if (!provider.apiKey) {
      throw new Error(
        'No API key configured. Go to Settings → AI Models to add a provider.',
      );
    }

    const body: Record<string, any> = {
      model: provider.model,
      messages: trimmedMessages,
      temperature: 0.7,
      max_tokens: 4096,
    };
    const canUseTools = tools && tools.length > 0 && modelSupportsTools(provider.model);
    if (canUseTools) {
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

    // Dynamic tool list from registry (used in both modes)
    const toolList = this.buildToolListSummary();

    if (mode === 'workspace' && workspaceContext) {
      // Workspace mode — load prompt files
      const identity = this.loadPrompt('identity.md');
      let rules = this.loadPrompt('rules.md');
      const verification = this.loadPrompt('verification.md');
      const memoryContext = this.loadPrompt('memory-context.md');

      const safeWorkspaceContext = this.limitInjection(
        workspaceContext,
        'workspace-context',
      );

      // Inject dynamic tool list into rules
      rules = rules.replace('{TOOL_LIST}', toolList);

       const prompt = `${identity}

 ${rules}

 ${memoryContext}

 ${verification}

 ${modelAdditions}

 ---
 ${safeWorkspaceContext}

 ${this.buildWorkspaceMemorySection()}

 ${this.buildTemporalContextSection()}`;

      this.checkPromptBudget(prompt, 'workspace');
      return prompt;
    }

    // Chat mode — load 3 modular prompt files
    const identity = this.loadPrompt('chat-identity.md');
    let rules = this.loadPrompt('chat-rules.md');
    const knowledgeBuilder = this.loadPrompt('chat-knowledge-builder.md');

    // Inject knowledge base into rules template
    const safeKnowledgeContext = knowledgeContext
      ? this.limitInjection(knowledgeContext, 'knowledge-base')
      : '(No active Knowledge Base)';
    rules = rules.replace('{TOOL_LIST}', toolList);

    const prompt = `${identity}

${rules}

${knowledgeBuilder}

${modelAdditions}

---
${posturePrompt}

## Active Knowledge Base
${safeKnowledgeContext}`;

    this.checkPromptBudget(prompt, 'chat');
    return prompt;
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

  /**
   * Build a dynamic tool list summary from the tool registry.
   * Categories are inferred from tool tags, not hardcoded names.
   */
  private buildToolListSummary(): string {
    const caps = this.toolRegistryService?.getToolCapabilities();
    if (!caps || caps.length === 0) {
      return 'No tools available.';
    }

    const tagCategory: Record<string, string> = {
      files: 'Workspace', workspace: 'Workspace',
      read: 'Workspace', write: 'Workspace',
      search: 'Workspace', fts: 'Workspace',
      extract: 'Data', data: 'Data',
      calculate: 'Data', math: 'Data', sql: 'Data',
      export: 'Export', document: 'Export',
      pdf: 'Export', docx: 'Export', xlsx: 'Export',
      knowledge: 'Knowledge',
      memory: 'Memory', recall: 'Memory', history: 'Memory',
      skills: 'Skills', workflow: 'Skills',
      browser: 'Interactive', desktop: 'Interactive', interactive: 'Interactive',
      web: 'Web', internet: 'Web',
      converter: 'Conversion', currency: 'Conversion', unit: 'Conversion',
      draft: 'Communication', communication: 'Communication',
      ocr: 'Vision', vision: 'Vision', image: 'Vision',
    };

    const categorized = new Map<string, { name: string; desc: string }[]>();
    const other: { name: string; desc: string }[] = [];
    const categoryOrder = ['Workspace', 'Data', 'Export', 'Knowledge', 'Memory', 'Skills', 'Vision', 'Web', 'Conversion', 'Communication', 'Interactive'];

    for (const cap of caps) {
      const entry = {
        name: cap.name,
        desc: cap.description?.split('.')[0]?.trim() || '',
      };
      let placed = false;
      for (const tag of cap.tags || []) {
        const category = tagCategory[tag];
        if (category) {
          if (!categorized.has(category)) categorized.set(category, []);
          categorized.get(category)!.push(entry);
          placed = true;
          break;
        }
      }
      if (!placed) other.push(entry);
    }

    const lines: string[] = [];
    for (const category of categoryOrder) {
      const tools = categorized.get(category);
      if (!tools || tools.length === 0) continue;
      lines.push(`**${category}:**`);
      for (const t of tools) lines.push(`- \`${t.name}\` — ${t.desc}`);
      lines.push('');
    }
    if (other.length > 0) {
      lines.push('**Other:**');
      for (const t of other) lines.push(`- \`${t.name}\` — ${t.desc}`);
    }

    return lines.join('\n').trim() || 'No tools available.';
  }

  /**
   * Log a warning if the system prompt exceeds the context budget.
   * Free models typically have 8K-32K context; paid models 128K+.
   */
  private checkPromptBudget(prompt: string, contextLabel: string): void {
    try {
      const tokens = this.enc.encode(prompt).length;
      if (tokens > 6000) {
        this.logger.warn(
          `[PROMPT BUDGET] ${contextLabel}: ${tokens} tokens — exceeds 6K threshold. Consider reducing prompt size.`,
        );
      } else if (tokens > 3000) {
        this.logger.log(
          `[PROMPT BUDGET] ${contextLabel}: ${tokens} tokens — moderate size.`,
        );
      } else {
        this.logger.debug(
          `[PROMPT BUDGET] ${contextLabel}: ${tokens} tokens — within budget.`,
        );
      }
    } catch {
      // Token counting is best-effort
    }
  }

  private buildWorkspaceMemorySection(): string {
    return [
      '=== MEMORY (from prior sessions) ===',
      'Use memory_search tool to recall relevant facts, preferences, decisions, and patterns from past interactions with this workspace.',
      'Memory is automatically saved after each workspace run.',
      '=== END MEMORY ===',
    ].join('\n');
  }

  private buildTemporalContextSection(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())} WIB`;
    return [
      '=== TEMPORAL CONTEXT ===',
      `Current date: ${dateStr}`,
      `Current time: ${timeStr}`,
      'Always reference dates and times relative to the current date.',
      '=== END TEMPORAL CONTEXT ===',
    ].join('\n');
  }
}
