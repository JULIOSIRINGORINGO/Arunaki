# Tool Naming & Update-File Research — OpenCode vs OpenClaw vs Arunaki

**Date:** 2026-08-09
**Status:** Keputusan desain — menunggu implementasi

---

## 1. Konteks Masalah

Saat menguji `gpt-oss-120b` (model kecil) untuk memperbarui file rekap dokumen:

- Model **gagal memakai `edit_workspace_file`** (4× `EMPTY_EDITS` / `OLD_TEXT_NOT_FOUND`) karena tool kita menuntut `oldText` yang **exact-match** (hanya toleran CRLF). Model lemah tidak bisa menghasilkan `oldText` yang persis.
- Model **merusak struktur file** lewat jalur `write_workspace_file` (full-file overwrite tanpa verifikasi) — menambah section `SISA PEMBAYARAN`, merusak format total (`TOTAL UANG DI LACI: 16(-25RB) RB`), dan salah hitung.

Kesimpulan awal: dua masalah terpisah —
1. **Matching**: `edit` kita terlalu kaku → perlu fuzzy replacer.
2. **Struktur**: `write` kita tidak diverifikasi → perlu verifikasi pasca-write (sudah diimplementasikan).

Selama riset, muncul pertanyaan tambahan: **apakah penamaan tool kita sudah tepat?** Kita membandingkan dengan dua harness yang sudah matang: OpenCode (coding agent) dan OpenClaw (desktop/computer-use agent).

---

## 2. Bagaimana OpenCode Melakukan Ini

Referensi: `opencode-ref/packages/opencode/src/tool/`

### 2.1 Penamaan Tool

Pendek, satu kata, kata kerja (verb) — **tanpa prefix domain**:

| Tool | Fungsi |
|---|---|
| `read` | Baca file |
| `write` | Tulis/overwrite file |
| `edit` | Edit via exact string replacement |
| `grep` | Cari teks |
| `glob` | Cari file |
| `task`, `todo`, `question`, `plan`, `skill` | Tool non-file |

Definisi: `Tool.define("edit", { description, parameters, execute })` — satu file per tool, `id` pendek.

### 2.2 Tool `edit` — KUNCI: BUKAN exact match

OpenCode `edit.ts` punya **rantai 9 replacer** yang dicoba berurutan (fallback):

1. `SimpleReplacer` — exact match
2. `LineTrimmedReplacer` — cocokkan baris per baris setelah `.trim()`
3. `BlockAnchorReplacer` — anchor baris pertama & terakhir + **Levenshtein similarity ≥ 0.65** di baris tengah (toleransi typo kecil)
4. `WhitespaceNormalizedReplacer` — collapse `\s+` jadi satu spasi
5. `IndentationFlexibleReplacer` — abaikan indentasi
6. `EscapeNormalizedReplacer` — toleransi escaped `\n`, `\t`, dll.
7. `TrimmedBoundaryReplacer` — trim di ujung blok
8. `ContextAwareReplacer` — anchor konteks ≥3 baris
9. `MultiOccurrenceReplacer` — semua kemunculan (untuk `replaceAll`)

Plus **guard `isDisproportionateMatch`** (`edit.ts:731`): menolak replacement jika span yang cocok **jauh lebih besar** dari `oldString` — persis pola gagal kita ("model replace seluruh file").

### 2.3 Verifikasi Setelah Write

OpenCode **tidak punya verifikasi struktur**. Yang ada:

- **Approval gate** (`ctx.ask`) — menampilkan diff ke user sebelum write.
- **Feedback loop LSP** — setelah write/edit, diagnostics LSP dibaca dan dikembalikan ke model: *"LSP errors detected in this file, please fix"* (`write.ts:85`, `edit.ts:201`). Model diperbaiki dalam loop, bukan reject pre-commit.

### 2.4 Konteks Kesimpulan

OpenCode adalah **coding agent**: mengandalkan model kuat (Claude-class) + LSP sebagai "verifier" universal untuk kode. Pola `write`/`edit` 1-kata cocok karena tool-nya sedikit dan domainnya satu (file source code).

---

## 3. Bagaimana OpenClaw Melakukan Ini

Referensi: `openclaw-ref/src/agents/tools/`

### 3.1 Penamaan Tool

Dua pola, keduanya **pendek**:

**A. Satu tool per domain + `action` enum:**

| Tool | Action |
|---|---|
| `terminal` | `open \| read \| input \| resize \| close \| list` |
| `screen` | enum action |
| `pdf`, `transcripts`, `tts` | tool tunggal |

**B. `domain_verb` snake_case:**

`sessions_list`, `sessions_send`, `sessions_history`, `sessions_search`, `sessions_spawn`, `web_fetch`, `web_search`, `agents_list`, `image_generate`, `update_plan`

Definisi: `{ label, name, description, parameters (TypeBox), outputSchema, execute }` — satu file per tool.

### 3.2 Cara Update File

OpenClaw **bukan LLM-edit dokumen**:

- `src/claws/workspace-update.ts` — **provisioning file** dari source package (add/remove/overwrite dengan **content-digest sha256 + rollback**). Bukan editing dokumen user.
- `src/system-agent/post-write-verification.ts` — pola **write → validate → satu kali repair loop → escalate**: tulis dulu, validasi schema, kalau invalid minta LLM proposalkan satu perbaikan, kalau gagal suruh user fix manual.

### 3.3 Konteks Kesimpulan

OpenClaw adalah **computer-use/desktop agent**: tool `terminal` (satu device dengan lifecycle state open→input→close) wajar digabung-action. Tool `sessions_*` tetap dipisah per verb. Deskripsi seluruhnya **bahasa Inggris**.

---

## 4. Perbandingan Langsung

| Aspek | OpenCode | OpenClaw | Arunaki sekarang |
|---|---|---|---|
| Tipe agent | Coding (LSP, diffs) | Desktop/mobile (screen, terminal, device) | Desktop dokumen (workspace folder) |
| Nama tool file | `read`/`write`/`edit` — 1 kata | `terminal` — 1 tool + action | `read_workspace_file` dll — panjang |
| Verifikasi | LSP feedback loop | post-write validate + 1 repair | `recalculateAndVerify` + `missingSectionLabels` (sudah ada) |
| Approve | Diff ke user | Policy/config | Approval gate (sudah ada) |
| Bahasa deskripsi | Inggris | Inggris | Indonesia |
| Tool `sessions_*`/`web_*` | — | `domain_verb` terpisah | `browser_*`, `desktop_*` terpisah |

---

## 5. Kesimpulan — Keputusan Desain

### 5.1 Pola yang diadopsi

**Pola OpenCode murni** untuk tool file workspace (bukan pola OpenClaw):

| Operasi | Sekarang | Rename |
|---|---|---|
| Baca file | `read_workspace_file` | `read` |
| Tulis/create file | `write_workspace_file` | `write` |
| Update file | `edit_workspace_file` | `edit` |
| Hapus | `delete_workspace_file` | `delete` |
| Rename | `rename_workspace_file` | `rename` |
| List | `list_workspace_files` | `list` |

**Alasan (kenapa bukan pola OpenClaw `terminal`):**

1. **Kita memang butuh `read`/`write`/`edit` terpisah** — peran beda: `read` = read-only (cacheable, tanpa approval), `write` = create/overwrite, `edit` = surgical update.
2. **`terminal` OpenClaw adalah kasus khusus** — satu device dengan lifecycle state. File workspace bukan device, tidak ada lifecycle open→input→close, jadi gabung-action tidak masuk akal.
3. **Pola OpenClaw = schema raksasa campuran** — `workspace_file`+action harus memuat semua properti (`content`, `rows`, `title`, `format`, `instructions`, `newFilename`, `action`). Model kecil sering salah isi param yang tidak relevan dengan action, atau lupa `action` itu sendiri.
4. **Schema kecil & khusus per tool** (pola OpenCode) lebih mudah dipahami model lemah — `edit` hanya punya `{filePath, oldString, newString}`.
5. **Error isolation** — gagal di satu tool tidak menggagalkan seluruh domain.
6. **Bukti empiris di test kita**: `gpt-oss-120b` *berhasil* memilih `write_workspace_file` (nama panjang). Masalah `edit_workspace_file` bukan karena nama, tapi `OLD_TEXT_NOT_FOUND` (matching). Jadi tool terpisah sudah terbukti bisa.

**Yang TIDAK direname** (YAGNI): `browser_*`/`desktop_*` — mereka sudah 1-domain-1-action dengan verb yang jelas beda (navigate, click, type, screenshot). OpenClaw juga memisahkan `web_fetch`/`web_search`, jadi pemisahan per-verb itu sah.

### 5.2 Yang diambil dari OpenCode

- **Rename nama tool** → pendek 1 kata (`read`, `write`, `edit`).
- **Fuzzy replacer** di `edit` (LineTrimmed + BlockAnchor 0.65, minimal) → fix `EMPTY_EDITS`.
- **Guard `isDisproportionateMatch`** → cegah "model replace seluruh file".

### 5.3 Yang diambil dari OpenClaw

- Verifikasi pasca-write (`recalculateAndVerify` + `missingSectionLabels`) — **sudah diimplementasikan** dan lebih kuat dari OpenCode (yang hanya LSP feedback loop).
- Pola repair-loop (write → validate → 1 repair) bisa jadi penyempurnaan di masa depan jika reject pre-commit terlalu kaku.

### 5.4 Bahasa

- **Nama tool**: bahasa Inggris (`read`, `write`, `edit`).
- **Deskripsi tool**: bahasa Inggris murni — konsisten dengan opencode/openclaw.
- **User chat**: bahasa Indonesia bebas. Model yang menjembatani instruksi user → tool call, jadi deskripsi tidak perlu meniru bahasa user.

---

## 6. Rencana Implementasi

1. **Rename** di `tools-provider.module.ts`:
   - `read_workspace_file` → `read`
   - `write_workspace_file` → `write`
   - `edit_workspace_file` → `edit`
   - `delete_workspace_file` → `delete`
   - `rename_workspace_file` → `rename`
   - `list_workspace_files` → `list`
2. **Deskripsi tool** diganti ke bahasa Inggris murni.
3. **Fuzzy replacer** di `workspace-tools.service.ts` `editWorkspaceFile` — tambah LineTrimmed + BlockAnchor (threshold 0.65) + guard `isDisproportionateMatch`.
4. **Update semua referensi**:
   - `selectToolsForGoal` di `workspace-runner.service.ts`
   - Prompt @mention di runner
   - Spec test (`tool-registry.service.spec.ts`)
   - Harness test (`test-rekap-dummy.ts`, `test-rekap-extended.ts`)
5. **Verifikasi**: compile `tsc --noEmit -p tsconfig.build.json` + test dummy 16/16 + struktur file tidak berubah.

---

## 7. Referensi Sumber

- `opencode-ref/packages/opencode/src/tool/{edit,write,read,tool}.ts` + `.txt`
- `openclaw-ref/src/agents/tools/{sessions-list,terminal,pdf-tool,screen-tool,web-tools,structured-output-tool,transcripts-tool}.ts`
- `openclaw-ref/src/claws/workspace-update.ts`
- `openclaw-ref/src/system-agent/post-write-verification.ts`
- `E:\ARUNAKI\apps\api\src\modules\tools\services\workspace-tools.service.ts`
- `E:\ARUNAKI\apps\api\src\modules\tools\tools-provider.module.ts`
