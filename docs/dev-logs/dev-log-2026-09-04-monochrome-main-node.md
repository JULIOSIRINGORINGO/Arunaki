# Dev Log — Monochrome Logo Main Node

**Date & Time:** 2026-09-04 17:21:00 WIB
**Author:** AI Agent

## What
Mengubah desain node sentral (Agent Core / Arunaki) pada Canvas Knowledge sesuai instruksi pengguna:
1. Menggunakan Logo Arunaki aslinya (bukan icon lucide).
2. Desain monokrom yang elegan, tanpa bayangan/shadow/glow oranye.
3. Menghapus teks pada node tersebut.
4. Memperbaiki *connection handles* (port) yang sebelumnya hilang karena terpotong oleh clipping mask hexagon, dan merangkumnya menjadi 4 handle statis (Atas, Bawah, Kiri, Kanan) yang selalu terlihat (dots) agar sangat mudah untuk di-klik/drag koneksi.

## Files Changed
- \pps/web/src/components/knowledge/KnowledgeNode.tsx\`n
## Tests
- HMR Vite langsung menampilkan node hexagon monokrom dengan handle yang rapi.
