# Gap Analysis: Arunaki Harness vs OpenClaw/Claude Code Patterns — PART 4 (TERBARU)

**Status:** Temuan #19-21, hasil Batch 2 (baru dimulai): `provider.service.ts` (264 baris, full), `session-admission.service.ts` (136 baris, full), `message.service.ts` (59 baris, full), `harness-registry.service.ts` (111 baris, full), plus penyelesaian sisa `context-manager.ts` (745 baris, sekarang full).
**Sumber audit:** `Arunaki-main__8_.zip`
**Tanggal audit:** Agustus 2026

> Part 1 (#1-10), Part 2 (#11-16), Part 3 (#17-18 + koreksi #7) ada di file terpisah.

---

## Ringkasan Prioritas (Part 4 saja)

| # | Temuan | Kategori | Dampak | Effort Perbaikan |
|---|--------|----------|--------|-------------------|
| 19 | `getNextAvailable()` step 2 melewati pengecekan cooldown provider | Reliability | Sedang | Rendah |
| 20 | `SessionAdmissionService` (kunci konkurensi per-sesi) cuma di chat mode, tidak di workspace mode | Safety/Reliability | Tinggi | Sedang |
| 21 | Sistem plugin `HarnessRegistryService` cuma di chat mode dan belum ada plugin terdaftar sama sekali | Arsitektur | Rendah | Rendah |

---

## 19. `getNextAvailable()` Step 2 Melewati Pengecekan Cooldown Provider

### Lokasi
- `apps/api/src/modules/provider/provider.service.ts:163-223` (`getNextAvailable`)
- `apps/api/src/modules/provider/provider.repository.ts:26` (`findAllEnabled` — TIDAK filter cooldown) vs `:51-56` (`findAvailable` — filter cooldown via `cooldownUntil`)

### Bukti kode
```ts
// provider.repository.ts:51-56 — findAvailable() FILTER cooldown
async findAvailable(): Promise<Provider[]> {
  // ...
  where: { OR: [{ cooldownUntil: null }, { cooldownUntil: { lt: now } }] }
}
```
```ts
// provider.service.ts:163-181 — Step 1: BENAR, pakai findAvailable() (filter cooldown)
async getNextAvailable(currentProviderId?: string): Promise<ProviderConfig | null> {
  const available: Provider[] = await this.repository.findAvailable().catch(() => []);
  const next = available.find((p) => p.id !== currentProviderId);
  if (next) { /* return next, sudah difilter cooldown */ }

  // Step 2: SALAH — pakai findAllEnabled() (TIDAK filter cooldown)
  const allProviders = await this.repository.findAllEnabled().catch(() => []);
  const openrouterProv = allProviders.find((p) => p.baseUrl.includes('openrouter.ai'));
  if (openrouterProv) {
    // rotasi model DALAM preset yang sama, pakai openrouterProv.apiKey
    // yang BISA SAJA masih dalam masa cooldown aktif
    const preset = this.catalogService.detectPreset(openrouterProv.apiKey, openrouterProv.baseUrl);
    const nextModel = this.catalogService.getNextModelInPreset(preset, currentProviderId);
    return { /* ..., apiKey: this.decryptApiKey(openrouterProv.apiKey), model: nextModel };
  }
  // ...
}
```

### Kenapa ini masalah
Step 1 (`findAvailable()`) benar — cuma mengambil provider yang TIDAK sedang cooldown. Tapi kalau step 1 tidak menemukan kandidat (misal semua provider database lain juga sedang cooldown), step 2 mengambil provider OpenRouter lewat `findAllEnabled()` — yang **tidak peduli status cooldown-nya sama sekali** — lalu mencoba "rotasi model" di dalam preset yang sama menggunakan API key yang sama persis dari provider yang mungkin baru saja kena rate-limit (429) atau bahkan masih dalam cooldown 300 detik akibat 401/402/403. Karena API key-nya sama (cuma model yang beda), kemungkinan besar permintaan berikutnya akan **kena limit yang sama lagi** — logika "rotasi" ini secara efektif tidak benar-benar menghindari sumber masalahnya. Ini bisa menyebabkan siklus retry yang sia-sia: sistem "merasa" sudah rotasi provider (menambah `rotation` counter di `AiAttempt`), padahal secara efektif masih memukul limit yang sama.

### Rekomendasi perbaikan
```ts
// provider.service.ts:184 — tambahkan filter cooldown eksplisit
const allProviders = await this.repository.findAllEnabled().catch(() => []);
const now = new Date();
const openrouterProv = allProviders.find(
  (p) => p.baseUrl.includes('openrouter.ai') &&
         (!p.cooldownUntil || p.cooldownUntil < now),   // <-- tambahan
);
```
Atau, lebih konsisten: ubah `findAllEnabled()` di titik pemanggilan ini jadi `findAvailable()` lalu filter `baseUrl.includes('openrouter.ai')` dari hasilnya — supaya logikanya seragam dengan step 1, dan tidak perlu duplikasi definisi "provider yang tersedia" di dua tempat.

### Kriteria selesai
- [ ] Step 2 di `getNextAvailable()` tidak lagi memilih provider yang sedang cooldown aktif
- [ ] Test: provider OpenRouter dalam cooldown tidak terpilih sebagai fallback candidate meski `findAllEnabled()` masih mencantumkannya

---

## 20. `SessionAdmissionService` (Kunci Konkurensi Per-Sesi) Cuma di Chat Mode, Tidak di Workspace Mode

### Lokasi
- `apps/api/src/modules/chat/session-admission.service.ts` (136 baris) — implementasi lengkap
- Dipakai di: `apps/api/src/modules/chat/agent-runner.service.ts`
- **Tidak** dipakai di: `apps/api/src/modules/workspace/workspace-runner.service.ts` (dikonfirmasi — nol hasil grep)

### Bukti
`SessionAdmissionService` adalah implementasi mutex/antrian per `sessionKey` yang solid: kalau ada run yang sedang aktif untuk sebuah sesi, run berikutnya untuk sesi yang sama di-antre (bukan dijalankan konkuren), lengkap dengan timeout, dukungan `AbortSignal`, dan cleanup saat service shutdown. Ini genuinely dipanggil di `agent-runner.service.ts` untuk memastikan satu sesi chat tidak diproses dua kali secara bersamaan.

Tapi `workspace-runner.service.ts` — mode yang benar-benar menulis ke disk (Excel/Word/file lain) — **tidak memanggilnya sama sekali**.

### Kenapa ini masalah
Ini salah satu temuan berdampak tinggi karena berhubungan langsung dengan integritas data. Kalau frontend (bug, double-click, race condition network retry, atau serangan replay) mengirim 2 request workspace run untuk `workspaceId` yang sama secara nyaris bersamaan, **tidak ada apa pun** yang mencegah keduanya berjalan konkuren:
- Kedua run bisa membaca file yang sama, masing-masing membuat keputusan independen berdasarkan state file yang sama, lalu **menulis hasil yang saling menimpa** — salah satu perubahan user hilang tanpa jejak error.
- Ini memperparah gap di Part 1 temuan #8 (tidak ada rollback/checkpoint) — kombinasi "tidak ada penguncian konkurensi" + "tidak ada rollback" berarti race condition semacam ini tidak cuma mungkin terjadi, tapi juga tidak bisa dipulihkan otomatis kalau terjadi.
- `ToolLoopDetectorService` (Part 2 #16) dan sistem lain yang di-keyed per `workspaceId` juga berasumsi implisit hanya ada satu run aktif per workspace pada satu waktu — asumsi itu tidak dijamin benar tanpa `SessionAdmissionService` di jalur ini.

### Rekomendasi perbaikan
1. Terapkan `SessionAdmissionService.acquireAdmission(workspaceId, signal)` di titik masuk `workspace-runner.service.ts` (fungsi run utama), persis seperti pola yang sudah dipakai di `agent-runner.service.ts` — gunakan `workspaceId` sebagai `sessionKey` (bukan `sessionId`/`chatId` seperti di chat mode, supaya penguncian benar-benar di level workspace/file, bukan di level percakapan).
2. Bungkus seluruh badan eksekusi run dengan `lease.run(async () => { ... })` supaya lease otomatis dilepas bahkan kalau run gagal/throw.
3. Tambahkan test yang mengirim 2 workspace run untuk `workspaceId` yang sama secara paralel, memverifikasi run kedua benar-benar menunggu run pertama selesai (bukan berjalan konkuren).
4. Pertimbangkan expose `getAdmissionStatus(workspaceId)` ke endpoint status API supaya UI bisa menampilkan "sedang ada proses lain berjalan di workspace ini" ke user, bukan cuma diam-diam mengantre.

### Kriteria selesai
- [ ] `workspace-runner.service.ts` memakai `SessionAdmissionService` di titik masuk run, sama seperti `agent-runner.service.ts`
- [ ] Test 2-run-paralel-workspace-sama memverifikasi eksekusi berurutan, bukan konkuren
- [ ] Lease selalu dilepas meski run gagal (test dengan simulasi error di tengah run)

---

## 21. Sistem Plugin `HarnessRegistryService` Cuma di Chat Mode, dan Belum Ada Plugin Terdaftar Sama Sekali

### Lokasi
- `apps/api/src/modules/chat/harness/harness-registry.service.ts` (111 baris) — registry + dispatcher lengkap (5 lifecycle hook: `onAgentStart`, `onToolStart`, `onToolResult`, `onAgentComplete`, `onAgentError`, masing-masing dengan isolasi try/catch per-plugin)
- Dipakai di: `apps/api/src/modules/chat/agent-runner.service.ts` saja
- Grep `implements HarnessPlugin` atau `HarnessPlugin =` di seluruh `apps/api/src`: **0 hasil**

### Kenapa ini masalah (dampak rendah, tapi pola yang sama berulang lagi)
Ini pola arsitektur yang bagus — mirip sistem plugin OpenClaw/hook lifecycle Claude Code, dengan isolasi kegagalan per-plugin (satu plugin error tidak menjatuhkan seluruh run). Tapi dua catatan:
1. **Belum ada satu plugin pun yang mengimplementasikan `HarnessPlugin`** — infrastrukturnya lengkap tapi saat ini nol fungsi tambahan yang benar-benar berjalan lewatnya. Ini bukan bug, tapi menandakan kapasitas ekstensibilitas yang belum dimanfaatkan.
2. **Kalaupun ada plugin terdaftar nanti, hook-nya cuma akan terpicu di chat mode** — `workspace-runner.service.ts` tidak memanggil `HarnessRegistryService` sama sekali. Ini pola yang sama seperti temuan #20 di atas dan beberapa temuan di Part 1 (#4, context-engine) — infrastruktur baru cenderung di-wire ke satu mode saja, bukan keduanya.

### Rekomendasi perbaikan
1. Kalau memang tidak ada rencana pemakaian plugin dalam waktu dekat, ini bisa dibiarkan sebagai infrastruktur siap-pakai — tidak mendesak untuk diperbaiki.
2. Kalau ada rencana pemakaian (misal untuk fitur observability/analytics/audit-log eksternal), pastikan saat mengimplementasikan plugin pertama, hook yang sama juga dipanggil dari `workspace-runner.service.ts` — supaya tidak mengulang pola "cuma jalan di chat mode" seperti beberapa temuan lain di audit ini.
3. Pertimbangkan menjadikan ini bagian dari konsolidasi yang sama dengan Part 1 temuan #4 (unifikasi context-engine antara chat dan workspace mode) — kalau kedua mode akhirnya dibuat berbagi satu jalur eksekusi inti, masalah "cuma di-wire ke satu mode" untuk banyak fitur (context-engine, session-admission, harness-plugin) akan otomatis terselesaikan sekaligus, bukan ditambal satu-satu.

### Kriteria selesai
- [x] Didokumentasikan eksplisit kalau sistem ini memang belum dipakai (supaya developer berikutnya tidak bingung mencari "plugin apa saja yang aktif")
- [x] Kalau plugin pertama dibuat, hook-nya juga terpasang di workspace mode, bukan cuma chat mode

---

## Catatan Tambahan (bukan temuan baru, penjelasan lanjutan dari Part 1 #2 & Part 3 #18)

Sisa `context-manager.ts` sudah dibaca tuntas (745 baris, full). Konfirmasi tambahan yang memperkuat gambaran temuan sebelumnya: ada **3 fungsi estimasi token berbeda** dalam codebase ini, bukan cuma 2 seperti disebut sebelumnya —
1. `AiService.countTokens()` — akurat (tiktoken), tidak pernah dipanggil (Part 1 #2)
2. `ContextManager.estimateTokens()` — heuristik char/4 seragam untuk semua jenis pesan, dipakai untuk trigger `compress()` (Part 1 #2)
3. `ContextManager.estimatePromptTokens()` — heuristik LEBIH BAIK dari #2 (rasio karakter/token berbeda untuk pesan `tool` vs pesan biasa, karena tool-result cenderung lebih padat token), dipakai khusus di `preemptivelyCompact()` untuk estimasi tekanan prompt sebelum request dikirim

Tiga fungsi berbeda untuk masalah yang sama, dengan akurasi berbeda-beda, dipakai di titik keputusan berbeda-beda dalam alur yang sama. Ini bukan temuan baru berdiri sendiri — ini detail tambahan yang memperkuat urgensi Part 3 temuan #18 (unifikasi sistem context-management): kalau unifikasi dikerjakan, sebaiknya sekalian unifikasi ke SATU fungsi estimasi token yang konsisten (idealnya `#3` yang paling akurat di antara ketiganya kalau tokenizer asli dari #1 belum mau dipakai penuh, atau langsung ke tiktoken dari #1 kalau performanya cukup).

## Urutan Pengerjaan (Temuan Part 4)

1. **Paling mendesak:** #20 (session admission di workspace mode) — sejajar dengan Part 1 #8 dan Part 3 #17 sebagai temuan dengan risiko integritas data tertinggi di seluruh audit.
2. #19 (cooldown bypass) — cepat diperbaiki, effort rendah, tapi berdampak nyata ke reliability pemilihan provider saat sedang banyak error.
3. #21 (plugin system) — prioritas rendah, tidak mendesak, cukup didokumentasikan dulu.

## Catatan Metodologi & Batasan

- **Sudah dibaca tuntas di batch ini:** `provider.service.ts` (264 baris), `session-admission.service.ts` (136 baris), `message.service.ts` (59 baris), `harness-registry.service.ts` (111 baris), sisa `context-manager.ts` (745 baris, sekarang full lengkap).
- **Masih belum disentuh:** sisa `sub-agent-runner.service.ts` (~250 baris belum dibaca dari 379 total), `tools-provider.module.ts` (2340 baris, mayoritas belum — baru bagian `agent_spawn` yang dibaca detail), seluruh `apps/web`, seluruh `apps/desktop`.
- Dokumen ini snapshot progres audit yang masih berjalan.