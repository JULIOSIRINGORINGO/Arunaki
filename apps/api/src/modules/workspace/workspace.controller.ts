import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { WorkspaceService } from './workspace.service.js';
import { WorkspaceInitService } from './workspace-init.service.js';
import { WorkspaceRunnerService } from './workspace-runner.service.js';
import {
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
} from './dtos/workspace.dto.js';
import {
  successResponse,
  errorResponse,
} from '../../common/dtos/api-response.dto.js';

@Controller('workspaces')
export class WorkspaceController {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly workspaceInitService: WorkspaceInitService,
    private readonly workspaceRunnerService: WorkspaceRunnerService,
  ) {}

  @Post()
  async create(@Body() dto: CreateWorkspaceDto) {
    try {
      const workspace = await this.workspaceService.create(dto);
      return successResponse(workspace);
    } catch (error) {
      return errorResponse('CREATE_FAILED', error.message);
    }
  }

  @Get()
  async findAll() {
    try {
      const workspaces = await this.workspaceService.findAll();
      return successResponse(workspaces);
    } catch (error) {
      return errorResponse('FETCH_FAILED', error.message);
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const workspace = await this.workspaceService.findById(id);
      return successResponse(workspace);
    } catch (error) {
      return errorResponse('NOT_FOUND', error.message);
    }
  }

  @Get(':id/analysis')
  async getAnalysis(@Param('id') id: string) {
    try {
      const workspace = await this.workspaceService.findById(id);
      return successResponse({
        analysisResult: workspace.analysisResult || null,
        analyzedAt: workspace.analyzedAt || null,
      });
    } catch (error) {
      return errorResponse('NOT_FOUND', error.message);
    }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateWorkspaceDto) {
    try {
      const workspace = await this.workspaceService.update(id, dto);
      return successResponse(workspace);
    } catch (error) {
      return errorResponse('UPDATE_FAILED', error.message);
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    try {
      await this.workspaceService.delete(id);
      return successResponse(null);
    } catch (error) {
      return errorResponse('DELETE_FAILED', error.message);
    }
  }

  @Post(':id/connect-folder')
  async connectFolder(
    @Param('id') id: string,
    @Body() body: { folderPath: string },
  ) {
    try {
      const result = await this.workspaceService.connectFolder(id, body.folderPath);
      return successResponse(result);
    } catch (error) {
      return errorResponse('CONNECT_FOLDER_FAILED', error.message);
    }
  }

  @Post(':id/initialize')
  async initialize(@Param('id') id: string) {
    try {
      const progress = await this.workspaceInitService.initialize(id);
      return successResponse(progress);
    } catch (error) {
      return errorResponse('INIT_FAILED', error.message);
    }
  }

  @Post(':id/agent/stream')
  async streamAgent(
    @Param('id') id: string,
    @Body()
    body: { goal: string; historyMessages?: any[] },
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      const workspace = await this.workspaceService.findById(id);
      if (!workspace) {
        res.write(
          `data: ${JSON.stringify({ type: 'error', data: { message: 'Workspace not found' } })}\n\n`,
        );
        return res.end();
      }

      await this.workspaceRunnerService.runWorkspaceAgentStream(
        {
          workspaceId: id,
          userGoal: body.goal,
          historyMessages: body.historyMessages || [
            { role: 'user', content: body.goal },
          ],
        },
        (event) => {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        },
      );

      res.end();
    } catch (error) {
      res.write(
        `data: ${JSON.stringify({ type: 'error', data: { message: error.message } })}\n\n`,
      );
      res.end();
    }
  }

  @Post(':id/agent/stream/generator')
  async streamAgentGenerator(
    @Param('id') id: string,
    @Body()
    body: { goal: string; historyMessages?: any[] },
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      const workspace = await this.workspaceService.findById(id);
      if (!workspace) {
        res.write(
          `data: ${JSON.stringify({ type: 'error', data: { message: 'Workspace not found' } })}\n\n`,
        );
        return res.end();
      }

      const generator = this.workspaceRunnerService.runWorkspaceAgentGenerator({
        workspaceId: id,
        userGoal: body.goal,
        historyMessages: body.historyMessages || [
          { role: 'user', content: body.goal },
        ],
      });

      for await (const event of generator) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }

      res.end();
    } catch (error) {
      res.write(
        `data: ${JSON.stringify({ type: 'error', data: { message: error.message } })}\n\n`,
      );
      res.end();
    }
  }

  @Post(':id/agent/abort')
  async abortAgent(@Param('id') id: string) {
    try {
      const aborted = this.workspaceRunnerService.abortRun(
        id,
        'User cancelled',
      );
      return successResponse({
        aborted,
        message: aborted
          ? 'Analisis sedang dibatalkan.'
          : 'Tidak ada analisis yang sedang berjalan.',
      });
    } catch (error) {
      return errorResponse('ABORT_FAILED', error.message);
    }
  }

  @Post(':id/agent/steer')
  async steerAgent(
    @Param('id') id: string,
    @Body() body: { message: string },
  ) {
    try {
      const queued = this.workspaceRunnerService.addSteeringInput(
        id,
        body.message,
      );
      return successResponse({
        queued,
        message: queued
          ? 'Follow-up diterima dan akan diproses.'
          : 'Tidak ada analisis yang sedang berjalan untuk menerima follow-up.',
      });
    } catch (error) {
      return errorResponse('STEER_FAILED', error.message);
    }
  }

  @Post(':id/agent/approve')
  async approveAgent(
    @Param('id') id: string,
    @Body() body: { approved: boolean },
  ) {
    try {
      const resolved = this.workspaceRunnerService.resolveApproval(
        id,
        body.approved,
      );
      return successResponse({
        resolved,
        message: resolved
          ? body.approved
            ? 'Aksi disetujui.'
            : 'Aksi ditolak.'
          : 'Tidak ada aksi yang menunggu persetujuan.',
      });
    } catch (error) {
      return errorResponse('APPROVE_FAILED', error.message);
    }
  }

  @Get(':id/agent/state')
  async getAgentState(@Param('id') id: string) {
    try {
      const state = this.workspaceRunnerService.getRunState(id);
      return successResponse({
        isRunning: this.workspaceRunnerService.isRunning(id),
        state: state
          ? {
              state: state.state,
              goal: state.goal,
              round: state.round,
              startedAt: state.startedAt,
            }
          : null,
      });
    } catch (error) {
      return errorResponse('STATE_FAILED', error.message);
    }
  }
}
