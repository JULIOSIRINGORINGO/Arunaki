# Perbandingan Arsitektur LLM: Arunaki vs OpenClaw

> Analisis ini membandingkan implementasi Arunaki (berdasarkan source
> ZIP yang diberikan) dengan OpenClaw (berdasarkan implementasi dan
> dokumentasi publik). Fokus utama adalah **mengapa model LLM di Arunaki
> terasa kurang cerdas dibanding OpenClaw**, bukan performa runtime.

------------------------------------------------------------------------

# Ringkasan

Kesimpulan utama adalah bahwa **OpenClaw lebih agresif menjaga context
tetap ramping dan hanya memuat informasi yang diperlukan**, sedangkan
**Arunaki cenderung mengumpulkan banyak komponen sebelum request dikirim
ke LLM**. Hal ini meningkatkan beban kognitif model sehingga kualitas
reasoning dapat menurun.

------------------------------------------------------------------------

# 1. Prompt Assembly

  ----------------------------------------------------------------------------------------------------
  OpenClaw                                              Arunaki                   Dampak
  ----------------------------------------------------- ------------------------- --------------------
  Prompt dibangun modular                               `AiService` menerima      Risiko prompt
  (`Resolve Context → Resolve Skills → Build Prompt`)   context dari banyak       inflation lebih
                                                        service                   tinggi pada Arunaki.
                                                        (`ContextManager`,        
                                                        `ContextRegistry`,        
                                                        `ModelRouter`,            
                                                        `AutoPostureDetector`)    

  ----------------------------------------------------------------------------------------------------

**OpenClaw**

``` text
User
 ↓
Resolve Context
 ↓
Resolve Skills
 ↓
Build Prompt
 ↓
LLM
```

**Arunaki**

``` text
User
 ↓
Planner
 ↓
Knowledge
 ↓
Memory
 ↓
ContextManager
 ↓
Router
 ↓
AiService.chat()
```

------------------------------------------------------------------------

# 2. Planner

## OpenClaw

Planner tidak selalu aktif.

Request sederhana:

``` text
buat folder baru
```

langsung:

``` text
Agent
 ↓
Tool
```

## Arunaki

Memiliki dua planner:

-   `PlannerService`
-   `AutonomousPlannerService`

Planner membangun prompt khusus dan menghasilkan JSON sebelum eksekusi.

**Dampak**

OpenClaw:

``` text
1 reasoning
```

Arunaki:

``` text
Planner reasoning
↓
Executor reasoning
↓
Verifier reasoning
↓
Reflection
```

Reasoning berulang meningkatkan beban LLM.

------------------------------------------------------------------------

# 3. Knowledge Injection

## OpenClaw

Knowledge dimuat hanya jika diperlukan.

``` text
User
↓
Need knowledge?
↓
Load knowledge
```

## Arunaki

Knowledge menjadi bagian pipeline utama sejak awal sehingga context
bertambah sebelum model menentukan apakah knowledge benar-benar
diperlukan.

------------------------------------------------------------------------

# 4. Context Compression

## OpenClaw

Context dijaga tetap kecil dengan history relevan.

## Arunaki

Ditemukan konfigurasi:

``` ts
contextLength = 128000
threshold = 0.5
```

Compression baru berjalan sekitar 64K token, relatif terlambat.

------------------------------------------------------------------------

# 5. Injection Budget

## OpenClaw

-   Skill description ringkas
-   Persona ringkas
-   Workspace minimal

## Arunaki

Konfigurasi:

``` ts
injectionMaxChars = 7000
```

Workspace, memory, knowledge, dan prompt tambahan berpotensi ikut masuk
sekaligus.

------------------------------------------------------------------------

# 6. Sub-Agent

## OpenClaw

-   Isolated
-   Restricted tools
-   No shared history

## Arunaki

`SubAgentRunnerService` menerapkan:

-   Tidak berbagi chat history
-   Restricted tools

Bagian ini sudah sejalan dengan OpenClaw.

------------------------------------------------------------------------

# 7. Service Graph

## OpenClaw

``` text
Agent
↓
Tool
↓
Done
```

## Arunaki

Melibatkan:

-   Knowledge
-   Planner
-   Artifact
-   Background Review
-   Memory
-   Transcript
-   Harness
-   Self Healing

Semakin banyak service yang ikut membangun context, semakin tinggi
risiko instruction collision.

------------------------------------------------------------------------

# 8. Context Registry

## OpenClaw

Memilih hanya context yang relevan:

-   History
-   Workspace
-   Skills

## Arunaki

Sudah memiliki `ContextRegistry`, tetapi pendekatan lebih bersifat
**push** daripada **pull**, sehingga lebih banyak context disiapkan
sejak awal.

------------------------------------------------------------------------

# 9. Model Routing

## OpenClaw

Model dipilih sesuai jenis task.

## Arunaki

Menggunakan `ModelRouterService`.

Bagian ini sudah baik dan bukan penyebab utama penurunan kualitas
reasoning.

------------------------------------------------------------------------

# 10. AiService

## OpenClaw

Lebih berfungsi sebagai renderer prompt.

## Arunaki

`AiService` juga menangani:

-   ContextManager
-   ModelRouter
-   Provider fallback
-   ContextRegistry
-   Tool capability
-   Auto posture detector

Akibatnya AiService menjadi pusat orkestrasi yang cukup besar.

------------------------------------------------------------------------

# Ringkasan Penilaian

  Area                OpenClaw     Arunaki      Catatan
  ------------------- ------------ ------------ ---------------------------------
  Prompt Builder      ⭐⭐⭐⭐⭐   ⭐⭐⭐       OpenClaw lebih sederhana
  Planner             ⭐⭐⭐⭐⭐   ⭐⭐         Arunaki cenderung over-planning
  Context Injection   ⭐⭐⭐⭐⭐   ⭐⭐         Context lebih besar
  Knowledge Loading   ⭐⭐⭐⭐⭐   ⭐⭐⭐       Perlu lebih lazy
  Sub-Agent           ⭐⭐⭐⭐⭐   ⭐⭐⭐⭐⭐   Hampir setara
  Tool Architecture   ⭐⭐⭐⭐⭐   ⭐⭐⭐⭐     Mirip
  Model Router        ⭐⭐⭐⭐     ⭐⭐⭐⭐     Seimbang
  Memory              ⭐⭐⭐⭐⭐   ⭐⭐⭐       Perlu filtering lebih agresif

------------------------------------------------------------------------

# Kesimpulan

Penyebab terbesar model LLM di Arunaki terasa kurang cerdas dibanding
OpenClaw bukan berasal dari model AI yang digunakan, melainkan dari cara
context dan proses reasoning dibangun.

Temuan utama:

1.  Planner terlalu sering digunakan.
2.  Knowledge diinjeksikan terlalu awal.
3.  Prompt planner terlalu besar.
4.  Context injection terlalu besar (`7000 chars`).
5.  Context compression terlambat.
6.  Reasoning planner berulang.
7.  Dua planner berpotensi overlap.
8.  Terlalu banyak service ikut membangun prompt.

Tahap audit berikutnya yang paling penting adalah membandingkan
implementasi `AiService.chat()`, `AgentRunnerService`, dan builder
`messages[]` secara baris demi baris dengan OpenClaw untuk menemukan
sumber konkret prompt inflation dan instruction collision.
