import { Injectable } from '@nestjs/common';
import { ChatMessage, AiService } from '../ai.service.js';
import { ContextManager } from '../context-manager.js';
import { ContextQuarantine } from './context-quarantine.service.js';
import { ProjectionAssembler } from './projection-assembler.service.js';
import {
  ContextAssemblyParams,
  ContextAssemblyResult,
  ContextProjection,
  IContextEngine,
} from './context-engine.interface.js';

@Injectable()
export class LegacyContextEngine implements IContextEngine {
  readonly name = 'legacy';
  readonly config = {
    name: 'legacy',
    contextWindow: 128000,
    threshold: 0.5,
    enabled: true,
  };

  private readonly manager: ContextManager;
  private readonly projections: ContextProjection[] = [];

  constructor(
    private readonly projectionAssembler: ProjectionAssembler,
    private readonly quarantine: ContextQuarantine,
  ) {
    this.manager = new ContextManager();
  }

  async assemble(params: ContextAssemblyParams): Promise<ContextAssemblyResult> {
    const safeParams = this.quarantine.sanitizeAssemblyParams(params);
    const projections = this.projectionAssembler
      .assemble(safeParams)
      .concat(this.projections)
      .map((projection) => this.quarantine.sanitizeProjection(projection));
    const compressed = await this.manager.compress(
      this.quarantine.sanitizeMessages(safeParams.messages),
      safeParams.contextWindow,
    );
    const systemPrompt = this.projectionAssembler.render(
      projections,
      safeParams.maxTokens || 16000,
    );

    return {
      systemPrompt,
      messages: compressed,
      projections,
      compressionRatio: safeParams.messages.length
        ? compressed.length / safeParams.messages.length
        : 1,
      wasCompressed: compressed.length !== safeParams.messages.length,
    };
  }

  async compress(messages: ChatMessage[]): Promise<ChatMessage[]> {
    return this.manager.compress(this.quarantine.sanitizeMessages(messages));
  }

  addProjection(projection: ContextProjection): void {
    this.projections.push(this.quarantine.sanitizeProjection(projection));
  }

  clearProjections(): void {
    this.projections.length = 0;
  }
}
