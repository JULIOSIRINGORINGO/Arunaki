# Arunaki Boundaries

Document ini mendefinisikan apa yang Arunaki BISA dan TIDAK BISA lakukan.
**Setiap developer/AI harus membaca document ini sebelum membuat fitur baru.**

---

## 1. Apa Itu Arunaki?

Arunaki adalah **Autonomous Workspace Agent** — AI yang bekerja di dalam workspace untuk menganalisis data bisnis, membuat laporan, dan memberikan rekomendasi.

**Platform: Web UI ONLY.**

---

## 2. Yang BOLEH (In Scope)

### File Access
- Hanya file di dalam **workspace folder** yang dipilih user
- File yang diizinkan: `.xlsx`, `.xls`, `.xlsm`, `.csv`, `.txt`, `.pdf`, `.docx`
- Agent membaca file → menganalisis → menghasilkan output

### Output
- Laporan markdown di chat
- File Excel/CSV/PDF/DOCX baru (via `generate_export`)
- File teks baru di workspace (via `write_workspace_file`)
- Rekomendasi aksi

### Intelligence
- Cross-reference data antar file
- Kalkulasi numerik (totals, persentase, tren)
- Deteksi anomali dan selisih
- Skills (template workflow yang bisa dipakai ulang)
- Memory (preferensi dan konteks lintas sesi)

### User Interaction
- Kirim goal/permintaan lewat text input
- Upload file ke workspace
- Download hasil export
- Review dan approve aksi agent

---

## 3. Yang TIDAK BOLEH (Out of Scope)

### File Access — DILARANG
- **TIDAK BOLEH** mengakses file di luar workspace folder
- **TIDAK BOLEH** membaca file sistem operasi (`C:\Windows\...`)
- **TIDAK BOLEH** membaca file user lain (`C:\Users\OtherUser\...`)
- **TIDAK BOLEH** mengakses file `.env`, config, atau source code project
- **TIDAK BOLEH** membaca seluruh isi komputer

**Workspace = folder khusus yang dipilih user untuk bisnisnya. ITU SAJA.**

### Platform — DILARANG
- **TIDAK BOLEH** berjalan dari terminal/CLI
- **TIDAK BOLEH** berjalan dari Telegram/Discord/WhatsApp
- **TIDAK BOLEH** punya fitur yang hanya relevan untuk CLI
- **TIDAK BOLEH** assume user punya akses terminal

### Aksi — DILARANG
- **TIDAK BOLEH** menghapus/mengubah file asli di workspace
- **TIDAK BOLEH** menginstall software
- **TIDAK BOLEH** menjalankan command sistem operasi
- **TIDAK BOLEH** mengakses internet secara bebas (hanya web_search)
- **TIDAK BOLEH** mengirim email atau pesan
- **TIDAK BOLEH** mengakses database lain selain SQLite local

### Intelligence — DILARANG
- **TIDAK BOLEH** fabricate data atau angka
- **TIDAK BOLEH** mengarang informasi yang tidak ada di file
- **TIDAK BOLEH** skip file untuk hemat waktu
- **TIDAK BOLEH** hanya membaca 1 file lalu langsung jawab

---

## 4. Workspace Isolation — KONTEKS KRITIS

```
┌─────────────────────────────────────┐
│           KOMPUTER USER             │
│                                     │
│  C:\Users\User\Documents\           │
│  ├── Project\           ← TIDAK    │
│  ├── Photos\            ← TIDAK    │
│  ├── .env               ← TIDAK    │
│  └── ...                ← TIDAK    │
│                                     │
│  E:\JS\Arunika\Arunaki\             │
│  ├── apps\              ← TIDAK    │
│  ├── docs\              ← TIDAK    │
│  └── ...                ← TIDAK    │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  WORKSPACE FOLDER           │   │
│  │  (user pilih untuk bisnis)  │   │
│  │                             │   │
│  │  ├── laporan.xlsx    ← YA  │   │
│  │  ├── data.csv        ← YA  │   │
│  │  ├── rekap.txt       ← YA  │   │
│  │  └── ...             ← YA  │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

**Agent hanya "hidup" di dalam kotak workspace. Di luar kotak = tidak ada.**

---

## 5. Alasan Batasan Ini

1. **Keamanan** — Agent tidak boleh membaca data sensitif user
2. **Fokus** — Arunaki = business analysis, bukan general assistant
3. **Kontrol** — User harus tahu persis apa yang agent bisa akses
4. **Trust** — User mau kasih data bisnis karena tahu agent tidak akan "keluar"
5. **Legal** — Mengakses file di luar workspace bisa melanggar privasi

---

## 6. Checklist Setiap Fitur Baru

Sebelum mengimplementasi fitur baru, tanyakan:

- [ ] Apakah fitur ini hanya berfungsi di dalam workspace?
- [ ] Apakah fitur ini bisa diakses dari web UI?
- [ ] Apakah fitur ini tidak mengakses file di luar workspace?
- [ ] Apakah fitur ini tidak menjalankan command sistem operasi?
- [ ] Apakah fitur ini tidak memodifikasi file asli user?
- [ ] Apakah fitur ini relevan untuk bisnis analysis?

**Kalau ada jawaban "tidak" → fitur ini TIDAK BOLEH diimplementasi.**
