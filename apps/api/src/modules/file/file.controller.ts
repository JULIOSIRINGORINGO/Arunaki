import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus, UseInterceptors, UploadedFile, UploadedFiles, BadRequestException } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { FileService } from './file.service.js';
import { successResponse, errorResponse } from '../../common/dtos/api-response.dto.js';

@Controller('files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post()
  async create(@Body() body: { sourceId: string; name: string; path: string; type: string; size: number; mimeType?: string }) {
    try {
      const file = await this.fileService.createFile(body);
      return successResponse(file);
    } catch (error) {
      return errorResponse('CREATE_FAILED', error.message);
    }
  }

  @Post('upload')
  @UseInterceptors(FilesInterceptor('files', 50))
  async upload(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('workspaceId') workspaceId: string,
    @Body('sourceName') sourceName?: string,
  ) {
    try {
      if (!files || files.length === 0) {
        throw new BadRequestException('No files provided');
      }
      if (!workspaceId) {
        throw new BadRequestException('workspaceId is required');
      }

      const createdFiles = await this.fileService.uploadFiles(workspaceId, sourceName || 'Uploads', files);
      return successResponse(createdFiles);
    } catch (error) {
      return errorResponse('UPLOAD_FAILED', error.message);
    }
  }

  @Get('source/:sourceId')
  async findBySource(@Param('sourceId') sourceId: string) {
    try {
      const files = await this.fileService.findBySourceId(sourceId);
      return successResponse(files);
    } catch (error) {
      return errorResponse('FETCH_FAILED', error.message);
    }
  }

  @Get('workspace/:workspaceId')
  async findByWorkspace(@Param('workspaceId') workspaceId: string) {
    try {
      const files = await this.fileService.findByWorkspaceId(workspaceId);
      return successResponse(files);
    } catch (error) {
      return errorResponse('FETCH_FAILED', error.message);
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const file = await this.fileService.findById(id);
      return successResponse(file);
    } catch (error) {
      return errorResponse('NOT_FOUND', error.message);
    }
  }

  @Put(':id/content')
  async updateContent(@Param('id') id: string, @Body() body: { content: string }) {
    try {
      const file = await this.fileService.updateContent(id, body.content);
      return successResponse(file);
    } catch (error) {
      return errorResponse('UPDATE_FAILED', error.message);
    }
  }

  @Put(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    try {
      const file = await this.fileService.updateStatus(id, body.status);
      return successResponse(file);
    } catch (error) {
      return errorResponse('UPDATE_FAILED', error.message);
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    try {
      await this.fileService.delete(id);
      return successResponse(null);
    } catch (error) {
      return errorResponse('DELETE_FAILED', error.message);
    }
  }
}
