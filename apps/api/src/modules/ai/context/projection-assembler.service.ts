import { Injectable } from '@nestjs/common';
import { ChatMessage } from '../ai.service.js';
import {
  ContextAssemblyParams,
  ContextProjection,
} from './context-engine.interface.js';

@Injectable()
export class ProjectionAssembler {
  assemble(params: ContextAssemblyParams): ContextProjection[] {
    const projections: ContextProjection[] = [];

    this.add(projections, 'workspace', 'Workspace', 'workspace', params.workspaceContext, 100, 7000);
    this.add(projections, 'knowledge', 'Knowledge', 'knowledge', params.knowledgeContext, 90, 7000);
    this.add(projections, 'memory', 'Memory', 'memory', params.memoryContext, 80, 5000);
    this.add(projections, 'skills', 'Skills', 'skills', params.skillsContext, 70, 5000);

    for (const projection of params.additionalProjections || []) {
      if (typeof projection?.content === 'string' && projection.content.trim()) {
        projections.push(projection);
      }
    }

    return projections.sort((a, b) => b.priority - a.priority);
  }

  render(projections: ContextProjection[], maxTokens: number): string {
    let remainingChars = maxTokens * 4;
    const sections: string[] = [];

    for (const projection of projections) {
      if (remainingChars <= 0) break;
      const limit = Math.min(projection.maxTokens * 4, remainingChars);
      const content = String(projection.content);
      const outputStr = content.length > limit
        ? `${content.slice(0, limit)}\n[Projection truncated]`
        : content;

      sections.push(`## ${projection.name}\n${outputStr}`);
      remainingChars -= outputStr.length;
    }

    return sections.join('\n\n');
  }

  private add(
    projections: ContextProjection[],
    id: string,
    name: string,
    source: ContextProjection['source'],
    content: any,
    priority: number,
    maxTokens: number,
  ): void {
    if (typeof content !== 'string' || !content.trim()) return;
    projections.push({ id, name, source, content, priority, maxTokens });
  }
}
