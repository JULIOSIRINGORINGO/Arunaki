import { Controller, Get, Post, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ChatHistoryService } from './chat-history.service.js';
import { MessageService } from './message.service.js';
import { AiService } from '../ai/ai.service.js';
import { successResponse, errorResponse } from '../../common/dtos/api-response.dto.js';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatHistoryService: ChatHistoryService,
    private readonly messageService: MessageService,
    private readonly aiService: AiService,
  ) {}

  @Post()
  async createChat(@Body() body: { mode?: 'chat' | 'workspace'; workspaceId?: string }) {
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
      const chats = await this.chatHistoryService.findByWorkspaceId(workspaceId);
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
  async addMessage(@Param('id') id: string, @Body() body: { role: 'user' | 'assistant' | 'system'; content: string }) {
    try {
      const message = await this.messageService.createMessage(id, body.role, body.content);
      return successResponse(message);
    } catch (error) {
      return errorResponse('CREATE_FAILED', error.message);
    }
  }

  @Post(':id/send')
  async sendMessage(@Param('id') id: string, @Body() body: { content: string }) {
    try {
      const chat = await this.chatHistoryService.findById(id);
      if (!chat) {
        return errorResponse('NOT_FOUND', 'Chat not found');
      }

      await this.messageService.createMessage(id, 'user', body.content);

      const history = await this.messageService.findByChatHistoryId(id);
      const systemPrompt = this.aiService.getSystemPrompt(chat.mode as 'chat' | 'workspace');

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ];

      const aiResponse = await this.aiService.chat(messages);

      const assistantMessage = await this.messageService.createMessage(id, 'assistant', aiResponse.content);

      return successResponse({
        message: assistantMessage,
        usage: aiResponse.usage,
      });
    } catch (error) {
      return errorResponse('AI_FAILED', error.message);
    }
  }
}
