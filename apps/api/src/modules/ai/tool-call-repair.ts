/**
 * Tool Call Repair — port of OpenClaw's `tool-call-repair` approach.
 *
 * Cheap/free models frequently output tool calls as TEXT instead of the
 * provider-native `tool_calls` array, in various formats:
 *   - `<tool_call>{"name": "...", "arguments": {...}}</tool_call>`
 *   - `<function_call name="read_file">{"path":"x"}</function_call>`
 *   - ```json {"name": "...", ...} ```
 *   - bare `{"name": "...", "arguments": ...}`
 *   - `tool_call: {"name": "...", ...}` (some providers prefix)
 *
 * This extracts and normalizes them into provider-native tool calls so a
 * broken/leaked text call still executes. Also repairs minor JSON issues
 * (trailing commas, unescaped control chars, code-fence wrapping).
 */

export interface RepairedToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

const XML_ISH_TAG_RE = /<(?:tool_call|function_call|tool)[^>]*>([\s\S]*?)<\/(?:tool_call|function_call|tool)>/gi;
const FENCED_JSON_RE = /```(?:json)?\s*([\s\S]*?)```/gi;
const BARE_JSON_RE = /\{[\s\S]*?\}/g;

/** Repair malformed JSON: strip code fences, collapse line breaks in strings, fix trailing commas. */
export function repairJson(raw: string): string {
  let s = raw.trim();
  // Strip surrounding code fences if any.
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  // Some models wrap with "tool_call:" or "function:" prefix.
  s = s.replace(/^\s*(?:tool_call|tool_calls?|function|call)\s*[:=]\s*/i, '');
  // Remove trailing commas before } or ].
  s = s.replace(/,(\s*[}\]])/g, '$1');
  // Collapse literal newlines inside string values (common break).
  s = s.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"\s*\n\s*(?=[,}\]])/g, '"$1"');
  return s.trim();
}

/** Parse a JSON object that may use name/function/arguments aliases. */
function parseCallObject(obj: any): { name?: string; args?: unknown } | null {
  if (!obj || typeof obj !== 'object') return null;
  const name =
    typeof obj.name === 'string'
      ? obj.name
      : typeof obj.function === 'string'
        ? obj.function
        : typeof obj.function?.name === 'string'
          ? obj.function.name
          : undefined;
  if (!name) return null;
  let args: unknown = obj.arguments ?? obj.parameters ?? obj.args ?? obj.input ?? {};
  if (typeof args === 'string') {
    try { args = JSON.parse(args); } catch { /* keep string */ }
  }
  return { name, args };
}

/** Normalize one raw tool call text into a RepairedToolCall, or null. */
export function repairOneToolCall(text: string, index: number): RepairedToolCall | null {
  const cleaned = repairJson(text);
  try {
    const parsed = JSON.parse(cleaned);
    const call = parseCallObject(parsed);
    if (call?.name) {
      return {
        id: `repaired-tool-${Date.now()}-${index}`,
        type: 'function',
        function: {
          name: call.name,
          arguments: typeof call.args === 'string' ? call.args : JSON.stringify(call.args ?? {}),
        },
      };
    }
  } catch {
    // Not pure JSON — try XML-ish attribute form below.
  }

  // <function_call name="read_file">{"path":"x"}</function_call>
  const attrMatch = text.match(/name=["']([^"']+)["']\s*([\s\S]*)/);
  if (attrMatch) {
    const name = attrMatch[1];
    let argsRaw = attrMatch[2].trim();
    if (argsRaw) {
      try {
        const parsed = JSON.parse(repairJson(argsRaw));
        const call = parseCallObject(parsed);
        if (call?.name) {
          return {
            id: `repaired-tool-${Date.now()}-${index}`,
            type: 'function',
            function: {
              name: call.name,
              arguments: typeof call.args === 'string' ? call.args : JSON.stringify(call.args ?? {}),
            },
          };
        }
        return {
          id: `repaired-tool-${Date.now()}-${index}`,
          type: 'function',
          function: { name, arguments: JSON.stringify(parsed) },
        };
      } catch {
        return {
          id: `repaired-tool-${Date.now()}-${index}`,
          type: 'function',
          function: { name, arguments: argsRaw },
        };
      }
    }
    return {
      id: `repaired-tool-${Date.now()}-${index}`,
      type: 'function',
      function: { name, arguments: '{}' },
    };
  }

  return null;
}

/**
 * Extract tool calls leaked into assistant text content.
 * Handles XML-ish tags, JSON fenced blocks, bare JSON objects, and multiple
 * calls in one message. Returns normalized native tool calls.
 */
export function repairToolCalls(content: string): RepairedToolCall[] {
  if (!content) return [];
  const calls: RepairedToolCall[] = [];
  const seen = new Set<string>();

  const tryPush = (text: string) => {
    const repaired = repairOneToolCall(text, calls.length);
    if (repaired && !seen.has(repaired.function.name + repaired.function.arguments)) {
      seen.add(repaired.function.name + repaired.function.arguments);
      calls.push(repaired);
    }
  };

// 1. XML-ish tags (may contain multiple). Attribute form:
  //    <function_call name="edit">{"workspaceId":"w1"}</function_call> — name is on the tag.
  XML_ISH_TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = XML_ISH_TAG_RE.exec(content)) !== null) {
    const tag = m[0];
    const inner = m[1] || '';
    // If tag has a name="..." attribute, pass it so the JSON body can use it.
    const attrName = tag.match(/name=["']([^"']+)["']/)?.[1];
    if (attrName) {
      const repaired = repairJson(m[1] || '');
      try {
        const args = JSON.parse(repairJson(m[1] || ''));
        const argsObj = typeof args === 'string' ? args : JSON.stringify(args ?? {});
        const call = {
          id: `repaired-tool-${Date.now()}-${calls.length}`,
          type: 'function' as const,
          function: {
            name: attrName,
            arguments: typeof args === 'string' ? args : JSON.stringify(args ?? {}),
          },
        };
        if (!seen.has(attrName + call.function.arguments)) {
          seen.add(attrName + call.function.arguments);
          calls.push(call);
        }
      } catch {
        // ignore
      }
    } else {
      tryPush(m[1] || '');
    }
  }

  // 2. JSON fenced blocks.
  FENCED_JSON_RE.lastIndex = 0;
  while ((m = FENCED_JSON_RE.exec(content)) !== null) {
    const inner = m[1] || '';
    if (/\{\s*"(?:name|function)"/.test(inner)) tryPush(inner);
  }
  FENCED_JSON_RE.lastIndex = 0;

  // 3. Bare JSON objects that look like tool calls.
  // Nested braces break `{...?}` non-greedy, so try greedy fallback too.
  BARE_JSON_RE.lastIndex = 0;
  while ((m = BARE_JSON_RE.exec(content)) !== null) {
    const candidate = m[0];
    if (/\{\s*"(?:name|function)"/.test(candidate)) tryPush(candidate);
  }
  BARE_JSON_RE.lastIndex = 0;

  // Greedy fallback: capture from first { to last } (handles nested braces).
  const greedy = content.match(/\{[\s\S]*\}/);
  if (greedy) {
    const candidate = greedy[0];
    if (/\{\s*"(?:name|function)"/.test(candidate) && !calls.some((c) => c.function.arguments === JSON.stringify(candidate))) {
      tryPush(candidate);
    }
  }
  BARE_JSON_RE.lastIndex = 0;

  return calls;
}
