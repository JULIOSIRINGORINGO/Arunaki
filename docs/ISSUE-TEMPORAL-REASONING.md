# Laporan Masalah: Naive Append Bias & Temporal Reasoning pada Arunaki Agent

## 1. Deskripsi Masalah
Saat ini, Arunaki bertindak layaknya sebuah "Text Editor" (penyunting teks biasa) ketika diminta untuk memperbarui sebuah dokumen yang terikat waktu (misalnya: Rekapan Penjualan Harian). 

Ketika pengguna meminta: *"update laporan hari ini dengan data X"*, Arunaki hanya akan secara naif menyisipkan (*append*) data tersebut ke dalam file. Ia tidak memedulikan dimensi waktu yang ada di dalam file tersebut.

**Dampak:**
- Jika file tersebut adalah rekap tertanggal "20 Juli" dan pengguna meminta update untuk "hari ini" (tanggal berbeda), AI akan menumpuk data hari ini bersama dengan data lama tanggal 20 Juli.
- AI gagal melakukan inisiatif **Rollover (Buka Buku Baru)** secara otomatis, yaitu: mengubah judul/tanggal ke hari ini, membersihkan data transaksi harian (pemasukan/pengeluaran), menahan data saldo kumulatif (piutang/sisa bayar), lalu baru mengkalkulasi ulang data yang baru.

## 2. Analisis Penyebab (Root Cause)
Masalah ini murni disebabkan oleh **Naive Append Bias** yang menjadi kelemahan dasar dari LLM (Large Language Model) saat mengedit dokumen. 

Dalam arsitektur *prompt* Arunaki saat ini (`rules.md` dan `chat-rules.md`), Arunaki belum dibekali kemampuan **Universal Temporal Reasoning (Penalaran Waktu Universal)**. AI tidak otomatis menyadari bahwa dokumen tertentu memiliki sifat *stateful* (berubah secara waktu) dan butuh perlakuan pergeseran (*rollover*), bukan sekadar penambahan teks (*append*).

Mengingat Arunaki adalah *general agent* (sistem universal), kita tidak bisa menyelesaikan masalah ini dengan *hardcode* atau membuatkan SOP khusus hanya untuk satu file rekap penjualan. Solusinya harus menyasar pola pikir inti (Core Rule) dari AI itu sendiri.

## 3. Saran Solusi (Universal Temporal Reasoning)
Untuk membuat Arunaki secara universal lebih cerdas dalam mengelola dokumen apa pun yang terikat waktu, kita harus menambahkan satu blok aturan universal ke dalam **Core Rules** (di `apps/api/src/prompts/rules.md`).

**Draft Aturan Inti yang Disarankan untuk Ditambahkan:**

```markdown
## Document State & Temporal Reasoning (Penalaran Waktu & Dokumen)
Setiap kali diminta untuk memperbarui dokumen, periksa secara holistik apakah dokumen tersebut terikat dengan waktu (misalnya: rekap harian, log harian, laporan bulanan). 

Jika pengguna meminta pembaruan untuk periode waktu yang baru (contoh: pengguna meminta update "hari ini", sedangkan di dalam dokumen masih tertulis tanggal "kemarin" atau bulan lalu):
1. JANGAN secara naif menyisipkan (append) data baru ke tumpukan data lama.
2. Lakukan penalaran mandiri untuk memisahkan: 
   - Mana yang merupakan **Data Periode Berjalan (Dynamic)**: misal transaksi harian, absensi hari ini (harus dibersihkan/direset ke 0).
   - Mana yang merupakan **Data Kumulatif/Saldo (Static)**: misal Piutang, Sisa Deposit, Kas di Laci (harus dipertahankan dan dibawa ke periode baru).
3. Perbarui informasi tanggal/periode di dalam dokumen tersebut menjadi waktu yang baru.
4. Lakukan mekanisme "Rollover" (Buka Lembaran Baru/Buka Buku) yang logis sebelum mengkalkulasi data yang baru masuk.
```

## 4. Dampak & Keuntungan
Dengan hanya menambahkan satu aturan universal di atas ke dalam otak Arunaki:
- Arunaki akan secara otomatis pintar menangani rekap penjualan harian, absensi bulanan, catatan inventaris mingguan, hingga jurnal harian tanpa perlu diajari SOP satu per satu (*zero-shot generalization*).
- Tindakan AI akan langsung bertransformasi dari sekadar *Text Editor* (alat penyunting teks) menjadi *Data Analyst / Bookkeeper* yang memahami logika bergantinya waktu.
