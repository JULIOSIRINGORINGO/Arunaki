import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Res,
  StreamableFile,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { FileService } from './file.service.js';
import {
  successResponse,
  errorResponse,
} from '../../common/dtos/api-response.dto.js';

@Controller('files')
export class FileController {
  constructor(private readonly fileService: FileService) {}

  @Post()
  async create(
    @Body()
    body: {
      sourceId: string;
      name: string;
      path: string;
      type: string;
      size: number;
      mimeType?: string;
    },
  ) {
    try {
      const file = await this.fileService.createFile(body);
      return successResponse(file);
    } catch (error) {
      return errorResponse('CREATE_FAILED', error.message);
    }
  }

  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('files', 50, { limits: { fileSize: 50 * 1024 * 1024 } }),
  )
  async upload(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('workspaceId') workspaceId: string,
    @Body('sourceName') sourceName?: string,
    @Body('relativePaths') relativePaths?: string,
  ) {
    try {
      if (!files || files.length === 0) {
        throw new BadRequestException('No files provided');
      }
      if (!workspaceId) {
        throw new BadRequestException('workspaceId is required');
      }

      let parsedPaths: string[] | undefined;
      if (relativePaths) {
        try {
          parsedPaths = JSON.parse(relativePaths);
        } catch {
          // ignore parse error, fallback to originalname
        }
      }

      const createdFiles = await this.fileService.uploadFiles(
        workspaceId,
        sourceName || 'Uploads',
        files,
        parsedPaths,
      );
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

  @Get(':id/content')
  async getContent(@Param('id') id: string) {
    try {
      const file = await this.fileService.findById(id);
      if (!file) throw new BadRequestException('File not found');
      if (file.path) {
        try {
          const fs = await import('fs/promises');
          const content = await fs.readFile(file.path, 'utf-8');
          return successResponse({ content, path: file.path, name: file.name });
        } catch {
          return successResponse({
            content: file.content || '',
            path: file.path,
            name: file.name,
          });
        }
      }
      return successResponse({
        content: file.content || '',
        path: file.path,
        name: file.name,
      });
    } catch (error) {
      return errorResponse('FETCH_FAILED', error.message);
    }
  }

  @Get('raw/:filename')
  async streamRawByName(
    @Param('filename') filename: string,
    @Res({ passthrough: true }) res: any,
  ) {
    const cleanName = path.basename(filename);
    const file = await this.fileService.findByName(cleanName);
    if (!file || !file.path) {
      throw new BadRequestException(`File '${cleanName}' not found`);
    }
    if (!fs.existsSync(file.path)) {
      throw new BadRequestException(`File '${cleanName}' does not exist on disk`);
    }
    const mime =
      file.mimeType ||
      (cleanName.endsWith('.png')
        ? 'image/png'
        : cleanName.endsWith('.jpg') || cleanName.endsWith('.jpeg')
        ? 'image/jpeg'
        : cleanName.endsWith('.webp')
        ? 'image/webp'
        : cleanName.endsWith('.gif')
        ? 'image/gif'
        : 'application/octet-stream');
    res.set({
      'Content-Type': mime,
      'Cache-Control': 'public, max-age=86400',
    });
    return new StreamableFile(fs.createReadStream(file.path));
  }

  @Get(':id/raw')
  async streamRawById(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: any,
  ) {
    const file = await this.fileService.findById(id);
    if (!file || !file.path) {
      throw new BadRequestException('File not found');
    }
    if (!fs.existsSync(file.path)) {
      throw new BadRequestException('File does not exist on disk');
    }
    const cleanName = file.name || '';
    const mime =
      file.mimeType ||
      (cleanName.endsWith('.png')
        ? 'image/png'
        : cleanName.endsWith('.jpg') || cleanName.endsWith('.jpeg')
        ? 'image/jpeg'
        : cleanName.endsWith('.webp')
        ? 'image/webp'
        : cleanName.endsWith('.gif')
        ? 'image/gif'
        : 'application/octet-stream');
    res.set({
      'Content-Type': mime,
      'Cache-Control': 'public, max-age=86400',
    });
    return new StreamableFile(fs.createReadStream(file.path));
  }

  @Put(':id/content')
  async updateContent(
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    try {
      const file = await this.fileService.updateContent(id, body.content);
      return successResponse(file);
    } catch (error) {
      return errorResponse('UPDATE_FAILED', error.message);
    }
  }

  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
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
