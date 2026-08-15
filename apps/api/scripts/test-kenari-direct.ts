import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

const apiKey = process.env.AI_API_KEY || '';
const baseUrl = process.env.AI_BASE_URL || 'https://kenari.id/v1';

console.log('Testing direct Kenari endpoint:', baseUrl, 'Key length:', apiKey.length);

const openai = createOpenAI({
  apiKey,
  baseURL: baseUrl,
});

async function main() {
  console.log('\n1. Testing direct generateText on gpt-oss-120b...');
  const t0 = Date.now();
  try {
    const res = await generateText({
      model: openai('gpt-oss-120b'),
      messages: [{ role: 'user', content: 'Halo, kamu model apa? Jawab dalam 1 kalimat.' }],
    });
    console.log(`✅ generateText success in ${Date.now() - t0}ms:\n`, res.text);
  } catch (err: any) {
    console.error(`❌ generateText failed in ${Date.now() - t0}ms:`, err.message);
  }

  console.log('\n2. Testing direct streamText on gpt-oss-120b...');
  const t1 = Date.now();
  try {
    const res = streamText({
      model: openai('gpt-oss-120b'),
      messages: [{ role: 'user', content: 'Halo, sebutkan angka 1 sampai 5.' }],
    });
    let chunks = 0;
    for await (const part of res.fullStream) {
      chunks++;
      console.log(`[chunk ${chunks}] type:`, part.type, (part as any).text || (part as any).textDelta || (part as any).reasoningDelta || (part as any).reasoning || '');
    }
    console.log(`✅ streamText completed in ${Date.now() - t1}ms with ${chunks} chunks.`);
  } catch (err: any) {
    console.error(`❌ streamText failed in ${Date.now() - t1}ms:`, err.message);
  }
}

main().catch(console.error);
