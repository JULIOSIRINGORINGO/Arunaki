import { Module } from '@nestjs/common';
import { WorkspaceController } from './workspace.controller.js';
import { WorkspaceService } from './workspace.service.js';
import { WorkspaceRepository } from './workspace.repository.js';
import { WorkspaceInitService } from './workspace-init.service.js';
import { PrismaModule } from '../../common/providers/prisma.module.js';
import { ParserModule } from '../parser/parser.module.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({
  imports: [PrismaModule, ParserModule, StorageModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService, WorkspaceRepository, WorkspaceInitService],
  exports: [WorkspaceService, WorkspaceInitService],
})
export class WorkspaceModule {}
