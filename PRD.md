# PRD.md - Product Requirements Document (PRD)

**Version:** 1.0  
**Status:** Draft  
**Last Updated:** 2026

---

## 1. Product Overview

Arunaki adalah **Autonomous Workspace AI** yang membantu pengguna menyelesaikan pekerjaan berbasis dokumen melalui kombinasi **AI Assistant** dan **Workspace Agent**.

### 1.1 Dua Mode Utama

**AI Assistant**
- Untuk percakapan umum tanpa ketergantungan pada Workspace
- Mode default ketika aplikasi dibuka
- Dapat menggunakan Domain Knowledge

**Workspace Agent**
- Untuk pekerjaan yang membutuhkan konteks Workspace
- Hanya aktif ketika pengguna berada di dalam Workspace
- Dapat menggunakan Tools dan Planner

### 1.2 Definisi Workspace

Workspace adalah ruang kerja terisolasi yang berisi kumpulan:
- Dokumen digital (Word, PDF, Excel, PowerPoint, CSV, TXT, Markdown, JSON, XML, YAML, HTML, gambar, email)
- Folder dan subfolder
- Metadata dari berbagai sumber data
- Konteks kerja yang spesifik

Workspace dianalisis secara menyeluruh oleh AI sebelum pengguna mulai memberikan instruksi.

---

## 2. Product Goals

### 2.1 Tujuan Utama

1. **Menjadi AI Assistant terpercaya** untuk penggunaan sehari-hari (Chat Mode)
2. **Menjadi Workspace Agent yang mandiri** untuk pekerjaan berbasis dokumen
3. **Memahami Workspace secara holistik** sebelum menerima instruksi
4. **Menyelesaikan pekerjaan secara bertahap** menggunakan Planner dan Tools
5. **Menghasilkan output berkualitas** yang siap digunakan oleh pengguna
6. **Meminimalkan intervensi manual** dengan automasi cerdas

### 2.2 Value Proposition

- **Efisiensi**: Menghemat waktu pengguna dalam mengelola dokumen kompleks
- **Akurasi**: Mengurangi kesalahan manusia melalui analisis AI
- **Skalabilitas**: Menangani Workspace dengan ratusan hingga ribuan file
- **Keamanan**: Semua data tetap dalam Workspace pengguna
- **Transparansi**: Setiap keputusan dapat dijelaskan dan diverifikasi

---

## 3. Target Users

### 3.1 Individual Users

- **Freelancer**: Mengelola proyek, dokumen klien, proposal
- **Mahasiswa**: Menganalisis research, membuat laporan, organizing data
- **Konsultan**: Membuat laporan klien, analisis data, dokumentasi
- **Peneliti**: Mengelola dataset, menganalisis dokumen, membuat publikasi

### 3.2 Business Users

| Departemen | Use Cases |
|-----------|-----------|
| **Garment/Manufacturing** | Costing, QC reports, production planning, inventory |
| **Finance** | Financial reporting, budget analysis, reconciliation |
| **HR** | Employee records, salary processing, performance reviews |
| **Marketing** | Campaign analysis, content management, reporting |
| **Legal** | Contract management, document review, compliance |
| **Accounting** | Financial statements, audits, tax preparation |
| **Procurement** | Vendor management, purchase orders, RFQ analysis |

---

## 4. Application Navigation

### 4.1 Struktur Sidebar Utama

```
┌─────────────────────────────────┐
│         ARUNAKI                 │
├─────────────────────────────────┤
│ ✨ Chat Baru                    │
│ 📁 Workspace                    │
│ 🕘 Riwayat Chat                │
│ ⚙️  Settings                    │
└─────────────────────────────────┘
```

### 4.2 Prinsip Navigasi

- Sidebar selalu tetap visible di semua halaman
- Setiap menu memiliki context masing-masing
- Transisi antar mode harus seamless
- Back button mempertahankan state sebelumnya

---

## 5. Application Modes

### 5.1 Chat Mode

**Kapan digunakan:**
- Percakapan umum
- Brainstorming dan ide
- Menulis dan editing
- Translasi dan penjelasan
- Coding ringan dan technical support
- Konsultasi Domain Knowledge

**Karakteristik:**
- Workspace tidak terlibat
- Menggunakan Model Knowledge + Domain Knowledge
- Riwayat chat terpisah dari Workspace
- Response cepat dan personal

**Contoh penggunaan:**
```
User: "Bagaimana cara menulis CV yang baik?"
AI Assistant: [Memberikan konsultasi umum]

User: "Terjemahkan paragraph ini ke Inggris"
AI Assistant: [Menerjemahkan teks yang diberikan]
```

### 5.2 Workspace Mode

**Kapan digunakan:**
- Bekerja dengan dokumen
- Membuat laporan dan analisis
- Menganalisis data
- Menggunakan Planner dan Tools
- Menghasilkan Artifacts
- Memproses batch dokumen

**Karakteristik:**
- Workspace adalah konteks utama
- AI Agent memahami seluruh Workspace
- Dapat membaca dan memodifikasi dokumen
- Menggunakan Tools khusus
- Hasil disimpan di Workspace

**Contoh penggunaan:**
```
User: "Buatkan saya laporan ringkas dari semua file di folder ini"
Workspace Agent:
1. Scan semua file di folder
2. Analisis konten
3. Ekstrak informasi penting
4. Generate laporan
5. Simpan di Workspace

Output: Report.md (siap digunakan)
```

---

## 6. User Flow

### 6.1 First Launch Flow

```
┌──────────────────────┐
│  Open Arunaki        │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│  Chat Baru           │
└──────────┬───────────┘
           ↓
┌──────────────────────┐
│  AI Assistant Ready  │
│  (Chat Mode Active)  │
└──────────────────────┘
```

### 6.2 Chat Flow (AI Assistant Mode)

```
┌──────────────┐
│ User Input   │
└──────┬───────┘
       ↓
┌──────────────────────────┐
│ Parse Intent             │
│ (Question/Action type)   │
└──────┬───────────────────┘
       ↓
┌──────────────────────────┐
│ Load Context             │
│ - Model Knowledge        │
│ - Domain Knowledge       │
│ (jika tersedia)          │
└──────┬───────────────────┘
       ↓
┌──────────────────────────┐
│ Generate Response        │
└──────┬───────────────────┘
       ↓
┌──────────────────────────┐
│ Display Result           │
│ Save to History          │
└──────────────────────────┘
```

### 6.3 Workspace Access Flow

```
┌──────────────┐
│ Click         │
│ Workspace    │
└──────┬───────┘
       ↓
┌──────────────────────────────┐
│ Apakah Workspace sudah ada?  │
└─────────────┬────────────────┘
              │
       ┌──────┴──────┐
       ↓             ↓
    [YA]          [TIDAK]
       ↓             ↓
    Buka          Buat
    Workspace     Workspace
    Existing      Baru
       │             │
       └──────┬──────┘
              ↓
       ┌─────────────┐
       │ Workspace   │
       │ Mode Active │
       └─────────────┘
```

### 6.4 Create Workspace Flow

```
┌──────────────────────┐
│ Input Workspace Name │
└──────┬───────────────┘
       ↓
┌──────────────────────────────────┐
│ Select Source(s)                 │
│ - Folder Lokal                   │
│ - Upload File                    │
│ - Google Drive                   │
│ - OneDrive                       │
│ - Website (future)               │
│ - SharePoint (future)            │
└──────┬───────────────────────────┘
       ↓
┌──────────────────────┐
│ Connect & Validate   │
└──────┬───────────────┘
       ↓
┌──────────────────────────────┐
│ Create Workspace             │
│ (Initialize process starts)  │
└──────┬───────────────────────┘
       ↓
┌──────────────────────┐
│ Workspace Ready      │
└──────────────────────┘
```

### 6.5 Workspace Initialization (Automatic)

**Tahapan yang terjadi otomatis ketika Workspace baru dibuat:**

```
┌─────────────────────────────────────────┐
│ 1. SCANNING                             │
│    └─ Membaca struktur folder           │
│    └─ Mengidentifikasi file types       │
│    └─ Menghitung total files            │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ 2. FILE READING & INDEXING              │
│    └─ Membaca konten setiap file        │
│    └─ Extract text dari binary (OCR)    │
│    └─ Index untuk search                │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ 3. METADATA EXTRACTION                  │
│    └─ File size, type, creation date    │
│    └─ Encoding, language detection      │
│    └─ Keywords & tags                   │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ 4. RELATIONSHIP MAPPING                 │
│    └─ Link antar dokumen                │
│    └─ Reference tracking                │
│    └─ Data flow analysis                │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ 5. CONTEXT ANALYSIS                     │
│    └─ Identifikasi topik utama          │
│    └─ Klasifikasi dokumen               │
│    └─ Detect data patterns              │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ 6. WORKSPACE PROFILE GENERATION         │
│    └─ Summary Workspace                 │
│    └─ Insights & recommendations        │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ ✓ WORKSPACE READY                       │
│   AI Agent siap bekerja                 │
└─────────────────────────────────────────┘
```

**Estimasi waktu:**
- Small Workspace (< 50 files): ~5-10 detik
- Medium Workspace (50-200 files): ~20-30 detik
- Large Workspace (200+ files): ~1-5 menit

### 6.6 Initial Workspace Response

Setelah proses initialization selesai, AI Agent memberikan ringkasan otomatis:

```
┌─────────────────────────────────────────┐
│ 📊 WORKSPACE SUMMARY                    │
├─────────────────────────────────────────┤
│                                         │
│ ✓ Workspace berhasil dibuat             │
│                                         │
│ 📈 Statistik File:                      │
│   • Total Files: 124                    │
│   • Excel: 18                           │
│   • PDF: 32                             │
│   • Word: 15                            │
│   • Lainnya: 59                         │
│                                         │
│ 🏢 Kategori Dominan:                    │
│   • Garment Production                  │
│   • Quality Control Reports             │
│   • Inventory Management                │
│                                         │
│ 💡 Insights:                            │
│   • Data spanning: Jan 2024 - Present   │
│   • Primary language: Indonesian        │
│   • Key stakeholders: Prod, QC, Inv    │
│                                         │
│ 🎯 Recommended Actions:                 │
│   • Generate Production Report          │
│   • Create QC Dashboard                 │
│   • Inventory Analysis                  │
│                                         │
│ ✨ Saya siap membantu. Apa yang ingin   │
│    Anda lakukan dengan Workspace ini?   │
│                                         │
└─────────────────────────────────────────┘
```

### 6.7 Workspace Interaction - Task Execution Flow

```
┌──────────────────────────┐
│ User Goal                │
│ (e.g., "Buatkan laporan  │
│  dari semua file Excel") │
└──────┬───────────────────┘
       ↓
┌──────────────────────────────────────┐
│ PLANNER                              │
│ ├─ Parse Goal                        │
│ ├─ Identify Dependencies             │
│ ├─ Create Task List                  │
│ └─ Estimate Resources                │
└──────┬───────────────────────────────┘
       ↓
┌──────────────────────────────────────┐
│ TASK EXECUTION (Iterative)           │
│                                      │
│ Task 1: Locate Files                 │
│ └─ Search Workspace: *.xlsx          │
│                                      │
│ Task 2: Read & Parse                 │
│ └─ Use Tools: Spreadsheet Reader     │
│                                      │
│ Task 3: Analyze Data                 │
│ └─ Extract metrics, trends           │
│                                      │
│ Task 4: Generate Content             │
│ └─ Create markdown report            │
│                                      │
│ Task 5: Format Output                │
│ └─ Use Tools: Report Generator       │
└──────┬───────────────────────────────┘
       ↓
┌──────────────────────────────────────┐
│ VERIFICATION                         │
│ ├─ Check output quality              │
│ ├─ Validate against source           │
│ ├─ Check completeness                │
│ └─ Ensure format correctness         │
└──────┬───────────────────────────────┘
       ↓
┌──────────────────────────────────────┐
│ RESULT                               │
│ ├─ Save Artifact to Workspace        │
│ ├─ Display Preview                   │
│ ├─ Show Execution Summary            │
│ └─ Prompt for Feedback               │
└──────────────────────────────────────┘
```

### 6.8 Exit Workspace

```
┌──────────────────────────────┐
│ Click "← Arunaki"            │
└──────┬─────────────────────────┘
       ↓
┌──────────────────────────────┐
│ Workspace Context Saved      │
│ (untuk sesi berikutnya)      │
└──────┬─────────────────────────┘
       ↓
┌──────────────────────────────┐
│ Return to Chat Mode          │
│ (Chat Baru siap digunakan)   │
└──────────────────────────────┘
```

---

## 7. Workspace Architecture

### 7.1 Komponen Utama Workspace

Setiap Workspace memiliki struktur:

```
Workspace
├── Source(s)
│   ├── File 1
│   ├── File 2
│   └── Folder
│       └── File 3
├── Chat History
│   ├── Message 1
│   ├── Message 2
│   └── Message N
├── Artifacts
│   ├── Report_20260723.md
│   ├── Dashboard.html
│   └── Summary.pdf
├── Activity Log
│   ├── Timestamp: Scanned files
│   ├── Timestamp: Generated report
│   └── Timestamp: Created artifact
└── Context
    ├── Profile
    ├── Metadata Index
    └── Relationship Map
```

### 7.2 Workspace Isolation

- **Independen**: Setiap Workspace adalah konteks terpisah
- **No Cross-Reference**: Workspace A tidak dapat mengakses Workspace B tanpa izin
- **Unique Context**: Setiap Workspace memiliki cache, index, dan history sendiri
- **User Control**: Pengguna dapat menghapus, duplikat, atau share Workspace

### 7.3 Workspace Persistence

- Workspace state disimpan di local storage atau cloud
- Chat history tersimpan untuk future reference
- Artifacts dapat di-download atau di-share
- Activity log memberi auditability

---

## 8. Source Management

### 8.1 Tipe Source yang Didukung

| Source Type | Format | Keterangan |
|-----------|--------|-----------|
| **Folder Lokal** | Multiple | Scan seluruh folder & subfolder |
| **Single File Upload** | .docx, .xlsx, .pdf, .pptx, .csv, .txt, .md, .json, .xml, .html | Upload 1 file |
| **Batch Upload** | Multiple | Upload banyak file sekaligus |
| **Google Drive** | All | Connect & sync (future: real-time) |
| **OneDrive** | All | Connect & sync (future: real-time) |
| **Website** | HTML, PDF | Scrape & convert to markdown (future) |
| **SharePoint** | All | Enterprise integration (future) |

### 8.2 Source Connection Process

```
┌──────────────────────┐
│ Select Source Type   │
└──────┬───────────────┘
       ↓
┌──────────────────────┐
│ Authenticate        │
│ (jika perlu)        │
└──────┬───────────────┘
       ↓
┌──────────────────────┐
│ Validate Connection  │
└──────┬───────────────┘
       ↓
┌──────────────────────┐
│ Add to Workspace     │
└──────┬───────────────┘
       ↓
┌──────────────────────┐
│ Start Scanning       │
└──────────────────────┘
```

### 8.3 File Format Support Details

**Text-based**
- .txt, .md, .csv, .tsv: Langsung dibaca
- .json, .xml, .yaml, .html: Parse struktur + extract text

**Office Documents**
- .docx: Extract text, maintain formatting info
- .xlsx: Parse sheets, extract data, preserve formulas
- .pptx: Extract slides, convert to readable format

**PDF**
- Searchable PDF: Extract text
- Scanned PDF: Apply OCR
- Image-based: Convert to text

**Images**
- .jpg, .png, .webp: Analyze dengan CV jika perlu OCR
- Metadata: Extract EXIF jika ada

**Archive**
- .zip, .rar: Extract & process contents

---

## 9. Workspace Profile

### 9.1 Komponen Workspace Profile

Setelah proses initialization selesai, Workspace Profile dibuat dengan informasi:

```json
{
  "workspace_id": "ws_12345",
  "name": "Garment Production Q3",
  "created_at": "2026-07-23T10:00:00Z",
  "sources": [
    {
      "type": "folder",
      "path": "/production/Q3",
      "file_count": 124
    }
  ],
  "file_statistics": {
    "total": 124,
    "by_type": {
      "xlsx": 18,
      "pdf": 32,
      "docx": 15,
      "csv": 12,
      "other": 47
    },
    "total_size_mb": 245,
    "oldest_file": "2024-01-15",
    "newest_file": "2026-07-22"
  },
  "content_analysis": {
    "primary_language": "Indonesian",
    "secondary_languages": ["English"],
    "topics": [
      "Production Planning",
      "Quality Control",
      "Inventory Management"
    ],
    "document_types": [
      "Report",
      "Data Sheet",
      "Process Document",
      "Meeting Notes"
    ]
  },
  "key_entities": {
    "departments": ["Production", "Quality", "Inventory"],
    "time_range": "2024-01-15 to 2026-07-22",
    "data_sources": ["Production System", "Quality Control DB"]
  },
  "relationships": {
    "file_links": 45,
    "cross_references": 23,
    "data_dependencies": 12
  },
  "recommendations": [
    "Generate Production Report",
    "Create QC Dashboard",
    "Inventory Analysis",
    "Trend Visualization"
  ]
}
```

### 9.2 Profile Usage

Workspace Profile digunakan oleh AI Agent untuk:
- **Context awareness**: Memahami tujuan Workspace
- **Smart suggestions**: Recommend relevant actions
- **Query optimization**: Faster search & retrieval
- **Task planning**: Better task decomposition
- **Tool selection**: Choose appropriate tools

---

## 10. AI Assistant (Chat Mode)

### 10.1 Capabilities

AI Assistant dapat melakukan:

| Capability | Contoh |
|-----------|--------|
| **Q&A** | Menjawab pertanyaan umum |
| **Writing** | Menulis email, artikel, laporan |
| **Brainstorming** | Generate ide, strategi |
| **Translation** | Menerjemahkan teks |
| **Coding (Light)** | Script sederhana, debugging |
| **Analysis** | Analisis teks yang diberikan |
| **Domain Knowledge** | Menggunakan pengetahuan khusus |

### 10.2 Domain Knowledge Integration

AI Assistant dapat menggunakan Domain Knowledge yang telah dikonfigurasi:

```
User Input
    ↓
Load Context
    ├─ Model Knowledge (selalu)
    ├─ Domain Knowledge (jika enabled)
    └─ Recent Chat History
    ↓
Generate Response
    ↓
Output + Citation (jika pakai Domain Knowledge)
```

### 10.3 Limitations

- Tidak membaca Workspace
- Tidak membuat file
- Tidak menjalankan tools kompleks
- Response berbasis pengetahuan yang ada

---

## 11. Workspace Agent

### 11.1 Capabilities

Workspace Agent hanya aktif di Workspace dan dapat:

✅ **Understanding**
- Memahami seluruh Workspace secara holistik
- Membaca semua file dalam Workspace
- Menghubungkan informasi dari multiple files
- Detect patterns dan relationships

✅ **Planning**
- Create detailed task plans (Planner)
- Break down complex goals into manageable tasks
- Estimate effort dan resources
- Handle dependencies antar task

✅ **Execution**
- Menggunakan Tools yang relevan
- Read, parse, dan analyze data
- Create new documents
- Modify existing files (dengan konfirmasi)
- Generate reports, dashboards, summaries

✅ **Verification**
- Validate results against source data
- Check quality dan completeness
- Error detection dan correction
- User confirmation untuk hasil penting

✅ **Artifact Generation**
- Create outputs (reports, dashboards, summaries)
- Save artifacts ke Workspace
- Format output sesuai kebutuhan
- Provide usage instructions

### 11.2 Operational Flow

```
User Goal (Workspace Mode)
    ↓
Load Workspace Context
    ├─ Read Workspace Profile
    ├─ Load File Index
    └─ Prepare Tools
    ↓
Execute Planner
    ├─ Understand goal
    ├─ Break into tasks
    └─ Create execution plan
    ↓
Execute Tasks (Iterative)
    ├─ Task 1: Source → Analysis
    ├─ Task 2: Data Processing
    ├─ Task 3: Content Generation
    └─ Task N: Output Formatting
    ↓
Verify Results
    ├─ Quality check
    ├─ Completeness check
    └─ Accuracy validation
    ↓
Generate Artifact
    ├─ Format output
    ├─ Create preview
    └─ Save to Workspace
    ↓
Present to User
    ├─ Show result
    ├─ Execution summary
    └─ Feedback prompt
```

---

## 12. Planner

### 12.1 Fungsi Planner

Planner adalah komponen yang memecah Goal kompleks menjadi Task-task yang manageable.

### 12.2 Planner Algorithm

```
Input: Goal (dari user)

├─ STEP 1: GOAL PARSING
│  ├─ Identify main objective
│  ├─ Extract sub-goals
│  └─ Identify constraints
│
├─ STEP 2: DEPENDENCY ANALYSIS
│  ├─ What data is needed?
│  ├─ What order should tasks run?
│  └─ What are blockers?
│
├─ STEP 3: TASK DECOMPOSITION
│  ├─ Break into atomic tasks
│  ├─ Assign task type
│  └─ Estimate effort
│
├─ STEP 4: TOOL ASSIGNMENT
│  ├─ Which tools are needed?
│  ├─ In what order?
│  └─ Any alternatives?
│
├─ STEP 5: PLAN OPTIMIZATION
│  ├─ Reduce dependencies
│  ├─ Parallel execution?
│  └─ Resource efficiency
│
└─ Output: Task List (executable)
```

### 12.3 Contoh Planner Output

**User Goal:**
```
"Buatkan laporan penjualan Q2 dengan breakdown per region"
```

**Planner Output:**
```
Task List:
├─ Task 1: Search files matching "penjualan Q2"
│  └─ Expected output: 12 files found
│
├─ Task 2: Read & parse sales data
│  └─ Expected output: Structured data table
│
├─ Task 3: Group by region
│  └─ Expected output: Regional data breakdown
│
├─ Task 4: Calculate metrics (total, % growth)
│  └─ Expected output: Summary statistics
│
├─ Task 5: Create visualizations
│  └─ Expected output: Charts & graphs
│
└─ Task 6: Generate report document
   └─ Expected output: Report.md ready to use
```

---

## 13. Tool System

### 13.1 Available Tools

**Data & Information Tools**

| Tool | Purpose | Contoh Penggunaan |
|------|---------|------------------|
| **Search** | Find files/content | Cari file yang berisi "penjualan" |
| **PDF Reader** | Extract dari PDF | Read report.pdf |
| **OCR** | Convert image→text | Scan document.jpg |
| **Spreadsheet Reader** | Parse Excel/CSV | Read sales_data.xlsx |

**Processing Tools**

| Tool | Purpose | Contoh Penggunaan |
|------|---------|------------------|
| **Data Comparator** | Compare datasets | Compare Q1 vs Q2 sales |
| **Text Parser** | Extract structured data | Extract invoice numbers |
| **Aggregator** | Combine multiple files | Merge all monthly reports |

**Generation Tools**

| Tool | Purpose | Contoh Penggunaan |
|------|---------|------------------|
| **Chart Generator** | Create visualizations | Generate sales chart |
| **Report Generator** | Create formatted reports | Create executive summary |
| **Dashboard Creator** | Create interactive dashboards | Create KPI dashboard |

**Output Tools**

| Tool | Purpose | Contoh Penggunaan |
|------|---------|------------------|
| **Markdown Writer** | Create .md files | Export as report.md |
| **PDF Creator** | Generate PDF | Create report.pdf |
| **HTML Generator** | Create web-ready format | Create dashboard.html |

### 13.2 Tool Selection Process

```
Planner creates Task
    ↓
Agent identifies required Tool
    ├─ Search tools.db for match
    ├─ Check tool capabilities
    ├─ Verify tool availability
    └─ Consider alternatives
    ↓
Tool Execution
    ├─ Pass parameters
    ├─ Handle response
    └─ Verify results
    ↓
Next Task or Verification
```

---

## 14. Artifact System

### 14.1 Apa itu Artifact?

Artifact adalah **output hasil kerja Agent** yang:
- Siap digunakan oleh pengguna
- Tersimpan di Workspace
- Dapat di-download/di-share
- Dapat di-edit lebih lanjut

### 14.2 Jenis-Jenis Artifact

| Jenis | Format | Contoh Use Case |
|------|--------|-----------------|
| **Report** | .md, .pdf, .docx | Sales report, project summary |
| **Dashboard** | .html, .json | KPI dashboard, metric tracker |
| **Summary** | .md | Meeting notes summary, findings |
| **SOP** | .md, .docx | Process documentation, guidelines |
| **Presentation** | .pptx, .html | Investor pitch, team presentation |
| **Data Export** | .xlsx, .csv, .json | Cleaned data, structured export |
| **Timeline** | .md, .html | Project timeline, roadmap |
| **Workflow Diagram** | .md (mermaid), .html | Process flow, decision tree |
| **Comparison Table** | .xlsx, .md | Product comparison, feature matrix |
| **Data Visualization** | .html, .pdf, .png | Charts, graphs, infographics |

### 14.3 Artifact Lifecycle

```
Task Execution → Generate Content
    ↓
Format & Validate
    ├─ Check completeness
    ├─ Verify accuracy
    └─ Format according to type
    ↓
Create Artifact Object
    ├─ Type: Report/Dashboard/etc
    ├─ Filename: auto-generated
    ├─ Metadata: creation time, source
    └─ Preview: ready to display
    ↓
Save to Workspace
    ├─ Add to Artifact folder
    ├─ Index for search
    └─ Link to Workspace Profile
    ↓
Present to User
    ├─ Show preview
    ├─ Provide download link
    └─ Ask for feedback
    ↓
Store in History
    └─ Available for future reference
```

---

## 15. Chat History Management

### 15.1 Chat History Types

**Chat Mode History**
```
Chat History (Global)
├─ Conversation 1 (Chat Baru - 23 Jul 2026)
├─ Conversation 2 (Chat Baru - 22 Jul 2026)
└─ Conversation N
```

**Workspace Mode History**
```
Workspace Name
├─ Chat History (Workspace-specific)
│  ├─ Message 1: [User] Create report
│  ├─ Message 2: [Agent] Task breakdown
│  ├─ Message 3: [Agent] Report created
│  └─ Message N
├─ Artifacts
│  ├─ Report_20260723.md
│  └─ Dashboard_20260723.html
└─ Activity Log
```

### 15.2 History Features

- **Separate Storage**: Chat history tidak tercampur
- **Search**: Can search history dalam Workspace
- **Recall Context**: Artifact dapat diakses kembali
- **Conversation Continuity**: Dapat melanjutkan pekerjaan sebelumnya
- **Export**: Can export chat history

---

## 16. Studio - Quick Actions Panel

### 16.1 Apa itu Studio?

Studio adalah **panel aksi cepat (quick actions)** yang menyediakan kemampuan AI yang **relevan dengan Workspace aktif**.

### 16.2 Karakteristik Studio

- **Dinamis**: Berubah sesuai Workspace Profile
- **Context-aware**: Recommend actions berdasarkan data
- **One-click**: Minimal input needed
- **Intelligent**: AI learns user preferences

### 16.3 Contoh Studio Actions (Garment Production Workspace)

```
┌─────────────────────────────────────────┐
│ 📌 STUDIO - Quick Actions               │
├─────────────────────────────────────────┤
│                                         │
│ 📊 Generate Production Report           │
│    "Summarize production metrics Q3"    │
│    [1-click]                            │
│                                         │
│ 📈 Quality Control Dashboard            │
│    "Create QC metrics visualization"    │
│    [1-click]                            │
│                                         │
│ 📦 Inventory Analysis                   │
│    "Analyze stock levels & turnover"    │
│    [1-click]                            │
│                                         │
│ 💰 Cost Analysis                        │
│    "Break down production costs"        │
│    [1-click]                            │
│                                         │
│ 🎯 Performance Summary                  │
│    "Extract KPIs & achievements"        │
│    [1-click]                            │
│                                         │
│ + More Actions...                       │
│                                         │
└─────────────────────────────────────────┘
```

### 16.4 Studio Customization

Studio dapat dikustomisasi:
- **User Preferences**: Remember which actions user prefers
- **Workspace Type**: Different actions untuk different Workspace
- **Learning**: Add new actions based on user behavior
- **Manual**: User can add custom actions/templates

---

## 17. Functional Requirements

### 17.1 Chat Feature Requirements

**FR-CHAT-001: New Chat**
- Pengguna dapat membuat chat baru
- Auto-focus to input field
- Clear chat history option

**FR-CHAT-002: Continue Chat**
- Resume previous conversation
- Load chat history
- Maintain context

**FR-CHAT-003: Save History**
- Auto-save chat messages
- Timestamped entries
- Searchable history

**FR-CHAT-004: Domain Knowledge**
- Can select domain knowledge to use
- Context loaded automatically
- Cited in responses

### 17.2 Workspace Feature Requirements

**FR-WS-001: Create Workspace**
- Input Workspace name
- Select source(s)
- Validate connections
- Start initialization

**FR-WS-002: Connect Source**
- Support multiple source types
- Batch upload capability
- Progress indication
- Error handling

**FR-WS-003: Scan & Index**
- Automatic file scanning
- Progress tracking
- Cancel option
- Error recovery

**FR-WS-004: Workspace Profile**
- Generate automatic profile
- Display statistics
- Show recommendations
- Update when source changes

**FR-WS-005: Workspace Chat**
- Send goals/requests
- Receive task plans
- View task execution
- Download artifacts

### 17.3 Artifact Feature Requirements

**FR-ARTIFACT-001: Generate**
- Create artifacts from tasks
- Multiple format support
- Auto-naming
- Preview available

**FR-ARTIFACT-002: Store**
- Save to Workspace
- Metadata attached
- Searchable
- Version tracking (future)

**FR-ARTIFACT-003: Manage**
- View artifacts
- Download options
- Rename/delete
- Share capability (future)

### 17.4 Agent Feature Requirements

**FR-AGENT-001: Planner**
- Parse complex goals
- Break into tasks
- Create execution plan
- Handle dependencies

**FR-AGENT-002: Task Execution**
- Execute tasks sequentially
- Handle errors gracefully
- Update user on progress
- Pause/resume capability

**FR-AGENT-003: Verification**
- Validate results
- Compare with source
- Error detection
- Request confirmation if needed

**FR-AGENT-004: Reflection**
- Analyze task performance
- Identify improvements
- Learn from feedback
- Adjust future plans

---

## 18. Non-Functional Requirements

### 18.1 Performance

- **Chat Response**: < 2 seconds untuk simple queries
- **Workspace Initialization**: < 30 seconds untuk 200 files
- **Task Execution**: Scalable - dapat handle 1000+ files
- **Search**: < 1 second untuk indexed search
- **Artifact Generation**: Streaming for large outputs

### 18.2 Usability

- **Easy Onboarding**: First workspace dalam < 2 minutes
- **Clear Navigation**: Intuitive UI/UX
- **Error Messages**: User-friendly dan actionable
- **Progress Indication**: Transparency dalam execution
- **Accessibility**: WCAG 2.1 AA compliance

### 18.3 Reliability

- **Data Integrity**: Never lose user data
- **Error Recovery**: Graceful error handling
- **Backup**: Auto-backup Workspace (future)
- **Redundancy**: Multi-region deployment (future)

### 18.4 Security

- **Data Privacy**: No data leaves Workspace tanpa izin
- **Encryption**: Data encrypted in transit & at rest (future)
- **Access Control**: User authentication & authorization
- **Audit Trail**: Log semua actions
- **GDPR Compliant**: Respect data privacy regulations

### 18.5 Scalability

- **Multiple Workspaces**: User dapat punya banyak Workspace
- **Large Files**: Support files > 100MB
- **Concurrent Users**: Multi-user architecture (future)
- **API Integration**: Extensible untuk tools/integrations

### 18.6 Maintainability

- **Code Quality**: Clean, documented code
- **Testing**: Comprehensive test coverage
- **Monitoring**: System health monitoring
- **Updates**: Non-disruptive updates
- **Support**: User support systems

---

## 19. Out of Scope

Arunaki BUKAN:

❌ **IDE** - Tidak untuk development environment  
❌ **Coding Agent penuh** - Hanya lightweight coding assistance  
❌ **CAD Assistant** - Tidak untuk desain teknis  
❌ **Video Editor** - Tidak untuk video processing  
❌ **Image Editor** - Hanya image analysis, bukan editing  
❌ **Operating System** - Hanya bekerja di dalam Workspace  
❌ **Database Management** - Tidak untuk DB operations  
❌ **Real-time Collaboration** (v1) - Future feature  
❌ **Custom ML Training** - Tidak untuk model training  

**Fokus Arunaki:** Autonomous Workspace AI untuk pekerjaan berbasis dokumen dan pengetahuan.

---

## 20. Success Metrics

Arunaki dianggap **sukses** jika pengguna dapat:

| Metric | Target | KPI |
|--------|--------|-----|
| **Ease of Use** | User dapat membuat Workspace | < 2 min untuk first Workspace |
| **Source Connection** | Easily connect data sources | 95% success rate |
| **Initialization** | Quick workspace setup | < 30 sec untuk 200 files |
| **Task Completion** | Finish complex tasks | 90% without user intervention |
| **Output Quality** | Generated artifacts usable | 85% user satisfaction |
| **Time Saved** | Reduce manual work | 70% time saving vs manual |
| **Error Handling** | Graceful failures | < 5% error rate |
| **User Retention** | Ongoing usage | > 60% monthly active users |

---

## 21. Future Vision & Roadmap

### 21.1 Near Future (3-6 months)

- [ ] **Workspace Collaboration** - Share & co-work di Workspace
- [ ] **Cloud Sync** - Automatic cloud backup & sync
- [ ] **Multi-Agent Collaboration** - Multiple agents working together
- [ ] **Advanced Search** - Full-text + semantic search
- [ ] **Version Control** - Track changes ke artifacts
- [ ] **Custom Tools** - User-defined tools dan automations

### 21.2 Medium Term (6-12 months)

- [ ] **Integration Hub** - Connect dengan Zapier, Make, etc
- [ ] **Workflow Automation** - Create & schedule recurring tasks
- [ ] **Enterprise Knowledge Hub** - Centralized knowledge management
- [ ] **Advanced Analytics** - Deeper insights dari Workspace data
- [ ] **Real-time Collaboration** - Live co-editing dengan teams
- [ ] **Custom Domain Knowledge** - Fine-tune AI dengan internal data

### 21.3 Long Term Vision

- **Cross-Workspace Intelligence** - Learn patterns across Workspaces
- **Predictive Assistance** - Anticipate user needs
- **Autonomous Workflows** - Minimal human intervention
- **Industry-specific Modules** - Tailored AI untuk berbagai industri
- **Ecosystem Integration** - Seamless integration dengan business tools
- **Advanced Reasoning** - Multi-step reasoning untuk complex problems

---

## 22. Appendix

### A. Glossary

| Term | Definition |
|------|-----------|
| **Workspace** | Isolated context containing files & metadata |
| **Source** | Data source connected to Workspace |
| **Artifact** | Output/deliverable generated by Agent |
| **Planner** | Component that breaks goals into tasks |
| **Tool** | Functional unit for specific operations |
| **Domain Knowledge** | Custom knowledge added by user/organization |
| **Workspace Profile** | Summary & metadata of Workspace |
| **Chat Mode** | Conversation mode without Workspace |
| **Workspace Mode** | Task execution mode within Workspace |
| **Studio** | Quick actions panel for Workspace |

### B. Related Documents

- `VISION.md` - Product vision & philosophy
- `TECH_SPEC.md` - Technical specifications (future)
- `UI_DESIGN.md` - UI/UX design guide (future)
- `API_DOCS.md` - API documentation (future)

---

**Document Owner:** Arunaki Product Team  
**Last Updated:** 2026-07-23  
**Version:** 1.0 Draft  
**Status:** Ready for Review
