import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { SkillService } from './skill.service.js';

@Controller('skills')
export class SkillsController {
  constructor(private readonly skillService: SkillService) {}

  @Get()
  async findAll(
    @Query('domain') domain?: string,
    @Query('workspace') workspaceId?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    if (search) {
      return this.skillService.search(search);
    }
    if (domain || workspaceId) {
      return this.skillService.findRelevant(domain, workspaceId);
    }
    if (category) {
      return this.skillService.findByCategory(category);
    }
    return this.skillService.findActive();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.skillService.findById(id);
  }

  @Post()
  async create(
    @Body()
    body: {
      name: string;
      displayName: string;
      description: string;
      category?: string;
      domain?: string;
      workspaceId?: string;
      content: string;
      tags?: string[];
    },
  ) {
    return this.skillService.createSkill(body);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      displayName: string;
      description: string;
      category: string;
      domain: string;
      content: string;
      tags: string[];
      active: boolean;
      pinned: boolean;
    }>,
  ) {
    return this.skillService.updateSkill(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    // Soft-delete: set active = false
    return this.skillService.updateSkill(id, { active: false });
  }

  @Patch(':id/toggle-active')
  async toggleActive(@Param('id') id: string) {
    const skill = await this.skillService.findById(id);
    if (!skill) {
      throw new Error('Skill not found');
    }
    return this.skillService.updateSkill(id, { active: !skill.active });
  }

  @Patch(':id/pin')
  async togglePin(@Param('id') id: string) {
    const skill = await this.skillService.findById(id);
    if (!skill) {
      throw new Error('Skill not found');
    }
    return this.skillService.updateSkill(id, { pinned: !skill.pinned });
  }
}
