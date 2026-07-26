import { Module } from '@nestjs/common';
import { ToolRegistryService } from './tool-registry.service.js';
import { TextExtractorTool } from './services/text-extractor.tool.js';
import { EnterpriseCalculatorTool } from './services/enterprise-calculator.tool.js';
import { DocumentGeneratorTool } from './services/document-generator.tool.js';
import { DocumentReaderTool } from './services/document-reader.tool.js';
import { DataQueryTool } from './services/data-query.tool.js';
import { ImageOcrTool } from './services/image-ocr.tool.js';
import { DocSearchTool } from './services/doc-search.tool.js';
import { KnowledgeBuilderTool } from './services/knowledge-builder.tool.js';
import { WebSearchTool } from './services/web-search.tool.js';
import { VisionAiTool } from './services/vision-ai.tool.js';
import { UnitConverterTool } from './services/unit-converter.tool.js';
import { DraftCommunicationTool } from './services/draft-communication.tool.js';
import { WorkspaceToolsService } from './services/workspace-tools.service.js';
import { KnowledgeModule } from '../knowledge/knowledge.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { SearchModule } from '../search/search.module.js';
import { FileModule } from '../file/file.module.js';

@Module({
  imports: [KnowledgeModule, StorageModule, SearchModule, FileModule],
  providers: [
    ToolRegistryService,
    TextExtractorTool,
    EnterpriseCalculatorTool,
    DocumentGeneratorTool,
    DocumentReaderTool,
    DataQueryTool,
    ImageOcrTool,
    DocSearchTool,
    KnowledgeBuilderTool,
    WebSearchTool,
    VisionAiTool,
    UnitConverterTool,
    DraftCommunicationTool,
    WorkspaceToolsService,
  ],
  exports: [
    ToolRegistryService,
    TextExtractorTool,
    EnterpriseCalculatorTool,
    DocumentGeneratorTool,
    DocumentReaderTool,
    DataQueryTool,
    ImageOcrTool,
    DocSearchTool,
    KnowledgeBuilderTool,
    WebSearchTool,
    VisionAiTool,
    UnitConverterTool,
    DraftCommunicationTool,
    WorkspaceToolsService,
  ],
})
export class ToolsModule {}
