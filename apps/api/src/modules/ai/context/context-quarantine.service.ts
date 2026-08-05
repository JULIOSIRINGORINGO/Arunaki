import { Injectable, Logger } from '@nestjs/common';
import { ChatMessage } from '../ai.service.js';
import {
  ContextProjection,
  ContextAssemblyParams,
} from './context-engine.interface.js';

@Injectable()
export class ContextQuarantine {
  private readonly logger = new Logger(ContextQuarantine.name);

  private readonly blockedPatterns = [
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /disregard\s+(all\s+)?prior\s+instructions/i,
    /system\s*prompt/i,
    /developer\s*message/i,
    /reveal\s+(your\s+)?instructions/i,
    /print\s+(the\s+)?hidden\s+prompt/i,
  ];

  sanitizeProjection(projection: ContextProjection): ContextProjection {
    const content = this.sanitizeText(projection.content, projection.id);
    return { ...projection, content };
  }

  sanitizeMessages(messages: ChatMessage[]): ChatMessage[] {
    return messages.map((message) => {
      if (message.role !== 'user' || typeof message.content !== 'string') {
        return message;
      }
      return {
        ...message,
        content: this.sanitizeText(message.content, 'user-message'),
      };
    });
  }

  sanitizeAssemblyParams(params: ContextAssemblyParams): ContextAssemblyParams {
    return {
      ...params,
      messages: this.sanitizeMessages(params.messages),
      workspaceContext: params.workspaceContext
        ? this.sanitizeText(params.workspaceContext, 'workspace-context')
        : params.workspaceContext,
      knowledgeContext: params.knowledgeContext
        ? this.sanitizeText(params.knowledgeContext, 'knowledge-context')
        : params.knowledgeContext,
      memoryContext: params.memoryContext
        ? this.sanitizeText(params.memoryContext, 'memory-context')
        : params.memoryContext,
      skillsContext: params.skillsContext
        ? this.sanitizeText(params.skillsContext, 'skills-context')
        : params.skillsContext,
      additionalProjections: params.additionalProjections?.map((projection) =>
        this.sanitizeProjection(projection),
      ),
    };
  }

  /**
   * Sanitize a single injected context string (used by chat mode before
   * knowledge/memory content reaches the system prompt).
   */
  sanitizeText(text: string, label: string): string {
    return this.sanitizeTextInternal(text, label);
  }

  private sanitizeTextInternal(text: string, label: string): string {
    let sanitized = text;
    let changed = false;

    for (const pattern of this.blockedPatterns) {
      if (pattern.test(sanitized)) {
        sanitized = sanitized.replace(pattern, '[quarantined instruction]');
        changed = true;
      }
    }

    if (changed) {
      this.logger.warn(`Quarantined suspicious context content: ${label}`);
    }

    return sanitized;
  }
}
