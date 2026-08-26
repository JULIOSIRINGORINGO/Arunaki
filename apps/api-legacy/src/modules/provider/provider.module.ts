import { Module } from '@nestjs/common';
import { ProviderController } from './provider.controller.js';
import { ProviderService } from './provider.service.js';
import { ProviderRepository } from './provider.repository.js';
import { ProviderCatalogService } from './provider-catalog.service.js';
import { PrismaModule } from '../../common/providers/prisma.module.js';
import { SecretsVaultService } from '../security/secrets-vault.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [ProviderController],
  providers: [
    ProviderService,
    ProviderRepository,
    ProviderCatalogService,
    SecretsVaultService,
  ],
  exports: [ProviderService, ProviderRepository, ProviderCatalogService],
})
export class ProviderModule {}
