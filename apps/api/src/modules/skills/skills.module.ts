import { Module } from '@nestjs/common';
import { SkillService } from './skill.service.js';
import { SkillRepository } from './skill.repository.js';

@Module({
  providers: [SkillService, SkillRepository],
  exports: [SkillService],
})
export class SkillsModule {}