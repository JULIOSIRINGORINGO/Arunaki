import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export const AgentEvents = {
  AGENT_STARTED: 'workspace.agent.started',
  AGENT_COMPLETED: 'workspace.agent.completed',
  AGENT_FAILED: 'workspace.agent.failed',
  AGENT_ABORTED: 'workspace.agent.aborted',
  PHASE_CHANGED: 'workspace.agent.phase_changed',
  STATE_CHANGED: 'workspace.agent.state_changed',
  ROLLBACK: 'workspace.rollback',
} as const;

export type AgentEventName = (typeof AgentEvents)[keyof typeof AgentEvents];

export interface AgentStartedEvent {
  workspaceId: string;
  goal: string;
  timestamp: Date;
}

export interface AgentCompletedEvent {
  workspaceId: string;
  goal: string;
  finalContent: string;
  messages: Array<{ role: string; content: string }>;
  artifactsCount: number;
  timestamp: Date;
}

export interface AgentFailedEvent {
  workspaceId: string;
  goal: string;
  reason?: string;
  error?: string;
  timestamp: Date;
}

export interface AgentAbortedEvent {
  workspaceId: string;
  goal: string;
  timestamp: Date;
}

export interface PhaseChangedEvent {
  workspaceId: string;
  from: string;
  to: string;
  label: string;
  round: number;
  timestamp: Date;
}

export interface StateChangedEvent {
  workspaceId: string;
  from: string;
  to: string;
  round: number;
  timestamp: Date;
}

export interface RollbackEvent {
  workspaceId: string;
  sessionId: string;
  rollbackEvent: unknown;
  restoredFiles: Array<{ filePath: string; bytesRestored: number }>;
}

export type AgentEventPayload =
  | AgentStartedEvent
  | AgentCompletedEvent
  | AgentFailedEvent
  | AgentAbortedEvent
  | PhaseChangedEvent
  | StateChangedEvent
  | RollbackEvent;

@Injectable()
export class AgentEventService {
  constructor(private readonly emitter: EventEmitter2) {}

  emitStarted(event: AgentStartedEvent): void {
    this.emitter.emit(AgentEvents.AGENT_STARTED, event);
  }

  emitCompleted(event: AgentCompletedEvent): void {
    this.emitter.emit(AgentEvents.AGENT_COMPLETED, event);
  }

  emitFailed(event: AgentFailedEvent): void {
    this.emitter.emit(AgentEvents.AGENT_FAILED, event);
  }

  emitAborted(event: AgentAbortedEvent): void {
    this.emitter.emit(AgentEvents.AGENT_ABORTED, event);
  }

  emitPhaseChanged(event: PhaseChangedEvent): void {
    this.emitter.emit(AgentEvents.PHASE_CHANGED, event);
  }

  emitStateChanged(event: StateChangedEvent): void {
    this.emitter.emit(AgentEvents.STATE_CHANGED, event);
  }

  emitRollback(event: RollbackEvent): void {
    this.emitter.emit(AgentEvents.ROLLBACK, event);
  }
}
