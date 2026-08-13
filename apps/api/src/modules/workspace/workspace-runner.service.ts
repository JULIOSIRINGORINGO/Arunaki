import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AiService, ChatMessage, ToolDefinition } from '../ai/ai.service.js';
import {
  ContextManager,
  StreamingContextScrubber,
} from '../ai/context-manager.js';
import { ContextRegistry } from '../ai/context/context-registry.service.js';
import { getSystemDateTimeContext } from '../ai/context/date-time-context.js';
import { ToolRegistryService } from '../tools/tool-registry.service.js';
import { StorageService } from '../storage/storage.service.js';
import { FileService } from '../file/file.service.js';
import { SearchService } from '../search/search.service.js';
import { ArtifactService } from '../artifact/artifact.service.js';
import { MemoryService } from '../memory/memory.service.js';
import { BackgroundReviewService } from '../memory/background-review.service.js';
import { SmartRecallService } from '../memory/smart-recall.service.js';
import { SkillService } from '../skills/skill.service.js';
import { SelfHealingService } from '../ai/self-healing.service.js';
import { PromptInjectionDetector } from '../ai/prompt-injection-detector.service.js';
import { CompactionService } from '../ai/compaction.service.js';
import { ToolResultFormatter } from '../tools/utils/tool-result-formatter.js';
import { TodoStoreService } from '../tools/services/todo-store.service.js';
import { PrismaService } from '../../common/providers/prisma.service.js';
import { ToolResult } from '../tools/interfaces/tool-result.interface.js';
import {
  createRunBudget,
  enterRunBudget,
} from '../ai/token-budget.service.js';
import { SessionAdmissionService } from '../chat/session-admission.service.js';
import * as path from 'path';



export function extractMentionedFilenames(text: string): string[] {
  return [...text.matchAll(/@\[?([^\n@\]]+?\.[A-Za-z0-9]{1,10})\]?(?=\s|$|[.,;:!?])/g)]
    .map((match) => match[1].trim().replace(/^\[|\]$/g, ''))
    .filter(Boolean);
}

export function hasExplicitDeleteIntent(goal: string, filename: string): boolean {
  return /\b(hapus|hapuskan|delete|remove)\b/i.test(goal)
    && goal.toLowerCase().includes(filename.toLowerCase());
}

export interface WorkspaceStreamEvent {
  type:
    | 'thinking'
    | 'plan_created'
    | 'tool_start'
    | 'approval_required'
    | 'tool_done'
    | 'text_delta'
    | 'state_changed'
    | 'phase_changed'
    | 'steering'
    | 'done'
    | 'error';
  data: any;
}

@Injectable()
export class WorkspaceRunnerService {
  private readonly logger = new Logger(WorkspaceRunnerService.name);
  private readonly scrubber = new StreamingContextScrubber();

   /** Track modified files per workspace session */
  private readonly modifiedFiles = new Map<string, Array<{ filename: string; timestamp: Date }>>();

  /** Track read files per workspace session */
  private readonly readFiles = new Map<string, Array<{ filename: string; timestamp: Date }>>();

  private readonly mentionedFiles = new Map<string, Set<string>>();

  /** Active workspace runs — enables abort and state tracking */
  private readonly activeRuns = new Map<string, WorkspaceRunState>();

  /** Approval queue — holds approval promises per workspace */
  private readonly approvalQueue = new Map<
    string,
    {
      resolve: (approved: boolean) => void;
      toolName: string;
      args: Record<string, any>;
      timestamp: Date;
    }
  >();

  /** Request queue — holds pending requests when workspace is busy */
  private readonly requestQueue = new Map<
    string,
    Array<{
      resolve: () => void;
      reject: (error: Error) => void;
      goal: string;
      historyMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
      onEvent: (event: WorkspaceStreamEvent) => void;
      timestamp: Date;
    }>
  >();

  /** Steering queue — holds follow-up inputs for mid-run steering */
  private readonly steeringQueue = new Map<
    string,
    Array<{
      message: string;
      timestamp: Date;
    }>
  >();

  constructor(
    @Inject(forwardRef(() => AiService)) private readonly aiService: AiService,
    @Inject(forwardRef(() => ToolRegistryService)) private readonly toolRegistryService: ToolRegistryService,
    @Inject(forwardRef(() => StorageService)) private readonly storageService: StorageService,
    @Inject(forwardRef(() => FileService)) private readonly fileService: FileService,
    @Inject(forwardRef(() => SearchService)) private readonly searchService: SearchService,
    @Inject(forwardRef(() => ArtifactService)) private readonly artifactService: ArtifactService,
    @Inject(forwardRef(() => MemoryService)) private readonly memoryService: MemoryService,
    @Inject(forwardRef(() => BackgroundReviewService)) private readonly backgroundReviewService: BackgroundReviewService,
    @Inject(forwardRef(() => SmartRecallService)) private readonly smartRecallService: SmartRecallService,
    @Inject(forwardRef(() => SkillService)) private readonly skillService: SkillService,
    @Inject(forwardRef(() => SelfHealingService)) private readonly selfHealingService: SelfHealingService,
    @Inject(forwardRef(() => PromptInjectionDetector)) private readonly promptInjectionDetector: PromptInjectionDetector,
    @Inject(forwardRef(() => CompactionService)) private readonly compactionService: CompactionService,
    @Inject(forwardRef(() => PrismaService)) private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ContextRegistry)) private readonly contextRegistry: ContextRegistry,
    @Inject(forwardRef(() => EventEmitter2)) private readonly eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => TodoStoreService)) private readonly todoStore: TodoStoreService,
    @Inject(forwardRef(() => SessionAdmissionService)) private readonly sessionAdmissionService: SessionAdmissionService,
  ) {}
  private async readMentionedFiles(workspaceId: string, goal: string): Promise<Map<string, string>> {
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

  /**
   * Get current state of a workspace run
   */
  getRunState(workspaceId: string): WorkspaceRunState | undefined {
    return this.activeRuns.get(workspaceId);
  }

  /** Check if a workspace is currently running */
  isRunning(workspaceId: string): boolean {
    const state = this.activeRuns.get(workspaceId);
    return state?.state === 'running' || state?.state === 'steering';
  }

  /** Abort a running workspace analysis */
  abortRun(workspaceId: string, reason: string): boolean {
    const state = this.activeRuns.get(workspaceId);
    if (!state || (state.state !== 'running' && state.state !== 'steering')) {
      return false;
    }
    state.state = 'aborting';
    state.abortController.abort(reason);
    this.logger.log(`Workspace run abort requested: ${workspaceId} (${reason})`);
    return true;
  }

  /** Get all active run states (for dashboard/monitoring) */
  getAllActiveRuns(): WorkspaceRunState[] {
    return Array.from(this.activeRuns.values());
  }

  /**
   * Wait for approval on a specific tool call.
   * Returns a Promise that resolves when approval is received.
   * Used by the approval gate to pause execution without killing the loop.
   */
  private waitForApproval(
    workspaceId: string,
    toolName: string,
    args: Record<string, any>,
    timeoutMs = 120000,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this.approvalQueue.get(workspaceId)?.toolName === toolName) {
          this.approvalQueue.delete(workspaceId);
          this.logger.warn(`Approval for ${toolName} timed out after ${timeoutMs}ms, rejecting`);
          resolve(false);
        }
      }, timeoutMs);
      this.approvalQueue.set(workspaceId, {
        resolve: (approved: boolean) => {
          clearTimeout(timer);
          resolve(approved);
        },
        toolName,
        args,
        timestamp: new Date(),
      });
      this.logger.log(`Approval queue: waiting for user approval (${toolName})`);
    });
  }

  /**
   * Resolve a pending approval request.
   * Called when user approves or rejects a tool call.
   */
  resolveApproval(workspaceId: string, approved: boolean): boolean {
    const pending = this.approvalQueue.get(workspaceId);
    if (!pending) return false;
    pending.resolve(approved);
    this.approvalQueue.delete(workspaceId);
    this.logger.log(`Approval resolved: ${approved ? 'approved' : 'rejected'} (${pending.toolName})`);
    return true;
  }

  /**
   * Run workspace agent stream as an async generator.
   * Modern streaming pattern — alternative to callback-based onEvent.
   */
  async *runWorkspaceAgentGenerator(
    params: WorkspaceRunParams,
  ): AsyncGenerator<WorkspaceStreamEvent> {
    const eventQueue: WorkspaceStreamEvent[] = [];
    let resolveEvent: ((value: WorkspaceStreamEvent | null) => void) | null = null;
    let done = false;

    const onEvent = (event: WorkspaceStreamEvent) => {
      if (resolveEvent) {
        const resolve = resolveEvent;
        resolveEvent = null;
        resolve(event);
      } else {
        eventQueue.push(event);
      }
    };

    const runPromise = this.runWorkspaceAgentStream(params, onEvent)
      .then(() => { done = true; if (resolveEvent) resolveEvent(null); })
      .catch((err) => {
        done = true;
        if (resolveEvent) resolveEvent(null);
        this.logger.error(`Workspace agent stream failed: ${err.message}`);
        onEvent({ type: 'error', data: { message: err.message } } as any);
      });

    while (!done) {
      if (eventQueue.length > 0) {
        yield eventQueue.shift()!;
      } else {
        const event = await new Promise<WorkspaceStreamEvent | null>((resolve) => {
          resolveEvent = resolve;
        });
        if (event) yield event;
      }
    }

    await runPromise;
  }

  /**
   * Enqueue a request when workspace is busy.
   * Returns a Promise that resolves when it's the request's turn.
   */
  private enqueueRequest(
    workspaceId: string,
    goal: string,
    historyMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    onEvent: (event: WorkspaceStreamEvent) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const queue = this.requestQueue.get(workspaceId) || [];
      queue.push({ resolve, reject, goal, historyMessages, onEvent, timestamp: new Date() });
      this.requestQueue.set(workspaceId, queue);
      this.logger.log(`Request queued for workspace ${workspaceId} (${queue.length} in queue)`);
    });
  }

  /**
   * Process next request in queue when current run finishes.
   */
  private async processNextInQueue(workspaceId: string): Promise<void> {
    const queue = this.requestQueue.get(workspaceId);
    if (!queue || queue.length === 0) return;

    const next = queue.shift()!;
    if (queue.length === 0) {
      this.requestQueue.delete(workspaceId);
    }

    this.logger.log(`Processing next queued request for workspace ${workspaceId}`);
    next.resolve(); // Unblocks the enqueued caller

    // Start the run
    try {
      await this.runWorkspaceAgentStream(
        {
          workspaceId,
          userGoal: next.goal,
          historyMessages: next.historyMessages,
        },
        next.onEvent,
      );
    } catch (error) {
      this.logger.error(`Queued request failed: ${error.message}`);
    }
  }

  /**
   * Add steering/follow-up input for a running workspace.
   * The input will be injected into the agent loop on next outer iteration.
   */
  addSteeringInput(workspaceId: string, message: string): boolean {
    const state = this.activeRuns.get(workspaceId);
    if (!state || state.state !== 'running') {
      return false;
    }
    const queue = this.steeringQueue.get(workspaceId) || [];
    queue.push({ message, timestamp: new Date() });
    this.steeringQueue.set(workspaceId, queue);
    this.logger.log(`Steering input queued for workspace ${workspaceId}`);
    return true;
  }

  /** Map phase names to user-facing labels */
  private readonly PHASE_LABELS: Record<ExecutionPhase, string> = {
    scanning: 'Scanning workspace documents...',
    planning: 'Formulating execution plan...',
    reading: 'Reading file contents...',
    analyzing: 'Analyzing data...',
    generating: 'Generating output...',
    completed: 'Completed',
  };

  private setPhase(
    runState: WorkspaceRunState,
    phase: ExecutionPhase,
    onEvent: (event: WorkspaceStreamEvent) => void,
  ): void {
    const oldPhase = runState.currentPhase;
    runState.currentPhase = phase;
    this.logger.debug(`Phase: ${oldPhase} → ${phase} (workspace: ${runState.workspaceId})`);
    onEvent({
      type: 'phase_changed',
      data: {
        workspaceId: runState.workspaceId,
        from: oldPhase,
        to: phase,
        label: this.PHASE_LABELS[phase],
        round: runState.round,
      },
    });

    // Emit to EventEmitter for other listeners
    this.eventEmitter.emit('workspace.agent.phase_changed', {
      workspaceId: runState.workspaceId,
      from: oldPhase,
      to: phase,
      label: this.PHASE_LABELS[phase],
      round: runState.round,
      timestamp: new Date(),
    });
  }

  private setState(
    runState: WorkspaceRunState,
    newState: AgentState,
    onEvent: (event: WorkspaceStreamEvent) => void,
  ): void {
    const oldState = runState.state;
    runState.state = newState;
    this.logger.debug(
      `Agent state: ${oldState} → ${newState} (workspace: ${runState.workspaceId})`,
    );
    onEvent({
      type: 'state_changed',
      data: {
        workspaceId: runState.workspaceId,
        from: oldState,
        to: newState,
        round: runState.round,
      },
    });

    // Emit to EventEmitter for other listeners
    this.eventEmitter.emit('workspace.agent.state_changed', {
      workspaceId: runState.workspaceId,
      from: oldState,
      to: newState,
      round: runState.round,
      timestamp: new Date(),
    });
  }

  private readonly lastSyncedMap = new Map<string, number>();

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

  /**
   * Tool Router — send only the relevant tool subset, not the entire registry.
   * Reduces LLM load: smaller payload + the agent is not confused about which
   * tool to pick. The LLM remains free to choose from the given subset.
   *
   * Always include core workspace file ops; add more based on goal keywords.
   * Does not decide the ACTION — only narrows the tool candidates.
   */
  private selectToolsForGoal(
    goal: string,
    allTools: ToolDefinition[],
  ): ToolDefinition[] {
    const gClean = goal.replace(/@\[?[^\n@\]]+\.[A-Za-z0-9]{1,10}\]?/g, '').toLowerCase();
    const g = goal.toLowerCase();
    const byName = (n: string) => allTools.find((t) => t.function.name === n);
    const wanted = new Set<string>();
    const add = (names: string[]) => names.forEach((n) => wanted.add(n));

    // Catalog meta-tools & core workspace file tools — always available.
    add([
      'read',
      'write',
      'edit',
      'search_workspace',
      'list',
    ]);

    if (/(?:edit|update|tulis|simpan|ubah|perbarui|tambah|catat|buat)/.test(gClean) || /@[^\s@]+\.[A-Za-z0-9]+/.test(goal)) {
      add(['write', 'edit', 'read']);
    }

    // Keep all file tools available (read, write, edit) so model can perform
    // surgical patch edits or full writes as needed.

    // Goal keywords → add relevant tools (using gClean so @ file names don't trigger the wrong tool).
    if (/(?:query|select|cari data|database|sql)/.test(gClean)) add(['data_query']);
    if (/(?:ringkas|analisis|analisa|reconcile|banding|rekonsiliasi|pivot)/.test(gClean)) {
      add(['doc_reconcile', 'doc_cross_reference']);
    }
    if (/(?:export|generate_export)/.test(g)) add(['generate_export']);
    if (/(?:email|pesan|komunikasi|draft|surat|kontrak)/.test(g)) add(['draft_communication']);
    if (/(?:gambar|image|foto|ocr|scan)/.test(g)) add(['image_ocr', 'vision_ai']);
    if (/(?:buka|desktop|word|excel|powerpoint|ppt|office|aplikasi|mengetik)/.test(g)) {
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
    if (/(?:tabel|table|describe|schema|struktur)/.test(g)) add(['data_query']);

    // URL/web search: only when the user explicitly asks to search the internet.
    if (/(?:cari.*internet|search.*web|tavily|riset|berita)/.test(g)) add(['web_search']);

    return allTools.filter((t) => wanted.has(t.function.name));
  }

  async buildWorkspaceContext(workspaceId: string): Promise<string> {
    try {
      await this.syncWorkspacePhysicalFiles(workspaceId);
      let businessType = 'generic';
      let rootPath: string | null = null;
      try {
        const workspace = await this.prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { businessType: true, rootPath: true },
        });
        if (workspace?.businessType) {
          businessType = workspace.businessType;
        }
        if (workspace?.rootPath) {
          rootPath = workspace.rootPath;
        }
      } catch {
        // fallback to generic
      }

      // Read physical directory directly if rootPath is specified and accessible
      let filesToDescribe: { name: string; type: string; size: number; path: string }[] = [];
      if (rootPath) {
        try {
          const fsPromises = await import('fs/promises');
          const entries = await fsPromises.readdir(rootPath, { withFileTypes: true });
          for (const entry of entries) {
            if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
              const fullPath = path.join(rootPath, entry.name);
              if (entry.isFile()) {
                const stat = await fsPromises.stat(fullPath);
                const ext = path.extname(entry.name).toLowerCase().replace('.', '');
                filesToDescribe.push({
                  name: entry.name,
                  type: ext || 'file',
                  size: stat.size,
                  path: fullPath,
                });
              }
            }
          }
        } catch {
          // ignore physical scan failure
        }
      }

      // Fallback to database files if physical scan yielded no files or rootPath is unreadable
      if (filesToDescribe.length === 0) {
        const dbFiles = await this.fileService.findByWorkspaceId(workspaceId);
        filesToDescribe = dbFiles.map((f) => ({
          name: f.name,
          type: f.type || 'file',
          size: f.size,
          path: f.path,
        }));
      }

      const fileList =
        filesToDescribe.length > 0
          ? filesToDescribe
              .map(
                (f) =>
                  `- ${f.name} (Type: ${f.type}, Size: ${Math.round(f.size / 1024)} KB)`,
              )
              .join('\n')
          : 'No files in this workspace yet.';

      // Get domain config for this business type
      const businessDomain = businessType !== 'generic' ? businessType : '';

      // Auto-inject relevant skills (already filtered by domain in getSkillsContext)
      const skillsContext = await this.skillService.getSkillsContext(
        businessType,
        workspaceId,
      );

      // Frozen snapshot: inject relevant memories at session start
      const memoryContext = await this.memoryService.getMemoryContext(
        businessType,
        workspaceId,
      );

      let context = `=== WORKSPACE CONTEXT (ID: ${workspaceId}) ===\n${getSystemDateTimeContext()}\nRoot Path: ${rootPath || 'N/A'}\nDetected File List:\n${fileList}\n=== END WORKSPACE CONTEXT ===`;

      if (skillsContext) {
        context += `\n\n=== RELEVANT SKILLS ===\n${skillsContext}\n=== END SKILLS ===`;
      }

      if (memoryContext) {
        context += `\n\n=== MEMORY SNAPSHOT ===\n${memoryContext}\n=== END MEMORY ===`;
      }

      if (businessDomain) {
        context += `\n\n=== DOMAIN ===\nBusiness domain: ${businessDomain}\nUse list_skills / search_memories if domain details are needed.\n=== END DOMAIN ===`;
      }

       const modified = this.modifiedFiles.get(workspaceId) || [];
       if (modified.length > 0) {
         const recent = modified.slice(-10);
         context += `\n\n=== FILES MODIFIED IN THIS RUN ===
 ${recent.map((f) => `- ${f.filename} (${f.timestamp.toLocaleTimeString('id-ID')})`).join('\n')}
 === END MODIFIED FILES ===`;
       }

       return context;
     } catch {
       return '';
     }
  }

  async runWorkspaceAgentStream(
    params: WorkspaceRunParams,
    onEvent: (event: WorkspaceStreamEvent) => void,
  ) {
    const {
      workspaceId,
      userGoal,
      historyMessages,
      modelId,
    } = params;

    let lease: any;
    try {
      lease = await this.sessionAdmissionService.acquireAdmission(workspaceId);
    } catch (error: any) {
      onEvent({
        type: 'error',
        data: {
          message:
            'Workspace is busy processing another request. Please wait.',
        },
      });
      return;
    }

    // Initialize state tracking
    const abortController = new AbortController();
    const runState: WorkspaceRunState = {
      workspaceId,
      state: 'idle',
      goal: userGoal,
      startedAt: new Date(),
      round: 0,
      currentPhase: 'scanning',
      abortController,
    };
    this.activeRuns.set(workspaceId, runState);

   try {
       this.setState(runState, 'running', onEvent);
       this.setPhase(runState, 'scanning', onEvent);
         this.modifiedFiles.delete(workspaceId);
         this.readFiles.delete(workspaceId);
          this.mentionedFiles.delete(workspaceId);
          this.todoStore.clear(workspaceId);


      // Emit agent started event
      this.eventEmitter.emit('workspace.agent.started', {
        workspaceId,
        goal: userGoal,
        timestamp: new Date(),
      });

      onEvent({
        type: 'thinking',
        data: 'Reading workspace context and processing request...',
      });

      const workspaceContext = await this.buildWorkspaceContext(workspaceId);

      // Smart recall: prefetch relevant memory and past conversations
      let recallContext = '';
      try {
        const ws = await this.prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { businessType: true },
        });
        recallContext = await this.smartRecallService.recall(
          userGoal,
          workspaceId,
          ws?.businessType || 'generic',
        );
        if (recallContext) {
          this.logger.log(
            `Smart recall: found ${recallContext.length} chars of relevant context`,
          );
        }
      } catch (err: any) {
        this.logger.debug(`Smart recall failed (non-critical): ${err.message}`);
      }

      // Tool Router: send only the relevant tools, not the entire registry.
      // Reduces LLM load (smaller payload, agent not confused about which
      // tool to pick). The LLM remains free to choose from the relevant subset.
      const allTools = this.toolRegistryService.getToolDefinitions();
      const tools = this.selectToolsForGoal(userGoal, allTools);

      // Resolve the active model's context budget once per run so compaction
      // and the context engine scale to the real window (e.g. 32K for
      // deepseek-v4-flash) instead of a fixed 128K default.
      const modelCtx = await this.aiService.getActiveModelContext();

      const systemPrompt = this.aiService.getSystemPrompt(
        'workspace',
        workspaceContext,
        undefined,
        historyMessages,
        tools
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
      const systemContent = context.systemPrompt
        ? `${systemPrompt}\n\n${context.systemPrompt}`
        : systemPrompt;
      const messages: ChatMessage[] = [
        { role: 'system', content: systemContent },
        ...context.messages,
      ];

      // Prompt injection scan
      const injectionResult = this.promptInjectionDetector.scan(userGoal);
      if (injectionResult.detected && injectionResult.severity === 'high') {
        this.promptInjectionDetector.logDetection(workspaceId, userGoal, injectionResult);
        this.setState(runState, 'failed', onEvent);

        // Emit agent failed event
        this.eventEmitter.emit('workspace.agent.failed', {
          workspaceId,
          goal: userGoal,
          reason: 'prompt_injection_blocked',
          timestamp: new Date(),
        });

        onEvent({
          type: 'error',
          data: { message: 'Input contains disallowed content. Please fix it and try again.' },
        });
        return;
      }
      const safeGoal = injectionResult.detected
        ? injectionResult.sanitized
        : userGoal;
      const mentionedFileContents = await this.readMentionedFiles(workspaceId, safeGoal);
      this.mentionedFiles.set(workspaceId, new Set(mentionedFileContents.keys()));

      // opencode-style: resolve @file mentions inline into the user message.
      // The file content is appended to the goal as a "Called the Read tool"
      // part so the model treats it as already-read input — no separate read.
      let goalContent = safeGoal;
      for (const [filename, content] of mentionedFileContents) {
        goalContent += `\n\nCalled the Read tool with the following input: ${JSON.stringify({ filePath: filename })}\n${content}`;
      }

      // Crucial fix: Append current user goal to messages array so LLM knows what tool to call!
      const hasGoalInMessages = messages.some(
        (m) => m.role === 'user' && m.content === goalContent,
      );
      if (!hasGoalInMessages) {
        messages.push({
          role: 'user',
          content: goalContent,
        });
      }

      // Generate autonomous reasoning plan
      if (abortController.signal.aborted) {
        this.setState(runState, 'aborting', onEvent);

        // Emit agent aborted event
        this.eventEmitter.emit('workspace.agent.aborted', {
          workspaceId,
          goal: userGoal,
          timestamp: new Date(),
        });

        onEvent({
          type: 'error',
          data: { message: 'Analysis cancelled by user.' },
        });
        return;
      }
      // OpenClaw pattern: no regex intent routing, no separate planner call.
      // LLM loop below drives everything via native Function Calling —
      // simple tasks resolve in 1-2 rounds without extra LLM planning roundtrip.
      this.setPhase(runState, 'analyzing', onEvent);

       let finalContent = '';
       const createdArtifactIds: string[] = [];
       const MAX_ROUNDS = 25;
       let reachedMaxRounds = true;
       const budget = createRunBudget();
       enterRunBudget(budget);

       // SINGLE-LOOP (opencode-style): call LLM → run tools → feed results
       // back → repeat until the model stops returning tool_calls. max_steps
       // is a hard safety bound; normal runs exit when toolCalls is empty.
       for (let round = 0; round < MAX_ROUNDS; round++) {
            // Check abort before each round
            if (abortController.signal.aborted) {
              this.setState(runState, 'aborting', onEvent);
              onEvent({
               type: 'error',
               data: { message: 'Analysis cancelled by user.' },
             });
             return;
           }
           runState.round = round + 1;

          // Inject current todo list (working memory) so LLM stays anchored
          // across long runs. Single [TODO] message updated in place per round.
          const todoText = this.todoStore.serialize(workspaceId);
          const todoIdx = messages.findIndex((m) => m.role === 'system' && m.content?.startsWith('=== TODO LIST ==='));
          if (todoText) {
            const todoMsg = { role: 'system' as const, content: todoText };
            if (todoIdx >= 0) messages[todoIdx] = todoMsg;
            else messages.push(todoMsg);
          } else if (todoIdx >= 0) {
            messages.splice(todoIdx, 1);
          }

          if (runState.round > 1) this.setPhase(runState, 'analyzing', onEvent);

          const roundStart = Date.now();
          let aiResponse: { content: string; toolCalls: any[]; usage?: any } = { content: '', toolCalls: [] };
          let isStreamed = false;

          try {
            let streamedText = '';
            const streamedToolCalls: any[] = [];

            for await (const chunk of this.aiService.chatStream(messages, tools)) {
              if (chunk.type === 'content' && chunk.content) {
                streamedText += chunk.content;
                onEvent({ type: 'text_delta', data: chunk.content });
                isStreamed = true;
              } else if (chunk.type === 'tool_call' && chunk.toolCall) {
                streamedToolCalls.push({
                  id: chunk.toolCall.id,
                  type: 'function',
                  function: {
                    name: chunk.toolCall.name,
                    arguments: chunk.toolCall.arguments,
                  },
                });
              }
            }

            aiResponse = {
              content: streamedText,
              toolCalls: streamedToolCalls,
              usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            };
          } catch (streamErr: any) {
            this.logger.warn(`chatStream failed or unsupported, falling back to chat: ${streamErr.message}`);
            aiResponse = await this.aiService.chat(messages, tools, modelId ? { preferredProviderId: modelId } : undefined);
          }

          this.logger.log(
            `[round] ${runState.round} took ${Date.now() - roundStart}ms; toolCalls=${aiResponse.toolCalls?.length ?? 0} usage=${JSON.stringify(aiResponse.usage)}`,
          );

          // Initialize toolCalls if undefined (some providers return undefined instead of empty array)
          aiResponse.toolCalls = aiResponse.toolCalls || [];

          // Fallback parser for leaked raw tool syntax (e.g., DeepSeek v4 via non-native API)
          if (aiResponse.toolCalls.length === 0 && aiResponse.content && aiResponse.content.includes('<|tool_call>')) {
            const toolCallMatch = aiResponse.content.match(/<\|tool_call>call:([a-zA-Z0-9_]+)(.*?)(?:<tool_call\|>|<\|tool_call\|>|$)/s);
            if (toolCallMatch) {
              const funcName = toolCallMatch[1];
              let rawArgs = toolCallMatch[2].trim();
              
              // Handle custom quote escaping (e.g., <|"> -> ")
              rawArgs = rawArgs.replace(/<\|">/g, '"');
              // Handle unquoted keys in leaked JSON
              rawArgs = rawArgs.replace(/([{\[,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
              
              aiResponse.toolCalls.push({
                id: `call_fallback_${Date.now()}`,
                type: 'function',
                function: {
                  name: funcName,
                  arguments: rawArgs,
                }
              });
              
              // Remove the leaked syntax from the content
              aiResponse.content = aiResponse.content.replace(/<\|tool_call>.*?(?:<tool_call\|>|<\|tool_call\|>|$)/s, '').trim();
            }
          }

          // Token budget enforcement: accumulate usage across all rounds;
          // stop the run with a clear message when the budget is exhausted.
          budget.consume(aiResponse.usage?.totalTokens || 0);
          if (budget.exceeded) {
            this.logger.warn(
              `Token budget exceeded: ${budget.used}/${budget.limit} tokens after round ${runState.round}. Stopping the run.`,
            );
            finalContent = `Run stopped: the token budget limit (${budget.limit.toLocaleString('en-US')} tokens) was exceeded after ${budget.used.toLocaleString('en-US')} tokens. Please break the task into smaller parts or continue in a new session.`;
            onEvent({
              type: 'error',
              data: { message: finalContent, budget: { used: budget.used, limit: budget.limit } },
            });
            reachedMaxRounds = false;
            break;
          }

          if (aiResponse.toolCalls.length === 0) {
            finalContent = this.scrubber.scrub(aiResponse.content);
            if (!isStreamed) {
              onEvent({ type: 'text_delta', data: finalContent });
            }
            onEvent({ type: 'done', data: { content: finalContent, artifacts: createdArtifactIds } });
            reachedMaxRounds = false;
            this.logger.log(
              'Workspace agent finished goal execution within round limit.',
            );
            break;
          }

          // plan_created only for multi-step tasks (round > 1 or >1 tool in a
          // single round). A single tool on round 1 = direct execution, no
          // plan event needed — the UI shows tool_start immediately.
          const isSingleStep =
            runState.round === 1 &&
            aiResponse.toolCalls.length === 1;
          if (!isSingleStep && runState.round === 1) {
            const planSteps = aiResponse.toolCalls.map((tc) => {
              let argSummary = '';
              try {
                const args = JSON.parse(tc.function.arguments || '{}');
                argSummary = args.filename || args.path || args.query || '';
              } catch {
                argSummary = '';
              }
              return `${tc.function.name}${argSummary ? ` → ${argSummary}` : ''}`;
            });
            onEvent({
              type: 'plan_created',
              data: {
                goal: safeGoal,
                steps: planSteps.length > 0 ? planSteps : ['Processing request...'],
              },
            });
          }

          messages.push({
            role: 'assistant',
            content: aiResponse.content || null,
            tool_calls: aiResponse.toolCalls,
          });

          // Intercept ask_user: if the AI explicitly wants to ask the user, stop the execution loop immediately!
          const askUserToolCall = aiResponse.toolCalls.find(tc => tc.function.name === 'ask_user');
          if (askUserToolCall) {
            let message = 'Please provide additional information to process this request.';
            try { 
              const args = JSON.parse(askUserToolCall.function.arguments || '{}');
              if (args.message) message = args.message;
            } catch {}
            
            finalContent = message;
            onEvent({ type: 'text_delta', data: finalContent });
            reachedMaxRounds = false;
            break;
          }

          // Update phase based on tool types
          const hasReadTools = aiResponse.toolCalls.some((tc) =>
            ['search_workspace', 'read', 'list'].includes(tc.function.name),
          );
          const hasWriteTools = aiResponse.toolCalls.some((tc) =>
            ['write', 'generate_export', 'draft_communication'].includes(tc.function.name),
          );
          if (hasReadTools) this.setPhase(runState, 'reading', onEvent);
          if (hasWriteTools) this.setPhase(runState, 'generating', onEvent);

          // OpenClaw pattern: strict subset enforcement. Only tools declared in
          // body.tools are executable; a hallucinated call to an undeclared
          // (but registered) tool is rejected with corrective feedback instead
          // of being executed — otherwise weak models loop forever (e.g.
          // gpt-oss-120b calling `calculate`/`data_query` that were never sent).
          const declaredTools = new Set(
            tools.map((t) => t.function?.name || ''),
          );
          // Internal harness tools stay callable regardless of subset.
          declaredTools.add('ask_user');
          declaredTools.add('agent_spawn');
          declaredTools.add('todo_write');

          // Separate mutating vs read-only tools for parallel execution

          const readOnlyCalls: Array<{
            toolCall: (typeof aiResponse.toolCalls)[0];
            args: Record<string, any>;
          }> = [];
          const mutatingCalls: Array<{
            toolCall: (typeof aiResponse.toolCalls)[0];
            args: Record<string, any>;
          }> = [];

          for (const toolCall of aiResponse.toolCalls) {
            const funcName = toolCall.function.name;
            let args: Record<string, any> = {};
            const rawArgsRaw = toolCall.function.arguments || '';
            try {
              const rawArgs = rawArgsRaw || '{}';
              try {
                args = JSON.parse(rawArgs);
              } catch {
                const cleaned = rawArgs
                  .replace(/[\u0000-\u001F]+/g, (match: string) => {
                    if (match === '\n') return '\\n';
                    if (match === '\r') return '\\r';
                    if (match === '\t') return '\\t';
                    return '';
                  });
                args = JSON.parse(cleaned);
              }
            } catch {
              args = {};
              this.logger.warn(
                `[tool-call] ${funcName} JSON.parse failed. Raw arguments: ${JSON.stringify(rawArgsRaw.slice(0, 300))}`,
              );
            }
            if (Object.keys(args).length === 0 && rawArgsRaw.length > 0 && rawArgsRaw !== '{}') {
              this.logger.warn(
                `[tool-call] ${funcName} parsed to EMPTY object. Raw arguments: ${JSON.stringify(rawArgsRaw.slice(0, 300))}`,
              );
            }

            if (!declaredTools.has(funcName)) {
              this.logger.warn(
                `Rejected undeclared tool call "${funcName}" (not in active tool subset).`,
              );
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content:
                  `Error: tool "${funcName}" is not available for this task. ` +
                  `Available tools: [${[...declaredTools].join(', ')}]. ` +
                  'Use one of those tools.',
              });
              continue;
            }

            // Circuit Breaker (OpenClaw pattern): failed tool results return
            // to the model verbatim; the model self-corrects on the next turn.
            // The round cap (MAX_ROUNDS) is the hard loop bound.

            if (this.toolRegistryService.isMutating(funcName)) {
              mutatingCalls.push({ toolCall, args });
            } else {
              readOnlyCalls.push({ toolCall, args });
            }
          }

          // Execute read-only tools in parallel (semantically safe: no writes)
          if (readOnlyCalls.length > 0) {
            onEvent({
              type: 'tool_start',
              data: {
                toolName: `parallel (${readOnlyCalls.map((c) => c.toolCall.function.name).join(', ')})`,
                args: {},
                timestamp: new Date().toISOString(),
              },
            });

            const healedResults = await Promise.all(
              readOnlyCalls.map(async ({ toolCall, args }) => {
                const enrichedArgs = { ...args, workspaceId };
                const result = await this.selfHealingService.executeWithIsolation(
                  toolCall.function.name,
                  enrichedArgs,
                  workspaceId,
                );
                return { toolCall, args, result };
              }),
            );

            // Emit in original tool_calls order so tool_call_id stays consistent
            for (const { toolCall, args, result } of healedResults) {
            if (result.status === 'success' && result.metadata?.contentBase64) {
                const artifact = await this.artifactService.createFromAgent({
                  workspaceId,
                  type:
                    result.metadata.format === 'xlsx' ||
                    result.metadata.format === 'csv'
                      ? 'spreadsheet'
                      : 'document',
                  name:
                    result.metadata.filename ||
                    `workspace-output-${Date.now()}.file`,
                  mimeType:
                    result.metadata.mimeType || 'application/octet-stream',
                  contentBase64: result.metadata.contentBase64,
                  preview: result.preview,
                  data: result.data,
                  createdBy: `workspace-agent:${toolCall.function.name}`,
                  tags: [
                    `workspace:${workspaceId}`,
                    `tool:${toolCall.function.name}`,
                  ],
                  lineage: [toolCall.function.name],
                });
                createdArtifactIds.push(artifact.id);
              }

              onEvent({
                type: 'tool_done',
                data: {
                  toolName: toolCall.function.name,
                  result,
                  timestamp: new Date().toISOString(),
                },
              });

              // Track file reads
              if (['search_workspace', 'read', 'list'].includes(toolCall.function.name)) {
                const current = this.readFiles.get(workspaceId) || [];
                current.push({ filename: args.filename || args.path || 'unknown', timestamp: new Date() });
                this.readFiles.set(workspaceId, current.slice(-30));
              }

              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: ToolResultFormatter.formatForLlm(toolCall.function.name, result),
              });
            }
          }

         // Execute mutating tools — full autonomous with built-in safety:
         // - delete: auto-backup to .arunaki-trash/ before delete
         // - desktop_send_keys: keyboard whitelist validation
         // - all tools: workspace path isolation via SelfHealingService
         // - natural 1-turn feedback: a failed mutation is returned to the LLM
         //   as an ordinary tool result; the agent self-corrects next turn.
         for (const { toolCall, args } of mutatingCalls) {
            const funcName = toolCall.function.name;

            this.logger.log(`Auto-executing workspace tool: ${funcName} (${args.filename || args.keys || ''})`);

            onEvent({
              type: 'tool_start',
              data: {
                toolName: funcName,
                args,
                timestamp: new Date().toISOString(),
              },
            });

            let result: ToolResult;
            try {
              const mentionedFiles = this.mentionedFiles.get(workspaceId) || new Set<string>();
              const rawTargetName = String(args.filename || args.filePath || '');
              const targetBasename = path.basename(rawTargetName).toLowerCase();
              const isMentioned = [...mentionedFiles].some(
                (name) => path.basename(name).toLowerCase() === targetBasename,
              );
              if (mentionedFiles.size > 0 && funcName === 'write' && !isMentioned) {
                throw new Error('A file referenced with @ must be the update target.');
              }
              if (isMentioned && ['delete', 'rename'].includes(funcName)) {
                throw new Error('Files referenced with @ cannot be deleted or renamed during an edit run.');
              }
              if (funcName === 'delete' && !hasExplicitDeleteIntent(safeGoal, rawTargetName)) {
                throw new Error('Deletion denied: the instruction must explicitly ask to delete and name the target file.');
              }
              if (typeof args.content === 'string' && /@[^\s@]+\.[A-Za-z0-9]{1,10}/.test(args.content)) {
                throw new Error('Content still contains raw @file references and cannot be saved.');
              }
              const enrichedArgs = { ...args, workspaceId };
              result = await this.selfHealingService.executeWithIsolation(
                funcName,
                enrichedArgs,
                workspaceId,
              );
            } catch (e) {
              result = {
                status: 'error',
                data: {},
                preview: `Tool execution failed: ${e.message}`,
                metadata: {
                  toolName: funcName,
                  displayName: funcName,
                  executionTime: 0,
                },
                error: { code: 'EXECUTION_FAILED', message: e.message },
              };
            }

            if (result.status === 'error') {
              this.logger.warn(`Tool "${funcName}" returned error: ${result.error?.message || result.preview}`);
            }

            if (result.status === 'success' && result.metadata?.contentBase64) {
              const artifact = await this.artifactService.createFromAgent({
                workspaceId,
                type:
                  result.metadata.format === 'xlsx' ||
                  result.metadata.format === 'csv'
                    ? 'spreadsheet'
                    : 'document',
                name:
                  result.metadata.filename ||
                  `workspace-output-${Date.now()}.file`,
                mimeType: result.metadata.mimeType || 'application/octet-stream',
                contentBase64: result.metadata.contentBase64,
                preview: result.preview,
                data: result.data,
                createdBy: `workspace-agent:${funcName}`,
                tags: [`workspace:${workspaceId}`, `tool:${funcName}`],
                lineage: [funcName],
              });
              createdArtifactIds.push(artifact.id);
            }

             onEvent({
               type: 'tool_done',
               data: {
                 toolName: funcName,
                 result,
                 timestamp: new Date().toISOString(),
               },
             });

              // Track modified files
              if (result.status === 'success') {
                const filename = args.filename || args.path || 'unknown';
                const current = this.modifiedFiles.get(workspaceId) || [];
                current.push({ filename, timestamp: new Date() });
                this.modifiedFiles.set(workspaceId, current.slice(-30));
              }

             messages.push({
               role: 'tool',
               tool_call_id: toolCall.id,
               content: ToolResultFormatter.formatForLlm(funcName, result),
             });
           }

           // Compact history if the accumulated token budget is exceeded
           // (OpenClaw compaction.ts — threshold scales to the active model
           // window, so a 32K model compacts long before a 128K one would).
           const compactResult = await this.compactionService.compactHistory(
             messages,
             modelCtx.contextWindow,
           );
           if (compactResult.wasCompacted) {
              messages.length = 0;
              messages.push(...compactResult.compactedMessages);
            }

            // opencode-style: keep looping while the model keeps returning
            // tool_calls. If a steering/follow-up input arrived mid-run, inject
            // it and continue the loop; otherwise just continue with tool
            // results already fed back to the model.
            const steeringInputs = this.steeringQueue.get(workspaceId) || [];
            if (steeringInputs.length > 0) {
              const steering = steeringInputs.shift()!;
              if (steeringInputs.length === 0) {
                this.steeringQueue.delete(workspaceId);
              }
              messages.push({
                role: 'user',
                content: steering.message,
              });
              this.logger.log(`Steering input injected for workspace ${workspaceId}: "${steering.message.substring(0, 100)}"`);
              onEvent({
                type: 'steering',
                data: { message: 'Follow-up received, continuing analysis...' },
              });
            }
         }

      if (reachedMaxRounds) {
        this.logger.warn(
          'Workspace agent reached max round limit without completion.',
        );
      }
      if (!finalContent) {
        if (reachedMaxRounds) {
          finalContent =
            'Agent reached maximum step limit. Results so far may be incomplete -- please continue your request if needed.';
        } else {
          finalContent = 'Autonomous workspace task completed.';
        }
      }

      const artifactRecords = await Promise.all(
        createdArtifactIds.map((aid) =>
          this.artifactService.findById(aid).catch(() => null),
        ),
      );

      const artifacts = artifactRecords.filter(Boolean).map((a) => {
        const meta = this.artifactService.parseMetadata(a!);
        return {
          id: a!.id,
          type: a!.type,
          filename: a!.name,
          mimeType: meta.mimeType || 'application/octet-stream',
          preview: a!.preview,
          status: 'draft',
          createdAt: a!.createdAt,
        };
      });

      onEvent({
        type: 'done',
        data: {
          content: finalContent,
          artifacts,
        },
      });

      this.setPhase(runState, 'completed', onEvent);
      this.setState(runState, 'completed', onEvent);

      // Emit agent completed event
      this.eventEmitter.emit('workspace.agent.completed', {
        workspaceId,
        goal: userGoal,
        finalContent: finalContent.substring(0, 200),
        artifactsCount: artifacts.length,
        timestamp: new Date(),
      });

      // Persist analysis result to workspace (cached across sessions)
      try {
        await this.prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            analysisResult: finalContent,
            analyzedAt: new Date(),
          },
        });
        this.logger.log(
          `Cached analysis result for workspace ${workspaceId} (${finalContent.length} chars)`,
        );
      } catch (e: any) {
        this.logger.warn(`Failed to cache analysis result: ${e.message}`);
      }

      // Auto-save memory after successful task completion
      try {
        // Fetch business type for domain-aware memory
        let saveDomain = 'generic';
        try {
          const ws = await this.prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { businessType: true },
          });
          if (ws?.businessType) saveDomain = ws.businessType;
        } catch {}

        await this.memoryService.recordWorkspaceHistory(
          workspaceId,
          `Goal: ${userGoal}\nResult: ${finalContent.substring(0, 500)}`,
          saveDomain,
        );

        // Save structured interaction memory (OpenClaw memory/YYYY-MM-DD.md pattern)
        const modified = this.modifiedFiles.get(workspaceId) || [];
        const memoryDetails = {
          goal: userGoal,
          result: finalContent.substring(0, 500),
          modifiedFiles: modified.map((f) => f.filename),
          totalRounds: runState.round,
          timestamp: new Date().toISOString(),
        };
        await this.memoryService.remember({
          type: 'run_summary',
          key: `run_${workspaceId}_${Date.now()}`,
          content: JSON.stringify(memoryDetails),
          source: 'auto',
          importance: 6,
          domain: saveDomain,
          workspaceId,
        });

        this.logger.log(
          `Auto-saved workspace history memory for workspace ${workspaceId}`,
        );

        // Background review — extract learnings from conversation
        await this.backgroundReviewService.reviewAndLearn(
          messages.map((m) => ({ role: m.role, content: m.content || '' })),
          workspaceId,
          saveDomain,
        );
      } catch (e) {
        this.logger.warn(`Failed to auto-save workspace history: ${e.message}`);
      }

      return finalContent;
    } catch (error) {
      this.setState(runState, 'failed', onEvent);

      // Emit agent failed event
      this.eventEmitter.emit('workspace.agent.failed', {
        workspaceId,
        goal: userGoal,
        error: error.message,
        timestamp: new Date(),
      });

      this.logger.error(`Workspace stream execution failed: ${error.message}`);
      const friendly = /rate limit|429|free-models-per-day/i.test(error.message)
        ? 'The AI server is rate-limited (HTTP 429). Try again in a few minutes or use a paid API key.'
        : error.message;
      onEvent({ type: 'error', data: { message: friendly, code: 'AI_PROVIDER_ERROR' } });
      throw error;
    } finally {
      this.activeRuns.delete(workspaceId);
      if (lease) {
        await lease.release().catch((e: any) => this.logger.warn(`Failed to release lease: ${e.message}`));
      }
    }
  }
}


export type AgentState =
  | 'idle'
  | 'running'
  | 'steering'
  | 'aborting'
  | 'completed'
  | 'failed';

export type ExecutionPhase =
  | 'scanning'
  | 'planning'
  | 'reading'
  | 'analyzing'
  | 'generating'
  | 'completed';

export interface WorkspaceRunState {
  workspaceId: string;
  state: AgentState;
  goal: string;
  startedAt: Date;
  round: number;
  currentPhase: ExecutionPhase;
  abortController: AbortController;
}

export interface WorkspaceRunParams {
  workspaceId: string;
  userGoal: string;
  historyMessages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  modelId?: string;
}