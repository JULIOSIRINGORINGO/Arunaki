import { Module } from '@nestjs/common';
import { MemoryService } from './memory.service.js';
import { MemoryRepository } from './memory.repository.js';

@Module({
  providers: [MemoryService, MemoryRepository],
  exports: [MemoryService],
})
export class MemoryModule {}