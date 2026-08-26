import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

export type TranscriptEventType =
  | 'session_start'
  | 'user_message'
  | 'agent_thought'
  | 'tool_call_pre'
  | 'tool_call_post'
  | 'file_snapshot_pre'
  | 'file_snapshot_post'
  | 'agent_message'
  | 'rollback_performed'
  | 'error';

export interface TranscriptEvent {
  id: string;
  sessionId: string;
  sequence: number;
  timestamp: string;
  type: TranscriptEventType;
  payload: Record<string, any>;
}

export interface CheckpointInfo {
  checkpointId: string;
  sequence: number;
  timestamp: string;
  tool: string;
  filePath: string;
  description: string;
  hasSnapshot: boolean;
}

@Injectable()
export class TranscriptEngineService {
  private readonly logger = new Logger(TranscriptEngineService.name);
  private sequenceCounters = new Map<string, number>();

  /**
   * Get the directory path where session transcripts are stored.
   */
  getSessionDir(workspaceRoot: string, sessionId: string): string {
    const sessionDir = path.join(
      workspaceRoot,
      '.arunaki',
      'sessions',
      sessionId,
    );
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    return sessionDir;
  }

  /**
   * Get the absolute path to a session's transcript.jsonl file.
   */
  getTranscriptPath(workspaceRoot: string, sessionId: string): string {
    const sessionDir = this.getSessionDir(workspaceRoot, sessionId);
    return path.join(sessionDir, 'transcript.jsonl');
  }

  /**
   * Append a single atomic event to the session transcript.
   */
  async appendEvent(
    workspaceRoot: string,
    sessionId: string,
    type: TranscriptEventType,
    payload: Record<string, any> = {},
  ): Promise<TranscriptEvent> {
    try {
      const transcriptPath = this.getTranscriptPath(workspaceRoot, sessionId);
      const counterKey = `${workspaceRoot}:${sessionId}`;

      let seq = this.sequenceCounters.get(counterKey);
      if (seq === undefined) {
        // Compute from existing lines if any
        if (fs.existsSync(transcriptPath)) {
          const content = fs.readFileSync(transcriptPath, 'utf-8');
          const lines = content.split('\n').filter((l) => l.trim().length > 0);
          seq = lines.length;
        } else {
          seq = 0;
        }
      }

      seq += 1;
      this.sequenceCounters.set(counterKey, seq);

      const event: TranscriptEvent = {
        id: `evt-${randomUUID()}`,
        sessionId,
        sequence: seq,
        timestamp: new Date().toISOString(),
        type,
        payload,
      };

      const line = JSON.stringify(event) + '\n';
      fs.appendFileSync(transcriptPath, line, 'utf-8');

      return event;
    } catch (err: any) {
      this.logger.error(
        `Failed to append transcript event (${type}): ${err.message}`,
      );
      throw err;
    }
  }

  /**
   * Read the full chronological transcript for a session.
   */
  async getTranscript(
    workspaceRoot: string,
    sessionId: string,
  ): Promise<TranscriptEvent[]> {
    const transcriptPath = this.getTranscriptPath(workspaceRoot, sessionId);
    if (!fs.existsSync(transcriptPath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(transcriptPath, 'utf-8');
      const lines = content.split('\n').filter((l) => l.trim().length > 0);
      const events: TranscriptEvent[] = [];
      for (const line of lines) {
        try {
          events.push(JSON.parse(line));
        } catch {
          // Skip corrupt line
        }
      }
      return events;
    } catch (err: any) {
      this.logger.error(
        `Failed to read transcript for session ${sessionId}: ${err.message}`,
      );
      return [];
    }
  }

  /**
   * Read file content safely for snapshotting.
   */
  captureFileSnapshot(
    workspaceRoot: string,
    relativePath: string,
  ): string | null {
    try {
      const resolvedRoot = path.resolve(workspaceRoot);
      const targetPath = path.isAbsolute(relativePath)
        ? path.resolve(relativePath)
        : path.resolve(resolvedRoot, relativePath);

      // Workspace isolation: snapshots must never read outside the root
      const rel = path.relative(resolvedRoot, targetPath);
      if (rel.startsWith('..') || path.isAbsolute(rel)) {
        this.logger.warn(
          `Snapshot blocked (outside workspace): ${relativePath.slice(0, 120)}`,
        );
        return null;
      }

      if (!fs.existsSync(targetPath)) {
        return null;
      }
      return fs.readFileSync(targetPath, 'utf-8');
    } catch (err: any) {
      this.logger.warn(`Could not snapshot ${relativePath}: ${err.message}`);
      return null;
    }
  }

  /**
   * Extract all rollbackable checkpoints from the transcript.
   */
  async getCheckpoints(
    workspaceRoot: string,
    sessionId: string,
  ): Promise<CheckpointInfo[]> {
    const events = await this.getTranscript(workspaceRoot, sessionId);
    const checkpoints: CheckpointInfo[] = [];

    for (const evt of events) {
      if (evt.type === 'file_snapshot_pre') {
        checkpoints.push({
          checkpointId: evt.id,
          sequence: evt.sequence,
          timestamp: evt.timestamp,
          tool: evt.payload.tool || 'edit',
          filePath: evt.payload.filePath || 'document',
          description:
            evt.payload.description ||
            `Pre-mutation snapshot of ${evt.payload.filePath}`,
          hasSnapshot: !!evt.payload.snapshotContent,
        });
      }
    }

    return checkpoints;
  }
}
