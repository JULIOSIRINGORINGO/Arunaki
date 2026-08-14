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
      const promptPath = path.resolve(process.cwd(), 'apps/api/src/prompts', filename);
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
    return `## Tools Available\n\n${toolList || 'No tools available.'}\n`;
  }

  buildToolListSummary(tools?: any[]): string {
    const includedNames = tools ? new Set(tools.map(t => t.function?.name || t.name)) : null;
    let caps = this.toolRegistryService?.getToolCapabilities();
    if (includedNames && caps) {
      caps = caps.filter(c => includedNames.has(c.name));
    }
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

  checkPromptBudget(prompt: string, contextLabel: string): void {
    try {
      const tokens = this.enc.encode(prompt).length;
      if (tokens > 6000) {
        this.logger.warn(`[PROMPT BUDGET] ${contextLabel}: ${tokens} tokens — exceeds 6K threshold.`);
      }
    } catch {}
  }

  buildWorkspaceMemorySection(): string {
    return [
      '=== MEMORY (from prior sessions) ===',
      'Use memory_search tool to recall relevant facts, preferences, decisions, and patterns from past interactions with this workspace.',
      'Memory is automatically saved after each workspace run.',
      '=== END MEMORY ===',
    ].join('\n');
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

    return [
      '=== TEMPORAL CONTEXT (REAL-TIME SYSTEM DATE & TIME) ===',
      `Current Day: ${dayEng} (${dayIndo})`,
      `Current Date: ${dateFormattedEng} / ${dateFormattedIndo} (${dateIso})`,
      `Current Time: ${timeStr}`,
      'The system has real-time access to the local system date and time.',
      'Use this temporal context to accurately answer date/time queries and update daily reports in the user\'s language.',
      '=== END TEMPORAL CONTEXT ===',
    ].join('\n');
  }
}
