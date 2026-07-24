import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { ConfigModule } from './config/config.module.js';
import { PrismaModule } from './common/providers/prisma.module.js';
import { LoggerModule } from './logger/logger.module.js';
import { WorkspaceModule } from './modules/workspace/workspace.module.js';
import { SourceModule } from './modules/source/source.module.js';
import { ChatModule } from './modules/chat/chat.module.js';
import { AiModule } from './modules/ai/ai.module.js';
import { FileModule } from './modules/file/file.module.js';
import { ParserModule } from './modules/parser/parser.module.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { SearchModule } from './modules/search/search.module.js';
import { ArtifactModule } from './modules/artifact/artifact.module.js';

@Module({
  imports: [ConfigModule, PrismaModule, LoggerModule, WorkspaceModule, SourceModule, ChatModule, AiModule, FileModule, ParserModule, StorageModule, SearchModule, ArtifactModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
