import { Module, Global } from '@nestjs/common';
import { BrowserInteractionService } from './browser-interaction.service.js';
import { DesktopBridgeService, DESKTOP_BRIDGE_PORT } from './desktop-bridge.service.js';

@Global()
@Module({
  providers: [
    BrowserInteractionService,
    DesktopBridgeService,
    { provide: DESKTOP_BRIDGE_PORT, useValue: 31524 },
  ],
  exports: [BrowserInteractionService, DesktopBridgeService],
})
export class InteractionModule {}