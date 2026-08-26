import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ChatHistoryService } from './chat-history.service.js';
import { MessageService, CreateMessageOptions } from './message.service.js';
import { AgentRunnerService } from './agent-runner.service.js';
import { ArtifactService } from '../artifact/artifact.service.js';
import { ProviderService } from '../provider/provider.service.js';
import {
  PromptInjectionDetector,
  InjectionDetectionResult,
} from '../ai/prompt-injection-detector.service.js';
import { InputProvenanceFactory } from '../ai/input-provenance.js';
import { UserTurnTranscriptService } from './user-turn-transcript.service.js';
import {
  SessionStateEventsService,
  SessionEventType,
} from './session-state-events.service.js';
import { PrismaService } from '../../common/providers/prisma.service.js';
import {
  successResponse,
  errorResponse,
} from '../../common/dtos/api-response.dto.js';
import { randomUUID } from 'node:crypto';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatHistoryService: ChatHistoryService,
    private readonly messageService: MessageService,
    private readonly agentRunnerService: AgentRunnerService,
    private readonly artifactService: ArtifactService,
    private readonly providerService: ProviderService,
    private readonly injectionDetector: PromptInjectionDetector,
    private readonly transcriptService: UserTurnTranscriptService,
    private readonly sessionEvents: SessionStateEventsService,
    private readonly prisma: PrismaService,
  ) {}

  private async resolveWorkspaceRoot(
    workspaceId: string | null | undefined,
  ): Promise<string | null> {
    if (!workspaceId) return null;
    const ws = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { rootPath: true },
    });
    return ws?.rootPath ?? null;
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
  async updateTitle(@Param('id') id: string, @Body() body: { title: string }) {
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
      this.sessionEvents.record(
        SessionEventType.SESSION_TERMINATED,
        id,
        'user',
      );
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
    @Body()
    body: {
      role: 'user' | 'assistant' | 'system';
      content: string;
      idempotencyKey?: string;
    },
  ) {
    try {
      const message = await this.messageService.createMessage({
        chatHistoryId: id,
        role: body.role,
        content: body.content,
        idempotencyKey:
          body.idempotencyKey ||
          (body.role === 'user' ? `turn:${id}:${Date.now()}` : undefined),
        provenance: InputProvenanceFactory.fromRole(body.role),
      });
      return successResponse(message);
    } catch (error) {
      return errorResponse('CREATE_FAILED', error.message);
    }
  }

  @Get(':id/artifacts')
  async getArtifacts(@Param('id') id: string) {
    try {
      const artifacts = await this.artifactService.findByTag(`chat:${id}`);
      return successResponse(
        artifacts.map((a) => {
          const meta = this.artifactService.parseMetadata(a);
          return {
            id: a.id,
            type: a.type,
            filename: a.name,
            mimeType: meta.mimeType || 'application/octet-stream',
            preview: a.preview,
            status: 'draft',
            createdAt: a.createdAt,
          };
        }),
      );
    } catch (error) {
      return errorResponse('FETCH_FAILED', error.message);
    }
  }

  @Get('artifacts/:artifactId/download')
  async downloadArtifact(
    @Param('artifactId') artifactId: string,
    @Query('chatId') chatId: string | undefined,
    @Query('workspaceId') workspaceId: string | undefined,
    @Res() res: Response,
  ) {
    try {
      const artifact = await this.artifactService.findById(artifactId);
      if (!artifact) {
        return res.status(404).json({ error: 'Artifact not found' });
      }

      const meta = this.artifactService.parseMetadata(artifact);

      // IDOR Scope Access Control Verification
      if (chatId && (!meta.tags || !meta.tags.includes(`chat:${chatId}`))) {
        return res.status(403).json({
          error: 'Access denied: Artifact does not belong to this chat session',
        });
      }
      if (
        workspaceId &&
        artifact.workspaceId !== workspaceId &&
        (!meta.tags || !meta.tags.includes(`workspace:${workspaceId}`))
      ) {
        return res.status(403).json({
          error: 'Access denied: Artifact does not belong to this workspace',
        });
      }

      if (!meta.contentBase64) {
        return res.status(400).json({ error: 'Artifact has no file content' });
      }

      const fileBuffer = Buffer.from(meta.contentBase64, 'base64');
      res.set({
        'Content-Type': meta.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${artifact.name}"`,
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
    @Body() body: { content: string; idempotencyKey?: string },
  ) {
    try {
      const chat = await this.chatHistoryService.findById(id);
      if (!chat) {
        return errorResponse('NOT_FOUND', 'Chat not found');
      }

      const injectionResult = this.injectionDetector.scan(body.content);
      if (injectionResult.detected && injectionResult.severity !== 'low') {
        this.injectionDetector.logDetection(id, body.content, injectionResult);
        return errorResponse(
          'INJECTION_DETECTED',
          'Potential prompt injection detected. Request blocked.',
        );
      }

      const userContent = injectionResult.detected
        ? injectionResult.sanitized
        : body.content;

      const runId = body.idempotencyKey || randomUUID();

      // Late media check — if there's an active turn, queue instead of starting new
      const activeTurn = this.transcriptService.hasActiveTurn(id);
      if (activeTurn) {
        // Release stale active turns older than 10s (same logic as stream endpoint)
        if (Date.now() - activeTurn.createdAt > 10_000) {
          this.transcriptService.markFailed(activeTurn.runId);
        } else {
          return errorResponse(
            'TURN_IN_PROGRESS',
            'Another request is being processed. Please wait.',
          );
        }
      }

      // Create user message with idempotency key
      const userMessage = await this.messageService.createMessage({
        chatHistoryId: id,
        role: 'user',
        content: userContent,
        idempotencyKey: `run:${runId}`,
        provenance: InputProvenanceFactory.externalUser(),
      });

      // Record human message event
      this.sessionEvents.record(
        SessionEventType.HUMAN_DIRECT_MESSAGE,
        id,
        chat.mode,
        { contentPreview: userContent.substring(0, 100) },
      );

      // Update chat title if first message
      if (!chat.title) {
        const title =
          userContent.length > 50
            ? userContent.substring(0, 50) + '...'
            : userContent;
        await this.chatHistoryService.updateTitle(id, title);
      }

      // Run agent with same runId for idempotency
      const history = await this.messageService.findByChatHistoryId(id);
      const workspaceRoot = await this.resolveWorkspaceRoot(chat.workspaceId);
      const agentResult = await this.agentRunnerService.runAgentSync({
        chatId: id,
        userContent: userContent,
        chatMode: chat.mode as 'chat' | 'workspace',
        workspaceId: chat.workspaceId,
        workspaceRoot,
        historyMessages: history.map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        })),
        idempotencyKey: runId,
      });

      // Create assistant message (idempotent - runAgentSync handles dedup)
      const assistantMessage = await this.messageService.createMessage({
        chatHistoryId: id,
        role: 'assistant',
        content: agentResult.content,
        idempotencyKey: `run:${runId}:assistant`,
        provenance: InputProvenanceFactory.internalSystem(),
      });

      // Record agent response event
      this.sessionEvents.record(
        SessionEventType.AGENT_RESPONSE,
        id,
        chat.mode,
        {
          runId,
          contentPreview: agentResult.content.substring(0, 100),
          toolCount: agentResult.toolOutputs.length,
          artifactCount: agentResult.artifacts.length,
        },
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
    @Body()
    body: {
      content: string;
      idempotencyKey?: string;
      reasoningEffort?: string;
    },
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      const chat = await this.chatHistoryService.findById(id);
      if (!chat) {
        res.write(
          `data: ${JSON.stringify({ type: 'error', data: { message: 'Chat not found' } })}\n\n`,
        );
        return res.end();
      }

      const injectionResult = this.injectionDetector.scan(body.content);
      if (injectionResult.detected && injectionResult.severity !== 'low') {
        this.injectionDetector.logDetection(id, body.content, injectionResult);
        res.write(
          `data: ${JSON.stringify({ type: 'error', data: { message: 'Potential prompt injection detected. Request blocked.' } })}\n\n`,
        );
        return res.end();
      }

      const userContent = injectionResult.detected
        ? injectionResult.sanitized
        : body.content;

      const runId = body.idempotencyKey || randomUUID();

      // Late media check — release stale active turns older than 10s
      const activeTurn = this.transcriptService.hasActiveTurn(id);
      if (activeTurn) {
        if (Date.now() - activeTurn.createdAt > 10_000) {
          this.transcriptService.markFailed(activeTurn.runId);
        } else {
          res.write(
            `data: ${JSON.stringify({ type: 'error', data: { message: 'Another request is being processed. Please wait.' } })}\n\n`,
          );
          return res.end();
        }
      }

      // Create user message with idempotency key
      await this.messageService.createMessage({
        chatHistoryId: id,
        role: 'user',
        content: userContent,
        idempotencyKey: `run:${runId}`,
        provenance: InputProvenanceFactory.externalUser(),
      });

      // Record human message event
      this.sessionEvents.record(
        SessionEventType.HUMAN_DIRECT_MESSAGE,
        id,
        chat.mode,
        { contentPreview: userContent.substring(0, 100) },
      );

      // Update chat title if first message
      if (!chat.title) {
        const title =
          userContent.length > 50
            ? userContent.substring(0, 50) + '...'
            : userContent;
        await this.chatHistoryService.updateTitle(id, title);
      }

      const history = await this.messageService.findByChatHistoryId(id);
      const workspaceRoot = await this.resolveWorkspaceRoot(chat.workspaceId);
      const finalContent = await this.agentRunnerService.runAgentStream(
        {
          chatId: id,
          userContent: userContent,
          chatMode: chat.mode as 'chat' | 'workspace',
          workspaceId: chat.workspaceId,
          workspaceRoot,
          historyMessages: history.map((m) => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
          })),
          idempotencyKey: runId,
          reasoningEffort: body.reasoningEffort,
        },
        (event) => {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        },
      );

      // Create assistant message (idempotent - agentRunner handles dedup)
      await this.messageService.createMessage({
        chatHistoryId: id,
        role: 'assistant',
        content: finalContent,
        idempotencyKey: `run:${runId}:assistant`,
        provenance: InputProvenanceFactory.internalSystem(),
      });

      // Record agent response event
      this.sessionEvents.record(
        SessionEventType.AGENT_RESPONSE,
        id,
        chat.mode,
        { runId, contentPreview: finalContent.substring(0, 100) },
      );

      res.end();
    } catch (error) {
      // Mark any active transcript turn as failed so hasActiveTurn releases the lock
      const stuckTurn = this.transcriptService.hasActiveTurn(id);
      if (stuckTurn) {
        this.transcriptService.markFailed(stuckTurn.runId);
      }
      res.write(
        `data: ${JSON.stringify({ type: 'error', data: { message: error.message } })}\n\n`,
      );
      res.end();
    }
  }

  @Get('providers/status')
  async getProviderPoolStatus() {
    try {
      const providers = await this.providerService.findAllForPool();
      return successResponse(
        providers.map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type,
          model: p.model,
          active: p.active,
          priority: p.priority,
          lastUsedAt: p.lastUsedAt,
          lastErrorAt: p.lastErrorAt,
          lastError: p.lastError,
          cooldownUntil: p.cooldownUntil,
          inCooldown: p.cooldownUntil
            ? new Date(p.cooldownUntil) > new Date()
            : false,
        })),
      );
    } catch (error) {
      return errorResponse('FETCH_FAILED', error.message);
    }
  }
}
