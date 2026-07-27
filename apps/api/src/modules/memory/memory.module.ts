import { Module } from '@nestjs/common';
import { MemoryService } from './memory.service.js';
import { MemoryRepository } from './memory.repository.js';
import { SessionSearchService } from './session-search.service.js';
import { BackgroundReviewService } from './background-review.service.js';
import { SmartRecallService } from './smart-recall.service.js';
import { SkillsModule } from '../skills/skills.module.js';

@Module({
  imports: [SkillsModule],
  providers: [MemoryService, MemoryRepository, SessionSearchService, BackgroundReviewService, SmartRecallService],
  exports: [MemoryService, SessionSearchService, BackgroundReviewService, SmartRecallService],
})
export class MemoryModule {}