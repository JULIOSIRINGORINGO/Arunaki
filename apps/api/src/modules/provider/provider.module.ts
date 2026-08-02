import { Module } from '@nestjs/common';
import { ProviderController } from './provider.controller.js';
import { ProviderService } from './provider.service.js';
import { ProviderRepository } from './provider.repository.js';
import { ProviderCatalogService } from './provider-catalog.service.js';
import { PrismaModule } from '../../common/providers/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [ProviderController],
  providers: [ProviderService, ProviderRepository, ProviderCatalogService],
  exports: [ProviderService, ProviderRepository, ProviderCatalogService],
})
export class ProviderModule {}
