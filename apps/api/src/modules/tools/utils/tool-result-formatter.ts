/**
 * OpenClaw Tool Result Formatter & Payload Sanitizer
 * Wraps tool execution output into concise, LLM-friendly text structures.
 * Prevents large outputs from eating token budgets and reduces hallucination.
 */

export interface ToolResultPayload {
  status: 'success' | 'error' | 'partial';
  data?: any;
  preview?: string;
  metadata?: Record<string, any>;
  error?: { code: string; message: string };
}

const TOOL_ERROR_PREVIEW_MAX_CHARS = 600;
const READ_CONTENT_MAX_CHARS = 12000;

export class ToolResultFormatter {
  /**
   * Format tool execution result for consumption by LLMs (OpenClaw payloadTextResult pattern)
   */
  static formatForLlm(toolName: string, result: ToolResultPayload): string {
    if (result.status === 'error') {
      const rawError = result.error?.message || result.preview || 'Tool execution failed';
      const truncated =
        rawError.length > TOOL_ERROR_PREVIEW_MAX_CHARS
          ? `${rawError.substring(0, TOOL_ERROR_PREVIEW_MAX_CHARS)}... [truncated]`
          : rawError;

      return `[TOOL_ERROR] ${toolName}: ${truncated}`;
    }

    const content = toolName === 'read' && typeof result.data?.content === 'string'
      ? result.data.content
      : undefined;
    if (content !== undefined) {
      const text = content.length > READ_CONTENT_MAX_CHARS
        ? `${content.substring(0, READ_CONTENT_MAX_CHARS)}... [truncated]`
        : content;
      return `[TOOL_SUCCESS] read:\n${text}`;
    }

    if (result.preview) {
      return `[TOOL_SUCCESS] ${toolName}: ${result.preview}`;
    }

    if (result.data) {
      if (typeof result.data === 'string') {
        const text = result.data.length > 2000 ? `${result.data.substring(0, 2000)}... [truncated]` : result.data;
        return `[TOOL_SUCCESS] ${toolName}:\n${text}`;
      }

      try {
        const jsonString = JSON.stringify(result.data, null, 2);
        const text = jsonString.length > 2000 ? `${jsonString.substring(0, 2000)}... [truncated]` : jsonString;
        return `[TOOL_SUCCESS] ${toolName}:\n${text}`;
      } catch {
        return `[TOOL_SUCCESS] ${toolName}: Executed successfully.`;
      }
    }

    return `[TOOL_SUCCESS] ${toolName}: Executed successfully.`;
  }
}
