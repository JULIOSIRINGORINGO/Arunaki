import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module.js';
import { AgentRunnerService } from '../src/modules/chat/agent-runner.service.js';
import { PrismaService } from '../src/common/providers/prisma.service.js';
import { ProviderService } from '../src/modules/provider/provider.service.js';
import { Logger } from '@nestjs/common';

const logger = new Logger('ModelTest');

// OpenRouter Free tier fallback models
const MODELS_TO_TEST = [
  { name: 'Model Pintar 1 (Gemini 2.0 Flash)', id: 'google/gemini-2.0-flash-exp:free' },
  { name: 'Model Pintar 2 (Llama 3.2 3B)', id: 'meta-llama/llama-3.2-3b-instruct:free' },
  { name: 'Model Murah 1 (Mistral 7B)', id: 'mistralai/mistral-7b-instruct:free' },
];

async function bootstrap() {
  logger.log('Starting NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const agentRunner = app.get(AgentRunnerService);
  const prisma = app.get(PrismaService);
  const providerService = app.get(ProviderService);

  const workspace = await prisma.workspace.findFirst();
  if (!workspace) {
    logger.error('No workspace found in DB!');
    await app.close();
    return;
  }

  // Ensure we have a provider
  let provider = await prisma.provider.findFirst();
  if (!provider) {
    logger.error('No provider found in DB!');
    await app.close();
    return;
  }

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
      data: { title: `Test Model ${model.id}`, workspaceId: workspace.id }
    });

    const prompt = 'Mention 1 file that is currently in my working directory (use tools to list files). Reply briefly.';
    logger.log(`💬 Prompt: "${prompt}"\n`);
    
    try {
      const start = Date.now();
      const result = await agentRunner.runAgentSync({
        chatId: chat.id,
        userContent: prompt,
        chatMode: 'workspace',
        historyMessages: [],
        idempotencyKey: `test-${model.id}-${Date.now()}`
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
  process.exit(0);
}

bootstrap().catch(err => {
  console.error(err);
  process.exit(1);
});
