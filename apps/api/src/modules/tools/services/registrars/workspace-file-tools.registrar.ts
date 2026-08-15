import { Injectable } from '@nestjs/common';
import { ToolRegistryService } from '../../tool-registry.service.js';
import { ToolAdapter } from '../tool-adapter.js';
import { WorkspaceToolsService } from '../workspace-tools.service.js';
import { ReadToolService } from '../read-tool.service.js';
import { WriteToolService } from '../write-tool.service.js';
import { EditToolService } from '../edit-tool.service.js';
import { DeleteToolService } from '../delete-tool.service.js';
import { RenameToolService } from '../rename-tool.service.js';
import { ListToolService } from '../list-tool.service.js';
import { SearchToolService } from '../search-tool.service.js';

@Injectable()
export class WorkspaceFileToolsRegistrar {
  register(
    registry: ToolRegistryService,
    services: {
      workspaceToolsService: WorkspaceToolsService;
      readToolService: ReadToolService;
      writeToolService: WriteToolService;
      editToolService: EditToolService;
      deleteToolService: DeleteToolService;
      renameToolService: RenameToolService;
      listToolService: ListToolService;
      searchToolService: SearchToolService;
    },
  ) {
    registry.register(
      ToolAdapter.from({
        name: 'read',
        displayName: 'Read File',
        description: 'Reads the full content of a specified file inside the workspace.',
        tags: ['workspace', 'file', 'read'],
        handler: async (args) =>
          services.readToolService.execute({
            filePath: args.filePath || args.filename || '',
            workspaceId: args.workspaceId,
            offset: args.offset,
            limit: args.limit,
          }),
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID' },
            filePath: { type: 'string', description: 'File path relative or absolute' },
            offset: { type: 'number', description: 'Optional line offset (1-based)' },
            limit: { type: 'number', description: 'Optional max lines to read' },
          },
          required: ['filePath'],
        },
        timeoutMs: 10000,
      }),
    );

    registry.register(
      ToolAdapter.from({
        name: 'write',
        displayName: 'Write File',
        description: 'Creates a brand new file in the workspace. Fails if the file already exists. To update or modify existing files, you MUST use the edit tool.',
        tags: ['workspace', 'file', 'write'],
        handler: async (args) =>
          services.writeToolService.execute({
            workspaceId: args.workspaceId,
            filename: args.filePath || args.filename || '',
            format: args.format || 'txt',
            content: args.content,
            rows: args.rows,
            title: args.title,
          }),
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID' },
            filePath: { type: 'string', description: 'File path for the new file' },
            content: { type: 'string', description: 'File content' },
          },
          required: ['filePath', 'content'],
        },
        timeoutMs: 15000,
      }),
    );

    registry.register(
      ToolAdapter.from({
        name: 'edit',
        displayName: 'Edit File',
        description: 'Modifies an existing file by surgical replacement or patch (oldString -> newString or patchText). ALWAYS use edit for existing files to preserve all other sections, layout, and data.',
        tags: ['workspace', 'file', 'edit'],
        handler: async (args) =>
          services.editToolService.execute({
            workspaceId: args.workspaceId,
            patchText: args.patchText,
            path: args.filePath || args.path || '',
            oldString: args.oldString || args.old_str,
            newString: args.newString || args.new_str,
          }),
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID' },
            filePath: { type: 'string', description: 'File path relative to workspace' },
            patchText: { type: 'string', description: 'Optional unified diff patch text (@@ ... @@)' },
            oldString: { type: 'string', description: 'Optional exact existing text snippet to replace' },
            newString: { type: 'string', description: 'Optional new replacement text snippet' },
            replacements: {
              type: 'array',
              description: 'Optional array of multiple { oldString, newString } replacements to apply in one go',
              items: {
                type: 'object',
                properties: {
                  oldString: { type: 'string', description: 'Existing text to replace' },
                  newString: { type: 'string', description: 'New replacement text' },
                },
                required: ['oldString', 'newString'],
              },
            },
          },
          required: ['filePath'],
        },
        timeoutMs: 15000,
      }),
    );

    registry.register(
      ToolAdapter.from({
        name: 'delete',
        displayName: 'Delete File',
        description: 'Deletes a file or directory from the workspace.',
        tags: ['workspace', 'file', 'delete'],
        handler: async (args) =>
          services.deleteToolService.execute({
            workspaceId: args.workspaceId,
            filename: args.filePath || args.filename || '',
          }),
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID' },
            filePath: { type: 'string', description: 'File or folder path' },
          },
          required: ['filePath'],
        },
        timeoutMs: 10000,
      }),
    );

    registry.register(
      ToolAdapter.from({
        name: 'rename',
        displayName: 'Rename File',
        description: 'Renames or moves a file inside the workspace.',
        tags: ['workspace', 'file', 'rename'],
        handler: async (args) =>
          services.renameToolService.execute({
            workspaceId: args.workspaceId,
            filename: args.oldPath || args.filename || '',
            newFilename: args.newPath || args.newFilename || '',
          }),
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID' },
            oldPath: { type: 'string', description: 'Old path' },
            newPath: { type: 'string', description: 'New path' },
          },
          required: ['oldPath', 'newPath'],
        },
        timeoutMs: 10000,
      }),
    );

    registry.register(
      ToolAdapter.from({
        name: 'list',
        displayName: 'List Files',
        description: 'Lists files and folders inside the workspace directory.',
        tags: ['workspace', 'file', 'list'],
        handler: async (args) => services.listToolService.execute(args.workspaceId),
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID' },
            folderPath: { type: 'string', description: 'Folder path' },
          },
          required: [],
        },
        timeoutMs: 10000,
      }),
    );

    registry.register(
      ToolAdapter.from({
        name: 'search_workspace',
        displayName: 'Search Workspace',
        description: 'Searches workspace files for a text pattern or filename.',
        tags: ['workspace', 'file', 'search'],
        handler: async (args) => services.searchToolService.execute(args.workspaceId, args.query || ''),
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID' },
            query: { type: 'string', description: 'Search query' },
          },
          required: ['query'],
        },
        timeoutMs: 10000,
      }),
    );
  }
}
