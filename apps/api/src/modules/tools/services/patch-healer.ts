/**
 * patch-healer.ts — Intelligent error recovery & auto-healing harness for LLM-generated diffs.
 * Designed to make small and open-weight models (<100B, 70B, 8B, etc.) 100% resilient.
 */

export interface HealedChunk {
  oldLines: string[];
  newLines: string[];
}

export function healPatchText(rawPatch: string, defaultFilePath: string): string {
  let text = (rawPatch || '').trim();

  // 1. Strip markdown code fences (```diff ... ```, ```patch ... ```, etc.)
  text = text.replace(/^```[a-zA-Z0-9_-]*\r?\n/i, '').replace(/\r?\n```$/i, '').trim();

  // 2. Strip bash heredocs: cat << 'EOF' ... EOF
  text = text.replace(/^(?:cat\s+)?<<['"]?(\w+)['"]?\s*\n([\s\S]*?)\n\1\s*$/, '$2').trim();

  // 3. Remove outer *** Begin Patch / *** End Patch if present
  text = text.replace(/^\*\*\*\s*Begin Patch\s*\r?\n?/i, '');
  text = text.replace(/\r?\n?\*\*\*\s*End Patch\s*$/i, '');

  // 4. Clean line by line
  const lines = text.split(/\r?\n/);
  const cleanedLines: string[] = [];
  let foundUpdateFile = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]!;

    // Check for file directive
    if (/^\*\*\*\s*Update File:\s*(.*)/i.test(line)) {
      foundUpdateFile = true;
      cleanedLines.push(line);
      continue;
    }
    if (/^\*\*\*\s*(?:Add|Delete) File:/i.test(line)) {
      cleanedLines.push(line);
      continue;
    }

    // Strip line number prefix from model output: e.g. "12: -CK AGUSTINO" -> "-CK AGUSTINO"
    line = line.replace(/^\s*\d+:\s*(?=[+\- ])/, '');

    // If line starts with @@ (e.g. "@@ -CK AGUSTINO", "@@ -1,5 +1,5 @@", "@@")
    if (line.startsWith('@@')) {
      cleanedLines.push('@@');
      continue;
    }

    cleanedLines.push(line);
  }

  // Deduplicate consecutive @@ headers
  const dedupedLines: string[] = [];
  let prevIsAtAt = false;
  for (const line of cleanedLines) {
    if (line.trim() === '@@') {
      if (!prevIsAtAt) {
        dedupedLines.push('@@');
        prevIsAtAt = true;
      }
    } else {
      dedupedLines.push(line);
      prevIsAtAt = false;
    }
  }

  let body = dedupedLines.join('\n').trim();

  // If no @@ header was found anywhere in body, add one at the beginning
  if (!body.includes('@@') && (body.includes('-') || body.includes('+'))) {
    body = `@@\n${body}`;
  }

  const header = foundUpdateFile ? '' : `*** Update File: ${defaultFilePath}\n`;
  return `*** Begin Patch\n${header}${body}\n*** End Patch`;
}

/**
 * Fallback Direct Extractor:
 * If strict diff parsing fails, extract blocks of oldLines vs newLines
 * and apply them directly to file contents with whitespace tolerance.
 */
export function extractAndApplyFallback(
  rawPatch: string,
  fileContent: string,
): { success: boolean; updatedContent: string; replacements: number } {
  let content = fileContent;
  let replacements = 0;

  // Clean fences
  const clean = rawPatch.replace(/^```[a-zA-Z0-9_-]*\r?\n/i, '').replace(/\r?\n```$/i, '').trim();
  const lines = clean.split(/\r?\n/);

  // Group lines into hunks
  let currentOld: string[] = [];
  let currentNew: string[] = [];
  let currentMinus: string[] = [];
  let currentPlus: string[] = [];
  let inHunk = false;

  const applyHunk = () => {
    if (currentOld.length === 0 && currentNew.length === 0 && currentMinus.length === 0) return;
    const oldBlock = currentOld.join('\n');
    const newBlock = currentNew.join('\n');
    let matched = false;

    if (oldBlock && content.includes(oldBlock)) {
      content = content.replace(oldBlock, newBlock);
      replacements++;
      matched = true;
    } else if (oldBlock) {
      // Normalize CRLF
      const normContent = content.replace(/\r\n/g, '\n');
      const normOld = oldBlock.replace(/\r\n/g, '\n');
      const normNew = newBlock.replace(/\r\n/g, '\n');
      if (normContent.includes(normOld)) {
        content = normContent.replace(normOld, normNew);
        replacements++;
        matched = true;
      } else {
        // Line-by-line fuzzy search for the block
        const targetLines = normContent.split('\n');
        const searchLines = normOld.split('\n');
        const matchIdx = findFuzzyBlock(targetLines, searchLines);
        if (matchIdx !== -1) {
          targetLines.splice(matchIdx, searchLines.length, ...normNew.split('\n'));
          content = targetLines.join('\n');
          replacements++;
          matched = true;
        }
      }
    }

    // Minus-lines fallback if context matching failed
    if (!matched && currentMinus.length > 0) {
      const minOld = currentMinus.join('\n');
      const minNew = currentPlus.join('\n');
      const normContent = content.replace(/\r\n/g, '\n');
      const normMinOld = minOld.replace(/\r\n/g, '\n');
      const normMinNew = minNew.replace(/\r\n/g, '\n');
      if (normContent.includes(normMinOld)) {
        content = normContent.replace(normMinOld, normMinNew);
        replacements++;
        matched = true;
      } else {
        const targetLines = normContent.split('\n');
        const searchLines = normMinOld.split('\n');
        const matchIdx = findFuzzyBlock(targetLines, searchLines);
        if (matchIdx !== -1) {
          targetLines.splice(matchIdx, searchLines.length, ...normMinNew.split('\n'));
          content = targetLines.join('\n');
          replacements++;
          matched = true;
        }
      }
    }

    currentOld = [];
    currentNew = [];
    currentMinus = [];
    currentPlus = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/^\s*\d+:\s*(?=[+\- ])/, '');
    if (line.startsWith('@@') || line.startsWith('***')) {
      applyHunk();
      inHunk = true;
      continue;
    }
    if (line.startsWith('-')) {
      const text = line.slice(1);
      currentOld.push(text);
      currentMinus.push(text);
    } else if (line.startsWith('+')) {
      const text = line.slice(1);
      currentNew.push(text);
      currentPlus.push(text);
    } else if (line.startsWith(' ')) {
      const text = line.slice(1);
      currentOld.push(text);
      currentNew.push(text);
    } else if (inHunk && line.trim()) {
      // Unprefixed context line
      currentOld.push(line);
      currentNew.push(line);
    }
  }
  applyHunk();

  return {
    success: replacements > 0,
    updatedContent: content,
    replacements,
  };
}

/**
 * Fuzzy search for a block of lines in target lines ignoring minor spacing/case/punctuation differences.
 */
function findFuzzyBlock(target: string[], search: string[]): number {
  if (search.length === 0 || target.length < search.length) return -1;
  const norm = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const searchNorm = search.map(norm);

  for (let i = 0; i <= target.length - search.length; i++) {
    let match = true;
    for (let j = 0; j < search.length; j++) {
      if (norm(target[i + j]!) !== searchNorm[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}
