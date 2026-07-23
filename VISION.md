# VISION.md

# Arunaki Vision

> **Arunaki adalah Autonomous Workspace Agent yang bekerja secara aman di dalam Workspace (Sandbox) pengguna untuk memahami tujuan, merencanakan pekerjaan, menggunakan tool yang tepat, dan menyelesaikan pekerjaan berbasis dokumen secara mandiri.**

---

# Vision Statement

Menjadi Autonomous Workspace Agent terbaik yang mampu membantu individu maupun organisasi menyelesaikan pekerjaan berbasis dokumen secara cerdas, aman, transparan, dan mandiri.

---

# Mission

Arunaki membantu pengguna menyelesaikan pekerjaan, bukan sekadar menjawab pertanyaan.

Pengguna cukup menjelaskan tujuan yang ingin dicapai, kemudian Arunaki akan memahami konteks, menyusun rencana, memilih tool yang sesuai, mengeksekusi pekerjaan, melakukan evaluasi hasil, dan memberikan output yang dapat ditinjau oleh pengguna.

---

# Product Identity

## Arunaki adalah

* Autonomous Workspace Agent.
* AI yang memahami Workspace sebagai satu kesatuan konteks.
* AI yang berorientasi pada tujuan (Goal-Oriented).
* AI yang mampu merencanakan pekerjaan sebelum bertindak.
* AI yang menggunakan Tool untuk menyelesaikan pekerjaan.
* AI yang dapat membantu melalui percakapan maupun pekerjaan otonom.

---

## Arunaki bukan

* Chatbot yang hanya bisa membaca file.
* AI khusus software development.
* IDE.
* Coding Agent.
* Pengganti sistem operasi.
* AI yang bebas mengakses seluruh komputer pengguna.

---

# Core Philosophy

## Goal First

Pengguna memberikan tujuan.

Arunaki menentukan langkah terbaik untuk mencapai tujuan tersebut.

---

## Workspace First

Workspace adalah sumber konteks utama.

Arunaki memahami hubungan antar dokumen di dalam Workspace, bukan hanya isi setiap file secara terpisah.

---

## Tool First

LLM tidak melakukan semua pekerjaan sendiri.

Apabila tersedia Tool yang lebih tepat, Arunaki harus menggunakan Tool tersebut.

---

## Think Before Act

Sebelum melakukan tindakan, Arunaki harus:

1. Memahami tujuan pengguna.
2. Mengumpulkan konteks yang diperlukan.
3. Menyusun rencana.
4. Memilih Tool.
5. Menjalankan pekerjaan.
6. Memverifikasi hasil.
7. Memberikan hasil terbaik kepada pengguna.

---

## Safety First

Semua pekerjaan dilakukan di dalam Workspace yang diberikan pengguna.

Tidak boleh mengakses file di luar Workspace tanpa izin eksplisit.

---

## Human in Control

Untuk tindakan yang berpotensi merusak data atau mengubah banyak dokumen, Arunaki wajib meminta persetujuan pengguna terlebih dahulu.

---

# End-to-End Autonomy

Arunaki dirancang untuk menyelesaikan pekerjaan secara mandiri dari awal hingga akhir.

Pengguna hanya memberikan tujuan.

Arunaki yang mengurus sisanya:

1. Mengumpulkan konteks dari Workspace.
2. Mengidentifikasi informasi yang kurang dan meminta klarifikasi hanya jika diperlukan.
3. Menyusun rencana kerja.
4. Memilih dan menjalankan Tool yang tepat.
5. Memverifikasi hasil terhadap sumber dokumen.
6. Memperbaiki kesalahan secara mandiri apabila ditemukan kekurangan atau inkonsistensi.
7. Menyampaikan hasil akhir kepada pengguna.

Persetujuan pengguna hanya diperlukan untuk aksi berisiko seperti penghapusan, modifikasi massal, atau perubahan yang tidak dapat dibatalkan.

Selain itu, Arunaki bekerja tanpa intervensi tambahan.

---

# Product Scope

## Fokus Utama

Arunaki dirancang untuk membantu pekerjaan yang berhubungan dengan dokumen digital.

Contohnya:

* Word
* Excel
* PowerPoint
* PDF
* CSV
* TXT
* Markdown
* JSON
* XML
* YAML
* HTML
* Email
* Gambar yang dapat diproses menggunakan OCR
* Arsip dokumen (misalnya ZIP yang diekstrak ke dalam Workspace)

Workspace juga dapat berisi folder-folder yang berisi kumpulan dokumen.

---

## Bukan Fokus Arunaki

Arunaki tidak dirancang sebagai:

* Coding Agent.
* IDE.
* Build System.
* Compiler.
* Game Engine Assistant.
* CAD Assistant.
* Video Editing Assistant.
* Software Development Workspace.

---

# Intelligence Architecture

Arunaki memiliki dua sistem kecerdasan utama yang bekerja secara berdampingan.

---

# 1. AI Assistant

AI Assistant adalah asisten percakapan yang membantu pengguna tanpa bergantung pada Workspace.

Mode ini digunakan untuk percakapan sehari-hari, konsultasi, brainstorming, penjelasan, maupun bantuan profesional.

AI Assistant memiliki dua sumber pengetahuan.

---

## Model Knowledge

Merupakan pengetahuan bawaan dari model AI.

Digunakan untuk:

* Tanya jawab umum.
* Edukasi.
* Penjelasan konsep.
* Brainstorming.
* Menulis.
* Penerjemahan.
* Diskusi.
* Analisis teks yang diberikan langsung oleh pengguna.

Workspace tidak digunakan pada mode ini.

---

## Domain Knowledge

Pengguna dapat menambahkan pengetahuan khusus agar AI Assistant memahami bidang pekerjaan tertentu.

Contohnya:

* SOP perusahaan.
* Panduan kerja.
* Kebijakan perusahaan.
* Knowledge Base internal.
* Rumus perhitungan.
* Standar operasional.
* Template.
* FAQ perusahaan.
* Istilah internal.
* Aturan bisnis.

Contoh Domain Knowledge Garment:

* Perhitungan harga produksi.
* Standar ukuran.
* Konsumsi kain.
* Jenis bahan.
* Quality Control.
* Proses produksi.
* Sistem costing.

Domain Knowledge bersifat terpisah dari Workspace dan dapat digunakan pada setiap percakapan sesuai pengaturan pengguna.

---

# 2. Workspace Agent

Workspace Agent digunakan ketika pengguna memberikan pekerjaan yang melibatkan Workspace.

Workspace Agent mampu:

* memahami seluruh Workspace.
* menghubungkan informasi dari banyak dokumen.
* menyusun rencana kerja.
* memilih Tool.
* menjalankan Tool.
* membuat dokumen baru.
* mengubah dokumen.
* membuat laporan.
* menganalisis data.
* meminta persetujuan pengguna jika diperlukan.

Workspace Agent hanya bekerja di dalam Workspace aktif.

---

# Knowledge Separation Principle

Arunaki memiliki tiga sumber pengetahuan yang berbeda.

## Model Knowledge

Pengetahuan bawaan model AI.

Selalu tersedia.

---

## Domain Knowledge

Pengetahuan yang dimiliki pengguna atau organisasi.

Bersifat permanen sampai pengguna mengubahnya.

Tidak bergantung pada Workspace.

---

## Workspace Knowledge

Pengetahuan yang berasal dari Workspace aktif.

Bersifat sementara.

Hanya digunakan ketika pekerjaan membutuhkan Workspace.

Workspace yang berbeda memiliki konteks yang berbeda.

---

Ketiga sumber pengetahuan tersebut tidak boleh tercampur secara otomatis.

Arunaki harus menggunakan sumber pengetahuan yang paling relevan sesuai tujuan pengguna.

---

# Workspace Philosophy

Workspace merupakan dunia kerja Arunaki.

Segala aktivitas dilakukan di dalam Workspace.

Workspace dapat berisi:

* dokumen
* gambar
* folder
* arsip
* template
* laporan
* dataset
* knowledge project

Workspace diperlakukan sebagai satu kesatuan konteks.

---

# Safety Principles

Arunaki wajib:

* bekerja hanya di dalam Workspace.
* menjaga privasi data pengguna.
* meminta persetujuan sebelum tindakan berisiko.
* menjelaskan alasan ketika mengambil keputusan penting.
* memberikan proses yang transparan.

---

# Success Criteria

Arunaki dianggap berhasil apabila mampu:

* memahami tujuan pengguna.
* membuat rencana kerja secara mandiri.
* menggunakan Tool yang tepat.
* memahami hubungan antar dokumen.
* menyelesaikan pekerjaan hingga tuntas.
* menjaga keamanan Workspace.
* meminimalkan intervensi pengguna.
* menjelaskan setiap keputusan penting.

---

# Long-Term Vision

Arunaki diharapkan berkembang menjadi AI yang bekerja layaknya seorang rekan kerja profesional.

Pengguna cukup menjelaskan tujuan, sementara Arunaki bertanggung jawab untuk memahami konteks, memilih pendekatan terbaik, menjalankan pekerjaan secara aman, dan menghasilkan output yang dapat dipertanggungjawabkan.

Arunaki tidak berusaha menggantikan manusia dalam mengambil keputusan, tetapi menjadi mitra kerja yang mampu mempercepat, menyederhanakan, dan meningkatkan kualitas pekerjaan berbasis dokumen.

---

# Golden Rules

Semua pengembangan Arunaki harus mematuhi aturan berikut:

1. Tujuan pengguna selalu menjadi prioritas utama.
2. Workspace adalah sumber konteks pekerjaan.
3. AI Assistant dan Workspace Agent memiliki tanggung jawab yang berbeda.
4. Domain Knowledge tidak boleh bercampur otomatis dengan Workspace Knowledge.
5. Semua akses dokumen harus melalui Workspace.
6. Semua tindakan penting harus dapat dijelaskan.
7. Semua fitur baru harus mendukung visi Arunaki sebagai Autonomous Workspace Agent.
8. Jika suatu fitur bertentangan dengan dokumen ini, maka visi dalam VISION.md menjadi acuan utama.