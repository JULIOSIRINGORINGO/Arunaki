import { Injectable, Logger } from '@nestjs/common';
import type { AgentIntent, RuntimeContext } from './runtime.types.js';

/**
 * TaskClassifier — OpenClaw pattern: no regex intent routing.
 *
 * Intent classification is intentionally neutral here: tool selection is
 * delegated to the LLM loop via native Function Calling, exactly like
 * OpenClaw's agent-loop (which has no keyword classifier at all).
 *
 * The returned intent only marks what verification/approval the node needs,
 * never which tool to use — that would duplicate LLM reasoning and risk
 * goal mutation (e.g. classifying "ganti nama" as "write").
 */
@Injectable()
export class TaskClassifier {
  private readonly logger = new Logger(TaskClassifier.name);

  classify(_goal: string, context: RuntimeContext): AgentIntent {
    this.logger.debug(
      `Neutral intent for "${_goal.substring(0, 60)}" — tool selection left to LLM loop`,
    );
    return {
      category: 'planning',
      goal: _goal,
      confidence: 0.5,
      requiresVerification: false,
      requiresApproval: false,
      estimatedSteps: 1,
      suggestedToolHints: [],
    };
  }
}
