import { Module } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { ContextManager } from './context-manager.js';
import { SelfEvaluationService } from './self-evaluation.service.js';
import { ModelRouterService } from './model-router.service.js';
import { PromptInjectionDetector } from './prompt-injection-detector.service.js';
import { ProviderModule } from '../provider/provider.module.js';

@Module({
  imports: [ProviderModule],
  providers: [AiService, ContextManager, SelfEvaluationService, ModelRouterService, PromptInjectionDetector],
  exports: [AiService, ContextManager, SelfEvaluationService, ModelRouterService, PromptInjectionDetector],
})
export class AiModule {}
