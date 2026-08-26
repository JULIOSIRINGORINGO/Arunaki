import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  RunTokenBudget,
  createRunBudget,
  enterRunBudget,
  currentRunBudget,
} from './token-budget.service.js';

describe('token-budget.service', () => {
  const originalEnv = process.env.RUN_TOKEN_BUDGET;

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.RUN_TOKEN_BUDGET;
    else process.env.RUN_TOKEN_BUDGET = originalEnv;
  });

  it('accumulates usage across rounds and flips exceeded at the limit', () => {
    const budget = new RunTokenBudget(100);
    budget.consume(60);
    expect(budget.exceeded).toBe(false);
    expect(budget.remaining).toBe(40);
    budget.consume(50);
    expect(budget.exceeded).toBe(true);
    expect(budget.used).toBe(110);
    expect(budget.remaining).toBeLessThanOrEqual(0);
  });

  it('ignores non-finite or non-positive consumption', () => {
    const budget = new RunTokenBudget(100);
    budget.consume(Number.NaN);
    budget.consume(-5);
    budget.consume(0);
    expect(budget.used).toBe(0);
  });

  it('createRunBudget honors RUN_TOKEN_BUDGET env, else default 200k', () => {
    process.env.RUN_TOKEN_BUDGET = '5000';
    expect(createRunBudget().limit).toBe(5000);
    delete process.env.RUN_TOKEN_BUDGET;
    expect(createRunBudget().limit).toBe(200_000);
  });

  it('ALS propagates the budget into nested async scopes (sub-agents inherit)', async () => {
    const parent = createRunBudget(1000);
    enterRunBudget(parent);

    const childUsed = await (async () => {
      const child = currentRunBudget();
      child?.consume(300);
      return child?.used;
    })();

    expect(childUsed).toBe(300);
    expect(currentRunBudget()?.used).toBe(300);
  });

  it('currentRunBudget returns undefined outside a run', () => {
    expect(currentRunBudget()).toBeUndefined();
  });
});
