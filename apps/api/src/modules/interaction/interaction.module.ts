import { Module, Global } from '@nestjs/common';
import { BrowserInteractionService } from './browser-interaction.service.js';
import { DesktopBridgeService } from './desktop-bridge.service.js';

@Global()
@Module({
  providers: [BrowserInteractionService, DesktopBridgeService],
  exports: [BrowserInteractionService, DesktopBridgeService],
})
export class InteractionModule {}