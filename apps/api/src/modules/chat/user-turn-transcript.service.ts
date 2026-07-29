import { Injectable, Logger } from '@nestjs/common';

export type TranscriptState =
  | 'created'
  | 'sent_to_provider'
  | 'runtime_persisted'
  | 'approved';

export interface TurnTranscript {
  runId: string;
  sessionKey: string;
  state: TranscriptState;
  createdAt: number;
  sentToProviderAt?: number;
  runtimePersistedAt?: number;
  approvedAt?: number;
  messageCountBefore: number;
  messageCountAfter?: number;
}

@Injectable()
export class UserTurnTranscriptService {
  private readonly logger = new Logger(UserTurnTranscriptService.name);
  private readonly transcripts = new Map<string, TurnTranscript>();
  private readonly TURN_TIMEOUT_MS = 300_000;

  createTurn(runId: string, sessionKey: string, messageCountBefore: number): TurnTranscript {
    const existing = this.transcripts.get(runId);
    if (existing) {
      this.logger.warn(`Turn ${runId} already exists, returning existing`);
      return existing;
    }

    const transcript: TurnTranscript = {
      runId,
      sessionKey,
      state: 'created',
      createdAt: Date.now(),
      messageCountBefore,
    };

    this.transcripts.set(runId, transcript);
    this.logger.debug(`Turn created: ${runId} (messages before: ${messageCountBefore})`);
    return transcript;
  }

  markSentToProvider(runId: string): TurnTranscript | null {
    const t = this.transcripts.get(runId);
    if (!t) {
      this.logger.warn(`markSentToProvider: turn ${runId} not found`);
      return null;
    }
    t.state = 'sent_to_provider';
    t.sentToProviderAt = Date.now();
    return t;
  }

  markRuntimePersisted(runId: string, messageCountAfter: number): TurnTranscript | null {
    const t = this.transcripts.get(runId);
    if (!t) {
      this.logger.warn(`markRuntimePersisted: turn ${runId} not found`);
      return null;
    }
    t.state = 'runtime_persisted';
    t.runtimePersistedAt = Date.now();
    t.messageCountAfter = messageCountAfter;
    return t;
  }

  markApproved(runId: string): TurnTranscript | null {
    const t = this.transcripts.get(runId);
    if (!t) {
      this.logger.warn(`markApproved: turn ${runId} not found`);
      return null;
    }
    t.state = 'approved';
    t.approvedAt = Date.now();
    return t;
  }

  findByRunId(runId: string): TurnTranscript | undefined {
    return this.transcripts.get(runId);
  }

  hasActiveTurn(sessionKey: string): TurnTranscript | null {
    for (const t of this.transcripts.values()) {
      if (t.sessionKey === sessionKey && t.state !== 'approved') {
        if (Date.now() - t.createdAt > this.TURN_TIMEOUT_MS) {
          this.transcripts.delete(t.runId);
          continue;
        }
        return t;
      }
    }
    return null;
  }

  isLateMedia(runId: string, currentMessageCount: number): boolean {
    const t = this.transcripts.get(runId);
    if (!t) return false;
    return currentMessageCount > t.messageCountBefore;
  }

  getActiveTranscripts(): TurnTranscript[] {
    const active: TurnTranscript[] = [];
    const now = Date.now();
    for (const t of this.transcripts.values()) {
      if (now - t.createdAt <= this.TURN_TIMEOUT_MS) {
        active.push(t);
      }
    }
    return active;
  }

  cleanupStaleTurns(): number {
    const now = Date.now();
    let count = 0;
    for (const [runId, t] of this.transcripts.entries()) {
      if (now - t.createdAt > this.TURN_TIMEOUT_MS) {
        this.transcripts.delete(runId);
        count++;
      }
    }
    return count;
  }
}
