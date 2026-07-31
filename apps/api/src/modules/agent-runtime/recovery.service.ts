import { Injectable, Logger } from '@nestjs/common';
import type { PlanGraph, PlanNode, VerificationResult, RuntimeRecoveryAction } from './runtime.types.js';

@Injectable()
export class RecoveryManager {
  private readonly logger = new Logger(RecoveryManager.name);

  decide(
    node: PlanNode,
    verifier: VerificationResult,
    toolResult: { status: string; error?: { code: string; message: string } },
  ): RuntimeRecoveryAction {
    if (verifier.passed) {
      return { nodeId: node.id, action: 'retry', reason: 'Not applicable: verification passed', newNode: undefined };
    }

    if (node.retryCount >= node.maxRetries) {
      this.logger.warn(`Node ${node.id} exhausted retries (${node.maxRetries}).`);
      return { nodeId: node.id, action: 'abort', reason: 'Max retries exhausted', newNode: undefined };
    }

    const toolError = toolResult.error;
    const isFilenameIssue =
      toolError?.code === 'AMBIGUOUS_FILENAME' ||
      toolError?.code === 'FILE_NOT_FOUND' ||
      /filename|path|tidak ditemukan|ambigu/i.test(toolError?.message || '');

    const isPermissionIssue =
      toolError?.code === 'ACCESS_DENIED' ||
      toolError?.code === 'NO_ROOT_PATH' ||
      /access|permission|dilarang|di luar workspace/i.test(toolError?.message || '');

    if (isFilenameIssue) {
      return {
        nodeId: node.id,
        action: 'replan',
        reason: `Filename issue: ${toolError?.message}`,
        newNode: {
          ...node,
          id: `${node.id}:retry:${node.retryCount + 1}`,
          status: 'pending',
          retryCount: node.retryCount + 1,
          goal: `${node.goal} Use the EXACT filename or explicit path, no pronouns, no typos.`,
        },
      };
    }

    if (isPermissionIssue) {
      return {
        nodeId: node.id,
        action: 'replan',
        reason: `Permission issue: ${toolError?.message}`,
        newNode: {
          ...node,
          id: `${node.id}:retry:${node.retryCount + 1}`,
          status: 'pending',
          retryCount: node.retryCount + 1,
          goal: `${node.goal} Verify workspace connection and permissions before retrying.`,
        },
      };
    }

    return {
      nodeId: node.id,
      action: 'retry',
      reason: `Verification failed: ${verifier.issues.join('; ')}`,
      newNode: {
        ...node,
        id: `${node.id}:retry:${node.retryCount + 1}`,
        status: 'pending',
        retryCount: node.retryCount + 1,
      },
    };
  }
}
