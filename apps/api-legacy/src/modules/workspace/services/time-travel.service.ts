import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../../common/providers/prisma.service.js';
import {
  TranscriptEngineService,
  TranscriptEvent,
} from './transcript-engine.service.js';
import { AgentEventService } from './agent-event.service.js';

export interface RollbackResult {
  success: boolean;
  restoredFiles: Array<{ filePath: string; bytesRestored: number }>;
  restoredCount: number;
  rollbackTimestamp: string;
  targetCheckpointId: string;
  targetSequence: number;
  message: string;
}

@Injectable()
export class TimeTravelService {
  private readonly logger = new Logger(TimeTravelService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transcriptEngine: TranscriptEngineService,
    private readonly agentEvents: AgentEventService,
  ) {}

  /**
   * Execute 1-Click Undo / Rollback on a session to a target checkpoint or the most recent pre-mutation state.
   */
  async rollbackSession(
    workspaceId: string,
    sessionId: string,
    options: { targetCheckpointId?: string; targetSequence?: number } = {},
  ): Promise<RollbackResult> {
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { rootPath: true, id: true },
    });

    if (!ws || !ws.rootPath) {
      throw new NotFoundException(
        `Workspace ${workspaceId} not found or has no rootPath`,
      );
    }

    const workspaceRoot = ws.rootPath;
    const events = await this.transcriptEngine.getTranscript(
      workspaceRoot,
      sessionId,
    );

    if (events.length === 0) {
      throw new NotFoundException(
        `No transcript events found for session ${sessionId}`,
      );
    }

    // Find candidate snapshot events
    const snapshotEvents = events.filter((e) => e.type === 'file_snapshot_pre');

    if (snapshotEvents.length === 0) {
      return {
        success: false,
        restoredFiles: [],
        restoredCount: 0,
        rollbackTimestamp: new Date().toISOString(),
        targetCheckpointId: '',
        targetSequence: 0,
        message: 'No file snapshots found to rollback to.',
      };
    }

    const restoredFiles: Array<{ filePath: string; bytesRestored: number }> =
      [];
    let targetCheckpointId = '';
    let targetSequence = 0;

    if (options.targetCheckpointId) {
      const targetEvent = snapshotEvents.find(
        (e) => e.id === options.targetCheckpointId,
      );
      if (!targetEvent) {
        throw new NotFoundException(
          `Checkpoint ${options.targetCheckpointId} not found in transcript`,
        );
      }
      targetCheckpointId = targetEvent.id;
      targetSequence = targetEvent.sequence;

      const relPath = targetEvent.payload.filePath || targetEvent.payload.path;
      if (relPath) {
        const fullPath = path.isAbsolute(relPath)
          ? relPath
          : path.join(workspaceRoot, relPath);
        const snapshotContent = targetEvent.payload.snapshotContent;
        if (snapshotContent !== undefined && snapshotContent !== null) {
          const parentDir = path.dirname(fullPath);
          if (!fs.existsSync(parentDir))
            fs.mkdirSync(parentDir, { recursive: true });
          fs.writeFileSync(fullPath, snapshotContent, 'utf-8');
          restoredFiles.push({
            filePath: relPath,
            bytesRestored: Buffer.byteLength(snapshotContent, 'utf-8'),
          });
        }
      }
    } else {
      // 1-Click Session Rollback: Restore every unique file to its earliest snapshot in the session
      const filesSeen = new Set<string>();
      targetCheckpointId = snapshotEvents[0].id;
      targetSequence = snapshotEvents[0].sequence;

      for (const snap of snapshotEvents) {
        const relPath = snap.payload.filePath || snap.payload.path;
        if (!relPath || filesSeen.has(relPath)) continue;
        filesSeen.add(relPath);

        const fullPath = path.isAbsolute(relPath)
          ? relPath
          : path.join(workspaceRoot, relPath);
        const snapshotContent = snap.payload.snapshotContent;

        if (snapshotContent !== undefined && snapshotContent !== null) {
          const parentDir = path.dirname(fullPath);
          if (!fs.existsSync(parentDir))
            fs.mkdirSync(parentDir, { recursive: true });
          fs.writeFileSync(fullPath, snapshotContent, 'utf-8');
          restoredFiles.push({
            filePath: relPath,
            bytesRestored: Buffer.byteLength(snapshotContent, 'utf-8'),
          });
          this.logger.log(
            `[TimeTravel] Restored file "${relPath}" to initial session state`,
          );
        } else if (snap.payload.fileExisted === false) {
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            restoredFiles.push({ filePath: relPath, bytesRestored: 0 });
            this.logger.log(
              `[TimeTravel] Removed newly created file "${relPath}" on session undo`,
            );
          }
        }
      }
    }

    // Deduplicate restored files
    const uniqueRestored = Array.from(
      new Map(restoredFiles.map((item) => [item.filePath, item])).values(),
    );

    // Record audit event in append-only transcript
    const rollbackEvent = await this.transcriptEngine.appendEvent(
      workspaceRoot,
      sessionId,
      'rollback_performed',
      {
        targetCheckpointId,
        targetSequence,
        restoredFiles: uniqueRestored,
        restoredCount: uniqueRestored.length,
      },
    );

    this.agentEvents.emitRollback({
      workspaceId,
      sessionId,
      rollbackEvent,
      restoredFiles: uniqueRestored,
    });

    return {
      success: true,
      restoredFiles: uniqueRestored,
      restoredCount: uniqueRestored.length,
      rollbackTimestamp: rollbackEvent.timestamp,
      targetCheckpointId,
      targetSequence,
      message: `Successfully rolled back ${uniqueRestored.length} file(s) to checkpoint ${targetCheckpointId}`,
    };
  }
}
