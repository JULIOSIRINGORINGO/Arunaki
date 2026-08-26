import { Controller, Get } from '@nestjs/common';
import { successResponse } from './common/dtos/api-response.dto.js';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return successResponse({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  }
}
