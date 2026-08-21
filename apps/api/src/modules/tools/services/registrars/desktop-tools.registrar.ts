import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ToolRegistryService } from '../../tool-registry.service.js';
import { ToolAdapter } from '../tool-adapter.js';
import { DesktopBridgeService } from '../../../interaction/desktop-bridge.service.js';
import { ExcelComService } from '../../../interaction/excel-com.service.js';
import { WordComService } from '../../../interaction/word-com.service.js';
import { PptComService } from '../../../interaction/ppt-com.service.js';
import { WorkspaceToolsService } from '../workspace-tools.service.js';

@Injectable()
export class DesktopToolsRegistrar {
  register(
    registry: ToolRegistryService,
    services: {
      desktopBridge: DesktopBridgeService;
      excelCom: ExcelComService;
      wordCom: WordComService;
      pptCom: PptComService;
      workspaceToolsService: WorkspaceToolsService;
    },
  ) {
    // 1. desktop_open_file
    registry.register(
      ToolAdapter.from({
        name: 'desktop_open_file',
        displayName: 'Open File on Desktop',
        description:
          'Opens a document file inside the workspace using the default desktop OS application.',
        tags: ['desktop', 'open', 'file'],
        handler: async (args) => {
          try {
            const safePath =
              await services.workspaceToolsService.resolveWithinWorkspace(
                args.workspaceId,
                args.filePath || args.path,
              );
            const res = await services.desktopBridge.sendCommand('openFile', {
              path: safePath,
            });
            return {
              status: 'success',
              data: res,
              preview: `Opened ${path.basename(safePath)} on desktop`,
              metadata: {
                toolName: 'desktop_open_file',
                displayName: 'Open File',
                executionTime: 0,
              },
            };
          } catch (err: any) {
            return {
              status: 'error',
              data: {},
              preview: `Open file failed: ${err.message}`,
              metadata: {
                toolName: 'desktop_open_file',
                displayName: 'Open File',
                executionTime: 0,
              },
              error: { code: 'DESKTOP_OPEN_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string' },
            filePath: {
              type: 'string',
              description: 'Path to file within workspace',
            },
          },
          required: ['filePath'],
        },
        timeoutMs: 15000,
      }),
    );

    // 2. desktop_open_excel
    registry.register(
      ToolAdapter.from({
        name: 'desktop_open_excel',
        displayName: 'Open Excel File',
        description:
          'Opens an Excel spreadsheet (.xlsx/.xls/.csv) via desktop application.',
        tags: ['desktop', 'excel', 'open'],
        handler: async (args) => {
          try {
            const safePath =
              await services.workspaceToolsService.resolveWithinWorkspace(
                args.workspaceId,
                args.filePath || args.path,
              );
            const res = await services.desktopBridge.sendCommand('openExcel', {
              path: safePath,
            });
            return {
              status: 'success',
              data: res,
              preview: `Opened Excel spreadsheet: ${path.basename(safePath)}`,
              metadata: {
                toolName: 'desktop_open_excel',
                displayName: 'Open Excel',
                executionTime: 0,
              },
            };
          } catch (err: any) {
            return {
              status: 'error',
              data: {},
              preview: `Open Excel failed: ${err.message}`,
              metadata: {
                toolName: 'desktop_open_excel',
                displayName: 'Open Excel',
                executionTime: 0,
              },
              error: { code: 'DESKTOP_OPEN_EXCEL_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string' },
            filePath: {
              type: 'string',
              description: 'Path to Excel file within workspace',
            },
          },
          required: ['filePath'],
        },
        timeoutMs: 20000,
      }),
    );

    // 3. desktop_open_word
    registry.register(
      ToolAdapter.from({
        name: 'desktop_open_word',
        displayName: 'Open Word Document',
        description:
          'Opens a Word document (.docx/.doc) via desktop application.',
        tags: ['desktop', 'word', 'open'],
        handler: async (args) => {
          try {
            const safePath =
              await services.workspaceToolsService.resolveWithinWorkspace(
                args.workspaceId,
                args.filePath || args.path,
              );
            const res = await services.desktopBridge.sendCommand('openWord', {
              path: safePath,
            });
            return {
              status: 'success',
              data: res,
              preview: `Opened Word document: ${path.basename(safePath)}`,
              metadata: {
                toolName: 'desktop_open_word',
                displayName: 'Open Word',
                executionTime: 0,
              },
            };
          } catch (err: any) {
            return {
              status: 'error',
              data: {},
              preview: `Open Word failed: ${err.message}`,
              metadata: {
                toolName: 'desktop_open_word',
                displayName: 'Open Word',
                executionTime: 0,
              },
              error: { code: 'DESKTOP_OPEN_WORD_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string' },
            filePath: {
              type: 'string',
              description: 'Path to Word file within workspace',
            },
          },
          required: ['filePath'],
        },
        timeoutMs: 20000,
      }),
    );

    // 4. desktop_open_ppt
    registry.register(
      ToolAdapter.from({
        name: 'desktop_open_ppt',
        displayName: 'Open PowerPoint Presentation',
        description:
          'Opens a PowerPoint presentation (.pptx/.ppt) via desktop application.',
        tags: ['desktop', 'ppt', 'powerpoint', 'open'],
        handler: async (args) => {
          try {
            const safePath =
              await services.workspaceToolsService.resolveWithinWorkspace(
                args.workspaceId,
                args.filePath || args.path,
              );
            const res = await services.desktopBridge.sendCommand('openPpt', {
              path: safePath,
            });
            return {
              status: 'success',
              data: res,
              preview: `Opened PowerPoint presentation: ${path.basename(safePath)}`,
              metadata: {
                toolName: 'desktop_open_ppt',
                displayName: 'Open PowerPoint',
                executionTime: 0,
              },
            };
          } catch (err: any) {
            return {
              status: 'error',
              data: {},
              preview: `Open PowerPoint failed: ${err.message}`,
              metadata: {
                toolName: 'desktop_open_ppt',
                displayName: 'Open PowerPoint',
                executionTime: 0,
              },
              error: { code: 'DESKTOP_OPEN_PPT_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string' },
            filePath: {
              type: 'string',
              description: 'Path to PPT file within workspace',
            },
          },
          required: ['filePath'],
        },
        timeoutMs: 20000,
      }),
    );

    // 5. desktop_excel_edit
    registry.register(
      ToolAdapter.from({
        name: 'desktop_excel_edit',
        displayName: 'Edit Excel Spreadsheet',
        description:
          'Performs precise cell edits and worksheet modifications on Excel (.xlsx / .xlsm / .xls) files via Native COM automation. Supports: write_cell, insert_row, delete_row, set_format, clone_sheet, clear_constants, rename_sheet, delete_sheet, list_sheets, and save. To target a specific sheet (e.g. "AGUSTUS"), provide sheetName.',
        tags: [
          'desktop',
          'excel',
          'edit',
          'com',
          'cells',
          'xlsx',
          'xlsm',
          'spreadsheet',
          'sheet',
          'clone',
        ],
        mutating: true,
        handler: async (args) => {
          try {
            let safePath: string | undefined;
            if (args.filePath || args.path || args.filename) {
              safePath =
                await services.workspaceToolsService.resolveWithinWorkspace(
                  args.workspaceId,
                  args.filePath || args.path || args.filename,
                );
            }
            let actions: any[] = [];
            if (Array.isArray(args.actions) && args.actions.length > 0) {
              actions = args.actions;
            } else if (
              args.cell ||
              args.value !== undefined ||
              args.action ||
              args.sourceSheet ||
              args.newSheetName ||
              args.range ||
              args.row !== undefined ||
              args.column !== undefined
            ) {
              actions = [
                {
                  action: args.action || 'write_cell',
                  cell: args.cell,
                  value: args.value,
                  sourceSheet: args.sourceSheet,
                  newSheetName: args.newSheetName,
                  clearConstants: args.clearConstants,
                  range: args.range,
                  row: args.row,
                  column: args.column,
                  bold: args.bold,
                  italic: args.italic,
                  fontSize: args.fontSize,
                  bgColor: args.bgColor,
                  alignment: args.alignment,
                },
              ];
            }

            // Always use backend COM automation (headless, Visible=false)
            if (!safePath) {
              throw new Error(
                'filePath is required to edit Excel spreadsheet.',
              );
            }
            if (!services.excelCom.isAvailable) {
              throw new Error(
                'Excel COM automation not available — only available on Windows OS.',
              );
            }

            const res = await services.excelCom.editExcel(
              safePath,
              actions,
              args.sheetName,
            );
            return {
              status: 'success',
              data: res,
              preview: `Executed ${actions.length} Excel COM action(s) on ${path.basename(safePath)}${args.sheetName ? ` [Sheet: ${args.sheetName}]` : ''}`,
              metadata: {
                toolName: 'desktop_excel_edit',
                displayName: 'Edit Excel via COM',
                executionTime: 0,
              },
            };
          } catch (err: any) {
            return {
              status: 'error',
              data: {},
              preview: `Excel edit failed: ${err.message}`,
              metadata: {
                toolName: 'desktop_excel_edit',
                displayName: 'Edit Excel',
                executionTime: 0,
              },
              error: { code: 'DESKTOP_EXCEL_EDIT_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string' },
            filePath: {
              type: 'string',
              description: 'Path to .xlsx / .xlsm file within workspace',
            },
            sheetName: {
              type: 'string',
              description: 'Target worksheet name (e.g. "AGUSTUS")',
            },
            actions: {
              type: 'array',
              description:
                'Array of actions: [{ action: "write_cell", cell: "V4", value: 1175 }, { action: "clone_sheet", sourceSheet: "TEMPLATE", newSheetName: "SEPTEMBER" }]',
            },
            action: {
              type: 'string',
              enum: [
                'write_cell',
                'insert_row',
                'delete_row',
                'insert_column',
                'delete_column',
                'set_format',
                'clone_sheet',
                'clear_constants',
                'rename_sheet',
                'delete_sheet',
                'list_sheets',
                'save',
              ],
              description: 'Single action type',
            },
            cell: {
              type: 'string',
              description: 'Target cell coordinate (e.g. "V4")',
            },
            value: { description: 'Cell value (number, text, or boolean)' },
            sourceSheet: {
              type: 'string',
              description: 'Source sheet name for clone_sheet or rename_sheet',
            },
            newSheetName: {
              type: 'string',
              description: 'New sheet name for clone_sheet or rename_sheet',
            },
            clearConstants: {
              type: 'boolean',
              description:
                'Whether to clear constant values while preserving formulas when cloning (default true)',
            },
            range: {
              type: 'string',
              description: 'Cell range for format/clear (e.g. "A1:D10")',
            },
            row: { type: 'number', description: 'Row index for row ops' },
            column: {
              type: 'number',
              description: 'Column index for column ops',
            },
          },
          required: ['filePath'],
        },
        timeoutMs: 35000,
      }),
    );

    // 6. desktop_word_type
    registry.register(
      ToolAdapter.from({
        name: 'desktop_word_type',
        displayName: 'Type in Word Document',
        description:
          'Types text into the active Microsoft Word document window via COM automation.',
        tags: ['desktop', 'word', 'type', 'com', 'text'],
        mutating: true,
        handler: async (args) => {
          try {
            const res = await services.desktopBridge.wordType(
              args.text || '',
              args.addNewline ?? true,
              args.smoothStream ?? false,
              args.delayMs ?? 25,
            );
            return {
              status: 'success',
              data: res,
              preview: `Typed ${args.text?.length || 0} characters in Word document`,
              metadata: {
                toolName: 'desktop_word_type',
                displayName: 'Type in Word',
                executionTime: 0,
              },
            };
          } catch (err: any) {
            return {
              status: 'error',
              data: {},
              preview: `Word typing failed: ${err.message}`,
              metadata: {
                toolName: 'desktop_word_type',
                displayName: 'Type in Word',
                executionTime: 0,
              },
              error: { code: 'DESKTOP_WORD_TYPE_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Text to type into Word' },
            addNewline: {
              type: 'boolean',
              description: 'Whether to add a paragraph break after typing',
            },
            smoothStream: {
              type: 'boolean',
              description: 'Simulate human typing animation word by word',
            },
          },
          required: ['text'],
        },
        timeoutMs: 30000,
      }),
    );

    // 7. desktop_word_format
    registry.register(
      ToolAdapter.from({
        name: 'desktop_word_format',
        displayName: 'Format Word Document',
        description:
          'Applies formatting styles, font size, bold, or headings in Microsoft Word via COM.',
        tags: ['desktop', 'word', 'format', 'com'],
        mutating: true,
        handler: async (args) => {
          try {
            const res = await services.desktopBridge.wordFormat(args);
            return {
              status: 'success',
              data: res,
              preview: `Applied formatting to Word document selection`,
              metadata: {
                toolName: 'desktop_word_format',
                displayName: 'Format Word',
                executionTime: 0,
              },
            };
          } catch (err: any) {
            return {
              status: 'error',
              data: {},
              preview: `Word formatting failed: ${err.message}`,
              metadata: {
                toolName: 'desktop_word_format',
                displayName: 'Format Word',
                executionTime: 0,
              },
              error: {
                code: 'DESKTOP_WORD_FORMAT_ERROR',
                message: err.message,
              },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            style: {
              type: 'string',
              description:
                'Word style (e.g. "Heading 1", "Heading 2", "Normal")',
            },
            bold: { type: 'boolean' },
            italic: { type: 'boolean' },
            fontSize: { type: 'number' },
          },
        },
        timeoutMs: 15000,
      }),
    );

    // 8. desktop_send_keys
    registry.register(
      ToolAdapter.from({
        name: 'desktop_send_keys',
        displayName: 'Send Keyboard Shortcut',
        description:
          'Sends keyboard keys or shortcuts (e.g. ^s for Ctrl+S, {ENTER}, {TAB}) to active window.',
        tags: ['desktop', 'keys', 'keyboard', 'shortcut'],
        mutating: true,
        handler: async (args) => {
          try {
            const res = await services.desktopBridge.sendKeys(args.keys);
            return {
              status: 'success',
              data: res,
              preview: `Sent keyboard keys: ${args.keys}`,
              metadata: {
                toolName: 'desktop_send_keys',
                displayName: 'Send Keys',
                executionTime: 0,
              },
            };
          } catch (err: any) {
            return {
              status: 'error',
              data: {},
              preview: `Failed to send keys: ${err.message}`,
              metadata: {
                toolName: 'desktop_send_keys',
                displayName: 'Send Keys',
                executionTime: 0,
              },
              error: { code: 'DESKTOP_SEND_KEYS_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            keys: {
              type: 'string',
              description:
                'Keys string (e.g. "^s" for Ctrl+S, "{ENTER}", "text")',
            },
          },
          required: ['keys'],
        },
        timeoutMs: 10000,
      }),
    );

    // 9. desktop_screenshot
    registry.register(
      ToolAdapter.from({
        name: 'desktop_screenshot',
        displayName: 'Capture Desktop Screenshot',
        description:
          'Captures full desktop screen snapshot for visual verification.',
        tags: ['desktop', 'screenshot', 'visual'],
        handler: async () => {
          try {
            const res = await services.desktopBridge.sendCommand('screenshot');
            return {
              status: 'success',
              data: res,
              preview: `Captured desktop screenshot successfully`,
              metadata: {
                toolName: 'desktop_screenshot',
                displayName: 'Screenshot',
                executionTime: 0,
              },
            };
          } catch (err: any) {
            return {
              status: 'error',
              data: {},
              preview: `Screenshot failed: ${err.message}`,
              metadata: {
                toolName: 'desktop_screenshot',
                displayName: 'Screenshot',
                executionTime: 0,
              },
              error: { code: 'DESKTOP_SCREENSHOT_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {},
        },
        timeoutMs: 15000,
      }),
    );

    // 10. desktop_word_edit (Headless Native COM)
    registry.register(
      ToolAdapter.from({
        name: 'desktop_word_edit',
        displayName: 'Edit Word Document via COM',
        description:
          'Performs precise document modifications on Word (.docx / .doc) files via Native COM automation. Supports: replace_text (find & replace template placeholders like {{NAMA}} -> "Budi"), append_paragraph, insert_table, export_pdf, and save. Preserves formatting, fonts, margins, and styles 100%.',
        tags: [
          'desktop',
          'word',
          'edit',
          'com',
          'docx',
          'template',
          'replace',
          'pdf',
        ],
        mutating: true,
        handler: async (args) => {
          try {
            let safePath: string | undefined;
            if (args.filePath || args.path || args.filename) {
              safePath =
                await services.workspaceToolsService.resolveWithinWorkspace(
                  args.workspaceId,
                  args.filePath || args.path || args.filename,
                );
            }
            if (!safePath) {
              throw new Error('filePath is required to edit Word document.');
            }
            if (!services.wordCom.isAvailable) {
              throw new Error(
                'Word COM automation is only available on Windows OS.',
              );
            }

            let actions: any[] = [];
            if (Array.isArray(args.actions) && args.actions.length > 0) {
              actions = args.actions;
            } else if (
              args.action ||
              args.findText ||
              args.replaceText ||
              args.text
            ) {
              actions = [
                {
                  action: args.action || (args.findText ? 'replace_text' : 'append_paragraph'),
                  findText: args.findText,
                  replaceText: args.replaceText,
                  text: args.text,
                  style: args.style,
                  bold: args.bold,
                  italic: args.italic,
                  fontSize: args.fontSize,
                  color: args.color,
                  alignment: args.alignment,
                  tableRows: args.tableRows,
                  headers: args.headers,
                  exportPdfPath: args.exportPdfPath,
                },
              ];
            }

            const res = await services.wordCom.editWord(safePath, actions);
            return {
              status: 'success',
              data: res,
              preview: `Executed ${actions.length} Word COM action(s) on ${path.basename(safePath)}`,
              metadata: {
                toolName: 'desktop_word_edit',
                displayName: 'Edit Word via COM',
                executionTime: 0,
              },
            };
          } catch (err: any) {
            return {
              status: 'error',
              data: {},
              preview: `Word edit failed: ${err.message}`,
              metadata: {
                toolName: 'desktop_word_edit',
                displayName: 'Edit Word via COM',
                executionTime: 0,
              },
              error: { code: 'DESKTOP_WORD_EDIT_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string' },
            filePath: {
              type: 'string',
              description: 'Path to .docx / .doc file within workspace',
            },
            actions: {
              type: 'array',
              description:
                'Array of actions: [{ action: "replace_text", findText: "{{NAMA}}", replaceText: "Budi" }, { action: "export_pdf" }]',
            },
            action: {
              type: 'string',
              enum: [
                'replace_text',
                'fill_template',
                'append_paragraph',
                'append_text',
                'insert_table',
                'export_pdf',
                'save',
              ],
              description: 'Single action type',
            },
            findText: {
              type: 'string',
              description: 'Text or placeholder to find (e.g. "{{NAMA_KLIEN}}")',
            },
            replaceText: {
              type: 'string',
              description: 'Replacement text (e.g. "PT Surya Mandiri")',
            },
            text: {
              type: 'string',
              description: 'Text content to append as a new paragraph',
            },
            style: {
              type: 'string',
              description: 'Word style (e.g. "Heading 1", "Heading 2", "Normal")',
            },
            bold: { type: 'boolean' },
            italic: { type: 'boolean' },
            fontSize: { type: 'number' },
            exportPdfPath: {
              type: 'string',
              description: 'Target PDF output path when using export_pdf',
            },
          },
          required: ['filePath'],
        },
        timeoutMs: 45000,
      }),
    );

    // 11. desktop_ppt_edit (Headless Native COM)
    registry.register(
      ToolAdapter.from({
        name: 'desktop_ppt_edit',
        displayName: 'Edit PowerPoint Presentation via COM',
        description:
          'Performs precise presentation modifications on PowerPoint (.pptx / .ppt) files via Native COM automation. Supports: replace_text (across all slides/shapes), add_slide (with title & bullets), export_pdf, and save.',
        tags: [
          'desktop',
          'ppt',
          'powerpoint',
          'edit',
          'com',
          'pptx',
          'slides',
          'export',
          'pdf',
        ],
        mutating: true,
        handler: async (args) => {
          try {
            let safePath: string | undefined;
            if (args.filePath || args.path || args.filename) {
              safePath =
                await services.workspaceToolsService.resolveWithinWorkspace(
                  args.workspaceId,
                  args.filePath || args.path || args.filename,
                );
            }
            if (!safePath) {
              throw new Error('filePath is required to edit PowerPoint.');
            }
            if (!services.pptCom.isAvailable) {
              throw new Error(
                'PowerPoint COM automation is only available on Windows OS.',
              );
            }

            let actions: any[] = [];
            if (Array.isArray(args.actions) && args.actions.length > 0) {
              actions = args.actions;
            } else if (args.action || args.findText || args.title) {
              actions = [
                {
                  action: args.action || (args.findText ? 'replace_text' : 'add_slide'),
                  findText: args.findText,
                  replaceText: args.replaceText,
                  title: args.title,
                  content: args.content,
                  exportPdfPath: args.exportPdfPath,
                },
              ];
            }

            const res = await services.pptCom.editPpt(safePath, actions);
            return {
              status: 'success',
              data: res,
              preview: `Executed ${actions.length} PowerPoint COM action(s) on ${path.basename(safePath)}`,
              metadata: {
                toolName: 'desktop_ppt_edit',
                displayName: 'Edit PowerPoint via COM',
                executionTime: 0,
              },
            };
          } catch (err: any) {
            return {
              status: 'error',
              data: {},
              preview: `PowerPoint edit failed: ${err.message}`,
              metadata: {
                toolName: 'desktop_ppt_edit',
                displayName: 'Edit PowerPoint via COM',
                executionTime: 0,
              },
              error: { code: 'DESKTOP_PPT_EDIT_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string' },
            filePath: {
              type: 'string',
              description: 'Path to .pptx / .ppt file within workspace',
            },
            actions: {
              type: 'array',
              description:
                'Array of actions: [{ action: "replace_text", findText: "2025", replaceText: "2026" }, { action: "add_slide", title: "Ringkasan", content: ["Poin 1", "Poin 2"] }]',
            },
            action: {
              type: 'string',
              enum: ['replace_text', 'add_slide', 'export_pdf', 'save'],
              description: 'Single action type',
            },
            findText: { type: 'string', description: 'Text to find' },
            replaceText: { type: 'string', description: 'Replacement text' },
            title: { type: 'string', description: 'Slide title for add_slide' },
            content: {
              type: 'array',
              description: 'Array of bullet point strings for add_slide',
            },
            exportPdfPath: {
              type: 'string',
              description: 'Target PDF output path when using export_pdf',
            },
          },
          required: ['filePath'],
        },
        timeoutMs: 45000,
      }),
    );
  }
}
