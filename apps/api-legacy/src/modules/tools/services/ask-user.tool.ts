import { Injectable, Logger } from '@nestjs/common';
import { ToolResult } from '../interfaces/tool-result.interface.js';

interface AskUserArgs {
  message: string;
}

@Injectable()
export class AskUserTool {
  private readonly logger = new Logger(AskUserTool.name);

  async execute(
    args: Record<string, any>,
    _workspaceId?: string,
  ): Promise<ToolResult> {
    const typedArgs = args as AskUserArgs;
    this.logger.log(`Memanggil ask_user dengan pesan: ${typedArgs.message}`);
    return {
      status: 'success',
      data: { message: typedArgs.message },
      preview: typedArgs.message,
      metadata: {
        toolName: 'ask_user',
        displayName: 'Tanya Pengguna',
        executionTime: 0,
      },
    };
  }
}
