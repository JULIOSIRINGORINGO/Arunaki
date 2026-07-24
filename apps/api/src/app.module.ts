import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { ConfigModule } from './config/config.module.js';
import { PrismaModule } from './common/providers/prisma.module.js';
import { LoggerModule } from './logger/logger.module.js';
import { WorkspaceModule } from './modules/workspace/workspace.module.js';

@Module({
  imports: [ConfigModule, PrismaModule, LoggerModule, WorkspaceModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
