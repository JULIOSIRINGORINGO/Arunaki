import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AgentRunnerService } from './modules/chat/agent-runner.service.js';
import { AppModule } from './app.module.js';
import { PrismaService } from './common/providers/prisma.service.js';
import * as fs from 'fs';
import * as path from 'path';

describe('Live Multi-Turn LLM Stress Test (Real LLM Execution Across Turns)', () => {
  let agentRunner: AgentRunnerService;
  let app: TestingModule;
  let prisma: PrismaService;
  let workspace: any;
  let chatId: string;
  const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    agentRunner = app.get<AgentRunnerService>(AgentRunnerService);
    prisma = app.get<PrismaService>(PrismaService);

    // Ensure workspace exists
    workspace = await prisma.workspace.findFirst();
    if (!workspace) {
      workspace = await prisma.workspace.create({
        data: {
          name: 'Multi-Turn LLM Workspace',
          rootPath: path.resolve(process.cwd()),
        },
      });
    }

    // Create session chat
    const chat = await prisma.chatHistory.create({
      data: { title: 'Multi-Turn Live LLM Stress Test', workspaceId: workspace.id },
    });
    chatId = chat.id;

    // Create test files in workspace
    const draftContract = path.join(workspace.rootPath, 'draft_spk_e2e.txt');
    fs.writeFileSync(
      draftContract,
      'SURAT PERINTAH KERJA\nNomor: 088/SPK/2026\nKlien: PT Maju Jaya\nPenanggung Jawab: Ahmad Yani\nNIK: 3171019988770002\nNo. HP: 081288990011\nNo. Rekening: 998877665544\nNilai: Rp 50.000.000',
      'utf-8',
    );
  });

  afterAll(async () => {
    try {
      const draftContract = path.join(workspace.rootPath, 'draft_spk_e2e.txt');
      if (fs.existsSync(draftContract)) fs.unlinkSync(draftContract);
    } catch {}
    await app.close();
  });

  // ==========================================
  // TURN 1: Live LLM Instruction to Read & Audit
  // ==========================================
  it('Turn 1 (Live LLM): LLM inspects contract file and identifies sensitive data', async () => {
    const userPrompt =
      'Tolong periksa file draft_spk_e2e.txt dan sebutkan data pribadi apa saja yang tercantum di dalamnya.';
    console.log(`\n💬 [TURN 1 USER]: "${userPrompt}"`);

    const result = await agentRunner.runAgentSync({
      chatId,
      userContent: userPrompt,
      chatMode: 'workspace',
      historyMessages: [...conversationHistory],
      idempotencyKey: `turn-1-${Date.now()}`,
    });

    console.log('\n🤖 [TURN 1 LLM RESPONSE]:');
    console.log(result.content);
    console.log('Tools Called:', result.toolOutputs?.map((t) => t.toolName) || []);

    conversationHistory.push({ role: 'user', content: userPrompt });
    conversationHistory.push({ role: 'assistant', content: result.content });

    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(10);
  }, 120000);

  // ==========================================
  // TURN 2: Live LLM Instruction to Mask/Redact PII
  // ==========================================
  it('Turn 2 (Live LLM): LLM executes doc_redact_pii on the contract from previous turn context', async () => {
    const userPrompt =
      'Sekarang tolong sensor semua data sensitif (NIK, No. HP, No. Rekening) di file draft_spk_e2e.txt menggunakan tool redact.';
    console.log(`\n💬 [TURN 2 USER]: "${userPrompt}"`);

    const result = await agentRunner.runAgentSync({
      chatId,
      userContent: userPrompt,
      chatMode: 'workspace',
      historyMessages: [...conversationHistory],
      idempotencyKey: `turn-2-${Date.now()}`,
    });

    console.log('\n🤖 [TURN 2 LLM RESPONSE]:');
    console.log(result.content);
    console.log('Tools Called:', result.toolOutputs?.map((t) => t.toolName) || []);

    conversationHistory.push({ role: 'user', content: userPrompt });
    conversationHistory.push({ role: 'assistant', content: result.content });

    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(10);
  }, 120000);

  // ==========================================
  // TURN 3: Live LLM Instruction for Document Comparison
  // ==========================================
  it('Turn 3 (Live LLM): LLM executes doc_compare_versions to diff contract versions', async () => {
    const userPrompt =
      'Bandingkan klausul asli dengan revisi berikut:\nVersi Asli: Nilai Rp 50.000.000, Waktu 30 hari\nVersi Revisi: Nilai Rp 75.000.000, Waktu 45 hari, Garansi 6 bulan';
    console.log(`\n💬 [TURN 3 USER]: "${userPrompt}"`);

    const result = await agentRunner.runAgentSync({
      chatId,
      userContent: userPrompt,
      chatMode: 'workspace',
      historyMessages: [...conversationHistory],
      idempotencyKey: `turn-3-${Date.now()}`,
    });

    console.log('\n🤖 [TURN 3 LLM RESPONSE]:');
    console.log(result.content);
    console.log('Tools Called:', result.toolOutputs?.map((t) => t.toolName) || []);

    conversationHistory.push({ role: 'user', content: userPrompt });
    conversationHistory.push({ role: 'assistant', content: result.content });

    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(10);
  }, 120000);

  // ==========================================
  // TURN 4: Live LLM Currency Calculation / Unit Conversion
  // ==========================================
  it('Turn 4 (Live LLM): LLM performs currency conversion calculation across turns', async () => {
    const userPrompt =
      'Berdasarkan nilai kontrak revisi Rp 75.000.000 di Turn 3 tadi, jika dikonversi ke USD dengan kurs Rp 15.500 per USD, berapa nilainya? Berikan kesimpulan akhir.';
    console.log(`\n💬 [TURN 4 USER]: "${userPrompt}"`);

    const result = await agentRunner.runAgentSync({
      chatId,
      userContent: userPrompt,
      chatMode: 'workspace',
      historyMessages: [...conversationHistory],
      idempotencyKey: `turn-4-${Date.now()}`,
    });

    console.log('\n🤖 [TURN 4 LLM RESPONSE]:');
    console.log(result.content);
    console.log('Tools Called:', result.toolOutputs?.map((t) => t.toolName) || []);

    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(10);
  }, 120000);
});
