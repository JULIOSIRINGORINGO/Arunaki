import { ChatMessage } from '../ai.service.js';

export interface ContextProjection {
  id: string;
  name: string;
  source: 'workspace' | 'memory' | 'skills' | 'knowledge' | 'history' | 'custom';
  content: string;
  priority: number;
  maxTokens: number;
}

export interface ContextAssemblyResult {
  systemPrompt: string;
  messages: ChatMessage[];
  projections: ContextProjection[];
  compressionRatio: number;
  wasCompressed: boolean;
}

export interface ContextEngineConfig {
  name: string;
  contextWindow: number;
  threshold: number;
  enabled: boolean;
}

export interface IContextEngine {
  readonly name: string;
  readonly config: ContextEngineConfig;

  assemble(
    params: ContextAssemblyParams,
  ): Promise<ContextAssemblyResult>;

  compress(messages: ChatMessage[]): Promise<ChatMessage[]>;

  addProjection(projection: ContextProjection): void;

  clearProjections(): void;
}

export interface ContextAssemblyParams {
  mode: 'chat' | 'workspace';
  workspaceId?: string;
  messages: ChatMessage[];
  workspaceContext?: string;
  knowledgeContext?: string;
  memoryContext?: string;
  skillsContext?: string;
  additionalProjections?: ContextProjection[];
  maxTokens?: number;
  /** Active model's context window (tokens) — lets the engine compress against the real window. */
  contextWindow?: number;
}
