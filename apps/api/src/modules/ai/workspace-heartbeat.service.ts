import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { MemoryService } from '../memory/memory.service.js';

export interface HeartbeatSnapshot {
  workspaceId: string;
  timestamp: Date;
  fileCount: number;
  totalSizeBytes: number;
  newFiles: string[];
  modifiedFiles: string[];
  deletedFiles: string[];
}

export interface FileSnapshot {
  path: string;
  sizeBytes: number;
  lastModified: number;
}

/**
 * WorkspaceHeartbeatService — Proactive File Change Detection.
 *
 * OpenClaw Pattern: Agent periodically scans the workspace to detect
 * file changes (new, modified, deleted) and logs delta snapshots.
 *
 * Arunaki Adaptation:
 * - Scans workspace directory via metadata (no OS-level file watchers)
 * - Compares current state against last-known snapshot
 * - Stores change deltas in memory for context enrichment
 * - Runs as NestJS interval (configurable, default 60s)
 */
@Injectable()
export class WorkspaceHeartbeatService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(WorkspaceHeartbeatService.name);

  /** In-memory cache of last-known workspace states */
  private readonly snapshots = new Map<string, Map<string, FileSnapshot>>();

  /** Interval reference for cleanup */
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  /** Heartbeat interval in ms (default: 60 seconds) */
  private readonly HEARTBEAT_INTERVAL_MS = 60_000;

  /** Max changes to store per heartbeat */
  private readonly MAX_CHANGES_PER_BEAT = 50;

  /** Registered workspace IDs and their file-listing callbacks */
  private readonly workspaceCallbacks = new Map<
    string,
    () => Promise<FileSnapshot[]>
  >();

  constructor(private readonly memoryService: MemoryService) {}

  onModuleInit() {
    this.intervalHandle = setInterval(
      () => this.runHeartbeat(),
      this.HEARTBEAT_INTERVAL_MS,
    );
    this.logger.log(
      `Heartbeat started (interval: ${this.HEARTBEAT_INTERVAL_MS}ms)`,
    );
  }

  onModuleDestroy() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.logger.log('Heartbeat stopped');
  }

  /**
   * Register a workspace for heartbeat monitoring.
   *
   * @param workspaceId - The workspace ID to monitor
   * @param fileListCallback - Async function that returns current file snapshots
   */
  registerWorkspace(
    workspaceId: string,
    fileListCallback: () => Promise<FileSnapshot[]>,
  ): void {
    this.workspaceCallbacks.set(workspaceId, fileListCallback);
    this.logger.log(`Workspace registered for heartbeat: ${workspaceId}`);
  }

  /**
   * Unregister a workspace from heartbeat monitoring.
   */
  unregisterWorkspace(workspaceId: string): void {
    this.workspaceCallbacks.delete(workspaceId);
    this.snapshots.delete(workspaceId);
    this.logger.log(`Workspace unregistered from heartbeat: ${workspaceId}`);
  }

  /**
   * Run a single heartbeat cycle across all registered workspaces.
   */
  async runHeartbeat(): Promise<HeartbeatSnapshot[]> {
    const results: HeartbeatSnapshot[] = [];

    for (const [workspaceId, callback] of this.workspaceCallbacks) {
      try {
        const snapshot = await this.checkWorkspace(workspaceId, callback);
        if (snapshot) {
          results.push(snapshot);

          // Only store in memory if there were changes
          const totalChanges =
            snapshot.newFiles.length +
            snapshot.modifiedFiles.length +
            snapshot.deletedFiles.length;

          if (totalChanges > 0) {
            await this.storeHeartbeatResult(snapshot);
          }
        }
      } catch (err: any) {
        this.logger.warn(
          `Heartbeat failed for workspace ${workspaceId}: ${err.message}`,
        );
      }
    }

    return results;
  }

  /**
   * Check a single workspace for file changes.
   */
  private async checkWorkspace(
    workspaceId: string,
    fileListCallback: () => Promise<FileSnapshot[]>,
  ): Promise<HeartbeatSnapshot | null> {
    const currentFiles = await fileListCallback();
    const currentMap = new Map<string, FileSnapshot>();
    let totalSizeBytes = 0;

    for (const file of currentFiles) {
      currentMap.set(file.path, file);
      totalSizeBytes += file.sizeBytes;
    }

    const previousMap = this.snapshots.get(workspaceId);

    // First scan — just store baseline, no changes to report
    if (!previousMap) {
      this.snapshots.set(workspaceId, currentMap);
      this.logger.debug(
        `Baseline snapshot for workspace ${workspaceId}: ${currentFiles.length} files`,
      );
      return null;
    }

    // Compute delta
    const newFiles: string[] = [];
    const modifiedFiles: string[] = [];
    const deletedFiles: string[] = [];

    // Check for new and modified files
    for (const [path, currentFile] of currentMap) {
      const previousFile = previousMap.get(path);

      if (!previousFile) {
        newFiles.push(path);
      } else if (
        currentFile.lastModified !== previousFile.lastModified ||
        currentFile.sizeBytes !== previousFile.sizeBytes
      ) {
        modifiedFiles.push(path);
      }
    }

    // Check for deleted files
    for (const path of previousMap.keys()) {
      if (!currentMap.has(path)) {
        deletedFiles.push(path);
      }
    }

    // Update snapshot
    this.snapshots.set(workspaceId, currentMap);

    return {
      workspaceId,
      timestamp: new Date(),
      fileCount: currentFiles.length,
      totalSizeBytes,
      newFiles: newFiles.slice(0, this.MAX_CHANGES_PER_BEAT),
      modifiedFiles: modifiedFiles.slice(0, this.MAX_CHANGES_PER_BEAT),
      deletedFiles: deletedFiles.slice(0, this.MAX_CHANGES_PER_BEAT),
    };
  }

  /**
   * Store heartbeat results in memory for agent context enrichment.
   */
  private async storeHeartbeatResult(
    snapshot: HeartbeatSnapshot,
  ): Promise<void> {
    const changeSummary = [];

    if (snapshot.newFiles.length > 0) {
      changeSummary.push(`File baru: ${snapshot.newFiles.join(', ')}`);
    }
    if (snapshot.modifiedFiles.length > 0) {
      changeSummary.push(`File diubah: ${snapshot.modifiedFiles.join(', ')}`);
    }
    if (snapshot.deletedFiles.length > 0) {
      changeSummary.push(`File dihapus: ${snapshot.deletedFiles.join(', ')}`);
    }

    try {
      await this.memoryService.remember({
        type: 'workspace_change',
        key: `heartbeat-${snapshot.workspaceId}-${snapshot.timestamp.getTime()}`,
        content: changeSummary.join('\n'),
        source: 'heartbeat',
        importance: 5,
        domain: 'generic',
        workspaceId: snapshot.workspaceId,
      });

      this.logger.debug(
        `Heartbeat stored: ${snapshot.newFiles.length} new, ` +
          `${snapshot.modifiedFiles.length} modified, ` +
          `${snapshot.deletedFiles.length} deleted in workspace ${snapshot.workspaceId}`,
      );
    } catch (err: any) {
      this.logger.warn(`Failed to store heartbeat result: ${err.message}`);
    }
  }

  /**
   * Get the latest changes for a workspace (for context injection).
   */
  getLatestChanges(workspaceId: string): {
    fileCount: number;
    hasSnapshot: boolean;
  } {
    const snapshot = this.snapshots.get(workspaceId);
    return {
      fileCount: snapshot?.size || 0,
      hasSnapshot: !!snapshot,
    };
  }
}
