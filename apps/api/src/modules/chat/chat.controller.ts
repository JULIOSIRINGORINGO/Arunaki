import { Controller, Get, Post, Patch, Delete, Body, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ChatHistoryService } from './chat-history.service.js';
import { MessageService } from './message.service.js';
import { AiService } from '../ai/ai.service.js';
import { ToolRegistryService } from '../tools/tool-registry.service.js';
import { ArtifactStore } from '../tools/artifact-store.service.js';
import { KnowledgeService } from '../knowledge/knowledge.service.js';
import { ToolResult } from '../tools/interfaces/tool-result.interface.js';
import {
  successResponse,
  errorResponse,
} from '../../common/dtos/api-response.dto.js';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatHistoryService: ChatHistoryService,
    private readonly messageService: MessageService,
    private readonly aiService: AiService,
    private readonly toolRegistryService: ToolRegistryService,
    private readonly knowledgeService: KnowledgeService,
    private readonly artifactStore: ArtifactStore,
  ) {}

  private async getActiveKnowledgeContext(): Promise<string> {
    try {
      return await this.knowledgeService.getActiveContext();
    } catch {
      return '';
    }
  }

  @Post()
  async createChat(
    @Body() body: { mode?: 'chat' | 'workspace'; workspaceId?: string },
  ) {
    try {
      const chat = await this.chatHistoryService.createChat(
        body.mode || 'chat',
        body.workspaceId,
      );
      return successResponse(chat);
    } catch (error) {
      return errorResponse('CREATE_FAILED', error.message);
    }
  }

  @Get()
  async findAllChats() {
    try {
      const chats = await this.chatHistoryService.findAllChats();
      return successResponse(chats);
    } catch (error) {
      return errorResponse('FETCH_FAILED', error.message);
    }
  }

  @Get('workspace/:workspaceId')
  async findByWorkspace(@Param('workspaceId') workspaceId: string) {
    try {
      const chats =
        await this.chatHistoryService.findByWorkspaceId(workspaceId);
      return successResponse(chats);
    } catch (error) {
      return errorResponse('FETCH_FAILED', error.message);
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const chat = await this.chatHistoryService.findById(id);
      return successResponse(chat);
    } catch (error) {
      return errorResponse('NOT_FOUND', error.message);
    }
  }

  @Patch(':id/pin')
  async togglePin(@Param('id') id: string) {
    try {
      const chat = await this.chatHistoryService.togglePin(id);
      return successResponse(chat);
    } catch (error) {
      return errorResponse('UPDATE_FAILED', error.message);
    }
  }

  @Delete(':id')
  async deleteChat(@Param('id') id: string) {
    try {
      await this.chatHistoryService.deleteChat(id);
      return successResponse({ deleted: true });
    } catch (error) {
      return errorResponse('DELETE_FAILED', error.message);
    }
  }

  @Get(':id/messages')
  async getMessages(@Param('id') id: string) {
    try {
      const messages = await this.messageService.findByChatHistoryId(id);
      return successResponse(messages);
    } catch (error) {
      return errorResponse('FETCH_FAILED', error.message);
    }
  }

  @Post(':id/messages')
  async addMessage(
    @Param('id') id: string,
    @Body() body: { role: 'user' | 'assistant' | 'system'; content: string },
  ) {
    try {
      const message = await this.messageService.createMessage(
        id,
        body.role,
        body.content,
      );
      return successResponse(message);
    } catch (error) {
      return errorResponse('CREATE_FAILED', error.message);
    }
  }

  @Get(':id/artifacts')
  async getArtifacts(@Param('id') id: string) {
    try {
      const artifacts = this.artifactStore.find({
        tags: [`chat:${id}`],
      });
      return successResponse(
        artifacts.map((a) => ({
          id: a.id,
          type: a.type,
          filename: a.filename,
          mimeType: a.mimeType,
          preview: a.preview,
          status: a.status,
          createdAt: a.metadata.createdAt,
        })),
      );
    } catch (error) {
      return errorResponse('FETCH_FAILED', error.message);
    }
  }

  @Get('artifacts/:artifactId/download')
  async downloadArtifact(
    @Param('artifactId') artifactId: string,
    @Res() res: Response,
  ) {
    try {
      const artifact = this.artifactStore.findById(artifactId);
      if (!artifact) {
        return res.status(404).json({ error: 'Artifact not found' });
      }

      if (!artifact.contentBase64) {
        return res.status(400).json({ error: 'Artifact has no file content' });
      }

      const fileBuffer = Buffer.from(artifact.contentBase64, 'base64');
      res.set({
        'Content-Type': artifact.mimeType,
        'Content-Disposition': `attachment; filename="${artifact.filename}"`,
        'Content-Length': fileBuffer.length.toString(),
      });
      res.send(fileBuffer);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  @Post(':id/send')
  async sendMessage(
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    try {
      const chat = await this.chatHistoryService.findById(id);
      if (!chat) {
        return errorResponse('NOT_FOUND', 'Chat not found');
      }

      await this.messageService.createMessage(id, 'user', body.content);

      if (!chat.title) {
        const title =
          body.content.length > 50
            ? body.content.substring(0, 50) + '...'
            : body.content;
        await this.chatHistoryService.updateTitle(id, title);
      }

      const history = await this.messageService.findByChatHistoryId(id);
      const knowledgeContext = await this.getActiveKnowledgeContext();
      const systemPrompt = this.aiService.getSystemPrompt(
        chat.mode as 'chat' | 'workspace',
        undefined,
        knowledgeContext,
      );

      const tools = this.toolRegistryService.getToolDefinitions();

      const messages: any[] = [
        { role: 'system' as const, content: systemPrompt },
        ...history.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ];

      let toolOutputs: any[] = [];
      let finalContent = '';
      let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      const createdArtifactIds: string[] = [];

      const MAX_TOOL_ROUNDS = 5;
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
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

          let result: any;
          try {
            result = await this.toolRegistryService.executeTool(funcName, args);
          } catch (e) {
            result = { error: e.message };
          }

          const toolResult = result as ToolResult;

          if (
            toolResult.status === 'success' &&
            toolResult.metadata?.contentBase64
          ) {
            const artifact = this.artifactStore.create({
              type: this.mapOutputTypeToArtifactType(
                toolResult.metadata.format || 'document',
              ),
              filename:
                toolResult.metadata.filename || `export-${Date.now()}.file`,
              mimeType:
                toolResult.metadata.mimeType || 'application/octet-stream',
              contentBase64: toolResult.metadata.contentBase64,
              preview: toolResult.preview,
              data: toolResult.data,
              createdBy: `tool:${funcName}`,
              tags: [
                `chat:${id}`,
                `tool:${funcName}`,
                `format:${toolResult.metadata.format || 'unknown'}`,
              ],
              lineage: [funcName],
            });
            createdArtifactIds.push(artifact.id);
          }

          toolOutputs.push({
            toolName: funcName,
            args,
            result,
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

      const assistantMessage = await this.messageService.createMessage(
        id,
        'assistant',
        finalContent,
      );

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

      return successResponse({
        message: assistantMessage,
        usage,
        toolOutputs,
        artifacts,
      });
    } catch (error) {
      return errorResponse('AI_FAILED', error.message);
    }
  }

  private mapOutputTypeToArtifactType(
    format: string,
  ): 'document' | 'spreadsheet' | 'presentation' | 'text' | 'calculation' {
    switch (format) {
      case 'pdf':
      case 'docx':
        return 'document';
      case 'xlsx':
      case 'csv':
        return 'spreadsheet';
      case 'pptx':
        return 'presentation';
      default:
        return 'text';
    }
  }
}
