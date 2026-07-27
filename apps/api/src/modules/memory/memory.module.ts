import { Module } from '@nestjs/common';
import { MemoryService } from './memory.service.js';
import { MemoryRepository } from './memory.repository.js';
import { SessionSearchService } from './session-search.service.js';

@Module({
  providers: [MemoryService, MemoryRepository, SessionSearchService],
  exports: [MemoryService, SessionSearchService],
})
export class MemoryModule {}