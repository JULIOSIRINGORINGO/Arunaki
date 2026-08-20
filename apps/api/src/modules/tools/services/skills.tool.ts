import { Injectable, Logger } from '@nestjs/common';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import { SkillService } from '../../skills/skill.service.js';
import { Skill } from '@prisma/client';

@Injectable()
export class SkillsTool {
  private readonly logger = new Logger(SkillsTool.name);

  constructor(private readonly skillService: SkillService) {}

  async listSkills(params?: {
    category?: string;
    workspaceId?: string;
    includeGlobal?: boolean;
  }): Promise<ToolResult> {
    try {
      let skills: Skill[] = [];
      if (params?.category) {
        skills = await this.skillService.findByCategory(params.category);
      } else if (params?.workspaceId) {
        skills = await this.skillService.findByWorkspace(params.workspaceId);
      } else {
        skills = await this.skillService.findActive();
      }

      const preview =
        skills.length > 0
          ? skills
              .map(
                (s: Skill) =>
                  `[${s.category}] ${s.name} (${s.displayName}): ${s.description}`,
              )
              .join('\n')
          : 'No active skills available.';

      return {
        status: 'success',
        data: { count: skills.length, skills },
        preview,
        metadata: {
          toolName: 'skills',
          displayName: 'Skills',
          executionTime: 0,
        },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to list skills: ${e.message}`,
        metadata: {
          toolName: 'skills',
          displayName: 'Skills',
          executionTime: 0,
        },
        error: { code: 'SKILLS_ERROR', message: e.message },
      };
    }
  }

  async viewSkill(name: string): Promise<ToolResult> {
    try {
      const skill = await this.skillService.findByName(name);
      if (!skill) {
        return {
          status: 'error',
          data: {},
          preview: `Skill "${name}" not found.`,
          metadata: {
            toolName: 'skills',
            displayName: 'Skills',
            executionTime: 0,
          },
          error: { code: 'NOT_FOUND', message: `Skill "${name}" not found` },
        };
      }

      await this.skillService.incrementUsage(skill.id);

      const preview = `# ${skill.displayName}\n\n${skill.content}`;

      return {
        status: 'success',
        data: {
          name: skill.name,
          displayName: skill.displayName,
          description: skill.description,
          category: skill.category,
          version: skill.version,
          content: skill.content,
        },
        preview,
        metadata: {
          toolName: 'skills',
          displayName: 'Skills',
          executionTime: 0,
        },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to view skill: ${e.message}`,
        metadata: {
          toolName: 'skills',
          displayName: 'Skills',
          executionTime: 0,
        },
        error: { code: 'SKILLS_ERROR', message: e.message },
      };
    }
  }

  async createSkill(data: {
    name: string;
    displayName: string;
    description: string;
    category?: string;
    domain?: string;
    content: string;
    tags?: string[];
    workspaceId: string;
  }): Promise<ToolResult> {
    try {
      const skill = await this.skillService.create({
        name: data.name,
        displayName: data.displayName,
        description: data.description,
        category: data.category || 'general',
        domain: data.domain || 'general',
        content: data.content,
        tags: (data.tags || []).join(','),
        workspaceId: data.workspaceId,
        sourceType: 'auto',
      });

      const preview = `Skill "${skill.displayName}" created successfully! (${skill.name})`;

      return {
        status: 'success',
        data: {
          id: skill.id,
          name: skill.name,
          displayName: skill.displayName,
        },
        preview,
        metadata: {
          toolName: 'skills',
          displayName: 'Skills',
          executionTime: 0,
        },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to create skill: ${e.message}`,
        metadata: {
          toolName: 'skills',
          displayName: 'Skills',
          executionTime: 0,
        },
        error: { code: 'SKILLS_ERROR', message: e.message },
      };
    }
  }

  async searchSkills(query: string): Promise<ToolResult> {
    try {
      const skills = await this.skillService.search(query);

      if (skills.length === 0) {
        return {
          status: 'success',
          data: { count: 0, skills: [] },
          preview: `No skills found for "${query}".`,
          metadata: {
            toolName: 'skills',
            displayName: 'Skills',
            executionTime: 0,
          },
        };
      }

      const preview = skills
        .map((s: Skill) => `[${s.name}] ${s.displayName}: ${s.description}`)
        .join('\n');

      return {
        status: 'success',
        data: { count: skills.length, skills },
        preview,
        metadata: {
          toolName: 'skills',
          displayName: 'Skills',
          executionTime: 0,
        },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to search skills: ${e.message}`,
        metadata: {
          toolName: 'skills',
          displayName: 'Skills',
          executionTime: 0,
        },
        error: { code: 'SKILLS_ERROR', message: e.message },
      };
    }
  }

  async updateSkill(
    name: string,
    workspaceId: string,
    data: Partial<{
      displayName: string;
      description: string;
      content: string;
      tags: string[];
    }>,
  ): Promise<ToolResult> {
    try {
      const skill = await this.skillService.findByNameInWorkspace(
        name,
        workspaceId,
      );
      if (!skill) {
        return {
          status: 'error',
          data: {},
          preview: `Skill "${name}" not found.`,
          metadata: {
            toolName: 'skills',
            displayName: 'Skills',
            executionTime: 0,
          },
          error: { code: 'NOT_FOUND', message: `Skill "${name}" not found` },
        };
      }

      if (skill.workspaceId !== null && skill.workspaceId !== workspaceId) {
        return {
          status: 'error',
          data: {},
          preview: `Update rejected: Skill does not belong to your workspace.`,
          metadata: {
            toolName: 'skills',
            displayName: 'Skills',
            executionTime: 0,
          },
          error: {
            code: 'FORBIDDEN',
            message: `Cannot update skill from another workspace`,
          },
        };
      }

      const updated = await this.skillService.update(skill.id, {
        displayName: data.displayName,
        description: data.description,
        content: data.content,
        tags: data.tags ? data.tags.join(',') : undefined,
      });

      const preview = `Skill "${updated.displayName}" updated successfully! (v${updated.version})`;

      return {
        status: 'success',
        data: {
          id: updated.id,
          name: updated.name,
          displayName: updated.displayName,
          version: updated.version,
        },
        preview,
        metadata: {
          toolName: 'skills',
          displayName: 'Skills',
          executionTime: 0,
        },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to update skill: ${e.message}`,
        metadata: {
          toolName: 'skills',
          displayName: 'Skills',
          executionTime: 0,
        },
        error: { code: 'SKILLS_ERROR', message: e.message },
      };
    }
  }

  async deleteSkill(name: string, workspaceId: string): Promise<ToolResult> {
    try {
      const skill = await this.skillService.findByNameInWorkspace(
        name,
        workspaceId,
      );
      if (!skill) {
        return {
          status: 'error',
          data: {},
          preview: `Skill "${name}" not found.`,
          metadata: {
            toolName: 'skills',
            displayName: 'Skills',
            executionTime: 0,
          },
          error: { code: 'NOT_FOUND', message: `Skill "${name}" not found` },
        };
      }

      if (skill.workspaceId !== null && skill.workspaceId !== workspaceId) {
        return {
          status: 'error',
          data: {},
          preview: `Deletion rejected: Skill does not belong to your workspace.`,
          metadata: {
            toolName: 'skills',
            displayName: 'Skills',
            executionTime: 0,
          },
          error: {
            code: 'FORBIDDEN',
            message: `Cannot delete skill from another workspace`,
          },
        };
      }

      await this.skillService.update(skill.id, { active: false });

      return {
        status: 'success',
        data: { name },
        preview: `Skill "${name}" deactivated successfully.`,
        metadata: {
          toolName: 'skills',
          displayName: 'Skills',
          executionTime: 0,
        },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Failed to delete skill: ${e.message}`,
        metadata: {
          toolName: 'skills',
          displayName: 'Skills',
          executionTime: 0,
        },
        error: { code: 'SKILLS_ERROR', message: e.message },
      };
    }
  }
}
