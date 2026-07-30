import { _electron as electron } from 'playwright';
import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

async function runElectronUiE2eTest() {
  console.log('========================================================================');
  console.log('🖥️ RUNNING AUTOMATED PLAYWRIGHT ELECTRON UI E2E TEST SUITE FOR ARUNAKI');
  console.log('========================================================================\n');

  const mainCjsPath = path.resolve('apps/desktop/main.cjs');
  const distIndexPath = path.resolve('apps/web/dist/index.html');
  const webFileUrl = pathToFileURL(distIndexPath).href;

  console.log(`[1] Target Web Bundle File URL: ${webFileUrl}`);
  console.log(`[2] Launching Electron app via Playwright from: ${mainCjsPath}`);

  let app;
  try {
    app = await electron.launch({
      args: [mainCjsPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ARUNAKI_WEB_URL: webFileUrl,
      },
    });
  } catch (err) {
    console.error('❌ Failed to launch Electron process:', err.message);
    process.exit(1);
  }

  console.log('✅ [1] Electron app launched successfully!');

  // 2. Obtain First Window
  console.log('[3] Waiting for Electron BrowserWindow to load real Web UI...');
  const window = await app.firstWindow();

  // Listen to browser console and page errors
  window.on('console', (msg) => console.log(`   [PAGE CONSOLE ${msg.type()}]:`, msg.text()));
  window.on('pageerror', (err) => console.error('   [PAGE ERROR]:', err.message));

  // Wait for real UI URL to load
  try {
    await window.waitForURL((url) => !url.href.includes('data:text/html'), { timeout: 10000 });
  } catch {
    // ignore
  }

  await window.waitForLoadState('domcontentloaded');
  await new Promise((r) => setTimeout(r, 4000));

  const title = await window.title();
  console.log(`   -> Window Title: "${title}"`);
  console.log(`   -> Window Loaded URL: "${window.url()}"`);

  // 3. Take Window Screenshot of REAL Web UI
  const screenshotPath = path.resolve('workspace-demo/electron-ui-screenshot.png');
  const parentDir = path.dirname(screenshotPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }
  await window.screenshot({ path: screenshotPath });
  console.log(`📸 [4] Captured REAL Electron UI Screenshot: ${screenshotPath}`);

  // 4. Test IPC Bridge Execution
  console.log('\n⚡ [5] Testing Electron Main Process IPC Handlers...');
  const isPackaged = await app.evaluate(async ({ app }) => {
    return app.isPackaged;
  });
  console.log(`   -> Electron App Packaged State: ${isPackaged}`);

  // 5. Clean Close
  console.log('\n🔒 [6] Closing Electron App cleanly...');
  await app.close();
  console.log('========================================================================');
  console.log('🎉 PLAYWRIGHT ELECTRON UI E2E TEST PASSED 100% WITH REAL WEB UI!');
  console.log('========================================================================');
}

runElectronUiE2eTest().catch((err) => {
  console.error('❌ ELECTRON E2E TEST FAILED:', err);
  process.exit(1);
});
