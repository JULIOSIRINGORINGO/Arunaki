import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module.js';
import { WorkspaceRunnerService } from './src/modules/workspace/workspace-runner.service.js';

async function testTerminalCreation() {
  console.log('🚀 Initializing Arunaki NestJS Application context...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const runner = app.get(WorkspaceRunnerService);

  const workspaceId = 'cms67jbut0000vt5saci76le9'; // LAPORAN workspace
  const goal = 'Buat file test_terminal_berhasil.txt dengan isi "Uji coba pembuatan file otomatis dari terminal berhasil 100%"';

  console.log(`📌 Target Workspace ID: ${workspaceId}`);
  console.log(`📌 Goal: "${goal}"`);
  console.log('🔄 Executing Workspace Agent Stream...');

  await runner.runWorkspaceAgentStream(
    { workspaceId, userGoal: goal, historyMessages: [] },
    (event) => {
      if (event.type === 'thinking') console.log(`[THINKING] ${event.data}`);
      if (event.type === 'plan_created') console.log(`[PLAN] ${event.data.steps?.join(' | ')}`);
      if (event.type === 'tool_start') console.log(`[TOOL START] ${event.data.toolName}`, JSON.stringify(event.data.args));
      if (event.type === 'tool_done') console.log(`[TOOL DONE] ${event.data.toolName}`);
      if (event.type === 'text_delta') console.log(`[AI RESPONSE] ${event.data}`);
      if (event.type === 'error') console.error(`[ERROR]`, event.data);
    }
  );

  console.log('✅ Agent execution finished. Closing app context.');
  await app.close();
}

testTerminalCreation().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
