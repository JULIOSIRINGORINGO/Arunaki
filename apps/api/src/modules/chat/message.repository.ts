import { Injectable } from '@nestjs/common';
import { Message } from '@prisma/client';
import { PrismaBaseRepository } from '../../common/providers/prisma-base.repository.js';
import { PrismaService } from '../../common/providers/prisma.service.js';

@Injectable()
export class MessageRepository extends PrismaBaseRepository<Message> {
  protected readonly model: any;

  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
    this.model = prisma.message;
  }

  async findByChatHistoryId(chatHistoryId: string): Promise<Message[]> {
    return this.prisma.message.findMany({
      where: { chatHistoryId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
