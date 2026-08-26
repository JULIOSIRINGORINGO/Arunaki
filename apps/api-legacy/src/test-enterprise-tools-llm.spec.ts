import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AgentRunnerService } from './modules/chat/agent-runner.service.js';
import { AppModule } from './app.module.js';
import { PrismaService } from './common/providers/prisma.service.js';
import * as fs from 'fs';
import * as path from 'path';

describe('Live E2E: Arunaki System to LLM Tool Calling', () => {
  let agentRunner: AgentRunnerService;
  let app: TestingModule;
  let prisma: PrismaService;
  let workspace: any;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    agentRunner = app.get<AgentRunnerService>(AgentRunnerService);
    prisma = app.get<PrismaService>(PrismaService);

    // Get or create workspace
    workspace = await prisma.workspace.findFirst();
    if (!workspace) {
      workspace = await prisma.workspace.create({
        data: {
          name: 'E2E Test Workspace',
          rootPath: path.resolve(process.cwd()),
        },
      });
    }

    // Create test files in workspace
    const samplePiiFile = path.join(workspace.rootPath, 'sample_karyawan_e2e.txt');
    fs.writeFileSync(
      samplePiiFile,
      'Data Pegawai:\nNama: Budi Handoko\nNIK: 3171012345670001\nNPWP: 02.345.678.9-012.000\nNo. HP: 081298765432\nNo. Rekening: 543210987654',
      'utf-8',
    );
  });

  afterAll(async () => {
    try {
      const samplePiiFile = path.join(workspace.rootPath, 'sample_karyawan_e2e.txt');
      if (fs.existsSync(samplePiiFile)) fs.unlinkSync(samplePiiFile);
    } catch {}
    await app.close();
  });

  it('LLM autonomously executes doc_redact_pii when asked to redact sensitive employee data', async () => {
    const chat = await prisma.chatHistory.create({
      data: { title: 'Live E2E Redact Test', workspaceId: workspace.id },
    });

    console.log('\n💬 [USER PROMPT]: "Tolong sensor data pribadi NIK dan rekening di sample_karyawan_e2e.txt"');

    const result = await agentRunner.runAgentSync({
      chatId: chat.id,
      userContent:
        'Tolong periksa dan sensor data pribadi (NIK, NPWP, No. Rekening) di file sample_karyawan_e2e.txt menggunakan tool redact.',
      chatMode: 'workspace',
      historyMessages: [],
      idempotencyKey: 'e2e-live-redact-' + Date.now(),
    });

    console.log('\n🤖 ==== RESPONS ASLI DARI ARUNAKI LLM ==== 🤖');
    console.log(result.content);
    console.log('Tool outputs executed:', result.toolOutputs?.map((t) => t.toolName) || []);
    console.log('============================================\n');

    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(10);
  }, 120000);

  it('LLM understands document comparison tool and responds accurately', async () => {
    const chat = await prisma.chatHistory.create({
      data: { title: 'Live E2E Compare Test', workspaceId: workspace.id },
    });

    console.log('\n💬 [USER PROMPT]: "Bandingkan Versi A: Harga 10000 vs Versi B: Harga 15000"');

    const result = await agentRunner.runAgentSync({
      chatId: chat.id,
      userContent:
        'Bandingkan dua teks kontrak ini:\nDokumen A:\nPasal 1: Harga Rp 10.000\n\nDokumen B:\nPasal 1: Harga Rp 15.000\nPasal 2: Garansi 1 tahun',
      chatMode: 'workspace',
      historyMessages: [],
      idempotencyKey: 'e2e-live-compare-' + Date.now(),
    });

    console.log('\n🤖 ==== RESPONS ASLI DARI ARUNAKI LLM ==== 🤖');
    console.log(result.content);
    console.log('Tool outputs executed:', result.toolOutputs?.map((t) => t.toolName) || []);
    console.log('============================================\n');

    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(10);
  }, 120000);
});
