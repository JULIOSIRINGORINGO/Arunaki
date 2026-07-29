import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller.js';
import { ChatHistoryService } from './chat-history.service.js';
import { ChatHistoryRepository } from './chat-history.repository.js';
import { MessageService } from './message.service.js';
import { MessageRepository } from './message.repository.js';
import { AgentRunnerService } from './agent-runner.service.js';
import { SessionAdmissionService } from './session-admission.service.js';
import { UserTurnTranscriptService } from './user-turn-transcript.service.js';
import { SessionStateEventsService } from './session-state-events.service.js';
import { HarnessRegistryService } from './harness/harness-registry.service.js';
import { PrismaModule } from '../../common/providers/prisma.module.js';
import { AiModule } from '../ai/ai.module.js';
import { ToolsModule } from '../tools/tools.module.js';
import { KnowledgeModule } from '../knowledge/knowledge.module.js';
import { ArtifactModule } from '../artifact/artifact.module.js';
import { MemoryModule } from '../memory/memory.module.js';

@Module({
  imports: [
    PrismaModule,
    AiModule,
    ToolsModule,
    KnowledgeModule,
    ArtifactModule,
    MemoryModule,
  ],
  controllers: [ChatController],
  providers: [
    ChatHistoryService,
    ChatHistoryRepository,
    MessageService,
    MessageRepository,
    AgentRunnerService,
    SessionAdmissionService,
    UserTurnTranscriptService,
    SessionStateEventsService,
    HarnessRegistryService,
  ],
  exports: [ChatHistoryService, MessageService, AgentRunnerService, SessionAdmissionService, UserTurnTranscriptService, SessionStateEventsService, HarnessRegistryService],
})
export class ChatModule {}
