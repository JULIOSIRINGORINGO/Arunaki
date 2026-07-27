import { Module } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { ProviderModule } from '../provider/provider.module.js';

@Module({
  imports: [ProviderModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
