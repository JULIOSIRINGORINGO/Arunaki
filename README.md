# 🦅 Arunaki

<p align="center">
  <strong>Desktop Computer Use Agent untuk Dokumen Kantor & Bisnis</strong><br>
  <em>Digital Employee yang bekerja secara transparan di layar untuk menyelesaikan pekerjaan dokumen Anda.</em>
</p>

<p align="center">
  <img src="docs/assets/UI-NEW.jpeg" alt="Arunaki Workspace IDE" width="850" />
</p>

---

## 🌟 Tentang Arunaki

**Arunaki** adalah AI Desktop Agent (Digital Employee) yang dirancang khusus untuk mengotomatisasi pekerjaan dokumen bisnis dan perkantoran. Berbeda dari coding agent atau script runner teknis, Arunaki berfokus pada eksekusi dokumen nyata: **Excel, Word, Faktur, PDF, Laporan Keuangan, dan Rekapitulasi Data**.

Arunaki bekerja secara transparan di depan layar Anda (bisa membuka aplikasi, mengetik di sel Excel, memformat dokumen) dengan batasan keamanan ketat di dalam **Folder Workspace** yang Anda tentukan.

---

## ⚡ Prinsip Utama: Minimal Typing, Maximum Automation

Pengguna cukup mengetik seminimal mungkin. Arunaki mengeksekusi dengan automasi otonom maksimal:

- 📋 **Copy-Paste Mentah**: Cukup *copy-paste* catatan pesanan atau pesan chat WhatsApp yang berantakan langsung ke obrolan — Arunaki otomatis merapikan dan memetakan datanya.
- 🎯 **Instruksi 3 Kata**: Cukup ketik instruksi singkat (contoh: `"Rekap ke excel"` atau `"Update nota ini"`), Arunaki secara cerdas mengetahui file mana yang harus dibuka, kolom mana yang harus diisi, dan total mana yang harus dihitung ulang.
- 🧮 **Perhitungan Otonom**: Tidak perlu memikirkan rumus matematika atau layout tabel manual — Arunaki menghitung subtotal, grand total, selisih omset, dan memperbarui seluruh sel terkait secara otomatis.

---

## 🛡️ Workspace Sandbox Isolation (Keamanan Total)

Arunaki mengisolasi seluruh akses hanya ke **Workspace Folder** yang dipilih pengguna:

```
┌── KOMPUTER USER ───────────────────────────────────────────┐
│                                                            │
│  ┌── ARUNAKI (DIGITAL EMPLOYEE) ────────────────────────┐  │
│  │  Visible di Layar & Headless Engine:                  │  │
│  │                                                      │  │
│  │  📊 Excel — Ketik sel, atur rumus, format tabel      │  │
│  │  📝 Word  — Tulis surat, kontrak, pemformatan dokumen│  │
│  │  🌐 Web   — Navigasi form & ekstraksi konten         │  │
│  │  📎 File  — Baca, edit, kalkulasi, backup otomatis   │  │
│  │                                                      │  │
│  │  ❌ DILARANG akses file sistem di luar Workspace     │  │
│  │  ❌ BUKAN coding agent / DILARANG eksekusi script liar│ │
│  │  🛡️ Auto-Backup & 1-Click Rollback ke .arunaki-trash/ │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

---

## 🚀 Fitur Unggulan

- **📊 Dual-Mode Excel Engine**:
  - **Mode COM Visual**: Membuka Microsoft Excel asli dan mengetik langsung di sel secara visual.
  - **Mode Direct XLSX Engine**: Pemrosesan in-memory secepat kilat (0.2 detik per update file) untuk automasi latar belakang.
- **📝 Native Word & Document Tools**: Penulisan paragraf, pemformatan teks tebal/miring, dan pembuatan dokumen formal.
- **🔄 Single-Pass Batching**: Mampu mengeksekusi puluhan perubahan sel dan kalkulasi dependen dalam 1 kali round eksekusi.
- **🔍 Full-Text Search (FTS5 SQLite)**: Pencarian cepat seluruh riwayat sesi dan transkrip audit trail.
- **🛡️ Workspace Rules Sentinel**: Mendeteksi dan memperbarui aturan bisnis lokal (`ARUNAKI.md`) secara adaptif.
- **🤖 Multi-Model Provider**: Terhubung ke DeepSeek V3/V4, GPT-OSS, Claude, Gemini, dan model open-source lokal.

---

## 🏗️ Tech Stack

| Layer | Teknologi |
| :--- | :--- |
| **Desktop Shell & Web UI** | Electron, React 19, Vite 6, Tailwind CSS, Lucide Icons |
| **Backend Core & Engine** | NestJS 11, TypeScript, SQLite + Prisma ORM |
| **Document Processors** | XLSX, SheetJS, Office COM Automation |
| **Intelligence Layer** | OpenRouter / OpenAI SDK Abstraction, Custom Prompt Architecture |
| **Test & Benchmarks** | Vitest, Custom Autonomous Benchmark Suites |

---

## 📂 Struktur Repositori

```
Arunaki/
├── apps/
│   ├── api/                # NestJS Backend Core (Runner, Tools, Providers, Sentinel)
│   │   ├── prisma/         # Database schema & SQLite migration
│   │   ├── src/            # Core source code
│   │   └── scripts/        # Autonomous benchmark suites (Excel, Rekap, Stress-test)
│   └── web/                # React + Vite Desktop IDE Interface
│       └── src/            # Canvas Workstation, Chat, Telemetry UI
├── docs/                   # 📁 Spesifikasi Arsitektur, PRD, & Dev Logs
│   ├── VISION.md           # Visi Digital Employee Arunaki
│   ├── PRD.md              # Product Requirements Document
│   ├── ARCHITECTURE.md     # Arsitektur sistem & isolasi modul
│   ├── UX_UI.md            # Desain antarmuka & alur kerja pengguna
│   ├── INTELLIGENCE.md     # Perilaku kecerdasan & batasan LLM
│   └── dev-logs/           # Log pengembangan harian
├── AGENTS.md               # Aturan kerja & protokol AI Software Engineer
├── WORKFLOW.md             # Checklist tahapan pengembangan
├── package.json
└── README.md
```

---

## 🚀 Cara Menjalankan (Quick Start)

### 1. Clone Repositori & Install Dependencies
```bash
git clone https://github.com/JULIOSIRINGORINGO/Arunaki.git
cd Arunaki
npm install
```

### 2. Konfigurasi Environment API
Salin file konfigurasi environment:
```bash
cp apps/api/.env.example apps/api/.env
```
Buka file `apps/api/.env` dan masukkan API key Anda:
```env
AI_API_KEY=your-api-key-here
AI_MODEL=deepseek/deepseek-chat
PORT=3000
```

### 3. Setup Database Lokal
```bash
npx prisma db push --schema=apps/api/prisma/schema.prisma
```

### 4. Jalankan Aplikasi
```bash
# Menjalankan Backend API dan Frontend Web UI secara bersamaan
npm run dev
```
- **Desktop UI**: `http://localhost:5173`
- **Backend API**: `http://localhost:3000`

---

## 🧪 Menjalankan Benchmark Otonom

Untuk memverifikasi kemampuan agent dalam mengedit dokumen secara otonom:

```bash
# 1. Benchmark Rekap File Teks (.txt)
npx tsx apps/api/scripts/test-rekap-extended.ts

# 2. Benchmark Rekap Spreadsheet Excel (.xlsx)
npx tsx apps/api/scripts/test-excel-rekap.ts
```

---

## 📄 Lisensi
Hak Cipta © 2026 Arunaki Team. Dilindungi undang-undang.
