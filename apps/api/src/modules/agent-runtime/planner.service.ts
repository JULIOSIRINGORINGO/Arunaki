import { Injectable, Logger } from '@nestjs/common';
import type { PlanGraph, PlanNode, NodeStatus, VerificationResult } from './runtime.types.js';
import { randomUUID } from 'node:crypto';

@Injectable()
export class PlannerService {
  private readonly logger = new Logger(PlannerService.name);

  createPlan(goal: string, intentCategory: string, hints: string[]): PlanGraph {
    const nodes: PlanNode[] = [];

    if (intentCategory === 'file_write') {
      nodes.push({
        id: randomUUID(),
        status: 'pending',
        intentCategory: 'file_write',
        goal: `Write/create file for goal: ${goal}`,
        toolHint: 'write_workspace_file',
        retryCount: 0,
        maxRetries: 2,
      });
    } else if (intentCategory === 'file_delete') {
      nodes.push({
        id: randomUUID(),
        status: 'pending',
        intentCategory: 'file_delete',
        goal: `Delete file for goal: ${goal}`,
        toolHint: 'delete_workspace_file',
        retryCount: 0,
        maxRetries: 2,
      });
    } else if (intentCategory === 'file_read') {
      nodes.push({
        id: randomUUID(),
        status: 'pending',
        intentCategory: 'file_read',
        goal: `Read/search file for goal: ${goal}`,
        toolHint: hints.includes('search_workspace') ? 'search_workspace' : 'read_workspace_file',
        retryCount: 0,
        maxRetries: 2,
      });
    } else {
      nodes.push({
        id: randomUUID(),
        status: 'pending',
        intentCategory: intentCategory as PlanNode['intentCategory'],
        goal,
        toolHint: hints[0] || 'search_workspace',
        retryCount: 0,
        maxRetries: 2,
      });
    }

    const plan: PlanGraph = {
      id: randomUUID(),
      goal,
      nodes,
      currentNodeIndex: 0,
      status: 'pending',
      createdAt: new Date(),
    };

    this.logger.log(`Plan created: ${nodes.length} node(s) for "${goal.substring(0, 60)}"`);
    return plan;
  }

  nextNode(plan: PlanGraph): PlanNode | null {
    if (plan.currentNodeIndex >= plan.nodes.length) return null;
    const node = plan.nodes[plan.currentNodeIndex];
    node.status = 'running';
    return node;
  }

  advanceNode(plan: PlanGraph): boolean {
    plan.currentNodeIndex++;
    if (plan.currentNodeIndex >= plan.nodes.length) {
      plan.status = 'completed';
      plan.completedAt = new Date();
      return false;
    }
    return true;
  }
}

export class VerifierService {
  private readonly logger = new Logger(VerifierService.name);

  verify(
    node: PlanNode,
    toolResult: { status: string; metadata?: Record<string, any>; preview?: string; error?: { code: string; message: string } },
    physicalCheck?: VerificationResult['physicalCheck'],
  ): VerificationResult {
    if (toolResult.status !== 'success') {
      const result: VerificationResult = {
        passed: false,
        score: 1,
        issues: [`Tool returned error: ${toolResult.error?.message || toolResult.preview || 'unknown'}`],
      };
      this.logger.warn(`Verifier FAIL for node ${node.id}: ${result.issues[0]}`);
      return result;
    }

    if (node.intentCategory === 'file_write') {
      const filename =
        node.resolvedFilename ??
        toolResult.metadata?.filename ??
        toolResult.metadata?.path?.split('/').pop();
      const pathExists =
        physicalCheck?.pathExists ?? Boolean(toolResult.preview?.includes('berhasil'));
      const filenameExact = Boolean(filename);

      const issues: string[] = [];
      if (!pathExists) issues.push('Physical file does not exist on disk');
      if (!filenameExact) issues.push('Filename could not be confirmed');
      if (node.expectedContent && !physicalCheck?.contentMatch) {
        issues.push('Content does not match expected value');
      }

      const result: VerificationResult = {
        passed: issues.length === 0,
        score: issues.length === 0 ? 10 : 3,
        issues,
        physicalCheck: {
          pathExists,
          filenameExact,
          contentMatch: physicalCheck?.contentMatch,
          sizeBytes: physicalCheck?.sizeBytes,
        },
      };
      this.logger.log(`Verifier ${result.passed ? 'PASS' : 'FAIL'} for node ${node.id}: ${issues.length} issue(s)`);
      return result;
    }

    if (node.intentCategory === 'file_delete') {
      const pathNotExists = physicalCheck ? !physicalCheck.pathExists : true;
      const result: VerificationResult = {
        passed: pathNotExists,
        score: pathNotExists ? 10 : 2,
        issues: pathNotExists ? [] : ['File still exists on disk after delete'],
        physicalCheck: { pathExists: !pathNotExists },
      };
      this.logger.log(`Verifier ${result.passed ? 'PASS' : 'FAIL'} for node ${node.id}`);
      return result;
    }

    const result: VerificationResult = {
      passed: true,
      score: 8,
      issues: [],
    };
    return result;
  }
}
