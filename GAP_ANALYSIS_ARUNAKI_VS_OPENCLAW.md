# Gap Analysis: Arunaki Harness vs OpenClaw/Claude Code Patterns — PART 3 (TERBARU)

**Status:** Temuan #17-18 + 1 koreksi ke Part 1, hasil lanjutan full-read `tool-registry.service.ts` (588 baris) dan `ai.service.ts` (800 baris, bagian inti dibaca tuntas), cross-check ke `context-manager.ts`.
**Sumber audit:** `Arunaki-main__8_.zip`
**Tanggal audit:** Agustus 2026

> Part 1 (#1-10) dan Part 2 (#11-16) ada di file terpisah. File ini isinya temuan baru saja + koreksi.

---

## ⚠️ KOREKSI ke Part 1, Temuan #7 (Skema Validasi Tool Arguments)

**Klaim sebelumnya (Part 1):** "Tidak ada validasi schema untuk tool arguments."

**Setelah baca tuntas `tool-registry.service.ts`, klaim ini TERLALU KUAT — perlu direvisi:**

Ternyata ADA `validateArgs()` (`tool-registry.service.ts:143-185`) yang genuinely dipanggil di `executeTool()` (baris 214) **sebelum** `tool.execute(args)` dijalankan:
```ts
// tool-registry.service.ts:214-233
const validation = this.validateArgs(args, tool.definition.function.parameters);
if (!validation.valid) {
  return { status: 'error', /* ... */, error: { code: 'INVALID_ARGS', message: validation.errors.join('; ') } };
}
```
Validasi yang dilakukan: required-field check, tipe primitif (`string`/`number`/`array` — dicek via `typeof`/`Array.isArray`), dan `enum` constraint. Ini juga dipanggil di `executeToolStreaming()` (baris 367), jadi konsisten di kedua jalur eksekusi.

**Yang MASIH benar dari temuan #7 (bagian yang tetap valid):**
- `zod` di `package.json` memang tidak pernah diimport — kalau memang ada rencana pakai `zod`, itu tetap dependency mati.
- Validasi yang ada **dangkal**: tidak ada cek tipe `boolean`, tidak ada validasi `object` bertingkat (nested schema), tidak ada validasi ISI array (cuma cek itu array, bukan tipe elemennya), tidak ada constraint tambahan (`minLength`, `pattern`, `format`, dll yang biasa ada di JSON Schema penuh).

**Rekomendasi yang perlu diupdate:** bukan "bangun validasi dari nol", tapi "perkuat `validateArgs()` yang sudah ada" — tambahkan cek `boolean`, validasi rekursif untuk `object`/nested array items, dan pertimbangkan baru pakai `ajv` kalau butuh constraint lebih kompleks (`pattern`, `format`, `minimum`/`maximum`). Effort-nya jadi lebih kecil dari yang saya sebut sebelumnya karena fondasinya sudah ada.

---

## 17. Naive 40-Message Hard Truncation Berjalan SEBELUM Compaction — Silent Data Loss

### Lokasi
- `apps/api/src/modules/ai/ai.service.ts:340-343` (`chat()`)
- `apps/api/src/modules/ai/ai.service.ts:459-462` (`chatStream()`)

### Bukti kode
```ts
// ai.service.ts:340-343 — di dalam chat(), SEBELUM preemptivelyCompact() dipanggil
// Light trim: keep last 40 messages, skip 4-phase compression
const trimmedMessages = messages.length > 40
  ? messages.slice(-40)
  : messages;
// ...
const preparedMessages = await this.preemptivelyCompact(trimmedMessages, provider.model);
```
```ts
// ai.service.ts:459-462 — pola IDENTIK di chatStream()
const trimmedMessages = messages.length > 40
  ? messages.slice(-40)
  : messages;
```

### Kenapa ini masalah
Ini adalah **temuan paling berdampak** dari batch audit ini. Setiap kali `chat()` atau `chatStream()` dipanggil dengan history >40 pesan, kode ini **langsung membuang** semua pesan di luar 40 terakhir dengan `Array.slice()` biasa — **tidak ada ringkasan, tidak ada pemberitahuan, tidak ada log yang terlihat user**. Komentarnya sendiri jujur bilang "skip 4-phase compression" — ini secara eksplisit BUKAN compaction, ini penghapusan mentah.

Yang membuat ini serius:
1. **Terjadi SEBELUM `preemptivelyCompact()`** (pipeline yang lebih pintar — aggregate tool-result budget, truncate-only vs full-compact routing) sempat berjalan. Jadi pipeline canggih yang sudah diaudit sebelumnya (disebut di Part 1 temuan #2, #14) itu **cuma beroperasi pada sisa 40 pesan yang selamat** dari slice mentah ini — bukan pada history lengkap. Kalau ada informasi penting di pesan ke-41 dari belakang (misal keputusan user, konten file yang dibaca), itu hilang duluan sebelum sistem compaction yang "smart" sempat mempertimbangkannya.
2. **Berlaku untuk KEDUA mode** (chat dan workspace) karena `chat()`/`chatStream()` adalah titik masuk bersama — termasuk workspace mode yang punya `MAX_ROUNDS=25` dan `CompactionService` sendiri (Part 2, temuan #14) yang triggernya di >20 pesan. Kalau `CompactionService` di workspace-runner gagal/skip triggernya karena bug apa pun (termasuk bug di temuan #14 — trigger berbasis jumlah pesan bisa salah kalkulasi), slice 40-pesan mentah ini jadi **satu-satunya pengaman**, dan pengaman itu sendiri destruktif tanpa ringkasan.
3. Threshold `40` adalah angka pesan (bukan token) — sama sekali tidak memperhitungkan ukuran konten tiap pesan, sama seperti bug di temuan #14, tapi versi ini lebih parah karena **tidak ada fallback summary sama sekali**, cuma dibuang.

### Rekomendasi perbaikan
1. **Prioritas tertinggi:** hapus/ubah slice mentah ini. Kalau memang butuh "light trim" cepat sebelum pipeline berat jalan, minimal panggil `ContextManager` (atau `CompactionService`) untuk meringkas pesan yang mau dibuang, bukan `.slice()` polos:
   ```ts
   let trimmedMessages = messages;
   if (messages.length > 40) {
     // jangan buang mentah — minimal berikan kesempatan compress()/compactHistory()
     // menangani ini sebelum fallback ke slice
     trimmedMessages = await this.contextManager.compress(messages, contextWindow);
     // fallback slice HANYA kalau compress() sendiri gagal/timeout
   }
   ```
2. Kalau slice mentah tetap dipertahankan untuk alasan performa/latency, minimal:
   - Log dengan level yang terlihat (bukan silent) setiap kali ini trigger, sertakan berapa pesan yang dibuang.
   - Kirim event ke UI (`onEvent({ type: 'context_truncated', ... })`) supaya user tahu sebagian riwayat percakapan "hilang" dari working memory LLM, bukan cuma diringkas.
3. Naikkan threshold `40` jadi berbasis token (reuse perbaikan dari Part 1 #2 setelah tokenizer akurat dipasang), konsisten dengan rekomendasi di temuan #14 Part 2 — supaya satu sumber kebenaran untuk "kapan riwayat perlu ditangani", bukan tiga titik terpisah (slice 40-pesan di sini, trigger >20 pesan di `CompactionService`, threshold token di `ContextManager.compress()`) yang masing-masing punya logika sendiri.

### Kriteria selesai
- [x] Tidak ada lagi pemotongan history yang membuang pesan tanpa ringkasan atau notifikasi
- [x] Kalau ada mekanisme "light trim" cepat, itu memanggil jalur compaction yang ada (bukan slice mentah) atau minimal ter-log & ter-notifikasi jelas
- [x] Test: history 60+ pesan dengan informasi penting di pesan ke-45-dari-belakang tetap "diingat" LLM setelah lewat `chat()` (baik lewat ringkasan atau tetap utuh)

---

## 18. Dua Sistem Context-Compaction Independen yang Tidak Konsisten (`ContextManager` vs `CompactionService`)

### Lokasi
- `apps/api/src/modules/ai/ai.service.ts:104-115` — instansiasi `ContextManager` dengan `useLlmSummary: false`
- `apps/api/src/modules/ai/context-manager.ts:364-382` (`generateSummary`) — cek `if (this.config.useLlmSummary && this.aiService)`
- `apps/api/src/modules/ai/context-manager.ts:388-...` (`generateLlmSummary`) — fungsi LLM-summary yang lengkap tapi **tidak pernah bisa ter-reach** lewat instance ini
- Dibandingkan dengan: `apps/api/src/modules/ai/compaction.service.ts` (`CompactionService`, dibahas di Part 2 temuan #14/#15) — sistem TERPISAH yang genuinely memanggil LLM untuk ringkasan

### Bukti kode
```ts
// ai.service.ts:104-115 — konfigurasi ContextManager yang dipakai
// SEMUA panggilan chat()/chatStream() (lewat preemptivelyCompact -> compress())
this.contextManager = new ContextManager(
  {
    contextLength: 128000,
    threshold: 0.25,
    targetRatio: 0.2,
    toolPruneChars: 1000,
    toolPreviewChars: 250,
    injectionMaxChars: 2000,
    useLlmSummary: false,   // <-- HARDCODED false
  },
  { chat: this.chat.bind(this) },
);
```
```ts
// context-manager.ts:364-382
private async generateSummary(messages: ChatMessage[]): Promise<string | null> {
  if (messages.length === 0) return null;
  if (this.config.useLlmSummary && this.aiService) {   // <-- SELALU false untuk instance di atas
    try {
      return await this.generateLlmSummary(messages);   // <-- kode ini eksis tapi TIDAK PERNAH jalan
    } catch (err: any) { /* fallback */ }
  }
  return this.generateTemplateSummary(messages);   // <-- SELALU jalur ini yang dipakai
}
```

### Kenapa ini masalah
Ada **dua kelas berbeda** yang sama-sama bertugas "meringkas history supaya muat context window", tapi:

| | `ContextManager.compress()` | `CompactionService.compactHistory()` |
|---|---|---|
| Dipanggil dari | `ai.service.ts` → `preemptivelyCompact()` → **setiap** `chat()`/`chatStream()` call | `workspace-runner.service.ts` saja, sebelum manggil `chat()` |
| Trigger | Token-based (`estimateTokens() > threshold`, tapi pakai heuristik char/4 — Part 1 #2) | Jumlah pesan (`>20` — Part 2 #14) |
| Pakai LLM untuk ringkasan? | **Tidak pernah** (`useLlmSummary: false` hardcoded) — meski fiturnya ada dan lengkap di `generateLlmSummary()` | **Ya**, via `compactWithLLM()` |
| Fallback kalau LLM gagal/nonaktif | N/A (memang tidak pernah dipanggil) | Template summary (`compactWithSummary()`) |

Karena `ContextManager` adalah jalur yang **selalu aktif** (dipanggil di setiap `chat()`/`chatStream()`, termasuk untuk chat mode yang sama sekali tidak punya `CompactionService` sendiri — lihat Part 1 temuan #4, chat mode tidak pakai context-engine baru), sementara `CompactionService` cuma dipanggil dari satu tempat (workspace-runner, sebelum call ke `chat()`), hasil akhirnya:

- **Chat mode** (percakapan biasa, bukan workspace): satu-satunya jaring pengaman kompresi history adalah `ContextManager.compress()`, yang **selalu** menghasilkan ringkasan kualitas rendah (template-based, bukan LLM) begitu history lewat threshold — padahal kapabilitas ringkasan LLM yang lebih baik sudah tertulis lengkap di `generateLlmSummary()`, cuma dikonfigurasi mati.
- **Workspace mode**: dapat DUA lapis kompresi berurutan — `CompactionService` (LLM-based, trigger jumlah pesan) duluan di `workspace-runner.service.ts`, LALU `ContextManager.compress()` lagi di dalam `chat()` (trigger token, tapi tanpa LLM) kalau ternyata masih di atas threshold. Redundan dan berpotensi meringkas ringkasan yang sudah diringkas — bukan bug fatal, tapi tumpang tindih logika yang seharusnya bisa disatukan.

Ini pola yang sama seperti temuan-temuan sebelumnya (kapabilitas dibangun lengkap, tapi konfigurasi/wiring membuatnya tidak terpakai) — kali ini bukan "tidak dipanggil sama sekali", tapi "dipanggil dengan konfigurasi yang mematikan fitur terbaiknya".

### Rekomendasi perbaikan
1. **Jangka pendek (cepat):** ubah `useLlmSummary: false` jadi `true` di `ai.service.ts:111`, dan pastikan `{ chat: this.chat.bind(this) }` yang sudah diteruskan sebagai `aiService` param ke `ContextManager` (baris 114) benar-benar cukup untuk `generateLlmSummary()` bekerja (cek signature yang dipakai `generateLlmSummary` cocok dengan `{ chat }` minimal interface itu). Uji dulu di environment staging karena ini mengubah setiap panggilan `chat()` untuk memicu LLM call tambahan saat compress — pastikan tidak menyebabkan latency/biaya tak terduga untuk chat mode yang sebelumnya tidak pernah kena ini.
2. **Jangka menengah:** satukan `ContextManager` dan `CompactionService` jadi satu sistem, atau minimal buat salah satunya jadi "the one used everywhere" dan yang lain dihapus/deprecated — supaya tidak ada dua tempat terpisah yang harus disinkronkan setiap kali ada perubahan (persis seperti masalah drift di Part 1 temuan #1, parallel execution). Kandidat paling masuk akal: pertahankan `ContextManager` (lebih dekat ke `chat()`, sudah token-aware) dan migrasikan logic ringkasan `CompactionService` ke dalamnya, lalu hapus pemanggilan `CompactionService` terpisah di `workspace-runner.service.ts`.
3. Kalau tetap mempertahankan dua sistem terpisah untuk alasan tertentu (misal workspace mode memang butuh strategi berbeda dari chat mode), minimal dokumentasikan eksplisit di kedua file kenapa keduanya ada dan kapan masing-masing dipakai — supaya developer berikutnya tidak bingung atau salah asumsi salah satu adalah dead code.

### Kriteria selesai
- [x] Jelas satu sumber kebenaran untuk "bagaimana history diringkas", atau ada dokumentasi eksplisit kenapa ada dua sistem
- [x] Chat mode (bukan cuma workspace mode) mendapat ringkasan berkualitas LLM saat history panjang, bukan cuma template
- [x] Tidak ada double-compression yang tidak perlu di workspace mode
- [x] Test: `useLlmSummary: true` tidak menyebabkan regresi latency/biaya yang signifikan untuk chat mode biasa

---

## Urutan Pengerjaan (Temuan Part 3)

1. **Paling mendesak:** #17 (silent data loss dari slice 40-pesan) — ini satu-satunya temuan di seluruh audit (Part 1-3) yang bisa menyebabkan hilangnya konteks percakapan tanpa jejak sama sekali. Prioritaskan di atas semua temuan lain kalau harus pilih satu.
2. Koreksi #7 — update dokumentasi/task tracker Part 1 supaya agent coding tidak membangun ulang validasi dari nol; cukup perkuat yang sudah ada.
3. #18 (dua sistem compaction) — kerjakan SETELAH #17 selesai dan SATU PAKET dengan Part 1 #2 (tokenizer) + Part 2 #14/#15 (compaction berbasis token) — semuanya akar masalahnya di area context-management yang sama, lebih efisien sebagai satu inisiatif besar daripada dicicil.

## Catatan Metodologi & Batasan

- **Sudah dibaca tuntas di batch ini:** `tool-registry.service.ts` (588 baris, penuh), `ai.service.ts` (800 baris, penuh), plus bagian `compress()`/`generateSummary()`/`generateLlmSummary()` di `context-manager.ts` (belum seluruh 744 baris — bagian `pruneOldToolResults`, `stripOldImages`, `sanitizeToolPairs`, `enforceAggregateToolResultBudget` belum dibaca detail).
- **Masih belum disentuh:** `provider.service.ts` (264 baris), sisa `sub-agent-runner.service.ts`, `tools-provider.module.ts` (2340 baris, mayoritas), `session-admission.service.ts`, `message.service.ts`, `harness-registry.service.ts`, seluruh `apps/web`, seluruh `apps/desktop` — ini rencana Batch 2 (belum dimulai).
- Dokumen ini snapshot progres audit yang masih berjalan.