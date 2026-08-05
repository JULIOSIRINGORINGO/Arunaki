# Gap Analysis: Arunaki Harness vs OpenClaw/Claude Code Patterns

**Sumber audit:** `Arunaki-main__8_.zip`
**Tanggal audit:** Agustus 2026
**Metodologi:** Full-read (baris-per-baris) untuk `agent-runner.service.ts` (646 baris) dan `workspace-runner.service.ts` (1379 baris). File lain diverifikasi via targeted grep + pembacaan potongan kode terkait. Setiap temuan di bawah disertai lokasi file:baris yang bisa langsung dicek ulang.

**Catatan retraksi:** Draft awal audit ini punya 11 temuan. Poin "sub-agent delegation orphaned" **ditarik sepenuhnya** setelah full-read `tools-provider.module.ts` menemukan tool `agent_spawn` (baris ~2033) yang genuinely terdaftar ke registry dan memanggil `SubAgentRunnerService.spawnParallel()`. Fitur itu sudah wired dan berfungsi — bukan gap. Dokumen ini hanya berisi temuan yang sudah diverifikasi ulang.

---

## Ringkasan Prioritas

| # | Temuan | Kategori | Dampak | Effort Perbaikan |
|---|--------|----------|--------|-------------------|
| 1 | Parallel tool execution tidak konsisten | Performa | Sedang-Tinggi (latensi) | Rendah |
| 2 | Tokenizer akurat (tiktoken) ada tapi tidak dipakai untuk keputusan | Performa/Akurasi | Sedang | Rendah |
| 3 | Tidak ada dedup/cache hasil tool call | Performa | Rendah-Sedang | Sedang |
| 4 | Context-engine baru setengah wired | Arsitektur | Sedang | Sedang |
| 5 | `model-router` masih ignore parameter model | Kualitas output | Rendah-Sedang | Rendah |
| 6 | Tidak ada explicit todo/plan tool untuk LLM | Reliability task panjang | Sedang | Sedang |
| 7 | Tidak ada validasi schema untuk tool arguments | Reliability | Sedang-Tinggi | Sedang |
| 8 | Tidak ada rollback/checkpoint multi-step mutation | Safety/Reliability | Tinggi | Tinggi |
| 9 | Tidak ada cost/token budget enforcement | Safety/Cost | Sedang | Sedang |
| 10 | Memory search hanya keyword (FTS5), bukan semantic | Kualitas retrieval | Rendah | Tinggi |

---

## 1. Parallel Tool Execution Tidak Konsisten

### Lokasi
- `apps/api/src/modules/chat/agent-runner.service.ts:195` — jalur **sync** (`runAgentSyncInternal`)
- `apps/api/src/modules/chat/agent-runner.service.ts:467-502` — jalur **stream** (`runAgentStreamInternal`)
- `apps/api/src/modules/workspace/workspace-runner.service.ts:1028-1096` — read-only tools di workspace mode

### Bukti kode

**Jalur stream (SUDAH BENAR — paralel):**
```ts
// agent-runner.service.ts:467-502
const healingPromises = aiResponse.toolCalls.map(async (toolCall) => {
  // ...
  const healResult = await this.selfHealingService.executeWithHealing(
    toolCall.function.name,
    safeArgs,
    params.workspaceId || undefined,
  );
  return { toolCall, result: healResult.finalResult };
});
const healedResults = await Promise.all(healingPromises);
```

**Jalur sync (SALAH — sequential):**
```ts
// agent-runner.service.ts:195
for (const toolCall of aiResponse.toolCalls) {
  // ... await this.toolRegistryService.executeTool(funcName, safeArgs)
  // setiap tool call menunggu yang sebelumnya selesai
}
```

**Workspace-runner (komentar bilang paralel, implementasi sequential):**
```ts
// workspace-runner.service.ts:1028
// Execute read-only tools in parallel with SelfHealing
if (readOnlyCalls.length > 0) {
  // ...
  for (const { toolCall, args } of readOnlyCalls) {   // <-- line 1039, SEQUENTIAL
    const healResult = await this.selfHealingService.executeWithHealing(...);
    // ...
  }
}
```

### Kenapa ini masalah
Ketika LLM mengembalikan >1 tool call independen dalam satu putaran (misal baca 3 file berbeda, atau cek 2 sumber data sekaligus), harness modern (Claude Code, OpenClaw) menjalankannya konkuren karena tool call tersebut tidak saling bergantung. Arunaki punya kapabilitas ini (`ToolRegistryService.executeParallel()` di `tool-registry.service.ts:275`, dan pola `Promise.all` yang sudah dipakai di jalur stream chat), tapi:
- Jalur **sync** chat tetap sequential — latensi bertambah linear dengan jumlah tool call per putaran.
- **Read-only tools di workspace mode** (mode utama produk — Excel/Word hosting) sequential padahal secara semantik 100% aman dijalankan paralel (tidak ada risiko race condition karena tidak menulis apa pun).
- Komentar kode `// Execute read-only tools in parallel` menyesatkan siapa pun yang membaca kode itu untuk pertama kali — kode itu **tidak** melakukan apa yang diklaim komentarnya.

### Rekomendasi perbaikan
1. Di `workspace-runner.service.ts:1039`, ganti `for...await` loop menjadi:
   ```ts
   const healingPromises = readOnlyCalls.map(async ({ toolCall, args }) => {
     const enrichedArgs = { ...args, workspaceId };
     const healResult = await this.selfHealingService.executeWithHealing(
       toolCall.function.name, enrichedArgs, workspaceId,
     );
     return { toolCall, args, result: healResult.finalResult };
   });
   const healedResults = await Promise.all(healingPromises);
   // lalu loop biasa (non-async) untuk emit event & push ke messages,
   // JAGA URUTAN `healedResults` sesuai urutan `readOnlyCalls` asli
   // supaya tool_call_id di messages tetap konsisten dengan urutan
   // yang dikirim provider (beberapa provider strict soal ini).
   ```
2. Di `agent-runner.service.ts` jalur sync (`runAgentSyncInternal`, sekitar baris 195), terapkan pola `Promise.all` yang sama seperti jalur stream — supaya kedua jalur konsisten dan tidak drift lagi di masa depan.
3. **Mutating tools** (`mutatingCalls` di workspace-runner, baris 1102) **JANGAN** diparalelkan — itu memang harus sequential karena bisa saling bergantung (misal tulis file A lalu baca ulang A). Yang perlu diperbaiki cuma bagian read-only.
4. Tambahkan test yang membandingkan urutan hasil `Promise.all` dengan urutan `tool_calls` asli dari LLM response, untuk mencegah regresi tool_call_id mismatch.

### Kriteria selesai
- [ ] `workspace-runner.service.ts` read-only tool execution pakai `Promise.all`
- [ ] `agent-runner.service.ts` sync path pakai pola sama dengan stream path
- [ ] Komentar kode di baris 1028 dihapus/diganti karena sekarang benar-benar akurat
- [ ] Test: N read-only tool calls independen selesai dalam waktu ≈ max(durasi individual), bukan Σ(durasi individual)

---

## 2. Tokenizer Akurat (tiktoken) Ada Tapi Tidak Dipakai untuk Keputusan Penting

### Lokasi
- `apps/api/src/modules/ai/ai.service.ts:3` — import `encoding_for_model` dari `tiktoken`
- `apps/api/src/modules/ai/ai.service.ts:225-249` — `getEncodingForModel()` dan `countTokens()` (akurat, tidak dipakai di mana pun)
- `apps/api/src/modules/ai/ai.service.ts:251-253` — `countMessageTokens()` (dipakai luas, tapi delegate ke estimasi kasar)
- `apps/api/src/modules/ai/context-manager.ts:643-654` — `estimateTokens()`, implementasi `Math.ceil(text.length / 4)`

### Bukti kode
```ts
// ai.service.ts:238-249 — AKURAT, tapi TIDAK PERNAH DIPANGGIL di luar definisinya sendiri
countTokens(text: string): number {
  try {
    return this.enc.encode(text).length;
  } catch {
    return Math.ceil(text.length / 4);
  }
}

// ai.service.ts:251-253 — INI yang benar-benar dipakai di seluruh pipeline
countMessageTokens(messages: ChatMessage[]): number {
  return this.contextManager.estimateTokens(messages);  // <-- char/4 heuristic
}
```

```ts
// context-manager.ts:643-654
estimateTokens(messages: ChatMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      total += Math.ceil(msg.content.length / 4);   // <-- heuristik kasar
    }
    if (msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        total += Math.ceil(tc.function.name.length / 4);
        total += Math.ceil(tc.function.arguments.length / 4);
      }
    }
  }
  return total;
}
```

### Kenapa ini masalah
Semua keputusan compaction/budget (kapan compress history, kapan truncate tool result, kapan trigger LLM-based summary) bergantung pada `countMessageTokens()` — yang memakai estimasi karakter/4, bukan tokenizer asli. Ini punya dua masalah konkret:

1. **Bahasa Indonesia dan bahasa non-Latin punya rasio karakter:token yang berbeda dari asumsi cl100k_base** (yang dioptimasi untuk bahasa Inggris). Estimasi bisa meleset signifikan (di atas atau di bawah), yang berarti compaction terjadi terlalu dini (buang kapasitas konteks yang sebenarnya masih ada) atau terlalu telat (risiko overflow context window / request ditolak provider).
2. Tool result yang berisi JSON/kode punya kepadatan token lebih tinggi dari teks natural — estimasi char/4 under-estimate token JSON secara sistematis.

Ironisnya, solusi yang benar **sudah diimplementasikan dengan sempurna** (`countTokens()` pakai `tiktoken.encode()` asli) — cuma tidak pernah dipanggil oleh kode lain.

### Rekomendasi perbaikan
1. Ganti implementasi `ContextManager.estimateTokens()` untuk memanggil tokenizer asli, bukan reimplementasi heuristik sendiri. Karena `ContextManager` saat ini instansiasi mandiri (`new ContextManager()` di `LegacyContextEngine`, lihat temuan #4), opsi termudah:
   - Inject `AiService` (atau extract `countTokens` jadi shared utility function `tokenizer.util.ts` yang tidak circular-depend ke `AiService`) ke `ContextManager`.
   - Atau: pindahkan logic tiktoken encoding ke file util standalone yang bisa dipakai baik `AiService` maupun `ContextManager` tanpa circular dependency.
2. Pertahankan fallback char/4 HANYA sebagai catch-block kalau `tiktoken.encode()` throw (sudah ada polanya di `countTokens()`, tinggal direplikasi).
3. Tambahkan unit test yang membandingkan hasil `estimateTokens()` terhadap teks Bahasa Indonesia panjang (bukan cuma Inggris) untuk memastikan estimasi tetap masuk akal.
4. Setelah diganti, cache hasil encoding per pesan (bukan re-encode seluruh history tiap kali dipanggil) — karena `tiktoken.encode()` lebih mahal secara CPU dibanding `length/4`, dan `estimateTokens` dipanggil berkali-kali per putaran (baris 89, 317, 418, 466 di `context-manager.ts`).

### Kriteria selesai
- [ ] `ContextManager.estimateTokens()` memakai tiktoken asli, bukan char/4
- [ ] `countTokens()` di `ai.service.ts` tidak lagi jadi dead code (dipanggil dari path yang sama)
- [ ] Ada caching per-message supaya tidak re-encode berulang dalam satu run
- [ ] Test dengan teks Bahasa Indonesia menunjukkan estimasi token mendekati aktual (bukan lagi meleset besar)

---

## 3. Tidak Ada Dedup/Cache Hasil Tool Call

### Lokasi
- `apps/api/src/modules/ai/tool-loop-detector.service.ts` (78 baris total) — hanya mendeteksi, tidak menyimpan hasil
- `apps/api/src/modules/tools/tool-registry.service.ts` — tidak ada layer cache di `executeTool()`

### Bukti
`ToolLoopDetectorService.checkAndRecord(workspaceId, toolName, args)` (baris 27) berfungsi sebagai circuit breaker: kalau tool yang sama dipanggil berulang dengan argumen identik dalam satu run, ia menghentikan eksekusi dan mengembalikan pesan error ke LLM. Tapi tidak ada mekanisme yang menyimpan **hasil** dari pemanggilan tool sebelumnya untuk di-reuse — grep untuk `resultCache`/`memoize`/`toolResultCache` di seluruh `modules/tools/` dan `modules/ai/` tidak menemukan implementasi apa pun.

### Kenapa ini masalah
Skenario umum: LLM membaca `laporan.xlsx` di round 2, lalu di round 5 (setelah melakukan operasi lain) perlu merujuk isinya lagi dan memanggil `read_workspace_file` untuk file yang sama — sistem saat ini akan mengeksekusi ulang penuh (I/O disk, parsing Excel, dsb) alih-alih mengembalikan hasil yang sudah ada di memori/cache. Untuk file besar atau operasi yang mahal (OCR, image-to-text, web search), ini boros waktu dan resource tanpa alasan — datanya read-only dan tidak berubah dalam rentang satu run.

### Rekomendasi perbaikan
1. Tambahkan layer cache sederhana di `ToolRegistryService.executeTool()`:
   - Key: hash dari `(toolName, JSON.stringify(args))`, di-scope per `workspaceId` atau per `runId` (JANGAN cache lintas run/user — risiko data stale atau bocor antar sesi).
   - Cache **hanya untuk tool yang ditandai read-only/idempotent** (tambahkan field `cacheable: boolean` di interface `Tool`, default `false`; set `true` untuk `read_workspace_file`, `search_workspace`, `list_workspace_files`, `doc_search`, dll — tapi TIDAK untuk `web_search` karena hasil bisa berubah, dan TIDAK untuk semua `mutatingTools`).
   - TTL pendek (misal 60 detik) atau invalidasi otomatis saat ada `write_workspace_file`/`delete_workspace_file` ke file yang sama, mana pun yang lebih murah diimplementasi duluan.
2. Simpan cache in-memory per-run (mirip pola `BoundedMap` yang sudah dipakai `ToolLoopDetectorService` — reuse pola yang sama supaya konsisten dan menghindari memory leak).
3. Emit event/log saat cache hit, supaya observability tetap jelas (dev bisa lihat di log kapan tool "dieksekusi ulang" vs "diambil dari cache").

### Kriteria selesai
- [ ] Interface `Tool` punya field `cacheable`
- [ ] `executeTool()` cek cache dulu untuk tool `cacheable=true` sebelum eksekusi
- [ ] Cache di-invalidate otomatis saat file terkait dimodifikasi
- [ ] Test: memanggil tool read-only yang sama 2x berturut-turut dengan args identik → eksekusi kedua jauh lebih cepat dan log menunjukkan cache hit

---

## 4. Context-Engine Baru (ContextRegistry/ProjectionAssembler/ContextQuarantine) Setengah Wired

### Lokasi
- `apps/api/src/modules/ai/context/context-registry.service.ts`, `context-engine.interface.ts`, `legacy-context-engine.service.ts`, `projection-assembler.service.ts`, `context-quarantine.service.ts` (total 345 baris, modul baru)
- Dipakai di: `apps/api/src/modules/workspace/workspace-runner.service.ts:784`
- **Tidak** dipakai di: `apps/api/src/modules/chat/agent-runner.service.ts` (chat mode tetap pakai `getSystemPrompt()` lama, lihat baris 151-156 dan 406-411)
- Diinject tapi tidak dipanggil di: `apps/api/src/modules/ai/ai.service.ts:93`

### Bukti kode
```ts
// workspace-runner.service.ts:784 — TERHUBUNG
const context = await this.contextRegistry.getActive().assemble({
  mode: 'workspace',
  workspaceId,
  messages: history,
  workspaceContext,
  memoryContext: recallContext,
});
```

```ts
// agent-runner.service.ts:151-156 — MASIH JALUR LAMA
const systemPrompt = this.aiService.getSystemPrompt(
  chatMode,
  undefined,
  knowledgeContext,
  historyMessages,
);
// tidak ada pemanggilan contextRegistry.getActive().assemble() di sini
```

```ts
// ai.service.ts:93 — DI-INJECT TAPI TIDAK DIPAKAI
@Optional() @Inject(ContextRegistry) private readonly contextRegistry?: ContextRegistry,
// grep "contextRegistry." di file ini: 0 hasil selain baris deklarasi
```

### Kenapa ini masalah
Modul `ContextQuarantine` punya nilai keamanan nyata — ia men-sanitize konten yang masuk ke context (workspace file, memory, skills) dari pola prompt-injection sebelum masuk ke system prompt (regex block untuk `ignore previous instructions`, `system prompt`, `reveal your instructions`, dll — lihat `context-quarantine.service.ts`). Karena chat mode (mode paling sering dipakai untuk percakapan biasa, bukan workspace) **tidak lewat context engine ini sama sekali**, konten yang di-inject ke chat mode (misal knowledge base context) tidak mendapat lapisan sanitasi yang sama seperti workspace mode. Ini kesenjangan keamanan yang tidak konsisten antar mode, bukan cuma soal arsitektur rapi-rapi.

### Rekomendasi perbaikan
1. **Prioritas:** hubungkan `ContextQuarantine.sanitizeText()` (atau seluruh `ContextRegistry.getActive().assemble()`) ke jalur chat mode di `agent-runner.service.ts`, minimal untuk `knowledgeContext` yang di-inject ke prompt — supaya proteksi prompt-injection konsisten di kedua mode.
2. Hapus `@Optional() @Inject(ContextRegistry)` dari `ai.service.ts` kalau memang tidak akan dipakai di sana (dead injection membingungkan pembaca kode), ATAU implementasikan pemanggilannya kalau memang ada rencana pemakaian.
3. Setelah #1 selesai, evaluasi apakah `agent-runner.service.ts` bisa full-migrate ke `ContextRegistry.getActive().assemble()` seperti `workspace-runner.service.ts`, supaya cuma ada satu jalur context-assembly di seluruh codebase (mengurangi risiko drift seperti yang terjadi di temuan #1).

### Kriteria selesai
- [ ] Chat mode (`agent-runner.service.ts`) memakai `ContextQuarantine` untuk sanitasi context yang di-inject
- [ ] Tidak ada lagi dependency yang di-inject tapi tidak dipanggil (`ai.service.ts:93` dibersihkan atau diaktifkan)
- [ ] Test: input dengan pola prompt-injection di `knowledgeContext` pada chat mode ter-quarantine sama seperti di workspace mode

---

## 5. `model-router.service.ts` Masih Ignore Parameter Model

### Lokasi
`apps/api/src/modules/ai/model-router.service.ts:320`

### Bukti kode
```ts
getSystemPromptAdditions(_modelName: string): string {
  // underscore prefix pada parameter = konvensi TypeScript untuk
  // "parameter didefinisikan tapi sengaja tidak dipakai"
  // ...
}
```

### Kenapa ini masalah
`ModelRouterService` seharusnya mendeteksi family model (Claude/GPT/Gemini) dan menyesuaikan tambahan system prompt sesuai karakteristik masing-masing (misal Claude lebih responsif terhadap instruksi `<thinking>` block eksplisit, GPT punya preferensi format tool-call berbeda). Saat ini fungsi ini menerima parameter model tapi mengembalikan output generik yang sama untuk semua model — artinya potensi optimasi per-model yang sudah dirancang di layer ini tidak benar-benar terealisasi.

### Rekomendasi perbaikan
1. Implementasikan branching berdasarkan `_modelName` (hapus underscore setelah dipakai):
   ```ts
   getSystemPromptAdditions(modelName: string): string {
     const family = this.detectModelFamily(modelName); // sudah ada di file lain, reuse
     switch (family) {
       case 'claude':
         return '- Claude excels at detailed reasoning. Take time to think in <thinking> blocks before invoking tools.';
       case 'gpt':
         return '- Prioritize concise, structured tool-call arguments; avoid verbose reasoning in plain text.';
       case 'gemini':
         return '- ...'; // sesuaikan berdasarkan behaviour Gemini yang sudah diamati di produksi
       default:
         return '';
     }
   }
   ```
2. Cek apakah `detectModelFamily` (disebutkan sudah ada wiring-nya di `ai.service.ts` sesuai catatan audit sebelumnya) bisa direuse di sini alih-alih reimplementasi logic deteksi family.
3. Tambahkan test per family model untuk memastikan output benar-benar berbeda (bukan cuma parameter berubah tapi hasil tetap sama).

### Kriteria selesai
- [ ] `getSystemPromptAdditions()` menghasilkan output berbeda untuk minimal 2 model family berbeda
- [ ] Parameter tidak lagi pakai underscore prefix
- [ ] Test regresi memverifikasi behavior per-family

---

## 6. Tidak Ada Explicit Todo/Plan Tool untuk LLM

### Lokasi
- Tool registry: tidak ada tool `todo_write`/`task_plan`/sejenisnya (diverifikasi via grep di seluruh `apps/api/src`, termasuk `tools-provider.module.ts`)
- Yang ada sebagai pengganti sebagian: `workspace-runner.service.ts:941-961` — event `plan_created`/`plan_step`

### Bukti kode
```ts
// workspace-runner.service.ts:941-961 — ini INFERENSI OTOMATIS, bukan tool LLM
const isSingleStep = runState.round === 1 && aiResponse.toolCalls.length === 1;
if (!isSingleStep && runState.round === 1) {
  const planSteps = aiResponse.toolCalls.map((tc) => {
    // ... dibuat dari tool_calls yang SUDAH diputuskan LLM di round ini,
    // bukan rencana yang LLM tulis sendiri sebelum mulai eksekusi
  });
  onEvent({ type: 'plan_created', data: { goal: safeGoal, steps: planSteps } });
}
```

### Kenapa ini masalah
Pola `plan_created` yang ada sekarang hanya untuk **visibility UI** (menunjukkan ke user tool apa saja yang akan dijalankan di round 1) — bukan working-memory untuk LLM itu sendiri. Ini beda fundamental dengan pola TodoWrite di Claude Code / OpenClaw, di mana LLM secara eksplisit menulis daftar task bertahap di awal task kompleks, lalu **meng-update statusnya sendiri** (pending → in_progress → completed) di setiap putaran berikutnya. Manfaat pola itu:
- LLM tidak "lupa" langkah yang belum selesai di task panjang (>10 putaran) karena daftar itu selalu ada di context sebagai anchor.
- User/dev bisa lihat progres task multi-jam tanpa harus membaca ulang seluruh riwayat tool call.
- Mengurangi risiko LLM mengulang langkah yang sudah selesai atau melewatkan langkah yang seharusnya dikerjakan.

Arunaki punya `MAX_ROUNDS = 25` untuk workspace mode (`workspace-runner.service.ts:860`) — task sepanjang itu rentan drift tanpa mekanisme anchoring semacam ini.

### Rekomendasi perbaikan
1. Tambahkan tool baru `todo_write` di tool registry dengan schema:
   ```ts
   {
     name: 'todo_write',
     description: 'Tulis atau update daftar langkah kerja untuk task yang sedang dikerjakan. Gunakan di awal task multi-langkah, dan update status tiap kali sebuah langkah selesai.',
     parameters: {
       type: 'object',
       properties: {
         todos: {
           type: 'array',
           items: {
             type: 'object',
             properties: {
               id: { type: 'string' },
               content: { type: 'string' },
               status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
             },
             required: ['id', 'content', 'status'],
           },
         },
       },
       required: ['todos'],
     },
   }
   ```
2. Simpan state todo per-run (bisa in-memory `Map<workspaceId, TodoItem[]>` mirip pola `this.modifiedFiles`/`this.readFiles` yang sudah ada di `workspace-runner.service.ts`).
3. Suntikkan todo list saat ini ke system prompt / context projection (bisa manfaatkan `ProjectionAssembler` dari temuan #4 — tambahkan source `'todo'` baru dengan priority tinggi) supaya LLM selalu "ingat" progresnya di setiap putaran.
4. Tambahkan instruksi di system prompt rules (`rules.md` yang sudah ada) yang mendorong LLM memakai `todo_write` untuk task dengan estimasi >3 langkah.
5. **Jangan** paksa tool ini dipakai untuk task sederhana (1-2 langkah) — supaya tidak menambah overhead round untuk task ringan yang justru sudah efisien saat ini.

### Kriteria selesai
- [ ] Tool `todo_write` terdaftar dan bisa dipanggil LLM
- [ ] Todo list ter-inject ke context di setiap putaran berikutnya dalam run yang sama
- [ ] Test dengan task simulasi 10+ langkah menunjukkan LLM memakai todo list dan tidak mengulang langkah yang sudah `completed`

---

## 7. Tidak Ada Validasi Schema untuk Tool Arguments

### Lokasi
- `apps/api/package.json` — `"zod": "^4.4.3"` terdaftar sebagai dependency
- Grep `zod`/`ajv` di seluruh `apps/api/src/**/*.ts`: **0 hasil** — dependency terinstall tapi tidak pernah diimport
- `apps/api/src/modules/tools/tool-registry.service.ts:190` — `executeTool()` tidak melakukan validasi schema sebelum memanggil `tool.execute(args)`

### Bukti kode
```ts
// tool-registry.service.ts — validasi yang ADA cuma existence check,
// bukan validasi tipe/struktur penuh terhadap JSON schema tool
async executeTool(name: string, args: Record<string, any>) {
  const registered = this.tools.get(name);
  if (!registered) { /* error: tool not found */ }
  // TIDAK ADA: validasi args terhadap registered.tool.definition.function.parameters
  // langsung lanjut ke registered.tool.execute(args)
}
```

Setiap tool file (`*.tool.ts`, dan handler-handler di `tools-provider.module.ts`) melakukan validasi manual ad-hoc di dalam masing-masing `handler`/`execute` — misal cek `if (!query) return error` satu-per-satu. Ini tersebar dan tidak konsisten; sebagian tool mungkin lupa validasi field tertentu, dan tidak ada jaminan tipe data (misal LLM mengirim string padahal schema minta number).

### Kenapa ini masalah
LLM kadang menghasilkan argumen tool yang tidak sesuai schema (halusinasi field, tipe salah, format tanggal beda, dsb) — terutama pada model yang lebih murah/kecil (Groq llama-3.3-70b sebagai primary provider Arunaki cenderung lebih sering melakukan ini dibanding model flagship). Tanpa validasi terpusat:
- Error baru muncul di dalam logic bisnis tool (misal `undefined.toFixed is not a function`), yang tertangkap generic catch dan pesan error-nya tidak informatif untuk LLM memperbaiki argumennya di percobaan berikutnya.
- Setiap tool developer harus menulis ulang validasi manual — rawan tidak konsisten, dan menambah baris kode yang seharusnya bisa di-generate otomatis dari `parameters` schema yang sudah ada di setiap tool definition.

### Rekomendasi perbaikan
1. Karena `zod` sudah terinstall, manfaatkan itu:
   - Tambahkan field opsional `zodSchema?: ZodSchema` di interface `Tool` (`tool.interface.ts`), atau generate validator otomatis dari `definition.function.parameters` (JSON Schema) memakai library konversi JSON-Schema→Zod, atau pakai `ajv` langsung terhadap JSON Schema yang sudah ada (tidak perlu duplikasi schema dalam 2 format kalau pakai `ajv`).
   - **Rekomendasi lebih murah:** pakai `ajv` (kalau mau ditambahkan) langsung terhadap `tool.definition.function.parameters` yang sudah dalam format JSON Schema — tidak perlu tulis ulang schema di format Zod terpisah untuk setiap tool yang sudah ada.
2. Di `ToolRegistryService.executeTool()`, tambahkan validasi sebelum `tool.execute(args)`:
   ```ts
   const validation = this.validateArgsAgainstSchema(registered.tool.definition.function.parameters, args);
   if (!validation.valid) {
     return {
       status: 'error',
       error: { code: 'INVALID_ARGS', message: `Argumen tidak valid: ${validation.errors.join('; ')}` },
       preview: `Argumen untuk tool "${name}" tidak sesuai schema.`,
       // pesan ini harus cukup jelas supaya LLM bisa memperbaiki argumen di percobaan berikutnya
     };
   }
   ```
3. Setelah validasi terpusat berjalan, tool developer bisa membuang sebagian validasi manual ad-hoc yang sekarang tersebar (opsional, boleh dilakukan bertahap).
4. Jika tidak ingin memakai `zod`/`ajv` sama sekali, minimal buang dependency `zod` dari `package.json` supaya tidak menyesatkan pembaca yang mengira ada validasi terpusat padahal tidak.

### Kriteria selesai
- [ ] Ada validasi schema terpusat di `executeTool()` sebelum eksekusi tool apa pun
- [ ] Pesan error validasi cukup deskriptif untuk LLM memperbaiki argumen di percobaan berikutnya
- [ ] `zod` (atau `ajv`) benar-benar dipakai di kode, bukan dependency mati
- [ ] Test: memanggil tool dengan argumen tipe salah menghasilkan error jelas SEBELUM masuk ke business logic tool

---

## 8. Tidak Ada Rollback/Checkpoint untuk Multi-Step Mutating Operations

### Lokasi
- `apps/api/src/modules/workspace/workspace-runner.service.ts:1102-1199` — loop eksekusi `mutatingCalls`
- Grep `rollback|checkpoint|transaction` di `workspace-runner.service.ts` dan `tools-provider.module.ts`: 0 hasil relevan

### Bukti kode
```ts
// workspace-runner.service.ts:1102
for (const { toolCall, args } of mutatingCalls) {
  // setiap mutating tool call dieksekusi satu-per-satu, langsung tulis ke disk
  // via SelfHealingService.executeWithHealing() -> ... -> fs writeFile/unlink
  // TIDAK ADA mekanisme "kalau langkah ke-N gagal, undo langkah 1..N-1"
}
```

Perlindungan yang **sudah ada** (dari audit sebelumnya, masih berlaku): `delete_workspace_file` auto-backup ke `.arunaki-trash/<timestamp>_<n>` sebelum unlink. Tapi itu proteksi **per-file single-operation**, bukan proteksi atas satu rangkaian aksi dalam satu putaran/turn.

### Kenapa ini masalah
Karena human approval gate untuk mutating tools sudah dihapus total (desain "full autonomous with built-in safety" — lihat komentar di `workspace-runner.service.ts:1098`), risiko konkret: LLM merencanakan 4 mutasi berurutan (misal: update file A → rename file B → update file C → hapus file D), lalu mutasi ke-3 gagal karena error tak terduga (disk penuh, permission, dll). Hasilnya: file A dan B sudah berubah/berpindah, C dan D tidak — workspace ditinggalkan dalam **state inkonsisten** tanpa cara otomatis untuk kembali ke state sebelum turn ini dimulai. User harus menyadari sendiri ada yang tidak beres dan memperbaiki manual.

Ini yang berdampak paling tinggi dari semua temuan di dokumen ini, karena berkaitan langsung dengan integritas data user (dokumen bisnis, laporan keuangan, dll — sesuai domain Arunaki).

### Rekomendasi perbaikan
1. **Snapshot-based checkpoint (paling praktis untuk arsitektur saat ini):**
   - Sebelum loop `mutatingCalls` mulai di satu putaran, salin seluruh file yang **akan** disentuh (bisa diprediksi dari `args.filename` di setiap `mutatingCalls`) ke direktori sementara `.arunaki-checkpoint/<runId>/`.
   - Kalau salah satu mutasi di putaran itu gagal (`result.status === 'error'`), restore semua file yang sudah sempat dimodifikasi di putaran yang sama dari checkpoint, sebelum melanjutkan atau menghentikan run.
   - Hapus checkpoint direktori setelah putaran selesai sukses (atau biarkan untuk audit trail, mirip pola `.arunaki-trash` yang sudah ada).
2. Alternatif lebih ringan kalau snapshot dianggap terlalu mahal I/O-nya: catat urutan operasi yang sudah berhasil (`filename`, `previousContent` sebelum ditulis) dalam array in-memory selama loop berjalan, lalu kalau ada kegagalan di tengah, iterate mundur array itu dan tulis ulang `previousContent` ke tiap file (compensating transaction, bukan snapshot penuh).
3. Setelah rollback (metode mana pun), kirim `onEvent({ type: 'error', data: { message: 'Sebagian perubahan dibatalkan otomatis karena ada langkah yang gagal.' } })` supaya user tahu apa yang terjadi, bukan cuma diam-diam gagal.
4. Ini best dipasangkan dengan temuan #7 (validasi schema) — kalau argumen tervalidasi lebih awal, kemungkinan kegagalan di tengah rangkaian mutasi jauh berkurang, tapi rollback tetap perlu untuk kegagalan runtime yang tidak bisa dicegah validasi schema (disk penuh, race condition file lock, dll).

### Kriteria selesai
- [ ] Ada mekanisme checkpoint/snapshot sebelum rangkaian mutating tool calls dalam satu putaran
- [ ] Kegagalan di tengah rangkaian memicu rollback otomatis ke state sebelum putaran itu
- [ ] User mendapat notifikasi jelas kalau rollback terjadi
- [ ] Test: simulasi kegagalan di mutasi ke-N dari rangkaian N+ mutasi → file yang sudah termodifikasi di putaran yang sama kembali ke isi semula

---

## 9. Tidak Ada Cost/Token Budget Enforcement

### Lokasi
Grep `costTracking|tokenBudget|costLimit|budgetExceeded|maxCost` di seluruh `apps/api/src`: 0 hasil.

### Kenapa ini masalah
Kombinasi kondisi berikut membuat ini relevan untuk Arunaki secara spesifik (bukan cuma "nice to have" generik):
- `MAX_ROUNDS = 25` untuk workspace mode (jauh lebih tinggi dari `MAX_ROUNDS = 5` di chat mode)
- Human approval gate sudah dihapus — semua mutating tools auto-approve
- Ada `agent_spawn` (sub-agent delegation, lihat catatan retraksi di atas) yang bisa memicu beberapa LLM call paralel dalam satu tool call
- Ada logical failover yang **otomatis mengganti provider dan mengulang turn** kalau mendeteksi klaim sukses palsu (`workspace-runner.service.ts:906-926`)

Kombinasi run panjang + sub-agent + failover-retry bisa memicu penggunaan token/biaya yang signifikan dalam satu sesi tanpa ada pagar pembatas otomatis. Kalau ada bug atau edge case yang membuat LLM masuk pola berulang yang lolos dari `ToolLoopDetectorService` (misal variasi argumen kecil setiap putaran sehingga tidak terdeteksi sebagai loop identik), tidak ada mekanisme kedua yang berhenti berdasarkan total token/biaya yang sudah dipakai.

### Rekomendasi perbaikan
1. Tambahkan penghitungan token kumulatif per run (manfaatkan `countTokens()` yang sudah ada dari temuan #2 setelah diperbaiki) — akumulasi `usage.totalTokens` dari setiap `aiService.chat()` call dalam satu run.
2. Set threshold default (bisa dikonfigurasi per provider/tier) — misal 200K token kumulatif per run — dan hentikan run dengan pesan jelas ke user kalau threshold terlampaui, mirip pola `reachedMaxRounds` yang sudah ada.
3. Untuk `agent_spawn`/sub-agent, teruskan sisa budget dari parent run ke sub-agent supaya sub-agent tidak punya budget independen yang bisa membengkak di luar kendali parent.
4. Opsional lebih lanjut: expose running-cost estimate ke UI (`onEvent({ type: 'cost_update', ... })`) supaya user bisa lihat estimasi biaya real-time selama run berjalan, terutama untuk task panjang di workspace mode.

### Kriteria selesai
- [ ] Ada akumulasi token/biaya per run yang dilacak lintas semua putaran dan sub-agent
- [ ] Run berhenti otomatis dengan pesan jelas kalau melewati threshold budget
- [ ] Sub-agent mewarisi sisa budget dari parent, bukan budget independen

---

## 10. Memory Search Hanya Keyword (FTS5), Bukan Semantic

### Lokasi
`apps/api/src/modules/memory/session-search.service.ts:33` (`CREATE VIRTUAL TABLE ... USING fts5`), `:109-146` (`search()` — FTS5 MATCH query dengan fallback ke `LIKE`)

### Kenapa ini (mungkin) bukan masalah mendesak
Perlu digarisbawahi: FTS5 keyword search itu pilihan yang **masuk akal** untuk arsitektur Arunaki saat ini — single-tenant, data lokal (SQLite), tidak butuh infrastruktur vector-DB tambahan yang menambah kompleksitas deployment untuk aplikasi desktop. Ini beda dengan 9 temuan lain di atas yang murni gap tanpa trade-off jelas.

### Kapan ini jadi masalah nyata
Query user yang secara makna sama tapi beda kata (`"harga jual"` vs `"nilai penjualan"`, atau campuran Bahasa Indonesia-Inggris yang umum di percakapan bisnis sehari-hari) tidak akan match di FTS5 kalau kata kuncinya berbeda persis. Untuk use-case memory/skill recall yang mengandalkan LLM query dengan variasi bahasa (bukan user yang selalu pakai kata kunci konsisten), ini bisa membuat `SmartRecallService` gagal menemukan memori relevan yang sebenarnya ada.

### Rekomendasi perbaikan (opsional, prioritas rendah)
1. **Jangan buru-buru migrasi ke vector DB eksternal** — pertimbangkan dulu embedding lokal ringan (misal `sqlite-vec` extension untuk SQLite, atau model embedding kecil yang jalan on-device) supaya tetap konsisten dengan filosofi single-tenant/local-first Arunaki, bukan menambah dependency infrastruktur baru.
2. Kalau mau incremental: tambahkan **hybrid search** — FTS5 tetap jadi lapisan pertama (cepat, murah), lalu kalau hasil FTS5 kosong/sedikit, fallback ke pencarian embedding sebagai lapisan kedua, bukan mengganti FTS5 sepenuhnya.
3. Ini realistis untuk backlog jangka menengah, bukan perbaikan mendesak dibanding 9 temuan lain di atas.

### Kriteria selesai (kalau diprioritaskan)
- [ ] Ada evaluasi trade-off ukuran deployment vs kualitas recall sebelum memutuskan pendekatan
- [ ] Hybrid search (FTS5 + embedding fallback) diimplementasikan tanpa menambah dependency infrastruktur eksternal yang berat

---

## Urutan Pengerjaan yang Disarankan

Berdasarkan rasio dampak vs effort:

1. **Cepat & berdampak tinggi dulu:** #1 (parallel execution consistency), #2 (tokenizer), #5 (model-router param) — semuanya perbaikan lokal di satu-dua file, tidak butuh desain baru.
2. **Safety-critical, effort lebih besar:** #7 (schema validation) → #8 (rollback/checkpoint) — dikerjakan berurutan karena #7 mengurangi frekuensi kegagalan yang memicu kebutuhan #8, tapi #8 tetap perlu ada sebagai lapisan kedua.
3. **Arsitektural:** #4 (context-engine unifikasi) — sebaiknya setelah #7/#8 stabil, karena menyentuh jalur utama chat mode.
4. **Reliability task panjang:** #6 (todo tool), #9 (budget enforcement) — bisa paralel dengan poin 3.
5. **Backlog jangka menengah:** #3 (tool result cache), #10 (semantic memory search) — nilai tambahnya nyata tapi tidak mendesak dibanding 8 poin lain.

## Catatan Metodologi & Batasan

- Belum dibaca tuntas baris-per-baris: `self-healing.service.ts`, `compaction`/`CompactionService`, `provider.service.ts`, seluruh `apps/web`, seluruh `apps/desktop`, dan sebagian besar `tools-provider.module.ts` (2340 baris — baru bagian sub-agent tool yang dibaca detail untuk klarifikasi temuan #2 yang di-retract).
- Setiap temuan di dokumen ini disertai lokasi file:baris yang bisa diverifikasi ulang langsung terhadap kode — kalau ada perbedaan setelah update kode berikutnya, cek ulang lokasi tersebut sebelum mengerjakan rekomendasi.
- Dokumen ini fokus pada gap "efisiensi/efektivitas harness" dibanding pola OpenClaw/Claude Code — bukan audit keamanan/tenant/deployment penuh (itu sudah ada di laporan audit sebelumnya, `LAPORAN_AUDIT_ARUNAKI.md`).
