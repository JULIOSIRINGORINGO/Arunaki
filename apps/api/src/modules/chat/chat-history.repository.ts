import { Injectable } from '@nestjs/common';
import { ChatHistory } from '@prisma/client';
import { PrismaBaseRepository } from '../../common/providers/prisma-base.repository.js';
import { PrismaService } from '../../common/providers/prisma.service.js';

@Injectable()
export class ChatHistoryRepository extends PrismaBaseRepository<ChatHistory> {
  protected readonly model: any;

  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
    this.model = prisma.chatHistory;
  }

  async findByWorkspaceId(workspaceId: string): Promise<ChatHistory[]> {
    return this.prisma.chatHistory.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findAllChats(): Promise<ChatHistory[]> {
    return this.prisma.chatHistory.findMany({
      where: { mode: 'chat' },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
