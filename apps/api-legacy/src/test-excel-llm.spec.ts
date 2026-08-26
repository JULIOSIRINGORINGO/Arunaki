import { describe, beforeAll, afterAll, it } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AgentRunnerService } from './modules/chat/agent-runner.service';
import { AppModule } from './app.module';
import { PrismaClient } from '@prisma/client';

describe('Test LLM Reading Excel', () => {
  let agentRunner: AgentRunnerService;
  let app: TestingModule;
  const prisma = new PrismaClient();

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    agentRunner = app.get<AgentRunnerService>(AgentRunnerService);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('should read the excel file via LLM and output the answer', async () => {
    const workspace = await prisma.workspace.findFirst();
    if (!workspace) throw new Error('No workspace');

    const chat = await prisma.chatHistory.create({
      data: { title: 'Test Excel LLM', workspaceId: workspace.id },
    });

    console.log(
      '\n💬 Prompt: "Please read testing.xlsx and show the first 3 customers with their amounts."',
    );

    const agentResult = await agentRunner.runAgentSync({
      chatId: chat.id,
      userContent:
        'Please read file testing.xlsx and show the first 3 customers with their amounts accurately.',
      chatMode: 'workspace',
      historyMessages: [],
      idempotencyKey: 'test-excel-llm-' + Date.now(),
    });

    console.log('\n\n🤖 ==== RESPONS ASLI DARI ARUNAKI ==== 🤖');
    console.log(agentResult.content);
    console.log('============================================\n\n');
  }, 90000);
});
