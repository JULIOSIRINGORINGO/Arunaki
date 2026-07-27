import { Module, Global } from '@nestjs/common';
import { DomainRegistryService } from './domain.registry.service.js';
import { DomainController } from './domain.controller.js';

/**
 * DomainModule — provides domain-specific configuration.
 *
 * Global module: available everywhere without importing.
 * Tools and services inject DomainRegistryService to read
 * domain configs (units, templates, terminology, etc.)
 */
@Global()
@Module({
  controllers: [DomainController],
  providers: [DomainRegistryService],
  exports: [DomainRegistryService],
})
export class DomainModule {}
