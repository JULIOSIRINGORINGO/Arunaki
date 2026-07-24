import { Injectable, Logger } from '@nestjs/common';
import { File } from '@prisma/client';
import * as path from 'path';
import { BaseService } from '../../common/base.service.js';
import { FileRepository } from './file.repository.js';
import { StorageService } from '../storage/storage.service.js';
import { SourceService } from '../source/source.service.js';

@Injectable()
export class FileService extends BaseService<File> {
  private readonly logger = new Logger(FileService.name);

  constructor(
    protected readonly repository: FileRepository,
    private readonly storageService: StorageService,
    private readonly sourceService: SourceService,
  ) {
    super(repository);
  }

  async findBySourceId(sourceId: string): Promise<File[]> {
    return this.repository.findBySourceId(sourceId);
  }

  async findByWorkspaceId(workspaceId: string): Promise<File[]> {
    return this.repository.findByWorkspaceId(workspaceId);
  }

  async createFile(data: {
    sourceId: string;
    name: string;
    path: string;
    type: string;
    size: number;
    mimeType?: string;
  }): Promise<File> {
    return this.repository.create({
      sourceId: data.sourceId,
      name: data.name,
      path: data.path,
      type: data.type,
      size: data.size,
      mimeType: data.mimeType,
      status: 'pending',
      metadata: '{}',
    });
  }

  async uploadFiles(
    workspaceId: string,
    sourceName: string,
    files: Express.Multer.File[],
  ): Promise<File[]> {
    const uploadDir = path.join('workspace-data', workspaceId, 'uploads');
    await this.storageService.ensureDir(uploadDir);

    const source = await this.sourceService.create({
      workspaceId,
      name: sourceName || 'Uploads',
      type: 'upload',
    });

    const createdFiles: File[] = [];

    for (const file of files) {
      const filePath = path.join(uploadDir, file.originalname);
      await this.storageService.writeBuffer(filePath, file.buffer);

      const ext = path.extname(file.originalname).toLowerCase().replace('.', '');

      const fileRecord = await this.createFile({
        sourceId: source.id,
        name: file.originalname,
        path: filePath,
        type: ext,
        size: file.size,
        mimeType: file.mimetype,
      });

      createdFiles.push(fileRecord);
    }

    await this.sourceService.updateStatus(source.id, 'ready', createdFiles.length);
    this.logger.log(`Uploaded ${createdFiles.length} files to workspace ${workspaceId}`);

    return createdFiles;
  }

  async updateContent(id: string, content: string): Promise<File> {
    return this.repository.update(id, { content });
  }

  async updateStatus(id: string, status: string): Promise<File> {
    return this.repository.update(id, { status });
  }
}
