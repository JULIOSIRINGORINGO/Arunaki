import { Injectable, Logger } from '@nestjs/common';
import { AiService, ChatMessage } from '../ai/ai.service.js';
import { AutonomousPlannerService } from '../ai/autonomous-planner.service.js';
import { SelfEvaluationService } from '../ai/self-evaluation.service.js';
import { ContextRegistry } from '../ai/context/context-registry.service.js';
import { ToolRegistryService } from '../tools/tool-registry.service.js';
import { PrismaService } from '../../common/providers/prisma.service.js';
import { SessionStateEventsService } from '../chat/session-state-events.service.js';
import { TaskClassifier } from './task-classifier.service.js';
import { PlannerService, VerifierService } from './planner.service.js';
import { RecoveryManager } from './recovery.service.js';
import type { AgentIntent, PlanGraph, PlanNode, NodeStatus, VerificationResult, RuntimeContext, RuntimeRecoveryAction } from './runtime.types.js';

@Injectable()
export class AgentRuntime {
  private readonly logger = new Logger(AgentRuntime.name);

  constructor(
    private readonly classifier: TaskClassifier,
    private readonly planner: PlannerService,
    private readonly verifier: VerifierService,
    private readonly recovery: RecoveryManager,
    private readonly aiService: AiService,
    private readonly autoPlanner: AutonomousPlannerService,
    private readonly selfEvaluation: SelfEvaluationService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly prisma: PrismaService,
    private readonly sessionEvents: SessionStateEventsService,
    private readonly contextRegistry: ContextRegistry,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('AgentRuntime orchestration layer initialized.');
  }

  async runPlan(
    workspaceId: string,
    goal: string,
    historyMessages: ChatMessage[],
    extraContext: Record<string, any> = {},
  ): Promise<PlanGraph> {
    const context = await this.buildRuntimeContext(workspaceId, goal, historyMessages, extraContext);
    const intent = this.classifier.classify(goal, context);
    const plan = this.planner.createPlan(goal, intent.category, intent.suggestedToolHints);
    await this.recordSessionEvent(workspaceId, 'runtime_plan_created', { planId: plan.id, intent: intent.category, goal });

    plan.status = 'running';
    const result = await this.executePlan(plan, context, workspaceId);
    return result;
  }

  private async executePlan(
    plan: PlanGraph,
    context: RuntimeContext,
    workspaceId: string,
  ): Promise<PlanGraph> {
    while (plan.currentNodeIndex < plan.nodes.length) {
      const node = this.planner.nextNode(plan);
      if (!node) break;

      await this.recordSessionEvent(workspaceId, 'runtime_node_started', { planId: plan.id, nodeId: node.id, toolHint: node.toolHint });

      const toolResult = await this.executeNodeTool(node, workspaceId);
      await this.recordSessionEvent(workspaceId, 'runtime_node_tool_executed', { planId: plan.id, nodeId: node.id, tool: node.toolHint, status: toolResult.status });

      const verifierResult = this.verifier.verify(node, toolResult, { pathExists: toolResult.status === 'success', filenameExact: true, contentMatch: undefined });
      await this.recordSessionEvent(workspaceId, 'runtime_node_verified', { planId: plan.id, nodeId: node.id, passed: verifierResult.passed, score: verifierResult.score });

      if (verifierResult.passed) {
        node.status = 'verified';
        node.result = verifierResult.issues.length === 0 ? 'Node verified successfully.' : verifierResult.issues.join('; ');
        await this.recordSessionEvent(workspaceId, 'runtime_node_completed', { planId: plan.id, nodeId: node.id });
        if (!this.planner.advanceNode(plan)) break;
      } else {
        const recovery = this.recovery.decide(node, verifierResult, toolResult);
        await this.recordSessionEvent(workspaceId, 'runtime_node_recovery', { planId: plan.id, nodeId: node.id, action: recovery.action, reason: recovery.reason });

        if (recovery.action === 'replan' && recovery.newNode) {
          node.status = 'replanned';
          const newIdx = plan.nodes.indexOf(node);
          plan.nodes.splice(newIdx, 1, recovery.newNode);
          await this.recordSessionEvent(workspaceId, 'runtime_node_replanned', { planId: plan.id, oldNode: node.id, newNode: recovery.newNode.id });
          continue;
        }

        if (recovery.action === 'retry') {
          node.status = 'pending';
          continue;
        }

        node.status = 'failed';
        node.error = recovery.reason;
        plan.status = 'failed';
        await this.recordSessionEvent(workspaceId, 'runtime_plan_failed', { planId: plan.id, nodeId: node.id });
        break;
      }
    }

    if (plan.status === 'running') {
      plan.status = 'completed';
      plan.completedAt = new Date();
    }
    await this.recordSessionEvent(workspaceId, 'runtime_plan_completed', { planId: plan.id, status: plan.status });
    return plan;
  }

  private async executeNodeTool(
    node: PlanNode,
    workspaceId: string,
  ): Promise<{ status: string; metadata?: Record<string, any>; preview?: string; error?: { code: string; message: string } }> {
    try {
      const result = await this.toolRegistry.executeTool(node.toolHint, { workspaceId, filename: node.resolvedFilename, content: node.goal });
      return { status: result.status, metadata: result.metadata, preview: result.preview, error: result.error ? { code: result.error.code, message: result.error.message } : undefined };
    } catch (err: any) {
      return { status: 'error', error: { code: 'EXECUTION_EXCEPTION', message: err.message } };
    }
  }

  private async buildRuntimeContext(
    workspaceId: string,
    goal: string,
    historyMessages: ChatMessage[],
    extraContext: Record<string, any>,
  ): Promise<RuntimeContext> {
    let memoryContext = '';
    try {
      memoryContext = await this.contextRegistry
        .getActive()
        .assemble({ mode: 'workspace', workspaceId, messages: historyMessages })
        .then((c) => c.systemPrompt || '');
    } catch {
      /* non-critical */
    }

    const files = extraContext.files || [];
    if (typeof files === 'string') {
      return { workspaceId, userGoal: goal, historyMessages: historyMessages as any, workspaceFiles: JSON.parse(files || '[]'), memoryContext, domain: extraContext.domain } as RuntimeContext;
    }
    return { workspaceId, userGoal: goal, historyMessages: historyMessages as any, workspaceFiles: files, memoryContext, domain: extraContext.domain } as RuntimeContext;
  }

  private async recordSessionEvent(workspaceId: string, type: string, payload: Record<string, any>) {
    try {
      await this.sessionEvents.record(type as any, workspaceId, 'agent-runtime', payload);
    } catch {
      /* non-critical */
    }
  }
}
