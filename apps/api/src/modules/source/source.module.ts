import { Module } from '@nestjs/common';
import { SourceController } from './source.controller.js';
import { SourceService } from './source.service.js';
import { SourceRepository } from './source.repository.js';
import { PrismaModule } from '../../common/providers/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [SourceController],
  providers: [SourceService, SourceRepository],
  exports: [SourceService],
})
export class SourceModule {}
