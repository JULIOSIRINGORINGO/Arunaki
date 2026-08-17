import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

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
export class WorkspaceRunStateService {
  private readonly logger = new Logger(WorkspaceRunStateService.name);

  /** Track modified files per workspace session */
  private readonly modifiedFiles = new Map<string, Array<{ filename: string; timestamp: Date }>>();

  /** Track read files per workspace session */
  private readonly readFiles = new Map<string, Array<{ filename: string; timestamp: Date }>>();

  /** Track explicitly mentioned files in current goal */
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

  private readonly PHASE_LABELS: Record<ExecutionPhase, string> = {
    scanning: 'Scanning workspace documents...',
    planning: 'Formulating execution plan...',
    reading: 'Reading file contents...',
    analyzing: 'Analyzing data...',
    generating: 'Generating output...',
    completed: 'Completed',
  };

  constructor(private readonly eventEmitter: EventEmitter2) {}

  createRunState(workspaceId: string, goal: string): WorkspaceRunState {
    const abortController = new AbortController();
    const runState: WorkspaceRunState = {
      workspaceId,
      state: 'idle',
      goal,
      startedAt: new Date(),
      round: 0,
      currentPhase: 'scanning',
      abortController,
    };
    this.activeRuns.set(workspaceId, runState);
    return runState;
  }

  getRunState(workspaceId: string): WorkspaceRunState | undefined {
    return this.activeRuns.get(workspaceId);
  }

  isRunning(workspaceId: string): boolean {
    const state = this.activeRuns.get(workspaceId);
    return state?.state === 'running' || state?.state === 'steering';
  }

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

  getAllActiveRuns(): WorkspaceRunState[] {
    return Array.from(this.activeRuns.values());
  }

  deleteRunState(workspaceId: string): void {
    this.activeRuns.delete(workspaceId);
  }

  setPhase(
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

    this.eventEmitter.emit('workspace.agent.phase_changed', {
      workspaceId: runState.workspaceId,
      from: oldPhase,
      to: phase,
      label: this.PHASE_LABELS[phase],
      round: runState.round,
      timestamp: new Date(),
    });
  }

  setState(
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

    this.eventEmitter.emit('workspace.agent.state_changed', {
      workspaceId: runState.workspaceId,
      from: oldState,
      to: newState,
      round: runState.round,
      timestamp: new Date(),
    });
  }

  waitForApproval(
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

  resolveApproval(workspaceId: string, approved: boolean): boolean {
    const pending = this.approvalQueue.get(workspaceId);
    if (!pending) return false;
    pending.resolve(approved);
    this.approvalQueue.delete(workspaceId);
    this.logger.log(`Approval resolved: ${approved ? 'approved' : 'rejected'} (${pending.toolName})`);
    return true;
  }

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

  consumeSteeringInput(workspaceId: string): { message: string; timestamp: Date } | undefined {
    const queue = this.steeringQueue.get(workspaceId);
    if (!queue || queue.length === 0) return undefined;
    const steering = queue.shift();
    if (queue.length === 0) {
      this.steeringQueue.delete(workspaceId);
    }
    return steering;
  }

  resetSessionTracks(workspaceId: string): void {
    this.modifiedFiles.delete(workspaceId);
    this.readFiles.delete(workspaceId);
    this.mentionedFiles.delete(workspaceId);
  }

  getModifiedFiles(workspaceId: string): Array<{ filename: string; timestamp: Date }> {
    return this.modifiedFiles.get(workspaceId) || [];
  }

  trackModifiedFile(workspaceId: string, filename: string): void {
    const current = this.modifiedFiles.get(workspaceId) || [];
    current.push({ filename, timestamp: new Date() });
    this.modifiedFiles.set(workspaceId, current.slice(-30));
  }

  getReadFiles(workspaceId: string): Array<{ filename: string; timestamp: Date }> {
    return this.readFiles.get(workspaceId) || [];
  }

  trackReadFile(workspaceId: string, filename: string): void {
    const current = this.readFiles.get(workspaceId) || [];
    current.push({ filename, timestamp: new Date() });
    this.readFiles.set(workspaceId, current.slice(-30));
  }

  setMentionedFiles(workspaceId: string, files: Set<string>): void {
    this.mentionedFiles.set(workspaceId, files);
  }

  getMentionedFiles(workspaceId: string): Set<string> {
    return this.mentionedFiles.get(workspaceId) || new Set<string>();
  }
}
