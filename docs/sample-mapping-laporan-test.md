# ARUNAKI WORKSPACE OPERATING SYSTEM — LAPORAN-TEST

## 1. Domain & Workspace Profile
- **Kategori Industri**: Percetakan Sablon, Konveksi DTF & Manajemen Kas Harian.
- **Konvensi Angka & Mata Uang**:
  - Format Ribuan: Menggunakan akhiran `RB` (contoh: `1.876RB` = Rp 1.876.000, `402RB` = Rp 402.000).
  - Format Nominal Penuh: `RP 14.207.640,-` (untuk deposit/belanja besar).
- **Kanal Pembayaran Terdaftar**:
  - Transfer Bank: `BRI`, `BCA`, `BNI`, `MANDIRI`
  - E-Commerce: `TOKPED`, `SHOOPE`
  - Fisik / Kasir: `CASH`, `TOTAL UANG DI LACI`
- **Kamus Singkatan & Istilah Kunci**:
  - `CK`: Pelanggan Cetak Kaos / Work Order Cetak.
  - `DTF`: Direct Transfer Film (Bahan / Lembar Sablon Film).
  - `NOTE BELUM BAYAR`: Daftar piutang pelanggan aktif.
  - `SISA PEMBAYARAN`: Kekurangan bayar / Uang Muka (DP).
  - `BELANJAAN KE LABURA`: Pembelian bahan baku sablon/baju polos ke vendor Labura.
  - `BENDONG`: Vendor/Supplier bahan konveksi eksternal.
  - `✅`: Status verifikasi lunas / selesai diproses.

---

## 2. File Directory & Data Map

### 1. `REKAPAN TERBARU2.txt` (*Log Transaksi Harian & Buku Kas*)
- **Tujuan Dokumen**: Buku kas aktif utama untuk mencatat pemasukan harian, rincian pembayaran per bank, piutang tertunda, pengeluaran belanja bahan, serta rekonsiliasi saldo fisik kasir.
- **Struktur Seksi Dokumen**:
  1. `REKAPAN PENJUALAN [TANGGAL]` (Header tanggal transaksi)
  2. `PEMASUKAN :` (Daftar order/cetak yang masuk beserta metode bayar dan qty)
  3. `NOTE BELUM BAYAR :` (Daftar tagihan yang belum lunas)
  4. `SISA PEMBAYARAN :` (Daftar sisa cicilan/pelunasan)
  5. `PENGELUARAN :` (Biaya operasional harian)
  6. `RINGKASAN REKONSILIASI KAS :` (Breakdown Bank, E-Commerce, Cash, Pengeluaran, Uang Laci, Selisih)
  7. `BELANJAAN KE LABURA :` (Rincian belanja DTF, Baju Polos, Sablon)
  8. `FOOTER DEPOSIT :` (Total Belanja ke Bendong & Sisa Deposit)
- **Contoh Sintaks Baris Asli**:
  - Pemasukan: `CK AGUSTINO = 1.876RB(BRI) [ 45 PCS ]✅`
  - Piutang: `CI LISOI ( 8-02-2024)= 1.860RB✅`
  - Sisa Bayar: `PAK ARNOL = 402RB`
  - Belanja: `BAJU = 2.544 RB 50 [PCS]`

### 2. `REKAPAN_TEMPLATE_BASE.txt` (*Template Master*)
- **Tujuan Dokumen**: Cetak biru (blueprint) struktur laporan bersih yang digunakan ketika membuka lembar rekapan hari/shift baru.
- **Contoh Format**: Struktur standar siap pakai dengan nilai saldo kosong untuk diisi.

### 3. `TABEL REKAPAN NEW2026-.xlsm` (*Spreadsheet Master Database*)
- **Tujuan Dokumen**: Buku besar spreadsheet Excel dengan makro untuk rekapitulasi data penjualan dan arsip keuangan jangka panjang.

### 4. `test1.txt` & Dokumen Pendukung Lainnya (*Scratch / Notes*)
- **Tujuan Dokumen**: Catatan teks tambahan dan arsip sementara.

---

## 3. Tool Usage Directives (Instruksi Pemanggilan Tool)

1. **Tool `read`**:
   - Gunakan untuk membaca sisa saldo kas laci terakhir, mengecek status piutang di `NOTE BELUM BAYAR`, atau mengambil format dari `REKAPAN_TEMPLATE_BASE.txt`.
2. **Tool `write`**:
   - Gunakan **HANYA** ketika membuat file rekapan tanggal baru (misal: `REKAPAN_11_AGUSTUS_2026.txt`) disalin dari template dasar.
   - **DILARANG** menimpa file `REKAPAN TERBARU2.txt` dengan `write` dari awal agar histori data tidak hilang.
3. **Tool `edit`**:
   - Gunakan untuk menyisipkan baris transaksi baru pada seksi `PEMASUKAN`.
   - Gunakan untuk menambahkan tanda `✅` saat pelanggan melunasi tagihan di `NOTE BELUM BAYAR`.
   - **Wajib**: Setiap kali baris diubah/ditambah, hitung dan perbarui baris total:
     - `TOTAL PEMASUKAN`
     - `TOTAL TF BRI` / `TOTAL TF BCA` / `TOTAL CASH`
     - `TOTAL UANG DI LACI`
     - `SELISIH`

---

## 4. Minimal Typing, Maximum Automation Directives

### A. Zero-Preprocessing Ingestion (Toleransi Teks Mentah)
Pengguna cukup mengetik pesan singkat atau copy-paste catatan kasir:
- *Input Pengguna*: `"catat masuk order baru ck andi 30 pcs 900rb bca"`
- *Tindakan Otomatis AI*:
  1. Memformat ke: `CK ANDI = 900RB(BCA) [ 30 PCS ]✅`
  2. Menyisipkan baris tersebut di bawah seksi `PEMASUKAN :` pada `REKAPAN TERBARU2.txt`.
  3. Menambahkan `900 RB` ke `TOTAL TF BCA`, `TOTAL PEMASUKAN`, dan `TOTAL UANG DI LACI`.
  4. Merespons ke pengguna dengan status padat dan saldo laci terkini.

### B. Auto-Pelunasan Piutang
- *Input Pengguna*: `"ci lisoi lunas 140rb"`
- *Tindakan Otomatis AI*:
  1. Mencari baris `CI LISOI (10-02-2024) = 140RB` di seksi `NOTE BELUM BAYAR`.
  2. Mengedit baris tersebut menjadi `CI LISOI (10-02-2024) = 140RB✅`.
  3. Menyesuaikan rekonsiliasi kas masuk jika pembayaran diterima hari ini.

### C. Belanja Vendor
- *Input Pengguna*: `"beli dtf 50rb labura cash"`
- *Tindakan Otomatis AI*:
  1. Menambahkan baris belanja di seksi `BELANJAAN KE LABURA:`.
  2. Menyesuaikan total belanja dan sisa uang kas jika diambil dari kas operasional.

---

## 5. Strict Operating Invariants (Aturan Keamanan Data)
- **Surgical Edits Only**: Selalu gunakan tool `edit` tertarget per baris data.
- **Preserve Template Headers**: Jangan mengubah struktur garis pembatas (`----`, `====`) atau nama label standar.
- **Math Verification**: Selalu verifikasi bahwa `TOTAL PEMASUKAN` = Penjumlahan semua baris pemasukan, dan `TOTAL UANG DI LACI` = Total Cash/TF dikurangi Pengeluaran.

---

## 6. User Preferences & Learned Corrections (Living Memory)
- [Baseline]: Format rekapan mengikuti pola baku `REKAPAN TERBARU2.txt` dengan konvensi singkatan `RB`.
