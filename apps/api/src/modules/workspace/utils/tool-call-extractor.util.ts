/**
 * Utility functions for parsing and extracting tool calls, arguments, and file mentions from LLM text output.
 */

export function extractMentionedFilenames(text: string): string[] {
  return [
    ...text.matchAll(
      /@\[?([^\n@\]]+?\.[A-Za-z0-9]{1,10})\]?(?=\s|$|[.,;:!?])/g,
    ),
  ]
    .map((match) => match[1].trim().replace(/^\[|\]$/g, ''))
    .filter(Boolean);
}

export function hasExplicitDeleteIntent(
  goal: string,
  filename: string,
): boolean {
  return (
    /\b(hapus|hapuskan|delete|remove)\b/i.test(goal) &&
    goal.toLowerCase().includes(filename.toLowerCase())
  );
}

export function extractLooseArguments(raw: string): Record<string, any> {
  const result: Record<string, any> = {};
  if (!raw || typeof raw !== 'string') return result;

  try {
    const stringPropRegex = /"([^"]+)"\s*:\s*"((?:[^"\\]|\\.)*)"/gs;
    let match;
    while ((match = stringPropRegex.exec(raw)) !== null) {
      result[match[1]] = match[2]
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t');
    }
  } catch {}

  // Fallback for multiline patchText / content / oldString / newString
  if (!result.patchText) {
    const patchMatch = /"patchText"\s*:\s*"([\s\S]*)/.exec(raw);
    if (patchMatch) {
      let text = patchMatch[1];
      if (text.endsWith('"}') || text.endsWith('"} \n'))
        text = text.slice(0, text.lastIndexOf('"}'));
      else if (text.endsWith('"')) text = text.slice(0, -1);
      result.patchText = text;
    }
  }
  if (!result.content) {
    const contentMatch = /"content"\s*:\s*"([\s\S]*)/.exec(raw);
    if (contentMatch) {
      let text = contentMatch[1];
      if (text.endsWith('"}') || text.endsWith('"} \n'))
        text = text.slice(0, text.lastIndexOf('"}'));
      else if (text.endsWith('"')) text = text.slice(0, -1);
      result.content = text;
    }
  }
  if (!result.filePath && !result.path) {
    const fileMatch = /"(?:filePath|path|filename)"\s*:\s*"([^"]+)"/.exec(raw);
    if (fileMatch) result.filePath = fileMatch[1];
  }
  if (!result.oldString) {
    const oldMatch =
      /"(?:oldString|old_str|find)"\s*:\s*"([\s\S]*?)(?:",\s*"(?:newString|new_str|replace)"|$)/.exec(
        raw,
      );
    if (oldMatch) {
      result.oldString = oldMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r');
    }
  }
  if (!result.newString) {
    const newMatch =
      /"(?:newString|new_str|replace)"\s*:\s*"([\s\S]*?)(?:"\s*\}|$)/.exec(raw);
    if (newMatch) {
      result.newString = newMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r');
    }
  }

  return result;
}

export function extractInlineFunctionCalls(content: string): Array<{
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}> {
  const result: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }> = [];
  if (!content || typeof content !== 'string') return result;

  // Pattern 1: <function/tool_name...>BODY</function> or <function/tool_name[...]>{...}
  const funcRegex =
    /<function\/([a-zA-Z0-9_-]+)(?:\[.*?\])?>?([\s\S]*?)(?:<\/function>|$)/g;
  let match;
  let idx = 1;
  while ((match = funcRegex.exec(content)) !== null) {
    const name = match[1];
    let args = match[2].trim();
    if (args.startsWith('>')) args = args.slice(1).trim();
    if (!args.startsWith('{') && args.includes('{')) {
      args = args.slice(args.indexOf('{')).trim();
    }
    if (args.endsWith('</function>')) {
      args = args.slice(0, -'</function>'.length).trim();
    }
    if (name && args) {
      result.push({
        id: `call_inline_${Date.now()}_${idx++}`,
        type: 'function',
        function: { name, arguments: args },
      });
    }
  }

  // Pattern 2: <tool_call>{"name": "...", "arguments": ...}</tool_call>
  const toolCallRegex = /<tool_call>([\s\S]*?)<\/tool_call>/g;
  while ((match = toolCallRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.name) {
        result.push({
          id: `call_inline_${Date.now()}_${idx++}`,
          type: 'function',
          function: {
            name: parsed.name,
            arguments:
              typeof parsed.arguments === 'string'
                ? parsed.arguments
                : JSON.stringify(parsed.arguments || {}),
          },
        });
      }
    } catch {}
  }

  return result;
}
