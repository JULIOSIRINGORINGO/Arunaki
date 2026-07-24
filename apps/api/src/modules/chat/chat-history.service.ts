import { Injectable } from '@nestjs/common';
import { ChatHistory } from '@prisma/client';
import { BaseService } from '../../common/base.service.js';
import { ChatHistoryRepository } from './chat-history.repository.js';

@Injectable()
export class ChatHistoryService extends BaseService<ChatHistory> {
  constructor(protected readonly repository: ChatHistoryRepository) {
    super(repository);
  }

  async createChat(mode: 'chat' | 'workspace', workspaceId?: string): Promise<ChatHistory> {
    return this.repository.create({
      mode,
      workspaceId: workspaceId || null,
      title: 'Chat Baru',
    });
  }

  async findByWorkspaceId(workspaceId: string): Promise<ChatHistory[]> {
    return this.repository.findByWorkspaceId(workspaceId);
  }

  async findAllChats(): Promise<ChatHistory[]> {
    return this.repository.findAllChats();
  }
}
