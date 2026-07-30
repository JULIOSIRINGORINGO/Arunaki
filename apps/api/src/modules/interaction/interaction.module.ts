import { Module, Global } from '@nestjs/common';
import { BrowserInteractionService } from './browser-interaction.service.js';

@Global()
@Module({
  providers: [BrowserInteractionService],
  exports: [BrowserInteractionService],
})
export class InteractionModule {}