# Dev Log — Chat Input File Upload Button & Multi-File Attachment

**Date & Time:** 2026-09-26 11:39:00 WIB  
**Author:** AI Agent (Antigravity)

## What
Menambahkan tombol upload/lampiran file (**Attach / Lampirkan**) persis di samping pemilih tingkat penalaran (**Reasoning Effort / `High ⌄`**) pada bar bawah kotak input percakapan (`ChatInputBox.tsx`), serta memperluas dukungan lampiran ke semua jenis berkas dokumen:
1. **Tombol Upload Berkas**:
   - Menambahkan tombol pil monokrom dengan ikon klip kertas (`Paperclip`) bertuliskan `"Attach"` / `"Lampirkan"` di samping badge reasoning level.
   - Terhubung dengan dialog pemilih berkas sistem (`<input type="file" multiple ... />`), mendukung gambar maupun berbagai format berkas dokumen (.xlsx, .docx, .pdf, .txt, .csv, dll.).
2. **Drag & Drop dan Clipboard Paste**:
   - Mendukung drag & drop berkas langsung ke area input box.
   - Mendukung paste berkas/gambar dari clipboard.
3. **Chip Preview Berkas Interaktif**:
   - Berkas gambar menampilkan thumbnail dengan fitur klik untuk memperbesar (lightbox preview).
   - Berkas dokumen menampilkan ikon tipe berkas (`getFileIcon`), nama berkas, ukuran format (misal `24 KB`), dan tombol hapus chip (`✕`).
4. **Tampilan Balon Percakapan**:
   - Pada `ChatMessageBubble.tsx`, lampiran dokumen non-gambar yang dikirim pengguna kini dirender rapi sebagai badge chip dokumen.
5. **Lokalisasi (i18n)**:
   - Menambahkan terjemahan `attachFile` dan `attach` pada `i18n.ts`.

## Files Changed
- `apps/web/src/components/workstation/chat/ChatInputBox.tsx` — Tombol lampiran berkas di samping reasoning level, handler file input, drag & drop, paste, dan rendering preview chip dokumen.
- `apps/web/src/components/workstation/chat/ChatMessageBubble.tsx` — Rendering chip berkas dokumen yang dilampirkan pengguna dalam balon pesan chat.
- `apps/web/src/lib/i18n.ts` — Penambahan string lokalisasi `attachFile` dan `attach`.

## Tests
- `npm run build -w apps/web`: ✅ 0 errors (built in 24.46s).
