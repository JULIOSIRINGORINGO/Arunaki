import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AutoPostureDetector } from './auto-posture-detector.service.js';
import { ModelRouterService } from './model-router.service.js';
import { ToolRegistryService } from '../tools/tool-registry.service.js';
import { ContextManager } from './context-manager.js';
import {
  SYSTEM_PROMPT_CACHE_BOUNDARY,
  cacheStablePromptPrefix,
  hashStablePromptInput,
} from './system-prompt-cache.js';
import { encoding_for_model } from 'tiktoken';

@Injectable()
export class SystemPromptBuilderService {
  private readonly logger = new Logger(SystemPromptBuilderService.name);
  private enc = encoding_for_model('gpt-4');

  constructor(
    @Inject(forwardRef(() => AutoPostureDetector))
    private readonly postureDetector: AutoPostureDetector,
    private readonly modelRouter: ModelRouterService,
    private readonly toolRegistryService: ToolRegistryService,
    private readonly contextManager: ContextManager,
  ) {}

  loadPrompt(filename: string): string {
    try {
      // __dirname points to .../apps/api/dist/modules/ai/ or .../apps/api/src/modules/ai/
      // We need to navigate up to apps/api/ then into src/prompts/
      const baseDir = path.resolve(__dirname, '..', '..', '..', 'src', 'prompts');
      const fromCwd = path.resolve(process.cwd(), 'src', 'prompts', filename);
      const fromDirname = path.resolve(baseDir, filename);
      const promptPath = fs.existsSync(fromDirname) ? fromDirname : (fs.existsSync(fromCwd) ? fromCwd : path.resolve(process.cwd(), 'apps', 'api', 'src', 'prompts', filename));
      return fs.readFileSync(promptPath, 'utf-8');
    } catch (err: any) {
      this.logger.warn(
        `Failed to load prompt file "${filename}": ${err.message}`,
      );
      return `<!-- Failed to load ${filename} -->`;
    }
  }

  getSystemPrompt(
    mode: 'chat' | 'workspace',
    fallbackModel: string,
    currentModel?: string,
    workspaceContext?: string,
    knowledgeContext?: string,
    historyMessages?: Array<{ role: string; content: string }>,
    tools?: any[],
  ): string {
    // Detect posture from conversation history (chat mode only)
    let posturePrompt = '';
    if (mode === 'chat' && historyMessages && historyMessages.length > 0) {
      const postureResult =
        this.postureDetector.detectPostureFromHistory(historyMessages);
      posturePrompt = this.postureDetector.getPosturePrompt(
        postureResult.posture,
      );
    }

    // Apply model-specific formatting
    const modelAdditions = this.modelRouter.getSystemPromptAdditions(
      currentModel || fallbackModel,
    );

    // Dynamic tool list from registry
    const toolList = this.buildToolListSummary(tools);

    if (mode === 'workspace' && workspaceContext) {
      const identity = this.loadPrompt('identity.md');
      const rules = this.loadPrompt('rules.md');
      const verification = this.loadPrompt('verification.md');
      const memoryContext = this.loadPrompt('memory-context.md');

      const safeWorkspaceContext = this.contextManager.limitInjection(
        workspaceContext,
        'workspace-context',
      );

      const stablePrefix = cacheStablePromptPrefix(
        hashStablePromptInput({ identity, rules, memoryContext, verification, modelAdditions }),
        () => `${identity}\n\n${rules}\n\n${memoryContext}\n\n${verification}\n\n${modelAdditions}`,
      );

      const volatileSuffix = `${this.buildToolListSection(toolList)}\n\n---\n${safeWorkspaceContext}\n\n${this.buildWorkspaceMemorySection()}\n\n${this.buildTemporalContextSection()}`;

      const prompt = `${stablePrefix}${SYSTEM_PROMPT_CACHE_BOUNDARY}${volatileSuffix}`;
      this.checkPromptBudget(prompt, 'workspace');
      return prompt;
    }

    // Chat mode
    const identity = this.loadPrompt('chat-identity.md');
    const rules = this.loadPrompt('chat-rules.md');
    const knowledgeBuilder = this.loadPrompt('chat-knowledge-builder.md');

    const safeKnowledgeContext = knowledgeContext
      ? this.contextManager.limitInjection(knowledgeContext, 'knowledge-base')
      : '(No active Knowledge Base)';

    const stablePrefix = cacheStablePromptPrefix(
      hashStablePromptInput({ identity, rules, knowledgeBuilder, modelAdditions }),
      () => `${identity}\n\n${rules}\n\n${knowledgeBuilder}\n\n${modelAdditions}`,
    );

    const volatileSuffix = `${this.buildToolListSection(toolList)}\n\n---\n${posturePrompt}\n\n## Knowledge Graph Map\n${safeKnowledgeContext}\n\n${this.buildTemporalContextSection()}`;

    const prompt = `${stablePrefix}${SYSTEM_PROMPT_CACHE_BOUNDARY}${volatileSuffix}`;
    return prompt;
  }

  buildToolListSection(toolList: string): string {
    if (!toolList || toolList === 'No tools available.') return '';
    return `## Available Tools\n${toolList}\n`;
  }

  buildToolListSummary(tools?: any[]): string {
    const includedNames = tools ? new Set(tools.map(t => t.function?.name || t.name)) : null;
    let caps = this.toolRegistryService?.getToolCapabilities();
    if (includedNames && caps) {
      caps = caps.filter(c => includedNames.has(c.name));
    }
    if (!caps || caps.length === 0) {
      return '';
    }
    return caps.map(c => `\`${c.name}\``).join(', ');
  }

  checkPromptBudget(prompt: string, contextLabel: string): void {
    try {
      const tokens = this.enc.encode(prompt).length;
      if (tokens > 4000) {
        this.logger.warn(`[PROMPT BUDGET] ${contextLabel}: ${tokens} tokens — exceeds 4K threshold.`);
      }
    } catch {}
  }

  buildWorkspaceMemorySection(): string {
    return 'Memory: Use `memory_search` if historical facts/preferences are needed.';
  }

  buildTemporalContextSection(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');

    const dayIndo = new Intl.DateTimeFormat('id-ID', { weekday: 'long' }).format(now);
    const dayEng = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(now);
    const dateFormattedIndo = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(now);
    const dateFormattedEng = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric' }).format(now);

    const dateIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())} WIB`;

    return `System Time: ${dayEng} (${dayIndo}), ${dateFormattedEng} / ${dateFormattedIndo} (${dateIso}) ${timeStr}`;
  }
}
