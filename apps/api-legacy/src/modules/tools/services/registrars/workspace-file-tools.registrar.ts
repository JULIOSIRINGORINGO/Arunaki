import { Injectable } from '@nestjs/common';
import { ToolRegistryService } from '../../tool-registry.service.js';
import { ToolDef } from '../../tool.js';
import { ReadTool } from '../../file/read.js';
import { WriteTool } from '../../file/write.js';
import { EditTool } from '../../file/edit.js';
import { GlobTool } from '../../file/glob.js';
import { GrepTool } from '../../file/grep.js';
import { ListTool } from '../../file/list.js';
import { DeleteTool } from '../../file/delete.js';
import { RenameTool } from '../../file/rename.js';

/**
 * Register workspace file tools into the registry.
 * Matches OpenCode's pattern: explicit registration of all tools.
 */
@Injectable()
export class WorkspaceFileToolsRegistrar {
  register(registry: ToolRegistryService) {
    const tools: ToolDef[] = [
      ReadTool,
      WriteTool,
      EditTool,
      GlobTool,
      GrepTool,
      ListTool,
      DeleteTool,
      RenameTool,
    ];

    for (const tool of tools) {
      registry.registerFromDef(tool);
    }
  }
}
