import { Module } from '@nestjs/common';
import { FileController } from './file.controller.js';
import { FileService } from './file.service.js';
import { FileRepository } from './file.repository.js';
import { PrismaModule } from '../../common/providers/prisma.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { SourceModule } from '../source/source.module.js';

@Module({
  imports: [PrismaModule, StorageModule, SourceModule],
  controllers: [FileController],
  providers: [FileService, FileRepository],
  exports: [FileService],
})
export class FileModule {}
