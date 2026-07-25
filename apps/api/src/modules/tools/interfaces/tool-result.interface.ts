export interface ToolResultMetadata {
  toolName: string;
  displayName: string;
  executionTime: number;
  format?: string;
  filename?: string;
  mimeType?: string;
  contentBase64?: string;
  [key: string]: any;
}

export interface ToolResultError {
  code: string;
  message: string;
}

export interface ToolResult {
  status: 'success' | 'error' | 'partial';
  data: Record<string, any>;
  preview: string;
  metadata: ToolResultMetadata;
  error?: ToolResultError;
}

export interface ToolCapability {
  name: string;
  displayName: string;
  description: string;
  tags: string[];
  inputSchema: Record<string, any>;
  outputType: 'text' | 'spreadsheet' | 'document' | 'calculation' | 'presentation';
  estimatedLatency: 'fast' | 'medium' | 'slow';
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
  capability?: ToolCapability;
}
