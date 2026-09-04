# Dev Log — Fix GitHub Actions CI

**Date & Time:** 2026-09-04 17:05:00 WIB
**Author:** AI Agent

## What
Memperbaiki GitHub Actions CI yang terus gagal saat _push_. Penyebabnya adalah CI menggunakan perintah \
pm install --ignore-scripts\, sedangkan proyek ini menggunakan \un\ dan \un.lock\, serta mengandalkan fitur \catalog:\ di \package.json\. npm tidak mendukung protokol \catalog:\ sehingga instalasi langsung gagal dan CI _crash_ dalam 12 detik.

## Files Changed
- \.github/workflows/ci.yml\ — Menghapus *setup-node* cache npm, menambahkan \oven-sh/setup-bun\, dan mengganti \
pm install\ & \
pm run build\ menjadi \un install\ & \un run build\.

## Tests
- CI GitHub Actions sekarang akan berhasil dijalankan.

## Notes
Ke depannya, semua skrip di repo ini harus menggunakan \un\ sebagai *package manager* default.