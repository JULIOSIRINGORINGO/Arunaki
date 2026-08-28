# Engine Feature Triage — opencode fork → Arunaki

**Status:** Draft untuk putusan 1/1
**Tanggal:** 2026-08-28
**Sumber:** VISION.md, WORKFLOW.md Phase 60, source engine (`packages/engine/opencode/`)

## Label Status

| Label | Arti | Aksi |
|---|---|---|
| ✅ KEEP | Dipakai misi Arunaki | Dipertahankan |
| 🗑️ REMOVE | Tidak dipakai / bertentangan VISION | Dihapus saat konsolidasi (MASTER-HARNESS-PLAN) |
| ⏸️ DEFER | Mekanisme distribusi compiled-CLI (.exe) | Ditunda sampai backlog .exe |
| ❓ DECIDE | Perlu putusan tim 1/1 | Tentukan: KEEP / REMOVE |

> Konvensi: baris `❓` harus diubah ke salah satu label lain sebelum item dihapus.
> Setiap REMOVE hanya dieksekusi sebagai bagian langkah konsolidasi, bukan langsung.

---

## 1. Built-in Tools (`src/tool/`)

| Tool | Lokasi | Status | Keterangan |
|---|---|---|---|
| `shell` | `shell/` | ✅ KEEP | **Putusan 2026-08-28:** dipertahankan untuk fallback baca file binary saat mapping COM (Excel/Word/PPT) tidak sesuai. Akses tetap lewat gate `Permission` (approval/deny), jadi bukan "bebas". Deviate dari VISION "bukan shell executor" — disengaja & terkontrol. |
| `read` | `read.ts` | ✅ KEEP | Baca file teks/binary (base64) dalam sandbox |
| `write` | `write.ts` | ✅ KEEP | Tulis file dalam sandbox |
| `edit` / `apply_patch` | `edit.ts`, `apply_patch.ts` | ✅ KEEP | Mekanisme patch ketat (Phase 32) — inti editing dokumen |
| `glob` | `glob.ts` | ✅ KEEP | Pencarian file |
| `grep` | `grep.ts` | ✅ KEEP | Pencarian isi teks |
| `webfetch` | `webfetch.ts` | ✅ KEEP | Baca Google Docs/Spreadsheet online (VISION) |
| `websearch` | `websearch.ts` | ✅ KEEP | Riset saat bekerja dokumen |
| `question` | `question.ts` | ✅ KEEP | Approval gate "Human in Control" |
| `task` | `task.ts` | ✅ KEEP | Sub-agent paralel (Phase 35) |
| `todo` | `todo.ts` | ✅ KEEP | Penjejakan langkah tugas |
| `skill` | `skill.ts` | ✅ KEEP | Skenario kerja berulang |
| `truncate` / `truncation-dir` | `truncate.ts` | ✅ KEEP | Manajemen konteks |
| `external-directory` | `external-directory.ts` | ✅ KEEP | Batas keamanan: hanya operasi dalam sandbox |
| `invalid`, `json-schema`, `schema` | `invalid.ts`, dll. | ✅ KEEP | Infrastruktur tool |
| `lsp` | `lsp.ts` | ✅ REMOVE 2026-08-28 | Fitur IDE (go-to-def, symbol) — non-coding. **SELESAI:** `src/tool/lsp.ts` + endpoint `/lsp`, `/find/symbol`, flags `disableLspDownload`/`experimentalLspTy`/`experimentalLspTool`, perm `lsp` dihapus; test ikut terhapus |
| `code-mode` | `code-mode.ts` | ❓ DECIDE | Eksekusi script terportal + MCP; serupa scripting — kemungkinan REMOVE (rekomendasi) |
| `plan` / `plan_exit` | `plan.ts` | ❓ DECIDE | Mode rencana ala coding assistant; Arunaki punya "Think Before Act" — apakah reuse atau REMOVE? (rekomendasi KEEP) |
| `mcp-websearch` | `mcp-websearch.ts` | ❓ DECIDE | Websearch via MCP server eksternal — butuh MCP aktif |

## 2. Service / Directory inti (`src/`)

| Modul | Lokasi | Status | Keterangan |
|---|---|---|---|
| `session`, `processor`, `message*` | `session/` | ✅ KEEP | Inti loop agent + prompt + persist |
| `provider` | `provider/` | ✅ KEEP | LLM provider (Mistral dll via config) |
| `config` | `config/` | ✅ KEEP | `.Arunaki/` + `~/.config/arunaki/` |
| `storage` | `storage/` | ✅ KEEP | SQLite/Drizzle (Phase 60.1) |
| `permission` | `permission/` | ✅ KEEP | Gate sandbox + persetujuan |
| `question` | `question/` | ✅ KEEP | Aksi berisiko → konfirmasi |
| `patch` | `patch/` | ✅ KEEP | Diff/patch util (apply_patch) |
| `git` | `git/` | ✅ KEEP | **Infra**: snapshot pakai git CLI utk diff file. Non-coding OK; folder bukan repo ditangani gracefully |
| `snapshot` | `snapshot/` | ✅ KEEP | Catat diff file sebelum/sesudah kerja (transparansi VISION) |
| `agent` | `agent/` | ✅ KEEP | Definisi agent |
| `plugin` | `plugin/` | ✅ KEEP | Registrasi tool kustom (arunaki-tools, gitlab/poe) |
| `tool` | `tool/` | ✅ KEEP | Registri + eksekusi tool |
| `server` | `server/` | ✅ KEEP | HTTP :4096 |
| `project` | `project/` | ✅ KEEP | Deteksi folder proyek sandbox |
| `effect/*`, `env`, `id`, `util`, `bus` | — | ✅ KEEP | Infrastruktur (Effect runtime, ids, env) |
| `mcp` | `mcp/`, `mcp/catalog` | ❓ DECIDE | Server MCP eksternal (utk tool Office?) — kandidat KEEP jika dipakai, REMOVE jika hanya lewat built-in tool |
| `command` | `command/` | ❓ DECIDE | Slash command chat (/model /mcp dll) — reuse atau REMOVE? |
| `skill` | `skill/` | ✅ KEEP | Skills/ARUNAKI system prompt (Phase 49) |
| `background` | `background/` | ❓ DECIDE | Background jobs (auto-annotate dll) — GERAKAN penyedot sumber daya; cek pemakaian |
| `image`, `format`, `sync` | — | ❓ DECIDE |
| `lsp` | `lsp/` | ✅ REMOVE 2026-08-28 | Bagian dari fitur IDE — hapus bersama tool lsp. **SELESAI:** seluruh `src/lsp/` (client, diagnostic, language, launch, lsp, server) dihapus; `toolFiletype` di-inline ke `run/tool.ts` |
| `ide` | `ide/` | ✅ REMOVE 2026-08-28 | Integrasi VSCode — bukan IDE. **SELESAI:** `src/ide/` + `test/ide/` dihapus, ikut CLI `acp`/`attach`/`github`/`pr` |
| `worktree` | `worktree/` | ✅ REMOVE 2026-08-28 | Git worktree (coding). **SELESAI:** `src/worktree/` + `control-plane/adapters/worktree.ts` + test dihapus; 4 endpoint `worktree.*` dilepas. `.Node` tetap di wiring sampai core — `ctx.worktree` (path) dipertahankan |
| `acp` | `acp/` | ✅ REMOVE 2026-08-28 | Agent Client Protocol — client eksternal. **SELESAI:** `src/acp/`, `src/cli/cmd/acp.ts`, `test/acp/`, `test/cli/acp/` dihapus |
| `control-plane` | `control-plane/` | 🗑️ REMOVE | Remote sandbox — tidak dipakai jalur web (Phase 60) |
| `share` | `share/` | ✅ REMOVE 2026-08-28 | Berbagi sesi ke cloud. **SELESAI:** `src/share/` (share-next, session) + `test/share/` dihapus; endpoint `session.share`/`session.unshare` + handler + flag `Arunaki_AUTO_SHARE` dilepas; `Session.share` schema/field hanya interface+storage (core `share_url` dipertahankan); `config.share` dipertahankan sebagai field config inert; CLI `--share` + URL share di `import` dilepas |
| `sync` | `sync/` | 🗑️ REMOVE | Sinkronisasi cloud — lokal zone |
| `installation`, `account` | — | ❓ DECIDE | Auth/instalasi — lihat status defer (.exe) |
| `audio.d.ts`, `markdown.d.ts`, `sql.d.ts` | — | ✅ KEEP | Deklarasi types/loader |

## 3. CLI Commands (`src/cli/cmd/`)

> Platform Arunaki = Web UI + Electron, bukan terminal. Hampir semua command CLI tidak dipakai runtime; dicirikan di sini biar tidak repot saat .exe dikerjakan.

| Command | Status | Keterangan |
|---|---|---|
| `serve` | ✅ KEEP | Boot engine headless :4096 (`serve-only.ts`) |
| `web` | ✅ KEEP | "Serve + buka web" (instance:false) |
| `generate` | ✅ KEEP | Regen `openapi.json` + SDK types |
| `run` | ⏸️ DEFER | Run non-interaktif — sesuai .exe |
| `tui` | ❓ DECIDE | TUI terminal — platform bukan terminal; mungkin REMOVE |
| `attach` | ✅ REMOVE 2026-08-28 | Attach sesi eksternal. **SELESAI:** `src/cli/cmd/attach.ts` dihapus |
| `acp` | ✅ REMOVE 2026-08-28 | Client ACP eksternal. **SELESAI:** `src/cli/cmd/acp.ts` + `test/cli/acp/` dihapus |
| `github` / `pr` | ✅ REMOVE 2026-08-28 | Auth GitHub + PR — non-coding. **SELESAI:** `github.ts`, `github.handler.ts`, `github.shared.ts`, `pr.ts` + test dihapus |
| `mcp`, `plug`, `cmd`, `db`, `export`, `import`, `models`, `providers`, `session`, `stats`, `account` | ❓ DECIDE | Utilitas CLI — bangun hanya yang dipakai UI/.exe |
| `upgrade`, `uninstall`, `debug` | ⏸️ DEFER | Distribusi compiled-CLI (.exe deferred) |

## 4. Distribusi / Build

| Item | Status | Keterangan |
|---|---|---|
| `Dockerfile`, `bin/opencode`, `postinstall.mjs`, `core/package.json` `bin` | ⏸️ DEFER | Mekanisme distribusi compiled-CLI → jalur .exe (WORKFLOW:2005) |
| `script/build.ts` `createEmbeddedWebUIBundle` | ⏸️ DEFER | Saat harness: dialihkan dari `packages/engine/app` (tidak ada) ke `apps/web` |
| `models-dev.ts` (`https://models.opencode.ai`) | ⏸️ DEFER | Feed model live; overridable `Arunaki_MODELS_URL` |

---

## Daftar Putusan 1/1 (belum diputus)

| # | Item | Rekomendasi Awal |
|---|---|---|
| 1 | `code-mode` tool | REMOVE (scripting, di luar dokumen) |
| 2 | `plan`/`plan_exit` tool | KEEP → samakan dengan alur Think-Before-Act |
| 3 | `mcp` intern | KEEP (cadangan utk tool Office eksternal) |
| 4 | `command` slash | KEEP (UX chat `/model`) |
| 5 | `background` service | Riset pemakaian; REMOVE jika idle |
| 6 | CLI utils (`mcp/plug/db/export/import/models/providers/session/stats`) | Buang yang tidak dipakai UI/.exe |
| 7 | `tui` command | REMOVE (di luar platform) |
| 8 | `image`, `format`, `share`, `sync` services | REMOVE (kecuali `format` dipakai output dokumen — cek) |
| 9 | `installation`, `account` | DEFER (.exe) |

## Aksi Setelah Putusan

1. Setiap item → ditandai `✅ KEEP` / `🗑️ REMOVE` / `⏸️ DEFER`.
2. `🗑️ REMOVE` dijadwalkan ke langkah konsolidasi MASTER-HARNESS-PLAN (bukan dihapus spontan).
3. Update dokumen ini + WORKFLOW + dev-log per item yang dieksekusi.

## Catatan Khusus: Shell untuk Binary

- `shell` dipertahankan → gate `Permission` tetap berlaku (exec → approval/deny). Tanpa approval otomatis, bukan "bebas".
- Rekomendasi helper: `od`/`xxd`/`python3` untuk inspeksi binary dari folder sandbox; bukan shell bebas ke seluruh sistem.
- Jika di kemudian hari `read`/`parseExcel` COM sudah memadai, status shell bisa turun ke `❓` lagi — keputusan dapat dibuka kembali.