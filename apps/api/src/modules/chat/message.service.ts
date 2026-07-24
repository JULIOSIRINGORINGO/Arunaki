import { Injectable } from '@nestjs/common';
import { Message } from '@prisma/client';
import { BaseService } from '../../common/base.service.js';
import { MessageRepository } from './message.repository.js';

@Injectable()
export class MessageService extends BaseService<Message> {
  constructor(protected readonly repository: MessageRepository) {
    super(repository);
  }

  async createMessage(chatHistoryId: string, role: 'user' | 'assistant' | 'system', content: string): Promise<Message> {
    return this.repository.create({
      chatHistoryId,
      role,
      content,
      metadata: '{}',
    });
  }

  async findByChatHistoryId(chatHistoryId: string): Promise<Message[]> {
    return this.repository.findByChatHistoryId(chatHistoryId);
  }
}
