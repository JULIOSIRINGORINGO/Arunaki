import { encoding_for_model } from 'tiktoken';

let enc: ReturnType<typeof encoding_for_model> | null = null;

function getEncoding(): ReturnType<typeof encoding_for_model> | null {
  if (enc) return enc;
  try {
    enc = encoding_for_model('gpt-4');
  } catch {
    enc = null;
  }
  return enc;
}

// ponytail: bounded string cache — tiktoken.encode() is CPU-heavy and the
// same message texts are re-encoded every round. Clear at 10k entries so a
// long session can't grow memory without bound.
const cache = new Map<string, number>();

export function countTokens(text: string): number {
  const cached = cache.get(text);
  if (cached !== undefined) return cached;
  const e = getEncoding();
  let count: number;
  if (e) {
    try {
      count = e.encode(text).length;
    } catch {
      count = Math.ceil(text.length / 4);
    }
  } else {
    count = Math.ceil(text.length / 4);
  }
  if (cache.size >= 10000) cache.clear();
  cache.set(text, count);
  return count;
}
