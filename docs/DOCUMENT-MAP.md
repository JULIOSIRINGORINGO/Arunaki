# Document Map — Parse → Map → Act

**Status:** DONE (Phase 62.4)
**Tanggal:** 2026-08-28

Dokumentasi schema `DocumentMap` (Effect Schema) dan alur kerja baca-edit dokumen
di `packages/arunaki-tools`. Tujuan: menghilangkan penyebab utama "mapping meleset"
pada COM tool — pencarian label/fuzzy di sisi COM. Sekarang **baca hanya via parser
deterministik**, dan **edit via COM memakai koordinat dari peta**.

---

## 1. Alur Parse → Map → Act

```
  .docx / .xlsx / .pptx
    │
    ▼  (parser deterministic — TANPA COM)
  READ TOOL  excel_read | word_read | ppt_read
    │
    ▼
  Document Map  (JSON, ref stabil: cell A1, paragraph index, table index, shape id)
    │  ── dimasukkan ke konteks LLM ──
    ▼  (LLM memilih target dari peta, bukan menebak)
  EDIT TOOL  excel_com | word_com | ppt_com   via Windows COM (visible)
    │
    ▼  (verifikasi)
  read tool dipanggil ulang → diff terhadap peta sebelumnya
```

Aturan kunci:
- **READ tidak pernah lewat COM.** Kalau parser gagal mendeteksi sesuatu
  (mis. diagram), tool fallback `read`/`shell` (lewat gate `Permission`) masih ada.
- **EDIT selalu menunjuk ke ref yang ada di peta.** `excel_read` mengembalikan
  `ref` (mis. `A1`), `word_read` mengembalikan `paragraph.index`/`table.index`,
  `ppt_read` mengembalikan `shape.id`/`shape.name`. Tool COM diminta `cell:ref`,
  maka ia harus memakai ref tersebut — bukan pencarian label.
- **Verifikasi = re-parse + diff.** Setelah edit, jalankan read tool lagi dan
  bandingkan nilai yang berubah.

---

## 2. Schema (`packages/arunaki-tools/src/docmap.ts`)

Didefinisikan sebagai Effect Schema (`Schema.Class`), sehingga otomatis jadi
JSON Schema untuk validasi parameter tool.

### `DocMap` (union dari tiga format)

```ts
DocMap = ExcelMap | WordMap | PptMap
```

### ExcelMap

```ts
ExcelMap {
  format: "excel"
  filePath: string          // path absolut hasil path.resolve
  sheets: ExcelSheet[]
}
ExcelSheet {
  name: string              // nama sheet
  range: string | null      // ref range (`!ref`), mis. "A1:C3"
  rowCount: number          // tinggi range
  colCount: number          // lebar range
  cells: ExcelCell[]        // hanya cell yang punya nilai (sparse)
  merges: ExcelMerge[]      // daftar merged range
  formulas: string[]        // ref cell yang berisi formula
}
ExcelCell {
  ref: string               // "A1" — koordinat edit
  value: unknown            // nilai mentah dari parser (number | string | boolean | null)
  text: string              // representasi string untuk LLM
  type: string              // "n" | "s" | "b" | "d" | "e"
  formula: string | null    // teks formula bila ada (cellFormula:true)
}
ExcelMerge {
  start: string             // ref kiri-atas, mis. "A1"
  end: string               // ref kanan-bawah, mis. "B1"
}
```

Target edit (`ExcelWriteCell`):

```ts
ExcelWriteCell {
  ref: string               // dari peta (satu cell)
  value: unknown            // nilai yang akan ditulis via COM
}
```

### WordMap

```ts
WordMap {
  format: "word"
  filePath: string
  paragraphs: WordParagraph[]   // paragraf NON-tabel saja
  tables: WordTable[]           // tabel terpisah
}
WordParagraph {
  index: number              // 1-based, sesuai urutan visual (di luar tabel)
  text: string
}
WordTable {
  index: number              // 1-based
  rows: string[][]           // isi cell tiap baris
}
```

Catatan implementasi: paragraf di dalam sel tabel TIDAK dihitung sebagai
`paragraphs` (diffilter via bounding range tabel) agar index paragraf stabil.

Target edit (`WordTarget`):

```ts
WordTarget {
  kind: "paragraph" | "table"
  index: number              // dari peta
}
```

### PptMap

```ts
PptMap {
  format: "ppt"
  filePath: string
  slides: PptSlide[]
}
PptSlide {
  number: number             // 1-based nomor slide
  shapes: PptShape[]         // hanya shape teks (memiliki <a:t>)
}
PptShape {
  id: number                 // dari cNvPr@id — koordinat edit COM
  name: string               // dari cNvPr@name, mis. "Title 1"
  text: string               // teks pertama pada shape
}
```

---

## 3. READ Tools (parser-based)

| Tool | Sumber | Metode | Keluaran |
|---|---|---|---|
| `excel_read` | `tools/excel-read.ts` | `xlsx.readFile(path, {cellFormula:true, cellNF:true})` + `sheet_to_json` | `ExcelMap` |
| `word_read` | `tools/word-read.ts` | unzip `word/document.xml` via jszip, regex urutan `<w:p>`/`<w:tbl>` | `WordMap` |
| `ppt_read` | `tools/ppt-read.ts` | unzip `ppt/slides/slideN.xml` via jszip, ekstrak `<p:sp>`/`<a:t>` | `PptMap` |

Library: `xlsx@0.18.5`, `jszip@3.10.1` (sudah di root `node_modules`).
Parser murni — tidak membuka aplikasi, tidak mengubah file.

Catatan: `word_read` dan `ppt_read` diuji dengan fixture zip sintetis
(`C:\Users\AMD\AppData\Local\Temp\opencode\make-fixtures.ts`).

---

## 4. EDIT Tools (COM, target dari peta)

Semua tool COM **visible** (aplikasi dibuka di layar), sesuai misi "agent yang
mengendalikan aplikasi desktop", tapi **tidak boleh menebak koordinat**:

| Tool | Aksi | Parameter utama |
|---|---|---|
| `excel_com` | `write_cell` | `cell: {ref, value}` — ref wajib dari peta |
| | `write_range` | `cells: [{ref, value}]` — untuk kolom penuh |
| | `format_cell` | `cell: ref`, `bold/italic/fontSize/bgColor/alignment` |
| | `clone_sheet` | `sourceSheet`, `newSheetName` |
| | `delete_sheet` | `sheetName` |
| `word_com` | `write_text` | `text` — sisip teks di posisi kursor |
| | `write_at_paragraph` | `paragraphIndex` (dari peta), `text` |
| | `find_replace` | `searchText`, `replaceText` |
| | `format` | `paragraph/selection`, properti format |
| `ppt_com` | `add_slide` | layout (title/blank) |
| | `set_shape_text` | `slideNumber`, `shapeId`/`shapeName` (dari peta), `text` |

Aksi baca yang dulu ada di COM tool (`read_cell`, `read_range`,
`read_sheet_names`, `fill_table_column` sebagai baca) **dihapus** — fungsinya
dipenuhi `*_read`.

---

## 5. Registrasi di Engine

`packages/engine/opencode/src/tool/registry.ts`:
- Builtin + `excel_read`, `word_read`, `ppt_read` (baru, parser).
- `excel_com`/`word_com`/`ppt_com` tetap terdaftar (edit-only).

---