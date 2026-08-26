import { Injectable, Logger } from '@nestjs/common';
import { BoundedMap } from '../../common/utils/bounded-map.js';

export type TrajectoryStepType =
  | 'agent_start'
  | 'thinking'
  | 'tool_start'
  | 'tool_done'
  | 'self_heal'
  | 'sub_agent_spawn'
  | 'sub_agent_complete'
  | 'agent_complete'
  | 'agent_error';

export interface TrajectoryStep {
  stepId: string;
  runId: string;
  chatId: string;
  stepType: TrajectoryStepType;
  timestamp: string;
  payload: Record<string, any>;
  durationMs?: number;
}

export interface TrajectoryExport {
  runId: string;
  chatId: string;
  startedAt: string;
  completedAt?: string;
  totalSteps: number;
  steps: TrajectoryStep[];
  summary: {
    toolCallsCount: number;
    subAgentsCount: number;
    selfHealsCount: number;
    status: 'completed' | 'failed' | 'in_progress';
  };
}

/**
 * TrajectoryAuditService — Agent Execution Reasoning & Tool Trajectory Auditor.
 *
 * Records step-by-step reasoning trajectories, tool call inputs/outputs,
 * sub-agent spawns, and self-healing recovery actions into a structured audit log.
 * Provides export functionality for enterprise compliance reporting.
 */
@Injectable()
export class TrajectoryAuditService {
  private readonly logger = new Logger(TrajectoryAuditService.name);
  private readonly trajectories = new BoundedMap<string, TrajectoryStep[]>(
    1000,
  );

  /**
   * Record a trajectory step for a run.
   */
  recordStep(
    runId: string,
    chatId: string,
    stepType: TrajectoryStepType,
    payload: Record<string, any> = {},
    durationMs?: number,
  ): TrajectoryStep {
    const step: TrajectoryStep = {
      stepId: `trj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      runId,
      chatId,
      stepType,
      timestamp: new Date().toISOString(),
      payload,
      durationMs,
    };

    if (!this.trajectories.has(runId)) {
      this.trajectories.set(runId, []);
    }

    this.trajectories.get(runId)!.push(step);
    this.logger.debug(`Trajectory step recorded: [${runId}] ${stepType}`);
    return step;
  }

  /**
   * Retrieve all trajectory steps for a run.
   */
  getTrajectory(runId: string): TrajectoryStep[] {
    return this.trajectories.get(runId) || [];
  }

  /**
   * Export structured trajectory report for enterprise compliance.
   */
  exportTrajectoryJson(runId: string): TrajectoryExport {
    const steps = this.getTrajectory(runId);
    const startStep = steps.find((s) => s.stepType === 'agent_start');
    const endStep = steps.find(
      (s) => s.stepType === 'agent_complete' || s.stepType === 'agent_error',
    );

    const toolCallsCount = steps.filter(
      (s) => s.stepType === 'tool_done',
    ).length;
    const subAgentsCount = steps.filter(
      (s) => s.stepType === 'sub_agent_spawn',
    ).length;
    const selfHealsCount = steps.filter(
      (s) => s.stepType === 'self_heal',
    ).length;

    let status: 'completed' | 'failed' | 'in_progress' = 'in_progress';
    if (endStep) {
      status = endStep.stepType === 'agent_complete' ? 'completed' : 'failed';
    }

    return {
      runId,
      chatId: startStep?.chatId || '',
      startedAt: startStep?.timestamp || new Date().toISOString(),
      completedAt: endStep?.timestamp,
      totalSteps: steps.length,
      steps,
      summary: {
        toolCallsCount,
        subAgentsCount,
        selfHealsCount,
        status,
      },
    };
  }

  /**
   * Clear trajectory log for a run.
   */
  clearTrajectory(runId: string): void {
    this.trajectories.delete(runId);
  }
}
