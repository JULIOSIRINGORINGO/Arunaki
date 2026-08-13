import { Injectable } from '@nestjs/common';
import { ToolRegistryService } from '../../tool-registry.service.js';
import { ToolAdapter } from '../tool-adapter.js';
import { TextExtractorTool } from '../text-extractor.tool.js';
import { DocumentGeneratorTool } from '../document-generator.tool.js';
import { DocumentReaderTool } from '../document-reader.tool.js';
import { DataQueryTool } from '../data-query.tool.js';
import { DraftCommunicationTool } from '../draft-communication.tool.js';
import { UnitConverterTool } from '../unit-converter.tool.js';
import { WorkspaceToolsService } from '../workspace-tools.service.js';

@Injectable()
export class BusinessDomainToolsRegistrar {
  register(
    registry: ToolRegistryService,
    services: {
      textExtractorTool: TextExtractorTool;
      documentGeneratorTool: DocumentGeneratorTool;
      documentReaderTool: DocumentReaderTool;
      dataQueryTool: DataQueryTool;
      draftCommunicationTool: DraftCommunicationTool;
      unitConverterTool: UnitConverterTool;
      workspaceToolsService: WorkspaceToolsService;
    },
  ) {
    registry.register(
      ToolAdapter.from({
        name: 'extract_structured_data',
        displayName: 'Extract Data',
        description: 'Validates and normalizes structured data from documents.',
        tags: ['extract', 'data', 'validate'],
        handler: (args) =>
          services.textExtractorTool.extractStructuredData({
            documentType: args.documentType,
            title: args.title,
            items: args.items,
            totals: args.totals,
            metadata: args.metadata,
          }),
        parameters: {
          type: 'object',
          properties: {
            documentType: { type: 'string' },
            title: { type: 'string' },
            items: { type: 'array' },
            totals: { type: 'object' },
            metadata: { type: 'object' },
          },
          required: ['items'],
        },
        timeoutMs: 5000,
      }),
    );

    registry.register(
      ToolAdapter.from({
        name: 'document_reader',
        displayName: 'Read Document',
        description: 'Reads document files and extracts raw text.',
        tags: ['read', 'document', 'file', 'pdf', 'docx', 'excel', 'csv'],
        handler: async (args) => {
          try {
            const safePath = await services.workspaceToolsService.resolveWithinWorkspace(
              args.workspaceId,
              args.filePath,
            );
            return await services.documentReaderTool.readDocument(safePath);
          } catch (err: any) {
            return {
              status: 'error',
              data: {},
              preview: `Access denied: ${err.message}`,
              metadata: { toolName: 'document_reader', displayName: 'Read Document', executionTime: 0 },
              error: { code: 'WORKSPACE_ISOLATION_VIOLATION', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string' },
            filePath: { type: 'string' },
          },
          required: ['workspaceId', 'filePath'],
        },
        timeoutMs: 10000,
      }),
    );

    registry.register(
      ToolAdapter.from({
        name: 'data_query',
        displayName: 'Query Database',
        description: 'Real-time database query. SELECT queries only.',
        tags: ['database', 'query', 'sql'],
        handler: async (args) => {
          if (args.action === 'list_tables') return services.dataQueryTool.listTables();
          if (args.action === 'describe_table' && args.tableName)
            return services.dataQueryTool.describeTable(args.tableName);
          return services.dataQueryTool.queryData(args.sql || '');
        },
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['query', 'list_tables', 'describe_table'] },
            sql: { type: 'string' },
            tableName: { type: 'string' },
          },
          required: ['action'],
        },
        timeoutMs: 10000,
      }),
    );

    registry.register(
      ToolAdapter.from({
        name: 'generate_export',
        displayName: 'Export Document',
        description: 'Converts structured data into Excel, CSV, PDF, Word, or PPTX.',
        tags: ['export', 'document', 'excel', 'pdf', 'word', 'powerpoint'],
        handler: async (args) => {
          const { format, filename, title, sheetName, data, content, slides, outputPath } = args;
          if (format === 'xlsx') return services.documentGeneratorTool.generateExcel(sheetName || 'Sheet1', data || [], filename, outputPath);
          if (format === 'csv') return services.documentGeneratorTool.generateCsv(data || [], filename, outputPath);
          if (format === 'pdf') return services.documentGeneratorTool.generatePdf(title || 'Dokumen', content || '', filename, outputPath);
          if (format === 'docx') return services.documentGeneratorTool.generateDocx(title || 'Dokumen', content || '', filename, outputPath);
          if (format === 'pptx') return services.documentGeneratorTool.generatePptx(title || 'Presentasi', slides || [], filename);
          return {
            status: 'error',
            data: {},
            preview: `Format ${format} tidak didukung.`,
            metadata: { toolName: 'generate_export', displayName: 'Dokumen Export', executionTime: 0 },
          };
        },
        parameters: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['xlsx', 'csv', 'pdf', 'docx', 'pptx'] },
            filename: { type: 'string' },
            title: { type: 'string' },
            sheetName: { type: 'string' },
            data: { type: 'array' },
            content: { type: 'string' },
            slides: { type: 'array' },
            outputPath: { type: 'string' },
          },
          required: ['format'],
        },
        timeoutMs: 30000,
      }),
    );

    registry.register(
      ToolAdapter.from({
        name: 'draft_communication',
        displayName: 'Draft Communication',
        description: 'Drafts emails, messages, letters, or contracts.',
        tags: ['draft', 'communication', 'email'],
        handler: (args) =>
          services.draftCommunicationTool.draft({
            type: args.type || 'email',
            recipientName: args.recipient || args.recipientName || '',
            topic: args.subject || args.topic || '',
            keyPoints: args.keyPoints || [],
          }),
        parameters: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            recipient: { type: 'string' },
            subject: { type: 'string' },
            context: { type: 'string' },
          },
          required: ['type', 'recipient', 'context'],
        },
        timeoutMs: 5000,
      }),
    );

    registry.register(
      ToolAdapter.from({
        name: 'unit_converter',
        displayName: 'Convert Units',
        description: 'Converts currency, length, weight, area, and volume units.',
        tags: ['convert', 'unit', 'currency'],
        handler: (args) =>
          services.unitConverterTool.convert({
            value: args.value,
            from: args.from,
            to: args.to,
            domain: args.domain,
          }),
        parameters: {
          type: 'object',
          properties: {
            from: { type: 'string' },
            to: { type: 'string' },
            value: { type: 'number' },
          },
          required: ['from', 'to', 'value'],
        },
        timeoutMs: 3000,
      }),
    );
  }
}
