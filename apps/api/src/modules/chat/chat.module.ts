import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller.js';
import { ChatHistoryService } from './chat-history.service.js';
import { ChatHistoryRepository } from './chat-history.repository.js';
import { MessageService } from './message.service.js';
import { MessageRepository } from './message.repository.js';
import { AgentRunnerService } from './agent-runner.service.js';
import { PrismaModule } from '../../common/providers/prisma.module.js';
import { AiModule } from '../ai/ai.module.js';
import { ToolsModule } from '../tools/tools.module.js';
import { KnowledgeModule } from '../knowledge/knowledge.module.js';
import { ArtifactModule } from '../artifact/artifact.module.js';

@Module({
  imports: [PrismaModule, AiModule, ToolsModule, KnowledgeModule, ArtifactModule],
  controllers: [ChatController],
  providers: [
    ChatHistoryService,
    ChatHistoryRepository,
    MessageService,
    MessageRepository,
    AgentRunnerService,
  ],
  exports: [ChatHistoryService, MessageService, AgentRunnerService],
})
export class ChatModule {}
