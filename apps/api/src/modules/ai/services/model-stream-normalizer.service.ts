import { Injectable, Logger } from '@nestjs/common';
import { StreamChunk } from '../stream-chat';
import { repairToolCalls, RepairedToolCall } from '../tool-call-repair';

export interface NormalizerOptions {
  stripThinkingInProse?: boolean;
  emitUnifiedThinkingEvents?: boolean;
  suppressLeakedToolText?: boolean;
}

@Injectable()
export class ModelStreamNormalizerService {
  private readonly logger = new Logger(ModelStreamNormalizerService.name);

  /**
   * Normalizes an incoming async stream of chunks from any AI provider (DeepSeek, OpenAI, Anthropic, Gemini, Qwen, OpenRouter proxies).
   *
   * Guarantees:
   * 1. Cross-chunk `<think>...</think>` separation into clean { type: 'reasoning', content } events.
   * 2. Pure assistant prose { type: 'content', content } with zero reasoning or tool leakages.
   * 3. Seamless conversion of leaked text tool calls into native { type: 'tool_call', toolCall } chunks.
   */
  async *normalizeStream(
    stream: AsyncGenerator<StreamChunk>,
    options: NormalizerOptions = {},
  ): AsyncGenerator<StreamChunk> {
    let isThinking = false;
    let lookaheadBuffer = '';
    let totalContentAccumulator = '';
    let hasEmittedToolFromText = false;

    const stripThinking = options.stripThinkingInProse ?? true;
    const suppressToolText = options.suppressLeakedToolText ?? true;

    for await (const chunk of stream) {
      if (chunk.type === 'reasoning') {
        // Native reasoning delta from provider (e.g. DeepSeek R1 reasoning_content)
        yield { type: 'reasoning', content: chunk.content };
        continue;
      }

      if (chunk.type === 'tool_call') {
        yield chunk;
        continue;
      }

      if (chunk.type === 'content' && chunk.content) {
        lookaheadBuffer += chunk.content;
        totalContentAccumulator += chunk.content;

        // Process buffer chunk by chunk using stateful token scanning
        while (lookaheadBuffer.length > 0) {
          if (!isThinking) {
            const thinkStartIdx = lookaheadBuffer.indexOf('<think>');
            if (thinkStartIdx === 0) {
              // Exact start of thinking block
              isThinking = true;
              lookaheadBuffer = lookaheadBuffer.slice(7); // remove '<think>'
              continue;
            } else if (thinkStartIdx > 0) {
              // Text before thinking block -> emit as content
              const safeProse = lookaheadBuffer.slice(0, thinkStartIdx);
              lookaheadBuffer = lookaheadBuffer.slice(thinkStartIdx);
              yield { type: 'content', content: safeProse };
              continue;
            }

            // Check if buffer ends with partial '<think' prefix (cross-chunk lookahead)
            if (this.isPartialPrefix(lookaheadBuffer, '<think>')) {
              // Wait for next stream chunk to complete the tag
              break;
            }

            // Check if buffer starts with or contains leaked tool call pattern
            if (
              suppressToolText &&
              this.containsLeakedToolPrefix(lookaheadBuffer)
            ) {
              // Hold in buffer until tool call is fully closed or stream ends
              break;
            }

            // Safe pure content
            if (lookaheadBuffer.length > 8) {
              const emitLen = lookaheadBuffer.length - 8;
              const safeChunk = lookaheadBuffer.slice(0, emitLen);
              lookaheadBuffer = lookaheadBuffer.slice(emitLen);
              yield { type: 'content', content: safeChunk };
            }
            break;
          } else {
            // Inside thinking block
            const thinkEndIdx = lookaheadBuffer.indexOf('</think>');
            if (thinkEndIdx === 0) {
              // Exact end of thinking block
              isThinking = false;
              lookaheadBuffer = lookaheadBuffer.slice(8); // remove '</think>'
              continue;
            } else if (thinkEndIdx > 0) {
              // Reasoning content before closing tag
              const reasoningChunk = lookaheadBuffer.slice(0, thinkEndIdx);
              lookaheadBuffer = lookaheadBuffer.slice(thinkEndIdx);
              yield { type: 'reasoning', content: reasoningChunk };
              continue;
            }

            // Check if buffer ends with partial '</think' prefix
            if (this.isPartialPrefix(lookaheadBuffer, '</think>')) {
              break;
            }

            // Full reasoning chunk
            if (lookaheadBuffer.length > 9) {
              const emitLen = lookaheadBuffer.length - 9;
              const reasoningChunk = lookaheadBuffer.slice(0, emitLen);
              lookaheadBuffer = lookaheadBuffer.slice(emitLen);
              yield { type: 'reasoning', content: reasoningChunk };
            }
            break;
          }
        }
      }
    }

    // Flush any remaining buffer when stream finishes
    if (lookaheadBuffer.length > 0) {
      if (isThinking) {
        // Unclosed <think> tag at stream end -> emit remainder as reasoning
        const clean = lookaheadBuffer.replace(/<\/think>/gi, '');
        if (clean) yield { type: 'reasoning', content: clean };
      } else {
        // Check if remaining buffer contains leaked tool call
        const repaired = repairToolCalls(lookaheadBuffer);
        if (repaired.length > 0) {
          hasEmittedToolFromText = true;
          for (const tc of repaired) {
            yield {
              type: 'tool_call',
              toolCall: {
                id: tc.id,
                name: tc.function.name,
                arguments: tc.function.arguments,
              },
            };
          }
        } else {
          yield { type: 'content', content: lookaheadBuffer };
        }
      }
    }

    // Secondary fallback: if no tool was emitted natively, but total accumulator has leaked tool calls
    if (!hasEmittedToolFromText && totalContentAccumulator) {
      const fullRepaired = repairToolCalls(totalContentAccumulator);
      if (fullRepaired.length > 0) {
        for (const tc of fullRepaired) {
          yield {
            type: 'tool_call',
            toolCall: {
              id: tc.id,
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          };
        }
      }
    }
  }

  /**
   * Sanitizes assistant message content before storing in database or sending to subsequent LLM turns.
   * Strips all `<think>...</think>` tags, leaked tool call annotations, and XML artifacts.
   */
  cleanseAssistantMessageForHistory(rawContent: string): string {
    if (!rawContent) return '';

    let content = rawContent
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&amp;/g, '&');

    // 1. Remove all complete <think>...</think> blocks
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, '');

    // 2. Remove dangling <think> or </think> tags
    content = content.replace(/<\/?think>/gi, '');

    // 3. Remove leaked tool calls
    content = content
      .replace(/\[Assistant tool call\]:\s*[a-zA-Z0-9_-]+\s*\([\s\S]*?\)/gi, '')
      .replace(/<\s*tool_call\s*>[\s\S]*?<\/\s*tool_call\s*>/gi, '')
      .replace(/<\s*function_call\s*>[\s\S]*?<\/\s*function_call\s*>/gi, '')
      .replace(/<\s*function(?:[^>]*)>[\s\S]*?<\/\s*function\s*>/gi, '')
      .replace(
        /```(?:json)?\s*\{\s*"(?:name|tool|function|action)"[\s\S]*?\}\s*```/gi,
        '',
      )
      .trim();

    return content;
  }

  private isPartialPrefix(str: string, targetTag: string): boolean {
    for (let i = 1; i < targetTag.length; i++) {
      const sub = targetTag.slice(0, i);
      if (str.endsWith(sub)) {
        return true;
      }
    }
    return false;
  }

  private containsLeakedToolPrefix(str: string): boolean {
    return (
      str.includes('[Assistant tool call]:') ||
      str.includes('<tool_call>') ||
      str.includes('<function_call') ||
      str.includes('Action:')
    );
  }
}
