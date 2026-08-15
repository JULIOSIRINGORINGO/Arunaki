import 'dotenv/config';
import { SecretsVaultService } from '../src/modules/security/secrets-vault.service.js';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';

async function main() {
  const dbPath = path.resolve(process.cwd(), 'apps/api/prisma/dev.db');
  const db = new DatabaseSync(dbPath);
  const provider: any = db.prepare("SELECT id, name, baseUrl, apiKey, model FROM providers WHERE id = 'kenari'").get();
  const vault = new SecretsVaultService();
  const decryptedKey = vault.decryptSecret(JSON.parse(provider.apiKey));
  console.log('Provider model in DB:', provider.model);
  console.log('Decrypted key prefix:', decryptedKey.slice(0, 10));

  const modelsRes = await fetch('https://kenari.id/v1/models', {
    headers: { 'Authorization': 'Bearer ' + decryptedKey }
  });
  console.log('GET /models status:', modelsRes.status);
  const modelsData = await modelsRes.json();
  console.log('Available models:', JSON.stringify(modelsData, null, 2));

  console.log('\nTesting streamText with tools via createOpenAI...');
  const { createOpenAI } = await import('@ai-sdk/openai');
  const { streamText, tool, jsonSchema } = await import('ai');

  const openai = createOpenAI({
    baseURL: 'https://kenari.id/v1',
    apiKey: decryptedKey,
  });

  const { readFileSync } = await import('fs');
  const targetContent = readFileSync(path.resolve(process.cwd(), 'E:/JS/laporan-test/REKAPAN TERBARU2.txt'), 'utf-8');

  const systemPrompt = `You are Arunaki, an autonomous document workspace agent.
Always use "edit" tool for surgical modifications in existing documents. Never overwrite or destroy untouched sections.
Today is 15 Agustus 2026.`;

  const userGoal = `Update laporan hari ini di file @REKAPAN TERBARU2.txt dengan data berikut, dan hitung ulang semua total secara otomatis:

PEMASUKAN:
CK DEDI = 300RB(BCA) [ DTF ]✅
CK OWEN = 200RB(BNI) [10 PCS ]✅
CK BAMBANG = 450RB(BCA) [25 PCS ]✅
TOKO JAYA = 150RB(CASH) [ DTF ]✅
BUK RINA = 75RB(BCA) [5 PCS ]✅

NOTE BELUM BAYAR:
CI LISOI (10-02-2024) = 140RB
CK TUKANG METER PLN(18-7-2026) = 50RB✅
BG JONO(28-7-2026) = 720RB✅

PENGELUARAN:
GALON 7
PARKIR 3
PRINT 5
LAUNDRY 30
LISTRIK 250
TOKO SEMBAKO 175
BENSIN 100`;

  const candidates = ['gemini-2-5-flash', 'gemini-3-1-flash-lite', 'qwen3-7-flash', 'step-3-7-flash', 'deepseek-v4-flash'];

  for (const modelId of candidates) {
    console.log(`\n=== Benchmarking model: ${modelId} ===`);
    const t0 = Date.now();
    try {
      const streamResult = streamText({
        model: openai.chat(modelId),
        system: systemPrompt,
        messages: [
          { role: 'user', content: userGoal + '\n\nFile Content:\n' + targetContent }
        ],
        tools: {
          edit: tool({
            description: 'Perform surgical string replacement in a document.',
            inputSchema: jsonSchema({
              type: 'object',
              properties: {
                filePath: { type: 'string' },
                oldString: { type: 'string' },
                newString: { type: 'string' }
              },
              required: ['filePath', 'oldString', 'newString']
            })
          })
        },
        maxRetries: 0
      });

      const toolsCalled: string[] = [];
      for await (const part of streamResult.fullStream) {
        if (part.type === 'tool-call') {
          toolsCalled.push((part as any).toolName);
        } else if (part.type === 'tool-input-start') {
          toolsCalled.push((part as any).toolName);
        }
      }
      console.log(`✅ ${modelId} finished in ${((Date.now() - t0)/1000).toFixed(2)}s with ${toolsCalled.length} tool calls`);
    } catch (e: any) {
      console.log(`❌ ${modelId} failed in ${((Date.now() - t0)/1000).toFixed(2)}s:`, e.message);
    }
  }
}

main().catch(console.error);
