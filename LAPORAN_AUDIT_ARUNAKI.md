# Laporan Audit — Arunaki AI (Arunaki-main__7_.zip)

**Tanggal audit:** 1 Agustus 2026
**Metode:** Code review langsung terhadap source (bukan hanya dokumentasi/klaim commit), verifikasi tiap temuan dengan menelusuri call site nyata.
**Konteks:** Arunaki adalah AI assistant multi-industri (garment, retail, restoran, dll — 15 domain config) berbasis NestJS/TypeScript (`apps/api`) + web frontend (`apps/web`) + aplikasi desktop Electron (`apps/desktop`), yang dikembangkan mengarah ke pola arsitektur OpenClaw (workspace isolation, self-healing, credential pool, skills/memory system).

---

## Ringkasan eksekutif

Kualitas engineering di level modul individual (self-healing, secrets vault, path validator, circuit breaker, cron scheduler) **secara konsisten bagus** — logikanya benar, terstruktur rapi, dan banyak eksplisit terinspirasi pola OpenClaw. Namun ditemukan **pola kegagalan yang berulang di empat lapisan berbeda**: modul keamanan/fitur ditulis dengan benar secara terisolasi, tapi **tidak pernah tersambung ke jalur eksekusi nyata** karena kesalahan kecil di titik pemanggilan (argumen hilang, urutan salah, atau daftar kondisi yang tidak diperbarui saat kemampuan baru ditambahkan).

Ditambah satu temuan independen yang serius: **tidak ada autentikasi sama sekali di seluruh API**, dan kemampuan kontrol desktop (keyboard) yang baru ditambahkan lolos dari kategorisasi risiko yang ada.

**Tingkat risiko keseluruhan saat ini: Tinggi** — bukan karena desain arsitekturnya buruk, tapi karena beberapa gerbang keamanan yang sudah *dirancang dengan benar* ternyata tidak aktif di produksi.

---

## Lapisan 1 — System Prompt (`ai.service.ts`, `prompts/*.md`)

| # | Temuan | Dampak |
|---|---|---|
| 1.1 | `AutoPostureDetector` tidak pernah terpicu: kedua call site `getSystemPrompt()` di `agent-runner.service.ts` hanya kirim 3 dari 4 argumen (`historyMessages` hilang) | Fitur switching posture chat/coding tidak aktif secara praktik |
| 1.2 | `ModelRouterService.getSystemPromptAdditions(_modelName)` mengabaikan parameter model — teks tambahan system prompt selalu generik terlepas dari Claude/GPT/Gemini | Klaim "adaptasi per model family" cuma berlaku untuk format tool-call, bukan teks prompt |
| 1.3 | Daftar tool muncul dua kali di prompt workspace: `buildToolListSummary()` (tersubstitusi ke `{TOOL_LIST}`) **dan** `buildWorkspaceToolingSection()` (ditempel terpisah) | Pemborosan token signifikan (~16-20 tool terdaftar 2x), risiko deskripsi tool saling inkonsisten |
| 1.4 | `checkPromptBudget()` hanya logging warning di atas 6K token, tidak ada trimming/enforcement otomatis | Prompt bisa membengkak tanpa mitigasi |
| 1.5 | `buildProjectContextSection()` menyebut file (`AGENTS.md`, `SOUL.md`, dst) tanpa cek keberadaannya di workspace tertentu | Bisa menyesatkan agent, buang 1 tool-call percuma |

**Perbaikan cepat:** tambahkan `historyMessages` sebagai argumen ke-4 di kedua call site; hapus salah satu dari dua fungsi daftar tool yang duplikat.

---

## Lapisan 2 — Harness / Agent Loop (`workspace-runner.service.ts`)

| # | Temuan | Dampak |
|---|---|---|
| 2.1 | **Gerbang approval untuk mutasi adalah dead code.** Kondisi `isSafeWorkspaceMutate` berisi daftar tool yang identik dengan `mutatingTools` — sehingga cabang `waitForApproval()` tidak pernah tercapai | `write_workspace_file`, `update_workspace_file`, **dan `delete_workspace_file`** semua auto-approve tanpa konfirmasi manusia |
| 2.2 | `delete_workspace_file` melakukan `fsPromises.unlink()` langsung — tidak ada soft-delete, trash folder, atau backup sebelum hapus | Penghapusan file permanen dan tidak bisa di-undo |
| 2.3 | Struktur loop (`turn < 5` steering, `round < 25` tool call) sudah dibatasi wajar; circuit breaker tool-loop (`ToolLoopDetectorService`) dan logical failover provider **sudah benar-benar wired dan berfungsi** — bukan orphan | Positif — dua fitur ini berjalan sesuai desain |
| 2.4 | `sessionHistory` di `ToolLoopDetectorService` disimpan di `Map` in-memory per `workspaceId` tanpa eviction | Potensi memory leak lambat pada server yang berjalan lama dengan banyak workspace (prioritas rendah) |

**Perbaikan mendesak:** pisahkan `delete_workspace_file` ke kategori risiko tersendiri yang **wajib** lewat `approval_required`, terlepas dari status "safe workspace mutate".

---

## Lapisan 3 — Tool Execution / Self-Healing (`self-healing.service.ts`)

| # | Temuan | Dampak |
|---|---|---|
| 3.1 | **Ini akar penyebab masalah path-traversal yang tampak di Lapisan 2.** `SelfHealingService.executeWithHealing(toolName, args, workspaceId?)` punya validasi path (`validateToolPaths` → `validateWorkspacePath`) yang **implementasinya benar** (containment check `resolvedRequested.startsWith(resolvedRoot + path.sep)`), tapi kedua call site nyata di `workspace-runner.service.ts` (baris ~929 dan ~1029) memanggilnya dengan `executeWithHealing(funcName, enrichedArgs)` — hanya 2 argumen. `workspaceId` diselipkan ke dalam object `args`, bukan dikirim sebagai parameter ke-3 yang terpisah | `validateToolPaths` **tidak pernah tereksekusi**, sehingga tidak ada validasi path-traversal di jalur tool manapun (read maupun mutating) |
| 3.2 | Strategi self-healing (path correction, reduce scope, fix params) desainnya solid dan cukup jalan untuk error recovery ringan | Positif |

**Perbaikan (satu baris, dua tempat):** ubah `executeWithHealing(funcName, args, workspaceId)` — kirim `workspaceId` sebagai argumen ke-3 terpisah di kedua call site. Ini otomatis mengaktifkan validasi path yang sudah ada tanpa perlu kode baru.

---

## Lapisan 4 — Persistence & Autentikasi API (`schema.prisma`, seluruh `*.controller.ts`, `main.ts`)

| # | Temuan | Dampak |
|---|---|---|
| 4.1 | **`SecretsVaultService` (AES-256-GCM, implementasi benar) tidak diimpor oleh satu file pun** selain dirinya sendiri | `Provider.apiKey` (API key OpenAI/Anthropic/OpenRouter dll) tersimpan **plaintext** di database, meski komentar schema bilang "encrypted in future" |
| 4.2 | **Nol `@UseGuards`/`AuthGuard` di seluruh 10 controller API** | Semua endpoint (baca/tulis/hapus file workspace, lihat/ubah API key provider, jadwalkan cron, chat) terbuka tanpa autentikasi apa pun |
| 4.3 | Server listen di `0.0.0.0` (semua interface); CORS default cuma proteksi origin browser, tidak menahan panggilan langsung (curl/Postman/server lain) | Kalau port ini pernah ter-expose di luar localhost (Docker tanpa reverse proxy, port forwarding), API sepenuhnya terbuka |
| 4.4 | Model `Workspace` tidak punya kolom `userId`/`tenantId` sama sekali | Arsitektur masih single-admin murni di level DB; perlu direstrukturisasi dulu sebelum multi-tenant/multi-agent-routing bisa diimplementasikan dengan aman |

**Perbaikan prioritas:** (a) enkripsi `Provider.apiKey` pakai vault yang sudah ada; (b) tambahkan minimal satu guard global sebelum instance ini pernah diakses di luar localhost.

---

## Lapisan 5 — Interaksi Desktop (`interaction/desktop-bridge.service.ts` + `apps/desktop/main.cjs`)

| # | Temuan | Dampak |
|---|---|---|
| 5.1 | **`desktop_send_keys`** — tool yang benar-benar wired ke agent (bukan orphan) — meneruskan `args.keys` mentah tanpa validasi/sanitasi apa pun ke `desktopBridge.sendKeys()` | LLM bisa mengirim kombinasi keyboard apa saja (sintaks SendKeys: `^`, `%`, `{ENTER}`, dst) ke jendela aplikasi apa pun yang sedang fokus di desktop pengguna |
| 5.2 | Konfirmasi sisi Electron (`main.cjs`): `sh.SendKeys(msg.args.keys)` via COM object `WScript.Shell` — **tidak ada lapisan sanitasi kedua**, string diteruskan langsung ke API SendKeys Windows | Tidak ada pengaman di titik mana pun sepanjang jalur |
| 5.3 | `desktop_send_keys`, `desktop_excel_write_cell`, `desktop_word_type` **tidak termasuk** dalam `mutatingTools` di harness (Lapisan 2) — jadi dikategorikan sebagai *read-only* dan dieksekusi tanpa gerbang approval sama sekali, bahkan lebih longgar dari `write_workspace_file` | Kemampuan kontrol fisik desktop pengguna adalah yang paling minim pengawasan di seluruh sistem |
| 4/5.4 | Koneksi WebSocket bridge (`ws://127.0.0.1:31524`) antara desktop app dan backend tidak punya token/handshake auth, meski dibatasi localhost | Defense-in-depth lemah, meski risiko utama tetap di titik #5.1–5.3 |
| 5.5 | `clickCoordinate` (kontrol mouse) ada di sisi Electron dengan validasi numerik yang cukup baik (`parseInt` + `isNaN` check mencegah injeksi command PowerShell), tapi **belum** di-expose sebagai tool agent | Bukan risiko aktif saat ini, tapi patut diawasi kalau nanti di-wire |

**Perbaikan prioritas tertinggi dari seluruh laporan ini:** pindahkan tiga tool desktop ke kategori risiko terpisah (`highRiskTools`) yang **selalu** wajib approval, dan terapkan whitelist kombinasi tombol yang benar-benar dibutuhkan (Ctrl+S, Ctrl+Z, Enter, Tab) alih-alih menerima string bebas.

---

## Pola lintas-lapisan yang perlu diperhatikan secara proses

Empat dari lima temuan tersambung oleh satu akar yang sama: **modul hardening/fitur ditulis benar secara terisolasi, tapi integrasinya ke kode yang sudah ada tidak diverifikasi ulang setelah selesai.**

| Lapisan | Fitur yang dibangun benar | Kenapa gagal aktif |
|---|---|---|
| Prompt | Posture detector | Argumen ke-4 tidak dikirim |
| Harness | Approval gate | Kondisi = daftar mutating tools, jadi selalu `false` |
| Tool execution | Path validator | `workspaceId` diselipkan ke `args`, bukan param terpisah |
| Persistence | Secrets vault | Tidak ada satu pun pemanggil |
| Desktop | *(tidak ada validasi yang perlu diaktifkan — memang belum ditulis)* | — |

Pola ini konsisten dengan catatan sebelumnya bahwa setiap sesi agent-coding (Antigravity/opencode) mulai fresh tanpa memory carryover — modul baru ditulis benar untuk dirinya sendiri, tapi integrasi ke sistem yang sudah ada tidak diverifikasi ulang.

**Rekomendasi proses:** setelah setiap fitur/security-module baru selesai ditulis, wajib tambahkan minimal satu **integration test** yang memanggil lewat jalur produksi nyata (bukan unit test terisolasi ke file itu sendiri) — supaya kalau ada refactor lagi dan wiring-nya putus, CI langsung merah, bukan ketahuan lewat audit manual.

---

## Daftar prioritas perbaikan (urutan disarankan)

1. **[Lapisan 5]** Kategorikan tool desktop sebagai high-risk + wajib approval; sanitasi/whitelist `args.keys`
2. **[Lapisan 2]** Pisahkan `delete_workspace_file` agar wajib approval terlepas dari status "safe mutate"
3. **[Lapisan 3]** Perbaiki pemanggilan `executeWithHealing` — kirim `workspaceId` sebagai argumen ke-3 (mengaktifkan validasi path yang sudah ada, menutup celah traversal di semua tool)
4. **[Lapisan 4]** Tambahkan autentikasi minimal di API (guard global) sebelum instance pernah diakses di luar localhost
5. **[Lapisan 4]** Enkripsi `Provider.apiKey` pakai `SecretsVaultService` yang sudah ada
6. **[Lapisan 1]** Fix argumen `historyMessages` yang hilang; hapus duplikasi daftar tool di prompt
7. **[Lapisan 4]** Tambahkan `userId`/`tenantId` ke `Workspace` sebelum data produksi menumpuk, jika arah multi-tenant tetap jadi target
8. Tulis integration test untuk tiap titik wiring di atas agar regresi ketahuan otomatis di masa depan

---

*Laporan ini disusun berdasarkan pembacaan langsung source code di `Arunaki-main__7_.zip`, bukan berdasarkan dokumentasi atau klaim commit message semata. Setiap temuan diverifikasi dengan menelusuri call site nyata di kode.*
