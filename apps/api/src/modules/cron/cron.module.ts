import { Module } from '@nestjs/common';
import { CronService } from './cron.service.js';
import { CronController } from './cron.controller.js';
import { StorageModule } from '../storage/storage.module.js';
import { ArtifactModule } from '../artifact/artifact.module.js';
import { ToolsModule } from '../tools/tools.module.js';

@Module({
  imports: [StorageModule, ArtifactModule, ToolsModule],
  controllers: [CronController],
  providers: [CronService],
  exports: [CronService],
})
export class CronModule {}
