import { Logger } from '@nestjs/common';
import { ChatMessage } from './ai.service.js';
import { countTokens } from './tokenizer.js';

export interface ContextConfig {
  /** Context window size (tokens) */
  contextLength: number;
  /** Threshold to trigger compression (0.0 - 1.0, default 0.50) */
  threshold: number;
  /** Ratio of threshold allocated for tail messages (default 0.20) */
  targetRatio: number;
  /** Max chars for tool result before pruning */
  toolPruneChars: number;
  /** Chars to keep in pruned tool preview */
  toolPreviewChars: number;
  /** Max chars per skill/memory injected into system prompt */
  injectionMaxChars: number;
  /** Enable LLM-based summary (requires AiService) */
  useLlmSummary: boolean;
}

const DEFAULT_CONFIG: ContextConfig = {
  contextLength: 16000,
  threshold: 0.35, // Aggressive compression trigger at 35% budget (~5.6k tokens)
  targetRatio: 0.35, // Keep 35% for the tail messages
  toolPruneChars: 1000, // Keep tool outputs under 1000 chars
  toolPreviewChars: 200, // Lightweight tool preview
  injectionMaxChars: 2000, // Knowledge injection budget; URL filtering keeps this lean
  useLlmSummary: false,
};

// Preemptive pressure-estimation constants (OpenClaw preemptive-compaction):
// tool results tokenize denser than prose (CSV/JSON tables), so they get a
// tighter chars-per-token ratio. Overheads model message/block framing that a
// naive char/4 estimator misses.
export const ESTIMATED_CHARS_PER_TOKEN = 4;
export const TOOL_RESULT_CHARS_PER_TOKEN = 2;
export const JSON_PAYLOAD_CHARS_PER_TOKEN = 3;
export const MESSAGE_BOUNDARY_OVERHEAD_TOKENS = 12;
// ponytail: single threshold share, upgrade to soft-trim/hard-clear ratios if
// long-running sessions still overflow on small-context (32K) models.
export const AGGREGATE_TOOL_RESULT_CONTEXT_SHARE = 0.5;

/**
 * ContextManager — 4-phase context compression pipeline.
 *
 * Inspired OpenClaw's ContextCompressor, adapted for Arunaki web UI.
 *
 * Phase 1: Prune old tool results (cheap, no LLM call)
 * Phase 2: Strip old images (replace with placeholder)
 * Phase 3: Sanitize tool pairs (remove orphaned tool_call/tool_result)
 * Phase 4: Token-aware tail protection + summary generation (LLM or template)
 */
export class ContextManager {
  private readonly logger = new Logger(ContextManager.name);
  private readonly config: ContextConfig;
  private readonly aiService?: {
    chat: (
      messages: ChatMessage[],
      tools?: any[],
    ) => Promise<{ content: string }>;
  };

  constructor(
    config?: Partial<ContextConfig>,
    aiService?: {
      chat: (
        messages: ChatMessage[],
        tools?: any[],
      ) => Promise<{ content: string }>;
    },
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.aiService = aiService;
  }

  /**
   * Main entry point — run full compression pipeline.
   * Returns compressed messages ready for API call.
   * `contextLength` (optional) overrides the configured context so the
   * trigger threshold tracks the actual model window (e.g. 32K models).
   */
  async compress(
    messages: ChatMessage[],
    contextLength?: number,
  ): Promise<ChatMessage[]> {
    if (messages.length === 0) return messages;

    const effectiveContext = contextLength ?? this.config.contextLength;
    const tokenCount = this.estimateTokens(messages);
    const thresholdTokens = Math.floor(
      effectiveContext * this.config.threshold,
    );

    // Don't compress if under threshold
    if (tokenCount <= thresholdTokens) {
      return messages;
    }

    this.logger.log(
      `Context compression triggered: ${tokenCount} tokens > ${thresholdTokens} threshold (${effectiveContext} × ${this.config.threshold})`,
    );

    // Phase 1: Prune old tool results
    let result = this.pruneOldToolResults(messages);

    // Phase 2: Strip old images
    result = this.stripOldImages(result);

    // Phase 3: Sanitize tool pairs
    result = this.sanitizeToolPairs(result);

    // Phase 4: Token-aware tail protection + summary
    result = await this.protectTailAndSummarize(result, effectiveContext);

    const finalTokens = this.estimateTokens(result);
    this.logger.log(
      `Compression complete: ${tokenCount} → ${finalTokens} tokens (${Math.round((1 - finalTokens / tokenCount) * 100)}% reduction)`,
    );

    return result;
  }

  /**
   * Limit injected content (skills, memory) to max chars.
   * Returns truncated content with marker.
   */
  limitInjection(content: string, label: string): string {
    if (content.length <= this.config.injectionMaxChars) {
      return content;
    }

    const kept = this.config.injectionMaxChars;
    const truncated = content.substring(0, kept);
    this.logger.log(
      `Injection "${label}" truncated: ${content.length} → ${kept} chars`,
    );

    return `${truncated}\n\n[...truncated ${label}: kept ${kept} of ${content.length} chars. Use view_skill or search_memories for full content.]`;
  }

  // ─── Phase 1: Prune Old Tool Results ───────────────────────────────

  /**
   * Replace old tool results (> toolPruneChars) with preview.
   * Keeps the LAST 3 tool results unpruned (tail protection).
   */
  private pruneOldToolResults(messages: ChatMessage[]): ChatMessage[] {
    // Find indices of all tool messages
    const toolIndices: number[] = [];
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === 'tool') {
        toolIndices.push(i);
      }
    }

    if (toolIndices.length === 0) return messages;

    // Keep last 3 tool results unpruned
    const pruneThreshold = toolIndices.length - 3;
    if (pruneThreshold <= 0) return messages;

    return messages.map((msg, idx) => {
      if (
        msg.role === 'tool' &&
        msg.content &&
        msg.content.length > this.config.toolPruneChars &&
        toolIndices.indexOf(idx) < pruneThreshold
      ) {
        const preview = msg.content.substring(0, this.config.toolPreviewChars);
        return {
          ...msg,
          content: `[Old tool output cleared to save context space — ${msg.content.length} chars]\n${preview}\n...[truncated]`,
        };
      }
      return msg;
    });
  }

  // ─── Phase 2: Strip Old Images ─────────────────────────────────────

  /**
   * Replace old images (base64 in content) with placeholder.
   * Keeps the LAST 2 images unstripped.
   */
  private stripOldImages(messages: ChatMessage[]): ChatMessage[] {
    // Find messages with base64 images
    const imageIndices: number[] = [];
    for (let i = 0; i < messages.length; i++) {
      const content = messages[i].content || '';
      if (content.includes('data:image/') || content.includes('![image]')) {
        imageIndices.push(i);
      }
    }

    if (imageIndices.length <= 2) return messages;

    // Strip all but last 2 images
    const stripThreshold = imageIndices.length - 2;

    return messages.map((msg, idx) => {
      if (imageIndices.indexOf(idx) < stripThreshold) {
        const content = msg.content || '';
        // Replace base64 images with placeholder
        const cleaned = content.replace(
          /data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g,
          '[Image removed to save context space]',
        );
        if (cleaned !== content) {
          return { ...msg, content: cleaned };
        }
      }
      return msg;
    });
  }

  // ─── Phase 3: Tool Pair Sanitization ───────────────────────────────

  /**
   * Clean orphaned tool_call / tool_result pairs.
   * - If a tool_result references a tool_call_id that doesn't exist → remove it
   * - If a tool_call has no matching tool_result → inject stub result
   */
  private sanitizeToolPairs(messages: ChatMessage[]): ChatMessage[] {
    // Collect all tool_call IDs and tool_result IDs
    const callIds = new Set<string>();
    const resultIds = new Set<string>();

    for (const msg of messages) {
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          callIds.add(tc.id);
        }
      }
      if (msg.role === 'tool' && msg.tool_call_id) {
        resultIds.add(msg.tool_call_id);
      }
    }

    // Remove orphaned tool_results (no matching tool_call)
    const result = messages.filter((msg) => {
      if (
        msg.role === 'tool' &&
        msg.tool_call_id &&
        !callIds.has(msg.tool_call_id)
      ) {
        this.logger.debug(`Removing orphaned tool_result: ${msg.tool_call_id}`);
        return false;
      }
      return true;
    });

    // Inject stub results for tool_calls without results
    const newMessages: ChatMessage[] = [];
    for (const msg of result) {
      newMessages.push(msg);
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          if (!resultIds.has(tc.id)) {
            newMessages.push({
              role: 'tool',
              content: '[Tool result missing — context was compressed]',
              tool_call_id: tc.id,
              name: tc.function.name,
            });
          }
        }
      }
    }

    return newMessages;
  }

  // ─── Phase 4: Token-Aware Tail Protection ──────────────────────────

  /**
   * Protect recent messages by token budget, compress middle section.
   *
   * Structure:
   * [0..2]   ← system + first exchange (always preserved)
   * [3..N]   ← middle turns (compressed/summary)
   * [N..end] ← tail (preserved by token budget)
   */
  private async protectTailAndSummarize(
    messages: ChatMessage[],
    contextLength?: number,
  ): Promise<ChatMessage[]> {
    if (messages.length <= 5) return messages;

    // Split into system vs non-system
    const systemMessages: ChatMessage[] = [];
    const nonSystemMessages: ChatMessage[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemMessages.push(msg);
      } else {
        nonSystemMessages.push(msg);
      }
    }

    if (nonSystemMessages.length <= 4) return messages;

    // Protect first 3 non-system messages (first exchange)
    const PROTECT_FIRST = 3;
    const head = nonSystemMessages.slice(0, PROTECT_FIRST);
    const middle = nonSystemMessages.slice(PROTECT_FIRST);

    // Calculate tail token budget
    const thresholdTokens = Math.floor(
      (contextLength ?? this.config.contextLength) * this.config.threshold,
    );
    const tailBudget = Math.floor(thresholdTokens * this.config.targetRatio);

    // Walk backward from end to find tail boundary
    let tailTokens = 0;
    let tailStart = middle.length;

    for (let i = middle.length - 1; i >= 0; i--) {
      const msgTokens = this.estimateTokens([middle[i]]);
      if (tailTokens + msgTokens > tailBudget) break;
      tailTokens += msgTokens;
      tailStart = i;
    }

    // Ensure at least 1 user message in tail
    const tail = middle.slice(tailStart);
    const hasUserMessage = tail.some((m) => m.role === 'user');
    if (!hasUserMessage && middle.length > tailStart) {
      // Find last user message in middle and include it
      for (let i = tailStart - 1; i >= 0; i--) {
        if (middle[i].role === 'user') {
          tail.unshift(middle[i]);
          break;
        }
      }
    }

    const middleToCompress = middle.slice(0, tailStart);

    // Generate structured summary from middle section
    const summary = await this.generateSummary(middleToCompress);

    // Assemble: system + head + summary + tail
    const result: ChatMessage[] = [...systemMessages, ...head];

    // Add summary as a system message (role-safe)
    if (summary) {
      result.push({
        role: 'system',
        content: summary,
      });
    }

    // Add tail
    result.push(...tail);

    return result;
  }

  // ─── Summary Generation ────────────────────────────────────────────

  /**
   * Generate a structured summary from middle turns.
   * Uses LLM if available, falls back to template-based summary.
   */
  private async generateSummary(
    messages: ChatMessage[],
  ): Promise<string | null> {
    if (messages.length === 0) return null;

    // Try LLM-based summary first
    if (this.config.useLlmSummary && this.aiService) {
      try {
        return await this.generateLlmSummary(messages);
      } catch (err: any) {
        this.logger.warn(
          `LLM summary failed, falling back to template: ${err.message}`,
        );
      }
    }

    // Fallback: template-based summary
    return this.generateTemplateSummary(messages);
  }

  /**
   * LLM-based summary — generates intelligent compression.
   * Extracts Goal/Progress/Files/Decisions from conversation.
   */
  private async generateLlmSummary(messages: ChatMessage[]): Promise<string> {
    // Prepare messages for LLM (strip system messages, keep user/assistant/tool)
    const relevantMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant' | 'tool',
        content: m.content?.substring(0, 500) || '[tool call]',
      }));

    const summaryPrompt = `Summarize this conversation segment concisely. Include:
1. GOAL: What the user wanted
2. PROGRESS: What was accomplished
3. FILES: Any files created/modified
4. DECISIONS: Key decisions made

Conversation:
${relevantMessages.map((m) => `${m.role}: ${m.content}`).join('\n')}

Provide a concise summary (max 300 chars).`;

    const response = await this.aiService!.chat([
      {
        role: 'system',
        content: 'You are a conversation summarizer. Be concise.',
      },
      { role: 'user', content: summaryPrompt },
    ]);

    const summary = response.content?.substring(0, 500);
    if (summary) {
      const originalTokens = this.estimateTokens(messages);
      return `[LLM Summary — ~${originalTokens} tokens compressed]\n${summary}`;
    }

    // Fallback to template if LLM returns empty
    return this.generateTemplateSummary(messages) || '';
  }

  /**
   * Template-based summary — extracts key information without LLM.
   */
  private generateTemplateSummary(messages: ChatMessage[]): string | null {
    if (messages.length === 0) return null;

    const parts: string[] = ['[Context Summary — compressed for efficiency]'];

    // Extract tool calls
    const toolCalls: string[] = [];
    for (const msg of messages) {
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          toolCalls.push(tc.function.name);
        }
      }
    }
    if (toolCalls.length > 0) {
      parts.push(`Tools used: ${[...new Set(toolCalls)].join(', ')}`);
    }

    // Extract user messages (goals)
    const userMessages = messages
      .filter((m) => m.role === 'user')
      .map((m) => m.content?.substring(0, 200))
      .filter(Boolean);
    if (userMessages.length > 0) {
      parts.push(`User goals: ${userMessages.join(' | ')}`);
    }

    // Count messages by role
    const assistantCount = messages.filter(
      (m) => m.role === 'assistant',
    ).length;
    const toolCount = messages.filter((m) => m.role === 'tool').length;
    parts.push(
      `Exchange: ${assistantCount} assistant turns, ${toolCount} tool results`,
    );

    // Estimated tokens saved
    const originalTokens = this.estimateTokens(messages);
    parts.push(`[~${originalTokens} tokens compressed from this section]`);

    return parts.join('\n');
  }

  // ─── Token Estimation ──────────────────────────────────────────────

  /**
   * Pre-prompt pressure estimate (OpenClaw preemptive-compaction).
   * Runs BEFORE sending: if this exceeds the context budget minus the
   * max_tokens reserve, the caller compacts first instead of letting the
   * provider reject an over-budget prompt.
   */
  estimatePromptTokens(messages: ChatMessage[]): number {
    let total = 0;
    for (const msg of messages) {
      total += MESSAGE_BOUNDARY_OVERHEAD_TOKENS;
      const content = msg.content || '';
      if (msg.role === 'tool') {
        // Tool results tokenize dense — halve the chars-per-token ratio.
        total += Math.ceil(content.length / TOOL_RESULT_CHARS_PER_TOKEN);
      } else {
        total += Math.ceil(content.length / ESTIMATED_CHARS_PER_TOKEN);
      }
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          total += Math.ceil(
            tc.function.name.length / ESTIMATED_CHARS_PER_TOKEN,
          );
          total += Math.ceil(
            tc.function.arguments.length / JSON_PAYLOAD_CHARS_PER_TOKEN,
          );
        }
      }
    }
    return total;
  }

  /**
   * Pre-prompt aggregate tool-result guard (OpenClaw tool-result-limits).
   * Keeps the total of all tool-result chars ≤ share of the context window
   * (default 50%), truncating the OLDEST results first so fresh tool output
   * and the last 3 results stay intact.
   */
  enforceAggregateToolResultBudget(
    messages: ChatMessage[],
    contextWindowTokens: number,
  ): { messages: ChatMessage[]; truncatedCount: number } {
    const toolIdx: number[] = [];
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === 'tool') toolIdx.push(i);
    }
    if (toolIdx.length === 0) {
      return { messages, truncatedCount: 0 };
    }

    const totalChars = toolIdx.reduce(
      (sum, i) => sum + (messages[i].content?.length || 0),
      0,
    );
    const shareChars = Math.max(
      1,
      Math.floor(
        contextWindowTokens *
          ESTIMATED_CHARS_PER_TOKEN *
          AGGREGATE_TOOL_RESULT_CONTEXT_SHARE,
      ),
    );
    if (totalChars <= shareChars) {
      return { messages, truncatedCount: 0 };
    }

    const KEEP_LAST = 3;
    const PREVIEW_CHARS = 250;
    let remaining = shareChars;
    let truncatedCount = 0;
    const result = [...messages];

    // Walk newest → oldest; keep the last 3 intact, truncate whatever falls
    // outside the shared budget once it's exhausted.
    for (let n = toolIdx.length - 1; n >= 0; n--) {
      const i = toolIdx[n];
      const len = result[i].content?.length || 0;
      if (n >= toolIdx.length - KEEP_LAST) {
        remaining -= len;
        continue;
      }
      if (remaining > 0 && len <= remaining) {
        remaining -= len;
        continue;
      }
      const preview = result[i].content?.substring(0, PREVIEW_CHARS) || '';
      result[i] = {
        ...result[i],
        content: `[Old tool output cleared — aggregate tool-result budget exceeded (${totalChars} chars > ${shareChars})]\n${preview}\n...[truncated ${len} chars]`,
      };
      truncatedCount++;
      remaining = 0;
    }

    return { messages: result, truncatedCount };
  }

  /**
   * Route decision helper (OpenClaw estimateToolResultReductionPotential).
   * Estimates how many chars `truncateToolResultsOnly` could free: every tool
   * result over toolPruneChars except the last 3 collapses to a preview.
   */
  estimateToolResultReduction(messages: ChatMessage[]): number {
    const toolIdx: number[] = [];
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role === 'tool') toolIdx.push(i);
    }
    if (toolIdx.length <= 3) return 0;

    const pruneThreshold = toolIdx.length - 3;
    // Marker text + `...[truncated]` overhead added by pruneOldToolResults.
    const keptAfterPrune = this.config.toolPreviewChars + 80;
    let total = 0;
    for (let n = 0; n < pruneThreshold; n++) {
      const len = messages[toolIdx[n]].content?.length || 0;
      if (len > this.config.toolPruneChars) {
        total += len - keptAfterPrune;
      }
    }
    return Math.max(0, total);
  }

  /**
   * Truncate-only route (OpenClaw truncate_tool_results_only): applies Phase 1
   * (prune old tool results) WITHOUT the rest of the compression pipeline.
   * Cheaper than full compress — history structure is preserved.
   */
  truncateToolResultsOnly(messages: ChatMessage[]): ChatMessage[] {
    return this.pruneOldToolResults(messages);
  }

  /**
   * Pre-prompt thinking-block strip (OpenClaw dropThinkingBlocks).
   * Removes `<think>...</think>` blocks from all assistant messages except the
   * latest one — reasoning is never replayed to the provider and only wastes
   * tokens. Keeps the latest assistant turn intact (providers that require
   * replay signatures can continue the conversation).
   */
  stripThinkingFromContext(messages: ChatMessage[]): ChatMessage[] {
    let latestAssistant = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        latestAssistant = i;
        break;
      }
    }

    let touched = false;
    const result = messages.map((msg, idx) => {
      if (
        msg.role !== 'assistant' ||
        idx === latestAssistant ||
        !msg.content ||
        !msg.content.includes('<think>')
      ) {
        return msg;
      }
      const cleaned = msg.content
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .trim();
      if (cleaned === msg.content) return msg;
      touched = true;
      return {
        ...msg,
        content: cleaned || '[Reasoning omitted to save context]',
      };
    });
    return touched ? result : messages;
  }

  /**
   * Estimate tokens for a message array using the real tiktoken tokenizer.
   * Falls back to char/4 only when tiktoken is unavailable.
   */
  estimateTokens(messages: ChatMessage[]): number {
    let total = 0;
    for (const msg of messages) {
      total += 4; // Per-message overhead
      if (msg.content) {
        total += countTokens(msg.content);
      }
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          total += countTokens(tc.function.name);
          total += countTokens(tc.function.arguments);
        }
      }
    }
    return total;
  }
}

/**
 * StreamingContextScrubber — prevents internal context from leaking to user output.
 *
 * Strips:
 * 1. Frozen memory blocks (## Context的记忆 section)
 * 2. Skills context (## Relevant Skills section)
 * 3. Knowledge base references
 * 4. System prompt fragments that might be echoed back
 *
 * Inspired OpenClaw's StreamingContextScrubber.
 */
export class StreamingContextScrubber {
  private readonly logger = new Logger(StreamingContextScrubber.name);

  // Patterns that indicate internal context leaking
  private readonly LEAK_PATTERNS: RegExp[] = [
    // Memory blocks
    /^## Context[\s\S]*?(?=^## |\z)/m,
    /^## MEMORY[\s\S]*?(?=^## |\z)/m,
    // Skills blocks
    /^## Relevant Skills[\s\S]*?(?=^## |\z)/m,
    /^## Skills[\s\S]*?(?=^## |\z)/m,
    // Knowledge base
    /^## Knowledge[\s\S]*?(?=^## |\z)/m,
    // System prompt fragments
    /^\[SYSTEM\]/m,
    /^<!--.*-->/m,
    // Memory/skill references in Indonesian
    /(?:memory|memori|ingatan|catatan)(?:\s*:|\s*#)/gi,
    /(?:skill|kemampuan|keahlian)(?:\s*:|\s*#)/gi,
  ];

  /**
   * Scrub a text delta before sending to client.
   * Returns cleaned text, or empty string if entire delta is internal context.
   */
  scrub(delta: string): string {
    if (!delta || delta.length === 0) return delta;

    let cleaned = delta;

    // Apply pattern-based scrubbing
    for (const pattern of this.LEAK_PATTERNS) {
      cleaned = cleaned.replace(pattern, '');
    }

    // Strip lines that look like memory/skill injections
    const lines = cleaned.split('\n');
    const filteredLines = lines.filter((line) => {
      const trimmed = line.trim();
      // Skip empty lines at boundaries
      if (trimmed === '') return true;
      // Skip lines that look like internal markers
      if (
        /^(?:##|###)\s+(?:Context|Memory|Skill|Knowledge|SYSTEM)/i.test(trimmed)
      ) {
        this.logger.debug(
          `Stripped internal line: ${trimmed.substring(0, 60)}`,
        );
        return false;
      }
      return true;
    });

    cleaned = filteredLines.join('\n');

    // Final check — if entire output is just internal context, return empty
    if (cleaned.trim().length === 0 && delta.trim().length > 0) {
      this.logger.warn('Entire delta was internal context — returning empty');
      return '';
    }

    return cleaned;
  }

  /**
   * Scrub a complete response (not streaming).
   * Used for non-streaming endpoints.
   */
  scrubFullResponse(response: string): string {
    if (!response) return response;
    return this.scrub(response);
  }
}
