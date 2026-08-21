import { Injectable } from '@nestjs/common';
import { ToolRegistryService } from '../../tool-registry.service.js';
import { ToolAdapter } from '../tool-adapter.js';
import { TextExtractorTool } from '../text-extractor.tool.js';
import { DocumentGeneratorTool } from '../document-generator.tool.js';
import { DocumentReaderTool } from '../document-reader.tool.js';
import { DocumentConverterTool } from '../document-converter.tool.js';
import { DataQueryTool } from '../data-query.tool.js';
import { DraftCommunicationTool } from '../draft-communication.tool.js';
import { UnitConverterTool } from '../unit-converter.tool.js';
import { WorkspaceToolsService } from '../workspace-tools.service.js';
import { PdfPagesTool } from '../pdf-pages.tool.js';
import { DocCompareTool } from '../doc-compare.tool.js';
import { DocRedactTool } from '../doc-redact.tool.js';

@Injectable()
export class BusinessDomainToolsRegistrar {
  register(
    registry: ToolRegistryService,
    services: {
      textExtractorTool: TextExtractorTool;
      documentGeneratorTool: DocumentGeneratorTool;
      documentReaderTool: DocumentReaderTool;
      documentConverterTool: DocumentConverterTool;
      dataQueryTool: DataQueryTool;
      draftCommunicationTool: DraftCommunicationTool;
      unitConverterTool: UnitConverterTool;
      workspaceToolsService: WorkspaceToolsService;
      pdfPagesTool: PdfPagesTool;
      docCompareTool: DocCompareTool;
      docRedactTool: DocRedactTool;
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
        description:
          'Reads document files (.xlsx, .xlsm, .docx, .pdf, .csv) and extracts structured text. For Excel spreadsheets, reads the target or current month sheet and lists available sheet names.',
        tags: [
          'read',
          'document',
          'file',
          'pdf',
          'docx',
          'excel',
          'xlsx',
          'xlsm',
          'csv',
        ],
        handler: async (args) => {
          try {
            const rawPath =
              args.filePath || args.path || args.filename || args.file;
            const safePath =
              await services.workspaceToolsService.resolveWithinWorkspace(
                args.workspaceId,
                rawPath,
              );
            return await services.documentReaderTool.readDocument(
              safePath,
              args.sheetName,
            );
          } catch (err: any) {
            return {
              status: 'error',
              data: {},
              preview: `Access denied: ${err.message}`,
              metadata: {
                toolName: 'document_reader',
                displayName: 'Read Document',
                executionTime: 0,
              },
              error: {
                code: 'WORKSPACE_ISOLATION_VIOLATION',
                message: err.message,
              },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string' },
            filePath: {
              type: 'string',
              description: 'Path to document file within workspace',
            },
            sheetName: {
              type: 'string',
              description:
                'Target worksheet name (optional, e.g. "AGUSTUS"). If omitted, auto-selects current month or active sheet.',
            },
          },
          required: ['filePath'],
        },
        timeoutMs: 15000,
      }),
    );

    registry.register(
      ToolAdapter.from({
        name: 'data_query',
        displayName: 'Query Database',
        description: 'Real-time database query. SELECT queries only.',
        tags: ['database', 'query', 'sql'],
        handler: async (args) => {
          if (args.action === 'list_tables')
            return services.dataQueryTool.listTables();
          if (args.action === 'describe_table' && args.tableName)
            return services.dataQueryTool.describeTable(args.tableName);
          return services.dataQueryTool.queryData(args.sql || '');
        },
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['query', 'list_tables', 'describe_table'],
            },
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
        description:
          'Converts structured data into Excel, CSV, PDF, Word, or PPTX.',
        tags: [
          'export',
          'document',
          'excel',
          'pdf',
          'word',
          'powerpoint',
          'docx',
        ],
        mutating: true,
        handler: async (args) => {
          const {
            format,
            filename,
            title,
            sheetName,
            data,
            content,
            slides,
            outputPath,
          } = args;
          let safePath: string | undefined;
          const targetName = filename || outputPath || `document.${format}`;
          if (args.workspaceId) {
            try {
              safePath =
                await services.workspaceToolsService.resolveWithinWorkspace(
                  args.workspaceId,
                  targetName,
                );
            } catch {
              safePath = targetName;
            }
          } else {
            safePath = targetName;
          }

          if (format === 'xlsx')
            return services.documentGeneratorTool.generateExcel(
              sheetName || 'Sheet1',
              data || [],
              targetName,
              safePath,
            );
          if (format === 'csv')
            return services.documentGeneratorTool.generateCsv(
              data || [],
              targetName,
              safePath,
            );
          if (format === 'pdf')
            return services.documentGeneratorTool.generatePdf(
              title || 'Document',
              content || '',
              targetName,
              safePath,
            );
          if (format === 'docx')
            return services.documentGeneratorTool.generateDocx(
              title || 'Document',
              content || '',
              targetName,
              safePath,
            );
          if (format === 'pptx')
            return services.documentGeneratorTool.generatePptx(
              title || 'Presentation',
              slides || [],
              targetName,
            );
          return {
            status: 'error',
            data: {},
            preview: `Format "${format}" is not supported.`,
            metadata: {
              toolName: 'generate_export',
              displayName: 'Export Document',
              executionTime: 0,
            },
          };
        },
        parameters: {
          type: 'object',
          properties: {
            format: {
              type: 'string',
              enum: ['xlsx', 'csv', 'pdf', 'docx', 'pptx'],
            },
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
        name: 'convert_document',
        displayName: 'Convert Document',
        description:
          'Converts existing documents in the workspace between formats (e.g. Word to PDF, Excel to PDF/CSV, Text to PDF/Word).',
        tags: ['convert', 'document', 'pdf', 'docx', 'excel', 'csv', 'export'],
        mutating: true,
        handler: async (args) => {
          try {
            const safeSourcePath =
              await services.workspaceToolsService.resolveWithinWorkspace(
                args.workspaceId,
                args.sourcePath || args.filePath || args.filename,
              );
            let safeOutputPath: string | undefined;
            if (args.outputPath || args.targetFilename) {
              safeOutputPath =
                await services.workspaceToolsService.resolveWithinWorkspace(
                  args.workspaceId,
                  args.outputPath || args.targetFilename,
                );
            }
            return await services.documentConverterTool.convertDocument({
              sourcePath: safeSourcePath,
              targetFormat: args.targetFormat || 'pdf',
              outputPath: safeOutputPath,
            });
          } catch (err: any) {
            return {
              status: 'error',
              data: {},
              preview: `Document conversion failed: ${err.message}`,
              metadata: {
                toolName: 'convert_document',
                displayName: 'Convert Document',
                executionTime: 0,
              },
              error: { code: 'CONVERSION_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            sourcePath: {
              type: 'string',
              description:
                'Source file name or path in workspace (e.g. invoice.docx)',
            },
            targetFormat: {
              type: 'string',
              enum: ['pdf', 'docx', 'xlsx', 'csv', 'txt'],
              description: 'Desired target format (e.g. pdf)',
            },
            outputPath: {
              type: 'string',
              description:
                'Optional custom output file name or path (e.g. invoice.pdf)',
            },
          },
          required: ['sourcePath', 'targetFormat'],
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
        description:
          'Converts currency, length, weight, area, and volume units.',
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

    // --- Enterprise Document Operations Suite (Phase 50) ---

    registry.register(
      ToolAdapter.from({
        name: 'pdf_manage_pages',
        displayName: 'Manage PDF Pages',
        description:
          'Manages PDF pages: merge multiple PDFs into one, extract specific pages, or apply diagonal text watermark (DRAFT, CONFIDENTIAL, LUNAS, etc.).',
        tags: ['pdf', 'merge', 'split', 'watermark', 'document', 'pages'],
        mutating: true,
        handler: async (args) => {
          try {
            const action = args.action || 'merge';

            if (action === 'merge') {
              const filePaths: string[] = [];
              for (const fp of args.files || []) {
                const safePath =
                  await services.workspaceToolsService.resolveWithinWorkspace(
                    args.workspaceId,
                    fp,
                  );
                filePaths.push(safePath);
              }
              const safeOutput =
                await services.workspaceToolsService.resolveWithinWorkspace(
                  args.workspaceId,
                  args.outputPath || 'merged.pdf',
                );
              return services.pdfPagesTool.merge(filePaths, safeOutput);
            }

            if (action === 'extract' || action === 'split') {
              const safeSrc =
                await services.workspaceToolsService.resolveWithinWorkspace(
                  args.workspaceId,
                  args.sourcePath || args.filePath,
                );
              const safeOutput =
                await services.workspaceToolsService.resolveWithinWorkspace(
                  args.workspaceId,
                  args.outputPath || 'extracted.pdf',
                );
              return services.pdfPagesTool.extractPages(
                safeSrc,
                args.pages || [],
                safeOutput,
              );
            }

            if (action === 'watermark') {
              const safeSrc =
                await services.workspaceToolsService.resolveWithinWorkspace(
                  args.workspaceId,
                  args.sourcePath || args.filePath,
                );
              const safeOutput =
                await services.workspaceToolsService.resolveWithinWorkspace(
                  args.workspaceId,
                  args.outputPath || args.sourcePath || 'watermarked.pdf',
                );
              return services.pdfPagesTool.watermark(
                safeSrc,
                args.text || 'DRAFT',
                safeOutput,
                {
                  opacity: args.opacity,
                  fontSize: args.fontSize,
                  color: args.color,
                  pages: args.pages,
                },
              );
            }

            return {
              status: 'error' as const,
              data: {},
              preview: `Unknown action "${action}". Use: merge, extract, watermark.`,
              metadata: {
                toolName: 'pdf_manage_pages',
                displayName: 'Manage PDF Pages',
                executionTime: 0,
              },
            };
          } catch (err: any) {
            return {
              status: 'error' as const,
              data: {},
              preview: `PDF operation failed: ${err.message}`,
              metadata: {
                toolName: 'pdf_manage_pages',
                displayName: 'Manage PDF Pages',
                executionTime: 0,
              },
              error: { code: 'PDF_OP_FAILED', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['merge', 'extract', 'split', 'watermark'],
              description: 'Operation to perform',
            },
            files: {
              type: 'array',
              description:
                'Array of PDF file paths to merge (for merge action)',
            },
            sourcePath: {
              type: 'string',
              description: 'Source PDF path (for extract/watermark)',
            },
            outputPath: {
              type: 'string',
              description: 'Output file path',
            },
            pages: {
              type: 'array',
              description:
                'Page numbers to extract (1-based) or watermark',
            },
            text: {
              type: 'string',
              description:
                'Watermark text (e.g. "DRAFT", "CONFIDENTIAL", "LUNAS")',
            },
            opacity: {
              type: 'number',
              description: 'Watermark opacity (0.0-1.0, default 0.15)',
            },
            fontSize: {
              type: 'number',
              description: 'Watermark font size (default 60)',
            },
          },
          required: ['action'],
        },
        timeoutMs: 30000,
      }),
    );

    registry.register(
      ToolAdapter.from({
        name: 'doc_compare_versions',
        displayName: 'Compare Document Versions',
        description:
          'Compares two document texts line-by-line and produces a structured diff report with similarity percentage, added/removed counts, and Markdown redline table.',
        tags: [
          'compare',
          'diff',
          'version',
          'document',
          'redline',
          'audit',
        ],
        handler: (args) =>
          services.docCompareTool.compare(
            args.sourceText || '',
            args.targetText || '',
            args.sourceName || 'Document A',
            args.targetName || 'Document B',
          ),
        parameters: {
          type: 'object',
          properties: {
            sourceText: {
              type: 'string',
              description: 'Full text content of the first (source) document',
            },
            targetText: {
              type: 'string',
              description:
                'Full text content of the second (target) document',
            },
            sourceName: {
              type: 'string',
              description: 'Display name for source document',
            },
            targetName: {
              type: 'string',
              description: 'Display name for target document',
            },
          },
          required: ['sourceText', 'targetText'],
        },
        timeoutMs: 15000,
      }),
    );

    registry.register(
      ToolAdapter.from({
        name: 'doc_redact_pii',
        displayName: 'Redact PII Data',
        description:
          'Scans document text for Indonesian PII (NIK/KTP, NPWP, phone numbers, email, bank accounts, credit cards) and returns a redacted version with detection report. Use action "scan" for detection-only without modification.',
        tags: [
          'redact',
          'pii',
          'privacy',
          'security',
          'compliance',
          'nik',
          'npwp',
        ],
        handler: (args) => {
          if (args.action === 'scan') {
            return services.docRedactTool.scan(args.text || '');
          }
          return services.docRedactTool.redact(args.text || '', {
            patterns: args.patterns,
            customMask: args.customMask,
          });
        },
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['redact', 'scan'],
              description:
                'Action: "redact" masks PII in text, "scan" detects without modifying',
            },
            text: {
              type: 'string',
              description: 'Document text to scan/redact',
            },
            patterns: {
              type: 'array',
              description:
                'Optional specific PII patterns to check: nik_ktp, npwp, email, phone_id, credit_card, bank_account',
            },
            customMask: {
              type: 'string',
              description:
                'Optional custom replacement mask string (default: pattern-specific)',
            },
          },
          required: ['text'],
        },
        timeoutMs: 10000,
      }),
    );
  }
}
