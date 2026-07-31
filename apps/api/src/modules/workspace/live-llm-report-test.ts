import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as dotenv from 'dotenv';
import { ProgrammaticVerifierService } from '../tools/services/programmatic-verifier.service.js';

dotenv.config();

async function runLiveLlmTest() {
  console.log('---------------------------------------------------------');
  console.log('🚀 MEMULAI UJI COBA MENGGUNAKAN LIVE LLM (Groq API)');
  console.log('   Model: llama-3.3-70b-versatile');
  console.log('   Base URL: https://api.groq.com/openai/v1');
  console.log('---------------------------------------------------------\n');

  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    console.error('❌ AI_API_KEY tidak ditemukan di environment variables.');
    process.exit(1);
  }
  const baseUrl = process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1';
  const model = process.env.AI_MODEL || 'llama-3.3-70b-versatile';

  const tempWorkspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'arunaki-live-llm-'));

  const templateContent = `REKAPAN PENJUALAN [TANGGAL]

PEMASUKAN :

[DATA PENJUALAN]

NOTE BELUM BAYAR :

TOTAL = 0

PENGELUARAN :

TOTAL PEMASUKAN: 0
TOTAL TF BRI: 0
TOTAL TF BNI: 0
TOTAL TF BCA: 0
TOTAL CASH: 0
TOTAL PENGELUARAN: 0

SELISIH: 0`;

  const templatePath = path.join(tempWorkspaceDir, 'REKAPAN TERBARU1.txt');
  await fs.writeFile(templatePath, templateContent, 'utf-8');
  console.log(`📁 File template 'REKAPAN TERBARU1.txt' berhasil dibuat di workspace.`);

  const userPrompt = `Buat laporan hari ini tanggal 31 Juli 2026

CK FAUZAN = 1.315RB(BCA) [ 37PCS ]✅
CK FADLAN = 974RB(BNI) [ 14 PCS ]✅
PAK ARNOL = 1.500RB(BRI) [ 20PCS + DTF ]✅`;

  console.log(`\n💬 Mengirim Request & Data ke Groq API (LLM Live)...`);
  const startTime = Date.now();

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: `Anda adalah AI Workspace Agent Arunaki. Tugas Anda adalah membaca template file dan mengisi laporan penjualan berdasarkan data transaksi user. 
Kalkulasikan total transfer bank (BCA, BNI, BRI) dan total pemasukan secara akurat.
Kembalikan HANYA isi file teks laporan ter-update tanpa komentar ekstra.`
          },
          {
            role: 'user',
            content: `Berikut isi template file REKAPAN TERBARU1.txt:
---
${templateContent}
---

Data Transaksi User:
${userPrompt}

Tolong hasilkan laporan penjualan lengkap untuk tanggal 31 Juli 2026.`
          }
        ],
        temperature: 0.1,
      }),
    });

    const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`❌ Groq API Error (${response.status}): ${errText}`);
      process.exit(1);
    }

    const json = await response.json();
    const llmOutputText = json.choices?.[0]?.message?.content || '';

    console.log(`\n✅ Respon diterima dari Groq LLM dalam ${durationSeconds} detik!`);
    console.log('---------------------------------------------------------');
    console.log('📄 ISI LAPORAN HASIL GENERASI AI (LLM):');
    console.log('---------------------------------------------------------');
    console.log(llmOutputText);
    console.log('---------------------------------------------------------\n');

    // Simpan file hasil generasi AI
    const reportPath = path.join(tempWorkspaceDir, 'REKAPAN_2026_07_31.txt');
    await fs.writeFile(reportPath, llmOutputText, 'utf-8');

    // Jalankan Programmatic Verifier
    const verifier = new ProgrammaticVerifierService();
    const verification = await verifier.verifyFile(reportPath, {
      mustExist: true,
      minSizeBytes: 50,
      mustContainRegex: /TOTAL PEMASUKAN/i,
    });

    console.log('🔍 HASIL VERIFIKASI PROGRAMMATIC VERIFIER (0-TOKEN):');
    console.log(`   Status Verifikasi : ${verification.verified ? 'LULUS ✅' : 'GAGAL ❌'}`);
    console.log(`   Waktu Verifikasi  : ${verification.executionTimeMs} ms`);
    console.log(`   Checks Passed     : ${verification.checksPassed.join(', ')}`);

    // Clean up
    await fs.rm(tempWorkspaceDir, { recursive: true, force: true });
    console.log('\n✨ Uji coba Live LLM selesai 100%.');

  } catch (err: any) {
    console.error('❌ Exception during Live LLM test:', err.message);
    process.exit(1);
  }
}

runLiveLlmTest();
