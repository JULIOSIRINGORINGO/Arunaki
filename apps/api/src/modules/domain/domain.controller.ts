import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { DomainRegistryService } from './domain.registry.service.js';

@Controller('domains')
export class DomainController {
  constructor(private readonly domainRegistry: DomainRegistryService) {}

  @Get()
  getAllDomains() {
    return {
      data: this.domainRegistry.listAll(),
      error: null,
      meta: { total: this.domainRegistry.listAll().length },
    };
  }

  @Get(':key')
  getDomainByKey(@Param('key') key: string) {
    const domain = this.domainRegistry.get(key);
    if (!domain) {
      throw new NotFoundException(`Domain config for key "${key}" not found.`);
    }
    return {
      data: domain,
      error: null,
    };
  }
}
