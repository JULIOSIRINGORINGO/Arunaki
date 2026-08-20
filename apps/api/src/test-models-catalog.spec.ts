import { describe, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { AppModule } from './app.module.js';
import { AgentRunnerService } from './modules/chat/agent-runner.service.js';
import { PrismaService } from './common/providers/prisma.service.js';
import { ProviderService } from './modules/provider/provider.service.js';
import { Logger } from '@nestjs/common';

const logger = new Logger('ModelTest');

// OpenRouter Free tier fallback models
const MODELS_TO_TEST = [
  { name: 'Murah: GPT OSS 120B', id: 'gpt-oss-120b' },
  { name: 'Mahal: DeepSeek V4 Flash', id: 'deepseek-v4-flash' },
];

describe('Test Models Catalog', () => {
  it('should test models', async () => {
    logger.log('Starting NestJS application context...');

    // Disable OpenRouter fallback from .env
    process.env.AI_API_KEY = '';

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleFixture;
    const agentRunner = app.get(AgentRunnerService);
    const prisma = app.get(PrismaService);
    const providerService = app.get(ProviderService);

    const workspace = await prisma.workspace.findFirst();
    if (!workspace) {
      logger.error('No workspace found in DB!');
      await app.close();
      return;
    }

    // Find Kenari provider
    const provider = await prisma.provider.findFirst({
      where: { baseUrl: { contains: 'kenari.id' } },
    });

    if (!provider) {
      logger.error('Kenari provider not found in DB!');
      await app.close();
      return;
    }

    // Make Kenari the default provider
    await prisma.provider.updateMany({ data: { active: false } });
    await prisma.provider.update({
      where: { id: provider.id },
      data: { active: true, priority: 1 },
    });

    logger.log('Found Workspace: ' + workspace.name);

    for (const model of MODELS_TO_TEST) {
      logger.log(`\n\n======================================================`);
      logger.log(`🤖 MENGUJI MODEL: ${model.name} (${model.id})`);
      logger.log(`======================================================`);

      // Update Provider in DB to use this model
      await prisma.provider.update({
        where: { id: provider.id },
        data: { model: model.id },
      });

      // Clear ProviderService cache to force reload
      (providerService as any).activeProvider = null;

      const chat = await prisma.chatHistory.create({
        data: { title: `Test Model ${model.id}`, workspaceId: workspace.id },
      });

      const prompt =
        'Mention 1 file that is currently in my working directory (use tools to list files). Reply very briefly.';
      logger.log(`💬 Prompt: "${prompt}"\n`);

      try {
        const start = Date.now();
        const result = await agentRunner.runAgentSync({
          chatId: chat.id,
          userContent: prompt,
          chatMode: 'workspace',
          historyMessages: [],
          idempotencyKey: `test-${model.id}-${Date.now()}`,
        });

        const duration = ((Date.now() - start) / 1000).toFixed(1);
        logger.log(`\n✅ [BERHASIL - ${duration}s] RESPONS LLM:`);
        logger.log(`------------------------------------------------------`);
        console.log(result.content.trim());
        logger.log(`------------------------------------------------------`);
      } catch (error: any) {
        logger.error(`\n❌ [GAGAL] ${error.message}`);
      }
    }

    await app.close();
  }, 999999);
});
