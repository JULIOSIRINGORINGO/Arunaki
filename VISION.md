# VISION.md

# Arunaki Vision

> **Arunaki adalah Digital Employee — asisten AI yang bekerja secara visible di layar untuk menyelesaikan pekerjaan dokumen kantor.**
>
> Seperti karyawan tambahan, Arunaki bisa membuka aplikasi (Excel, Word, browser, Google Docs), mengetik, scroll, mengisi form — **kelihatan di layar seperti manusia bekerja**.
> Semua operasi terbatas dalam Workspace folder yang dipilih pengguna.
> Bukan coding agent. Bukan script runner. **Digital employee untuk dokumen kantor.**

---

# Vision Statement

Menjadi Digital Employee AI terbaik yang bekerja secara transparan di depan layar — membantu individu maupun organisasi menyelesaikan pekerjaan dokumen secara cerdas, aman, dan mandiri.

---

# Mission

Arunaki membantu pengguna mengerjakan dokumen, bukan sekadar menjawab pertanyaan.

Seperti digital employee, Arunaki dapat:

- **Melihat dan mengoperasikan aplikasi** — Excel, Word, PowerPoint, Google Docs, spreadsheet online, dan software kantor lainnya
- **Mengetik langsung** di dokumen, cell, form, atau field — terlihat di layar
- **Scroll, klik, navigasi** — seperti manusia menggunakan aplikasi
- **Membaca dan menganalisis** semua jenis file bisnis
- **Membuat, mengedit, memformat** laporan, tabel, grafik, dan dokumen
- **Bekerja transparan** — user bisa melihat apa yang sedang dikerjakan

Pengguna cukup memberi tugas. Arunaki mengerjakan seperti karyawan digital — visible, step by step.

---

# Core Philosophy

## Digital Employee. Visible Work. Dalam Sandbox.

Arunaki bukan sekadar AI yang memproses file di background. Arunaki bekerja **di depan layar** — membuka aplikasi, mengetik, scroll — sehingga user bisa melihat progres secara real-time.

Bedanya dari computer use agent umum: **semua operasi terbatas ke Workspace folder.**

```
┌── KOMPUTER USER ──────────────────────────┐
│                                            │
│  ┌── ARUNAKI (DIGITAL EMPLOYEE) ──────┐   │
│  │  Visible di layar:                  │   │
│  │                                     │   │
│  │  📊 Excel — ketik cell, format     │   │
│  │  📝 Word — ketik dokumen           │   │
│  │  🌐 Browser/Google Docs — isi form │   │
│  │  📎 File ops — baca/tulis/save     │   │
│  │                                     │   │
│  │  ✗ Tidak bisa akses luar workspace │   │
│  │  ✗ Bukan coding agent              │   │
│  │  ✗ Bukan script runner             │   │
│  └─────────────────────────────────────┘   │
└────────────────────────────────────────────┘
```

## Goal First

Pengguna memberi tugas. Arunaki menentukan langkah terbaik.

## Minimal Typing, Maximum Automation

Pengguna cukup memberikan input seminimal mungkin. Arunaki mengeksekusi dengan automasi maksimal tanpa membebani pengguna mengetik instruksi panjang atau merapikan format.

- **Copy-Paste Mentah**: Pengguna cukup menyalin-menempelkan (*copy-paste*) pesan WhatsApp atau catatan mentah langsung ke chat tanpa perlu merapikan format (`"update ini ke laporan harian:" + [paste teks mentah]`).
- **Instruksi 3 Kata**: Pengguna cukup mengetik instruksi singkat (`"Rekap ke excel"`), dan Arunaki secara cerdas mengenali file yang dimaksud, kolom yang harus diisi, dan kalkulasi yang harus diperbarui.
- **Tanpa Spoon-Feeding**: Pengguna tidak perlu mengetik aturan mikro atau formula matematika manual — Arunaki secara otonom memahami struktur dokumen, mempertahankan entri lama, dan menghitung ulang semua total secara presisi.

## Workspace = Sandbox

Workspace adalah **lingkungan kerja** Arunaki. Semua operasi terjadi di sini.

## Tool First

LLM tidak melakukan semua pekerjaan sendiri. Tersedia Tool untuk operasi dokumen dan visible interaction.

## Think Before Act

Sebelum bertindak, Arunaki harus:
1. Memahami tugas pengguna
2. Mengumpulkan konteks
3. Menyusun rencana
4. Memilih tool
5. Mengerjakan secara visible
6. Memverifikasi hasil
7. Memberikan hasil terbaik

## Safety First

Semua pekerjaan di dalam Workspace saja. Tidak boleh keluar.

## Human in Control

Untuk aksi berisiko, wajib minta persetujuan pengguna.

---

# Product Identity

## Arunaki adalah

* **Digital Employee untuk Dokumen Kantor** — bekerja visible di layar seperti karyawan tambahan
* AI yang **mengoperasikan aplikasi** (desktop & web) untuk mengerjakan dokumen
* AI yang berorientasi pada tugas (Task-Oriented)
* AI yang transparan — user bisa lihat proses kerja

## Arunaki bukan

* Chatbot yang hanya bisa baca file
* Coding Agent (bukan untuk .ts/.py/.js)
* Script runner atau shell executor
* IDE atau development tool
* AI yang bebas akses seluruh komputer tanpa batas

---

# Product Scope

## Fokus Utama

**File bisnis yang digunakan orang kantoran:**
* Excel / Spreadsheet (lokal & online)
* Word / Google Docs
* PowerPoint / Google Slides
* PDF
* CSV, TXT
* Dan format dokumen bisnis lainnya

**Visible interaction:**
* Membuka aplikasi (desktop & web)
* Mengetik, scroll, klik, navigasi
* Mengisi form dan field
* Memformat dokumen
* Semua terlihat di layar secara real-time

## Bukan Fokus Arunaki

* Coding Agent
* Script runner
* Shell executor
* IDE / development environment
* Game Engine / CAD / Video Editing

---

# End-to-End Autonomy

Arunaki mengerjakan tugas dari awal hingga akhir secara mandiri.

Pengguna hanya memberi tugas.

Arunaki:
1. Mengumpulkan konteks dari Workspace
2. Membuka aplikasi yang diperlukan
3. Mengerjakan dokumen secara visible — mengetik, scroll, memformat
4. Memverifikasi hasil
5. Memperbaiki kesalahan mandiri
6. Menyampaikan hasil akhir

Persetujuan user hanya untuk aksi berisiko.

---

# Success Criteria

Arunaki berhasil apabila:
* memahami tugas pengguna
* mengerjakan dokumen secara visible di layar
* menyelesaikan pekerjaan hingga tuntas
* menjaga keamanan Workspace
* transparan — user bisa lihat proses kerja

---

# Golden Rules

1. Tujuan pengguna selalu prioritas utama
2. Workspace adalah sandbox
3. Visible interaction — user bisa lihat proses kerja
4. Fokus pada dokumen kantor — semua jenis file bisnis
5. Tidak coding, tidak shell, tidak akses luar sandbox
6. Approval gate untuk aksi berisiko
7. Setiap keputusan penting bisa dijelaskan