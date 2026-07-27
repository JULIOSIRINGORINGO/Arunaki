import { Module } from '@nestjs/common';
import { MemoryService } from './memory.service.js';
import { MemoryRepository } from './memory.repository.js';
import { SessionSearchService } from './session-search.service.js';
import { BackgroundReviewService } from './background-review.service.js';

@Module({
  providers: [MemoryService, MemoryRepository, SessionSearchService, BackgroundReviewService],
  exports: [MemoryService, SessionSearchService, BackgroundReviewService],
})
export class MemoryModule {}