import { Injectable, Logger } from '@nestjs/common';
import { AiService, ChatMessage } from '../ai/ai.service.js';

export interface TaskStep {
  id: number;
  description: string;
  toolHint?: string;
  status: 'pending' | 'in_progress' | 'done' | 'failed' | 'skipped';
  result?: string;
  error?: string;
}

export interface ExecutionPlan {
  goal: string;
  reasoning: string;
  steps: TaskStep[];
  createdAt: Date;
}

/**
 * AutonomousPlannerService — Goal Decomposition & Reflection Loop.
 *
 * OpenClaw Pattern: Agent receives a high-level goal, breaks it into
 * sub-tasks, executes them sequentially with reflection after each step,
 * and self-corrects the plan if a step fails.
 *
 * Arunaki Adaptation: Sandboxed workspace context, Indonesian business
 * domain awareness, approval gates for destructive operations.
 */
@Injectable()
export class AutonomousPlannerService {
  private readonly logger = new Logger(AutonomousPlannerService.name);

  constructor(private readonly aiService: AiService) {}

  /**
   * Decompose a high-level goal into actionable sub-task steps.
   * Uses LLM to analyze the goal and produce a structured plan.
   */
  async decompose(
    goal: string,
    context: {
      availableTools: string[];
      workspaceFiles?: string[];
      domainId?: string;
      knowledgeContext?: string;
    },
  ): Promise<ExecutionPlan> {
    const toolList = context.availableTools.join(', ');
    const fileList = (context.workspaceFiles || []).slice(0, 30).join(', ');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Kamu adalah Autonomous Task Planner untuk bisnis Indonesia.
Tugasmu: pecah tujuan user menjadi langkah-langkah eksekusi yang jelas.

Tools yang tersedia: ${toolList}
File di workspace: ${fileList || '(belum ada file)'}
Domain bisnis: ${context.domainId || 'generic'}
${context.knowledgeContext ? `\nKonteks bisnis:\n${context.knowledgeContext.substring(0, 1000)}` : ''}

ATURAN:
- Setiap langkah harus bisa dieksekusi oleh satu tool call
- Urutkan dari yang paling fundamental (baca data dulu) ke yang paling kompleks (generate laporan)
- Jika tujuan memerlukan persetujuan (hapus/ubah file), tandai di deskripsi langkah
- Maksimal 10 langkah

Respond dalam JSON format:
{
  "reasoning": "penjelasan singkat kenapa plan ini dibuat",
  "steps": [
    { "id": 1, "description": "...", "toolHint": "nama_tool_yang_disarankan" },
    ...
  ]
}`,
      },
      { role: 'user', content: goal },
    ];

    try {
      const response = await this.aiService.chat(messages, []);
      const parsed = this.parseJsonFromResponse(response.content);

      const steps: TaskStep[] = (parsed.steps || []).map(
        (s: any, i: number) => ({
          id: s.id || i + 1,
          description: s.description || `Langkah ${i + 1}`,
          toolHint: s.toolHint,
          status: 'pending' as const,
        }),
      );

      const plan: ExecutionPlan = {
        goal,
        reasoning: parsed.reasoning || 'Plan generated from goal decomposition',
        steps,
        createdAt: new Date(),
      };

      this.logger.log(
        `Plan created: ${steps.length} steps for goal "${goal.substring(0, 60)}..."`,
      );
      return plan;
    } catch (err: any) {
      this.logger.error(`Plan decomposition failed: ${err.message}`);
      // Fallback: single-step plan
      return {
        goal,
        reasoning: 'Fallback plan — goal could not be decomposed',
        steps: [{ id: 1, description: goal, status: 'pending' }],
        createdAt: new Date(),
      };
    }
  }

  /**
   * Reflect on the result of a completed step.
   * Determines if the plan needs adjustment based on what was learned.
   */
  async reflect(
    plan: ExecutionPlan,
    completedStepId: number,
    stepResult: string,
  ): Promise<{
    shouldContinue: boolean;
    planAdjustment?: string;
    newSteps?: TaskStep[];
  }> {
    const completedStep = plan.steps.find((s) => s.id === completedStepId);
    if (!completedStep) return { shouldContinue: true };

    const remainingSteps = plan.steps.filter((s) => s.status === 'pending');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Kamu adalah Reflection Agent. Evaluasi hasil eksekusi langkah sebelumnya
dan tentukan apakah plan perlu diubah.

Tujuan awal: ${plan.goal}
Langkah yang baru selesai: ${completedStep.description}
Hasil: ${stepResult.substring(0, 2000)}
Langkah tersisa: ${remainingSteps.map((s) => `${s.id}. ${s.description}`).join('\n')}

Respond dalam JSON:
{
  "shouldContinue": true/false,
  "reason": "...",
  "planAdjustment": "deskripsi perubahan jika ada" atau null,
  "newSteps": [] atau null
}`,
      },
      { role: 'user', content: 'Evaluasi dan berikan rekomendasi.' },
    ];

    try {
      const response = await this.aiService.chat(messages, []);
      const parsed = this.parseJsonFromResponse(response.content);

      return {
        shouldContinue: parsed.shouldContinue !== false,
        planAdjustment: parsed.planAdjustment || undefined,
        newSteps: parsed.newSteps
          ? parsed.newSteps.map((s: any, i: number) => ({
              id: 100 + i,
              description: s.description,
              toolHint: s.toolHint,
              status: 'pending' as const,
            }))
          : undefined,
      };
    } catch {
      return { shouldContinue: true };
    }
  }

  /**
   * Parse JSON from LLM response text (handles markdown code blocks).
   */
  private parseJsonFromResponse(text: string): any {
    // Strip markdown code fences
    let cleaned = text
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();
    // Find JSON object boundaries
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      cleaned = cleaned.substring(start, end + 1);
    }
    return JSON.parse(cleaned);
  }
}
