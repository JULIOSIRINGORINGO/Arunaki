import { Module, forwardRef } from '@nestjs/common';
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
  ],
  controllers: [WorkspaceController],
  providers: [
    WorkspaceService,
    WorkspaceRepository,
    WorkspaceInitService,
    WorkspaceRunnerService,
  ],
  exports: [WorkspaceService, WorkspaceInitService, WorkspaceRunnerService],
})
export class WorkspaceModule {}
