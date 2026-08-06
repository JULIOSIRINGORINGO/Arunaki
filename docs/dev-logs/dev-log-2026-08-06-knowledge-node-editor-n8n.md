# Dev Log — n8n-style Knowledge Node Editor

**Date & Time:** 2026-08-06 18:49:00 WIB
**Author:** AI Agent

## What
Membangun ulang Knowledge Page dari list biasa menjadi **Visual Node Editor** bergaya n8n menggunakan React Flow.
- User sekarang bisa melihat "Knowledge Graph" secara visual
- Canvas bisa di zoom, pan, dan ada mini-map
- Ada Node "Arunaki AI" di tengah sebagai Core AI
- Dokumen (katalog, rules, SOP) direpresentasikan sebagai node yang bisa di drag & drop
- User menghubungkan garis (edge) dari node dokumen ke node AI
- AI Assistant context sudah diupgrade menjadi graph-aware: AI akan membaca node + relasi garis untuk konteks jawaban.

## Files Changed
- `schema.prisma` — tambah field posisi X/Y dan tabel `KnowledgeEdge`
- `knowledge.repository.ts`, `knowledge.service.ts`, `knowledge.controller.ts` — Edge CRUD dan position updater, graph-aware context
- `KnowledgePage.tsx` — Full redesign pakai React Flow
- `KnowledgeNode.tsx`, `KnowledgeNodePanel.tsx`, `KnowledgeToolbar.tsx` — UI komponen baru untuk canvas

## Tests
- `npx tsc -b --noEmit` — ✅ passed (TypeScript checker di Web dan API)

## Notes
Database sempat drop FTS table karena constraint SQLite, jadi dijalankan pakai `prisma migrate reset` dan `prisma db push`. Tidak ada data hilang di production, hanya safe dev re-sync. Node Editor siap diuji langsung di UI.
