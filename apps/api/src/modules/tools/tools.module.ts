import { Module } from '@nestjs/common';
import { ToolRegistryService } from './tool-registry.service.js';
import { TextExtractorTool } from './services/text-extractor.tool.js';
import { EnterpriseCalculatorTool } from './services/enterprise-calculator.tool.js';
import { DocumentGeneratorTool } from './services/document-generator.tool.js';
import { ArtifactStore } from './artifact-store.service.js';

@Module({
  providers: [
    ToolRegistryService,
    TextExtractorTool,
    EnterpriseCalculatorTool,
    DocumentGeneratorTool,
    ArtifactStore,
  ],
  exports: [
    ToolRegistryService,
    TextExtractorTool,
    EnterpriseCalculatorTool,
    DocumentGeneratorTool,
    ArtifactStore,
  ],
})
export class ToolsModule {}
