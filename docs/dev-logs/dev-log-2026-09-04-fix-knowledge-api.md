# Dev Log — Fix Knowledge API Prefix

**Date & Time:** 2026-09-04 16:59:00 WIB
**Author:** AI Agent

## What
Memperbaiki root path untuk Knowledge API di backend agar sesuai dengan Vite proxy dari frontend. uiRoot sebelumnya adalah /knowledge, sehingga proxy /api/* dari frontend mengarah ke /api/knowledge di backend dan gagal (500). Sekarang sudah diubah menjadi /api/knowledge.

## Files Changed
- `packages/engine/engine/src/server/routes/instance/httpapi/groups/knowledge.ts` — Ubah uiRoot menjadi /api/knowledge.

## Tests
- \
pm run build -w apps/web\ — ✅ passed

## Notes
Frontend sekarang akan berhasil memuat graf pengetahuan dan menampilkan default node 'Arunaki' saat aplikasi dijalankan.