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
import { WorkspaceCartographerService } from './workspace-cartographer.service.js';
import * as path from 'path';

@Injectable()
export class WorkspacePromptBuilderService {
  private readonly logger = new Logger(WorkspacePromptBuilderService.name);
  private readonly lastSyncedMap = new Map<string, number>();

  constructor(
    @Inject(forwardRef(() => AiService)) private readonly aiService: AiService,
    @Inject(forwardRef(() => ToolRegistryService)) private readonly toolRegistryService: ToolRegistryService,
    @Inject(forwardRef(() => FileService)) private readonly fileService: FileService,
    @Inject(forwardRef(() => SmartRecallService)) private readonly smartRecallService: SmartRecallService,
    @Inject(forwardRef(() => SelfHealingService)) private readonly selfHealingService: SelfHealingService,
    @Inject(forwardRef(() => PromptInjectionDetector)) private readonly promptInjectionDetector: PromptInjectionDetector,
    @Inject(forwardRef(() => PrismaService)) private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ContextRegistry)) private readonly contextRegistry: ContextRegistry,
    @Inject(forwardRef(() => WorkspaceCartographerService)) private readonly cartographerService: WorkspaceCartographerService,
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
        entries = await fsPromises.readdir(workspace.rootPath, { withFileTypes: true });
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

      const existingDbFiles = await this.fileService.findByWorkspaceId(workspaceId);
      const existingPaths = new Set(existingDbFiles.map((f) => f.path.toLowerCase()));
      const existingNames = new Set(existingDbFiles.map((f) => f.name.toLowerCase()));

      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const fullPath = path.join(workspace.rootPath, entry.name);
        if (entry.isFile()) {
          const lowerPath = fullPath.toLowerCase();
          const lowerName = entry.name.toLowerCase();
          if (!existingPaths.has(lowerPath) && !existingNames.has(lowerName)) {
            try {
              const stat = await fsPromises.stat(fullPath);
              const ext = path.extname(entry.name).toLowerCase().replace('.', '');
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

  selectToolsForGoal(
    goal: string,
    allTools: ToolDefinition[],
  ): ToolDefinition[] {
    const gClean = goal.replace(/@\[?[^\n@\]]+\.[A-Za-z0-9]{1,10}\]?/g, '').toLowerCase();
    const g = goal.toLowerCase();
    const wanted = new Set<string>();
    const add = (names: string[]) => names.forEach((n) => wanted.add(n));

    // Core workspace file tools — always available
    add(['read', 'write', 'edit', 'search_workspace', 'list']);

    if (/(?:edit|update|tulis|simpan|ubah|perbarui|tambah|catat|buat)/.test(gClean) || /@[^\s@]+\.[A-Za-z0-9]+/.test(goal)) {
      add(['write', 'edit', 'read']);
    }

    if (/(?:query|select|cari data|database|sql)/.test(gClean)) add(['data_query']);
    if (/(?:ringkas|analisis|analisa|reconcile|banding|rekonsiliasi|pivot)/.test(gClean)) {
      add(['doc_reconcile', 'doc_cross_reference']);
    }
    if (/(?:export|generate_export|pdf|docx|word|invoice|dokumen|surat|cetak|konversi|convert|ubah)/.test(g) || /@[^\s@]+\.(?:docx|pdf|xlsx)/i.test(goal)) {
      add(['generate_export', 'convert_document', 'document_reader']);
    }
    if (/(?:email|pesan|komunikasi|draft|surat|kontrak)/.test(g)) add(['draft_communication']);
    if (/(?:gambar|image|foto|ocr|scan)/.test(g)) add(['image_ocr', 'vision_ai']);
    if (/(?:buka|desktop|word|excel|xlsx|spreadsheet|rekap|transaksi|pemasukan|pengeluaran|powerpoint|ppt|office|aplikasi|mengetik|bca|bni|bri|cash|laporan)/.test(g) || /@[^\s@]+\.xlsx/i.test(goal)) {
      add([
        'desktop_open_file',
        'desktop_open_excel',
        'desktop_open_word',
        'desktop_open_ppt',
        'desktop_excel_edit',
        'desktop_word_type',
        'desktop_word_format',
        'desktop_send_keys',
        'desktop_screenshot',
        'document_reader',
      ]);
    }
    if (/(?:browser|website|web|google|internet|halaman)/.test(g)) {
      add(['browser_navigate', 'browser_get_content', 'browser_type', 'browser_click', 'browser_screenshot']);
    }
    if (/(?:ingat|memory|recall|memori|pengalaman)/.test(g)) {
      add(['list_memories', 'search_memories', 'save_memory']);
    }
    if (/(?:skill|workflow|prosedur|template kerja)/.test(g)) {
      add(['list_skills', 'view_skill', 'search_skills']);
    }
    if (/(?:tabel|table|describe|schema|struktur)/.test(gClean)) add(['data_query']);
    if (/(?:cari.*internet|search.*web|tavily|riset|berita)/.test(g)) add(['web_search']);
    if (/(?:subagent|sub-agent|sub agent|spawn|paralel|parallel|bagi tugas|banyak file|batch|multi-task|semua file|multi-doc|multi doc)/.test(gClean)) {
      add(['agent_spawn', 'multi_doc_process']);
    }
    if (/(?:batch|ptc|atomic|sekaligus|rantai|chain|multi-step|programmatic)/.test(gClean)) {
      add(['batch_execute']);
    }

    return allTools.filter((t) => wanted.has(t.function.name));
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

  async readMentionedFiles(workspaceId: string, goal: string): Promise<Map<string, string>> {
    const contents = new Map<string, string>();
    for (const filename of extractMentionedFilenames(goal)) {
      try {
        const finalResult = await this.selfHealingService.executeWithIsolation(
          'read',
          { workspaceId, filePath: filename },
          workspaceId,
        );
        if (finalResult.status !== 'success') {
          this.logger.warn(`Pre-read for mentioned file "${filename}" returned status: ${finalResult.preview}`);
          continue;
        }
        const text = (finalResult.data as Record<string, unknown>)?.content || (finalResult.data as Record<string, unknown>)?.text;
        const content = typeof text === 'string'
          ? text.slice(0, 12000)
          : ToolResultFormatter.formatForLlm('read', finalResult);
        contents.set(filename, content);
      } catch (err: any) {
        this.logger.warn(`Failed to pre-read mentioned file "${filename}": ${err.message}`);
      }
    }
    return contents;
  }

  async buildInitialContext(params: {
    workspaceId: string;
    userGoal: string;
    historyMessages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    modifiedFiles?: Array<{ filename: string }>;
  }): Promise<{
    systemContent: string;
    messages: ChatMessage[];
    tools: ToolDefinition[];
    modelCtx: any;
    safeGoal: string;
    mentionedFileContents: Map<string, string>;
    workspaceRootPath: string;
    injectionBlocked?: boolean;
  }> {
    const { workspaceId, userGoal, historyMessages, modifiedFiles = [] } = params;

    const workspaceContext = await this.buildWorkspaceContext(workspaceId, modifiedFiles);

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
    } catch (err: any) {
      this.logger.debug(`Smart recall failed (non-critical): ${err.message}`);
    }

    const allTools = this.toolRegistryService.getToolDefinitions();
    const tools = this.selectToolsForGoal(userGoal, allTools);
    const modelCtx = await this.aiService.getActiveModelContext();

    const systemPrompt = this.aiService.getSystemPrompt(
      'workspace',
      workspaceContext,
      undefined,
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
        workspaceRules = await this.cartographerService.getWorkspaceRules(workspaceRootPath);
        if (!workspaceRules) {
          // Trigger asynchronous background analysis without blocking current request
          this.cartographerService.analyzeAndBootstrap(workspaceId).catch(() => {});
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

    // Prompt injection check
    const injectionResult = this.promptInjectionDetector.scan(userGoal);
    if (injectionResult.detected && injectionResult.severity === 'high') {
      this.promptInjectionDetector.logDetection(workspaceId, userGoal, injectionResult);
      return {
        systemContent,
        messages,
        tools,
        modelCtx,
        safeGoal: userGoal,
        mentionedFileContents: new Map(),
        workspaceRootPath,
        injectionBlocked: true,
      };
    }

    const safeGoal = injectionResult.detected ? injectionResult.sanitized : userGoal;
    const mentionedFileContents = await this.readMentionedFiles(workspaceId, safeGoal);

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
      injectionBlocked: false,
    };
  }
}
