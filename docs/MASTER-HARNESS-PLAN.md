# MASTER PROMPT — Single Harness Consolidation Plan

**Status:** Deliverable (Modul 1-3 dari MASTER PROMPT)
**Tanggal:** 2026-08-28
**Sumber otoritas:** MASTER PROMPT (pasted), WORKFLOW.md Phase 61.7-61.8, source code
**Batasan:** Fokus 100% konsolidasi harness; **.exe di-defer** (bukan sekarang).

---

## Tujuan Akhir (definisi dari MASTER PROMPT)

Arunaki adalah satu binary/harness mandiri. Saat dijalankan:

1. UI (Web UI yang dimuat Electron) + Engine (basic OpenCode fork) adalah **satu kesatuan**, bukan dua proses yang saling memanggil.
2. Electron TIDAK boleh menjalankan OpenCode sebagai process/service eksternal di belakang layar.
3. Semua mekanisme IPC/RPC/local HTTP/subprocess bridge antara "Arunaki UI" dan "Engine" dihilangkan.
4. LLM diurus sepenuhnya oleh Engine (provider, agent loop, streaming, session, persist). Arunaki hanya menyediakan tool dokumen + UX.
5. Integrasi OS (folder, Excel/Word/PowerPoint native via COM) adalah satu-satunya IPC yang tersisa — karena itu interaksi dengan aplikasi desktop, bukan bridge ke engine.

---

## Deliverable 1 — Mapping Jalur, Modul & Bridge yang Diputus

### 1.1 Topologi SAAT INI (dev run via `npm run dev:app`)

```
┌────────────────────────────────────────────────────────────────────┐
│ apps/desktop (Electron main.cjs)                                   │
│  ├─ BrowserWindow ──load──▶ http://127.0.0.1:5173 (Vite dev)      │
│  │      │                                                          │
│  │      └─ preload.cjs → window.arunakiDesktop                     │
│  │            IPC: ping, pickFolder, getFolderTree, readFile,      │
│  │                 writeFile, createFolder, deletePath, renamePath,│
│  │                 openPath, openExcelNative, parseExcel,          │
│  │                 writeExcel, readBinaryFile, setTheme, notify    │
│  │                                                                 │
│  └─ WS client (main.cjs:455) → ws://127.0.0.1:31524 ❌ DEAD        │
│         (apps/api dihapus; reconnect loop 3s selamanya)            │
│                                                                    │
└───────────────┬────────────────────────────────────────────────────┘
                │ fetch('/api/...')
                ▼
┌────────────────────────────────────────────────────────────────────┐
│ apps/web (Vite :5173, proxy /api → http://127.0.0.1:4096)          │
│  ├─ lib/engine.ts  → /api/session, /api/session/:id/prompt,        │
│  │                   /api/event (SSE), /api/provider, /api/agent,  │
│  │                   /api/model                                     │
│  └─ pages/UnifiedWorkstationPage.tsx → mapEngineMessages/mapEngineEvents
└───────────────┬────────────────────────────────────────────────────┘
                │ HTTP :4096
                ▼
┌────────────────────────────────────────────────────────────────────┐
│ packages/engine/opencode (Engine = fork OpenCode)                  │
│  ├─ src/index.ts          CLI yargs (scriptName "arunaki")          │
│  ├─ src/serve-only.ts     [BARU, Phase 61.7] entrypoint headless    │
│  ├─ src/server/server.ts  Server.listen(:4096) / Server.Default()   │
│  │                        (in-process app.fetch)                    │
│  ├─ src/server/routes/instance/httpapi/server.ts → createRoutes    │
│  │   - serverRoutes  = HttpApiBuilder.layer(Api)              /api/*│
│  │   - instanceRoutes= instance handlers (session, provider, ...)  │
│  │   - eventApiRoutes= SSE /api/event                               │
│  │   - rootApiRoutes = /global/*                                    │
│  │   - uiRoute       = serveUIEffect (embedded UI / upstream proxy) │
│  └─ src/server/shared/ui.ts → UI_UPSTREAM = app.arunaki.ai          │
│        embeddedUI() = import("Arunaki-web-ui.gen.ts")               │
│        ⚠ menunjuk app dist ENGINE (web asli OpenCode), BUKAN apps/web│
└───────────────┬────────────────────────────────────────────────────┘
                │ LLM provider (HTTP outbound)
                ▼
        LLM (Mistral/kenari.id via .Arunaki/config.json)
```

### 1.2 Jalur Koneksi yang ADA SAAT INI

| Jalur | Arah | Status | Bridge yang digunakan |
|---|---|---|---|
| Electron → Web UI | main.cjs → WEB_URL (:5173 / dist) | ✅ hidup | BrowserWindow.loadURL |
| Web UI → Engine API | `fetch('/api/session'...)` | ✅ hidup | **HTTP :4096 (Vite proxy)** |
| Web UI → LLM | Route engine `/api/session/:id/prompt` + SSE | ✅ hidup (E2E verified Phase 61.8) | HTTP outbound engine → provider |
| Web UI → OS/native | `window.arunakiDesktop.*` (IPC) | ✅ hidup | **Electron IPC (contextBridge)** — disengaja |
| Desktop → Backend lama | `ws://127.0.0.1:31524` (main.cjs:455) | ❌ DEAD | **WebSocket legacy** — backend `apps/api` dihapus |

### 1.3 Modul yang Terlibat (dengan tanggung jawab)

| Modul | Peran | Boundary (ARCHITECTURE.md) |
|---|---|---|
| `apps/web` | Frontend React/Vite — chat, folder, workstation | UI only; tidak berisi business logic |
| `apps/desktop` (main.cjs, preload.cjs) | Shell Electron — window, IPC native fs/Office | OS integration only |
| `packages/engine/opencode` | Engine = fork OpenCode (CLI + server + LLM + session) | AI Engine; tidak akses Storage langsung |
| `packages/engine/{core,server,protocol,schema,sdk,effect-*}` | Library engine | via Service/Repository |
| `packages/arunaki-tools` | Tool dokumen: `ExcelComTool`, `WordComTool`, `PptComTool` | via `Tool.define()` di engine |
| `packages/arunaki-gitlab-auth`, `arunaki-poe-auth` | Auth provider | Vendor, di-rewire ke `@arunaki/plugin` |

### 1.4 Bridge yang WAJIB DIPUTUS (sesuai MASTER PROMPT)

1. **Local HTTP :4096 sebagai jembatan UI↔Engine saat runtime.** Ini yang paling utama — saat ini UI berpindah data ke engine lewat HTTP server terpisah + Vite proxy. Di target final, panggilan `fetch('/api/...')` harus diselesaikan **dalam satu proses**, bukan lewat socket.
2. **Vite dev proxy** (`apps/web/vite.config.ts` → target :4096). Hanya untuk dev; di production tidak boleh bergantung Vite.
3. **WebSocket `ws://127.0.0.1:31524`** (main.cjs:455) — sudah dead (backend `apps/api` dihapus). Tinggal dibuang, bukan dipertahankan.
4. **`serve-only.ts`** (Phase 61.7) — ini solusi pemulih jalur dev; di target final tidak lagi dibutuhkan sebagai proses eksternal (fungsi in-process `Server.Default().app` menggantikannya).

### 1.5 IPC yang DIGANTI dengan mekanisme in-process (bukan dihapus)

- `fetch('/api/...')` dari renderer → di target final diarahkan ke `Server.Default().app` **di dalam proses yang sama** (lihat Deliverable 2), sehingga tidak ada socket HTTP terpisah.
- Event SSE `/api/event` → tetap via aliran event, tetapi dialirkan lewat mekanisme in-process (mis. preload yang mem-wire ke event stream engine), bukan `fetch` ke port.

### 1.6 IPC yang DIHAPUS (murni dead)

- Koneksi WS `ws://127.0.0.1:31524` di `apps/desktop/main.cjs` + seluruh handler RPC-nya (`openFile`, `openExcel`, `openWord`, `openPpt`, `excelWriteCell`, `excelSetFormat`, `excelEdit`, `wordType`, `wordFormat`, `sendKeys`, `clickCoordinate`, `screenshot`, `ping`) yang dipanggil lewat WebSocket tersebut. Sebagian aksinya redundan dengan `arunakiDesktop` IPC yang sudah ada. — **Catatan:** verifikasi apakan renderer web memanggil jalur WS ini; jika `app.arunakiDesktop` sudah dipakai, pembuangan aman.

---

## Deliverable 2 — Target Structure & Data Flow

### 2.1 Prinsip "Single Harness"

Satu proses aktif yang menyatukan:

- **UI** (React apps/web, dibangun → `dist/`)
- **Engine** (packages/engine/*) — termasuk LLM provider loop, session, tool registry, tools Arunaki (`ExcelComTool`, `WordComTool`, `PptComTool`)
- **Shell** (Electron) — hanya menyediakan window + *native OS bridge* (folder picker, COM Office). Native OS bridge ≠ bridge ke engine.

### 2.2 Arsitektur TARGET

```
┌──────────────────────────────────────────────────────────────────────┐
│ Satu Proses: arunaki (Electron main)                                 │
│                                                                      │
│  ┌─────────────┐   window.arunakiDesktop (contextBridge)            │
│  │  Electron    │   ├ pickFolder / getFolderTree / readFile / ...    │
│  │  BrowserWnd  │   └ Excel/Word/Ppt COM (winax) — NATIVE OS ONLY    │
│  │  (loads dist)│                                                    │
│  └──────┬──────┘                                                    │
│         │  fetch('/api/...')  →  tidak lewat HTTP socket            │
│         ▼                                                            │
│  ┌─────────────┐   in-process, via Server.Default().app              │
│  │  Loader/API │   (webHandler) — Effect runtime Engine              │
│  │  Proxy      │                                                    │
│  └──────┬──────┘                                                    │
│         ▼                                                            │
│  ┌──────────────────────────────────────────────┐                   │
│  │  Engine (fork OpenCode)                       │                   │
│  │   • LLM provider loop   (Mistral, dll)        │                   │
│  │   • Session + prompt + SSE                    │                   │
│  │   • ToolRegistry + ExcelComTool/WordCom/PptCom│                   │
│  │   • Storage (SQLite) / Config (.Arunaki)      │                   │
│  └──────────────────────────────────────────────┘                   │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.3 Cara Mencapainya (mekanisme in-process tanpa port)

Engine sudah menyediakan primitif yang tepat:

- `Server.Default()` di `packages/engine/opencode/src/server/server.ts:56`:
  ```ts
  export const Default = lazy(() => {
    const handler = HttpApiApp.webHandler().handler
    const app: ServerApp = {
      fetch: (request) => handler(request, HttpApiApp.context),
      // request(input, init) = convenience wrapper
    }
    return { app }
  })
  ```
- `webHandler` di `server/routes/instance/httpapi/server.ts:317` mengekspos `HttpRouter.toWebHandler(...)`.

**Pendekatan yang dipilih (rekomendasi):**

1. Perlakukan fetch API di renderer sebagai request satu proses: di main process (Electron), jadikan handler `Server.Default().app.fetch` sebagai backend dari satu **protocol handler** (mis. `protocol.handle('arunaki', ...)` dari Electron) atau injeksi via `session.webRequest`. Semua `fetch('/api/...')` dari UI di-resolve oleh main process tanpa port TCP.
2. Alternatif lebih sederhana (perantara): pertahankan satu listener HTTP di loopback `127.0.0.1` sebagai internal transport — **tapi ini melanggar maksud MASTER PROMPT** ("local HTTP bridge dihilangkan"). Dipakai hanya transisi.

> **Keputusan yang perlu diklarifikasi tim:** apakah "hilangkan local HTTP" berarti benar-benar zero-TCP (protocol handler / webRequest), atau masih boleh listener loopback satu-proses? Ini keputusan arsitektur kritis yang memengaruhi semua langkah selanjutnya.

### 2.4 Data Flow Setelah Konsolidasi

```
User mengetik "Rekap ke excel" di chat UI
  → UI kirim prompt ke session (via in-process API proxy)
  → Engine: plan → panggil tool (ExcelComTool via ToolRegistry, ke Excel via app.arunakiDesktop/COM)
  → LLM stream delta → SSE in-process → UI render token
  → Session persist (SQLite) → history terbaca penuh
```

---

## Temuan Kunci — Keterkaitan "in-process" dengan runtime bun (2026-08-28)

Engine fork (OpenCode) **tidak bisa di-load sebagai module di dalam proses
Electron** (yang berjalan di atas Node CJS) karena deps native bun:
`@ff-labs/fff-bun`, `@parcel/watcher`, `@opentui` (ROOT). Jalur yang
direkomendasikan MASTER PROMPT ("Electron meng-host engine in-process via
`Server.Default()`") hanya realistis di **binary hasil `Bun.build` compile**
— persis jalur `.exe` yang **di-defer**.

Implikasi:
- **Langkah 2-4** (transport in-process + Electron meng-host engine) secara
  teknis **tergantung pada harness bun-compiled yang ditunda**. Sebelum itu,
  dev flow tetap sah memakai `serve-only.ts` + Vite proxy :4096 sebagai
  transisi.
- **Langkah 3** (embed `apps/web` ke `Arunaki-web-ui.gen.ts`) bersifat
  persiapan murni untuk harness tersebut — `script/build.ts:28` harus dialihkan
  dari `packages/engine/app` (tidak ada) ke `apps/web` saat harness dikerjakan.
- **Yang bisa dikerjakan SEKARANG tanpa dependensi harness:** selesai
  (Langkah 1 WS bridge dibuang). Sisanya menunggu keputusan tim + fokus .exe.

## Catatan Khusus: Tool `shell` (KEPUTUSAN 2026-08-28)

Meski VISION mencatat "bukan shell executor", tool `shell` engine **diputuskan
PERTAHANAKAN** sebagai fallback resmi pembacaan file binary saat mapping COM
(Excel/Word/PPT) tidak sesuai. Karena:
- Akses eksekusi tetap dilewati gate `Permission` (approval/deny) — bukan shell bebas.
- Konteks eksekusi dbatasi ke sandbox folder aktif + helper (`od`/`xxd`/`python3`).
- Upgrade path: status diturunkan jika `read`/`parseExcel` COM dinilai memadai.

Detail & tabel putusan 1/1: lihat `docs/ENGINE-FEATURE-TRIAGE.md`.

---

## Deliverable 3 — Step-by-Step Action Plan (563 urutan kerja)

> Semua item ditulis untuk dipindah ke WORKFLOW.md. Item `.exe`/bundling binary tetap di-defer.

### Langkah 1 — Buang dead WS bridge (kecil, aman) ✅ DONE (commit 0f3545e)
1. Hapus `WebSocket` client + `connectToBackend()` + handler WS RPC (`openFile`, `openExcel`, ... , `screenshot`, `ping`) dari `apps/desktop/main.cjs` (sekitar baris 447-813).
2. Hapus dependensi `ws` dari `apps/desktop/package.json` (jika tak dipakai lagi).
3. Verifikasi tak ada renderer web yang memanggil channel WS lama (sudah pakai `window.arunakiDesktop`).
4. Test: `npm run dev` — folder tree, fs read/write, Excel open via `arunakiDesktop` tetap jalan.

### Langkah 2 — Tentukan transport in-process UI↔Engine (keputusan)
1. Dokumentasikan pilihan A (protocol handler / session.webRequest, zero-port) vs pilihan B (listener loopback transisi).
2. Tulis ADR singkat di `docs/` dan minta keputusan tim (blocker: MEMUTUSKAN searah dengan MASTER PROMPT).
3. **BLOKIR sementara oleh temuan bun-runtime** — lihat "Temuan Kunci" di atas: in-process hanya via binary bun-compiled (defer). Keputusan ini perlu dipandang ulang setelah .exe masuk backlog aktif.

### Langkah 3 — Embed Web UI ke dalam engine bundle
1. Ubah `script/build.ts:27-30` (`createEmbeddedWebUIBundle`) agar membangun **`apps/web`** (bukan `packages/engine/app`), serta env `Arunaki_CHANNEL`.
2. Pindahkan/kopikan output ke jalur yang diimport `ui.ts:48` (`Arunaki-web-ui.gen.ts`).
3. Build engine + verifikasi `/` menyajikan UI kita (bukan upstream `app.arunaki.ai`).

### Langkah 4 — Rakit modul Electron yang memuat engine in-process
1. Buat entry main `apps/desktop` yang mengimport handler engine (`Server.Default().app`) dan mendaftarkannya ke protocol/transport terpilih.
2. Prodor request API dari renderer → `app.fetch`.
3. Wire event stream engine → preload → UI (SSE in-process).
4. Pertahankan `arunakiDesktop` (native OS) sebagai satu-satunya jembatan keluar yang sah.

### Langkah 5 — Matikan jalur dev lama & verifikasi akhir
1. Hapus ketergantungan dev terhadap Vite proxy + `serve-only.ts` (pertahankan hanya untuk dev instan).
2. Jalankan **single-process smoke test**: boot, buka folder, chat "rekap ke excel", tool terpanggil, Excel terbuka, session persist.
3. `npm run build -w apps/web` 0 error; test engine tetap hijau.
4. Perbarui WORKFLOW (fase target), ARCHITECTURE.md, dev-log.

### Langkah 6 (DILUAR SCOPE SEKARANG) — .exe / distribusi binary
- Di-defer sesuai instruksi user ("dapi .exe nya nanti bukan sekarang ya"). Catatan: `bin/opencode`, `postinstall.mjs`, `Dockerfile`, `core/package.json bin` = mekanisme distribusi yang akan disambungkan ke harness ini.

---

## Keputusan Yang Perlu Dikonfirmasi Tim (Per MASTER PROMPT)

1. **Definisi "hilangkan local HTTP":** zero-TCP (protocol handler) atau listener loopback transisi masih diperbolehkan?
2. **Embedded UI:** apakah UI resmi produk = `apps/web` (rekomendasi; `packages/engine/app` hanya web bawaan OpenCode)?
3. **Native OS bridge:** apakah akses COM Office via `arunakiDesktop` tetap dianggap sah (bukan "bridge ke engine")? (Rekomendasi: ya — itu integrasi aplikasi desktop, bukan komunikasi antar-proses engine.)