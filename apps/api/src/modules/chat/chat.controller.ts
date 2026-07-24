import { Controller, Get, Post, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ChatHistoryService } from './chat-history.service.js';
import { MessageService } from './message.service.js';
import { successResponse, errorResponse } from '../../common/dtos/api-response.dto.js';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatHistoryService: ChatHistoryService,
    private readonly messageService: MessageService,
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
}
