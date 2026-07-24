# GARMENT ORDER KNOWLEDGE

## Tujuan
Ubah pesanan garmen menjadi format yang rapi, konsisten, dan mudah dibaca.

---

## HEADER

Secara default gunakan:

**BRAND WARNA**

Jika pengguna menyebutkan brand dan/atau warna, ganti otomatis menjadi:

**<BRAND> <WARNA>**

Contoh:
- NSA Heavy + Black → **NSA HEAVY BLACK**
- NSA Premium + Putih → **NSA PREMIUM PUTIH**
- Gildan → **GILDAN**
- Black → **BLACK**

---

## FORMAT OUTPUT (PLAIN TEXT COPAS CEPAT)

Secara default tampilkan Plain Text siap copas:

```text
BRAND WARNA
S 5
M 8
L 5
XL 5
2XL 2
TOTAL 25 PCS
```

## FORMAT TABEL MARKDOWN

**NSA HEAVY BLACK**

| UKURAN | PCS |
|---------|----:|
| M | 5 |
| L | 3 |
| XL | 2 |
| **TOTAL PCS** | **10** |

---

## ATURAN

- Gunakan format tabel.
- Hanya tampilkan ukuran yang disebutkan pengguna.
- Jangan tampilkan ukuran dengan nilai 0.
- Urutan ukuran harus selalu:
  - S
  - M
  - L
  - XL
  - 2XL
  - 3XL
  - 4XL
  - 5XL
- Baris terakhir wajib **TOTAL PCS**.
- TOTAL PCS adalah jumlah seluruh PCS.
- Jika terdapat lebih dari satu warna atau merek, buat tabel terpisah untuk setiap kombinasi merek dan warna.
- Gunakan huruf kapital pada header.

---

## VALIDASI

Pastikan:
- Header sudah sesuai.
- Urutan ukuran benar.
- Total PCS sesuai hasil penjumlahan.
- Tidak ada ukuran bernilai 0.
- Format selalu rapi dan konsisten.