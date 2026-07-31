export type AgentIntentCategory = 'file_write' | 'file_read' | 'file_delete' | 'file_search' | 'knowledge_search' | 'desktop' | 'planning' | 'unknown';

export interface AgentIntent {
  category: AgentIntentCategory;
  goal: string;
  confidence: number;
  requiresVerification: boolean;
  requiresApproval: boolean;
  estimatedSteps: number;
  suggestedToolHints: string[];
}

export type NodeStatus = 'pending' | 'running' | 'verified' | 'failed' | 'skipped' | 'recovering' | 'replanned';

export interface PlanNode {
  id: string;
  status: NodeStatus;
  intentCategory: AgentIntentCategory;
  goal: string;
  toolHint: string;
  resolvedFilename?: string;
  resolvedPath?: string;
  expectedContent?: string;
  result?: string;
  verifier?: VerificationResult;
  error?: string;
  retryCount: number;
  maxRetries: number;
}

export interface VerificationResult {
  passed: boolean;
  score: number;
  issues: string[];
  physicalCheck?: {
    pathExists: boolean;
    filenameExact?: boolean;
    contentMatch?: boolean;
    sizeBytes?: number;
  };
}

export interface PlanGraph {
  id: string;
  goal: string;
  nodes: PlanNode[];
  currentNodeIndex: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
}

export interface RuntimeContext {
  workspaceId: string;
  userGoal: string;
  historyMessages: Array<{ role: string; content: string }>;
  workspaceFiles: string[];
  memoryContext: string;
  domain?: string;
}

export interface RuntimeRecoveryAction {
  nodeId: string;
  action: 'retry' | 'replan' | 'skip' | 'abort';
  reason: string;
  newNode?: PlanNode;
}
