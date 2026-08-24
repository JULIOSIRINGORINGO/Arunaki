import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { AiService, ChatMessage, ToolDefinition } from '../../ai/ai.service.js';
import { ContextRegistry } from '../../ai/context/context-registry.service.js';
import { ToolRegistryService } from '../../tools/tool-registry.service.js';
import { FileService } from '../../file/file.service.js';
import { SmartRecallService } from '../../memory/smart-recall.service.js';
import { SelfHealingService } from '../../ai/self-healing.service.js';
import { PromptInjectionDetector } from '../../ai/prompt-injection-detector.service.js';
import { ToolResultFormatter } from '../../tools/utils/tool-result-formatter.js';
import { PrismaService } from '../../../common/providers/prisma.service.js';
import { extractMentionedFilenames } from '../utils/tool-call-extractor.util.js';
import { getSystemDateTimeContext } from '../../ai/context/date-time-context.js';
import { isCompactModel } from '../../ai/model-capability.js';
import { WorkspaceCartographerService } from './workspace-cartographer.service.js';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Regex matching office-document keywords in user goals (Indonesian + English).
 * Users mix languages freely — keep synonym sets symmetric across both.
 * Language-neutral @file-extension signals are checked separately and always win.
 */
const OFFICE_EXCEL_RE =
  /(?:excel|xlsx|xlsm|xls|spreadsheet|sheet|tabel|rekap|laporan|keuangan|pemasukan|pengeluaran|penjualan|stok|inventori|report|sales|revenue|expense|income|stock|inventory|finance|ledger)/i;
const OFFICE_WORD_RE =
  /(?:word|docx|document|surat|dokumen|letter|memo|contract|kontrak|proposal)/i;
const OFFICE_PPT_RE =
  /(?:pptx|ppt|powerpoint|presentasi|slide|presentation|deck)/i;
const MUTATION_KEYWORDS_RE =
  /\b(catat|update|ubah|isi|buat|tambah|edit|tulis|hapus|format|bold|export|rekap|lengkapi|siapkan|ganti|pindah|salin|copy|paste|convert|jadikan|beri|set|masukkan|input|perbarui|create|add|write|change|replace|remove|delete|fill|prepare|rename|move|insert|apply|record|enter)\b/i;

@Injectable()
export class WorkspacePromptBuilderService {
  private readonly logger = new Logger(WorkspacePromptBuilderService.name);
  private readonly lastSyncedMap = new Map<string, number>();

  constructor(
    @Inject(forwardRef(() => AiService)) private readonly aiService: AiService,
    @Inject(forwardRef(() => ToolRegistryService))
    private readonly toolRegistryService: ToolRegistryService,
    @Inject(forwardRef(() => FileService))
    private readonly fileService: FileService,
    @Inject(forwardRef(() => SmartRecallService))
    private readonly smartRecallService: SmartRecallService,
    @Inject(forwardRef(() => SelfHealingService))
    private readonly selfHealingService: SelfHealingService,
    @Inject(forwardRef(() => PromptInjectionDetector))
    private readonly promptInjectionDetector: PromptInjectionDetector,
    @Inject(forwardRef(() => PrismaService))
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ContextRegistry))
    private readonly contextRegistry: ContextRegistry,
    @Inject(forwardRef(() => WorkspaceCartographerService))
    private readonly cartographerService: WorkspaceCartographerService,
  ) {}

  async syncWorkspacePhysicalFiles(workspaceId: string): Promise<void> {
    const lastSynced = this.lastSyncedMap.get(workspaceId) || 0;
    if (Date.now() - lastSynced < 15000) {
      return;
    }
    this.lastSyncedMap.set(workspaceId, Date.now());

    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { rootPath: true },
      });

      if (!workspace?.rootPath) return;

      const fsPromises = await import('fs/promises');
      let entries: any[] = [];
      try {
        entries = await fsPromises.readdir(workspace.rootPath, {
          withFileTypes: true,
        });
      } catch {
        return;
      }

      let source = await this.prisma.source.findFirst({
        where: { workspaceId },
      });
      if (!source) {
        source = await this.prisma.source.create({
          data: {
            workspaceId,
            name: 'Local Directory',
            type: 'local',
            status: 'ready',
          },
        });
      }

      const existingDbFiles =
        await this.fileService.findByWorkspaceId(workspaceId);
      const existingPaths = new Set(
        existingDbFiles.map((f) => f.path.toLowerCase()),
      );
      const existingNames = new Set(
        existingDbFiles.map((f) => f.name.toLowerCase()),
      );

      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules')
          continue;
        const fullPath = path.join(workspace.rootPath, entry.name);
        if (entry.isFile()) {
          const lowerPath = fullPath.toLowerCase();
          const lowerName = entry.name.toLowerCase();
          if (!existingPaths.has(lowerPath) && !existingNames.has(lowerName)) {
            try {
              const stat = await fsPromises.stat(fullPath);
              const ext = path
                .extname(entry.name)
                .toLowerCase()
                .replace('.', '');
              await this.fileService.createFile({
                sourceId: source.id,
                name: entry.name,
                path: fullPath,
                type: ext || 'file',
                size: stat.size,
              });
              this.logger.log(`Synced new physical file to DB: ${entry.name}`);
            } catch {
              // ignore
            }
          }
        }
      }
    } catch (err: any) {
      this.logger.debug(`syncWorkspacePhysicalFiles failed: ${err.message}`);
    }
  }

  async selectToolsForGoal(
    goal: string,
    allTools: ToolDefinition[],
    compactModel = false,
  ): Promise<{
    tools: ToolDefinition[];
    hasMutationIntent: boolean;
    wantsGui: boolean;
  }> {
    const classification = await this.aiService.classifyIntent(goal, allTools);

    // Always include mandatory base tools
    const mandatoryTools = ['read', 'list', 'document_reader'];
    const selectedNames = new Set([...mandatoryTools, ...classification.tools]);

    // Deterministic safety net: guarantee Office tools when goal mentions them
    // AND force hasMutationIntent=true so the nudge mechanism activates on retry.
    let forcedMutation = false;
    const goalLower = goal.toLowerCase();
    if (OFFICE_EXCEL_RE.test(goalLower) || /@\S+\.(?:xlsx|xlsm|xls)/i.test(goal)) {
      for (const name of ['desktop_excel_edit', 'document_reader', 'list']) {
        const tool = allTools.find((t) => t.function.name === name);
        if (tool) selectedNames.add(name);
      }
      if (MUTATION_KEYWORDS_RE.test(goalLower)) forcedMutation = true;
    }
    if (OFFICE_WORD_RE.test(goalLower) || /@\S+\.(?:docx|doc)/i.test(goal)) {
      for (const name of ['desktop_word_edit', 'document_reader', 'list']) {
        const tool = allTools.find((t) => t.function.name === name);
        if (tool) selectedNames.add(name);
      }
      if (MUTATION_KEYWORDS_RE.test(goalLower)) forcedMutation = true;
    }
    if (OFFICE_PPT_RE.test(goalLower) || /@\S+\.(?:pptx|ppt)/i.test(goal)) {
      for (const name of ['desktop_ppt_edit', 'document_reader', 'list']) {
        const tool = allTools.find((t) => t.function.name === name);
        if (tool) selectedNames.add(name);
      }
      if (MUTATION_KEYWORDS_RE.test(goalLower)) forcedMutation = true;
    }

    // Safety net for non-Office categories — the intent router on free-tier
    // models can miss these, so keyword matches force them in.
    const CATEGORY_SAFETY_NET: Array<[RegExp, string[]]> = [
      [/\bpdf\b/i, ['pdf_manage_pages', 'document_reader']],
      [/(?:ocr|scan|pindai)\b|ktp|npwp|sim\b|\bfoto\b|\bgambar\b/i, ['image_ocr', 'vision_ai']],
      [/(?:convert|konversi|jadikan|ekspor|export)\b.*(?:pdf|word|docx|excel|xlsx)?/i, ['convert_document']],
      [/\b(?:internet|online|berita|googling|cari di web)\b/i, ['web_search']],
    ];
    for (const [re, names] of CATEGORY_SAFETY_NET) {
      if (re.test(goal)) {
        for (const name of names) {
          const tool = allTools.find((t) => t.function.name === name);
          if (tool) selectedNames.add(name);
        }
      }
    }

    // Clarification intent: expose ask_user so the model CAN ask instead of guessing.
    // Bare 'tanya' also matches menanyakan/bertanya/ditanyakan; ask[_ -]?user
    // covers the literal tool name variants models echo back.
    if (/(?:tanya|bertanya|ask[\s_-]*user|konfirmasi|clarif)/i.test(goal)) {
      const askTool = allTools.find((t) => t.function.name === 'ask_user');
      if (askTool) selectedNames.add('ask_user');
    }

    // Compact-model profile: heavy orchestrators confuse mini models (they
    // call them half-heartedly or narrate instead). Hide them unless the goal
    // names them explicitly.
    if (compactModel) {
      const explicit = /agent_spawn|batch_execute|multi_doc_process/i.test(goal);
      if (!explicit) {
        for (const name of ['agent_spawn', 'batch_execute', 'multi_doc_process']) {
          selectedNames.delete(name);
        }
      }
    }

    // Map names back to actual ToolDefinitions
    const tools = allTools.filter((t) => selectedNames.has(t.function.name));

    return {
      tools,
      hasMutationIntent: classification.isMutation || forcedMutation,
      wantsGui: classification.isGui,
    };
  }

  async buildWorkspaceContext(
    workspaceId: string,
    modifiedFiles: Array<{ filename: string }> = [],
  ): Promise<string> {
    try {
      let businessType = 'generic';
      let rootPath: string | null = null;
      try {
        const workspace = await this.prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { businessType: true, rootPath: true },
        });
        if (workspace?.businessType) businessType = workspace.businessType;
        if (workspace?.rootPath) rootPath = workspace.rootPath;
      } catch {}

      let context = `Workspace Root: ${rootPath || 'N/A'}`;
      if (businessType && businessType !== 'generic') {
        context += ` (Domain: ${businessType})`;
      }

      if (modifiedFiles.length > 0) {
        const recent = modifiedFiles.slice(-3);
        context += `\nRecently modified: ${recent.map((f) => f.filename).join(', ')}`;
      }

      return context;
    } catch {
      return '';
    }
  }

  async readMentionedFiles(
    workspaceId: string,
    goal: string,
  ): Promise<Map<string, string>> {
    const contents = new Map<string, string>();
    for (const filename of extractMentionedFilenames(goal)) {
      try {
        const finalResult = await this.selfHealingService.executeWithIsolation(
          'read',
          { workspaceId, filePath: filename },
          workspaceId,
        );
        if (finalResult.status !== 'success') {
          this.logger.warn(
            `Pre-read for mentioned file "${filename}" returned status: ${finalResult.preview}`,
          );
          continue;
        }
        const text =
          (finalResult.data as Record<string, unknown>)?.content ||
          (finalResult.data as Record<string, unknown>)?.text;
        const content =
          typeof text === 'string'
            ? text.slice(0, 12000)
            : ToolResultFormatter.formatForLlm('read', finalResult);
        contents.set(filename, content);
      } catch (err: any) {
        this.logger.warn(
          `Failed to pre-read mentioned file "${filename}": ${err.message}`,
        );
      }
    }
    return contents;
  }

  /**
   * Experiment 1: Auto-resolve the most relevant workspace file when the user
   * did NOT use an @mention but the goal clearly refers to an office document.
   * Returns a lightweight preview (sheet names + header row) to give the LLM
   * enough context to call the right tool without overwhelming the context window.
   */
  private async autoResolveWorkspaceFiles(
    workspaceId: string,
    goal: string,
    workspaceRootPath: string,
  ): Promise<Map<string, string>> {
    const contents = new Map<string, string>();
    if (!workspaceRootPath) return contents;

    const goalLower = goal.toLowerCase();
    const isExcel = OFFICE_EXCEL_RE.test(goalLower);
    const isWord = OFFICE_WORD_RE.test(goalLower);
    const isPpt = OFFICE_PPT_RE.test(goalLower);
    if (!isExcel && !isWord && !isPpt) return contents;

    // Determine target extensions
    const targetExts: string[] = [];
    if (isExcel) targetExts.push('.xlsx', '.xlsm', '.xls', '.csv');
    if (isWord) targetExts.push('.docx', '.doc');
    if (isPpt) targetExts.push('.pptx', '.ppt');

    try {
      const entries = await fs.readdir(workspaceRootPath, {
        withFileTypes: true,
      });
      const candidates = entries
        .filter(
          (e) =>
            e.isFile() &&
            !e.name.startsWith('.') &&
            !e.name.startsWith('~$') &&
            targetExts.some((ext) => e.name.toLowerCase().endsWith(ext)),
        )
        .map((e) => e.name);

      if (candidates.length === 0) return contents;

      // Score candidates by keyword overlap with goal
      const goalWords = goalLower
        .split(/[\s,.:;!?]+/)
        .filter((w) => w.length > 2);
      let bestFile = candidates[0];
      let bestScore = 0;
      for (const fname of candidates) {
        const fnameLower = fname.toLowerCase().replace(/[_\-\.]/g, ' ');
        let score = 0;
        for (const w of goalWords) {
          if (fnameLower.includes(w)) score += 3;
        }
        // Bonus for exact extension match
        if (isExcel && /\.xlsx?$/i.test(fname)) score += 2;
        if (isWord && /\.docx?$/i.test(fname)) score += 2;
        if (isPpt && /\.pptx?$/i.test(fname)) score += 2;
        // Bonus for recently modified
        try {
          const stat = await fs.stat(path.join(workspaceRootPath, fname));
          const ageMinutes =
            (Date.now() - stat.mtimeMs) / 60000;
          if (ageMinutes < 60) score += 1;
        } catch {}
        if (score > bestScore) {
          bestScore = score;
          bestFile = fname;
        }
      }

      this.logger.log(
        `[AutoResolve] No @mention found. Auto-resolved "${bestFile}" from ${candidates.length} candidate(s) (score=${bestScore})`,
      );

      // Pre-read a lightweight preview of the resolved file
      try {
        const result = await this.selfHealingService.executeWithIsolation(
          'read',
          { workspaceId, filePath: bestFile },
          workspaceId,
        );
        if (result.status === 'success') {
          const text =
            (result.data as Record<string, unknown>)?.content ||
            (result.data as Record<string, unknown>)?.text;
          // Limit to ~4000 chars to stay within free-tier context budget
          const preview =
            typeof text === 'string'
              ? text.slice(0, 4000)
              : ToolResultFormatter.formatForLlm('read', result).slice(0, 4000);
          contents.set(bestFile, preview);
        }
      } catch (err: any) {
        this.logger.warn(
          `[AutoResolve] Failed to pre-read "${bestFile}": ${err.message}`,
        );
      }
    } catch (err: any) {
      this.logger.debug(
        `[AutoResolve] Failed to scan workspace: ${err.message}`,
      );
    }
    return contents;
  }

  async buildInitialContext(params: {
    workspaceId: string;
    userGoal: string;
    historyMessages?: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
    }>;
    modifiedFiles?: Array<{ filename: string }>;
    modelId?: string;
  }): Promise<{
    systemContent: string;
    messages: ChatMessage[];
    tools: ToolDefinition[];
    modelCtx: any;
    safeGoal: string;
    mentionedFileContents: Map<string, string>;
    workspaceRootPath: string;
    hasMutationIntent: boolean;
    wantsGui: boolean;
    injectionBlocked?: boolean;
  }> {
    const {
      workspaceId,
      userGoal,
      historyMessages,
      modifiedFiles = [],
      modelId,
    } = params;
    const compactModel = isCompactModel(modelId);

    const workspaceContext = await this.buildWorkspaceContext(
      workspaceId,
      modifiedFiles,
    );

    let workspaceRootPath = '';
    let recallContext = '';
    try {
      const ws = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { businessType: true, rootPath: true },
      });
      workspaceRootPath = ws?.rootPath || '';
      recallContext = await this.smartRecallService.recall(
        userGoal,
        workspaceId,
        ws?.businessType || 'generic',
      );
      if (process.env.ARUNAKI_DEBUG_TOOLS === '1') {
        this.logger.debug(
          `[TRACE-RECALL] len=${recallContext.length} preview=${recallContext.slice(0, 150)}`,
        );
      }
    } catch (err: any) {
      this.logger.debug(`Smart recall failed (non-critical): ${err.message}`);
    }

    const allTools = this.toolRegistryService.getToolDefinitions();
    const { tools, hasMutationIntent, wantsGui } =
      await this.selectToolsForGoal(userGoal, allTools, compactModel);
    const modelCtx = await this.aiService.getActiveModelContext();

    const systemPrompt = this.aiService.getSystemPrompt(
      'workspace',
      workspaceContext,
      modelId,
      historyMessages,
      tools,
    );

    const history = (historyMessages || []).map((message) => ({
      role: message.role,
      content: message.content,
    })) as ChatMessage[];

    const context = await this.contextRegistry.getActive().assemble({
      mode: 'workspace',
      workspaceId,
      messages: history,
      workspaceContext,
      memoryContext: recallContext,
      contextWindow: modelCtx.contextWindow,
    });

    let workspaceRules = '';
    if (workspaceRootPath) {
      try {
        workspaceRules =
          await this.cartographerService.getWorkspaceRules(workspaceRootPath);
        if (!workspaceRules) {
          // Trigger asynchronous background analysis without blocking current request
          this.cartographerService
            .analyzeAndBootstrap(workspaceId)
            .catch(() => {});
        }
      } catch (err: any) {
        this.logger.debug(`Fetching ARUNAKI.md rules failed: ${err.message}`);
      }
    }

    let systemContent = context.systemPrompt
      ? `${systemPrompt}\n\n${context.systemPrompt}`
      : systemPrompt;

    if (workspaceRules && workspaceRules.trim()) {
      systemContent += `\n\n# 📜 LOCAL WORKSPACE OPERATING RULES (AUTONOMOUSLY COMPILED ARUNAKI.MD)\n${workspaceRules.trim()}`;
    }

    const dtContext = getSystemDateTimeContext();
    if (dtContext) {
      systemContent += `\n\n${dtContext}`;
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: systemContent },
      ...context.messages,
    ];

    // Recency placement for small models: relevant memory is ALSO appended as
    // a short note adjacent to the conversation tail. Small models attend
    // strongly to prompt start/end and routinely skip mid-prompt sections.
    if (recallContext && recallContext.trim()) {
      messages.push({
        role: 'user',
        content: `(System note — background info, use only if relevant)\n${recallContext.trim()}`,
      });
    }

    // Forced clarification (harness-guided tool_choice): when the user asked
    // for confirmation first, the very next action MUST be the ask_user tool.
    // Free-tier minis narrate the question as text instead; an explicit final
    // directive closes that gap without provider-specific tool_choice flags.
    if (
      /(?:tanya|bertanya|ask[\s_-]*user|konfirmasi|clarif)/i.test(userGoal) &&
      tools.some((t) => t.function.name === 'ask_user')
    ) {
      messages.push({
        role: 'user',
        content:
          `(Execution directive) The user explicitly requested confirmation BEFORE any work. ` +
          `Your next and only action must be a single tool call to \`ask_user\` with one concrete question. ` +
          `Do not read files, do not plan out loud, do not answer in text — call \`ask_user\` now, then stop.`,
      });
    }

    // Prompt injection check
    const injectionResult = this.promptInjectionDetector.scan(userGoal);
    if (injectionResult.detected && injectionResult.severity === 'high') {
      this.promptInjectionDetector.logDetection(
        workspaceId,
        userGoal,
        injectionResult,
      );
      return {
        systemContent,
        messages,
        tools,
        modelCtx,
        safeGoal: userGoal,
        mentionedFileContents: new Map(),
        workspaceRootPath,
        hasMutationIntent,
        wantsGui,
        injectionBlocked: true,
      };
    }

    const safeGoal = injectionResult.detected
      ? injectionResult.sanitized
      : userGoal;
    const mentionedFileContents = await this.readMentionedFiles(
      workspaceId,
      safeGoal,
    );

    // Experiment 1: Auto-resolve file when no @mention but office keywords detected
    if (mentionedFileContents.size === 0 && workspaceRootPath) {
      const autoResolved = await this.autoResolveWorkspaceFiles(
        workspaceId,
        safeGoal,
        workspaceRootPath,
      );
      for (const [filename, content] of autoResolved) {
        mentionedFileContents.set(filename, content);
      }
    }

    let goalContent = safeGoal;
    for (const [filename, content] of mentionedFileContents) {
      goalContent += `\n\nCalled the Read tool with the following input: ${JSON.stringify({ filePath: filename })}\n${content}`;
    }

    const hasGoalInMessages = messages.some(
      (m) => m.role === 'user' && m.content === goalContent,
    );
    if (!hasGoalInMessages) {
      messages.push({
        role: 'user',
        content: goalContent,
      });
    }

    return {
      systemContent,
      messages,
      tools,
      modelCtx,
      safeGoal,
      mentionedFileContents,
      workspaceRootPath,
      hasMutationIntent,
      wantsGui,
      injectionBlocked: false,
    };
  }
}
