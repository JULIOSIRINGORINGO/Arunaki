import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { encoding_for_model } from 'tiktoken';
import * as fs from 'fs';
import * as path from 'path';
import { ProviderService, ProviderConfig } from '../provider/provider.service.js';
import { ContextManager } from './context-manager.js';

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

export interface AiResponse {
  content: string;
  model: string;
  toolCalls: ToolCall[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
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

  // Fallback values from .env (used if no provider configured in DB)
  private readonly fallbackApiKey: string;
  private readonly fallbackBaseUrl: string;
  private readonly fallbackModel: string;

  constructor(
    private readonly config: ConfigService,
    private readonly providerService: ProviderService,
  ) {
    this.fallbackApiKey =
      this.config.get<string>('AI_API_KEY') || '';
    this.fallbackBaseUrl =
      this.config.get<string>('AI_BASE_URL') || 'https://openrouter.ai/api/v1';
    this.fallbackModel =
      this.config.get<string>('AI_MODEL') || 'nvidia/nemotron-3-ultra-550b-a55b:free';
    this.enc = encoding_for_model('gpt-4' as any);

    // Initialize context manager with defaults
    this.contextManager = new ContextManager({
      contextLength: 128000,
      threshold: 0.50,
      targetRatio: 0.20,
    });
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
      throw new Error(isAbort ? `Request timed out after ${timeoutMs}ms` : err.message);
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
   * Phase 4: Token-aware tail protection + structured summary
   */
  prepareMessages(
    messages: ChatMessage[],
    maxContextTokens?: number,
  ): ChatMessage[] {
    if (maxContextTokens && maxContextTokens !== 128000) {
      // Allow override — create temporary ContextManager
      const tempManager = new ContextManager({ contextLength: maxContextTokens });
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
    const preparedMessages = this.prepareMessages(messages);

    // Get starting provider
    let provider = await this.getProviderConfig();

    if (!provider.apiKey) {
      throw new Error('No API key configured. Go to Settings → AI Models to add a provider.');
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

    // Pool state
    const MAX_RETRIES_PER_PROVIDER = 3;
    const MAX_ROTATIONS = 3;
    let rotationCount = 0;
    let triedProviders = new Set<string>([provider.id]);
    let lastError: string | undefined;

    while (rotationCount <= MAX_ROTATIONS) {
      let retryCount = 0;

      // Retry loop for the same provider (5xx errors)
      while (retryCount < MAX_RETRIES_PER_PROVIDER) {
        try {
          this.logger.log(
            `[${provider.name}] Request attempt (retry=${retryCount}, rotation=${rotationCount})`,
          );

          const { response, statusCode } = await this.makeRequest(provider, body);

          // Success
          if (response.ok) {
            // Record successful usage
            if (provider.id !== 'env-fallback') {
              await this.providerService.recordUsage(provider.id).catch(() => {});
            }

            const data = await response.json();
            const choice = data.choices?.[0];

            if (!choice) {
              throw new Error('No response from AI');
            }

            let content = choice.message?.content || '';
            content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

            if (!content && choice.message?.tool_calls?.length === 0) {
              content = 'Maaf, saya tidak dapat memberikan jawaban saat ini. Silakan coba lagi.';
            }

            return {
              content,
              model: data.model,
              toolCalls: choice.message?.tool_calls || [],
              usage: {
                promptTokens: data.usage?.prompt_tokens || 0,
                completionTokens: data.usage?.completion_tokens || 0,
                totalTokens: data.usage?.total_tokens || 0,
              },
            };
          }

          // Error — classify it
          const errorBody = await response.text();
          const classified = this.providerService.classifyError(statusCode, errorBody);

          this.logger.warn(
            `[${provider.name}] HTTP ${statusCode} → action: ${classified.action}`,
          );

          // Record error for this provider
          if (provider.id !== 'env-fallback') {
            await this.providerService
              .recordError(provider.id, `HTTP ${statusCode}: ${errorBody.substring(0, 200)}`)
              .catch(() => {});
          }

          if (classified.action === 'retry') {
            // 5xx: retry same provider with backoff
            retryCount++;
            if (retryCount < MAX_RETRIES_PER_PROVIDER) {
              await this.jitteredBackoff(retryCount);
              continue;
            }
            // Exhausted retries for this provider → try rotation
            break;
          }

          if (classified.action === 'rotate') {
            // 429/402/401/403/503: rotate to next provider
            if (provider.id !== 'env-fallback' && classified.cooldownSeconds) {
              await this.providerService
                .setCooldown(provider.id, classified.cooldownSeconds)
                .catch(() => {});
            }
            break; // Exit retry loop, enter rotation
          }

          if (classified.action === 'fatal') {
            throw new Error(classified.message);
          }
        } catch (err: any) {
          // Network/timeout error
          lastError = err.message;
          this.logger.warn(`[${provider.name}] Network error: ${err.message}`);
          retryCount++;
          if (retryCount < MAX_RETRIES_PER_PROVIDER) {
            await this.jitteredBackoff(retryCount);
            continue;
          }
          break;
        }
      }

      // Try rotation — get next available provider
      rotationCount++;
      if (rotationCount > MAX_ROTATIONS) {
        break;
      }

      const nextProvider = await this.providerService.getNextAvailable(provider.id);
      if (!nextProvider) {
        this.logger.warn('No more available providers for rotation');
        break;
      }

      this.logger.log(
        `Rotating: ${provider.name} → ${nextProvider.name} (rotation ${rotationCount}/${MAX_ROTATIONS})`,
      );
      triedProviders.add(nextProvider.id);
      provider = nextProvider;
    }

    // All providers exhausted
    throw new Error(
      `All providers exhausted after ${rotationCount} rotations. Last error: ${lastError || 'unknown'}`,
    );
  }

  /**
   * Load a prompt file from the prompts directory.
   */
  private loadPrompt(filename: string): string {
    try {
      // Try dist/src/prompts (production) first, then src/prompts (dev)
      const distPath = path.join(__dirname, '..', '..', 'src', 'prompts', filename);
      const srcPath = path.join(__dirname, '..', '..', '..', 'src', 'prompts', filename);
      const filePath = fs.existsSync(distPath) ? distPath : srcPath;
      return fs.readFileSync(filePath, 'utf-8').trim();
    } catch (err: any) {
      this.logger.error(`Failed to load prompt file "${filename}": ${err.message}`);
      return `<!-- Failed to load ${filename} -->`;
    }
  }

  getSystemPrompt(
    mode: 'chat' | 'workspace',
    workspaceContext?: string,
    knowledgeContext?: string,
  ): string {
    if (mode === 'workspace' && workspaceContext) {
      // Workspace mode — load 6 modular prompt files
      const identity = this.loadPrompt('identity.md');
      const rules = this.loadPrompt('rules.md');
      const workspaceRules = this.loadPrompt('workspace-rules.md');
      const workspaceFlow = this.loadPrompt('workspace-flow.md');
      const verification = this.loadPrompt('verification.md');
      const memoryContext = this.loadPrompt('memory-context.md');

      const safeWorkspaceContext = this.limitInjection(workspaceContext, 'workspace-context');

      return `${identity}

${safeWorkspaceContext}

${rules}

${workspaceRules}

${workspaceFlow}

${memoryContext}

${verification}`;
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

${knowledgeBuilder}`;
  }
}
