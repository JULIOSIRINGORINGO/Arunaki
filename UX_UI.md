# UX_UI.md - Arunaki User Experience & User Interface Specification

**Version:** 1.0  
**Status:** Draft  
**Last Updated:** 2026-07-23

---

## 1. Purpose

Dokumen ini mendefinisikan pengalaman pengguna (UX) dan struktur antarmuka (UI) Arunaki.

Dokumen ini **TIDAK menjelaskan implementasi teknis**, melainkan:
- Bagaimana pengguna berinteraksi dengan aplikasi
- Bagaimana informasi ditampilkan
- Bagaimana user journey berjalan
- Konsistensi visual dan behavior

Dokumen ini membantu AI Agent memahami:
- **Context awareness**: Apa yang user lihat saat ini?
- **Interaction patterns**: Bagaimana user memberikan input?
- **State management**: Bagaimana state aplikasi berubah?
- **User expectations**: Apa yang user harapkan?

---

## 2. Design Philosophy

### 2.1 Dua Pengalaman Utama

Arunaki memiliki **dua mode kerja utama** yang berbeda secara fundamental:

#### 1. AI Assistant Mode (Chat Mode)
- **Persona**: Conversational AI yang membantu
- **Context**: No Workspace needed
- **Focus**: Dialog dan knowledge sharing
- **Feel**: Personal, responsive, smart

#### 2. Workspace Agent Mode (Workspace Mode)
- **Persona**: Professional workspace agent
- **Context**: Workspace-centric
- **Focus**: Task execution dan productivity
- **Feel**: Focused, powerful, efficient

### 2.2 Unified Application

Meskipun berbeda, keduanya terasa sebagai **satu aplikasi yang kohesif**:
- Navigasi global yang sama
- Design language yang konsisten
- Transisi yang mulus antar mode
- Shared user identity & settings

---

## 3. Design Principles

### 3.1 Simple First
- Interface harus sederhana dan intuitive
- Hindari fitur yang jarang digunakan di halaman utama
- Progressive disclosure: Show advanced features only when needed
- Entry barrier harus rendah

### 3.2 Workspace First
- Workspace adalah "rumah" kedua aplikasi
- Saat di Workspace, fokus ke task execution
- Minimize distraction
- Maximize productivity tools visibility

### 3.3 Chat First
- Semua interaksi utama dilakukan melalui Chat
- Chat adalah primary input method
- Buttons dan Studio hanya shortcuts
- Natural language > Complex UI

### 3.4 Progressive Disclosure
- Fitur lanjutan hanya muncul saat relevan
- Pengguna baru tidak overwhelmed dengan kompleksitas
- Contextual help system yang proactive
- Gradual feature introduction

### 3.5 Consistency
- Navigasi konsisten di semua halaman
- Visual language unified
- Interaction patterns repeatable
- Behavior predictable

### 3.6 Transparency
- Users can understand what's happening
- Progress indicators untuk long operations
- Error messages yang actionable
- Explanations untuk AI decisions

---

## 4. Global Navigation Architecture

### 4.1 Sidebar Navigation

Sidebar adalah **persistent navigation hub** yang selalu tersedia:

```
┌─────────────────────┐
│   ARUNAKI LOGO      │
├─────────────────────┤
│                     │
│  ✨ Chat Baru       │  → New conversation
│                     │
│  📁 Workspace       │  → Access all workspaces
│                     │
│  🕘 Riwayat Chat    │  → Conversation history
│                     │
│  ⚙️  Settings       │  → App settings
│                     │
├─────────────────────┤
│                     │
│  👤 Profile         │  → User profile
│  📊 Usage Stats     │  → Usage analytics
│  ❓ Help & Docs     │  → Help center
│  💬 Feedback        │  → Send feedback
│                     │
└─────────────────────┘
```

### 4.2 Navigation Properties

- **Width**: Fixed width (~260px on desktop)
- **Behavior**: Collapsible on mobile/tablet
- **Persistence**: Remains across all screens
- **Styling**: Dark theme recommended
- **Accessibility**: Full keyboard navigation support

### 4.3 Sidebar State Transitions

```
Sidebar
├─ Collapsed (width: 60px)
│  └─ Icons only (accessible via hover/touch)
│
├─ Expanded (width: 260px)
│  └─ Full text + icons
│
└─ Mobile (width: 100%)
   └─ Full-screen overlay when opened
```

---

## 5. Application Flow Architecture

### 5.1 Main Application Flow

```
┌────────────────────────────────────────────┐
│         OPEN ARUNAKI APPLICATION           │
└────────────────────┬───────────────────────┘
                     ↓
        ┌────────────────────────┐
        │  Check User Auth?      │
        └────────┬───────────────┘
                 ├─ YES → Load User Profile
                 └─ NO  → Show Login/Register
                     ↓
        ┌────────────────────────┐
        │ CHAT MODE - Default    │
        │ (AI Assistant Ready)   │
        └────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ↓            ↓            ↓
    [Chat]       [Workspace]  [Settings]
```

### 5.2 State Management Overview

```
Global App State
├─ User State
│  ├─ isAuthenticated: boolean
│  ├─ userId: string
│  ├─ preferences: object
│  └─ currentWorkspace: string | null
│
├─ Chat State
│  ├─ messages: array
│  ├─ isLoading: boolean
│  ├─ selectedModel: string
│  └─ domainKnowledge: array
│
├─ Workspace State
│  ├─ workspaces: array
│  ├─ activeWorkspace: object
│  ├─ isInitializing: boolean
│  ├─ initProgress: number
│  ├─ sources: array
│  ├─ artifacts: array
│  └─ wsChat: array
│
└─ UI State
   ├─ sidebarOpen: boolean
   ├─ studioOpen: boolean
   ├─ darkMode: boolean
   └─ notifications: array
```

---

## 6. Chat Screen (AI Assistant Mode)

### 6.1 Chat Layout

```
┌────────────────────────────────────────────────────────┐
│ ← Sidebar │ Chat Baru                      Share ⊕     │
├────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │                                                 │  │
│  │  Halo! 👋 Saya Arunaki AI Assistant            │  │
│  │  Ada yang bisa saya bantu hari ini?            │  │
│  │                                                 │  │
│  │  Saya bisa membantu dengan:                    │  │
│  │  • Tanya jawab & informasi                     │  │
│  │  • Menulis & editing                           │  │
│  │  • Brainstorming & ideation                    │  │
│  │  • Translasi bahasa                            │  │
│  │  • Coding assistance                           │  │
│  │                                                 │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │  💡 Quick Suggestions                           │  │
│  │  [Tanya Karir] [Buat Email] [Translate]        │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
├────────────────────────────────────────────────────────┤
│ Input Field:                                            │
│ ┌──────────────────────────────────────────────────┐  │
│ │ Ketik pertanyaan atau request di sini...         │  │
│ │                                                  │  │
│ │ [Attach File] [Voice] ← Send                    │  │
│ └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### 6.2 Chat Components

**Message Bubbles**
```
User Message (Right-aligned, Blue background)
"Bagaimana cara menulis CV yang baik?"

AI Response (Left-aligned, Gray background)
"CV yang baik harus memiliki beberapa elemen penting...
[Long response with formatting]"
```

**Message Features**
- Timestamp untuk setiap message
- Copy button untuk AI responses
- Regenerate option (untuk AI responses)
- Edit option (untuk user messages)
- Delete option (untuk both)

### 6.3 Chat Input Types

**Text Input**
- Primary input method
- Multi-line support
- Submit on Enter, Shift+Enter for new line
- Character limit: None (but warn > 5000 chars)

**File Attachment**
- Support untuk: images, documents, code files
- Max file size: 25MB
- Drag & drop support

**Voice Input**
- Record voice messages
- Auto-transcribe menggunakan speech-to-text
- Visual indicator ketika recording

### 6.4 Quick Suggestions

```
💡 Suggested Prompts (contextual)

[Icon] Prompt Text
[Icon] Prompt Text
[Icon] Prompt Text
```

Suggestions berubah based on:
- Chat history
- User preferences
- Domain knowledge available
- Time of day

---

## 7. Workspace Management

### 7.1 Workspace List Screen

```
┌────────────────────────────────────────────────────────┐
│ ← Sidebar │ Workspace                    [+ Baru]     │
├────────────────────────────────────────────────────────┤
│                                                         │
│  Search Workspace: [_______________]  [Filter ▼]      │
│                                                         │
│  ┌─────────────────────────────────┐ ┌──────────────┐ │
│  │ 📁 Garment Production           │ │ 📁 Finance   │ │
│  │ 124 files • Updated 2 days ago  │ │ 89 files ... │ │
│  │ Last: Generate Report           │ │              │ │
│  └─────────────────────────────────┘ └──────────────┘ │
│                                                         │
│  ┌─────────────────────────────────┐ ┌──────────────┐ │
│  │ 📁 HR Database                  │ │ 📁 Marketing │ │
│  │ 256 files • Updated Today       │ │ 45 files ... │ │
│  │ Last: Employee Report           │ │              │ │
│  └─────────────────────────────────┘ └──────────────┘ │
│                                                         │
└────────────────────────────────────────────────────────┘
```

### 7.2 Workspace Card Information

Setiap Workspace card menampilkan:
- **Icon**: Folder icon + thumbnail preview
- **Name**: Workspace name
- **Stats**: Number of files + last updated time
- **Recent Action**: Last task executed
- **Hover Actions**: Edit, Share, Delete, Duplicate

---

## 8. Create Workspace Flow (Detailed)

### 8.1 Step 1: Basic Information

```
┌────────────────────────────────────────┐
│ Buat Workspace Baru                    │
├────────────────────────────────────────┤
│                                        │
│ Nama Workspace *                       │
│ ┌──────────────────────────────────┐  │
│ │ Contoh: Garment Production Q3    │  │
│ └──────────────────────────────────┘  │
│                                        │
│ Deskripsi (Opsional)                   │
│ ┌──────────────────────────────────┐  │
│ │ Jelaskan purpose Workspace ini    │  │
│ │                                  │  │
│ └──────────────────────────────────┘  │
│                                        │
│ Kategori (Opsional)                    │
│ [▼ Pilih Kategori]                    │
│ ○ Production ○ Finance ○ HR            │
│ ○ Marketing  ○ Lainnya                 │
│                                        │
│                [← Batal] [Lanjut →]   │
└────────────────────────────────────────┘
```

### 8.2 Step 2: Add Sources

```
┌────────────────────────────────────────┐
│ Hubungkan Source ke Workspace          │
│ (Minimal 1 source diperlukan)          │
├────────────────────────────────────────┤
│                                        │
│ Pilih Source Type:                     │
│                                        │
│ ☑ Folder Lokal                         │
│   [Browse] → Selected: /docs/garment   │
│                                        │
│ ☐ Upload File                          │
│   [Choose Files] → 0 files selected    │
│                                        │
│ ☐ Google Drive                         │
│   [Connect Account]                    │
│                                        │
│ ☐ OneDrive                             │
│   [Connect Account]                    │
│                                        │
│ ☐ Website/URL                          │
│   [Paste URL]                          │
│                                        │
│                [← Kembali] [Buat →]   │
└────────────────────────────────────────┘
```

### 8.3 Review Before Create

```
┌────────────────────────────────────────┐
│ Review Workspace Configuration         │
├────────────────────────────────────────┤
│                                        │
│ 📋 Configuration Summary:              │
│                                        │
│ Nama: Garment Production Q3            │
│ Deskripsi: Production metrics Q3 2026  │
│ Kategori: Production                   │
│                                        │
│ Sources:                               │
│ ✓ /docs/garment (124 files detected)   │
│ ✓ Google Drive/Prod Folder (45 files)  │
│                                        │
│ Estimasi waktu init: 30-60 detik       │
│                                        │
│ ⚠️  Workspace akan mulai di-scan ketika │
│    Anda klik "Buat Workspace"          │
│                                        │
│              [← Edit] [Buat ✓]        │
└────────────────────────────────────────┘
```

---

## 9. Workspace Initialization & Loading States

### 9.1 Initialization Progress Screen

```
┌────────────────────────────────────────────────────────┐
│ Workspace Initialization                              │
│ "Garment Production Q3"                                │
├────────────────────────────────────────────────────────┤
│                                                         │
│  [████░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 20%              │
│                                                         │
│  📁 Scanning Files...                                  │
│     Found 124 files in /docs/garment                  │
│     Reading 45 files from Google Drive...             │
│                                                         │
│  ⏱️ Estimated time: ~40 seconds                       │
│                                                         │
│                                                         │
│  [Cancel]                                              │
│                                                         │
└────────────────────────────────────────────────────────┘
```

### 9.2 Initialization Stages (Detailed)

**Stage 1: Scanning (0-20%)**
```
📁 Scanning workspace structure
   └─ Reading folder hierarchy
   └─ Detecting 124 files
   └─ Counting by type: Excel (18), PDF (32), Word (15)...
```

**Stage 2: File Reading (20-40%)**
```
📄 Reading file contents
   └─ Processing: document_1.pdf
   └─ Processing: spreadsheet_1.xlsx
   └─ Processing: report_1.docx
   └─ Extracting text from PDFs...
```

**Stage 3: Metadata Extraction (40-60%)**
```
🏷️  Extracting metadata
   └─ Dates, authors, file sizes
   └─ Detecting language: Indonesian (95%)
   └─ Keywords extraction...
```

**Stage 4: Indexing (60-80%)**
```
📑 Creating search index
   └─ Indexing text content
   └─ Building relationship map
   └─ Performance optimization...
```

**Stage 5: Analysis (80-95%)**
```
🧠 Analyzing workspace content
   └─ Detecting dominant topics
   └─ Classifying documents
   └─ Identifying data patterns...
```

**Stage 6: Profile Generation (95-100%)**
```
✨ Finalizing workspace profile
   └─ Workspace ready!
```

### 9.3 Cancellation

User dapat cancel selama initialization:
- Progress akan reset
- Workspace tidak akan dibuat
- User dibawa kembali ke Workspace List

---

## 10. Workspace Layout & Components

### 10.1 Workspace Main Layout

```
┌──────────────────────────────────────────────────────────────┐
│ ← Arunaki | Workspace Name  [Share] [Settings] [×]          │
├──────────────┬────────────────────────────┬──────────────────┤
│   SOURCES    │     WORKSPACE CHAT         │      STUDIO      │
│   (Left)     │        (Center)            │      (Right)     │
│              │                            │                  │
│ 📁 Folder    │  Workspace Summary         │ 🚀 Quick Actions │
│ ├─ SOP       │  ─────────────────────     │ ────────────────│
│ ├─ Prod      │  ✓ 124 files scanned      │ [Generate Report]│
│ ├─ QC        │  ✓ 18 Excel               │ [Dashboard]      │
│ ├─ Inv       │  ✓ 32 PDF                 │ [Summary]        │
│ │            │  ✓ 15 Word                │ [Timeline]       │
│ ├─ Reports   │                           │ [Analysis]       │
│ └─ Archive   │  I'm ready to help.        │                  │
│              │  What would you like      │ Workspace Info   │
│ 124 Files    │  to do?                   │ ─────────────────│
│ ✓ Indexed    │                           │ Files: 124       │
│              │  [Ask Question]           │ Language: ID     │
│              │                           │ Updated: Today   │
│              │                           │ Size: 245 MB     │
│              │                           │                  │
├──────────────┼────────────────────────────┴──────────────────┤
│ Input Field (spanning full width):                           │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Buat laporan bulanan dengan breakdown per department... │ │
│ │                                                          │ │
│ │ [Attach] [Voice] [Domain Knowledge] ← [Send]           │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 10.2 Three-Panel Architecture

**Left Panel: Sources**
- Hierarchical folder view
- File statistics
- Index status
- Quick actions (refresh, manage)

**Center Panel: Workspace Chat**
- Main interaction area
- Messages & responses
- Task execution visualization
- Artifact preview

**Right Panel: Studio**
- Context-aware actions
- Quick templates
- Workspace insights
- Recent artifacts

---

## 11. Sources Panel (Detailed)

### 11.1 Source Explorer

```
WORKSPACE SOURCES
───────────────────────

▼ Connected Sources (2)

  📁 Local Folder
     └─ /docs/garment (124 files)
        ├─ 📂 SOP (12 files)
        ├─ 📂 Production (45 files)
        ├─ 📂 QC (23 files)
        ├─ 📂 Finance (20 files)
        └─ 📂 Archive (24 files)

  ☁️  Google Drive
     └─ /Production Folder (45 files)
        ├─ 📂 2024 (15 files)
        └─ 📂 2025 (30 files)

───────────────────────

FILE STATISTICS

Total Files: 124
├─ Excel: 18
├─ PDF: 32
├─ Word: 15
├─ CSV: 12
├─ PowerPoint: 8
├─ Image: 15
└─ Other: 24

Storage: 245 MB

STATUS: ✓ Indexed & Ready

───────────────────────

SOURCE ACTIONS

[+ Add Source]
[🔄 Refresh]
[⚙️  Manage Sources]
```

### 11.2 Source Interactions

- **Click folder**: Expand/collapse
- **Click file**: Preview di chat
- **Right-click**: Context menu (open, analyze, delete)
- **Drag & drop**: Add files to Workspace (future)

---

## 12. Workspace Chat (Center Panel)

### 12.1 Chat Interaction Flow

```
┌─────────────────────────────────────────┐
│  Initial Workspace Message (First Time)  │
├─────────────────────────────────────────┤
│                                         │
│  ✓ Workspace berhasil dibuat!           │
│                                         │
│  📊 Saya menemukan:                     │
│  • 124 file total                       │
│  • 18 Excel, 32 PDF, 15 Word            │
│  • Kategori: Production & Quality       │
│  • Period: Jan 2024 - Jul 2026          │
│                                         │
│  💡 Workspace ini berkaitan dengan:     │
│     Garment Production Management       │
│                                         │
│  🎯 Hal yang bisa saya lakukan:         │
│  • Generate Production Report           │
│  • Create QC Dashboard                  │
│  • Analyze Inventory                    │
│  • Timeline Visualization               │
│  • Cost Breakdown Analysis              │
│                                         │
│  Apa yang ingin Anda lakukan?            │
│                                         │
└─────────────────────────────────────────┘
```

### 12.2 User Message + Agent Response

```
USER MESSAGE:
┌─────────────────────────────────────┐
│ Buatkan laporan produksi Q2 dengan   │
│ breakdown per line.                 │
└─────────────────────────────────────┘

AGENT RESPONSE:
┌─────────────────────────────────────┐
│ 📋 Task Breakdown:                  │
│                                     │
│ Task 1: Search Q2 production files  │
│ Task 2: Extract production data     │
│ Task 3: Group by line               │
│ Task 4: Calculate metrics           │
│ Task 5: Generate report document    │
│ Task 6: Create visualization        │
│                                     │
│ ⏱️  Estimated: ~2 minutes          │
│                                     │
│ [Start] [Cancel]                    │
└─────────────────────────────────────┘

EXECUTION:
[████░░░░░░░░░░░░░░░░] 25% Complete
Executing: Task 2 - Extract production data
```

### 12.3 Message Features

**User Message Actions**
```
┌─────────────────────────────┐
│ User message                │
│ ⋯ [Edit] [Delete] [Retry]  │
└─────────────────────────────┘
```

**AI Response Actions**
```
┌─────────────────────────────┐
│ AI response                 │
│ ⋯ [Copy] [Regenerate]      │
│   [Cite Sources] [Delete]   │
└─────────────────────────────┘
```

---

## 13. Studio Panel (Right Panel)

### 13.1 Dynamic Quick Actions

Studio adalah **context-aware action panel** yang berubah based on Workspace type:

**Garment Production Workspace:**
```
STUDIO
───────────────────

🚀 QUICK ACTIONS

[📊 Generate Report]
   Create production summary

[📈 QC Dashboard]
   Quality metrics visualization

[💰 Cost Analysis]
   Production cost breakdown

[📦 Inventory Status]
   Current stock levels

[⏱️  Production Timeline]
   Schedule & deadlines

───────────────────

📚 WORKSPACE INFO

Type: Production
Files: 124
Updated: Today
Size: 245 MB

───────────────────

📌 RECENT ARTIFACTS

Production_Report_20260723.md
QC_Dashboard_20260722.html
```

**HR Workspace:**
```
STUDIO
───────────────────

🚀 QUICK ACTIONS

[👥 Employee Summary]
   All employees overview

[📋 Recruitment Report]
   Candidate analysis

[📊 Performance Dashboard]
   KPI & ratings

[📅 Attendance Report]
   Presence data

───────────────────
```

### 13.2 Studio Customization

Studio dapat dikustomisasi melalui Settings:
- Pin/unpin actions
- Reorder actions
- Hide actions tidak dipakai
- Create custom actions (future)

---

## 14. Workspace Profile Display

### 14.1 Profile Information

Profile dapat diakses via studio atau header:

```
WORKSPACE PROFILE
─────────────────────────────

📋 Basic Info
Name: Garment Production Q3
Created: 23 Jul 2026
Owner: user@example.com
Status: Active

📊 Statistics
Total Files: 124
Total Size: 245 MB
Last Updated: 23 Jul 2026
Average Document Age: 6 months

📁 Content Breakdown
Excel: 18 (14%)
PDF: 32 (26%)
Word: 15 (12%)
CSV: 12 (10%)
PowerPoint: 8 (6%)
Images: 15 (12%)
Other: 24 (20%)

🌍 Language Detection
Primary: Indonesian (95%)
Secondary: English (4%)
Other: 1%

🏷️  Topics Detected
Production Planning (45%)
Quality Control (28%)
Inventory Management (20%)
Finance (7%)

📅 Time Range
Oldest File: 15 Jan 2024
Newest File: 23 Jul 2026
Span: 30 months

📌 Related Artifacts
Reports: 12
Dashboards: 4
Summaries: 8
```

---

## 15. Chat History Management

### 15.1 History Screen - AI Assistant

```
RIWAYAT CHAT
───────────────────────────────

Search: [________________]

HARI INI
─────────
Chat 1 - "Bagaimana menulis CV?"  | 10:23 AM
Chat 2 - "Translasi ke Inggris"   | 09:45 AM

KEMARIN
─────────
Chat 3 - "Brainstorming project"  | 04:30 PM
Chat 4 - "Coding question"        | 02:15 PM

MINGGU LALU
─────────
Chat 5 - "Marketing strategy"     | 3 days ago
Chat 6 - "Email templates"        | 5 days ago

[Clear History] [Export All]
```

### 15.2 Workspace Chat History

```
GARMENT PRODUCTION Q3 - HISTORY
────────────────────────────────

Search: [________________]

23 JUL 2026
──────────
"Generate production report"      | 2:30 PM
  Result: Production_Report.md ✓

"Create QC dashboard"             | 11:00 AM
  Result: QC_Dashboard.html ✓

22 JUL 2026
──────────
"Analyze inventory"               | 3:45 PM
"Cost breakdown"                  | 1:20 PM

────────────────────────────────
[Archive] [Delete All]
```

---

## 16. Settings Screen

### 16.1 Settings Layout

```
SETTINGS
────────────────────────────────────

[Profile] [AI Models] [Domain Knowledge]
[Integrations] [Workspace] [Security]

PROFILE TAB
─────────────────────────────────

Personal Information
Name: [John Doe________]
Email: john@example.com
Avatar: [Upload Photo]

Preferences
Theme: [Light] [Dark] [Auto]
Language: [Indonesian ▼]
Notification: [On] [Off]

────────────────────────────────

AI MODELS TAB
─────────────────────────────────

Chat Model
[Claude Opus ▼]

Workspace Agent Model
[Claude Sonnet ▼]

Parameters
Temperature: [────●─────] 0.7
Max Tokens: [────●─────] 2048

Advanced: [Show Options]

────────────────────────────────

DOMAIN KNOWLEDGE TAB
─────────────────────────────────

Manage Domain Knowledge
[+ Upload New Knowledge Base]

Active Knowledge Bases:
☑ Company SOP (15 docs)
☑ Garment Costing (8 docs)
☑ QC Standards (12 docs)

────────────────────────────────
```

### 16.2 Settings Categories

| Tab | Settings |
|-----|----------|
| **Profile** | Name, email, avatar, appearance |
| **AI Models** | Model selection, temperature, max tokens |
| **Domain Knowledge** | Upload & manage custom knowledge |
| **Integrations** | Connect external services (Google Drive, OneDrive) |
| **Workspace** | Default settings untuk new Workspace |
| **Security** | Password, 2FA, data privacy |

---

## 17. Empty & Loading States

### 17.1 Empty State: Chat Baru

```
┌─────────────────────────────────────┐
│                                     │
│  👋 Halo! Saya Arunaki              │
│                                     │
│  Saya adalah AI Assistant yang      │
│  siap membantu dengan:              │
│  • Tanya jawab & informasi          │
│  • Menulis & brainstorming          │
│  • Translasi & coding               │
│  • Dan banyak lagi!                 │
│                                     │
│  💡 Mulai dengan pertanyaan:        │
│                                     │
│  [Tanya Karir] [Buat Email]         │
│  [Translate] [Brainstorm]           │
│                                     │
└─────────────────────────────────────┘
```

### 17.2 Empty State: No Workspace

```
┌─────────────────────────────────────┐
│                                     │
│  📁 Belum Ada Workspace             │
│                                     │
│  Workspace adalah ruang kerja untuk │
│  mengelola dokumen dan menjalankan  │
│  tugas berbasis AI.                 │
│                                     │
│  [+ Buat Workspace Baru]            │
│                                     │
│  Atau upload dokumen terlebih      │
│  dahulu untuk membuat Workspace.    │
│                                     │
└─────────────────────────────────────┘
```

### 17.3 Empty State: Workspace No Sources

```
┌─────────────────────────────────────┐
│  Workspace: Garment Production      │
│                                     │
│  ⚠️  Workspace belum memiliki Source│
│                                     │
│  Hubungkan folder atau file terlebih│
│  dahulu agar Workspace dapat bekerja│
│                                     │
│  [+ Tambah Source]                  │
│                                     │
└─────────────────────────────────────┘
```

### 17.4 Loading State Variations

**File Upload Loading**
```
📤 Uploading files...
[████████░░░░░░░░░░░░░░] 38%
Uploaded: 12 files / 32 files
```

**Task Execution Loading**
```
⚙️  Executing task...
[████████████░░░░░░░░░] 60%
Current: Analyzing spreadsheet data
```

**Workspace Initialization Loading**
```
🔄 Scanning workspace...
[██████░░░░░░░░░░░░░░░] 25%
Found 124 files
```

---

## 18. Error & Warning States

### 18.1 Error Handling Strategy

Semua error harus:
1. **Explain what happened** - Jelas dan user-friendly
2. **Explain why** - Root cause jika memungkinkan
3. **Provide solution** - Actionable next steps
4. **Offer help** - Link to docs atau contact support

### 18.2 Error Examples

**File Read Error**
```
❌ File tidak dapat dibaca

File: document.pdf
Reason: File mungkin rusak atau terenkripsi

Solutions:
○ Coba file lain
○ Download ulang file
○ Hubungi support jika masalah persist

[Retry] [Skip File] [Contact Support]
```

**Connection Error**
```
❌ Koneksi ke Google Drive gagal

Kemungkinan penyebab:
• Token authentication expired
• Network connectivity issue
• Permission tidak cukup

Solutions:
○ Refresh connection
○ Check internet connection
○ Re-authorize Google Drive account

[Reconnect] [Help] [Skip]
```

**Index Error**
```
⚠️  Workspace index tidak lengkap

Beberapa file mungkin tidak ter-index
dengan sempurna.

Action taken:
✓ Attempting to rebuild index...
[████████░░░░░░░░░] 45%

[Wait] [Cancel & Continue]
```

### 18.3 Warning Messages

**Before Destructive Actions**
```
⚠️  Konfirmasi Diperlukan

Anda akan menghapus workspace:
"Old Production Data"

Ini tidak dapat di-undo.
Files: 256 files, 1.2 GB

[Cancel] [Delete Anyway]
```

---

## 19. Responsive Design Strategy

### 19.1 Desktop Layout (1440px+)

```
┌──────────────────────────────────────────────────┐
│ Sidebar (260px) │ Content (variable) │ Studio    │
└──────────────────────────────────────────────────┘
```

- Three-column layout
- Full navigation visible
- All panels accessible
- Optimal for productivity

### 19.2 Tablet Layout (768px - 1440px)

```
┌──────────────────────────────┐
│ Sidebar (collapsed: 60px)    │
│         Content              │
│ Studio (swipeable/toggle)    │
└──────────────────────────────┘
```

- Sidebar collapsible
- Studio as overlay/drawer
- Touch-optimized
- Swipe gestures supported

### 19.3 Mobile Layout (< 768px)

```
┌───────────────────┐
│ Navigation (Tab)  │
├───────────────────┤
│   Full-width      │
│   Content Area    │
├───────────────────┤
│ Tab Navigation    │
│ [Chat] [Ws] [More]│
└───────────────────┘
```

- Single column
- Bottom tab navigation
- Sidebar as modal overlay
- Full-width content
- Touch-optimized components

### 19.4 Responsive Breakpoints

| Breakpoint | Width | Device | Layout |
|-----------|-------|--------|--------|
| xs | < 360px | Small phone | Single column |
| sm | 360-768px | Phone | Single column, full-width |
| md | 768-1024px | Tablet | Collapsible sidebar |
| lg | 1024-1440px | Small desktop | Three-column |
| xl | 1440px+ | Large desktop | Three-column, wide |

---

## 20. Interaction Patterns & Micro-behaviors

### 20.1 Chat Input Auto-grow

- Textarea grows as user types (max 150px height)
- Scroll inside if longer
- Submit button always visible

### 20.2 Message Loading Animation

```
User sends: "Create report"
    ↓
Show: "[●●●] AI thinking..."  (animated dots)
    ↓
Response appears (streaming text)
    ↓
Animation stop
```

### 20.3 Streaming Response

- AI responses stream in real-time
- User can see response being generated
- Improves perceived performance

### 20.4 Progress Indication

Long-running tasks show:
- Progress bar with percentage
- Current task description
- Estimated time remaining
- Cancel option

### 20.5 Toast Notifications

Non-blocking notifications:
```
✓ Workspace dibuat dengan sukses
  [Buka Workspace] [Dismiss]
```

Duration: 5 seconds (auto-dismiss)

---

## 21. Accessibility Requirements

### 21.1 WCAG 2.1 AA Compliance

- **Color contrast**: Min 4.5:1 for text
- **Keyboard navigation**: Full keyboard support
- **Screen readers**: Proper ARIA labels
- **Focus indicators**: Clear visible focus
- **Motion**: Respect prefers-reduced-motion

### 21.2 Keyboard Navigation

| Shortcut | Action |
|----------|--------|
| `Tab` | Navigate elements |
| `Shift+Tab` | Navigate backwards |
| `Enter` | Submit/Select |
| `Escape` | Close modal/cancel |
| `Ctrl+/` or `Cmd+/` | Show shortcuts |
| `Ctrl+B` or `Cmd+B` | New chat/workspace |

### 21.3 Screen Reader Support

- All buttons have descriptive labels
- Form fields have labels
- Images have alt text
- Landmarks properly marked (main, nav, aside)
- Live regions for dynamic content

---

## 22. Visual Design Tokens

### 22.1 Color Palette

**Brand Colors**
```
Primary: #2563EB (Blue)
Secondary: #7C3AED (Purple)
Accent: #EC4899 (Pink)
```

**Semantic Colors**
```
Success: #10B981 (Green)
Warning: #F59E0B (Amber)
Error: #EF4444 (Red)
Info: #3B82F6 (Blue)
```

**Neutral Colors**
```
Background: #FFFFFF / #0F172A (dark)
Surface: #F9FAFB / #1E293B (dark)
Border: #E5E7EB / #334155 (dark)
Text: #1F2937 / #F1F5F9 (dark)
```

### 22.2 Typography

**Font Family**: System font stack (San Francisco, Segoe UI, Helvetica)

**Font Sizes**
- Display: 32px (h1)
- Heading: 24px (h2), 20px (h3), 18px (h4)
- Body: 16px (normal), 14px (small)
- Caption: 12px

**Font Weights**
- Bold: 700 (headings, emphasis)
- Semibold: 600 (strong emphasis)
- Regular: 400 (body text)
- Light: 300 (secondary text)

### 22.3 Spacing Scale

```
2px, 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px
```

Use: Margins, padding, gaps

### 22.4 Border Radius

```
Subtle: 4px (input fields, buttons)
Medium: 8px (cards, panels)
Large: 12px (large containers)
Full: 9999px (circular elements)
```

---

## 23. User Journey Maps

### 23.1 First-Time User Journey (Chat Mode)

```
User Opens App
    ↓ [Empty Chat Screen]
    ↓
Sees Welcome Message + Quick Suggestions
    ↓ [User clicks suggestion OR types]
    ↓
AI Responds
    ↓ [User continues conversation]
    ↓
[Loop: User asks more questions]
    ↓ [User explores settings / history]
    ↓
[Satisfied] → [Return later]
```

### 23.2 First-Time Workspace User Journey

```
User Clicks "Workspace"
    ↓ [Empty Workspace List]
    ↓
User Clicks "Create Workspace"
    ↓ [Form: Name + Category]
    ↓
User Selects Sources
    ↓ [File upload / Folder selection]
    ↓
Review Configuration
    ↓ [Confirm & Create]
    ↓
[Initialization begins]
    ↓ [Progress bar visible]
    ↓
Initialization Complete
    ↓ [Initial AI summary shown]
    ↓
User Interacts via Chat
    ↓ [Give goal / AI plans tasks]
    ↓
Execution & Result
    ↓ [Artifact generated + saved]
    ↓
[Success!] → User continues working
```

### 23.3 Returning User Journey

```
User Opens App
    ↓ [Previous chat or workspace shown]
    ↓
User Continues Previous Conversation
    ↓ OR ↓
User Creates New Chat/Workspace
    ↓
Natural continuation of work
```

---

## 24. Interaction Rules & Constraints

### 24.1 Core Rules

**Rule 1: Workspace Always Analyzed**
- Workspace harus fully scanned sebelum usage
- AI tidak akan mulai sampai initialization selesai
- Progress harus visible

**Rule 2: Chat is Primary**
- Semua interaksi utama via Chat
- Buttons hanya shortcuts
- Studio suggestions contextual

**Rule 3: Workspace Context Isolation**
- Workspace A tidak influence Workspace B
- Each Workspace independent context
- Clear separation visual & functional

**Rule 4: AI Proactivity**
- AI gives suggestions setelah initialization
- AI asks clarifying questions jika perlu
- AI explains task breakdown before execution

**Rule 5: User Confirmation for Risky Actions**
- Modifications ke multiple files → confirm
- Deletions → confirm
- Major analysis changes → confirm

### 24.2 State Transition Rules

```
AppState: [ChatMode | WorkspaceMode | Settings]

ChatMode
  ├─ Can transition to: WorkspaceMode, Settings
  └─ Cannot: Modify files, use Tools

WorkspaceMode
  ├─ Can transition to: ChatMode, Settings
  └─ Can: Use Tools, modify files

Settings
  ├─ Can transition to: ChatMode, WorkspaceMode
  └─ Cannot: Execute tasks directly
```

---

## 25. Help & Guidance System

### 25.1 Onboarding

**First Launch Onboarding**
```
Step 1: Welcome
"Welcome to Arunaki!"

Step 2: Chat Introduction
"This is Chat Mode - talk to AI"

Step 3: Workspace Introduction
"Create Workspace for document work"

Step 4: Settings
"Customize your experience here"

[Skip] [Next]
```

### 25.2 Contextual Help

- Help icon (?) on each major section
- Hover tooltip on buttons
- Inline guidance for complex flows
- "Learn more" links to documentation

### 25.3 Help Center

Accessible via sidebar:
```
Help Menu
├─ Getting Started
├─ Chat Mode Guide
├─ Workspace Guide
├─ FAQs
├─ Keyboard Shortcuts
├─ Report Bug
└─ Contact Support
```

---

## 26. UX Principles Summary

**User-Centered**
- Understand user needs & pain points
- Design based on user research
- Iterate based on feedback

**Simple & Clear**
- Minimize cognitive load
- Clear labels & descriptions
- Logical information hierarchy

**Consistent**
- Consistent navigation patterns
- Unified visual language
- Predictable behavior

**Responsive**
- Works on all devices
- Touch-optimized
- Performance optimized

**Accessible**
- WCAG 2.1 AA compliant
- Keyboard navigable
- Screen reader friendly

**Transparent**
- Show what's happening
- Explain decisions
- Provide feedback

---

## 27. Future UX Enhancements

### 27.1 Planned Features

- [ ] **Workspace Collaboration** - Real-time co-editing
- [ ] **Workspace Sharing** - Share with team members
- [ ] **Workspace Templates** - Pre-configured Workspaces
- [ ] **Pinned Artifacts** - Quick access to frequently used
- [ ] **Recent Workspace** - Quick access bar
- [ ] **Split View** - View multiple Workspaces
- [ ] **Multi-window** - Multiple windows support
- [ ] **Workspace Search** - Global search across all Workspaces
- [ ] **Customizable Dashboard** - Personalized workspace home
- [ ] **Advanced Filters** - Filter files by various criteria
- [ ] **Data Visualization** - Built-in charts & graphs

### 27.2 Research Areas

- Dark mode refinement
- Mobile app version
- Progressive web app (PWA)
- Voice interaction (Conversational UI)
- Gesture-based navigation (mobile)

---

## 28. Design Handoff Specifications

### 28.1 Component Library (Future)

Standard components:
- Buttons (primary, secondary, danger)
- Input fields (text, number, select)
- Cards (various layouts)
- Modals (alert, confirmation, form)
- Panels (sidebar, overlay)
- Notifications (toast, alert, banner)
- Loading indicators (spinner, progress)
- Menus (dropdown, context)

### 28.2 CSS Variables

```css
--color-primary: #2563EB;
--color-secondary: #7C3AED;
--spacing-unit: 8px;
--border-radius-sm: 4px;
--font-size-base: 16px;
--transition-duration: 200ms;
```

### 28.3 States & Variants

Every component has:
- Default state
- Hover state
- Active/Focus state
- Disabled state
- Loading state
- Error state

---

## 29. Performance Considerations

### 29.1 Performance Targets

| Metric | Target |
|--------|--------|
| First Load | < 3s |
| Chat Response | < 2s |
| Workspace Init (200 files) | < 30s |
| Button Click → Response | < 100ms |
| Search Results | < 1s |
| Page Transition | < 500ms |

### 29.2 Optimization Strategies

- Lazy load panels (Studio loads after chat)
- Progressive rendering (show content as it loads)
- Image optimization (lazy load, compress)
- Code splitting (load only needed JS)
- Caching (cache frequent queries)

---

## 30. Appendix: Glossary & References

### A. UI/UX Glossary

| Term | Definition |
|------|-----------|
| **Chat Mode** | AI Assistant conversational mode |
| **Workspace Mode** | Document-centric task execution |
| **Studio** | Quick actions panel |
| **Sources** | Data sources connected to Workspace |
| **Artifact** | Generated output from tasks |
| **Streaming** | Real-time text generation |
| **Toast** | Temporary notification |
| **Modal** | Dialog box overlay |
| **Progressive Disclosure** | Show features as needed |

### B. Related Documents

- `PRD.md` - Product requirements
- `VISION.md` - Product vision
- `TECH_SPEC.md` - Technical specifications (future)
- `BRAND_GUIDE.md` - Brand guidelines (future)

### C. Design Tools & Assets

- Figma prototypes (link)
- Design tokens (link)
- Component library (link)
- Icon library (link)

---

**Document Owner:** Arunaki UX/UI Team  
**Last Updated:** 2026-07-23  
**Version:** 1.0 Draft  
**Status:** Ready for Review & Implementation
