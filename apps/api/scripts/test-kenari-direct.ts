import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

const apiKey = process.env.AI_API_KEY || '';
const baseUrl = process.env.AI_BASE_URL || 'https://kenari.id/v1';

const openai = createOpenAI({
  apiKey,
  baseURL: baseUrl,
});

async function main() {
  console.log('\n--- TEST 1: Default /chat/completions ---');
  const t0 = Date.now();
  const res1 = streamText({
    model: openai.chat('gpt-oss-120b'),
    messages: [
      { role: 'user', content: 'Hitung total belanja: 3 apel @5000, 2 jeruk @7000, 1 melon @25000. Jawab singkat angka saja.' }
    ],
  });
  let reasoning1 = '';
  let text1 = '';
  for await (const part of res1.fullStream) {
    if (part.type === 'reasoning-delta') reasoning1 += (part.text || '');
    if (part.type === 'text-delta') text1 += ((part as any).text || (part as any).textDelta || '');
  }
  console.log(`⏱️ Default: Total ${Date.now() - t0}ms\nReasoning (${reasoning1.length} chars): ${reasoning1}\nOutput: ${text1}`);

  console.log('\n--- TEST 2: With Concise Reasoning Steering ---');
  const t1 = Date.now();
  const res2 = streamText({
    model: openai.chat('gpt-oss-120b'),
    messages: [
      { role: 'user', content: '[CRITICAL: No long reasoning. Output final answer directly in under 5 words]\nHitung total belanja: 3 apel @5000, 2 jeruk @7000, 1 melon @25000. Jawab singkat angka saja.' }
    ],
  });
  let reasoning2 = '';
  let text2 = '';
  for await (const part of res2.fullStream) {
    if (part.type === 'reasoning-delta') reasoning2 += (part.text || '');
    if (part.type === 'text-delta') text2 += ((part as any).text || (part as any).textDelta || '');
  }
  console.log(`⏱️ Concise: Total ${Date.now() - t1}ms\nReasoning (${reasoning2.length} chars): ${reasoning2}\nOutput: ${text2}`);
}

main().catch(console.error);
