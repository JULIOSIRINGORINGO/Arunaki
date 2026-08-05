import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Run-level token budget enforcement.
 *
 * A budget is bound to the active run via AsyncLocalStorage, so every
 * aiService.chat() call in that run — including calls made by sub-agents
 * spawned via agent_spawn — consumes from the SAME pool. Sub-agents inherit
 * the parent's remaining budget instead of getting an independent one.
 *
 * Threshold is configurable via env RUN_TOKEN_BUDGET (default 200_000).
 */

const DEFAULT_TOKEN_BUDGET =
  Number(process.env.RUN_TOKEN_BUDGET) || 200_000;

const als = new AsyncLocalStorage<RunTokenBudget>();

export class RunTokenBudget {
  used = 0;

  constructor(readonly limit: number = DEFAULT_TOKEN_BUDGET) {}

  consume(totalTokens: number): void {
    if (Number.isFinite(totalTokens) && totalTokens > 0) {
      this.used += totalTokens;
    }
  }

  get remaining(): number {
    return Math.max(0, this.limit - this.used);
  }

  get exceeded(): boolean {
    return this.used >= this.limit;
  }
}

export function createRunBudget(
  limit: number = Number(process.env.RUN_TOKEN_BUDGET) || DEFAULT_TOKEN_BUDGET,
): RunTokenBudget {
  return new RunTokenBudget(limit);
}

/** Bind a budget to the current async context (the active run). */
export function enterRunBudget(budget: RunTokenBudget): void {
  als.enterWith(budget);
}

/** Budget of the active run, shared with sub-agents spawned within it. */
export function currentRunBudget(): RunTokenBudget | undefined {
  return als.getStore();
}
