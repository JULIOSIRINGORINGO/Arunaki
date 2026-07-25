import { Controller, Get, Post, Patch, Delete, Body, Param, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KnowledgeService } from './knowledge.service.js';
import { successResponse, errorResponse } from '../../common/dtos/api-response.dto.js';
import * as fs from 'fs';
import * as path from 'path';

@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  async findAll() {
    try {
      const items = await this.knowledgeService.findAll();
      return successResponse(items);
    } catch (error) {
      return errorResponse('FETCH_FAILED', error.message);
    }
  }

  @Get('active')
  async findActive() {
    try {
      const items = await this.knowledgeService.findActive();
      return successResponse(items);
    } catch (error) {
      return errorResponse('FETCH_FAILED', error.message);
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const item = await this.knowledgeService.findById(id);
      return successResponse(item);
    } catch (error) {
      return errorResponse('NOT_FOUND', error.message);
    }
  }

  @Post()
  async create(@Body() body: { title: string; content: string; type?: string }) {
    try {
      const item = await this.knowledgeService.create({
        title: body.title,
        content: body.content,
        type: body.type || 'custom',
      } as any);
      return successResponse(item);
    } catch (error) {
      return errorResponse('CREATE_FAILED', error.message);
    }
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: { title?: string; content?: string; type?: string }) {
    try {
      const item = await this.knowledgeService.update(id, body as any);
      return successResponse(item);
    } catch (error) {
      return errorResponse('UPDATE_FAILED', error.message);
    }
  }

  @Patch(':id/toggle')
  async toggleActive(@Param('id') id: string) {
    try {
      const item = await this.knowledgeService.toggleActive(id);
      return successResponse(item);
    } catch (error) {
      return errorResponse('UPDATE_FAILED', error.message);
    }
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ['.pdf', '.docx', '.txt', '.md', '.csv'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowed.includes(ext)) {
        cb(null, true);
      } else {
        cb(new BadRequestException(`Format ${ext} tidak didukung. Gunakan: PDF, DOCX, TXT, Markdown, CSV`), false);
      }
    },
  }))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return errorResponse('NO_FILE', 'Tidak ada file yang diunggah');
    }

    try {
      const ext = path.extname(file.originalname).toLowerCase();
      let text = '';

      switch (ext) {
        case '.pdf': {
          const PDFParser = (await import('pdf2json')).default;
          text = await new Promise<string>((resolve, reject) => {
            const parser = new PDFParser();
            parser.on('pdfParser_dataError', (errData: any) => reject(new Error(errData.parserError || 'PDF parse error')));
            parser.on('pdfParser_dataReady', (pdfData: any) => {
              const parts = (pdfData.Pages || []).map((page: any) =>
                (page.Texts || []).flatMap((t: any) => (t.R || []).map((r: any) => decodeURIComponent(r.T || ''))).join(' ')
              );
              resolve(parts.join('\n\n'));
            });
            parser.parseBuffer(file.buffer);
          });
          break;
        }
        case '.docx': {
          const mammoth = await import('mammoth');
          const result = await mammoth.extractRawText({ buffer: file.buffer });
          text = result.value;
          break;
        }
        case '.csv': {
          const csvParse = await import('csv-parse/sync');
          const records = csvParse.parse(file.buffer.toString(), { columns: true, skip_empty_lines: true, trim: true });
          text = records.map((r: Record<string, string>) => Object.values(r).join(' | ')).join('\n');
          break;
        }
        case '.txt':
        case '.md':
          text = file.buffer.toString('utf-8');
          break;
        default:
          return errorResponse('UNSUPPORTED', `Format ${ext} tidak didukung`);
      }

      const title = path.basename(file.originalname, ext);

      const item = await this.knowledgeService.create({
        title,
        content: text,
        type: ext.replace('.', ''),
      } as any);

      return successResponse(item);
    } catch (error) {
      return errorResponse('UPLOAD_FAILED', error.message);
    }
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    try {
      await this.knowledgeService.delete(id);
      return successResponse({ deleted: true });
    } catch (error) {
      return errorResponse('DELETE_FAILED', error.message);
    }
  }
}
