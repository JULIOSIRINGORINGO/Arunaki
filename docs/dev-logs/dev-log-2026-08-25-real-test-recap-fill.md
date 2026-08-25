# DEV-LOG: Real Test — Isi Rekap Harian dari Sumber ke Template Excel

**Date:** 2026-08-24 s/d 2026-08-25
**Author:** AI Agent (opencode)
**Status:** Pipeline single-shot LULUS (7/7 label rows + 9 details, 1 LLM call)

---

## APA YANG DIUJI

Kemampuan Arunaki mengisi data rekap harian dari sumber teks (WhatsApp/catatan)
ke template Excel ber-makro (.xlsm) dengan struktur date-per-column:

```
Template: TABEL REKAPAN NEW2026-.xlsm (sheet AGUSTUS)
          Header tanggal di baris 4 (U=19/08 ... Z=24/08 ... AH=31/08)
          Label baris di kolom A/B (PEMASUKAN, TOTAL TF BNI, BENSIN, dll)

Sumber:   REKAPAN TERBARU2.txt (rekap 24 Agustus 2026, format WhatsApp)
          Berisi: detail channel, total per bank, pengeluaran, uang di laci

Tugas:    Isi kolom 24/08/2026 (kolom Z) dengan data dari sumber
          Tanpa merusak makro, tampilan, atau data tanggal lain
```

---

## CARA MENJALANKAN

### Prasyarat
1. API server jalan di port 3000 (`node dist/src/main.js` dari `apps/api/`)
2. Workspace terdaftar: `cmt467zpa0006vg8glbkv1vtz` → `E:\JS\laporan-test`
3. MS Excel terinstall (COM automation)
4. File backup ada: `TABEL REKAPAN NEW2026-.backup-pre-arunaki.xlsm`
5. Model: `glm-4-7-flash:free` (atau model lain yang mendukung JSON output)

### Langkah

```bash
# 1. Restore file ke kondisi backup (sebelum test)
Copy-Item "E:\JS\laporan-test\TABEL REKAPAN NEW2026-.backup-pre-arunaki.xlsm" "E:\JS\laporan-test\TABEL REKAPAN NEW2026-.xlsm" -Force

# 2. Kirim goal via API
$body = @{ 
  goal = "Baca @REKAPAN TERBARU2.txt lalu isi @TABEL REKAPAN NEW2026-.xlsm (sheet AGUSTUS) untuk kolom tanggal hari ini 24/08/2026 yang masih kosong. Ikuti PERSIS pola kolom 19/08 yang sudah terisi: detail channel per baris di blok PEMASUKAN, TOTAL PEMASUKAN, TOTAL TF BNI dan TOTAL TF BCA sesuai rekap (BRI 0 biarkan kosong), PENGELUARAN BUS dan BENSIN beserta TOTAL PENGELUARAN, dan UANG DI LACI serta SELISIH kalau barisnya ada. Jangan ubah sheet lain, format, warna, atau makro. Data tanggal lain jangan disentuh. NOTE BELUM BAYAR, SISA PEMBAYARAN, dan BELANJAAN tidak perlu dimasukkan."
  historyMessages = @()
  modelId = "glm-4-7-flash:free"
} | ConvertTo-Json -Depth 5

Invoke-WebRequest -Uri "http://127.0.0.1:3000/api/v1/workspaces/cmt467zpa0006vg8glbkv1vtz/agent/stream" `
  -Method POST `
  -Headers @{ 'Content-Type'='application/json'; 'X-API-Key'='199710338e26f2127f7012001e927b4b' } `
  -Body $body -UseBasicParsing -TimeoutSec 600

# 3. Tunggu selesai (biasanya 1-3 menit dengan pipeline)

# 4. Verifikasi
node scripts/_post.cjs      # baca balik file Excel + bandingkan nilai
powershell scripts/_zh.ps1  # hash makro + styles (bandingkan dengan backup)
```

### Verifikasi manual (buka file di Excel)
1. Buka `TABEL REKAPAN NEW2026-.xlsm` sheet AGUSTUS
2. Scroll ke kolom Z (tanggal 24/08/2026)
3. Cek: baris 6-10 ada detail 5 channel, Z15 ada total 3.052.000
4. Cek: makro masih jalan (Alt+F11 → lihat VBA project)
5. Cek: tampilan/warna tidak berubah

---

## KRITERIA LULUS

| # | Kriteria | Cara verifikasi | Wajib/Opsional |
|---|----------|----------------|----------------|
| 1 | Detail 5 channel masuk di baris 6-10 kolom Z | Baca file: cari "FIRDA", "6559", "THEBEST", "DEDY", "VIVI" | **WAJIB** |
| 2 | TOTAL PEMASUKAN = 3.052.000 | Baca sel Z15 | **WAJIB** |
| 3 | TOTAL TF BNI = 281.000 | Baca sel Z17 | **WAJIB** |
| 4 | TOTAL TF BCA = 2.771.000 | Baca sel Z18 | **WAJIB** |
| 5 | PENGELUARAN = 90.000 | Baca sel Z23 | **WAJIB** |
| 6 | BUS = 35.000 di Z26, BENSIN = 55.000 di Z25 | Baca sel | WAJIB |
| 7 | Makro VBA tidak rusak | SHA256 `vbaProject.bin` = `71B56C4994BD3C43` | **WAJIB** |
| 8 | Styles/tampilan tidak berubah | SHA256 `styles.xml` = `64785A72C5B3641A` | **WAJIB** |
| 9 | Kolom 19/08 (U) tidak tersentuh | Bandingkan before/after | **WAJIB** |
| 10 | Workbook valid (bisa dibuka Excel) | XLSX.readFile tidak error | **WAJIB** |

**LULUS** = Semua 10 kriteria terpenuhi.
**GAGAL** = Salah satu kriteria WAJIB tidak terpenuhi.

---

## HASIL TERAKHIR (pipeline single-shot)

| Kriteria | Hasil |
|----------|-------|
| Detail 5 channel | ✅ PASS |
| TOTAL PEMASUKAN = 3.052.000 | ✅ PASS |
| TOTAL TF BNI = 281.000 | ✅ PASS |
| TOTAL TF BCA = 2.771.000 | ✅ PASS |
| PENGELUARAN = 90.000 | ✅ PASS |
| BUS = 35.000, BENSIN = 55.000 | ✅ PASS |
| Makro VBA | ✅ AMAN (hash identik) |
| Styles/tampilan | ✅ AMAN (hash identik) |
| Kolom 19/08 | ✅ UTUH |
| Workbook valid | ✅ |

**KESIMPULAN: LULUS SEMUA**

---

## FILE PENDUKUNG

| File | Lokasi | Fungsi |
|------|--------|--------|
| Backup template | `E:\JS\laporan-test\TABEL REKAPAN NEW2026-.backup-pre-arunaki.xlsm` | Restore jika gagal |
| Hash checker | `apps/api/scripts/_zh.ps1` | SHA256 makro + styles |
| Post verifier | `apps/api/scripts/_post.cjs` | Baca balik file + bandingkan |
| Full scanner | `apps/api/scripts/_scan.cjs` | Scan semua sheet cari data |

---

## CATATAN PENTING

1. **Pipeline single-shot** (1 LLM call + eksekusi deterministik) adalah jalur yang LULUS.
   Agent loop (25 ronde) terbukti TIDAK ANDAL untuk template ini — model tidak bisa
   memetakan posisi absolut secara konsisten di 16 iterasi pengujian.

2. **Backup WAJIB dibuat** sebelum setiap run. Jika hasil salah, restore dari backup
   dan ulangi.

3. **Model gratis** (agnes/glm) kadang mengalami empty response atau refusal dari
   provider. Pipeline sudah punya retry + rotasi model (gratis → gratis → paid).
   Jika semua gagal, tunggu beberapa menit dan coba lagi.

4. **Jangan buka file di Excel** saat pipeline berjalan — file akan terkunci dan
   COM automation tidak bisa save.
