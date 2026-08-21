import { Injectable, Inject } from '@nestjs/common';
import { ChatHistory } from '@prisma/client';
import { PrismaBaseRepository } from '../../common/providers/prisma-base.repository.js';
import { PrismaService } from '../../common/providers/prisma.service.js';

@Injectable()
export class ChatHistoryRepository extends PrismaBaseRepository<ChatHistory> {
  protected readonly model: any;

  constructor(@Inject(PrismaService) protected readonly prisma: PrismaService) {
    super(prisma);
    this.model = prisma.chatHistory;
  }

  async findByWorkspaceId(workspaceId: string): Promise<ChatHistory[]> {
    return this.prisma.chatHistory.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findAllChats(): Promise<any[]> {
    return this.prisma.chatHistory.findMany({
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
      include: {
        messages: {
          where: { role: 'user' },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });
  }

  async togglePin(id: string): Promise<ChatHistory> {
    const chat = await this.prisma.chatHistory.findUnique({ where: { id } });
    return this.prisma.chatHistory.update({
      where: { id },
      data: { pinned: !chat?.pinned },
    });
  }
}
