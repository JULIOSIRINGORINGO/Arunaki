import { Module, forwardRef } from '@nestjs/common';
import { CronService } from './cron.service.js';
import { CronController } from './cron.controller.js';
import { StorageModule } from '../storage/storage.module.js';
import { ArtifactModule } from '../artifact/artifact.module.js';
import { ToolsModule } from '../tools/tools.module.js';
import { MemoryModule } from '../memory/memory.module.js';
import { SkillsModule } from '../skills/skills.module.js';
import { WorkspaceModule } from '../workspace/workspace.module.js';

@Module({
  // forwardRef: WorkspaceModule -> ToolsModule -> CronModule -> WorkspaceModule is circular
  imports: [StorageModule, ArtifactModule, forwardRef(() => ToolsModule), forwardRef(() => MemoryModule), forwardRef(() => SkillsModule), forwardRef(() => WorkspaceModule)],
  controllers: [CronController],
  providers: [CronService],
  exports: [CronService],
})
export class CronModule {}
