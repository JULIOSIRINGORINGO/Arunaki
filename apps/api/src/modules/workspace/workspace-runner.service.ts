import { Injectable, Logger, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AiService, ChatMessage } from '../ai/ai.service.js';
import {
  ContextManager,
  StreamingContextScrubber,
} from '../ai/context-manager.js';
import { ContextRegistry } from '../ai/context/context-registry.service.js';
import { ToolRegistryService } from '../tools/tool-registry.service.js';
import { DocumentReaderTool } from '../tools/services/document-reader.tool.js';
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
import { PrismaService } from '../../common/providers/prisma.service.js';
import { ToolResult } from '../tools/interfaces/tool-result.interface.js';
import { DomainRegistryService } from '../domain/domain.registry.service.js';
import * as path from 'path';

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
    private readonly aiService: AiService,
    private readonly toolRegistryService: ToolRegistryService,
    private readonly documentReaderTool: DocumentReaderTool,
    private readonly storageService: StorageService,
    private readonly fileService: FileService,
    private readonly searchService: SearchService,
    private readonly artifactService: ArtifactService,
    private readonly memoryService: MemoryService,
    private readonly backgroundReviewService: BackgroundReviewService,
    private readonly smartRecallService: SmartRecallService,
    private readonly skillService: SkillService,
    private readonly selfHealingService: SelfHealingService,
    private readonly promptInjectionDetector: PromptInjectionDetector,
    private readonly prisma: PrismaService,
    private readonly contextRegistry: ContextRegistry,
    private readonly domainRegistry: DomainRegistryService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Get current state of a workspace run */
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
  ): Promise<boolean> {
    return new Promise((resolve) => {
      this.approvalQueue.set(workspaceId, {
        resolve,
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
      .catch((err) => { done = true; if (resolveEvent) resolveEvent(null); });

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

  /**
   * Refresh context mid-run every N rounds.
   */
  private async prepareNextTurn(
    workspaceId: string,
    messages: ChatMessage[],
    round: number,
  ): Promise<void> {
    if (round > 0 && round % 5 === 0) {
      this.logger.log(`Refreshing context at round ${round}...`);
      try {
        const freshContext = await this.buildWorkspaceContext(workspaceId);
        messages.push({
          role: 'system',
          content: `[Context Refreshed - Round ${round}]\n${freshContext}`,
        });
      } catch (err: any) {
        this.logger.warn(`Context refresh failed (non-critical): ${err.message}`);
      }
    }
  }

  /** Map phase names to user-facing Indonesian labels */
  private readonly PHASE_LABELS: Record<ExecutionPhase, string> = {
    scanning: 'Memindai dokumen workspace...',
    planning: 'Menyusun rencana analisis...',
    reading: 'Membaca dan memahami file...',
    analyzing: 'Menganalisis data...',
    generating: 'Menghasilkan output...',
    completed: 'Selesai',
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

  async syncWorkspacePhysicalFiles(workspaceId: string): Promise<void> {
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
                  `- ${f.name} (Tipe: ${f.type}, Ukuran: ${Math.round(f.size / 1024)} KB)`,
              )
              .join('\n')
          : 'Belum ada file di workspace ini.';

      // Auto-read top 5 files to give AI actual content
      const previews: string[] = [];
      const maxPreviews = Math.min(filesToDescribe.length, 5);
      for (let i = 0; i < maxPreviews; i++) {
        const f = filesToDescribe[i];
        try {
          const result = await this.documentReaderTool.readDocument(f.path);
          if (result.status === 'success' && result.data?.text) {
            const truncated = (result.data.text as string).substring(0, 2000);
            previews.push(`--- ${f.name} ---\n${truncated}${(result.data.text as string).length > 2000 ? '\n...[truncated]' : ''}`);
          }
        } catch {
          // skip unreadable files
        }
      }

      // Get domain config for this business type
      const domainConfig = this.domainRegistry.get(businessType);
      const domainTerminology = this.domainRegistry.getTerminology(businessType);
      const domainUnits = this.domainRegistry.getUnits(businessType, 'length') || [];
      const domainTemplates = this.domainRegistry.getTemplateCategories(businessType);
      const domainCommunication = this.domainRegistry.getCommunication(businessType);

      // Auto-inject relevant skills
      const skillsContext = await this.skillService.getSkillsContext(
        businessType,
        workspaceId,
      );

      // Frozen snapshot: inject relevant memories at session start
      const memoryContext = await this.memoryService.getMemoryContext(
        businessType,
        workspaceId,
      );

      let context = `=== WORKSPACE CONTEXT (ID: ${workspaceId}) ===\nRoot Path: ${rootPath || 'N/A'}\nDaftar Berkas Terdeteksi:\n${fileList}\n=== END WORKSPACE CONTEXT ===`;

      if (previews.length > 0) {
        context += `\n\n=== ISI FILE (Preview) ===\n${previews.join('\n\n')}\n=== END ISI FILE ===`;
      }

      if (skillsContext) {
        context += `\n\n=== RELEVANT SKILLS ===\n${skillsContext}\n=== END SKILLS ===`;
      }

      if (memoryContext) {
        context += `\n\n=== MEMORY SNAPSHOT ===\n${memoryContext}\n=== END MEMORY ===`;
      }

      // Inject domain config (OpenClaw Layer 28)
      const domainLines: string[] = [];
      if (Object.keys(domainTerminology).length > 0) {
        domainLines.push(
          `=== DOMAIN TERMINOLOGY (${businessType}) ===`,
          Object.entries(domainTerminology)
            .map(([k, v]) => `- ${k}: ${v}`)
            .join('\n'),
          `=== END DOMAIN TERMINOLOGY ===`,
        );
      }
      if (domainUnits.length > 0) {
        domainLines.push(
          `=== DOMAIN UNITS (${businessType}) ===`,
          domainUnits.map((u) => `- ${u.name} (base: ${u.toBase}${u.label ? `, ${u.label}` : ''}`).join('\n'),
          `=== END DOMAIN UNITS ===`,
        );
      }
      if (domainTemplates.length > 0) {
        domainLines.push(
          `=== DOMAIN TEMPLATES (${businessType}) ===`,
          domainTemplates.map((t) => `- ${t.name}${t.columns ? ` [${t.columns.join(', ')}]` : ''}`).join('\n'),
          `=== END DOMAIN TEMPLATES ===`,
        );
      }
      if (domainCommunication?.greetingTemplate) {
        domainLines.push(
          `=== DOMAIN COMMUNICATION (${businessType}) ===`,
          `Greeting: ${domainCommunication.greetingTemplate}`,
          `Formality: ${domainCommunication.formality}`,
          `=== END DOMAIN COMMUNICATION ===`,
        );
      }
      if (domainLines.length > 0) {
        context += `\n\n${domainLines.join('\n\n')}`;
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
    } = params;

    // Guard: prevent duplicate runs on same workspace
    if (this.isRunning(workspaceId)) {
      onEvent({
        type: 'error',
        data: {
          message:
            'Workspace sedang dalam analisis. Tunggu selesai atau batalkan sebelum memulai baru.',
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
      
      // Emit agent started event
      this.eventEmitter.emit('workspace.agent.started', {
        workspaceId,
        goal: userGoal,
        timestamp: new Date(),
      });

      onEvent({
        type: 'thinking',
        data: 'Membaca konteks workspace dan memproses permintaan...',
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

      const systemPrompt = this.aiService.getSystemPrompt(
        'workspace',
        workspaceContext,
      );
      const tools = this.toolRegistryService.getToolDefinitions();

      const history = historyMessages.map((message) => ({
        role: message.role,
        content: message.content,
      })) as ChatMessage[];
      const context = await this.contextRegistry.getActive().assemble({
        mode: 'workspace',
        workspaceId,
        messages: history,
        workspaceContext,
        memoryContext: recallContext,
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
          data: { message: 'Input mengandung konten yang tidak diizinkan. Silakan perbaiki dan coba lagi.' },
        });
        return;
      }
      const safeGoal = injectionResult.detected
        ? injectionResult.sanitized
        : userGoal;

      // Crucial fix: Append current user goal to messages array so LLM knows what tool to call!
      const hasGoalInMessages = messages.some(
        (m) => m.role === 'user' && m.content === safeGoal,
      );
      if (!hasGoalInMessages) {
        messages.push({
          role: 'user',
          content: safeGoal,
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
          data: { message: 'Analisis dibatalkan oleh pengguna.' },
        });
        return;
      }
      const planningMessages: ChatMessage[] = [
        {
          role: 'system',
          content:
            'Kamu adalah AI Agent profesional yang membuat rencana kerja yang SANGAT PRESISI dan LANGSUNG SASARAN (1-3 poin singkat dalam Bahasa Indonesia).\n\nATURAN MUTLAK:\n1. FOKUS HANYA pada target file/tugas yang diminta user. JANGAN PERNAH membuka, membaca, atau mengekstrak file lain (seperti file .xlsx atau file lain) jika user HANYA meminta menyunting/mengisi satu file spesifik!\n2. Jika user meminta mengisi/menulis file (misal: "file test isi dengan julio" atau "tulis X di file Y"), buat rencana 1-2 langkah langsung:\n   1. Buat/sunting file test.txt dengan teks "julio".\n   2. Cek kembali isi file test.txt.\n3. Jangan buat langkah bertele-tele atau membuka file lain yang tidak relevan!',
        },
        {
          role: 'user',
          content: `Goal: ${safeGoal}\n\nKonteks workspace:\n${workspaceContext}`,
        },
      ];

      let steps: string[] = [];
      try {
        const planResponse = await this.aiService.chat(planningMessages, []);
        if (planResponse.content) {
          steps = planResponse.content
            .split('\n')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        }
      } catch (e) {
        this.logger.warn(`AI plan generation failed: ${e.message}`);
      }

      onEvent({
        type: 'plan_created',
        data: {
          goal: safeGoal,
          steps:
            steps.length > 0
              ? steps
              : ['Menyusun rencana berdasarkan goal Anda...'],
        },
      });

      let finalContent = '';
      const createdArtifactIds: string[] = [];
      const MAX_ROUNDS = 25;
      let reachedMaxRounds = true;

      this.setPhase(runState, 'planning', onEvent);

      // DUAL-LOOP: Outer loop (steering) + Inner loop (tool calls)
      for (let turn = 0; turn < 5; turn++) {
        // Inner loop: tool execution
        for (let round = 0; round < MAX_ROUNDS; round++) {
          // Check abort before each round
          if (abortController.signal.aborted) {
            this.setState(runState, 'aborting', onEvent);
            onEvent({
              type: 'error',
              data: { message: 'Analisis dibatalkan oleh pengguna.' },
            });
            return;
          }
          runState.round = turn * MAX_ROUNDS + round + 1;

          // Context refresh every 5 rounds
          await this.prepareNextTurn(workspaceId, messages, runState.round);

          if (runState.round > 1) this.setPhase(runState, 'analyzing', onEvent);

          const aiResponse = await this.aiService.chat(messages, tools);

          if (aiResponse.toolCalls.length === 0) {
            // OpenClaw Dynamic Tool Synthesizer: Fully generic NLP parser for any filename and content (0% hardcode)
            if (round === 0) {
              const fileMentionRegex = /(?:file|berkas|dokumen|catatan)\s+["']?([\w\-.]+)(?:\.([a-zA-Z0-9]+))?["']?/i;
              const writeIntentRegex = /(?:buat|tulis|create|simpan|isi|update)\s+/i;

              if (writeIntentRegex.test(safeGoal) || fileMentionRegex.test(safeGoal)) {
                let targetFilename = '';
                let format: 'txt' | 'xlsx' | 'docx' | 'csv' | 'json' = 'txt';

                const fileMatch = safeGoal.match(fileMentionRegex) || safeGoal.match(/["']?([\w\-.]+\.([a-zA-Z0-9]+))["']?/i);
                if (fileMatch && fileMatch[1]) {
                  const rawName = fileMatch[1].trim();
                  const ext = fileMatch[2] ? fileMatch[2].toLowerCase() : (rawName.includes('.') ? rawName.split('.').pop()?.toLowerCase() : '');
                  if (ext && ['xlsx', 'csv', 'pdf', 'docx', 'txt', 'md', 'json'].includes(ext)) {
                    targetFilename = rawName;
                    format = ext as any;
                  } else {
                    targetFilename = rawName.includes('.') ? rawName : `${rawName}.txt`;
                    format = 'txt';
                  }
                }

                if (targetFilename) {
                  // Dynamically extract content payload by stripping file references & action verbs
                  const baseName = targetFilename.replace(/\.[^.]+$/, '');
                  let extractedContent = safeGoal;
                  extractedContent = extractedContent.replace(new RegExp(`(?:file|berkas|dokumen|catatan)?\\s*["']?(?:${baseName}|${targetFilename})["']?`, 'gi'), '');
                  extractedContent = extractedContent.replace(/(?:buat|tulis|create|simpan|isi|berisi|update)\s+(?:dengan|teks|konten|isi)?/gi, '');
                  extractedContent = extractedContent.replace(/(?:di|ke|pada)\s+(?:file|berkas|dokumen)?/gi, '');
                  extractedContent = extractedContent.replace(/^dengan\s+/gi, '').trim();

                  const finalContent = extractedContent || `Dokumen ${targetFilename} telah dibuat oleh Arunaki AI.`;

                  this.logger.log(`OpenClaw Dynamic Synthesizer: Auto-executing write_workspace_file for "${targetFilename}" with content "${finalContent}"`);
                  
                  aiResponse.toolCalls.push({
                    id: `dynamic-call-${Date.now()}`,
                    type: 'function',
                    function: {
                      name: 'write_workspace_file',
                      arguments: JSON.stringify({
                        workspaceId,
                        filename: targetFilename,
                        format,
                        content: finalContent,
                        title: targetFilename,
                      }),
                    },
                  });
                }
              }
            }

            if (aiResponse.toolCalls.length === 0) {
              finalContent = this.scrubber.scrub(aiResponse.content);
              onEvent({ type: 'text_delta', data: finalContent });
              reachedMaxRounds = false;
              this.logger.log(
                'Workspace agent finished goal execution within round limit.',
              );
              break;
            }
          }

          messages.push({
            role: 'assistant',
            content: aiResponse.content || null,
            tool_calls: aiResponse.toolCalls,
          });

          // Update phase based on tool types
          const hasReadTools = aiResponse.toolCalls.some((tc) =>
            ['search_workspace', 'read_workspace_file', 'list_workspace_files'].includes(tc.function.name),
          );
          const hasWriteTools = aiResponse.toolCalls.some((tc) =>
            ['write_workspace_file', 'generate_export', 'draft_communication'].includes(tc.function.name),
          );
          if (hasReadTools) this.setPhase(runState, 'reading', onEvent);
          if (hasWriteTools) this.setPhase(runState, 'generating', onEvent);

          // Separate mutating vs read-only tools for parallel execution
          const mutatingTools = [
            'write_workspace_file',
            'update_workspace_file',
            'delete_workspace_file',
          ];

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
            try {
              args = JSON.parse(toolCall.function.arguments || '{}');
            } catch {
              args = {};
            }

            if (mutatingTools.includes(funcName)) {
              mutatingCalls.push({ toolCall, args });
            } else {
              readOnlyCalls.push({ toolCall, args });
            }
          }

          // Execute read-only tools in parallel with SelfHealing
          if (readOnlyCalls.length > 0) {
            onEvent({
              type: 'tool_start',
              data: {
                toolName: `parallel (${readOnlyCalls.map((c) => c.toolCall.function.name).join(', ')})`,
                args: {},
                timestamp: new Date().toISOString(),
              },
            });

            for (const { toolCall, args } of readOnlyCalls) {
              const enrichedArgs = { ...args, workspaceId };
              const healResult = await this.selfHealingService.executeWithHealing(
                toolCall.function.name,
                enrichedArgs,
              );
              const result = healResult.finalResult;

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

              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(result),
              });
            }
          }

          // Execute mutating tools (auto-approve write/update operations within user's connected workspace folder)
          for (const { toolCall, args } of mutatingCalls) {
            const funcName = toolCall.function.name;

            const isSafeWorkspaceMutate = ['write_workspace_file', 'update_workspace_file'].includes(funcName);

            if (!isSafeWorkspaceMutate) {
              this.logger.warn(
                `Approval Gate: Requesting consent for mutating tool "${funcName}".`,
              );

              this.setState(runState, 'steering', onEvent);
              onEvent({
                type: 'approval_required',
                data: {
                  toolName: funcName,
                  args,
                  description: `Agent ingin melakukan aksi "${funcName}" (${args.filename || args.filePath || ''}) pada workspace. Mohon izinkan untuk melanjutkan.`,
                },
              });

              const approved = await this.waitForApproval(workspaceId, funcName, args);
              if (!approved) {
                onEvent({
                  type: 'error',
                  data: { message: `Aksi "${funcName}" ditolak oleh pengguna.` },
                });
                return;
              }
            } else {
              this.logger.log(`Auto-approving workspace tool execution: ${funcName} (${args.filename || ''})`);
            }

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
              const enrichedArgs = { ...args, workspaceId };
              const healResult = await this.selfHealingService.executeWithHealing(
                funcName,
                enrichedArgs,
              );
              result = healResult.finalResult;
            } catch (e) {
              result = {
                status: 'error',
                data: {},
                preview: `Eksekusi tool gagal: ${e.message}`,
                metadata: {
                  toolName: funcName,
                  displayName: funcName,
                  executionTime: 0,
                },
                error: { code: 'EXECUTION_FAILED', message: e.message },
              };
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

            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            });

            // Immediately terminate loop upon successful write_workspace_file execution
            if (result.status === 'success' && funcName === 'write_workspace_file') {
              this.logger.log(`write_workspace_file completed successfully for "${args.filename}". Terminating agent loop.`);
              finalContent = `Berkas **${args.filename}** berhasil dibuat/disunting dengan isi: "${args.content}".`;
              onEvent({ type: 'text_delta', data: finalContent });
              reachedMaxRounds = false;
              break;
            }
          }
        }

        if (!reachedMaxRounds) {
          break; // Inner loop completed with a final answer
        }

        // Check for steering input before next turn
        const steeringInputs = this.steeringQueue.get(workspaceId) || [];
        if (steeringInputs.length === 0) {
          break; // No steering, exit outer loop
        }

        // Inject steering input and continue outer loop
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
          data: { message: 'Follow-up diterima, melanjutkan analisis...' },
        });
        reachedMaxRounds = true;
      }

      if (reachedMaxRounds) {
        this.logger.warn(
          'Workspace agent reached max round limit without completion.',
        );
        if (!finalContent) {
          finalContent =
            'Agent mencapai batas maksimal langkah kerja. Hasil sejauh ini mungkin belum lengkap — silakan lanjutkan permintaan jika perlu.';
        }
      } else if (!finalContent) {
        finalContent = 'Pekerjaan otonom di Workspace telah selesai.';
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
          `Goal: ${userGoal}\nHasil: ${finalContent.substring(0, 500)}`,
          saveDomain,
        );
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
      onEvent({ type: 'error', data: { message: error.message } });
      throw error;
    } finally {
      this.activeRuns.delete(workspaceId);
    }
  }
}
