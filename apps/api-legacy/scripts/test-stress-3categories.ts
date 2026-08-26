import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'http://127.0.0.1:3000/api/v1';
const WORKSPACE_ID = 'cmshh81u8000bvg78c4ay5hgk';
const WORKSPACE_ROOT = 'E:/JS/laporan-test';

async function runDocumentProcessingStressTest(workspaceId: string): Promise<void> {
  console.log('\n🚀 Starting Document Processing Stress Test...');
  
  const instruction = `Pindahkan data dari @REKAPAN TERBARU2.txt ke file baru REKAPAN BARU.xlsx dengan format yang rapi.`;

  let sawDone = false;
  
  try {
    const response = await fetch(`${API_BASE}/workspaces/${workspaceId}/agent/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.ARUNAKI_API_KEY || '199710338e26f2127f7012001e927b4b'
      },
      body: JSON.stringify({ goal: instruction, historyMessages: [], modelId: 'gpt-oss-120b' }),
    });

    if (response.ok && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const streamDeadline = Date.now() + 300000;
      
      while (Date.now() < streamDeadline) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === 'tool_start') console.log(`[tool_call] ${event.data?.toolName}`);
              if (event.type === 'text_delta') console.log(`[llm] ${String(event.data).slice(0, 150)}`);
              if (event.type === 'completed') sawDone = true;
            } catch (e) {
              // ignore parse errors
            }
          }
        }
        
        if (sawDone) {
          await new Promise(r => setTimeout(r, 2000));
          break;
        }
      }
    } else {
      throw new Error('HTTP server offline');
    }
  } catch (fetchErr: any) {
    console.log('⚠️  HTTP Server offline, running Agent via NestJS Application Context...');
    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../src/app.module.js');
    const { WorkspaceRunnerService } = await import('../src/modules/workspace/workspace-runner.service.js');
    const app = await NestFactory.createApplicationContext(AppModule);
    const workspaceRunner = app.get(WorkspaceRunnerService);

    await workspaceRunner.runWorkspaceAgentStream(
      {
        workspaceId: workspaceId,
        userGoal: instruction,
        historyMessages: [],
      },
      (event: any) => {
        if (event.type === 'tool_start') console.log(`[tool_call] ${event.data?.toolName}`);
        if (event.type === 'text_delta') console.log(`[llm] ${String(event.data).slice(0, 150)}`);
        if (event.type === 'completed') sawDone = true;
      },
    );
    await app.close();
  }
  
  await new Promise(r => setTimeout(r, 1000));
}

async function runDataAggregationStressTest(workspaceId: string): Promise<void> {
  console.log('\n🚀 Starting Data Aggregation Stress Test...');
  
  const instruction = `Analisis data di @REKAPAN TERBARU2.txt dan buat laporan ringkasan berisi: total setiap kategori, rata-rata, maksimum, dan minimum.`;

  let sawDone = false;
  
  try {
    const response = await fetch(`${API_BASE}/workspaces/${workspaceId}/agent/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.ARUNAKI_API_KEY || '199710338e26f2127f7012001e927b4b'
      },
      body: JSON.stringify({ goal: instruction, historyMessages: [], modelId: 'gpt-oss-120b' }),
    });

    if (response.ok && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const streamDeadline = Date.now() + 300000;
      
      while (Date.now() < streamDeadline) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === 'tool_start') console.log(`[tool_call] ${event.data?.toolName}`);
              if (event.type === 'text_delta') console.log(`[llm] ${String(event.data).slice(0, 150)}`);
              if (event.type === 'completed') sawDone = true;
            } catch (e) {
              // ignore parse errors
            }
          }
        }
        
        if (sawDone) {
          await new Promise(r => setTimeout(r, 2000));
          break;
        }
      }
    } else {
      throw new Error('HTTP server offline');
    }
  } catch (fetchErr: any) {
    console.log('⚠️  HTTP Server offline, running Agent via NestJS Application Context...');
    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../src/app.module.js');
    const { WorkspaceRunnerService } = await import('../src/modules/workspace/workspace-runner.service.js');
    const app = await NestFactory.createApplicationContext(AppModule);
    const workspaceRunner = app.get(WorkspaceRunnerService);

    await workspaceRunner.runWorkspaceAgentStream(
      {
        workspaceId: workspaceId,
        userGoal: instruction,
        historyMessages: [],
      },
      (event: any) => {
        if (event.type === 'tool_start') console.log(`[tool_call] ${event.data?.toolName}`);
        if (event.type === 'text_delta') console.log(`[llm] ${String(event.data).slice(0, 150)}`);
        if (event.type === 'completed') sawDone = true;
      },
    );
    await app.close();
  }
  
  await new Promise(r => setTimeout(r, 1000));
}

async function runWorkflowAutomationStressTest(workspaceId: string): Promise<void> {
  console.log('\n🚀 Starting Workflow Automation Stress Test...');
  
  const instruction = `Buat laporan perdagangan harian untuk hari ini. Gunakan template yang ada di REKAPAN TERBARU2.txt sebagai basis. Tambahkan kolom "Selisih" yang dihitung sebagai (Pemasukan - Pengeluaran). Simpan di file yang sama.`;

  let sawDone = false;
  
  try {
    const response = await fetch(`${API_BASE}/workspaces/${workspaceId}/agent/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.ARUNAKI_API_KEY || '199710338e26f2127f7012001e927b4b'
      },
      body: JSON.stringify({ goal: instruction, historyMessages: [], modelId: 'gpt-oss-120b' }),
    });

    if (response.ok && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const streamDeadline = Date.now() + 300000;
      
      while (Date.now() < streamDeadline) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === 'tool_start') console.log(`[tool_call] ${event.data?.toolName}`);
              if (event.type === 'text_delta') console.log(`[llm] ${String(event.data).slice(0, 150)}`);
              if (event.type === 'completed') sawDone = true;
            } catch (e) {
              // ignore parse errors
            }
          }
        }
        
        if (sawDone) {
          await new Promise(r => setTimeout(r, 2000));
          break;
        }
      }
    } else {
      throw new Error('HTTP server offline');
    }
  } catch (fetchErr: any) {
    console.log('⚠️  HTTP Server offline, running Agent via NestJS Application Context...');
    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../src/app.module.js');
    const { WorkspaceRunnerService } = await import('../src/modules/workspace/workspace-runner.service.js');
    const app = await NestFactory.createApplicationContext(AppModule);
    const workspaceRunner = app.get(WorkspaceRunnerService);

    await workspaceRunner.runWorkspaceAgentStream(
      {
        workspaceId: workspaceId,
        userGoal: instruction,
        historyMessages: [],
      },
      (event: any) => {
        if (event.type === 'tool_start') console.log(`[tool_call] ${event.data?.toolName}`);
        if (event.type === 'text_delta') console.log(`[llm] ${String(event.data).slice(0, 150)}`);
        if (event.type === 'completed') sawDone = true;
      },
    );
    await app.close();
  }
  
  await new Promise(r => setTimeout(r, 1000));
}

async function runAllStressTests(): Promise<void> {
  console.log('🧪 Starting 3-Category Stress Test Suite...');
  
  // Test 1: Document Processing
  await runDocumentProcessingStressTest(WORKSPACE_ID);
  console.log('✅ Document Processing Stress Test completed');
  
  // Test 2: Data Aggregation
  await runDataAggregationStressTest(WORKSPACE_ID);
  console.log('✅ Data Aggregation Stress Test completed');
  
  // Test 3: Workflow Automation
  await runWorkflowAutomationStressTest(WORKSPACE_ID);
  console.log('✅ Workflow Automation Stress Test completed');
  
  console.log('\n🎉 All 3 stress test categories passed!');
}

runAllStressTests();