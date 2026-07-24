import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/providers/prisma.module';
import { SearchService } from './search.service';
import { MetadataSearchProvider } from './providers/metadata-search.provider';
import { FtsSearchProvider } from './providers/fts-search.provider';

@Module({
  imports: [PrismaModule],
  providers: [SearchService, MetadataSearchProvider, FtsSearchProvider],
  exports: [SearchService],
})
export class SearchModule {}
