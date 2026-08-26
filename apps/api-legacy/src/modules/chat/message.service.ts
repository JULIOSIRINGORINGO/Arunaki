import { Injectable, Inject } from '@nestjs/common';
import { Message, Prisma } from '@prisma/client';
import { BaseService } from '../../common/base.service.js';
import { MessageRepository } from './message.repository.js';
import {
  InputProvenance,
  InputProvenanceFactory,
} from '../ai/input-provenance.js';

export interface CreateMessageOptions {
  chatHistoryId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, any>;
  idempotencyKey?: string;
  provenance?: InputProvenance;
}

function toJsonValue(obj: InputProvenance): Prisma.JsonValue {
  return JSON.parse(JSON.stringify(obj));
}

@Injectable()
export class MessageService extends BaseService<Message> {
  constructor(
    @Inject(MessageRepository) protected readonly repository: MessageRepository,
  ) {
    super(repository);
  }

  async createMessage(options: CreateMessageOptions): Promise<Message> {
    const {
      chatHistoryId,
      role,
      content,
      metadata,
      idempotencyKey,
      provenance,
    } = options;

    // Idempotency check: if key provided, check for existing message
    if (idempotencyKey) {
      const existing =
        await this.repository.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    const prov = provenance || InputProvenanceFactory.fromRole(role);

    return this.repository.create({
      chatHistoryId,
      role,
      content,
      metadata: metadata ? JSON.stringify(metadata) : '{}',
      idempotencyKey,
      provenance: toJsonValue(prov),
    });
  }

  async findByChatHistoryId(chatHistoryId: string): Promise<Message[]> {
    return this.repository.findByChatHistoryId(chatHistoryId);
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<Message | null> {
    return this.repository.findByIdempotencyKey(idempotencyKey);
  }
}
