import { describe, it, expect, beforeEach } from 'vitest';
import { TrajectoryAuditService } from './trajectory-audit.service.js';

describe('TrajectoryAuditService — Execution Audit Trail', () => {
  let auditService: TrajectoryAuditService;

  beforeEach(() => {
    auditService = new TrajectoryAuditService();
  });

  it('should record steps and retrieve trajectory by runId', () => {
    const runId = 'run_1001';
    const chatId = 'chat_99';

    auditService.recordStep(runId, chatId, 'agent_start', {
      userContent: 'Calculate total revenue',
    });
    auditService.recordStep(runId, chatId, 'thinking', {
      message: 'Reading data',
    });
    auditService.recordStep(runId, chatId, 'tool_start', { toolName: 'read' });
    auditService.recordStep(
      runId,
      chatId,
      'tool_done',
      { toolName: 'read' },
      150,
    );
    auditService.recordStep(runId, chatId, 'agent_complete', { toolCount: 1 });

    const steps = auditService.getTrajectory(runId);
    expect(steps).toHaveLength(5);
    expect(steps[0].stepType).toBe('agent_start');
    expect(steps[3].stepType).toBe('tool_done');
    expect(steps[3].durationMs).toBe(150);
  });

  it('should export structured JSON compliance audit report', () => {
    const runId = 'run_1002';
    const chatId = 'chat_100';

    auditService.recordStep(runId, chatId, 'agent_start', {
      userContent: 'Baca 3 PDF',
    });
    auditService.recordStep(runId, chatId, 'sub_agent_spawn', {
      taskName: 'PDF 1',
    });
    auditService.recordStep(runId, chatId, 'tool_done', {
      toolName: 'read_document_content',
    });
    auditService.recordStep(runId, chatId, 'self_heal', {
      strategy: 'arg_repair',
    });
    auditService.recordStep(runId, chatId, 'agent_complete', {});

    const exportData = auditService.exportTrajectoryJson(runId);

    expect(exportData.runId).toBe(runId);
    expect(exportData.chatId).toBe(chatId);
    expect(exportData.summary.status).toBe('completed');
    expect(exportData.summary.toolCallsCount).toBe(1);
    expect(exportData.summary.subAgentsCount).toBe(1);
    expect(exportData.summary.selfHealsCount).toBe(1);
    expect(exportData.totalSteps).toBe(5);
  });

  it('should handle failed run trajectory export', () => {
    const runId = 'run_fail';
    const chatId = 'chat_err';

    auditService.recordStep(runId, chatId, 'agent_start', {
      userContent: 'Proses data',
    });
    auditService.recordStep(runId, chatId, 'agent_error', {
      error: 'Network timeout',
    });

    const exportData = auditService.exportTrajectoryJson(runId);
    expect(exportData.summary.status).toBe('failed');
  });

  it('should clear trajectory log cleanly', () => {
    const runId = 'run_clear';
    auditService.recordStep(runId, 'chat_1', 'agent_start');
    expect(auditService.getTrajectory(runId)).toHaveLength(1);

    auditService.clearTrajectory(runId);
    expect(auditService.getTrajectory(runId)).toHaveLength(0);
  });
});
