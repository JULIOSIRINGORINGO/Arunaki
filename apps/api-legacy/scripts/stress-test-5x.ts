import { spawn } from 'child_process';
import * as path from 'path';

interface RunResult {
  run: number;
  durationSec: number;
  exitCode: number;
  passedChecks: number;
  totalChecks: number;
  success: boolean;
  outputSummary: string;
}

const TOTAL_RUNS = 5;
const MODEL_TARGET = process.argv[2] || 'agnes-2-5-flash:free';

async function executeSingleRun(runIndex: number): Promise<RunResult> {
  console.log(`\n========================================================================`);
  console.log(`🔥 [RUN ${runIndex}/${TOTAL_RUNS}] Executing test-rekap-extended with model: ${MODEL_TARGET}...`);
  console.log(`========================================================================`);

  const startTime = Date.now();

  return new Promise<RunResult>((resolve) => {
    const proc = spawn('npx', ['tsx', 'scripts/test-rekap-extended.ts', MODEL_TARGET], {
      cwd: path.resolve('e:/ARUNAKI/apps/api'),
      shell: true,
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    proc.on('close', (code) => {
      const durationSec = Math.round((Date.now() - startTime) / 100) / 10;
      const match = stdout.match(/(\d+)\/(\d+)\s+checks passed/i);
      const passedChecks = match ? parseInt(match[1], 10) : 0;
      const totalChecks = match ? parseInt(match[2], 10) : 17;
      const success = code === 0 && passedChecks === totalChecks;

      resolve({
        run: runIndex,
        durationSec,
        exitCode: code || 0,
        passedChecks,
        totalChecks,
        success,
        outputSummary: success ? 'All checks passed' : (stderr || stdout.slice(-300)),
      });
    });
  });
}

async function main() {
  console.log(`\n========================================================================`);
  console.log(`⚡ STRESS TEST SUITE: 5 CONSECUTIVE RUNS OF test-rekap-extended.ts`);
  console.log(`🎯 Target Model: ${MODEL_TARGET}`);
  console.log(`========================================================================\n`);

  const results: RunResult[] = [];

  for (let i = 1; i <= TOTAL_RUNS; i++) {
    const res = await executeSingleRun(i);
    results.push(res);
    console.log(`\n🏁 Run ${i} completed in ${res.durationSec}s — Score: ${res.passedChecks}/${res.totalChecks} (${res.success ? '✅ SUCCESS' : '❌ FAILED'})`);
    
    // Cooldown 2s between runs
    if (i < TOTAL_RUNS) {
      console.log(`⏳ Cooldown 2s before next run...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log(`\n========================================================================`);
  console.log(`📊 5X STRESS TEST FINAL SUMMARY REPORT`);
  console.log(`========================================================================\n`);

  const successfulRuns = results.filter((r) => r.success).length;
  const passRate = (successfulRuns / TOTAL_RUNS) * 100;
  const avgDuration = Math.round((results.reduce((acc, r) => acc + r.durationSec, 0) / TOTAL_RUNS) * 10) / 10;
  const minDuration = Math.min(...results.map((r) => r.durationSec));
  const maxDuration = Math.max(...results.map((r) => r.durationSec));

  console.log(`| Run # | Duration (s) | Checks Passed | Status |`);
  console.log(`| :---: | :----------: | :-----------: | :----: |`);
  results.forEach((r) => {
    console.log(`| Run ${r.run} | ${r.durationSec}s | ${r.passedChecks}/${r.totalChecks} | ${r.success ? '✅ PASS' : '❌ FAIL'} |`);
  });

  console.log(`\n📈 Statistical Highlights:`);
  console.log(`- Success Rate: ${successfulRuns}/${TOTAL_RUNS} (${passRate}%)`);
  console.log(`- Average Latency: ${avgDuration}s`);
  console.log(`- Fastest Run: ${minDuration}s`);
  console.log(`- Slowest Run: ${maxDuration}s`);

  if (successfulRuns === TOTAL_RUNS) {
    console.log(`\n🏆 CONCLUSION: SYSTEM IS 100% ROCK SOLID & STABLE OVER 5 CONSECUTIVE RUNS! 🎉\n`);
  } else {
    console.log(`\n⚠️ CONCLUSION: Some runs encountered errors. Review logs above.\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal stress test runner error:', err);
  process.exit(1);
});
