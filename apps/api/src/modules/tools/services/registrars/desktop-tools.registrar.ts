import { Injectable } from '@nestjs/common';
import { ToolRegistryService } from '../../tool-registry.service.js';
import { ToolAdapter } from '../tool-adapter.js';
import { DesktopBridgeService } from '../../../interaction/desktop-bridge.service.js';
import { WorkspaceToolsService } from '../workspace-tools.service.js';

@Injectable()
export class DesktopToolsRegistrar {
  register(
    registry: ToolRegistryService,
    services: {
      desktopBridge: DesktopBridgeService;
      workspaceToolsService: WorkspaceToolsService;
    },
  ) {
    // 1. desktop_open_file
    registry.register(
      ToolAdapter.from({
        name: 'desktop_open_file',
        displayName: 'Open File on Desktop',
        description: 'Opens a document file inside the workspace using the default desktop OS application.',
        tags: ['desktop', 'open', 'file'],
        handler: async (args) => {
          try {
            const safePath = await services.workspaceToolsService.resolveWithinWorkspace(
              args.workspaceId,
              args.filePath || args.path,
            );
            const res = await services.desktopBridge.sendCommand('openFile', { path: safePath });
            return {
              status: 'success',
              data: res,
              preview: `Opened file on desktop: ${args.filePath || args.path}`,
              metadata: { toolName: 'desktop_open_file', displayName: 'Open File', executionTime: 0 },
            };
          } catch (err: any) {
            return {
              status: 'error',
              data: {},
              preview: `Failed to open file on desktop: ${err.message}`,
              metadata: { toolName: 'desktop_open_file', displayName: 'Open File', executionTime: 0 },
              error: { code: 'DESKTOP_BRIDGE_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string' },
            filePath: { type: 'string', description: 'Relative path of file within workspace' },
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
        displayName: 'Open in Excel',
        description: 'Opens an Excel workbook (.xlsx/.xls) in Microsoft Excel application via COM interface.',
        tags: ['desktop', 'excel', 'com', 'spreadsheet'],
        handler: async (args) => {
          try {
            const safePath = await services.workspaceToolsService.resolveWithinWorkspace(
              args.workspaceId,
              args.filePath || args.path,
            );
            const res = await services.desktopBridge.sendCommand('openExcel', { path: safePath });
            return {
              status: 'success',
              data: res,
              preview: `Opened Excel workbook via COM: ${args.filePath || args.path}`,
              metadata: { toolName: 'desktop_open_excel', displayName: 'Open Excel', executionTime: 0 },
            };
          } catch (err: any) {
            return {
              status: 'error',
              data: {},
              preview: `Failed to open Excel: ${err.message}`,
              metadata: { toolName: 'desktop_open_excel', displayName: 'Open Excel', executionTime: 0 },
              error: { code: 'DESKTOP_EXCEL_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string' },
            filePath: { type: 'string', description: 'Relative path of .xlsx/.xls file within workspace' },
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
        displayName: 'Open in Word',
        description: 'Opens a Word document (.docx/.doc) in Microsoft Word application via COM interface.',
        tags: ['desktop', 'word', 'com', 'document'],
        handler: async (args) => {
          try {
            const safePath = await services.workspaceToolsService.resolveWithinWorkspace(
              args.workspaceId,
              args.filePath || args.path,
            );
            const res = await services.desktopBridge.sendCommand('openWord', { path: safePath });
            return {
              status: 'success',
              data: res,
              preview: `Opened Word document via COM: ${args.filePath || args.path}`,
              metadata: { toolName: 'desktop_open_word', displayName: 'Open Word', executionTime: 0 },
            };
          } catch (err: any) {
            return {
              status: 'error',
              data: {},
              preview: `Failed to open Word: ${err.message}`,
              metadata: { toolName: 'desktop_open_word', displayName: 'Open Word', executionTime: 0 },
              error: { code: 'DESKTOP_WORD_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string' },
            filePath: { type: 'string', description: 'Relative path of .docx/.doc file within workspace' },
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
        displayName: 'Open in PowerPoint',
        description: 'Opens a presentation (.pptx/.ppt) in Microsoft PowerPoint via COM interface.',
        tags: ['desktop', 'powerpoint', 'com', 'presentation'],
        handler: async (args) => {
          try {
            const safePath = await services.workspaceToolsService.resolveWithinWorkspace(
              args.workspaceId,
              args.filePath || args.path,
            );
            const res = await services.desktopBridge.sendCommand('openPpt', { path: safePath });
            return {
              status: 'success',
              data: res,
              preview: `Opened PowerPoint presentation via COM: ${args.filePath || args.path}`,
              metadata: { toolName: 'desktop_open_ppt', displayName: 'Open PowerPoint', executionTime: 0 },
            };
          } catch (err: any) {
            return {
              status: 'error',
              data: {},
              preview: `Failed to open PowerPoint: ${err.message}`,
              metadata: { toolName: 'desktop_open_ppt', displayName: 'Open PowerPoint', executionTime: 0 },
              error: { code: 'DESKTOP_PPT_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string' },
            filePath: { type: 'string', description: 'Relative path of .pptx/.ppt file within workspace' },
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
        displayName: 'Edit Excel via COM',
        description:
          'Performs interactive edits on Microsoft Excel worksheet via COM automation (write_cell, insert_row, delete_row, insert_column, delete_column, set_format, save).',
        tags: ['desktop', 'excel', 'edit', 'com', 'cells'],
        mutating: true,
        handler: async (args) => {
          try {
            let safePath: string | undefined;
            if (args.filePath || args.path) {
              safePath = await services.workspaceToolsService.resolveWithinWorkspace(
                args.workspaceId,
                args.filePath || args.path,
              );
            }
            const actions = Array.isArray(args.actions) ? args.actions : [];
            const res = await services.desktopBridge.excelEdit(safePath, actions);
            return {
              status: 'success',
              data: res,
              preview: `Executed ${actions.length} Excel COM actions on ${args.filePath || 'active sheet'}`,
              metadata: { toolName: 'desktop_excel_edit', displayName: 'Edit Excel via COM', executionTime: 0 },
            };
          } catch (err: any) {
            return {
              status: 'error',
              data: {},
              preview: `Excel COM edit failed: ${err.message}`,
              metadata: { toolName: 'desktop_excel_edit', displayName: 'Edit Excel via COM', executionTime: 0 },
              error: { code: 'DESKTOP_EXCEL_EDIT_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string' },
            filePath: { type: 'string', description: 'Path to .xlsx file within workspace' },
            actions: {
              type: 'array',
              description: 'Array of actions: { action: "write_cell"|"insert_row"|"delete_row"|"set_format"|"save", cell, value, row, column, bold, fontSize, bgColor, alignment }',
            },
          },
          required: ['actions'],
        },
        timeoutMs: 35000,
      }),
    );

    // 6. desktop_word_type
    registry.register(
      ToolAdapter.from({
        name: 'desktop_word_type',
        displayName: 'Type in Word Document',
        description: 'Types text into the active Microsoft Word document window via COM automation.',
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
              metadata: { toolName: 'desktop_word_type', displayName: 'Type in Word', executionTime: 0 },
            };
          } catch (err: any) {
            return {
              status: 'error',
              data: {},
              preview: `Word typing failed: ${err.message}`,
              metadata: { toolName: 'desktop_word_type', displayName: 'Type in Word', executionTime: 0 },
              error: { code: 'DESKTOP_WORD_TYPE_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Text to type into Word' },
            addNewline: { type: 'boolean', description: 'Whether to add a paragraph break after typing' },
            smoothStream: { type: 'boolean', description: 'Simulate human typing animation word by word' },
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
        description: 'Applies formatting styles, font size, bold, or headings in Microsoft Word via COM.',
        tags: ['desktop', 'word', 'format', 'com'],
        mutating: true,
        handler: async (args) => {
          try {
            const res = await services.desktopBridge.wordFormat(args);
            return {
              status: 'success',
              data: res,
              preview: `Applied formatting to Word document selection`,
              metadata: { toolName: 'desktop_word_format', displayName: 'Format Word', executionTime: 0 },
            };
          } catch (err: any) {
            return {
              status: 'error',
              data: {},
              preview: `Word formatting failed: ${err.message}`,
              metadata: { toolName: 'desktop_word_format', displayName: 'Format Word', executionTime: 0 },
              error: { code: 'DESKTOP_WORD_FORMAT_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            style: { type: 'string', description: 'Word style (e.g. "Heading 1", "Heading 2", "Normal")' },
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
        description: 'Sends keyboard keys or shortcuts (e.g. ^s for Ctrl+S, {ENTER}, {TAB}) to active window.',
        tags: ['desktop', 'keys', 'keyboard', 'shortcut'],
        mutating: true,
        handler: async (args) => {
          try {
            const res = await services.desktopBridge.sendKeys(args.keys);
            return {
              status: 'success',
              data: res,
              preview: `Sent keyboard keys: ${args.keys}`,
              metadata: { toolName: 'desktop_send_keys', displayName: 'Send Keys', executionTime: 0 },
            };
          } catch (err: any) {
            return {
              status: 'error',
              data: {},
              preview: `Failed to send keys: ${err.message}`,
              metadata: { toolName: 'desktop_send_keys', displayName: 'Send Keys', executionTime: 0 },
              error: { code: 'DESKTOP_SEND_KEYS_ERROR', message: err.message },
            };
          }
        },
        parameters: {
          type: 'object',
          properties: {
            keys: { type: 'string', description: 'Keys string (e.g. "^s" for Ctrl+S, "{ENTER}", "text")' },
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
        description: 'Captures full desktop screen snapshot for visual verification.',
        tags: ['desktop', 'screenshot', 'visual'],
        handler: async () => {
          try {
            const res = await services.desktopBridge.sendCommand('screenshot');
            return {
              status: 'success',
              data: res,
              preview: `Captured desktop screenshot successfully`,
              metadata: { toolName: 'desktop_screenshot', displayName: 'Screenshot', executionTime: 0 },
            };
          } catch (err: any) {
            return {
              status: 'error',
              data: {},
              preview: `Screenshot failed: ${err.message}`,
              metadata: { toolName: 'desktop_screenshot', displayName: 'Screenshot', executionTime: 0 },
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
  }
}
