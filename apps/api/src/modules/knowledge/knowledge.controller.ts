import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service.js';
import { successResponse, errorResponse } from '../../common/dtos/api-response.dto.js';

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
