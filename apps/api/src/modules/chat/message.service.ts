import { Injectable } from '@nestjs/common';
import { Message, Prisma } from '@prisma/client';
import { BaseService } from '../../common/base.service.js';
import { MessageRepository } from './message.repository.js';

export interface CreateMessageOptions {
  chatHistoryId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, any>;
  idempotencyKey?: string;
  provenance?: {
    kind: 'external_user' | 'inter_session' | 'internal_system';
    sourceSessionId?: string;
    sourceTool?: string;
    isUser?: boolean;
  };
}

@Injectable()
export class MessageService extends BaseService<Message> {
  constructor(protected readonly repository: MessageRepository) {
    super(repository);
  }

  async createMessage(options: CreateMessageOptions): Promise<Message> {
    const { chatHistoryId, role, content, metadata, idempotencyKey, provenance } = options;

    // Idempotency check: if key provided, check for existing message
    if (idempotencyKey) {
      const existing = await this.repository.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    return this.repository.create({
      chatHistoryId,
      role,
      content,
      metadata: metadata ? JSON.stringify(metadata) : '{}',
      idempotencyKey,
      provenance: provenance ? provenance : undefined,
    });
  }

  async findByChatHistoryId(chatHistoryId: string): Promise<Message[]> {
    return this.repository.findByChatHistoryId(chatHistoryId);
  }
}
