import { Module, forwardRef } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { ContextManager } from './context-manager.js';
import { SelfEvaluationService } from './self-evaluation.service.js';
import { ModelRouterService } from './model-router.service.js';
import { PromptInjectionDetector } from './prompt-injection-detector.service.js';
import { AutoPostureDetector } from './auto-posture-detector.service.js';
import { AutonomousPlannerService } from './autonomous-planner.service.js';
import { SelfHealingService } from './self-healing.service.js';
import { WorkspaceHeartbeatService } from './workspace-heartbeat.service.js';
import { ToolLoopDetectorService } from './tool-loop-detector.service.js';
import { CompactionService } from './compaction.service.js';
import { ProviderModule } from '../provider/provider.module.js';
import { ToolsModule } from '../tools/tools.module.js';
import { MemoryModule } from '../memory/memory.module.js';
import { ContextModule } from './context/context.module.js';

@Module({
  imports: [
    ProviderModule,
    forwardRef(() => ToolsModule),
    forwardRef(() => MemoryModule),
    ContextModule,
  ],
  providers: [
    AiService,
    ContextManager,
    SelfEvaluationService,
    ModelRouterService,
    PromptInjectionDetector,
    AutoPostureDetector,
    AutonomousPlannerService,
    SelfHealingService,
    WorkspaceHeartbeatService,
    ToolLoopDetectorService,
    CompactionService,
  ],
  exports: [
    AiService,
    ContextManager,
    SelfEvaluationService,
    ModelRouterService,
    PromptInjectionDetector,
    AutoPostureDetector,
    AutonomousPlannerService,
    SelfHealingService,
    WorkspaceHeartbeatService,
    ToolLoopDetectorService,
    CompactionService,
    ContextModule,
  ],
})
export class AiModule {}
