import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

export interface ToolInvocationEntry {
  toolName: string;
  argsHash: string;
  timestamp: number;
}

export interface LoopCheckResult {
  isLooping: boolean;
  repeatCount: number;
  message?: string;
}

const MAX_REPEATED_TOOL_CALLS = 3;

@Injectable()
export class ToolLoopDetectorService {
  private readonly logger = new Logger(ToolLoopDetectorService.name);
  private readonly sessionHistory = new Map<string, ToolInvocationEntry[]>();

  /**
   * Track a tool call and check if it violates loop policy
   */
  checkAndRecord(workspaceId: string, toolName: string, args: Record<string, any>): LoopCheckResult {
    const argsString = JSON.stringify(args || {});
    const argsHash = createHash('sha256').update(`${toolName}:${argsString}`).digest('hex').substring(0, 16);

    let history = this.sessionHistory.get(workspaceId) || [];
    const entry: ToolInvocationEntry = {
      toolName,
      argsHash,
      timestamp: Date.now(),
    };

    history.push(entry);
    // Keep last 15 tool calls per session
    if (history.length > 15) {
      history = history.slice(-15);
    }
    this.sessionHistory.set(workspaceId, history);

    // Count consecutive identical calls
    let repeatCount = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].toolName === toolName && history[i].argsHash === argsHash) {
        repeatCount++;
      } else {
        break; // break on first non-matching call
      }
    }

    if (repeatCount >= MAX_REPEATED_TOOL_CALLS) {
      this.logger.warn(
        `Circuit Breaker: Tool loop detected for "${toolName}" on workspace ${workspaceId} (repeated ${repeatCount}x)`,
      );
      return {
        isLooping: true,
        repeatCount,
        message: `Terdeteksi perulangan pemanggilan tool "${toolName}" sebanyak ${repeatCount}x. Eksekusi dihentikan secara aman.`,
      };
    }

    return {
      isLooping: false,
      repeatCount,
    };
  }

  /**
   * Reset tracking history for a workspace session
   */
  clearSession(workspaceId: string): void {
    this.sessionHistory.delete(workspaceId);
  }
}
