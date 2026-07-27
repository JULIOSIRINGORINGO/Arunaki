# Employee Framework

Arunaki workspace agent harus bisa bekerja seperti **karyawan digital** — melakukan apa yang bisa dilakukan manusia di dalam workspace.

---

## Philosophy

> Agent bukan "tool yang jawab pertanyaan."
> Agent adalah "karyawan yang kerja mandiri."

Perbedaan:
- **Tool**: User suruh → agent kerja → selesai.
- **Karyawan**: User kasih goal → agent rencanakan → kerja → verifikasi → laporkan → follow-up.

---

## 1. Kemampuan Karyawan Manusia

### 1.1 Membaca & Memahami Dokumen

| Kemampuan Manusia | Status Agent |
|---|---|
| Baca file Excel/CSV | ✅ Bisa |
| Baca file PDF | ✅ Bisa |
| Baca file TXT | ✅ Bisa |
| Baca file Word | ✅ Bisa |
| **Pahami isi dokumen** | ⚠️ Partial — baca tapi belum "pahami" konteks bisnis |
| **Bedakan format & struktur** | ⚠️ Partial — tahu file type tapi belum pahami business logic |
| **Ekstrak data penting dari dokumen panjang** | ⚠️ Partial — baca semua tapi belum smart filtering |
| **Pahami dokumen yang tidak standar** | ❌ Belum — dokumen aneh = gagal |

**Gap: Agent perlu "business understanding" — tahu apa yang penting di dokumen bisnis, bukan sekadar baca teks.**

---

### 1.2 Bekerja dengan Data

| Kemampuan Manusia | Status Agent |
|---|---|
| Hitung total/subtotal | ✅ Bisa (calculate tool) |
| Hitung persentase | ✅ Bisa |
| Buat rata-rata | ✅ Bisa |
| **Bandingkan data antar periode** | ⚠️ Partial — bisa kalau data ada, belum otomatis |
| **Cari tren (naik/turun)** | ⚠️ Partial — bisa kalau diminta, belum proaktif |
| **Deteksi anomali** | ❌ Belum — belum otomatis deteksi data janggal |
| **Forecast/prediksi** | ❌ Belum |
| **Cross-reference otomatis** | ⚠️ Partial — bisa kalau diminta, belum otomatis |

**Gap: Agent perlu "data thinking" — otomatis cari tren, anomali, dan insight tanpa diminta.**

---

### 1.3 Membuat Output

| Kemampuan Manusia | Status Agent |
|---|---|
| Buat laporan teks | ✅ Bisa |
| Buat tabel rapi | ✅ Bisa |
| Buat file Excel | ✅ Bisa (generate_export) |
| Buat file CSV | ✅ Bisa |
| Buat file PDF | ✅ Bisa |
| **Buat laporan dengan format perusahaan** | ⚠️ Partial — bisa kalau ada knowledge base |
| **Buat presentasi** | ❌ Belum |
| **Buat email draft** | ❌ Belum |
- **Buat memo/internal message** | ❌ Belum |

**Gap: Agent perlu "professional output" — output yang siap pakai, bukan sekadar data dump.**

---

### 1.4 Komunikasi

| Kemampuan Manusia | Status Agent |
|---|---|
| Jawab pertanyaan | ✅ Bisa |
| Jelaskan sesuatu | ✅ Bisa |
| **Tanya balik untuk klarifikasi** | ⚠️ Partial — bisa tapi belum proaktif |
| **Laporkan progress** | ⚠️ Partial — SSE stream tapi belum detailed |
| **Kirim update berkala** | ❌ Belum |
| **Negosiasi/argumentasi** | ❌ Belum |
| **Bahasa Indonesia natural** | ⚠️ Partial — kadang kaku |

**Gap: Agent perlu "communication skills" —komunikasi yang proaktif dan natural.**

---

### 1.5 Manajemen Waktu & Prioritas

| Kemampuan Manusia | Status Agent |
|---|---|
| Kerja sesuai urutan | ✅ Bisa (sequential) |
| **Tahu mana yang penting duluan** | ❌ Belum |
| **Deadline awareness** | ❌ Belum |
| **Multi-task** | ❌ Belum |
| **Prioritize otomatis** | ❌ Belum |
| **Reminder/follow-up** | ❌ Belum |

**Gap: Agent perlu "time management" — tahu mana yang urgent, mana yang bisa nanti.**

---

### 1.6 Kolaborasi

| Kemampuan Manusia | Status Agent |
|---|---|
| Kerja sendiri | ✅ Bisa |
| **Kerja dengan team** | ❌ Belum (single agent) |
| **Delegate tugas** | ❌ Belum (no sub-agent) |
| **Handoff ke orang lain** | ❌ Belum |
| **Shared workspace** | ❌ Belum (single user) |

**Gap: Agent perlu "collaboration" — bisa kerja dengan agent lain atau human.**

---

### 1.7 Pembelajaran

| Kemampuan Manusia | Status Agent |
|---|---|
| Ingat apa yang sudah dikerjakan | ✅ Bisa (memory) |
| Simpan workflow yang berhasil | ✅ Bisa (skills) |
| **Belajar dari kesalahan** | ❌ Belum |
| **Improve dari feedback** | ❌ Belum |
| **Adapt ke gaya kerja user** | ⚠️ Partial — preferences tapi belum adaptive |
| **Transfer knowledge ke sesi baru** | ⚠️ Partial — memory tapi belum smart recall |

**Gap: Agent perlu "learning ability" — benar-benar improve dari setiap tugas.**

---

### 1.8 Pengambilan Keputusan

| Kemampuan Manusia | Status Agent |
|---|---|
| Pilih langkah yang tepat | ⚠️ Partial — mengikuti flow |
| **Buat keputusan saat data ambigu** | ❌ Belum |
| **Risk assessment** | ❌ Belum |
| **Trade-off analysis** | ❌ Belum |
| **Confidence assessment** | ❌ Belum — tidak pernah bilang "saya tidak yakin" |

**Gap: Agent perlu "decision making" — bisa putuskan sendiri dengan confidence.**

---

## 2. Gap Analysis: Manusia vs Agent

| Kategori | Kemampuan | Gap Level |
|---|---|---|
| Membaca | Pahami konteks bisnis dokumen | 🟡 Medium |
| Data | Otomatis cari tren & anomali | 🟡 Medium |
| Output | Professional output siap pakai | 🟡 Medium |
| Komunikasi | Proaktif & natural | 🟡 Medium |
| Manajemen | Prioritas & deadline | 🔴 High |
| Kolaborasi | Delegate & multi-agent | 🔴 High |
| Pembelajaran | Belajar dari kesalahan | 🟡 Medium |
| Keputusan |自主 decision making | 🔴 High |

---

## 3. Prioritas Implementasi

### Immediate (Phase 4-5)
1. **Smart data analysis** — otomatis cari tren, anomali, insight
2. **Proactive communication** — laporkan progress tanpa diminta
3. **Confidence assessment** — bilang "saya tidak yakin" kalau perlu

### Medium-term (Phase 6-7)
4. **Priority awareness** — tahu mana yang penting duluan
5. **Error learning** — kalau salah, catat dan tidak ulangi
6. **Adaptive behavior** — ikut gaya kerja user

### Long-term (Phase 8+)
7. **Sub-agent delegation** — delegate tugas ke agent lain
8. **Multi-workspace** — kerja di beberapa workspace sekaligus
9. **Proactive tasks** — kerja tanpa diminta (scheduled analysis)

---

## 4. Implementation Notes

### Yang Perlu Ditambah ke System Prompt

```
Kamu bukan hanya tool yang menjawab pertanyaan.
Kamu adalah karyawan digital yang bekerja di workspace ini.

Seperti karyawan manusia, kamu harus:
1. Pahami konteks bisnis, bukan sekadar baca teks
2. Kerja mandiri tanpa selalu ditanya
3. Laporkan progress secara proaktif
4. Bilang "saya tidak yakin" kalau data tidak cukup
5. Belajar dari setiap tugas
6. Utamakan yang penting duluan
7. Verifikasi hasil kerja sebelum laporkan
```

### Yang Perlu Ditambah ke Agent Loop

1. **Planning phase** — sebelum kerja, buat rencana
2. **Progress reporting** — laporkan setiap milestone
3. **Self-verification** — cek hasil sendiri sebelum final
4. **Error learning** — catat kesalahan, avoid di masa depan
5. **Confidence scoring** — setiap jawaban punya confidence level

---

## 5. Success Criteria

Agent dianggap "bisa jadi karyawan" kalau:

- [ ] Baca dokumen dan pahami konteks bisnisnya
- [ ] Otomatis cari tren, anomali, dan insight
- [ ] Buat output yang siap pakai (bukan data dump)
- [ ] Komunikasi proaktif (lapor progress, tanya klarifikasi)
- [ ] Tahu mana yang penting duluan
- [ ] Bilang "saya tidak yakin" kalau perlu
- [ ] Belajar dari kesalahan
- [ ] Verifikasi hasil kerja sendiri
