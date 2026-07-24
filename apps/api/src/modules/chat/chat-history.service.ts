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
      title: null,
    });
  }

  async findByWorkspaceId(workspaceId: string): Promise<ChatHistory[]> {
    return this.repository.findByWorkspaceId(workspaceId);
  }

  async findAllChats(): Promise<any[]> {
    return this.repository.findAllChats();
  }

  async togglePin(id: string): Promise<ChatHistory> {
    return this.repository.togglePin(id);
  }

  async deleteChat(id: string): Promise<void> {
    return this.repository.delete(id);
  }

  async updateTitle(id: string, title: string): Promise<ChatHistory> {
    return this.repository.update(id, { title } as any);
  }
}
