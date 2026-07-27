import { Module, forwardRef } from '@nestjs/common';
import { MemoryService } from './memory.service.js';
import { MemoryRepository } from './memory.repository.js';
import { SessionSearchService } from './session-search.service.js';
import { BackgroundReviewService } from './background-review.service.js';
import { SmartRecallService } from './smart-recall.service.js';
import { AutoMemoryService } from './auto-memory.service.js';
import { SkillsModule } from '../skills/skills.module.js';
import { AiModule } from '../ai/ai.module.js';

@Module({
  imports: [SkillsModule, forwardRef(() => AiModule)],
  providers: [
    MemoryService,
    MemoryRepository,
    SessionSearchService,
    BackgroundReviewService,
    SmartRecallService,
    AutoMemoryService,
  ],
  exports: [
    MemoryService,
    SessionSearchService,
    BackgroundReviewService,
    SmartRecallService,
    AutoMemoryService,
  ],
})
export class MemoryModule {}
