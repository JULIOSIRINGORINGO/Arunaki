# Gap Analysis: Arunaki Harness vs OpenClaw/Claude Code Patterns — PART 5 (TERBARU, Batch 2 Selesai)

**Status:** Temuan #22-23, hasil penyelesaian Batch 2: sisa `sub-agent-runner.service.ts` (259 baris tersisa, sekarang full), scan menyeluruh `tools-provider.module.ts` (2340 baris — tool inventory lengkap + pengecekan silang ke `mutatingTools`), plus pengecekan `apps/desktop` (746 baris, WebSocket bridge auth) dan `apps/web` (7925 baris — fokus ke jalur auth API, bukan full-read).
**Sumber audit:** `Arunaki-main__8_.zip`
**Tanggal audit:** Agustus 2026

> Part 1-4 (#1-21 + koreksi #7) ada di file terpisah. **Batch 2 sekarang selesai** — lihat Catatan Metodologi di akhir file ini untuk cakupan final seluruh audit.

---

## 🔴 22. `edit_workspace_file` dan `desktop_excel_edit` Salah Kategori — Lolos dari SEMUA Safety Guard Khusus Mutating Tools

**Ini temuan paling parah di seluruh audit (Part 1-5).** Bukan cuma inefisiensi atau kapabilitas tak terpakai — ini celah keamanan konten aktif pada tool yang kemungkinan besar paling sering dipakai untuk edit file sungguhan.

### Lokasi
- `apps/api/src/modules/workspace/workspace-runner.service.ts:981-991` (definisi array `mutatingTools`)
- `apps/api/src/modules/tools/tools-provider.module.ts:807` (nama tool asli: `edit_workspace_file`)
- `apps/api/src/modules/tools/tools-provider.module.ts:1659` (nama tool asli: `desktop_excel_edit`)

### Bukti kode
```ts
// workspace-runner.service.ts:981-991 — daftar tool yang dianggap "mutating"
const mutatingTools = [
  'write_workspace_file',
  'update_workspace_file',        // <-- TOOL INI TIDAK PERNAH ADA
  'delete_workspace_file',
  'desktop_send_keys',
  'desktop_excel_write_cell',     // <-- TOOL INI TIDAK PERNAH ADA
  'desktop_excel_set_format',     // <-- TOOL INI TIDAK PERNAH ADA
  'desktop_word_type',
  'desktop_word_format',
];
```
```ts
// tools-provider.module.ts:807 — nama tool yang SEBENARNYA terdaftar untuk edit file
name: 'edit_workspace_file',   // TIDAK ADA di mutatingTools sama sekali

// tools-provider.module.ts:1659 — nama tool yang SEBENARNYA untuk edit Excel desktop
name: 'desktop_excel_edit',    // TIDAK ADA di mutatingTools sama sekali
```

Karena `edit_workspace_file` dan `desktop_excel_edit` tidak match string apa pun di `mutatingTools`, baris `mutatingTools.includes(funcName)` (baris 1021) mengembalikan `false` untuk keduanya — jadi **keduanya masuk ke `readOnlyCalls`, bukan `mutatingCalls`**, meski keduanya jelas-jelas memodifikasi isi file/dokumen.

### Kenapa ini sangat serius
Blok kode `mutatingCalls` (baris 1098-1140+) punya guard keamanan yang **TIDAK ADA** di jalur `readOnlyCalls`:
```ts
// workspace-runner.service.ts:1098-1132 — HANYA berlaku untuk mutatingCalls
// - Cek: file yang dirujuk user dengan @ HARUS jadi target update
//   (mencegah AI salah update file yang tidak dimaksud user)
if (mentionedFiles.size > 0 && funcName === 'write_workspace_file' && !isMentioned) {
  throw new Error('File yang dirujuk dengan @ harus menjadi target pembaruan.');
}
// - Cek: file yang dirujuk dengan @ TIDAK BOLEH dihapus/rename dalam run edit
if (isMentioned && ['delete_workspace_file', 'rename_workspace_file'].includes(funcName)) {
  throw new Error('File yang dirujuk dengan @ tidak boleh dihapus atau diubah namanya dalam run edit.');
}
// - Cek: delete HARUS ada instruksi eksplisit dari user
if (funcName === 'delete_workspace_file' && !hasExplicitDeleteIntent(safeGoal, filename)) {
  throw new Error('Penghapusan ditolak: instruksi harus secara eksplisit meminta hapus/delete...');
}
// - Cek: konten yang mau disimpan tidak boleh masih mengandung referensi @file mentah
//   (mencegah AI menyimpan placeholder "@laporan.xlsx" alih-alih isi file yang benar)
if (typeof args.content === 'string' && /@[^\s@]+\.[A-Za-z0-9]{1,10}/.test(args.content)) {
  throw new Error('Konten masih berisi referensi @file mentah dan tidak boleh disimpan.');
}
```

Karena `edit_workspace_file` **tidak lewat blok ini sama sekali**, kalau LLM salah paham konteks percakapan dan memanggil `edit_workspace_file` pada file yang justru sedang dirujuk user dengan `@` untuk keperluan lain (bukan untuk diedit) — guard "file yang dirujuk dengan @ tidak boleh diubah" **tidak akan pernah trigger** untuk tool ini, karena guard itu cuma dicek untuk item di `mutatingCalls`. Sama halnya, kalau `edit_workspace_file` menyisipkan konten yang masih mengandung raw `@filename.xlsx` (bug LLM lain yang seharusnya ditangkap check terakhir), itu juga tidak akan tertangkap.

Dampak untuk `desktop_excel_edit`: komentar di baris 985 eksplisit bilang *"Desktop interactive tools — high-risk, require approval gate"* — niatnya jelas tool desktop-interactive harus dapat perlakuan ekstra hati-hati. Tapi `desktop_excel_edit` (mengedit cell Excel yang sedang dibuka secara live via COM/Electron bridge) justru lolos dari kategori itu sama sekali karena namanya salah ketik di daftar.

Ini POLA YANG SAMA PERSIS dengan temuan Part 2 #11 (`fallbackMap` salah nama tool) — tapi konsekuensinya jauh lebih besar di sini karena yang salah kategori adalah **guard keamanan konten aktif di jalur mutasi file utama**, bukan sekadar fitur fallback-recovery.

### Rekomendasi perbaikan
1. **Prioritas tertinggi, perbaikan cepat:**
   ```ts
   const mutatingTools = [
     'write_workspace_file',
     'edit_workspace_file',          // FIX: nama benar (sebelumnya 'update_workspace_file')
     'delete_workspace_file',
     'rename_workspace_file',        // TAMBAHAN: juga tidak ada di list asli, padahal dirujuk di guard baris 1124!
     'desktop_send_keys',
     'desktop_excel_edit',           // FIX: nama benar (sebelumnya 'desktop_excel_write_cell')
     'desktop_word_type',
     'desktop_word_format',
     // 'desktop_excel_set_format' dihapus — tool ini tidak pernah ada di registry;
     // kalau memang direncanakan sebagai fitur terpisah, tambahkan setelah tool-nya dibuat
   ];
   ```
   **Catatan tambahan yang ditemukan saat memperbaiki ini:** `rename_workspace_file` DIRUJUK di guard baris 1124 (`['delete_workspace_file', 'rename_workspace_file'].includes(funcName)`) tapi **juga tidak ada** di `mutatingTools` asli — artinya guard itu sendiri tidak akan pernah jalan untuk `rename_workspace_file` karena tool itu juga masuk `readOnlyCalls` duluan. Bug yang sama menimpa tool ketiga yang sebelumnya tidak saya cek.
2. Tambahkan test yang memverifikasi SETIAP nama tool di `mutatingTools` benar-benar match nama tool yang terdaftar di `tools-provider.module.ts` (test statis, tidak perlu eksekusi — cukup bandingkan dua daftar string). Ini mencegah drift semacam ini terulang lagi kalau ada rename tool di masa depan tanpa update daftar ini.
3. Pertimbangkan derive `mutatingTools` secara otomatis dari metadata tool (misal field `mutating: boolean` di `ToolCapability`/`Tool` interface, diisi saat registrasi tool), alih-alih daftar string hardcoded terpisah yang harus disinkronkan manual — supaya kelas bug ini (nama tool hardcoded yang drift dari sumber kebenaran) tidak bisa terjadi lagi secara struktural, bukan cuma diperbaiki sekali.

### Kriteria selesai
- [x] `edit_workspace_file`, `desktop_excel_edit`, dan `rename_workspace_file` masuk `mutatingCalls`, bukan `readOnlyCalls`
- [x] Semua nama di `mutatingTools` diverifikasi cocok dengan tool yang benar-benar terdaftar (test statis)
- [x] Test: memanggil `edit_workspace_file` pada file yang di-`@`-mention untuk tujuan lain memicu error yang sama seperti `write_workspace_file`
- [ ] Pertimbangkan migrasi ke flag `mutating` per-tool di source of truth registry, bukan daftar terpisah

---

## 23. `SubAgentRunnerService` Tidak Pernah Mengirim `workspaceId` ke `executeWithHealing()` — Bug Argument-Passing yang Sama Terulang di Lokasi Ketiga

### Lokasi
- `apps/api/src/modules/chat/sub-agent-runner.service.ts:311-314`
- `apps/api/src/modules/chat/sub-agent-runner.service.ts:22-35` (interface `SubAgentTask` — tidak ada field `workspaceId`)

### Konteks historis
Audit sebelumnya (tercatat di `LAPORAN_AUDIT_ARUNAKI.md`, siklus audit lampau) menemukan bug ini di **2 lokasi** (`agent-runner.service.ts` dan `workspace-runner.service.ts`) dan keduanya **sudah dikonfirmasi diperbaiki** — `workspaceId` sekarang benar dikirim sebagai argumen posisi ke-3 terpisah di kedua tempat itu (diverifikasi ulang barusan, lihat bukti di bawah). Tapi `sub-agent-runner.service.ts` — lokasi PEMANGGILAN KETIGA yang sama sekali belum pernah diaudit sebelumnya (karena fitur sub-agent baru ditemukan dan diverifikasi wired di audit gap-analysis saat ini) — punya **bug yang identik, dan tidak pernah diperbaiki karena tidak pernah diketahui**.

### Bukti kode
```ts
// sub-agent-runner.service.ts:22-35 — interface SubAgentTask
export interface SubAgentTask {
  taskId: string;
  taskName: string;
  taskDescription: string;
  allowedTools?: string[];
  maxRounds?: number;
  additionalContext?: string;
  // TIDAK ADA field workspaceId sama sekali di interface ini
}
```
```ts
// sub-agent-runner.service.ts:311-314 — pemanggilan executeWithHealing TANPA workspaceId
const healResult = await this.selfHealingService.executeWithHealing(
  funcName,
  args,
  // <-- argumen ke-3 (workspaceId) TIDAK ADA SAMA SEKALI, bukan cuma salah taruh
);
```

Bandingkan dengan 2 lokasi lain yang sudah benar:
```ts
// workspace-runner.service.ts:1134-1138 — BENAR
const healResult = await this.selfHealingService.executeWithHealing(
  funcName, enrichedArgs, workspaceId,
);
// agent-runner.service.ts:478-481 — BENAR
const healResult = await this.selfHealingService.executeWithHealing(
  toolCall.function.name, safeArgs, params.workspaceId || undefined,
);
```

### Kenapa ini masalah
Argumen ke-3 (`workspaceId`) di `executeWithHealing()` adalah yang secara eksklusif memicu `validateToolPaths()`/`validateWorkspacePath()` — validator path-traversal defense-in-depth yang jadi salah satu perbaikan paling penting di audit siklus sebelumnya. Karena `sub-agent-runner.service.ts` tidak pernah mengirim argumen ini sama sekali (bukan cuma salah nilai — betul-betul tidak ada), **setiap tool call yang dilakukan oleh SETIAP sub-agent yang di-spawn lewat `agent_spawn` melewati validator path ini sepenuhnya**, terlepas dari tool apa yang dipanggil sub-agent tersebut.

Yang membuat ini lebih rumit dari sekadar "argumen kelupaan": `SubAgentTask` interface bahkan tidak punya field `workspaceId` — jadi ini bukan cuma satu baris yang lupa `.workspaceId`, tapi ketiadaan struktural di level desain. Sub-agent yang dibuat lewat tool `agent_spawn` (dikonfirmasi wired di Part 1) **sepenuhnya tidak sadar konteks workspace** di level arsitektur — kalau sub-agent butuh tahu workspace mana yang sedang dikerjakan, itu satu-satunya jalan cuma lewat `additionalContext` (field teks bebas) yang harus "ditebak ulang" oleh LLM di dalam setiap argumen tool call individual (`args.workspaceId`, karena tool workspace mewajibkan itu di schema-nya sendiri) — tidak ada jaminan struktural LLM melakukannya dengan benar dan konsisten di semua tool call.

### Rekomendasi perbaikan
1. **Tambahkan `workspaceId` ke interface `SubAgentTask`:**
   ```ts
   export interface SubAgentTask {
     taskId: string;
     taskName: string;
     taskDescription: string;
     allowedTools?: string[];
     maxRounds?: number;
     additionalContext?: string;
     workspaceId?: string;   // TAMBAHAN
   }
   ```
2. **Teruskan `workspaceId` dari parent run ke setiap task saat `agent_spawn` handler di `tools-provider.module.ts` membangun `SubAgentTask`** — parent run PASTI tahu `workspaceId`-nya sendiri (itu parameter run utama), tinggal disisipkan otomatis ke setiap task, TIDAK BOLEH bergantung pada LLM menuliskannya sendiri di `additionalContext`.
3. **Kirim `workspaceId` sebagai argumen ke-3 terpisah** di `sub-agent-runner.service.ts:311`:
   ```ts
   const healResult = await this.selfHealingService.executeWithHealing(
     funcName,
     args,
     task.workspaceId,   // TAMBAHAN
   );
   ```
4. Tambahkan test regresi khusus untuk kelas bug ini di ketiga lokasi sekaligus: pastikan `executeWithHealing()` menerima argumen ke-3 non-undefined setiap kali dipanggil dari jalur mana pun yang beroperasi dalam konteks workspace (chat, workspace, DAN sub-agent) — supaya kalau ada lokasi call keempat ditambahkan di masa depan (misal harness plugin baru), test ini menangkapnya otomatis alih-alih menunggu audit manual berikutnya.

### Kriteria selesai
- [x] `SubAgentTask` punya field `workspaceId`
- [x] `agent_spawn` handler meneruskan `workspaceId` dari parent run ke setiap sub-task secara otomatis (bukan mengandalkan LLM)
- [x] `sub-agent-runner.service.ts` mengirim `workspaceId` sebagai argumen ke-3 ke `executeWithHealing()`
- [x] Test regresi lintas-ketiga-lokasi memverifikasi `executeWithHealing()` selalu menerima `workspaceId` non-undefined dalam konteks workspace

---

## Pengecekan Tambahan (Tidak Ada Temuan Baru)

- **`apps/desktop/main.cjs` (729 baris) — WebSocket bridge auth:** dikonfirmasi SUDAH BENAR. Backend (`desktop-bridge.service.ts:41-49`) memvalidasi token dari query param terhadap `ARUNAKI_API_KEY`, dan **fail-closed** kalau env var tidak diset (`!expectedKey || token !== expectedKey` → tolak). Ini konsisten dengan perbaikan yang sudah dikonfirmasi di audit siklus sebelumnya.
- **`apps/web` (7925 baris) — jalur autentikasi API dari frontend:** `src/lib/api.ts` (wrapper `apiFetch`) mengirim header `x-api-key` dari `VITE_ARUNAKI_API_KEY` dengan benar. Dikonfirmasi ini satu-satunya titik yang memanggil `fetch()` mentah di seluruh `apps/web/src` — tidak ada komponen lain yang bypass wrapper ini, jadi tidak ada jalur API call dari frontend yang kebocoran tanpa auth header. **Catatan:** ini bukan full-read seluruh 7925 baris, cuma pengecekan terfokus ke jalur auth — komponen UI individual (state management, form handling, dll) belum diperiksa detail.

## Urutan Pengerjaan (Temuan Part 5)

1. **#22 di atas SEGALA temuan lain di seluruh audit (Part 1-5)** — ini satu-satunya temuan yang secara langsung memungkinkan operasi file/konten melewati guard keamanan yang secara eksplisit dirancang untuk mencegah kesalahan tersebut. Perbaikannya sendiri sangat murah (ganti 2-3 string di satu array) — rasio dampak:effort adalah yang tertinggi di seluruh audit ini.
2. **#23 setelah #22** — sama-sama soal keamanan path/konteks workspace, dan menyentuh file yang sama (kalau memperbaiki #22, developer sudah "masuk" ke area kode ini, jadi efisien dikerjakan berurutan).

## Catatan Metodologi & Batasan — RINGKASAN AKHIR SELURUH AUDIT (Part 1-5)

**Batch 2 sekarang selesai.** Berikut cakupan final:

**Sudah dibaca tuntas baris-per-baris:** `agent-runner.service.ts`, `workspace-runner.service.ts`, `self-healing.service.ts`, `compaction.service.ts`, `tool-loop-detector.service.ts`, `tool-registry.service.ts`, `ai.service.ts`, `context-manager.ts` (745 baris, full), `provider.service.ts`, `session-admission.service.ts`, `message.service.ts`, `harness-registry.service.ts`, `sub-agent-runner.service.ts` (379 baris, full). Total ~9 file inti backend, semua full-read.

**Dibaca luas tapi tidak baris-per-baris:** `tools-provider.module.ts` (2340 baris — inventaris 57 tool lengkap diverifikasi by name, beberapa handler dibaca detail termasuk `agent_spawn`, `edit_workspace_file`, `read_workspace_file`, `doc_cross_reference`; belum setiap handler dari 57 tool diperiksa detail satu-per-satu).

**Dicek terfokus (bukan full-read):** `apps/desktop/main.cjs` (jalur WS bridge auth), `apps/web/src` (jalur auth API `apiFetch`) — kedua area berisiko-tinggi ini bersih, tapi bukan cakupan lengkap seluruh 8671 baris gabungan kedua app tersebut.

**Total temuan seluruh audit (Part 1-5): 23 temuan + 1 koreksi** (temuan #7 di Part 1 dikoreksi jadi lebih ringan di Part 3; 1 temuan awal — sub-agent orphaned — ditarik penuh di draf pertama sebelum Part 1 final).

Dokumen ini sekarang mencakup seluruh backend inti (`apps/api`) secara memadai. Sisa area yang benar-benar belum tersentuh untuk audit setara: detail komponen UI di `apps/web/src` di luar jalur auth, dan modul-modul backend sekunder yang belum disebut di atas (kemungkinan ada beberapa service kecil lain yang belum ter-cover — cek `apps/api/src/modules/` untuk daftar modul lengkap kalau ingin memverifikasi cakupan 100%).