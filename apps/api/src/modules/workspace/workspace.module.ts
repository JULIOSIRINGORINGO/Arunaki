import { Module, forwardRef } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { WorkspaceController } from './workspace.controller.js';
import { WorkspaceService } from './workspace.service.js';
import { WorkspaceRepository } from './workspace.repository.js';
import { WorkspaceInitService } from './workspace-init.service.js';
import { WorkspaceRunnerService } from './workspace-runner.service.js';
import { PrismaModule } from '../../common/providers/prisma.module.js';
import { ParserModule } from '../parser/parser.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { AiModule } from '../ai/ai.module.js';
import { ToolsModule } from '../tools/tools.module.js';
import { FileModule } from '../file/file.module.js';
import { SearchModule } from '../search/search.module.js';
import { ArtifactModule } from '../artifact/artifact.module.js';
import { MemoryModule } from '../memory/memory.module.js';
import { SkillsModule } from '../skills/skills.module.js';
import { SourceModule } from '../source/source.module.js';
import { ProviderModule } from '../provider/provider.module.js';
import { ChatModule } from '../chat/chat.module.js';

import { WorkspacePromptBuilderService } from './services/workspace-prompt-builder.service.js';
import { WorkspaceCartographerService } from './services/workspace-cartographer.service.js';
import { WorkspaceRulesSentinelService } from './services/workspace-rules-sentinel.service.js';
import { TranscriptEngineService } from './services/transcript-engine.service.js';
import { TimeTravelService } from './services/time-travel.service.js';

@Module({
  imports: [
    PrismaModule,
    ParserModule,
    StorageModule,
    AiModule,
    forwardRef(() => ToolsModule),
    FileModule,
    SearchModule,
    ArtifactModule,
    MemoryModule,
    SkillsModule,
    SourceModule,
    ProviderModule,
    ChatModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [WorkspaceController],
  providers: [
    WorkspaceService,
    WorkspaceRepository,
    WorkspaceInitService,
    WorkspaceRunnerService,
    WorkspacePromptBuilderService,
    WorkspaceCartographerService,
    WorkspaceRulesSentinelService,
    TranscriptEngineService,
    TimeTravelService,
  ],
  exports: [
    WorkspaceService,
    WorkspaceInitService,
    WorkspaceRunnerService,
    WorkspacePromptBuilderService,
    WorkspaceCartographerService,
    WorkspaceRulesSentinelService,
    TranscriptEngineService,
    TimeTravelService,
  ],
})
export class WorkspaceModule {}
