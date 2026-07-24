import { Module } from '@nestjs/common';
import { WorkspaceController } from './workspace.controller.js';
import { WorkspaceService } from './workspace.service.js';
import { WorkspaceRepository } from './workspace.repository.js';
import { PrismaModule } from '../../common/providers/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService, WorkspaceRepository],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
