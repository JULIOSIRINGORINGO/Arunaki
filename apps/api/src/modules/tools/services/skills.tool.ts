import { Injectable, Logger } from '@nestjs/common';
import { Skill } from '@prisma/client';
import { SkillService } from '../../skills/skill.service.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';

@Injectable()
export class SkillsTool {
  private readonly logger = new Logger(SkillsTool.name);

  constructor(private readonly skillService: SkillService) {}

  async listSkills(): Promise<ToolResult> {
    try {
      const skills = await this.skillService.findActive();

      if (skills.length === 0) {
        return {
          status: 'success',
          data: { count: 0, skills: [] },
          preview:
            'Belum ada skill tersimpan. Agent bisa membuat skill baru dari pengalaman.',
          metadata: {
            toolName: 'skills',
            displayName: 'Skills',
            executionTime: 0,
          },
        };
      }

      const skillList = skills.map((s: Skill) => ({
        name: s.name,
        displayName: s.displayName,
        description: s.description,
        category: s.category,
        usageCount: s.usageCount,
        version: s.version,
      }));

      const preview = skills
        .map((s: Skill) => `[${s.name}] ${s.displayName}: ${s.description}`)
        .join('\n');

      return {
        status: 'success',
        data: { count: skills.length, skills: skillList },
        preview,
        metadata: {
          toolName: 'skills',
          displayName: 'Skills',
          executionTime: 0,
        },
      };
    } catch (e) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal list skills: ${e.message}`,
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
          preview: `Skill "${name}" tidak ditemukan.`,
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
    } catch (e) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal view skill: ${e.message}`,
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
    content: string;
    tags?: string[];
    workspaceId: string;
  }): Promise<ToolResult> {
    try {
      const skill = await this.skillService.createSkill({
        ...data,
        sourceType: 'auto',
      });

      const preview = `Skill "${skill.displayName}" berhasil dibuat! (${skill.name})`;

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
    } catch (e) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal buat skill: ${e.message}`,
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
          preview: `Tidak ditemukan skill untuk "${query}".`,
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
    } catch (e) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal search skills: ${e.message}`,
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
      const skill = await this.skillService.findByNameInWorkspace(name, workspaceId);
      if (!skill) {
        return {
          status: 'error',
          data: {},
          preview: `Skill "${name}" tidak ditemukan.`,
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
          preview: `Update ditolak: Skill ini bukan milik workspace Anda.`,
          metadata: {
            toolName: 'skills',
            displayName: 'Skills',
            executionTime: 0,
          },
          error: { code: 'FORBIDDEN', message: `Cannot update skill from another workspace` },
        };
      }

      const updated = await this.skillService.updateSkill(skill.id, data);

      const preview = `Skill "${updated.displayName}" berhasil diupdate! (v${updated.version})`;

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
    } catch (e) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal update skill: ${e.message}`,
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
      const skill = await this.skillService.findByNameInWorkspace(name, workspaceId);
      if (!skill) {
        return {
          status: 'error',
          data: {},
          preview: `Skill "${name}" tidak ditemukan.`,
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
          preview: `Penghapusan ditolak: Skill ini bukan milik workspace Anda.`,
          metadata: {
            toolName: 'skills',
            displayName: 'Skills',
            executionTime: 0,
          },
          error: { code: 'FORBIDDEN', message: `Cannot delete skill from another workspace` },
        };
      }

      await this.skillService.updateSkill(skill.id, { active: false });

      return {
        status: 'success',
        data: { name },
        preview: `Skill "${name}" berhasil dinonaktifkan.`,
        metadata: {
          toolName: 'skills',
          displayName: 'Skills',
          executionTime: 0,
        },
      };
    } catch (e) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal hapus skill: ${e.message}`,
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
