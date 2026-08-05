import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Headers,
  NotFoundException,
} from '@nestjs/common';
import { CronService, CreateScheduleDto } from './cron.service.js';

@Controller('workspaces/:workspaceId/schedules')
export class CronController {
  constructor(private readonly cronService: CronService) {}

  @Get()
  async getSchedules(@Param('workspaceId') workspaceId: string) {
    const schedules = await this.cronService.getSchedules(workspaceId);
    return {
      data: schedules,
      error: null,
    };
  }

  @Post()
  async createSchedule(
    @Param('workspaceId') workspaceId: string,
    @Body() body: Omit<CreateScheduleDto, 'workspaceId'>,
  ) {
    const schedule = await this.cronService.createSchedule({
      ...body,
      workspaceId,
    });
    return {
      data: schedule,
      error: null,
    };
  }

  @Patch(':id/toggle')
  async toggleSchedule(
    @Param('id') id: string,
    @Headers('x-workspace-id') workspaceId: string = 'default-workspace',
  ) {
    const updated = await this.cronService.toggleSchedule(id, workspaceId);
    if (!updated) {
      throw new NotFoundException(`Schedule "${id}" not found.`);
    }
    return {
      data: updated,
      error: null,
    };
  }

  @Delete(':id')
  async deleteSchedule(
    @Param('id') id: string,
    @Headers('x-workspace-id') workspaceId: string = 'default-workspace',
  ) {
    await this.cronService.deleteSchedule(id, workspaceId);
    return {
      data: { success: true },
      error: null,
    };
  }

  @Post(':id/run')
  async triggerRun(@Param('id') id: string) {
    const artifact = await this.cronService.triggerScheduleRun(id);
    return {
      data: artifact,
      error: null,
    };
  }
}
