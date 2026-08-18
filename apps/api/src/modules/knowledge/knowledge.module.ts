import { Module } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller.js';
import { KnowledgeService } from './knowledge.service.js';
import { KnowledgeRepository } from './knowledge.repository.js';
import { KnowledgeCrawlerService } from './services/knowledge-crawler.service.js';
import { PrismaModule } from '../../common/providers/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, KnowledgeRepository, KnowledgeCrawlerService],
  exports: [KnowledgeService, KnowledgeRepository, KnowledgeCrawlerService],
})
export class KnowledgeModule {}

