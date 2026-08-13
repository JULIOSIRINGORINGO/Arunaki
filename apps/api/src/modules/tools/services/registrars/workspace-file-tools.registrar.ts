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
          },
          required: ['workspaceId', 'filePath'],
        },
        timeoutMs: 10000,
      }),
    );

    registry.register(
      ToolAdapter.from({
        name: 'write',
        displayName: 'Write File',
        description: 'Creates a new file or overwrites an existing file inside the workspace.',
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
            filePath: { type: 'string', description: 'File path' },
            content: { type: 'string', description: 'File content' },
          },
          required: ['workspaceId', 'filePath', 'content'],
        },
        timeoutMs: 15000,
      }),
    );

    registry.register(
      ToolAdapter.from({
        name: 'edit',
        displayName: 'Edit File',
        description: 'Applies surgical patch updates to a file inside the workspace.',
        tags: ['workspace', 'file', 'edit'],
        handler: async (args) =>
          services.editToolService.execute({
            workspaceId: args.workspaceId,
            patchText: args.patchText,
            path: args.filePath || args.path || '',
          }),
        parameters: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'Workspace ID' },
            filePath: { type: 'string', description: 'File path' },
            patchText: { type: 'string', description: 'Patch text' },
          },
          required: ['workspaceId', 'filePath', 'patchText'],
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
          required: ['workspaceId', 'filePath'],
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
          required: ['workspaceId', 'oldPath', 'newPath'],
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
          required: ['workspaceId'],
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
          required: ['workspaceId', 'query'],
        },
        timeoutMs: 10000,
      }),
    );
  }
}
