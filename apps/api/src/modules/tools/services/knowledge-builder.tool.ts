import { Injectable, Logger } from '@nestjs/common';
import { KnowledgeRepository } from '../../knowledge/knowledge.repository.js';
import { ToolResult } from '../interfaces/tool-result.interface.js';

@Injectable()
export class KnowledgeBuilderTool {
  private readonly logger = new Logger(KnowledgeBuilderTool.name);

  constructor(private readonly knowledgeRepository: KnowledgeRepository) {}

  async saveKnowledge(
    title: string,
    content: string,
    type?: string,
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      if (!title || !content) {
        return {
          status: 'error',
          data: {},
          preview: 'Judul dan konten wajib diisi',
          metadata: {
            toolName: 'save_knowledge',
            displayName: 'Simpan Knowledge',
            executionTime: 0,
          },
          error: {
            code: 'MISSING_FIELDS',
            message: 'Title and content are required',
          },
        };
      }

      const existing = await this.knowledgeRepository.findByTitle(title);

      let knowledge;
      if (existing) {
        knowledge = await this.knowledgeRepository.update(existing.id, {
          content,
          type: type || existing.type,
        });
        this.logger.log(`Knowledge updated: ${title}`);
      } else {
        knowledge = await this.knowledgeRepository.create({
          title,
          content,
          type: type || 'custom',
          active: true,
        });
        this.logger.log(`Knowledge created: ${title}`);
      }

      const preview = `Knowledge berhasil disimpan!\n\nJudul: ${knowledge.title}\nTipe: ${knowledge.type}\nStatus: ${knowledge.active ? 'Aktif' : 'Nonaktif'}\n\n${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`;

      return {
        status: 'success',
        data: {
          id: knowledge.id,
          title: knowledge.title,
          type: knowledge.type,
          active: knowledge.active,
          contentLength: content.length,
        },
        preview,
        metadata: {
          toolName: 'save_knowledge',
          displayName: 'Simpan Knowledge',
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to save knowledge: ${error.message}`);
      return {
        status: 'error',
        data: {},
        preview: `Gagal menyimpan knowledge: ${error.message}`,
        metadata: {
          toolName: 'save_knowledge',
          displayName: 'Simpan Knowledge',
          executionTime: Date.now() - startTime,
        },
        error: {
          code: 'SAVE_FAILED',
          message: error.message,
        },
      };
    }
  }
}
