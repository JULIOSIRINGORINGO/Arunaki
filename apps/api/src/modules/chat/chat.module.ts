import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller.js';
import { ChatHistoryService } from './chat-history.service.js';
import { ChatHistoryRepository } from './chat-history.repository.js';
import { MessageService } from './message.service.js';
import { MessageRepository } from './message.repository.js';
import { PrismaModule } from '../../common/providers/prisma.module.js';
import { AiModule } from '../ai/ai.module.js';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [ChatController],
  providers: [
    ChatHistoryService,
    ChatHistoryRepository,
    MessageService,
    MessageRepository,
  ],
  exports: [ChatHistoryService, MessageService],
})
export class ChatModule {}
