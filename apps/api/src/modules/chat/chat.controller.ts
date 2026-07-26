import { Controller, Get, Post, Patch, Delete, Body, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ChatHistoryService } from './chat-history.service.js';
import { MessageService } from './message.service.js';
import { AgentRunnerService } from './agent-runner.service.js';
import { ArtifactStore } from '../tools/artifact-store.service.js';
import {
  successResponse,
  errorResponse,
} from '../../common/dtos/api-response.dto.js';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatHistoryService: ChatHistoryService,
    private readonly messageService: MessageService,
    private readonly agentRunnerService: AgentRunnerService,
    private readonly artifactStore: ArtifactStore,
  ) {}

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
      const chats = await this.chatHistoryService.findByWorkspaceId(
        workspaceId,
      );
      return successResponse(chats);
    } catch (error) {
      return errorResponse('FETCH_FAILED', error.message);
    }
  }

  @Get(':id')
  async findOneChat(@Param('id') id: string) {
    try {
      const chat = await this.chatHistoryService.findById(id);
      if (!chat) {
        return errorResponse('NOT_FOUND', 'Chat not found');
      }
      return successResponse(chat);
    } catch (error) {
      return errorResponse('FETCH_FAILED', error.message);
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

  @Patch(':id/title')
  async updateTitle(
    @Param('id') id: string,
    @Body() body: { title: string },
  ) {
    try {
      const chat = await this.chatHistoryService.updateTitle(id, body.title);
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
      const agentResult = await this.agentRunnerService.runAgentSync({
        chatId: id,
        userContent: body.content,
        chatMode: chat.mode as 'chat' | 'workspace',
        historyMessages: history.map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        })),
      });

      const assistantMessage = await this.messageService.createMessage(
        id,
        'assistant',
        agentResult.content,
      );

      return successResponse({
        message: assistantMessage,
        usage: agentResult.usage,
        toolOutputs: agentResult.toolOutputs,
        artifacts: agentResult.artifacts,
      });
    } catch (error) {
      return errorResponse('AI_FAILED', error.message);
    }
  }

  @Post(':id/stream')
  async streamMessage(
    @Param('id') id: string,
    @Body() body: { content: string },
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      const chat = await this.chatHistoryService.findById(id);
      if (!chat) {
        res.write(`data: ${JSON.stringify({ type: 'error', data: { message: 'Chat not found' } })}\n\n`);
        return res.end();
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
      const finalContent = await this.agentRunnerService.runAgentStream(
        {
          chatId: id,
          userContent: body.content,
          chatMode: chat.mode as 'chat' | 'workspace',
          historyMessages: history.map((m) => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
          })),
        },
        (event) => {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        },
      );

      await this.messageService.createMessage(id, 'assistant', finalContent);
      res.end();
    } catch (error) {
      res.write(`data: ${JSON.stringify({ type: 'error', data: { message: error.message } })}\n\n`);
      res.end();
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
