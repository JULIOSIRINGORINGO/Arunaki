import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service.js';
import { ToolRegistryService } from '../tools/tool-registry.service.js';
import { KnowledgeService } from '../knowledge/knowledge.service.js';
import { ArtifactStore } from '../tools/artifact-store.service.js';
import { ToolResult } from '../tools/interfaces/tool-result.interface.js';

export interface AgentRunParams {
  chatId: string;
  userContent: string;
  chatMode?: 'chat' | 'workspace';
  historyMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
}

export interface AgentStreamEvent {
  type: 'thinking' | 'tool_start' | 'tool_done' | 'text_delta' | 'canvas_event' | 'done' | 'error';
  data: any;
}

@Injectable()
export class AgentRunnerService {
  private readonly logger = new Logger(AgentRunnerService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly toolRegistryService: ToolRegistryService,
    private readonly knowledgeService: KnowledgeService,
    private readonly artifactStore: ArtifactStore,
  ) {}

  async getKnowledgeContext(): Promise<string> {
    try {
      return await this.knowledgeService.getActiveContext();
    } catch {
      return '';
    }
  }

  async runAgentSync(params: AgentRunParams) {
    const { chatId, chatMode = 'chat', historyMessages } = params;

    const knowledgeContext = await this.getKnowledgeContext();
    const systemPrompt = this.aiService.getSystemPrompt(chatMode, undefined, knowledgeContext);
    const tools = this.toolRegistryService.getToolDefinitions();

    const messages: any[] = [
      { role: 'system' as const, content: systemPrompt },
      ...historyMessages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    let toolOutputs: any[] = [];
    let finalContent = '';
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    const createdArtifactIds: string[] = [];

    const MAX_ROUNDS = 5;
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const aiResponse = await this.aiService.chat(messages, tools);
      usage = aiResponse.usage;

      if (aiResponse.toolCalls.length === 0) {
        finalContent = aiResponse.content;
        break;
      }

      messages.push({
        role: 'assistant',
        content: aiResponse.content || null,
        tool_calls: aiResponse.toolCalls,
      });

      for (const toolCall of aiResponse.toolCalls) {
        const funcName = toolCall.function.name;
        let args: Record<string, any> = {};
        try {
          args = JSON.parse(toolCall.function.arguments || '{}');
        } catch {
          args = {};
        }

        let result: ToolResult;
        try {
          result = await this.toolRegistryService.executeTool(funcName, args);
        } catch (e) {
          result = { success: false, status: 'error', error: { code: 'EXECUTION_FAILED', message: e.message } } as any;
        }

        if (result.status === 'success' && result.metadata?.contentBase64) {
          const artifact = this.artifactStore.create({
            type: this.mapFormatToArtifactType(result.metadata.format || 'document'),
            filename: result.metadata.filename || `export-${Date.now()}.file`,
            mimeType: result.metadata.mimeType || 'application/octet-stream',
            contentBase64: result.metadata.contentBase64,
            preview: result.preview,
            data: result.data,
            createdBy: `tool:${funcName}`,
            tags: [`chat:${chatId}`, `tool:${funcName}`, `format:${result.metadata.format || 'unknown'}`],
            lineage: [funcName],
          });
          createdArtifactIds.push(artifact.id);
        }

        toolOutputs.push({ toolName: funcName, args, result });

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
    }

    if (!finalContent) {
      finalContent = 'Pekerjaan telah selesai.';
    }

    const artifacts = createdArtifactIds
      .map((aid) => this.artifactStore.findById(aid))
      .filter(Boolean)
      .map((a) => ({
        id: a!.id,
        type: a!.type,
        filename: a!.filename,
        mimeType: a!.mimeType,
        preview: a!.preview,
        status: a!.status,
        createdAt: a!.metadata.createdAt,
      }));

    return {
      content: finalContent,
      usage,
      toolOutputs,
      artifacts,
    };
  }

  async runAgentStream(
    params: AgentRunParams,
    onEvent: (event: AgentStreamEvent) => void,
  ) {
    const { chatId, chatMode = 'chat', historyMessages } = params;

    try {
      onEvent({ type: 'thinking', data: 'Memproses pesan dan mengumpulkan konteks...' });

      const knowledgeContext = await this.getKnowledgeContext();
      const systemPrompt = this.aiService.getSystemPrompt(chatMode, undefined, knowledgeContext);
      const tools = this.toolRegistryService.getToolDefinitions();

      const messages: any[] = [
        { role: 'system' as const, content: systemPrompt },
        ...historyMessages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ];

      let finalContent = '';
      const createdArtifactIds: string[] = [];

      const MAX_ROUNDS = 5;
      for (let round = 0; round < MAX_ROUNDS; round++) {
        const aiResponse = await this.aiService.chat(messages, tools);

        if (aiResponse.toolCalls.length === 0) {
          finalContent = aiResponse.content;
          onEvent({ type: 'text_delta', data: finalContent });
          break;
        }

        messages.push({
          role: 'assistant',
          content: aiResponse.content || null,
          tool_calls: aiResponse.toolCalls,
        });

        for (const toolCall of aiResponse.toolCalls) {
          const funcName = toolCall.function.name;
          let args: Record<string, any> = {};
          try {
            args = JSON.parse(toolCall.function.arguments || '{}');
          } catch {
            args = {};
          }

          onEvent({
            type: 'tool_start',
            data: { toolName: funcName, args, timestamp: new Date().toISOString() },
          });

          let result: ToolResult;
          try {
            result = await this.toolRegistryService.executeTool(funcName, args);
          } catch (e) {
            result = { success: false, status: 'error', error: { code: 'EXECUTION_FAILED', message: e.message } } as any;
          }

          if (result.status === 'success' && result.metadata?.contentBase64) {
            const artifact = this.artifactStore.create({
              type: this.mapFormatToArtifactType(result.metadata.format || 'document'),
              filename: result.metadata.filename || `export-${Date.now()}.file`,
              mimeType: result.metadata.mimeType || 'application/octet-stream',
              contentBase64: result.metadata.contentBase64,
              preview: result.preview,
              data: result.data,
              createdBy: `tool:${funcName}`,
              tags: [`chat:${chatId}`, `tool:${funcName}`, `format:${result.metadata.format || 'unknown'}`],
              lineage: [funcName],
            });
            createdArtifactIds.push(artifact.id);
          }

          onEvent({
            type: 'tool_done',
            data: { toolName: funcName, result, timestamp: new Date().toISOString() },
          });

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }
      }

      if (!finalContent) {
        finalContent = 'Pekerjaan telah selesai.';
      }

      const artifacts = createdArtifactIds
        .map((aid) => this.artifactStore.findById(aid))
        .filter(Boolean)
        .map((a) => ({
          id: a!.id,
          type: a!.type,
          filename: a!.filename,
          mimeType: a!.mimeType,
          preview: a!.preview,
          status: a!.status,
          createdAt: a!.metadata.createdAt,
        }));

      onEvent({
        type: 'done',
        data: {
          content: finalContent,
          artifacts,
        },
      });

      return finalContent;
    } catch (error) {
      this.logger.error(`Stream execution failed: ${error.message}`);
      onEvent({ type: 'error', data: { message: error.message } });
      throw error;
    }
  }

  private mapFormatToArtifactType(format: string): 'document' | 'spreadsheet' | 'presentation' | 'image' {
    switch (format.toLowerCase()) {
      case 'xlsx':
      case 'csv':
        return 'spreadsheet';
      case 'pptx':
        return 'presentation';
      case 'png':
      case 'jpg':
      case 'jpeg':
        return 'image';
      default:
        return 'document';
    }
  }
}
