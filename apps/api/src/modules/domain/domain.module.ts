import { Module, Global } from '@nestjs/common';
import { DomainRegistryService } from './domain.registry.service.js';

/**
 * DomainModule — provides domain-specific configuration.
 *
 * Global module: available everywhere without importing.
 * Tools and services inject DomainRegistryService to read
 * domain configs (units, templates, terminology, etc.)
 */
@Global()
@Module({
  providers: [DomainRegistryService],
  exports: [DomainRegistryService],
})
export class DomainModule {}
