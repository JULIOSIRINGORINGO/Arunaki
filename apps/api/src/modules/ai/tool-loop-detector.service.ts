import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { BoundedMap } from '../../common/utils/bounded-map.js';

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
  private readonly sessionHistory = new BoundedMap<string, ToolInvocationEntry[]>(1000);

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
    let exactRepeatCount = 0;
    let toolNameRepeatCount = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].toolName === toolName) {
        toolNameRepeatCount++;
        if (history[i].argsHash === argsHash) {
          exactRepeatCount++;
        }
      } else {
        break; // break on first non-matching tool name
      }
    }

    if (exactRepeatCount >= MAX_REPEATED_TOOL_CALLS) {
      this.logger.warn(
        `Circuit Breaker: Tool loop detected for "${toolName}" on workspace ${workspaceId} (exact args repeated ${exactRepeatCount}x)`,
      );
      return {
        isLooping: true,
        repeatCount: exactRepeatCount,
        message: `Terdeteksi perulangan pemanggilan tool "${toolName}" dengan argumen yang sama persis sebanyak ${exactRepeatCount}x. Eksekusi dihentikan secara aman.`,
      };
    }

    if (toolNameRepeatCount >= 5) {
      this.logger.warn(
        `Circuit Breaker: Tool spam detected for "${toolName}" on workspace ${workspaceId} (tool repeated ${toolNameRepeatCount}x)`,
      );
      return {
        isLooping: true,
        repeatCount: toolNameRepeatCount,
        message: `Terdeteksi penggunaan tool "${toolName}" berturut-turut sebanyak ${toolNameRepeatCount}x (kemungkinan brute force). Hentikan pencarian buta ini dan bertanyalah kepada User secara langsung.`,
      };
    }

    return {
      isLooping: false,
      repeatCount: Math.max(exactRepeatCount, toolNameRepeatCount),
    };
  }

  /**
   * Reset tracking history for a workspace session
   */
  clearSession(workspaceId: string): void {
    this.sessionHistory.delete(workspaceId);
  }
}
