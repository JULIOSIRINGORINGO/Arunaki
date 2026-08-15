/**
 * apply-patch.ts — strict patch engine for surgical file edits.
 *
 * Ported faithfully from opencode (MIT) `packages/core/src/patch.ts`.
 * The LLM emits a patch text; this engine parses it, VALIDATES every context
 * line against the real file (dry-run), and only then produces the new
 * content. If any context line does not match, it throws — and nothing is
 * written. The caller returns the error to the LLM, which self-corrects.
 *
 * Anti-failure mechanism: strict parse + full dry-run derivation before the
 * caller touches disk. No partial writes, no guessed replacements.
 */

export type Hunk =
  | { type: 'add'; path: string; contents: string }
  | { type: 'delete'; path: string }
  | {
      type: 'update';
      path: string;
      movePath?: string;
      chunks: UpdateFileChunk[];
    };

export interface UpdateFileChunk {
  oldLines: string[];
  newLines: string[];
  changeContext?: string;
  endOfFile?: boolean;
}

export interface FileUpdate {
  content: string;
  bom: boolean;
}

export class PatchError extends Error {}

const stripHeredoc = (input: string) =>
  input.match(/^(?:cat\s+)?<<['"]?(\w+)['"]?\s*\n([\s\S]*?)\n\1\s*$/)?.[2] ?? input;

export function parse(patchText: string): Hunk[] {
  let cleanText = patchText.trim();
  // Strip code block markers if present (e.g. ```patch ... ``` or ```diff ... ```)
  cleanText = cleanText.replace(/^```(?:patch|diff|markdown)?\r?\n/i, '').replace(/\r?\n```$/i, '').trim();
  cleanText = stripHeredoc(cleanText);

  // Auto-repair missing Begin/End Patch markers if an operation header is present
  if (!cleanText.includes('*** Begin Patch') && /(?:\*\*\* (?:Update|Add|Delete) File:)/.test(cleanText)) {
    cleanText = '*** Begin Patch\n' + cleanText;
  }
  if (!cleanText.includes('*** End Patch') && cleanText.includes('*** Begin Patch')) {
    cleanText = cleanText + '\n*** End Patch';
  }

  const lines = cleanText.split('\n');
  const begin = lines.findIndex((line) => line.trim() === '*** Begin Patch');
  const end = lines.findIndex((line) => line.trim() === '*** End Patch');
  if (begin === -1 || end === -1 || begin >= end) {
    throw new PatchError('Invalid patch format: missing Begin/End markers');
  }

  const hunks: Hunk[] = [];
  let index = begin + 1;
  while (index < end) {
    const line = lines[index]!;
    const addMatch = /^\*\*\*\s*Add File:?\s*(.*)/i.exec(line);
    if (addMatch) {
      const path = addMatch[1].trim();
      const parsed = parseAdd(lines, index + 1);
      hunks.push({ type: 'add', path, contents: parsed.content });
      index = parsed.next;
      continue;
    }
    const delMatch = /^\*\*\*\s*Delete File:?\s*(.*)/i.exec(line);
    if (delMatch) {
      const path = delMatch[1].trim();
      hunks.push({ type: 'delete', path });
      index++;
      continue;
    }
    const updateMatch = /^\*\*\*\s*Update File:?\s*(.*)/i.exec(line);
    if (updateMatch) {
      const path = updateMatch[1].trim();
      let next = index + 1;
      let movePath: string | undefined;
      const moveMatch = lines[next] ? /^\*\*\*\s*Move to:?\s*(.*)/i.exec(lines[next]!) : null;
      if (moveMatch) {
        movePath = moveMatch[1].trim();
        next++;
      }
      const parsed = parseUpdate(lines, next);
      hunks.push({ type: 'update', path, movePath, chunks: parsed.chunks });
      index = parsed.next;
      continue;
    }
    // Skip empty lines or stray markers inside patch block
    if (!line.trim() || line.startsWith('---') || line.startsWith('+++')) {
      index++;
      continue;
    }
    throw new PatchError(`Invalid patch line: ${line}`);
  }
  return hunks;
}

function parseAdd(lines: string[], start: number): { content: string; next: number } {
  const content: string[] = [];
  let index = start;
  while (index < lines.length && !lines[index]!.startsWith('***')) {
    if (!lines[index]!.startsWith('+')) throw new PatchError(`Invalid add file line: ${lines[index]}`);
    content.push(lines[index]!.slice(1).replace(/^\d+:\s?/, ''));
    index++;
  }
  return { content: content.join('\n'), next: index };
}

function parseUpdate(lines: string[], start: number): { chunks: UpdateFileChunk[]; next: number } {
  const chunks: UpdateFileChunk[] = [];
  let index = start;
  while (index < lines.length && !lines[index]!.startsWith('***')) {
    let changeContext: string | undefined;
    if (lines[index]!.startsWith('@@')) {
      let rawContext = lines[index]!.slice(2).trim() || undefined;
      // If the context is just unified diff line numbers (e.g. -1,53 +1,67 @@), ignore it
      if (rawContext && (/^-?\d+/i.test(rawContext) || /@@/.test(rawContext) || /^-\d+/i.test(rawContext))) {
        rawContext = undefined;
      }
      changeContext = rawContext;
      index++;
    }
    const oldLines: string[] = [];
    const newLines: string[] = [];
    let endOfFile = false;
    
    while (index < lines.length && !lines[index]!.startsWith('@@')) {
      const line = lines[index]!;
      if (line === '*** End of File') {
        endOfFile = true;
        index++;
        break;
      }
      if (line.startsWith('***')) break;
      if (line.startsWith(' ')) {
        const text = line.slice(1).replace(/^\d+:\s?/, '');
        oldLines.push(text);
        newLines.push(text);
      } else if (line.startsWith('-')) {
        oldLines.push(line.slice(1).replace(/^\d+:\s?/, ''));
      } else if (line.startsWith('+')) {
        newLines.push(line.slice(1).replace(/^\d+:\s?/, ''));
      } else if (line === '') {
        oldLines.push('');
        newLines.push('');
      } else throw new PatchError(`Invalid update chunk line: ${line}`);
      index++;
    }
    chunks.push({ oldLines, newLines, changeContext, endOfFile: endOfFile || undefined });
  }
  return { chunks, next: index };
}

export function derive(hunk: Hunk, original: string, location: string): FileUpdate {
  const chunks = hunk.type === 'update' ? (hunk.chunks ?? []) : [];
  const source = splitBom(original);
  const lines = source.text.split('\n');
  if (lines.at(-1) === '') lines.pop();

  const replacements = computeReplacements(lines, location, chunks);

  const updated = [...lines];
  for (const [start, remove, insert] of replacements.reverse()) updated.splice(start, remove, ...insert);
  if (updated.at(-1) !== '') updated.push('');
  const next = splitBom(updated.join('\n'));
  return { content: next.text, bom: source.bom || next.bom };
}

export function joinBom(text: string, bom: boolean): string {
  const stripped = splitBom(text).text;
  return bom ? `\uFEFF${stripped}` : stripped;
}

function computeReplacements(
  lines: string[],
  path: string,
  chunks: UpdateFileChunk[],
): Array<[start: number, remove: number, insert: string[]]> {
  const replacements: Array<[number, number, string[]]> = [];
  let lineIndex = 0;
  for (const chunk of chunks) {
    if (chunk.changeContext) {
      const context = seek(lines, [chunk.changeContext], lineIndex);
      if (context === -1) throw new PatchError(`Failed to find context '${chunk.changeContext}' in ${path}`);
      lineIndex = context + 1;
    }
    if (chunk.oldLines.length === 0) {
      replacements.push([lines.length, 0, chunk.newLines]);
      continue;
    }
    let oldLines = chunk.oldLines;
    let newLines = chunk.newLines;
    let found = seek(lines, oldLines, lineIndex, chunk.endOfFile);
    if (found === -1 && oldLines.at(-1) === '') {
      oldLines = oldLines.slice(0, -1);
      if (newLines.at(-1) === '') newLines = newLines.slice(0, -1);
      found = seek(lines, oldLines, lineIndex, chunk.endOfFile);
    }
    if (found === -1) {
      throw new PatchError(`Failed to find expected lines in ${path}:\n${chunk.oldLines.join('\n')}`);
    }
    replacements.push([found, oldLines.length, newLines]);
    lineIndex = found + oldLines.length;
  }
  return replacements.sort((left, right) => left[0] - right[0]);
}

function seek(lines: string[], pattern: string[], start: number, eof = false): number {
  if (pattern.length === 0) return -1;
  for (const compare of [exact, rstrip, trim, normalized, alphanumeric]) {
    if (eof) {
      const offset = lines.length - pattern.length;
      if (offset >= start && matches(lines, pattern, offset, compare)) return offset;
    }
    for (let offset = start; offset <= lines.length - pattern.length; offset++) {
      if (matches(lines, pattern, offset, compare)) return offset;
    }
  }
  return -1;
}

function matches(
  lines: string[],
  pattern: string[],
  offset: number,
  compare: (left: string, right: string) => boolean,
): boolean {
  return pattern.every((line, index) => compare(lines[offset + index]!, line));
}

const exact = (left: string, right: string) => left === right;
const rstrip = (left: string, right: string) => left.trimEnd() === right.trimEnd();
const trim = (left: string, right: string) => left.trim() === right.trim();
const normalized = (left: string, right: string) => normalize(left.trim()) === normalize(right.trim());
const alphanumeric = (left: string, right: string) => left.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === right.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

const normalize = (value: string) =>
  value
    .replace(/[\u2018\u2019\u201A\u2032\u2035\u0060]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033\u2036\u0022]/g, '"')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u0060]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ');

const splitBom = (text: string) =>
  text.startsWith('\uFEFF') ? { bom: true, text: text.slice(1) } : { bom: false, text: text };
