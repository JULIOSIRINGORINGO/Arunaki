/**
 * Tool Call Repair — Universal, mature parser for tool calls.
 *
 * Open-weights and free/small models frequently output tool calls as TEXT instead of
 * the provider-native `tool_calls` array, in various formats:
 *   - `<tool_call>{"name": "...", "arguments": {...}}</tool_call>`
 *   - `<function_call name="edit">{"filePath":"x", ...}</function_call>`
 *   - `<function/edit>{...}</function>` / `<function:edit>{...}</function>`
 *   - ```json {"name": "edit", "filePath": "...", ...} ```
 *   - ```json {"tool": "edit", "parameters": { ... }} ```
 *   - Flat JSON: `{"name": "edit", "filePath": "...", "oldString": "...", "newString": "..."}`
 *   - `tool_call: {"name": "...", ...}` or `Action: edit \n Action Input: {...}`
 *
 * This universally normalizes any leaked/text tool invocation into standard
 * provider-native tool calls so execution never fails regardless of model architecture.
 */

export interface RepairedToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

const XML_ISH_TAG_RE =
  /<\s*(?:tool_call|function_call|tool|function|call)[^>]*>([\s\S]*?)<\/\s*(?:tool_call|function_call|tool|function|call)\s*>/gi;
const FENCED_JSON_RE = /```(?:json|tool|function)?\s*([\s\S]*?)```/gi;
const BARE_JSON_RE = /\{[\s\S]*?\}/g;
const FUNCT_TAG_RE =
  /<\s*function\s*(?:\([^)]+\))?=\s*([\s\S]*?)\s*>\s*<\/\s*function\s*>/gi;
const SLASH_FUNCTION_TAG_RE =
  /<\s*function\/([a-zA-Z0-9_-]+)\s*>([\s\S]*?)<\/\s*function\s*>/gi;
const COLON_FUNCTION_TAG_RE =
  /<\s*function:([a-zA-Z0-9_-]+)\s*>([\s\S]*?)<\/\s*function\s*>/gi;
const ACTION_INPUT_RE =
  /(?:Action|Tool|Function)\s*:\s*([a-zA-Z0-9_-]+)\s*(?:Action Input|Arguments|Parameters|Input)\s*:\s*(\{[\s\S]*?\})/gi;
const ASSISTANT_TOOL_CALL_RE =
  /\[Assistant tool call\]:\s*([a-zA-Z0-9_-]+)\s*\(([\s\S]*?)\)/gi;

/** Repair malformed JSON: strip code fences, fix trailing commas, auto-close unclosed strings and braces. */
export function repairJson(raw: string): string {
  if (!raw) return '';
  let s = raw.trim();
  // Strip surrounding code fences if any
  s = s.replace(/^```(?:json|tool|function)?\s*/i, '').replace(/```\s*$/, '');
  // Strip common prefix annotations
  s = s.replace(
    /^\s*(?:tool_call|tool_calls?|function|call|action)\s*[:=]\s*/i,
    '',
  );
  // Remove trailing commas before } or ]
  s = s.replace(/,(\s*[}\]])/g, '$1');

  // Auto-close unclosed strings and braces (for truncated streams)
  let inString = false;
  let escaped = false;
  const stack: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === '{') stack.push('}');
      else if (ch === '[') stack.push(']');
      else if (ch === '}' || ch === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === ch) {
          stack.pop();
        }
      }
    }
  }

  if (inString) {
    s += '"';
  }
  while (stack.length > 0) {
    s += stack.pop();
  }

  return s.trim();
}

/** Known tool names in Arunaki to help disambiguate flat objects */
const KNOWN_ARUNAKI_TOOLS = new Set([
  'edit',
  'edit_file',
  'read',
  'read_file',
  'read_file_lines',
  'read_lines',
  'view_file',
  'write',
  'write_file',
  'delete',
  'delete_file',
  'rename',
  'rename_file',
  'list',
  'list_files',
  'search_workspace',
  'search_files',
  'search',
  'doc_redact_pii',
  'redact',
  'redact_pii',
  'doc_compare_versions',
  'diff',
  'compare',
  'pdf_manage_pages',
  'pdf_stamp_image',
  'pdf',
  'merge_pdf',
  'desktop_excel_edit',
  'desktop_word_edit',
  'desktop_ppt_edit',
  'excel',
  'word',
  'ppt',
  'desktop_open_excel',
  'desktop_open_word',
  'desktop_open_ppt',
  'desktop_open_file',
  'extract_structured_data',
  'document_reader',
  'convert_document',
  'data_query',
  'generate_export',
  'draft_communication',
  'unit_converter',
  'ask_user',
  'todo_write',
  'web_search',
  'agent_spawn',
  'memory_search',
  'memory_store',
  'knowledge_live_fetch',
  'knowledge_search',
  'knowledge_map_lookup',
  'fetch_live_page',
  'live_web_extract',
]);

/** Parse a JSON object that may use name/function/action/arguments aliases or flat top-level parameters. */
export function parseCallObject(
  obj: any,
): { name?: string; args?: unknown } | null {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;

  const name =
    typeof obj.name === 'string'
      ? obj.name
      : typeof obj.tool_name === 'string'
        ? obj.tool_name
        : typeof obj.tool === 'string'
          ? obj.tool
          : typeof obj.action === 'string'
            ? obj.action
            : typeof obj.function === 'string'
              ? obj.function
              : typeof obj.function?.name === 'string'
                ? obj.function.name
                : typeof obj.command === 'string'
                  ? obj.command
                  : undefined;

  // If no explicit tool name key found, check if a known tool name exists as a key or property
  if (!name) {
    for (const key of Object.keys(obj)) {
      if (
        KNOWN_ARUNAKI_TOOLS.has(key.toLowerCase()) &&
        typeof obj[key] === 'object'
      ) {
        return { name: key.toLowerCase(), args: obj[key] };
      }
    }
    return null;
  }

  // Find arguments object
  let args: unknown =
    obj.arguments ??
    obj.parameters ??
    obj.args ??
    obj.input ??
    obj.action_input ??
    obj.params;

  if (typeof args === 'string') {
    try {
      args = JSON.parse(repairJson(args));
    } catch {
      // Keep as string if it doesn't parse as JSON
    }
  }

  // If arguments were not in a nested property, extract all non-meta top-level properties as args
  if (!args || (typeof args === 'object' && Object.keys(args).length === 0)) {
    const {
      name: _n,
      tool_name: _tn,
      tool: _t,
      action: _a,
      function: _f,
      command: _c,
      type: _ty,
      id: _id,
      ...rest
    } = obj;
    if (Object.keys(rest).length > 0) {
      args = rest;
    } else {
      args = {};
    }
  }

  return { name, args };
}

/** Normalize one raw tool call text into a RepairedToolCall, or null. */
export function repairOneToolCall(
  text: string,
  index: number,
): RepairedToolCall | null {
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
          arguments:
            typeof call.args === 'string'
              ? call.args
              : JSON.stringify(call.args ?? {}),
        },
      };
    }
  } catch {
    // Not pure JSON — try XML-ish attribute form below.
  }

  // <function_call name="edit">{"filePath":"x"}</function_call>
  const attrMatch = text.match(/name=["']([^"']+)["']\s*([\s\S]*)/);
  if (attrMatch) {
    const name = attrMatch[1];
    const argsRaw = attrMatch[2].trim();
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
              arguments:
                typeof call.args === 'string'
                  ? call.args
                  : JSON.stringify(call.args ?? {}),
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
 * Handles XML-ish tags, JSON fenced blocks, Action/Action-Input format, bare JSON objects,
 * and multiple calls in one message. Returns normalized native tool calls.
 */
export function repairToolCalls(content: string): RepairedToolCall[] {
  if (!content) return [];
  const calls: RepairedToolCall[] = [];
  const seen = new Set<string>();

  const tryPush = (text: string) => {
    const repaired = repairOneToolCall(text, calls.length);
    if (
      repaired &&
      !seen.has(repaired.function.name + ':' + repaired.function.arguments)
    ) {
      seen.add(repaired.function.name + ':' + repaired.function.arguments);
      calls.push(repaired);
    }
  };

  // 1a. <function(tool_call)={...}></function> format (Gemini format)
  let m: RegExpExecArray | null;
  FUNCT_TAG_RE.lastIndex = 0;
  while ((m = FUNCT_TAG_RE.exec(content)) !== null) {
    if (m[1]) {
      tryPush(m[1]);
    }
  }

  // 1b. <function/edit>{...}</function> and <function:edit>{...}</function> formats (DeepSeek/OpenCode)
  SLASH_FUNCTION_TAG_RE.lastIndex = 0;
  while ((m = SLASH_FUNCTION_TAG_RE.exec(content)) !== null) {
    const fnName = m[1];
    const rawArgs = m[2];
    try {
      const parsed = JSON.parse(repairJson(rawArgs));
      const call: RepairedToolCall = {
        id: `repaired-tool-${Date.now()}-${calls.length}`,
        type: 'function',
        function: {
          name: fnName,
          arguments:
            typeof parsed === 'string' ? parsed : JSON.stringify(parsed ?? {}),
        },
      };
      if (!seen.has(fnName + ':' + call.function.arguments)) {
        seen.add(fnName + ':' + call.function.arguments);
        calls.push(call);
      }
    } catch {
      const call: RepairedToolCall = {
        id: `repaired-tool-${Date.now()}-${calls.length}`,
        type: 'function',
        function: { name: fnName, arguments: repairJson(rawArgs) },
      };
      if (!seen.has(fnName + ':' + call.function.arguments)) {
        seen.add(fnName + ':' + call.function.arguments);
        calls.push(call);
      }
    }
  }

  COLON_FUNCTION_TAG_RE.lastIndex = 0;
  while ((m = COLON_FUNCTION_TAG_RE.exec(content)) !== null) {
    const fnName = m[1];
    const rawArgs = m[2];
    try {
      const parsed = JSON.parse(repairJson(rawArgs));
      const call: RepairedToolCall = {
        id: `repaired-tool-${Date.now()}-${calls.length}`,
        type: 'function',
        function: {
          name: fnName,
          arguments:
            typeof parsed === 'string' ? parsed : JSON.stringify(parsed ?? {}),
        },
      };
      if (!seen.has(fnName + ':' + call.function.arguments)) {
        seen.add(fnName + ':' + call.function.arguments);
        calls.push(call);
      }
    } catch {
      const call: RepairedToolCall = {
        id: `repaired-tool-${Date.now()}-${calls.length}`,
        type: 'function',
        function: { name: fnName, arguments: repairJson(rawArgs) },
      };
      if (!seen.has(fnName + ':' + call.function.arguments)) {
        seen.add(fnName + ':' + call.function.arguments);
        calls.push(call);
      }
    }
  }

  // 1c. DeepSeek DSML / XML invoke format:
  // <｜DSML｜invoke name="tool_name"><｜DSML｜parameter name="url" string="true">value</｜DSML｜parameter></｜DSML｜invoke>
  // or <｜｜DSML｜｜invoke name="tool_name">...</｜｜DSML｜｜invoke>
  const DSML_INVOKE_RE =
    /<[｜|]+(?:DSML[｜|]+)?invoke\s+name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/[｜|]+(?:DSML[｜|]+)?invoke>/gi;
  const DSML_PARAM_RE =
    /<[｜|]+(?:DSML[｜|]+)?parameter\s+name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/[｜|]+(?:DSML[｜|]+)?parameter>/gi;

  DSML_INVOKE_RE.lastIndex = 0;
  while ((m = DSML_INVOKE_RE.exec(content)) !== null) {
    const fnName = m[1];
    const paramsBody = m[2];
    const args: Record<string, any> = {};
    let paramMatch: RegExpExecArray | null;
    DSML_PARAM_RE.lastIndex = 0;
    while ((paramMatch = DSML_PARAM_RE.exec(paramsBody)) !== null) {
      const pName = paramMatch[1];
      const pVal = paramMatch[2].trim();
      try {
        args[pName] = JSON.parse(pVal);
      } catch {
        args[pName] = pVal;
      }
    }
    const call: RepairedToolCall = {
      id: `repaired-tool-${Date.now()}-${calls.length}`,
      type: 'function',
      function: {
        name: fnName,
        arguments: JSON.stringify(args),
      },
    };
    if (!seen.has(fnName + ':' + call.function.arguments)) {
      seen.add(fnName + ':' + call.function.arguments);
      calls.push(call);
    }
  }

  // 1d. <tool name="..."> <args> <arg name="p">val</arg> </args> </tool> format
  const TOOL_TAG_RE =
    /<tool\s+name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/tool>/gi;
  const ARG_TAG_RE =
    /<arg\s+name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/arg>/gi;

  TOOL_TAG_RE.lastIndex = 0;
  while ((m = TOOL_TAG_RE.exec(content)) !== null) {
    const fnName = m[1];
    const inner = m[2].trim();
    const args: Record<string, any> = {};
    let hasArgs = false;
    let argM: RegExpExecArray | null;
    ARG_TAG_RE.lastIndex = 0;
    while ((argM = ARG_TAG_RE.exec(inner)) !== null) {
      hasArgs = true;
      const pName = argM[1];
      const pVal = argM[2].trim();
      try {
        args[pName] = JSON.parse(pVal);
      } catch {
        args[pName] = pVal;
      }
    }

    if (hasArgs) {
      const call: RepairedToolCall = {
        id: `repaired-tool-${Date.now()}-${calls.length}`,
        type: 'function',
        function: {
          name: fnName,
          arguments: JSON.stringify(args),
        },
      };
      if (!seen.has(fnName + ':' + call.function.arguments)) {
        seen.add(fnName + ':' + call.function.arguments);
        calls.push(call);
      }
    } else {
      tryPush(inner);
    }
  }

  // 1e. XML-ish tags with name attributes or inner tool call
  XML_ISH_TAG_RE.lastIndex = 0;
  while ((m = XML_ISH_TAG_RE.exec(content)) !== null) {
    const tag = m[0];
    const inner = m[1] || '';
    const attrName = tag.match(/name=["']([^"']+)["']/)?.[1];
    if (attrName) {
      try {
        const args = JSON.parse(repairJson(inner));
        const argsObj =
          typeof args === 'string' ? args : JSON.stringify(args ?? {});
        const call = {
          id: `repaired-tool-${Date.now()}-${calls.length}`,
          type: 'function' as const,
          function: {
            name: attrName,
            arguments:
              typeof args === 'string' ? args : JSON.stringify(args ?? {}),
          },
        };
        if (!seen.has(attrName + ':' + call.function.arguments)) {
          seen.add(attrName + ':' + call.function.arguments);
          calls.push(call);
        }
      } catch {
        tryPush(inner);
      }
    } else {
      tryPush(inner);
    }
  }

  // 1d. Action: <tool> \n Action Input: { ... } (ReAct style formatting)
  ACTION_INPUT_RE.lastIndex = 0;
  while ((m = ACTION_INPUT_RE.exec(content)) !== null) {
    const fnName = m[1].trim();
    const rawArgs = m[2].trim();
    try {
      const parsed = JSON.parse(repairJson(rawArgs));
      const call: RepairedToolCall = {
        id: `repaired-tool-${Date.now()}-${calls.length}`,
        type: 'function',
        function: {
          name: fnName,
          arguments:
            typeof parsed === 'string' ? parsed : JSON.stringify(parsed ?? {}),
        },
      };
      if (!seen.has(fnName + ':' + call.function.arguments)) {
        seen.add(fnName + ':' + call.function.arguments);
        calls.push(call);
      }
    } catch {
      // ignore
    }
  }

  // 1e. [Assistant tool call]: <name>(<args>) (OpenRouter / Agnes format)
  ASSISTANT_TOOL_CALL_RE.lastIndex = 0;
  while ((m = ASSISTANT_TOOL_CALL_RE.exec(content)) !== null) {
    const fnName = m[1].trim();
    const rawArgs = m[2].trim();
    try {
      const parsed = JSON.parse(repairJson(rawArgs));
      const call: RepairedToolCall = {
        id: `repaired-tool-${Date.now()}-${calls.length}`,
        type: 'function',
        function: {
          name: fnName,
          arguments:
            typeof parsed === 'string' ? parsed : JSON.stringify(parsed ?? {}),
        },
      };
      if (!seen.has(fnName + ':' + call.function.arguments)) {
        seen.add(fnName + ':' + call.function.arguments);
        calls.push(call);
      }
    } catch {
      // fallback raw
      const call: RepairedToolCall = {
        id: `repaired-tool-${Date.now()}-${calls.length}`,
        type: 'function',
        function: { name: fnName, arguments: repairJson(rawArgs) },
      };
      if (!seen.has(fnName + ':' + call.function.arguments)) {
        seen.add(fnName + ':' + call.function.arguments);
        calls.push(call);
      }
    }
  }

  // 2. JSON fenced blocks (```json ... ```)
  FENCED_JSON_RE.lastIndex = 0;
  while ((m = FENCED_JSON_RE.exec(content)) !== null) {
    const inner = m[1] || '';
    tryPush(inner);
  }
  FENCED_JSON_RE.lastIndex = 0;

  // 3. Bare JSON objects that contain tool name or known tools
  BARE_JSON_RE.lastIndex = 0;
  while ((m = BARE_JSON_RE.exec(content)) !== null) {
    const candidate = m[0];
    if (
      /\{\s*"(?:name|tool|tool_name|action|function|filePath|oldString|patchText|query|workspaceId)"/i.test(
        candidate,
      )
    ) {
      tryPush(candidate);
    }
  }
  BARE_JSON_RE.lastIndex = 0;

  // 4. Greedy fallback: capture from first { to last } (handles nested JSON braces)
  const greedy = content.match(/\{[\s\S]*\}/);
  if (greedy && calls.length === 0) {
    const candidate = greedy[0];
    if (
      /\{\s*"(?:name|tool|tool_name|action|function|filePath|oldString|patchText|query|workspaceId)"/i.test(
        candidate,
      )
    ) {
      tryPush(candidate);
    }
  }

  return calls;
}

/**
 * Strips leaked tool invocation artifacts, hallucinated tool call headers,
 * and raw tool result JSON blocks from text meant for display to the user.
 */
export function stripToolArtifactsFromText(rawText: string): string {
  if (!rawText) return '';
  let text = rawText;

  // 1. Strip XML-ish tool invocation tags
  text = text
    .replace(/<[｜|]+(?:DSML[｜|]+)?tool_calls>[\s\S]*?<\/[｜|]+(?:DSML[｜|]+)?tool_calls>/gi, '')
    .replace(/<[｜|]+(?:DSML[｜|]+)?invoke[^>]*>[\s\S]*?<\/[｜|]+(?:DSML[｜|]+)?invoke>/gi, '')
    .replace(/<\s*tool_call\s*>[\s\S]*?<\/\s*tool_call\s*>/gi, '')
    .replace(/<\s*function_call\s*>[\s\S]*?<\/\s*function_call\s*>/gi, '')
    .replace(/<\s*function(?:[^>]*)>[\s\S]*?<\/\s*function\s*>/gi, '');

  // 2. Strip leaked [Assistant tool call] and [Tool call] / [Tool result] tags and their contents
  text = text.replace(/\[(?:Assistant tool call|Tool call|Tool result)\]:[\s\S]*?(?=\n\n|\n[A-Z0-9#\*\-]|$)/gi, '');

  // 3. Strip raw JSON payloads with status/toolName metadata
  text = text.replace(/```(?:json)?\s*\{[\s\S]*?"(?:status|toolName|executionTime|preview)"[\s\S]*?\}\s*```/gi, '');
  text = text.replace(/\{"status"\s*:\s*"(?:success|error)"[\s\S]*?"metadata"[\s\S]*?\}/gi, '');

  // 4. Strip repeated trailing json metadata fragments
  text = text.replace(/(?:\s*,\s*"metadata"\s*:\s*\{"toolName"[\s\S]*?\})+/gi, '');

  return text.trim();
}

