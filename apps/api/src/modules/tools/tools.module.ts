import { Module } from '@nestjs/common';
import { ToolsProviderModule } from './tools-provider.module.js';
import { ToolRegistryService } from './tool-registry.service.js';
import { KnowledgeModule } from '../knowledge/knowledge.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { SearchModule } from '../search/search.module.js';
import { FileModule } from '../file/file.module.js';
import { SkillsModule } from '../skills/skills.module.js';
import { MemoryModule } from '../memory/memory.module.js';
import { ProgrammaticVerifierService } from './services/programmatic-verifier.service.js';

/**
 * ToolsModule — module boundary for tool system.
 *
 * Imports ToolsProviderModule which handles self-registration
 * of all tools. This module re-exports ToolRegistryService
 * for other modules to consume.
 */
@Module({
  imports: [
    KnowledgeModule,
    StorageModule,
    SearchModule,
    FileModule,
    SkillsModule,
    MemoryModule,
    ToolsProviderModule,
  ],
  providers: [ProgrammaticVerifierService],
  exports: [ToolsProviderModule, ProgrammaticVerifierService],
})
export class ToolsModule {}
