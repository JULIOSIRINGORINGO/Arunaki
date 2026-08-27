# Arunaki Boundaries

Dokumen ini mendefinisikan apa yang Arunaki BISA dan TIDAK BISA lakukan.
**Setiap developer/AI harus membaca dokumen ini sebelum membuat fitur baru.**

---

## 1. Apa Itu Arunaki?

Arunaki adalah **Digital Employee** — AI yang bekerja secara visible di layar untuk mengerjakan dokumen kantor.

Seperti karyawan tambahan, Arunaki bisa membuka aplikasi (Excel, Word, browser, Google Docs), mengetik, scroll, mengisi form — **kelihatan di layar seperti manusia bekerja**. Semua operasi terbatas dalam Workspace folder.

**Bukan coding agent, bukan script runner, bukan general-purpose assistant.**

**Platform: Web UI + Desktop (Electron).**

---

## 2. Yang BOLEH (In Scope)

### Visible Interaction — Aplikasi Desktop & Web
- **Membuka aplikasi desktop** (Excel, Word, PowerPoint)
- **Membuka web apps** (Google Docs, Google Sheets, Office 365)
- **Mengetik langsung** di aplikasi — kelihatan di layar
- **Scroll, klik, navigasi** — seperti manusia
- **Mengisi form dan field** — seperti MCP browser
- **Membaca apa yang ada di layar** (teks, cell, element)
- **Memformat dokumen** secara visible

### File Operations (dalam Sandbox)
- **Membaca** semua file bisnis dalam workspace folder
  - Excel (.xlsx, .xls, .csv)
  - Word (.docx)
  - PowerPoint (.pptx)
  - PDF
  - TXT, Markdown
  - Dan format dokumen kantor lainnya
- **Menulis** file baru dalam workspace
- **Memodifikasi** file dengan approval gate
- Search dan index konten workspace

### Output & Ekspor
- Dokumen Excel/Word/PPT/PDF/MD baru
- Laporan dan analisis di chat
- Artifact yang bisa di-download user

### Intelligence
- Cross-reference data antar dokumen
- Kalkulasi numerik (totals, persentase, tren)
- Deteksi anomali dan selisih
- Skills (template workflow yang bisa dipakai ulang)
- Memory (preferensi dan konteks lintas sesi)

### User Interaction
- Kirim tugas lewat text input
- Upload file ke workspace
- Download hasil export
- Review dan approve aksi agent
- **Lihat langsung proses kerja** di layar (visible interaction)
- Steering (memberi arahan saat agent bekerja)
- Abort (membatalkan agent)

---

## 3. Yang TIDAK BOLEH (Out of Scope)

### File Access — DILARANG KELUAR SANDBOX
- **TIDAK BOLEH** mengakses file **di luar** workspace folder
- **TIDAK BOLEH** membaca file sistem operasi
- **TIDAK BOLEH** membaca file user lain
- **TIDAK BOLEH** mengakses file `.env`, config, source code di luar workspace

**Workspace = folder khusus → sandbox. ITU SAJA.**

### Coding & Scripting — DILARANG
- **TIDAK BOLEH** menulis kode program (.ts, .py, .js, .go, .rs, dll)
- **TIDAK BOLEH** menjalankan script atau kode
- **TIDAK BOLEH** menjadi IDE atau development environment

### Eksekusi Sistem — DILARANG
- **TIDAK BOLEH** menjalankan shell command di luar konteks file operation
- **TIDAK BOLEH** menginstall software
- **TIDAK BOLEH** mengubah konfigurasi sistem
- **TIDAK BOLEH** spawn proses sistem

### Platform — DILARANG
- **TIDAK BOLEH** hanya berjalan dari Telegram/Discord/WhatsApp/CLI
- **TIDAK BOLEH** punya fitur yang hanya relevan untuk terminal tanpa Web UI

### Aksi Berbahaya — DILARANG
- **TIDAK BOLEH** akses internet bebas (dibatasi ke tool terverifikasi)
- **TIDAK BOLEH** kirim email atau pesan tanpa persetujuan
- **TIDAK BOLEH** akses database di luar SQLite workspace

### Intelligence — DILARANG
- **TIDAK BOLEH** fabricate data atau angka
- **TIDAK BOLEH** mengarang informasi yang tidak ada di file

---

## 4. Project Folder Isolation — SANDBOX

```
┌──────────────────────────────────────────────┐
│              KOMPUTER USER                    │
│                                               │
│  C:\Users\...\Documents  ← DILARANG          │
│  C:\Windows\...          ← DILARANG           │
│  Registry, Services      ← DILARANG           │
│                                               │
│  ┌── PROJECT FOLDER (ACTIVE FOLDER) ──────┐  │
│  │                                         │  │
│  │  🌐 Visible Interaction:               │  │
│  │     ├ Buka Excel/Word/PPT (desktop)    │  │
│  │     ├ Buka Google Docs/Sheets (web)    │  │
│  │     ├ Ketik, scroll, klik, isi form    │  │
│  │     └ Semua terlihat di layar          │  │
│  │                                         │  │
│  │  📁 File Operations:                   │  │
│  │     ├ Read file bisnis                 │  │
│  │     ├ Write file baru                  │  │
│  │     ├ Search konten                    │  │
│  │     └ Export artifact                  │  │
│  │                                         │  │
│  │  ✗ NO coding (.ts/.py/.js)            │  │
│  │  ✗ NO shell/script execution          │  │
│  │  ✗ NO access outside sandbox          │  │
│  └─────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

**Arunaki hanya "hidup" di dalam sandbox. Visible interaction untuk dokumen kantor.**

---

## 5. Alasan Batasan Ini

1. **Keamanan** — Tidak boleh akses data sensitif di luar folder proyek aktif
2. **Fokus** — Arunaki = digital employee untuk DOKUMEN, bukan general-purpose
3. **Transparansi** — User bisa lihat langsung proses kerja
4. **Trust** — User percaya karena tahu batasannya jelas
5. **Spesialisasi** — Ahli untuk dokumen kantor, bukan coding atau system admin

---

## 6. Checklist Setiap Fitur Baru

Sebelum mengimplementasi fitur baru, tanyakan:

- [ ] Apakah fitur ini berhubungan dengan dokumen kantor?
- [ ] Apakah fitur ini hanya beroperasi di dalam folder proyek aktif?
- [ ] Apakah fitur ini visible/transparan ke user?
- [ ] Apakah fitur ini bisa diakses dari Web UI?
- [ ] Apakah fitur ini TIDAK mengakses file di luar folder proyek aktif?
- [ ] Apakah fitur ini TIDAK menulis kode program?
- [ ] Apakah fitur ini memiliki approval gate untuk aksi berisiko?

**Kalau ada jawaban "tidak" → fitur perlu direvisi atau ditolak.**