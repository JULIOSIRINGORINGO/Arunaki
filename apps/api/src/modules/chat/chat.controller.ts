import * as fs from 'fs';
import * as path from 'path';
import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ChatHistoryService } from './chat-history.service.js';
import { MessageService } from './message.service.js';
import { AiService } from '../ai/ai.service.js';
import { ToolRegistryService } from '../tools/tool-registry.service.js';
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
  ) {}

  private getActiveKnowledgeContext(): string {
    try {
      const searchDirs = [
        path.resolve(process.cwd(), '../../'),
        path.resolve(process.cwd()),
        path.resolve(process.cwd(), '../'),
      ];
      const contextParts: string[] = [];

      for (const dir of searchDirs) {
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md');
        for (const file of files) {
          const filePath = path.join(dir, file);
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            if (content.trim().length > 0) {
              contextParts.push(`--- ${file} ---\n${content}`);
            }
          } catch {
            // skip unreadable files
          }
        }
      }

      return contextParts.join('\n\n');
    } catch (e) {
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
      const knowledgeContext = this.getActiveKnowledgeContext();
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

      return successResponse({
        message: assistantMessage,
        usage,
        toolOutputs,
      });
    } catch (error) {
      return errorResponse('AI_FAILED', error.message);
    }
  }
}
