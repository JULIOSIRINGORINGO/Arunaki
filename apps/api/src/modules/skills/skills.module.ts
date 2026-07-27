import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { SkillService } from './skill.service.js';
import { SkillRepository } from './skill.repository.js';
import { SkillSeedService } from './skill-seed.service.js';
import { SkillSelfImproveService } from './skill-self-improve.service.js';
import { SkillsController } from './skills.controller.js';
import { AiModule } from '../ai/ai.module.js';

@Module({
  imports: [forwardRef(() => AiModule)],
  controllers: [SkillsController],
  providers: [
    SkillService,
    SkillRepository,
    SkillSeedService,
    SkillSelfImproveService,
  ],
  exports: [SkillService, SkillSelfImproveService],
})
export class SkillsModule implements OnModuleInit {
  constructor(private readonly seedService: SkillSeedService) {}

  async onModuleInit(): Promise<void> {
    await this.seedService.seedAll();
  }
}
