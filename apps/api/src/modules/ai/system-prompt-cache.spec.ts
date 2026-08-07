import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  SYSTEM_PROMPT_CACHE_BOUNDARY,
  splitSystemPromptCacheBoundary,
  prependSystemPromptAdditionAfterCacheBoundary,
  cacheStablePromptPrefix,
} from '../ai/system-prompt-cache.js';

describe('system-prompt-cache', () => {
  it('boundary marker exists', () => {
    expect(SYSTEM_PROMPT_CACHE_BOUNDARY).toContain('CACHE_BOUNDARY');
  });

  it('splits stable prefix and dynamic suffix', () => {
    const prompt = `## Identity\nstable${SYSTEM_PROMPT_CACHE_BOUNDARY}## Tools\ndynamic`;
    const split = splitSystemPromptCacheBoundary(prompt)!;
    expect(split.stablePrefix).toContain('## Identity');
    expect(split.stablePrefix).not.toContain('## Tools');
    expect(split.dynamicSuffix).toContain('## Tools');
  });

  it('prepends dynamic content after boundary, keeping prefix intact', () => {
    const stable = `## Identity\nfixed`;
    const prompt = prependSystemPromptAdditionAfterCacheBoundary({
      systemPrompt: stable,
      systemPromptAddition: '## Temporal\ntoday',
    });
    expect(prompt.startsWith(stable)).toBe(true);
    expect(prompt.indexOf('## Temporal') > prompt.indexOf('CACHE_BOUNDARY')).toBe(true);
  });

  it('caches stable prefix — same input, identical output, reused', () => {
    const build = () => `## X\n${Math.random()}`;
    const a = cacheStablePromptPrefix('k1', build);
    const b = cacheStablePromptPrefix('k1', build);
    expect(a).toBe(b);
  });

  it('stable prefix is byte-identical across different volatile suffixes', () => {
    const base = `## Identity\n## Rules\n## Memory\n## Verification`;
    const p1 = `${base}${SYSTEM_PROMPT_CACHE_BOUNDARY}tools-A\nworkspace-X\n${new Date().toISOString()}`;
    const p2 = `${base}${SYSTEM_PROMPT_CACHE_BOUNDARY}tools-B\nworkspace-Y\n${new Date().toISOString()}`;
    const h1 = createHash('sha256').update(splitSystemPromptCacheBoundary(p1)!.stablePrefix).digest('hex');
    const h2 = createHash('sha256').update(splitSystemPromptCacheBoundary(p2)!.stablePrefix).digest('hex');
    expect(h1).toBe(h2);
  });
});
