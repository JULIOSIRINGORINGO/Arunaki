import { Module, OnModuleInit } from '@nestjs/common';
import { SkillService } from './skill.service.js';
import { SkillRepository } from './skill.repository.js';
import { SkillSeedService } from './skill-seed.service.js';
import { SkillsController } from './skills.controller.js';

@Module({
  controllers: [SkillsController],
  providers: [SkillService, SkillRepository, SkillSeedService],
  exports: [SkillService],
})
export class SkillsModule implements OnModuleInit {
  constructor(private readonly seedService: SkillSeedService) {}

  async onModuleInit(): Promise<void> {
    await this.seedService.seedAll();
  }
}
