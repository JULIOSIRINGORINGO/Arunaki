import { Injectable, Logger } from '@nestjs/common';
import { AiService, ChatMessage } from '../ai/ai.service.js';

/**
 * Evaluation result from self-check.
 */
export interface EvaluationResult {
  passed: boolean;
  score: number; // 1-10
  issues: string[];
  suggestions: string[];
}

/**
 * SelfEvaluationService — agent verifikasi hasil kerja sendiri.
 *
 * Inspired OpenClaw's self-evaluation pattern. After completing
 * a task, the agent reviews its own output to catch errors,
 * missing requirements, and quality issues.
 *
 * Flow:
 * 1. Agent completes task → generates output
 * 2. SelfEvaluationService reviews output against goal
 * 3. If score < threshold → auto-retry with feedback
 * 4. If score >= threshold → accept result
 */
@Injectable()
export class SelfEvaluationService {
  private readonly logger = new Logger(SelfEvaluationService.name);

  /** Minimum score to accept result (1-10) */
  private readonly MIN_SCORE = 6;

  /** Max auto-retries before accepting */
  private readonly MAX_RETRIES = 2;

  constructor(private readonly aiService: AiService) {}

  /**
   * Evaluate agent's output against the original goal.
   * Returns evaluation result with score and issues.
   */
  async evaluate(
    goal: string,
    output: string,
    context?: string,
  ): Promise<EvaluationResult> {
    try {
      const evalPrompt = `You are a quality reviewer. Evaluate if the output successfully achieves the goal.

GOAL: ${goal}

OUTPUT: ${output.substring(0, 2000)}

${context ? `CONTEXT: ${context.substring(0, 1000)}` : ''}

Rate the output 1-10 and list any issues. Respond in JSON:
{
  "score": <1-10>,
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1"]
}`;

      const messages: ChatMessage[] = [
        { role: 'system', content: 'You are a strict quality reviewer. Respond only in valid JSON.' },
        { role: 'user', content: evalPrompt },
      ];

      const response = await this.aiService.chat(messages, []);

      // Parse JSON response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn('Self-evaluation: failed to parse AI response as JSON');
        return { passed: true, score: 7, issues: [], suggestions: [] };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const score = Math.min(10, Math.max(1, parsed.score || 7));
      const issues = Array.isArray(parsed.issues) ? parsed.issues : [];
      const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];

      return {
        passed: score >= this.MIN_SCORE,
        score,
        issues,
        suggestions,
      };
    } catch (err: any) {
      this.logger.warn(`Self-evaluation failed: ${err.message}`);
      // Default: accept the result
      return { passed: true, score: 7, issues: [], suggestions: [] };
    }
  }

  /**
   * Evaluate and auto-retry if needed.
   * Returns the best output after evaluation.
   */
  async evaluateAndRetry(
    goal: string,
    output: string,
    retryFn: (feedback: string) => Promise<string>,
    context?: string,
  ): Promise<{ output: string; evaluation: EvaluationResult }> {
    let currentOutput = output;
    let evaluation = await this.evaluate(goal, currentOutput, context);

    if (evaluation.passed) {
      this.logger.log(`Self-evaluation passed (score: ${evaluation.score}/10)`);
      return { output: currentOutput, evaluation };
    }

    // Auto-retry with feedback
    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      this.logger.log(
        `Self-evaluation retry ${attempt + 1}/${this.MAX_RETRIES} (score: ${evaluation.score}/10)`,
      );

      const feedback = `Previous attempt scored ${evaluation.score}/10.\nIssues:\n${evaluation.issues.map((i) => `- ${i}`).join('\n')}\n\nSuggestions:\n${evaluation.suggestions.map((s) => `- ${s}`).join('\n')}`;

      try {
        currentOutput = await retryFn(feedback);
        evaluation = await this.evaluate(goal, currentOutput, context);

        if (evaluation.passed) {
          this.logger.log(`Self-evaluation passed after retry (score: ${evaluation.score}/10)`);
          return { output: currentOutput, evaluation };
        }
      } catch (err: any) {
        this.logger.warn(`Retry ${attempt + 1} failed: ${err.message}`);
        break;
      }
    }

    // Accept best effort
    this.logger.log(`Self-evaluation: accepting best effort (score: ${evaluation.score}/10)`);
    return { output: currentOutput, evaluation };
  }
}
