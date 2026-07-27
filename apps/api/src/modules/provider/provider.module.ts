import { Module } from '@nestjs/common';
import { ProviderController } from './provider.controller.js';
import { ProviderService } from './provider.service.js';
import { ProviderRepository } from './provider.repository.js';
import { PrismaModule } from '../../common/providers/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [ProviderController],
  providers: [ProviderService, ProviderRepository],
  exports: [ProviderService, ProviderRepository],
})
export class ProviderModule {}
