# Gap Analysis: Arunaki Harness vs OpenClaw/Claude Code Patterns — PART 2 (TERBARU)

**Status:** Temuan #11-16, hasil lanjutan audit batch 1 (`self-healing.service.ts`, `compaction.service.ts`, `tool-loop-detector.service.ts` — full-read baris-per-baris). **Belum diproses** — ini yang baru.
**Sumber audit:** `Arunaki-main__8_.zip`
**Tanggal audit:** Agustus 2026

> Temuan #1-10 (batch pertama, sudah kamu proses) ada di file terpisah: `PART1_FINDINGS_1-10_ALREADY_PROCESSED.md`. Penomoran di file ini sengaja dipertahankan #11-16 (bukan direset ke #1) supaya tetap konsisten dengan riwayat sebelumnya kalau kamu perlu cross-reference.

---

## Ringkasan Prioritas (Part 2 saja)

| # | Temuan | Kategori | Dampak | Effort Perbaikan |
|---|--------|----------|--------|-------------------|
| 11 | `fallbackMap` di self-healing salah nama tool — fallback tool dead code | Reliability | Sedang | Rendah |
| 12 | Self-healing retry loop tidak adaptif (errorMessage tidak diperbarui) | Reliability/Performa | Rendah-Sedang | Rendah |
| 13 | Validasi path bisa dilewati untuk filename tanpa separator | Safety | Rendah | Rendah |
| 14 | Compaction trigger berbasis jumlah pesan, bukan token | Performa/Akurasi | Sedang-Tinggi | Sedang |
| 15 | Panggilan LLM ringkasan compaction tidak dibatasi ukurannya | Reliability | Rendah-Sedang | Rendah |
| 16 | `clearSession()` di tool-loop-detector tidak pernah dipanggil | Reliability | Sedang | Rendah |

---

## 11. `fallbackMap` di Self-Healing Salah Nama Tool — Fallback Tool Jadi Dead Code

### Lokasi
`apps/api/src/modules/ai/self-healing.service.ts:38-42`

### Bukti kode
```ts
// self-healing.service.ts:38-42
private readonly fallbackMap: Record<string, string[]> = {
  workspace_search: ['workspace_list_files'],
  workspace_read: ['workspace_list_files'],
  workspace_analyze: ['workspace_read', 'workspace_list_files'],
};
```

```ts
// tools-provider.module.ts:634, 658, 677 — nama tool YANG SEBENARNYA terdaftar
name: 'search_workspace',       // bukan 'workspace_search'
name: 'list_workspace_files',   // bukan 'workspace_list_files'
name: 'read_workspace_file',    // bukan 'workspace_read'
```

```ts
// self-healing.service.ts:186 — lookup yang akan SELALU gagal
const fallbacks = this.fallbackMap[toolName] || [];  // toolName aktual = 'search_workspace', key di map = 'workspace_search' -> tidak pernah match
```

### Kenapa ini masalah
Class docstring `SelfHealingService` (baris 21-31) menjelaskan 3 strategi recovery: (1) retry dengan parameter disesuaikan, (2) fallback ke tool alternatif, (3) skip & report. Strategi #2 secara teknis terimplementasi lengkap (logic-nya benar), tapi **tidak pernah bisa trigger** karena kunci di `fallbackMap` pakai urutan kata terbalik (`noun_verb`) dari nama tool asli yang terdaftar di registry (`verb_noun`). Ini bug penamaan murni — bukan masalah desain. Dampaknya: kalau `search_workspace` gagal karena alasan yang seharusnya bisa di-recover dengan fallback ke `list_workspace_files` (misal query terlalu spesifik, hasil kosong), sistem langsung menyerah ke strategi retry-with-adjusted-params saja, tidak pernah mencoba fallback tool sama sekali.

### Rekomendasi perbaikan
1. Perbaiki key `fallbackMap` supaya sesuai nama tool asli:
   ```ts
   private readonly fallbackMap: Record<string, string[]> = {
     search_workspace: ['list_workspace_files'],
     read_workspace_file: ['list_workspace_files'],
     // tambahkan mapping lain yang relevan sesuai tool yang benar-benar terdaftar,
     // cek daftar lengkap di tools-provider.module.ts dan workspace-tools.service.ts
   };
   ```
2. Tambahkan test yang benar-benar memanggil `executeWithHealing()` dengan tool yang sengaja dibuat gagal, dan assert bahwa fallback tool ter-trigger (bukan cuma unit test terhadap `fallbackMap` object secara statis — history bug ini justru karena tidak ada test end-to-end yang benar-benar mengecek lookup-nya jalan).
3. Audit ulang seluruh nama tool yang dipakai di `self-healing.service.ts` (termasuk `recoveryStrategies`) terhadap nama tool aktual di registry — pola bug penamaan seperti ini bisa jadi ada di tempat lain juga.

### Kriteria selesai
- [ ] Key `fallbackMap` cocok persis dengan nama tool yang terdaftar di registry
- [ ] Test end-to-end memverifikasi fallback tool benar-benar ter-eksekusi saat tool utama gagal
- [ ] Tidak ada mapping lain di file yang sama yang punya mismatch serupa

---

## 12. Self-Healing Retry Loop Tidak Adaptif

### Lokasi
`apps/api/src/modules/ai/self-healing.service.ts:150-208`

### Bukti kode
```ts
// self-healing.service.ts:150-151
const errorMessage =
  firstResult.error?.message || firstResult.preview || 'Unknown error';

// baris 154 — errorMessage di atas dipakai untuk SEMUA iterasi retry,
// tidak pernah di-reassign dari retryResult
for (let retry = 0; retry < this.MAX_RETRIES; retry++) {
  const strategy = this.findRecoveryStrategy(errorMessage);  // <-- selalu errorMessage yang SAMA
  // ...
  const retryResult = await this.toolRegistryService.executeTool(toolName, adjustedArgs);
  // retryResult.error?.message TIDAK PERNAH dipakai untuk update errorMessage
  // ...
}
```

### Kenapa ini masalah
`MAX_RETRIES = 3` dimaksudkan untuk memberi 3 kesempatan recovery yang berbeda-beda sesuai error yang muncul di setiap percobaan. Tapi karena `errorMessage` tidak diperbarui setelah tiap retry gagal, `findRecoveryStrategy(errorMessage)` akan selalu mengembalikan strategi yang **sama persis** di ketiga iterasi (karena inputnya sama) — retry ke-2 dan ke-3 pada dasarnya mengulang strategi retry ke-1 yang sudah terbukti gagal, alih-alih mendiagnosis error baru yang mungkin muncul dari hasil retry sebelumnya (yang bisa jadi errornya sudah berbeda). Ini membuang 2 dari 3 percobaan recovery tanpa manfaat tambahan, dan menambah latensi tanpa menambah peluang sukses.

### Rekomendasi perbaikan
```ts
let currentErrorMessage = errorMessage;
for (let retry = 0; retry < this.MAX_RETRIES; retry++) {
  const strategy = this.findRecoveryStrategy(currentErrorMessage);
  if (strategy) {
    const adjustedArgs = strategy.adjust(args, currentErrorMessage);
    const retryResult = await this.toolRegistryService.executeTool(toolName, adjustedArgs);
    // ...
    if (retryResult.status === 'success') { /* return seperti biasa */ }
    // PENTING: update errorMessage dari hasil retry supaya iterasi berikutnya
    // mendiagnosis error TERBARU, bukan error dari percobaan pertama
    currentErrorMessage = retryResult.error?.message || retryResult.preview || currentErrorMessage;
  }
  // fallback tools loop tetap seperti semula
}
```
Tambahkan juga guard supaya kalau strategi yang dipilih di iterasi ke-N sama dengan strategi di iterasi ke-(N-1) DAN errorMessage juga tidak berubah, langsung skip ke fallback tools tanpa buang 1 retry lagi (mencegah pola "coba strategi sama 3x" yang jadi akar masalah ini).

### Kriteria selesai
- [ ] `errorMessage` diperbarui dari hasil tiap retry, bukan cuma dari percobaan pertama
- [ ] Retry tidak mengulang strategi identik berturut-turut tanpa alasan
- [ ] Test: tool yang gagal dengan error berbeda di tiap percobaan retry memicu strategi recovery yang sesuai di tiap iterasi, bukan strategi yang sama terus

---

## 13. Validasi Path Bisa Dilewati untuk Filename Tanpa Separator

### Lokasi
`apps/api/src/modules/ai/self-healing.service.ts:284-312` (fungsi `findPaths` di dalam `validateToolPaths`)

### Bukti kode
```ts
// self-healing.service.ts:303
if (path.isAbsolute(value) || value.includes('/') || value.includes('\\')) {
  paths.push(value);
}
// kalau value TIDAK absolute DAN TIDAK mengandung '/' atau '\',
// value itu tidak pernah masuk ke pathsToValidate sama sekali —
// jadi validateWorkspacePath() tidak pernah dipanggil untuknya
```

### Kenapa ini masalah
Ini defense-in-depth layer (bukan satu-satunya proteksi — `requirePathInWorkspace()` di `workspace-tools.service.ts` yang disebut di audit sebelumnya adalah lapisan independen lain). Tapi sebagai lapisan tersendiri, logikanya berasumsi path traversal selalu mengandung separator. Argumen berupa nama file polos tanpa separator (misal filename `".."` — dua titik saja, tanpa slash) akan lolos dari pengecekan ini sepenuhnya karena tidak match kondisi di atas. Untuk tool yang menerima parameter seperti `path`/`directory` yang secara valid bisa diisi `".."` untuk merujuk direktori induk, ini berarti validasi di layer `SelfHealingService` tidak menangkapnya — bergantung penuh pada layer `requirePathInWorkspace()` lain untuk menahannya.

### Rekomendasi perbaikan
1. Perluas kondisi untuk juga menangkap nilai yang secara literal adalah `.` atau `..` atau diawali `../`/`..\`, meski tidak ada separator lain:
   ```ts
   if (
     path.isAbsolute(value) ||
     value.includes('/') ||
     value.includes('\\') ||
     value === '.' ||
     value === '..'
   ) {
     paths.push(value);
   }
   ```
2. Dokumentasikan secara eksplisit di komentar kode bahwa fungsi ini adalah **satu dari beberapa lapisan** validasi path (bukan satu-satunya), supaya developer berikutnya tidak salah asumsi bahwa lolos dari fungsi ini berarti aman — arahkan ke `requirePathInWorkspace()` sebagai lapisan independen yang harus tetap ada.
3. Tambahkan test dengan input `".."` sebagai nilai `path`/`directory` untuk memverifikasi tertangkap oleh minimal satu dari kedua layer validasi yang ada.

### Kriteria selesai
- [ ] Nilai `.`/`..` tertangkap oleh `findPaths()` meski tanpa separator lain
- [ ] Komentar kode menjelaskan relasi fungsi ini dengan `requirePathInWorkspace()` sebagai defense-in-depth
- [ ] Test path-traversal minimal mencakup kasus filename tanpa separator

---

## 14. Compaction Trigger Berbasis Jumlah Pesan, Bukan Token

### Lokasi
`apps/api/src/modules/ai/compaction.service.ts:33-39`

### Bukti kode
```ts
// compaction.service.ts:33-39
async compactHistory(
  messages: ChatMessage[],
  maxTurns = 20,
): Promise<CompactionResult> {
  if (messages.length <= maxTurns) {          // <-- MURNI hitung jumlah pesan
    return { compactedMessages: messages, wasCompacted: false };
  }
  // ...
}
```

Dipanggil dari `workspace-runner.service.ts:1202`:
```ts
if (messages.length > 20) {
  const compactResult = await this.compactionService.compactHistory(messages);
  // ...
}
```

### Kenapa ini masalah
Trigger compaction 100% berbasis **jumlah** pesan (`>20`), sama sekali tidak melihat ukuran/token dari isi pesan tersebut. Dua skenario yang sama-sama bermasalah:
1. **False trigger:** 25 pesan pendek (misal konfirmasi singkat bolak-balik) sudah men-trigger compaction dan LLM call tambahan untuk ringkasan (`compactWithLLM`), padahal total token-nya mungkin masih jauh dari limit context window — ini pemborosan latensi dan biaya LLM call tanpa manfaat.
2. **Missed trigger (lebih berbahaya):** 15 pesan saja, tapi beberapa di antaranya adalah hasil tool call besar (JSON hasil `read_workspace_file` untuk spreadsheet besar, atau hasil `doc_search` dengan banyak snippet) — total token bisa sudah mendekati atau melewati context window, tapi karena jumlah pesan masih di bawah 20, compaction **tidak pernah trigger** sampai jumlah pesan juga ikut menumpuk, berisiko request ditolak provider karena context overflow duluan.

Ini bug yang sama akarnya dengan temuan #2 (tokenizer akurat tidak dipakai untuk keputusan) — kalau #2 diperbaiki, seharusnya trigger di sini juga ikut diperbaiki memakai basis token, bukan cuma memperbaiki fungsi `estimateTokens()`-nya saja tanpa mengubah titik pemanggilannya.

### Rekomendasi perbaikan
1. Ganti kondisi trigger dari `messages.length > 20` menjadi berbasis token, memakai `countMessageTokens()` (setelah diperbaiki di temuan #2 supaya akurat):
   ```ts
   // di workspace-runner.service.ts, ganti pengecekan:
   const estimatedTokens = this.aiService.countMessageTokens(messages);
   const COMPACTION_TOKEN_THRESHOLD = 60000; // sesuaikan dengan context window model yang dipakai, sisakan ruang untuk response
   if (estimatedTokens > COMPACTION_TOKEN_THRESHOLD) {
     const compactResult = await this.compactionService.compactHistory(messages);
     // ...
   }
   ```
2. Di dalam `CompactionService.compactHistory()` sendiri, pertimbangkan juga mengganti `maxTurns` (jumlah pesan) jadi opsional secondary-check saja — token tetap jadi kriteria utama, jumlah pesan sebagai fallback kalau token counter gagal (mirip pola fallback yang sudah ada di `countTokens()`).
3. Sesuaikan juga proporsi `recentMessages`/`olderMessages` (saat ini fixed 10 pesan terakhir, baris 47-48) — idealnya proporsi ini juga berbasis token budget, bukan angka pesan fixed, supaya 10 pesan terakhir yang sangat besar tidak tetap membebani context meski sudah "dianggap ter-compact".

### Kriteria selesai
- [ ] Trigger compaction berbasis estimasi token, bukan jumlah pesan
- [ ] Threshold token disesuaikan dengan context window model aktif (bisa beda-beda per provider)
- [ ] Test: history dengan sedikit pesan tapi ukuran besar tetap men-trigger compaction; history dengan banyak pesan kecil tidak men-trigger compaction yang tidak perlu

---

## 15. Panggilan LLM Ringkasan Compaction Tidak Dibatasi Ukurannya

### Lokasi
`apps/api/src/modules/ai/compaction.service.ts:57-92` (`compactWithLLM`)

### Bukti kode
```ts
// compaction.service.ts:63-66
const olderTexts = olderMessages
  .map((m) => `[${m.role}] ${m.content || ''}`)
  .filter(Boolean)
  .join('\n');
// olderMessages bisa berisi RATUSAN pesan tanpa batas atas —
// seluruhnya digabung jadi satu string mentah tanpa truncation

// baris 68-76 — dikirim utuh ke LLM call kedua
const summary = (
  await this.aiService!.chat(
    [
      { role: 'system', content: LLM_SUMMARY_INSTRUCTIONS },
      { role: 'user', content: `Kompaksi riwayat berikut menjadi ringkasan ringkas:\n\n${olderTexts}` },
    ],
    [],
  )
).content;
```

### Kenapa ini masalah
Fungsi ini dipanggil justru pada saat history sudah besar (itu alasan compaction di-trigger). Tapi `olderMessages` (yaitu semua pesan SELAIN 10 terakhir) dikirim mentah-mentah ke LLM call kedua tanpa batas ukuran — kalau history yang mau di-compact sudah sangat panjang (skenario yang justru paling butuh compaction), LLM call untuk membuat ringkasannya sendiri berisiko melebihi context window model yang dipakai untuk summarization tersebut. Kalau ini terjadi, `catch` block di baris 88-91 akan menangkapnya dan fallback ke `compactWithSummary()` (versi template, bukan LLM) — jadi tidak sampai crash total, tapi fallback ini terjadi diam-diam tanpa peringatan eksplisit ke user bahwa ringkasan yang dihasilkan lebih rendah kualitasnya (cuma ambil 3 user prompt terakhir + nama file yang disebut, jauh lebih kasar dari ringkasan LLM).

### Rekomendasi perbaikan
1. Batasi `olderTexts` dengan token cap sebelum dikirim ke LLM call kedua:
   ```ts
   const MAX_SUMMARY_INPUT_TOKENS = 30000; // sesuaikan dengan context window model summarization
   let olderTexts = olderMessages
     .map((m) => `[${m.role}] ${m.content || ''}`)
     .filter(Boolean)
     .join('\n');
   if (this.aiService && this.aiService.countTokens(olderTexts) > MAX_SUMMARY_INPUT_TOKENS) {
     // ambil sebagian dari akhir (paling relevan/baru) alih-alih seluruhnya,
     // atau lakukan chunked summarization (ringkas per-chunk lalu gabung)
     olderTexts = this.truncateToTokenBudget(olderTexts, MAX_SUMMARY_INPUT_TOKENS);
   }
   ```
2. Kalau fallback ke `compactWithSummary()` (versi template) terjadi karena LLM call gagal, log dengan level yang lebih terlihat (bukan cuma `logger.warn`) dan idealnya kirim event ke UI supaya user tahu kualitas ringkasan yang dipakai lebih kasar dari biasanya untuk turn tersebut — konsisten dengan pola transparansi yang sudah dipakai di tempat lain (`onEvent({ type: 'self_heal', ... })` untuk self-healing).
3. Pertimbangkan chunked/hierarchical summarization untuk history yang sangat panjang (ringkas per-batch 50 pesan, lalu gabungkan ringkasan-ringkasan itu) alih-alih satu LLM call besar — lebih robust terhadap history yang terus bertambah panjang seiring waktu.

### Kriteria selesai
- [ ] `olderTexts` dibatasi token cap sebelum dikirim ke LLM call summarization
- [ ] Fallback ke template summary (kualitas lebih rendah) ter-log secara jelas dan idealnya terlihat oleh user
- [ ] Test dengan history sangat panjang (100+ pesan) tidak menyebabkan LLM call summarization gagal karena context overflow

---

## 16. `clearSession()` di Tool-Loop-Detector Tidak Pernah Dipanggil

### Lokasi
`apps/api/src/modules/ai/tool-loop-detector.service.ts:75-77`

### Bukti kode
```ts
// tool-loop-detector.service.ts:75-77
clearSession(workspaceId: string): void {
  this.sessionHistory.delete(workspaceId);
}
// grep "clearSession" di seluruh apps/api/src: HANYA muncul di file ini sendiri
// (deklarasi), tidak pernah dipanggil dari workspace-runner.service.ts,
// agent-runner.service.ts, atau file lain mana pun
```

### Kenapa ini masalah
`sessionHistory` (baris 22) itu `BoundedMap` yang di-key oleh `workspaceId` — bukan `runId`/turn/sesi individual. Karena `clearSession()` tidak pernah dipanggil di titik mana pun (misal saat run baru dimulai, atau saat run selesai), history 15-tool-call-terakhir yang dilacak `checkAndRecord()` **terus menumpuk lintas run yang berbeda** untuk workspace yang sama. Dampak konkretnya:
- Kalau 2-3 tool call identik terjadi menjelang akhir run A (hal yang wajar, bukan loop beneran — misal user memang minta baca file yang sama 3x di run berbeda untuk keperluan berbeda), lalu run B (run baru, task sama sekali berbeda) kebetulan memanggil tool identik di awal, itu bisa langsung ke-hitung sebagai lanjutan dari repeat-count run A dan salah trigger circuit breaker padahal run B belum benar-benar looping.
- Sebaliknya, kalau within-run loop terjadi tapi tool call sebelumnya (dari run lampau) kebetulan "memenuhi kuota" window 15-entry duluan dengan tool call berbeda, window bisa lebih cepat penuh dengan history yang sudah tidak relevan, mengurangi efektivitas deteksi untuk loop yang benar-benar terjadi dalam run aktif.

### Rekomendasi perbaikan
1. Panggil `clearSession(workspaceId)` di titik mulai setiap run baru di `workspace-runner.service.ts` (sebelum loop utama dimulai, dekat baris tempat `runState` diinisialisasi) — supaya setiap run mulai dengan state deteksi-loop yang bersih.
2. Alternatif yang lebih robust jangka panjang: ubah key `sessionHistory` dari `workspaceId` saja menjadi kombinasi `${workspaceId}:${runId}` — supaya deteksi loop secara eksplisit ter-scope ke run yang sedang berjalan tanpa perlu eksplisit clear di awal/akhir (otomatis "fresh" per run karena `runId` selalu unik), sekaligus menghindari lupa panggil `clearSession()` di titik lain di masa depan (misal kalau ada jalur error yang skip pemanggilan clear).
3. Tambahkan test yang mensimulasikan 2 run berurutan dengan tool call identik yang overlap di boundary keduanya, memverifikasi run kedua tidak salah ke-trigger circuit breaker akibat history dari run pertama.

### Kriteria selesai
- [ ] `sessionHistory` di-scope per run (bukan cuma per workspace), atau `clearSession()` dipanggil konsisten di setiap awal run baru
- [ ] Test 2-run-berurutan memverifikasi tidak ada false-positive circuit breaker akibat state lintas-run

---

## Urutan Pengerjaan yang Disarankan (Temuan #11-16)

1. **Cepat & berdampak tinggi dulu:** #11 (fix key `fallbackMap`), #12 (retry loop adaptif), #16 (`clearSession()` dipanggil) — semuanya bug penamaan/pemanggilan sederhana, effort rendah, dampak langsung terasa.
2. **Satu paket dengan perbaikan tokenizer (#2 di Part 1):** #14 (compaction berbasis token) → #15 (cap ukuran input LLM summary) — akar masalahnya sama dengan temuan #2 di Part 1 (context management tidak berbasis token akurat), lebih efisien dikerjakan dalam satu PR bareng perbaikan #2.
3. **Input hardening, satu paket dengan #7/#8 di Part 1:** #13 (path validation gap) — tema sama dengan schema validation & rollback di Part 1.

## Catatan Metodologi & Batasan

- **Sudah dibaca tuntas baris-per-baris di batch ini:** `self-healing.service.ts` (323 baris), `compaction.service.ts` (133 baris), `tool-loop-detector.service.ts` (78 baris).
- **Belum dibaca tuntas** (masih via grep/potongan): `ai.service.ts` (800 baris), `context-manager.ts` (744 baris), `tool-registry.service.ts` (588 baris) — sisa Batch 1.
- **Belum disentuh sama sekali (rencana Batch 2):** `provider.service.ts` (264 baris), sisa `sub-agent-runner.service.ts` (379 baris), `tools-provider.module.ts` (2340 baris), `session-admission.service.ts` (136 baris), `message.service.ts` (59 baris), `harness/harness-registry.service.ts` (111 baris), seluruh `apps/web`, seluruh `apps/desktop`.
- Dokumen ini snapshot progres audit yang masih berjalan, bukan hasil final — jumlah temuan kemungkinan masih bertambah.