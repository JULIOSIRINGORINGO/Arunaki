import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { SourceService } from './source.service.js';
import { CreateSourceDto, UpdateSourceDto } from './dtos/source.dto.js';
import { successResponse, errorResponse } from '../../common/dtos/api-response.dto.js';

@Controller('sources')
export class SourceController {
  constructor(private readonly sourceService: SourceService) {}

  @Post()
  async create(@Body() dto: CreateSourceDto) {
    try {
      const source = await this.sourceService.create(dto);
      return successResponse(source);
    } catch (error) {
      return errorResponse('CREATE_FAILED', error.message);
    }
  }

  @Get('workspace/:workspaceId')
  async findByWorkspace(@Param('workspaceId') workspaceId: string) {
    try {
      const sources = await this.sourceService.findByWorkspaceId(workspaceId);
      return successResponse(sources);
    } catch (error) {
      return errorResponse('FETCH_FAILED', error.message);
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const source = await this.sourceService.findById(id);
      return successResponse(source);
    } catch (error) {
      return errorResponse('NOT_FOUND', error.message);
    }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateSourceDto) {
    try {
      const source = await this.sourceService.update(id, dto);
      return successResponse(source);
    } catch (error) {
      return errorResponse('UPDATE_FAILED', error.message);
    }
  }

  @Put(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { status: string; fileCount?: number }) {
    try {
      const source = await this.sourceService.updateStatus(id, body.status, body.fileCount);
      return successResponse(source);
    } catch (error) {
      return errorResponse('UPDATE_FAILED', error.message);
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    try {
      await this.sourceService.delete(id);
      return successResponse(null);
    } catch (error) {
      return errorResponse('DELETE_FAILED', error.message);
    }
  }
}
