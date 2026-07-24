import { Controller, Get, Post, Put, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { WorkspaceService } from './workspace.service.js';
import { CreateWorkspaceDto, UpdateWorkspaceDto } from './dtos/workspace.dto.js';
import { successResponse, errorResponse } from '../../common/dtos/api-response.dto.js';

@Controller('workspaces')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

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
}
