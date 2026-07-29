import { Injectable } from '@nestjs/common';
import { ChatHistory } from '@prisma/client';
import { BaseService } from '../../common/base.service.js';
import { ChatHistoryRepository } from './chat-history.repository.js';
import { SessionStateEventsService, SessionEventType } from './session-state-events.service.js';

@Injectable()
export class ChatHistoryService extends BaseService<ChatHistory> {
  constructor(
    protected readonly repository: ChatHistoryRepository,
    private readonly sessionEvents: SessionStateEventsService,
  ) {
    super(repository);
  }

  async createChat(
    mode: 'chat' | 'workspace',
    workspaceId?: string,
  ): Promise<ChatHistory> {
    const chat = await this.repository.create({
      mode,
      workspaceId: workspaceId || null,
      title: null,
    });

    this.sessionEvents.record(
      SessionEventType.SESSION_CREATED,
      chat.id,
      mode,
      { workspaceId: workspaceId || null, mode },
    );

    return chat;
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
    return this.repository.update(id, { title });
  }
}
