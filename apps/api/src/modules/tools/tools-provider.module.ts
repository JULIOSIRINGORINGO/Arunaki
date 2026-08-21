import {
  Module,
  OnModuleInit,
  Inject,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ParserModule } from '../parser/parser.module.js';
import { KnowledgeModule } from '../knowledge/knowledge.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { SearchModule } from '../search/search.module.js';
import { FileModule } from '../file/file.module.js';
import { SkillsModule } from '../skills/skills.module.js';
import { MemoryModule } from '../memory/memory.module.js';
import { ToolRegistryService } from './tool-registry.service.js';
import { AskUserTool } from './services/ask-user.tool.js';
import { TextExtractorTool } from './services/text-extractor.tool.js';
import { DocumentGeneratorTool } from './services/document-generator.tool.js';
import { DocumentReaderTool } from './services/document-reader.tool.js';
import { DocumentConverterTool } from './services/document-converter.tool.js';
import { DataQueryTool } from './services/data-query.tool.js';
import { ImageOcrTool } from './services/image-ocr.tool.js';
import { DocSearchTool } from './services/doc-search.tool.js';

import { WebSearchTool } from './services/web-search.tool.js';
import { VisionAiTool } from './services/vision-ai.tool.js';
import { UnitConverterTool } from './services/unit-converter.tool.js';
import { DraftCommunicationTool } from './services/draft-communication.tool.js';
import { WorkspaceToolsService } from './services/workspace-tools.service.js';
import { EditToolService } from './services/edit-tool.service.js';
import { WriteToolService } from './services/write-tool.service.js';
import { ReadToolService } from './services/read-tool.service.js';
import { DeleteToolService } from './services/delete-tool.service.js';
import { RenameToolService } from './services/rename-tool.service.js';
import { ListToolService } from './services/list-tool.service.js';
import { SearchToolService } from './services/search-tool.service.js';
import { SkillsTool } from './services/skills.tool.js';
import { MemoryTool } from './services/memory.tool.js';
import { DocumentReconciliationService } from '../document/doc-reconciliation.service.js';
import { CronService } from '../cron/cron.service.js';
import { CronModule } from '../cron/cron.module.js';
import { ProgrammaticVerifierService } from './services/programmatic-verifier.service.js';
import { TodoStoreService } from './services/todo-store.service.js';
import { PtcExecutorService } from './services/ptc-executor.service.js';
import { MultiDocOrchestratorService } from './services/multi-doc-orchestrator.service.js';
import { SubAgentRunnerService } from '../chat/sub-agent-runner.service.js';
import { ContextQuarantine } from '../ai/context/context-quarantine.service.js';
import { PdfPagesTool } from './services/pdf-pages.tool.js';
import { DocCompareTool } from './services/doc-compare.tool.js';
import { DocRedactTool } from './services/doc-redact.tool.js';
import { AiModule } from '../ai/ai.module.js';

import { WorkspaceFileToolsRegistrar } from './services/registrars/workspace-file-tools.registrar.js';
import { BusinessDomainToolsRegistrar } from './services/registrars/business-domain-tools.registrar.js';
import { HarnessMetaToolsRegistrar } from './services/registrars/harness-meta-tools.registrar.js';
import { DesktopToolsRegistrar } from './services/registrars/desktop-tools.registrar.js';
import { DesktopBridgeService } from '../interaction/desktop-bridge.service.js';
import { ExcelComService } from '../interaction/excel-com.service.js';
import { ToolResultCacheService } from './services/tool-result-cache.service.js';

import { PrismaModule } from '../../common/providers/prisma.module.js';
import { ProviderModule } from '../provider/provider.module.js';
import { KnowledgeLiveFetchTool } from './services/knowledge-live-fetch.tool.js';
import { BrowserInteractionTool } from './services/browser-interaction.tool.js';
import { IpGeolocationTool } from './services/ip-geolocation.tool.js';
import { StockLookupTool } from './services/stock-lookup.tool.js';

@Module({
  imports: [
    PrismaModule,
    ProviderModule,
    ParserModule,
    KnowledgeModule,
    StorageModule,
    SearchModule,
    FileModule,
    SkillsModule,
    MemoryModule,
    forwardRef(() => AiModule),
    forwardRef(() => CronModule),
  ],
  providers: [
    ToolRegistryService,
    AskUserTool,
    TextExtractorTool,
    DocumentGeneratorTool,
    DocumentReaderTool,
    DocumentConverterTool,
    DataQueryTool,
    ImageOcrTool,
    DocSearchTool,
    KnowledgeLiveFetchTool,
    BrowserInteractionTool,
    IpGeolocationTool,
    StockLookupTool,
    WebSearchTool,
    VisionAiTool,
    UnitConverterTool,
    DraftCommunicationTool,
    WorkspaceToolsService,
    EditToolService,
    WriteToolService,
    ReadToolService,
    DeleteToolService,
    RenameToolService,
    ListToolService,
    SearchToolService,
    SkillsTool,
    MemoryTool,
    DocumentReconciliationService,
    ProgrammaticVerifierService,
    TodoStoreService,
    PtcExecutorService,
    MultiDocOrchestratorService,
    ToolResultCacheService,
    PdfPagesTool,
    DocCompareTool,
    DocRedactTool,
    WorkspaceFileToolsRegistrar,
    BusinessDomainToolsRegistrar,
    HarnessMetaToolsRegistrar,
    DesktopToolsRegistrar,
  ],
  exports: [
    ToolRegistryService,
    ToolResultCacheService,
    AskUserTool,
    TextExtractorTool,
    DocumentGeneratorTool,
    DocumentReaderTool,
    DocumentConverterTool,
    DataQueryTool,
    ImageOcrTool,
    DocSearchTool,
    KnowledgeLiveFetchTool,
    BrowserInteractionTool,
    IpGeolocationTool,
    StockLookupTool,
    WebSearchTool,
    VisionAiTool,
    UnitConverterTool,
    DraftCommunicationTool,
    WorkspaceToolsService,
    EditToolService,
    WriteToolService,
    ReadToolService,
    DeleteToolService,
    RenameToolService,
    ListToolService,
    SearchToolService,
    SkillsTool,
    MemoryTool,
    DocumentReconciliationService,
    ProgrammaticVerifierService,
    TodoStoreService,
    PtcExecutorService,
    MultiDocOrchestratorService,
    PdfPagesTool,
    DocCompareTool,
    DocRedactTool,
  ],
})
export class ToolsProviderModule implements OnModuleInit {
  constructor(
    @Inject(forwardRef(() => ToolRegistryService))
    private readonly registry: ToolRegistryService,
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
    @Inject(forwardRef(() => ContextQuarantine))
    private readonly contextQuarantine: ContextQuarantine,
    @Inject(forwardRef(() => WorkspaceFileToolsRegistrar))
    private readonly workspaceFileToolsRegistrar: WorkspaceFileToolsRegistrar,
    @Inject(forwardRef(() => BusinessDomainToolsRegistrar))
    private readonly businessDomainToolsRegistrar: BusinessDomainToolsRegistrar,
    @Inject(forwardRef(() => HarnessMetaToolsRegistrar))
    private readonly harnessMetaToolsRegistrar: HarnessMetaToolsRegistrar,
    @Inject(forwardRef(() => DesktopToolsRegistrar))
    private readonly desktopToolsRegistrar: DesktopToolsRegistrar,
    @Optional()
    @Inject(forwardRef(() => CronService))
    private readonly cronService?: CronService,
  ) {}

  onModuleInit() {
    this.registerTools();
  }

  private registerTools() {
    // 1. Register Workspace File Tools
    this.workspaceFileToolsRegistrar.register(this.registry, {
      workspaceToolsService: this.moduleRef.get(WorkspaceToolsService, {
        strict: false,
      }),
      readToolService: this.moduleRef.get(ReadToolService, { strict: false }),
      writeToolService: this.moduleRef.get(WriteToolService, { strict: false }),
      editToolService: this.moduleRef.get(EditToolService, { strict: false }),
      deleteToolService: this.moduleRef.get(DeleteToolService, {
        strict: false,
      }),
      renameToolService: this.moduleRef.get(RenameToolService, {
        strict: false,
      }),
      listToolService: this.moduleRef.get(ListToolService, { strict: false }),
      searchToolService: this.moduleRef.get(SearchToolService, {
        strict: false,
      }),
    });

    // 2. Register Business Domain Tools
    this.businessDomainToolsRegistrar.register(this.registry, {
      textExtractorTool: this.moduleRef.get(TextExtractorTool, {
        strict: false,
      }),
      documentGeneratorTool: this.moduleRef.get(DocumentGeneratorTool, {
        strict: false,
      }),
      documentReaderTool: this.moduleRef.get(DocumentReaderTool, {
        strict: false,
      }),
      documentConverterTool: this.moduleRef.get(DocumentConverterTool, {
        strict: false,
      }),
      dataQueryTool: this.moduleRef.get(DataQueryTool, { strict: false }),
      draftCommunicationTool: this.moduleRef.get(DraftCommunicationTool, {
        strict: false,
      }),
      unitConverterTool: this.moduleRef.get(UnitConverterTool, {
        strict: false,
      }),
      workspaceToolsService: this.moduleRef.get(WorkspaceToolsService, {
        strict: false,
      }),
      pdfPagesTool: this.moduleRef.get(PdfPagesTool, { strict: false }),
      docCompareTool: this.moduleRef.get(DocCompareTool, { strict: false }),
      docRedactTool: this.moduleRef.get(DocRedactTool, { strict: false }),
    });

    // 3. Register Harness Meta Tools (including PTC Batch Execute)
    this.harnessMetaToolsRegistrar.register(this.registry, {
      askUser: this.moduleRef.get(AskUserTool, { strict: false }),
      todoStore: this.moduleRef.get(TodoStoreService, { strict: false }),
      webSearchTool: this.moduleRef.get(WebSearchTool, { strict: false }),
      visionAiTool: this.moduleRef.get(VisionAiTool, { strict: false }),
      imageOcrTool: this.moduleRef.get(ImageOcrTool, { strict: false }),
      docSearchTool: this.moduleRef.get(DocSearchTool, { strict: false }),
      skillsTool: this.moduleRef.get(SkillsTool, { strict: false }),
      memoryTool: this.moduleRef.get(MemoryTool, { strict: false }),
      workspaceToolsService: this.moduleRef.get(WorkspaceToolsService, {
        strict: false,
      }),
      subAgentRunner: this.moduleRef.get(SubAgentRunnerService, {
        strict: false,
      }),
      ptcExecutor: this.moduleRef.get(PtcExecutorService, { strict: false }),
      multiDocOrchestrator: this.moduleRef.get(MultiDocOrchestratorService, {
        strict: false,
      }),
    });

    // 4. Register Desktop COM Automation Tools
    this.desktopToolsRegistrar.register(this.registry, {
      desktopBridge: this.moduleRef.get(DesktopBridgeService, {
        strict: false,
      }),
      excelCom: this.moduleRef.get(ExcelComService, { strict: false }),
      workspaceToolsService: this.moduleRef.get(WorkspaceToolsService, {
        strict: false,
      }),
    });

    // 5. Register Knowledge Tools
    const knowledgeLiveFetch = this.moduleRef.get(KnowledgeLiveFetchTool, {
      strict: false,
    });
    if (knowledgeLiveFetch) {
      this.registry.register(knowledgeLiveFetch);
    }

    // 6. Register General Browser Tool
    const browserInteraction = this.moduleRef.get(BrowserInteractionTool, {
      strict: false,
    });
    if (browserInteraction) {
      this.registry.register(browserInteraction);
    }

    // 7. Register IP Geolocation Tool
    const ipGeolocation = this.moduleRef.get(IpGeolocationTool, {
      strict: false,
    });
    if (ipGeolocation) {
      this.registry.register(ipGeolocation);
    }

    // 8. Register Stock Lookup Tool
    const stockLookup = this.moduleRef.get(StockLookupTool, { strict: false });
    if (stockLookup) {
      this.registry.register(stockLookup);
    }
  }
}
