import { Module, Global } from '@nestjs/common';
import { BrowserInteractionService } from './browser-interaction.service.js';
import {
  DesktopBridgeService,
  DESKTOP_BRIDGE_PORT,
} from './desktop-bridge.service.js';
import { ExcelComService } from './excel-com.service.js';
import { WordComService } from './word-com.service.js';
import { PptComService } from './ppt-com.service.js';

@Global()
@Module({
  providers: [
    BrowserInteractionService,
    DesktopBridgeService,
    ExcelComService,
    WordComService,
    PptComService,
    { provide: DESKTOP_BRIDGE_PORT, useValue: 31524 },
  ],
  exports: [
    BrowserInteractionService,
    DesktopBridgeService,
    ExcelComService,
    WordComService,
    PptComService,
  ],
})
export class InteractionModule {}
