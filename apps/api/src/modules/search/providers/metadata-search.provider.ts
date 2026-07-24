import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/providers/prisma.service';
import { SearchProvider, SearchOptions, SearchResult } from './search-provider.interface';

@Injectable()
export class MetadataSearchProvider implements SearchProvider {
  constructor(private readonly prisma: PrismaService) {}

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const { workspaceId, fileType, limit = 10, offset = 0 } = options;

    const where: any = {
      source: { workspaceId },
    };

    if (fileType) {
      where.type = fileType;
    }

    const files = await this.prisma.file.findMany({
      where,
      take: limit,
      skip: offset,
      include: { source: true },
    });

    return files.map((file) => ({
      fileId: file.id,
      fileName: file.name,
      filePath: file.path,
      fileType: file.type,
      score: 1.0,
      source: 'metadata' as const,
    }));
  }
}
