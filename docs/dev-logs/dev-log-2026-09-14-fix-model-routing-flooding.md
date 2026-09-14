# Dev Log — Fix Active Model Routing Pool Flooding on App Launch

**Date & Time:** 2026-09-14 16:42:00 WIB  
**Author:** AI Software Engineer  

## What
Memperbaiki bug di mana setiap kali aplikasi dibuka (*app launch*), antrean model routing prioritas (*Active Model Routing Priority*) terisi dengan seluruh 87 model katalog Kenari Cloud alih-alih 5 model terpilih/kurasi.

### Penyebab
Fungsi `refreshModelCatalog()` di `apps/web/src/App.tsx` sebelumnya melakukan fetch seluruh katalog model dari API endpoint (`POST /api/providers/fetch-models`), lalu langsung menulis seluruh 87 model tersebut ke `localStorage.setItem('arunaki_provider_models_${p.id}', models.join(', '))`. Key ini adalah key yang digunakan UI untuk menyimpan antrean model aktif (*routing priority pool*), bukan katalog model.

### Solusi
1. Di `apps/web/src/App.tsx`, perbarui logika `refreshModelCatalog()`:
   - Mempertahankan pilihan model aktif pengguna (`currentList`), hanya menyaring model yang sudah mati / tidak ada lagi di API live.
   - Jika pengguna baru / belum punya konfigurasi, inisialisasi antrean hanya dengan 5 model kurasi default (`DEFAULT_MODELS[p.id]`).
   - Self-healing otomatis: jika antrean di `localStorage` terdeteksi mengalami *flooding* (> 10 model aktif akibat bug sebelumnya), otomatis pangkas kembali ke 5 model kurasi default secara instan.
2. Tambahkan pemeriksaan self-healing sinkron di blok `if (typeof window !== "undefined")` agar pembersihan 87 model langsung berjalan sebelum rendering komponen pengaturan.

## Files Changed
- `apps/web/src/App.tsx` — perbaikan `refreshModelCatalog()` dan self-healing sinkron.
- `WORKFLOW.md` — dokumentasi Phase 92 (DONE).

## Tests
- `npm run build -w apps/web` — ✅ Passed (0 TypeScript error, build selesai dalam 25.41s).

## Notes
- Katalog lengkap seluruh 87 model tetap dapat diakses di form pengaturan (*Available Models*) bila pengguna ingin menambahkan model tertentu ke antrean secara manual.
