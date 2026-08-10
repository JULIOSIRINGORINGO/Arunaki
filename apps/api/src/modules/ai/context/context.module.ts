import { Module, OnModuleInit } from '@nestjs/common';
import { ContextRegistry } from './context-registry.service.js';
import { LegacyContextEngine } from './legacy-context-engine.service.js';
import { ProjectionAssembler } from './projection-assembler.service.js';
import { ContextQuarantine } from './context-quarantine.service.js';

@Module({
  providers: [
    ContextRegistry,
    LegacyContextEngine,
    ProjectionAssembler,
    ContextQuarantine,
  ],
  exports: [
    ContextRegistry,
    LegacyContextEngine,
    ProjectionAssembler,
    ContextQuarantine,
  ],
})
export class ContextModule implements OnModuleInit {
  constructor(
    private readonly registry: ContextRegistry,
    private readonly legacy: LegacyContextEngine,
  ) {}

  onModuleInit() {
    if (this.registry && typeof this.registry.register === 'function' && this.legacy) {
      this.registry.register(this.legacy);
    }
  }
}