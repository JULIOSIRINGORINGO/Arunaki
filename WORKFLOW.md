# WORKFLOW.md - Development Roadmap

**Version:** 1.1  
**Last Updated:** 2026-07-25

---

## Overview

This document defines the **fixed development sequence** for Arunaki. Follow this order strictly. Do not skip phases or jump ahead without explicit approval.

---

## Phase 1: Backend Foundation ✅ DONE

**Goal:** Core infrastructure and database setup.

| Task | Status |
|------|--------|
| Clone repo | ✅ |
| Install dependencies | ✅ |
| Create `.env` with OpenRouter config | ✅ |
| Create `prisma/schema.prisma` with all models | ✅ |
| Database push (SQLite) | ✅ |
| Tailwind CSS config | ✅ |
| Create `README.md` | ✅ |

---

## Phase 2: Backend Core Modules ✅ DONE

**Goal:** Basic CRUD modules for workspace management.

| Module | Endpoints | Status |
|--------|-----------|--------|
| **Workspace** | CRUD + list | ✅ |
| **Source** | CRUD + findByWorkspaceId + updateStatus | ✅ |
| **Chat** | Create chat, list, getMessages, addMessage | ✅ |

---

## Phase 3: AI Integration ✅ DONE

**Goal:** Connect OpenRouter API for actual AI responses.

### 3.1 AI Service (Backend)
- [x] Create `AiModule` with `AiService`
- [x] Implement OpenRouter API client (fetch to `https://openrouter.ai/api/v1/chat/completions`)
- [x] Use model: `nvidia/nemotron-3-ultra-550b-a55b:free`
- [x] System prompt for AI Assistant mode (general help)

### 3.2 Chat with AI
- [x] `POST /chat/:id/send` — Send user message → Get AI response
- [x] Auto-save both user message and AI response to DB

### 3.3 Testing
- [x] Build succeeds (0 errors)
- [x] AI responds to chat mode questions
- [x] Messages saved to database correctly
- [x] Regression test: Workspace, Source, Chat all working

---

## Phase 4: File Module ✅ DONE

**Goal:** File metadata and content storage.

### 4.1 File Repository & Service
- [x] `FileModule` with CRUD
- [x] `findBySourceId(sourceId)` — List files in a source
- [x] `findByWorkspaceId(workspaceId)` — List all files in workspace
- [x] Store file metadata (name, path, type, size, mimeType)
- [x] Store extracted text content for search
- [x] `updateContent(id, content)` — Save parsed text
- [x] `updateStatus(id, status)` — Update file status

### 4.2 Testing
- [x] Build succeeds (0 errors)
- [x] All endpoints tested
- [x] Content update works
- [x] Status update works
- [x] Regression test passed (Workspace, Source, Chat, AI)

---

## Phase 5: Parser Service ✅ DONE

**Goal:** Extract text and metadata from documents.

### 5.1 Parser Providers
- [x] `ParserProvider` interface (abstraction)
- [x] `TxtParser` — Plain text files
- [x] `MdParser` — Markdown files
- [x] `CsvParser` — CSV files
- [x] `PdfParser` — PDF extraction (pdf-parse)
- [x] `DocxParser` — Word documents (mammoth)
- [x] `XlsxParser` — Excel files (xlsx)

### 5.2 Parser Service
- [x] Route file to correct parser based on type
- [x] Extract text content
- [x] Extract metadata
- [x] `getSupportedTypes()` — List supported file types
- [x] `isSupported(fileType)` — Check if file type is supported

**Note:** Parser does NOT save directly — passes results to FileService.

---

## Phase 6: Storage Service ✅ DONE

**Goal:** Local file system abstraction.

### 6.1 Storage Service
- [x] `StorageService` — Only module that reads/writes filesystem
- [x] `readFile(path)` — Read file content as string
- [x] `readBuffer(path)` — Read file as buffer (for binary files)
- [x] `writeFile(path, content)` — Write string to file
- [x] `writeBuffer(path, buffer)` — Write buffer to file
- [x] `getFileInfo(path)` — Get size, dates, type, mimeType
- [x] `exists(path)` — Check if file exists
- [x] `deleteFile(path)` — Delete file
- [x] `ensureDir(path)` — Create directory recursively
- [x] `listDir(path)` — List directory contents
- [x] Path traversal protection (validatePath)

**Note:** AI Engine and other services NEVER touch filesystem directly.

---

## Phase 7: Search Service ✅ DONE

**Goal:** Search files by metadata and content.

### 7.1 Search Providers
- [x] `SearchProvider` interface (abstraction)
- [x] `MetadataSearchProvider` — Filter by file type, name, date
- [x] `FtsSearchProvider` — Content search with LIKE (FTS5-ready)

### 7.2 Search Service
- [x] `searchFiles(workspaceId, query)` — Combined search
- [x] Return ranked results with relevance score
- [x] Deduplication across providers
- [x] AI Engine only calls SearchService, never providers directly

---

## Phase 8: Artifact Service ✅ DONE

**Goal:** Manage AI-generated outputs.

### 8.1 Artifact Repository & Service
- [x] `ArtifactModule` with CRUD
- [x] `createArtifact(workspaceId, data)` — Save new artifact
- [x] `findByWorkspaceId(workspaceId)` — List workspace artifacts
- [x] `findById(id)` — Get artifact by ID
- [x] `update(id, data)` — Update artifact
- [x] `delete(id)` — Delete artifact

### 8.2 Artifact Storage
- [x] Artifacts saved with path reference
- [x] Separate from source files
- [x] Support multiple formats (md, pdf, html, xlsx, csv, json)

---

## Phase 9: Workspace Initialization ✅ DONE

**Goal:** Automatic workspace setup when created.

### 9.1 Initialization Flow
```
Create Workspace → Scan Files → Parse Documents → Extract Metadata → Index FTS → Ready
```

### 9.2 Implementation
- [x] `WorkspaceService.initialize(workspaceId)` — Orchestrate full flow
- [x] Stage 1: Scan — Count files, detect types
- [x] Stage 2: Parse — Extract text from all files
- [x] Stage 3: Metadata — Extract metadata from files
- [x] Stage 4: Index — Build FTS5 index
- [x] Stage 5: Profile — Generate workspace profile summary
- [x] Update workspace status at each stage (pending → processing → ready)
- [x] Handle partial failures (one file fails ≠整个 workspace fails)

---

## Phase 10: Frontend - Layout & Navigation ✅ DONE

**Goal:** Basic UI shell with sidebar.

### 10.1 Layout Components
- [x] `AppLayout` — Sidebar + Main content
- [x] `Sidebar` — Navigation (Chat, Workspace, History, Settings)
- [x] `SidebarItem` — Individual nav item with active state
- [x] Responsive behavior (collapsible on mobile with overlay)

### 10.2 Routing
- [x] `/` → Chat Mode (default)
- [x] `/workspace` → Workspace List
- [x] `/workspace/:id` → Workspace Detail
- [x] `/knowledge` → Knowledge (Domain Knowledge Base)
- [x] `/settings` → Settings
- [x] `/history` → Chat History

### 10.3 State Management
- [x] TanStack Query configured
- [x] React Router configured

---

## Phase 11: Frontend - Chat UI ✅ DONE

**Goal:** Chat interface for AI Assistant mode.

### 11.1 Chat Components
- [x] `ChatPage` — Main chat layout
- [x] `ChatMessages` — Message list (scrollable)
- [x] `MessageBubble` — User/AI message display with avatars
- [x] `ChatInput` — Text input + send button
- [x] `WelcomeMessage` — Empty state with suggestions

### 11.2 Chat Features
- [x] Create new chat
- [x] Send message → Get AI response
- [x] Display messages with timestamps
- [x] Loading state while AI responds
- [x] Auto-scroll to bottom
- [x] Enter to send, Shift+Enter for newline

### 11.3 State Management
- [x] TanStack Query for API calls
- [x] Cache invalidation on new messages

---

## Phase 12: Frontend - Workspace UI ✅ DONE

**Goal:** Workspace management interface.

### 12.1 Workspace List
- [x] `WorkspaceListPage` — Grid of workspace cards
- [x] `WorkspaceCard` — Name, stats, status, delete option
- [x] Create workspace button
- [x] Empty state with call-to-action

### 12.2 Create Workspace Flow
- [x] `CreateWorkspaceModal` — Simple form
- [x] Name input with validation
- [x] Loading state during creation
- [x] Auto-refresh list after creation

### 12.3 Workspace Detail
- [x] `WorkspaceDetailPage` — Three-panel layout
- [x] Left: Sources panel (file list)
- [x] Center: Workspace info + initialize button
- [x] Right: Studio (quick actions)
- [x] Initialize workspace on first open

---

## Phase 13: Frontend - Settings ✅ DONE

**Goal:** User preferences.

### 13.1 Settings Page
- [x] AI model display
- [x] Theme toggle (light/dark)
- [x] Storage info
- [x] About section

---

## Phase 14: Integration & Testing ✅ DONE

**Goal:** End-to-end testing and polish.

### 14.1 E2E Testing
- [x] Full chat flow (create → send → receive)
- [x] Workspace creation flow
- [x] File upload and parsing
- [x] AI response in workspace context
- [x] Workspace initialization flow

### 14.2 Bug Fixes & Polish
- [x] Error handling
- [x] Loading states
- [x] Empty states
- [x] Responsive design

---

## Phase 15: Enterprise Document Tools Suite & Canvas Panel ✅ DONE

**Goal:** Enterprise document tools suite, dynamic Knowledge Base injection, and Canvas Panel exports.

### 15.1 Enterprise Tools Suite (Backend)
- [x] `ToolsModule` & `ToolRegistryService` — Central tool registry and execution engine
- [x] `TextExtractorTool` — 100% generic open-source `compromise` NLP & `lodash` data aggregator
- [x] `EnterpriseCalculatorTool` — Financial & quantity subtotal, tax, and discount calculator
- [x] `DocumentGeneratorTool` — Spreadsheet & document export engine (Excel `.xlsx`, `.csv`, `.html`)

### 15.2 Canvas Panel & Knowledge Base Integration
- [x] Knowledge Base dynamic injection into system prompt (`garment.md`)
- [x] Plain text card rendering with `max-h-[75%]`, padding, and inside top-right copy button
- [x] Header export buttons for Download CSV (`.csv`) and Download TXT (`.txt`)
- [x] Leaked reasoning sanitizer filtering in `AiService` and `ChatPage`

---

## Phase 16: Knowledge Base System (AI Assistant) ✅ DONE

**Goal:** Domain Knowledge perusahaan (aturan, harga, data produk, SOP) terintegrasi dengan AI Assistant.

### 16.1 Backend - Knowledge Module
- [x] Prisma model `Knowledge` (id, title, content, type, active, timestamps)
- [x] `KnowledgeRepository` — CRUD + findActive + toggleActive + findByTitle
- [x] `KnowledgeService` — getActiveContext() gabungkan semua knowledge aktif
- [x] `KnowledgeController` — GET/POST/PATCH/DELETE `/api/v1/knowledge`
- [x] `KnowledgeModule` registered di `AppModule`

### 16.2 Chat Controller Integration
- [x] `ChatController` gunakan `KnowledgeService` bukan file system scanning
- [x] `getActiveKnowledgeContext()` async, baca dari DB
- [x] System prompt diperbarui: instruksi lengkap penggunaan knowledge (harga, aturan, rumus)

### 16.3 Frontend - KnowledgePage (Real API)
- [x] Fetch knowledge dari API (`/api/v1/knowledge`)
- [x] Create knowledge via API (judul + isi teks)
- [x] Toggle active/nonaktif via API
- [x] Hapus knowledge via API
- [x] Preview modal tampilkan isi knowledge
- [x] Loading state, empty state, search & filter

### 16.4 Canvas Panel Enhancements
- [x] Canvas title dinamis berdasarkan tool (Kalkulasi Harga, Ekstraksi Data, Dokumen Export)
- [x] CanvasPanel header tampilkan judul canvas

---

## Phase 17: Knowledge Upload & Chat Polish ✅ DONE

**Goal:** File-based knowledge upload, chat reliability fixes, UI/UX improvements, knowledge tuning from chat.

### 17.1 Knowledge Upload (Backend)
- [x] `POST /knowledge/upload` — Upload file (PDF/DOCX/TXT/MD/CSV), extract text, save to KB
- [x] Multer middleware with file type validation and size limit (10MB)
- [x] Auto-generate title from filename
- [x] Text extraction: pdf2json (PDF), mammoth (DOCX), csv-parse (CSV), fs (TXT/MD)

### 17.2 Knowledge Upload (Frontend)
- [x] File upload modal with drag-and-drop
- [x] Visual loading feedback (4 steps: Upload → Extract → Save → Done)
- [x] Step indicator with progress dots and checkmarks
- [x] Remove old text-only form (Judul Acuan, Deskripsi Singkat no longer needed)

### 17.3 Chat Reliability Fixes
- [x] Fix thinking indicator flicker (race condition with optimistic messages)
- [x] `effectiveChatId` state — consistent query keys on new chat creation
- [x] `await queryClient.invalidateQueries()` — messages refetched before mutation settles
- [x] Error handling — remove optimistic message on API error
- [x] Removed `waitingForResponse` state — use `sendMessage.isPending` directly

### 17.4 AI Service Improvements
- [x] Remove aggressive content stripping regex (The user, Let me, I need, etc.)
- [x] Empty response fallback — return polite message instead of empty string
- [x] Increase `max_tokens` from 2048 to 4096
- [x] System prompt: knowledge base controls format output, modular rules

### 17.5 Knowledge Tuning from Chat
- [x] System prompt: "Knowledge Tuning" mode — LLM updates KB from user feedback
- [x] User gives format feedback → LLM reads active KB → updates via `save_knowledge` tool
- [x] Confirms update to user + shows new format example

### 17.6 UI/UX Improvements
- [x] Logo SVG fix — `fill:currentColor` replaced with `fill:#111827` for img tag compatibility
- [x] CanvasPanel — markdown rendering for canvas content (was raw text)
- [x] MessageBubble — custom markdown components (table, code, bold, lists, blockquote)
- [x] ChatInput — slash command menu (`/knowledge`, `/search`, `/calculate`, `/export`)

### 17.7 Knowledge Content Updates
- [x] `garment.md` updated: chat format (sapaan + plain text + penutup)
- [x] `garment.md` updated: canvas format (**BRAND COLOR** or **[BRAND] [WARNA]**)
- [x] `garment.md` updated: header rules (brand/warna → use product name, kosong → use product name too)
- [x] Knowledge base synced to database via API

### 17.8 save_knowledge Tool
- [x] `KnowledgeBuilderTool` created — `save_knowledge` tool for LLM
- [x] Upsert logic via `KnowledgeRepository.findByTitle()` — update if exists, create if new
- [x] Registered in `ToolRegistryService` with 5000ms timeout
- [x] Exported via `ToolsModule`

---

## Current Status

**Phase:** Phase 17 Complete — Knowledge Upload & Chat Polish ✅  
**Next:** Workspace Agent mode or additional AI Assistant features

---

## File Structure

```
apps/api/src/
├── common/            ✅
├── config/            ✅
├── logger/            ✅
├── modules/
│   ├── workspace/     ✅
│   ├── source/        ✅
│   ├── chat/          ✅
│   ├── ai/            ✅
│   ├── file/          ✅
│   ├── parser/        ✅
│   ├── storage/       ✅
│   ├── search/        ✅
│   ├── artifact/      ✅
│   ├── knowledge/     ✅
│   └── tools/         ✅ (Enterprise Tools + save_knowledge)
├── app.module.ts
└── main.ts

apps/web/src/
├── components/
│   ├── chat/          ✅ (ChatMessages, ChatInput, MessageBubble, CanvasPanel)
│   └── layout/        ✅ (Sidebar, AppLayout)
├── pages/             ✅ (ChatPage, WorkspacePage, KnowledgePage, SettingsPage)
├── App.tsx
└── main.tsx
```

---

## Development Rules

1. **Backend first, Frontend second** — Always complete backend API before building frontend.
2. **Module isolation** — Each module has its own folder with repository, service, controller, DTOs.
3. **Repository Pattern** — Never call Prisma directly from services.
4. **AI Engine never touches Storage/DB directly** — Always through Service layer.
5. **API response format** — Always `{ data, error, meta }`.
6. **API key security** — AI keys stay in backend `.env`, never exposed to frontend.
7. **Commit after each module** — Small, focused commits.
8. **Knowledge Base is source of truth** — AI output format driven by KB, not hardcoded rules.
9. **Modular system prompt** — No domain-specific rules in code; KB controls behavior.
