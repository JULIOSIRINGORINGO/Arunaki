import { Module, forwardRef } from '@nestjs/common';
import { AgentRuntime } from './agent-runtime.service.js';
import { TaskClassifier } from './task-classifier.service.js';
import { PlannerService, VerifierService } from './planner.service.js';
import { RecoveryManager } from './recovery.service.js';
import { AiModule } from '../ai/ai.module.js';
import { ToolsModule } from '../tools/tools.module.js';
import { ChatModule } from '../chat/chat.module.js';
import { ContextModule } from '../ai/context/context.module.js';

@Module({
  imports: [
    forwardRef(() => AiModule),
    forwardRef(() => ToolsModule),
    forwardRef(() => ChatModule),
    ContextModule,
  ],
  providers: [AgentRuntime, TaskClassifier, PlannerService, VerifierService, RecoveryManager],
  exports: [AgentRuntime, TaskClassifier, PlannerService, VerifierService, RecoveryManager],
})
export class AgentRuntimeModule {}