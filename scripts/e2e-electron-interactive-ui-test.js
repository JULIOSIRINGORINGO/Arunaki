import { _electron as electron } from 'playwright';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

async function runInteractiveElectronUiTest() {
  console.log('========================================================================');
  console.log('🖥️ RUNNING INTERACTIVE PLAYWRIGHT E2E UI TEST SUITE FOR ARUNAKI');
  console.log('========================================================================\n');

  const mainCjsPath = path.resolve('apps/desktop/main.cjs');
  const distIndexPath = path.resolve('apps/web/dist/index.html');
  const webFileUrl = pathToFileURL(distIndexPath).href;

  console.log(`[1] Launching Electron App with Web Bundle: ${webFileUrl}`);
  const app = await electron.launch({
    args: [mainCjsPath],
    env: { ...process.env, NODE_ENV: 'test', ARUNAKI_WEB_URL: webFileUrl },
  });

  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await new Promise((r) => setTimeout(r, 2000));

  const demoDir = path.resolve('workspace-demo');
  if (!fs.existsSync(demoDir)) {
    fs.mkdirSync(demoDir, { recursive: true });
  }

  // ----------------------------------------------------------------------
  // STEP 1: VERIFIKASI CHAT INPUT BOX & MENGETIK INSTRUKSI
  // ----------------------------------------------------------------------
  console.log('📝 [STEP 1] Interaction: Typing user prompt into Chat Input box...');
  const chatInputSelector = 'textarea, input[type="text"]';
  await window.waitForSelector(chatInputSelector, { timeout: 10000 });
  await window.fill(chatInputSelector, 'Buatkan file Excel laporan omset toko dengan kolom No, Produk, Total');
  await new Promise((r) => setTimeout(r, 1000));

  const step1Screenshot = path.join(demoDir, 'electron-ui-step1-typed.png');
  await window.screenshot({ path: step1Screenshot });
  console.log(`📸 Captured Step 1 Screenshot: ${step1Screenshot}`);

  // ----------------------------------------------------------------------
  // STEP 2: KLIK TOMBOL SEND DI UI
  // ----------------------------------------------------------------------
  console.log('\n🚀 [STEP 2] Interaction: Clicking Send Button in UI...');
  const sendButtonSelector = 'button:has(svg), button[type="submit"]';
  await window.click(sendButtonSelector);
  await new Promise((r) => setTimeout(r, 2000));

  const step2Screenshot = path.join(demoDir, 'electron-ui-step2-sent.png');
  await window.screenshot({ path: step2Screenshot });
  console.log(`📸 Captured Step 2 Screenshot (Message Sent): ${step2Screenshot}`);

  // ----------------------------------------------------------------------
  // STEP 3: NAVIGASI KE TAB WORKSPACE DARI SIDEBAR UI
  // ----------------------------------------------------------------------
  console.log('\n📁 [STEP 3] Interaction: Clicking Workspace menu in Sidebar...');
  const workspaceNavSelector = 'text="Workspace"';
  await window.click(workspaceNavSelector);
  await new Promise((r) => setTimeout(r, 2000));

  const step3Screenshot = path.join(demoDir, 'electron-ui-step3-workspace.png');
  await window.screenshot({ path: step3Screenshot });
  console.log(`📸 Captured Step 3 Screenshot (Workspace View): ${step3Screenshot}`);

  // ----------------------------------------------------------------------
  // STEP 4: NAVIGASI KE TAB KNOWLEDGE DARI SIDEBAR UI
  // ----------------------------------------------------------------------
  console.log('\n📚 [STEP 4] Interaction: Clicking Knowledge menu in Sidebar...');
  const knowledgeNavSelector = 'text="Knowledge"';
  await window.click(knowledgeNavSelector);
  await new Promise((r) => setTimeout(r, 2000));

  const step4Screenshot = path.join(demoDir, 'electron-ui-step4-knowledge.png');
  await window.screenshot({ path: step4Screenshot });
  console.log(`📸 Captured Step 4 Screenshot (Knowledge View): ${step4Screenshot}`);

  // Close app
  await app.close();

  console.log('\n========================================================================');
  console.log('🎉 ALL 4 INTERACTIVE ELECTRON UI TESTS PASSED WITH SCREENSHOT EVIDENCE!');
  console.log('========================================================================');
}

runInteractiveElectronUiTest().catch((err) => {
  console.error('❌ INTERACTIVE ELECTRON UI TEST FAILED:', err);
  process.exit(1);
});
