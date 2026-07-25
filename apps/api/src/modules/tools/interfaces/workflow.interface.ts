export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface WorkflowStep {
  id: string;
  tool: string;
  args: Record<string, any> | ((prevResults: Record<string, any>) => Record<string, any>);
  dependsOn: string[];
  condition?: (results: Record<string, any>) => boolean;
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
  timeoutMs?: number;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowStepResult {
  stepId: string;
  toolName: string;
  status: StepStatus;
  result: any;
  error?: {
    code: string;
    message: string;
  };
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  retryCount: number;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  steps: WorkflowStepResult[];
  startedAt: Date;
  completedAt?: Date;
  totalDurationMs?: number;
  input: Record<string, any>;
  output?: Record<string, any>;
}

export interface CreateWorkflowInput {
  name: string;
  description: string;
  steps: Omit<WorkflowStep, 'id'>[];
  tags?: string[];
}

export function resolveStepArgs(
  step: WorkflowStep,
  prevResults: Record<string, any>,
): Record<string, any> {
  if (typeof step.args === 'function') {
    return step.args(prevResults);
  }
  return step.args;
}

export function getExecutableSteps(
  workflow: WorkflowDefinition,
  completedSteps: Map<string, StepStatus>,
): WorkflowStep[] {
  return workflow.steps.filter((step) => {
    if (completedSteps.get(step.id) === 'completed') return false;
    if (completedSteps.get(step.id) === 'running') return false;

    return step.dependsOn.every(
      (depId) => completedSteps.get(depId) === 'completed',
    );
  });
}

export function buildDependencyGraph(
  steps: WorkflowStep[],
): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const step of steps) {
    graph.set(step.id, step.dependsOn);
  }
  return graph;
}

export function hasCyclicDependencies(steps: WorkflowStep[]): boolean {
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(stepId: string): boolean {
    if (inStack.has(stepId)) return true;
    if (visited.has(stepId)) return false;

    visited.add(stepId);
    inStack.add(stepId);

    const step = steps.find((s) => s.id === stepId);
    if (step) {
      for (const dep of step.dependsOn) {
        if (dfs(dep)) return true;
      }
    }

    inStack.delete(stepId);
    return false;
  }

  for (const step of steps) {
    if (dfs(step.id)) return true;
  }
  return false;
}
