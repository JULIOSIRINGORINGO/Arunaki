import { Module, forwardRef } from '@nestjs/common';
import { WorkspaceModule } from '../workspace/workspace.module.js';
import { ChatController } from './chat.controller.js';
import { ChatHistoryService } from './chat-history.service.js';
import { ChatHistoryRepository } from './chat-history.repository.js';
import { MessageService } from './message.service.js';
import { MessageRepository } from './message.repository.js';
import { AgentRunnerService } from './agent-runner.service.js';
import { SessionAdmissionService } from './session-admission.service.js';
import { UserTurnTranscriptService } from './user-turn-transcript.service.js';
import { SessionStateEventsService } from './session-state-events.service.js';
import { SubAgentRunnerService } from './sub-agent-runner.service.js';
import { HarnessRegistryService } from './harness/harness-registry.service.js';
import { PrismaModule } from '../../common/providers/prisma.module.js';
import { AiModule } from '../ai/ai.module.js';
import { ToolsModule } from '../tools/tools.module.js';
import { ToolsProviderModule } from '../tools/tools-provider.module.js';
import { KnowledgeModule } from '../knowledge/knowledge.module.js';
import { ArtifactModule } from '../artifact/artifact.module.js';
import { MemoryModule } from '../memory/memory.module.js';
import { ProviderModule } from '../provider/provider.module.js';

@Module({
  imports: [
    PrismaModule,
    AiModule,
    ToolsModule,
    ToolsProviderModule,
    KnowledgeModule,
    ArtifactModule,
    MemoryModule,
    ProviderModule,
    forwardRef(() => WorkspaceModule),
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
    SubAgentRunnerService,
    HarnessRegistryService,
  ],
  exports: [
    ChatHistoryService,
    MessageService,
    AgentRunnerService,
    SessionAdmissionService,
    UserTurnTranscriptService,
    SessionStateEventsService,
    SubAgentRunnerService,
    HarnessRegistryService,
  ],
})
export class ChatModule {}
