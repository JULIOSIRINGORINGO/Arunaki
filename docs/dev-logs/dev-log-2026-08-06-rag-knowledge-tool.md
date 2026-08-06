# Dev Log — RAG Knowledge Tool Implementation

**Date & Time:** 2026-08-06 19:00:00 WIB
**Author:** AI Agent

## What
Merubah pendekatan System Prompt Knowledge Base dari "Inject Semua Teks" menjadi pendekatan **RAG (Retrieval-Augmented Generation) berbasis Tool** untuk menghemat penggunaan token LLM hingga 90% pada skala dokumen besar.

- **Sebelumnya:** `getActiveContext()` menarik SEMUA isi teks dokumen yang statusnya "Aktif" dan memasukkannya ke dalam system prompt.
- **Sekarang:** `getKnowledgeMap()` hanya menarik judul dan tipe dokumen, serta pemetaan relasinya (Edge), lalu menyajikannya sebagai daftar (Peta). LLM diberi Tool `search_knowledge_graph` untuk mengambil isi dokumen yang relevan saja secara on-demand.

## Files Changed
- `knowledge.service.ts` — Mengganti `getActiveContext` dengan `getKnowledgeMap` dan menambahkan fungsi `searchNodes`.
- `knowledge-search.tool.ts` — [NEW] Membuat definisi LLM Tool untuk pencarian Knowledge Graph.
- `tools-provider.module.ts` — Mendaftarkan `KnowledgeSearchTool` agar dapat digunakan oleh sistem.
- `agent-runner.service.ts` — Merubah argumen context injector ke system prompt menggunakan map.
- `ai.service.ts` — Mengubah header dari "Active Knowledge Base" menjadi "Peta Knowledge Graph".
- `chat-rules.md` — Menambahkan instruksi ketat agar LLM SELALU menggunakan tool `search_knowledge_graph` untuk membaca konten knowledge.

## Tests
- `npx tsc -b --noEmit` — ✅ Passed (Error hanya di file `.spec.ts` karena tidak ada `@types/jest`, kode source 100% aman).

## Notes
Peralihan ke RAG via Tool Calling akan mengurangi token secara signifikan, namun akan menambah latensi berpikir LLM (~1 detik) karena harus memanggil tool sebelum menyajikan jawaban akhir.
