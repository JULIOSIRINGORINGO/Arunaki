import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface FileInfo {
  size: number;
  created: Date;
  modified: Date;
  accessed: Date;
  isFile: boolean;
  isDirectory: boolean;
  extension: string;
  mimeType: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  private readonly mimeTypes: Record<string, string> = {
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.csv': 'text/csv',
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.json': 'application/json',
    '.html': 'text/html',
    '.xml': 'application/xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
  };

  validatePath(filePath: string, workspacePath: string): void {
    const resolved = path.resolve(filePath);
    const resolvedWorkspace = path.resolve(workspacePath);

    if (!resolved.startsWith(resolvedWorkspace)) {
      throw new Error(`Path traversal detected: ${filePath} is outside workspace`);
    }
  }

  async readFile(filePath: string): Promise<string> {
    this.logger.log(`Reading file: ${filePath}`);
    return fs.readFile(filePath, 'utf-8');
  }

  async readBuffer(filePath: string): Promise<Buffer> {
    this.logger.log(`Reading buffer: ${filePath}`);
    return fs.readFile(filePath);
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    this.logger.log(`Writing file: ${filePath}`);
    await fs.writeFile(filePath, content, 'utf-8');
  }

  async writeBuffer(filePath: string, buffer: Buffer): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    this.logger.log(`Writing buffer: ${filePath}`);
    await fs.writeFile(filePath, buffer);
  }

  async getFileInfo(filePath: string): Promise<FileInfo> {
    const stats = await fs.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();

    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      accessed: stats.atime,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      extension: ext,
      mimeType: this.mimeTypes[ext] || 'application/octet-stream',
    };
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    this.logger.log(`Deleting file: ${filePath}`);
    await fs.unlink(filePath);
  }

  async ensureDir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  async listDir(dirPath: string): Promise<string[]> {
    const entries = await fs.readdir(dirPath);
    return entries;
  }
}
