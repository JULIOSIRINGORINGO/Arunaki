# DEV-LOG: Excel Multi-Sheet Stability Testing & Recap-Fill Pipeline

**Date:** 2026-08-22 s/d 2026-08-25
**Author:** AI Agent (opencode)
**Status:** Pipeline architecture PROVEN (1 LLM call), agent loop has known model limitations

---

## RINGKASAN

Pengujian stabilitas kemampuan Arunaki mengisi data ke template Excel ber-makro
(.xlsm) dengan struktur date-per-column (header tanggal di baris atas, label baris
di kolom kiri). Total 19+ iterasi agent loop + 1 iterasi pipeline single-shot.

**Hasil utama:**
- Template .xlsm: AMAN 100% (makro, styles, sheet lain tidak pernah rusak di 19 run)
- Agent loop: GAGAL konsisten (model tidak bisa memetakan posisi absolut secara andal)
- Pipeline single-shot: LULUS 7/7 label rows + 9 details dalam 1 LLM call

---

## FILE YANG DIUJI

| File | Lokasi | Keterangan |
|------|--------|------------|
| TABEL REKAPAN NEW2026-.xlsm | E:\JS\laporan-test\ | Template asli user, 12 sheet bulanan, makro VBA |
| REKAPAN TERBARU2.txt | E:\JS\laporan-test\ | Sumber data (rekap penjualan harian) |
| Laporan Bengkel Januari.xlsx | E:\JS\Arunika\workspace-demo\ | Template test (3 sheet, tanpa makro) |

---

## FILE TESTING (semua di apps/api/test/)

### 1. excel-stress-test.cjs
**Tujuan:** Stress test Excel multi-sheet dengan instruksi natural (tanpa petunjuk cell/column/sheet)
**Cara jalankan:**
```
node test/excel-stress-test.cjs <modelId>
```
**Contoh:**
```
node test/excel-stress-test.cjs "glm-4-7-flash:free"
```
**Kriteria lulus:** 6/9 assertions

### 2. tool-stability-test.cjs (v2)
**Tujuan:** Test 9 tool dasar (list/write/read/edit/extract/unit_converter/doc_reader/todo/excel)
**Cara jalankan:**
```
node test/tool-stability-test.cjs <modelId> [T1,T2,...]
```
**Contoh:**
```
node test/tool-stability-test.cjs "agnes-2-0-flash:free" T1,T2,T3
```
**Kriteria lulus per kasus:**
- T1: >= 1 tool dipanggil + jawaban > 10 char
- T2: file catatan-tool-test.txt ada + isi cocok
- T3: jawaban mengandung konten file asli
- T4: isi file berubah sesuai instruksi
- T5: nama + total + umur muncul di jawaban
- T6: jawaban mengandung 15000 (meter) dan 120 (menit)
- T7: 3 nama sheet asli disebut (tidak mungkin tanpa baca file)
- T8: teks rencana tersusun > 50 char
- T9: baris baru 270000 & total 2230000 di file Excel

### 3. office-stability-test.cjs
**Tujuan:** Test Word & PowerPoint COM (replace, append, PDF export, add slide)
**Cara jalankan:**
```
node test/office-stability-test.cjs <modelId> [D|E|D1,D2,D3|E1]
```
**Kriteria lulus:**
- D1: docx berisi Rp1.750.000 (bukan Rp1.500.000)
- D2: paragraf "Demikian surat penawaran ini..." ada di docx
- D3: file Surat Penawaran.pdf ada di workspace
- E1: slide count >= 3 (dari 2 asli + 1 baru)
**Prasyarat:** MS Word & PowerPoint terinstall (COM automation)

### 4. backend-tools-stability.cjs
**Tujuan:** Test 7 tool backend (search/rename/delete/compare/pdf_pages/export/draft)
**Cara jalankan:**
```
node test/backend-tools-stability.cjs <modelId> [F1-F7]
```
**Kriteria lulus:**
- F1: >= 1 tool + jawaban menyebut "penawaran"
- F2: arsip-lama.txt hilang + arsip-baru.txt ada
- F3: hapus-saya.txt hilang
- F4: jawaban menyebut nilai baru (7.500.000 atau 12 bulan)
- F5: Halaman Pertama.pdf ada + size > 500 bytes
- F6: Ringkasan Stok.csv ada + berisi BRG001
- F7: draft menyebut "Andi" + "katering" + > 80 char

### 5. backend-tools-2.cjs
**Tujuan:** Test vision_ai, generate_export, doc_redact_pii, pdf_stamp_image, data_query, batch_execute
**Cara jalankan:**
```
node test/backend-tools-2.cjs <modelId> [G1-G6]
```
**Kriteria lulus:**
- G1: jawaban mengandung "150" (dari struk)
- G2: Rekap Stok Januari.xlsx ada + berisi BRG001
- G3: PDF baru dibuat (redacted)
- G4: Halaman Lunas.pdf ada
- G5: jawaban menyebut nama tabel database
- G6: salinan-kontrak.txt ada + berisi 7.500.000

### 6. backend-tools-3.cjs
**Tujuan:** Test web_search, ask_user, desktop_open_excel/word/ppt
**Cara jalankan:**
```
node test/backend-tools-3.cjs <modelId> [H1-H5]
```

---

## REAL TEST: RECAP-FILL PIPELINE

### File yang diuji
- Target: TABEL REKAPAN NEW2026-.xlsm (sheet AGUSTUS, kolom Z = tanggal 24/08)
- Sumber: REKAPAN TERBARU2.txt (rekap 24 Agustus 2026)

### Cara jalankan
```bash
# 1. Restore backup
Copy-Item "E:\JS\laporan-test\TABEL REKAPAN NEW2026-.backup-pre-arunaki.xlsm" "E:\JS\laporan-test\TABEL REKAPAN NEW2026-.xlsm" -Force

# 2. Jalankan via API
POST /api/v1/workspaces/{workspaceId}/agent/stream
Body: { "goal": "Baca @REKAPAN TERBARU2.txt lalu isi @TABEL REKAPAN NEW2026-.xlsm...", "modelId": "..." }

# 3. Verifikasi
node scripts/_post.cjs  # baca balik file + bandingkan
powershell scripts/_zh.ps1  # hash makro + styles
```

### Kriteria lulus
| # | Kriteria | Cara verifikasi |
|---|----------|----------------|
| 1 | Detail 5 channel masuk di Z6-Z10 | Baca file: cari "FIRDA", "6559", "THEBEST", "DEDY", "VIVI" di kolom Z |
| 2 | TOTAL PEMASUKAN = 3.052.000 | Baca sel Z15 (atau label "TOTAL PEMASUKAN") |
| 3 | TOTAL TF BNI = 281.000 | Baca sel Z17 |
| 4 | TOTAL TF BCA = 2.771.000 | Baca sel Z18 |
| 5 | PENGELUARAN = 90.000 | Baca sel Z23 |
| 6 | BUS = 35.000, BENSIN = 55.000 | Baca sel Z26, Z25 |
| 7 | Makro VBA tidak rusak | SHA256 hash vbaProject.bin identik dengan backup |
| 8 | Styles/tampilan tidak berubah | SHA256 hash styles.xml identik dengan backup |
| 9 | Data tanggal lain tidak tersentuh | Bandingkan kolom 19/08 (U) before/after |
| 10 | Workbook valid (bisa dibuka) | XLSX.readFile tidak error |

### Hasil terakhir (pipeline single-shot)
- **LULUS**: 7/7 label rows + 9 detail lines
- **1 LLM call** (bukan agent loop)
- **Waktu**: < 3 menit (vs 15-20 menit agent loop yang tetap gagal)
- **Makro/styles/19-08**: AMAN

---

## ARSITEKTUR PIPELINE (bukan agent loop)

```
Sumber txt ──┐
             ├── 1 panggilan LLM (tanpa tools): ekstrak → JSON {date, rows[label,value], details}
Template ────┘         │
                       ▼
        fill_table_column (deterministik: kolom by date, baris by label)
                       ▼
        baca-balik verifikasi → laporan per-label
```

**Kenapa pipeline, bukan agent loop?**
16 iterasi agent loop membuktikan model (termasuk berbayar) TIDAK ANDAL
memetakan posisi absolut (baris/kolom) pada template lebar. Pipeline
menghilangkan kebutuhan model menyebut koordinat — model hanya mengirim
data semantik (label + nilai), harness yang resolve posisi.

---

## FIX YANG SUDAH DITERAPKAN (17+ perbaikan)

| # | Fix | File |
|---|-----|------|
| 1 | Path absolut model → resolve relatif | workspace-path.util.ts |
| 2 | Excel COM fake success → honest errors | desktop-tools.registrar.ts |
| 3 | Header row dinamis (tidak hardcode row 1) | excel-com.service.ts |
| 4 | Key-Value layout support | excel-com.service.ts |
| 5 | UPSERT key column + cross-keyed lookup | excel-com.service.ts |
| 6 | append_row row:[array] payload | excel-com.service.ts |
| 7 | Delta numeric guard | excel-com.service.ts |
| 8 | Atomic batch save | excel-com.service.ts |
| 9 | Word/PPT atomic save + honest errors | word-com, ppt-com |
| 10 | OCR/Vision path resolution | harness-meta-tools.registrar.ts |
| 11 | agent_spawn wrong method → spawnParallel | desktop-tools.registrar.ts |
| 12 | Memory/doc_search activated; skills retired | harness-meta-tools.registrar.ts |
| 13 | Recall: any-keyword + ephemeral filter | memory.repository.ts, smart-recall |
| 14 | Completeness nudge (total/rekap) | workspace-runner.service.ts |
| 15 | Free-only rotation pool + advancement | provider-catalog.service.ts |
| 16 | Multilingual keyword gates (ID+EN) | workspace-prompt-builder.service.ts |
| 17 | fill_table_column tool + pipeline | excel-com, fill-table-column.tool, runner |

---

## BATASAN YANG DIKETAHUI

| Item | Status |
|------|--------|
| agnes/glm kadang abaikan section prompt panjang | Batasan model mini; mitigasi: failover otomatis |
| desktop_screenshot/send_keys | Butuh Desktop Bridge Electron aktif |
| web_search determinisme | Tergantung jaringan |
| batch_execute PTC belum tereksekusi langsung | Model tidak memilih; tool ada dan teruji unit |
| ask_user: model mini tulis teks bukan tool call | Batasan model; forced tool_choice perlu provider transparan |

---

## CARA MENJALANKAN SEMUA TEST

```bash
# Prasyarat
cd E:\JS\Arunika\apps\api
npm run build -w apps/api
node dist/src/main.js  # server jalan di port 3000

# Test tool dasar (9 kasus)
node test/tool-stability-test.cjs "agnes-2-0-flash:free"

# Test per batch
node test/tool-stability-test.cjs "agnes-2-0-flash:free" T1,T2,T3
node test/tool-stability-test.cjs "agnes-2-0-flash:free" T4,T5,T6
node test/tool-stability-test.cjs "agnes-2-0-flash:free" T7,T8,T9

# Test Office (Word/PPT)
node test/office-stability-test.cjs "agnes-2-0-flash:free" D
node test/office-stability-test.cjs "agnes-2-0-flash:free" E1

# Test backend tools
node test/backend-tools-stability.cjs "agnes-2-0-flash:free"
node test/backend-tools-2.cjs "agnes-2-0-flash:free"
node test/backend-tools-3.cjs "agnes-2-0-flash:free"

# Test Excel stress (multi-sheet)
node test/excel-stress-test.cjs "glm-4-7-flash:free"
```
