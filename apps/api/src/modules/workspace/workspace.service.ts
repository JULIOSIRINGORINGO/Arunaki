import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Workspace } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseService } from '../../common/base.service.js';
import { WorkspaceRepository } from './workspace.repository.js';
import { StorageService } from '../storage/storage.service.js';
import { FileService } from '../file/file.service.js';
import { SourceService } from '../source/source.service.js';
import {
  WorkspaceHeartbeatService,
  FileSnapshot,
} from '../ai/workspace-heartbeat.service.js';

@Injectable()
export class WorkspaceService extends BaseService<Workspace> {
  constructor(
    protected readonly repository: WorkspaceRepository,
    private readonly storageService: StorageService,
    private readonly fileService: FileService,
    private readonly sourceService: SourceService,
    private readonly heartbeatService: WorkspaceHeartbeatService,
  ) {
    super(repository);
  }

  async create(data: {
    name: string;
    description?: string;
    businessType?: string;
    rootPath?: string;
  }): Promise<Workspace> {
    if (data.rootPath) {
      const existing = await this.repository.findAll();
      const match = existing.find(
        (w) => w.rootPath && w.rootPath.toLowerCase() === data.rootPath!.toLowerCase()
      );
      if (match) {
        return this.repository.update(match.id, {
          name: data.name || match.name,
          businessType: data.businessType || match.businessType,
          status: 'ready',
        });
      }
    }

    return this.repository.create({
      name: data.name,
      description: data.description,
      businessType: data.businessType || 'generic',
      rootPath: data.rootPath,
      status: 'ready',
    });
  }

  async findAll(): Promise<Workspace[]> {
    return this.repository.findAll({
      orderBy: { createdAt: 'desc' } as any,
    });
  }

  async findById(id: string): Promise<Workspace> {
    const workspace = await super.findById(id);
    if (!workspace) {
      throw new NotFoundException(`Workspace with id ${id} not found`);
    }
    return workspace;
  }

  async updateStatus(id: string, status: string): Promise<Workspace> {
    return this.repository.update(id, { status });
  }

  async connectFolder(id: string, folderPath: string) {
    const workspace = await this.findById(id);

    if (workspace.rootPath && workspace.rootPath !== folderPath) {
      throw new BadRequestException(
        'Workspace is already connected to another folder',
      );
    }

    // Validate folder exists and is readable
    try {
      await fs.access(folderPath, fs.constants.R_OK);
    } catch {
      throw new BadRequestException('Folder is not accessible');
    }

    // Update workspace with root path
    await this.repository.update(id, {
      rootPath: folderPath,
      status: 'processing',
    });

    // Create a source for this folder
    const source = await this.sourceService.create({
      workspaceId: id,
      name: path.basename(folderPath),
      type: 'folder',
      path: folderPath,
    });

    // Scan and index files
    await this.scanFolder(id, source.id, folderPath);

    await this.updateStatus(id, 'ready');

    // Register workspace for heartbeat monitoring
    this.heartbeatService.registerWorkspace(id, async () => {
      const snapshots: FileSnapshot[] = [];
      await this.collectFileSnapshots(folderPath, snapshots);
      return snapshots;
    });

    return { success: true, sourceId: source.id };
  }

  private async collectFileSnapshots(
    dir: string,
    result: FileSnapshot[],
    relativePath = '',
  ): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.name.startsWith('.') ||
        [
          'node_modules',
          '.git',
          'dist',
          'build',
          '.next',
          '.venv',
          '__pycache__',
          '.idea',
          '.vscode',
          'coverage',
          '.cache',
        ].includes(entry.name)
      ) {
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      const relPath = relativePath
        ? `${relativePath}/${entry.name}`
        : entry.name;
      if (entry.isDirectory()) {
        await this.collectFileSnapshots(fullPath, result, relPath);
      } else if (entry.isFile()) {
        try {
          const stats = await fs.stat(fullPath);
          result.push({
            path: relPath,
            sizeBytes: stats.size,
            lastModified: stats.mtimeMs,
          });
        } catch {
          // skip unreadable
        }
      }
    }
  }

  private async scanFolder(
    workspaceId: string,
    sourceId: string,
    folderPath: string,
  ) {
    const supportedExtensions = [
      '.txt',
      '.md',
      '.csv',
      '.pdf',
      '.docx',
      '.xlsx',
      '.xls',
      '.json',
      '.html',
      '.xml',
    ];

    const scanDir = async (dir: string, relativePath = '') => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (
          entry.name.startsWith('.') ||
          [
            'node_modules',
            '.git',
            'dist',
            'build',
            '.next',
            '.venv',
            '__pycache__',
            '.idea',
            '.vscode',
            'coverage',
            '.cache',
          ].includes(entry.name)
        ) {
          continue;
        }

        const fullPath = path.join(dir, entry.name);
        const relPath = relativePath
          ? `${relativePath}/${entry.name}`
          : entry.name;

        if (entry.isDirectory()) {
          await scanDir(fullPath, relPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (!supportedExtensions.includes(ext)) continue;

          try {
            const stats = await fs.stat(fullPath);
            if (stats.size > 50 * 1024 * 1024) continue; // Skip files > 50MB

            await this.fileService.createFile({
              sourceId,
              name: relPath,
              path: fullPath,
              type: ext.replace('.', ''),
              size: stats.size,
              mimeType:
                this.storageService['mimeTypes'][ext] ||
                'application/octet-stream',
            });
          } catch (err) {
            // Skip unreadable files
            console.warn(`Failed to index file ${fullPath}:`, err);
          }
        }
      }
    };

    await scanDir(folderPath);
  }
}
