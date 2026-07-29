export interface HarnessPlugin {
  readonly name: string;
  readonly priority: number;

  onAgentStart?(params: {
    chatId: string;
    runId: string;
    userContent: string;
  }): Promise<void> | void;

  onToolStart?(params: {
    chatId: string;
    runId: string;
    toolName: string;
    args: Record<string, any>;
  }): Promise<void> | void;

  onToolResult?(params: {
    chatId: string;
    runId: string;
    toolName: string;
    args: Record<string, any>;
    result: any;
  }): Promise<void> | void;

  onAgentComplete?(params: {
    chatId: string;
    runId: string;
    result: any;
  }): Promise<void> | void;

  onAgentError?(params: {
    chatId: string;
    runId: string;
    error: Error;
  }): Promise<void> | void;
}
