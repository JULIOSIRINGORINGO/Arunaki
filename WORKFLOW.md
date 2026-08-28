# WORKFLOW.md - Development Roadmap

**Version:** 1.2  
**Last Updated:** 2026-08-24

---

## Overview

This document defines the **fixed development sequence** for Arunaki — **Sandboxed Computer Use Agent**. Setiap fase membangun Arunaki agar setara dengan OpenClaw dalam kapabilitas computer use, tetapi semua operasi dibatasi ke Workspace folder.

Follow this order strictly. Do not skip phases or jump ahead without explicit approval.

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

## Phase 18: Modern UI Polish, Dynamic Chat Follow-ups & Canvas Fixes ✅ DONE

**Goal:** Sleek thin modern scrollbars, dynamic LLM follow-up handling, Canvas panel height expansion, and seamless canvas restoration on chat navigation.

### 18.1 UI & Layout Improvements
- [x] Custom thin scrollbar (6px width, rounded pill thumb, no browser arrow buttons) in `index.css`
- [x] Canvas Panel card sizing — fill almost full height (`h-full w-full`) with a clean 16px padding gap around

### 18.2 Chat Navigation & Canvas Restoration
- [x] `useEffect` state reset in `ChatPage.tsx` — reset optimistic messages, canvas data, downloads & artifacts when switching chats or starting a new chat
- [x] Automatic Canvas restoration from history — scans latest assistant message when opening an existing chat and restores Canvas content dynamically

### 18.3 Dynamic Follow-up & Knowledge Base Improvements
- [x] Removed synthetic `[CANVAS]` tags from system prompt & controller — restore natural LLM responses
- [x] `garment.md` updated: Size equivalence (`XXL` → `2XL`), deduplication consistency rules
- [x] `garment.md` updated: Dynamic follow-up rules for updates (e.g. "tambahin L 10") without repeating old anomaly notes

---

## Phase 19: AI Assistant 100% Modern & Smart Upgrade ✅ DONE

**Goal:** Transform Chat Mode AI Assistant into a 100% SOTA modern assistant with streaming, Tavily web search, Vision AI, interactive editable canvas, drag-and-drop uploads, and specialized business tools.

### 19.1 Real-Time Streaming & Orchestration
- [x] `AgentRunnerService` created for multi-turn ReAct execution loop & SSE event streaming
- [x] Backend endpoint `POST /chat/:id/stream` for token-by-token Server-Sent Events
- [x] Client POST streaming using `@microsoft/fetch-event-source` in `ChatPage.tsx`

### 19.2 Multimodal Vision & Web Search Tools
- [x] `WebSearchTool` (`web_search`) integrated via `@tavily/core` for real-time web search
- [x] `VisionAiTool` (`vision_ai`) integrated for physical receipts, invoices, and handwritten notes
- [x] Full Drag-and-Drop file overlay in `ChatPage.tsx`
- [x] Binary file attachment support (PDF, Docx, XLSX) using base64 encoding in `ChatInput.tsx`

### 19.3 Interactive Canvas & Smart Actions
- [x] Interactive Editable Canvas Panel (`CanvasPanel.tsx`) with inline edit mode & `[Terapkan & Update AI]` recalculation
- [x] Selective Smart Action Chips (`[📊 Unduh Excel]`, `[📄 Unduh PDF]`, `[💾 Simpan ke Knowledge]`) strictly scoped to structured data
- [x] Specialized operational tools: `unit_converter` (Yard/Meter, USD/IDR) and `draft_communication` (WhatsApp, Email, Quotation)

---

## Phase 20: Autonomous Workspace Agent Engine & UI ✅ DONE

**Goal:** Build the full end-to-end Autonomous Workspace Agent mode (`/workspace`) with Goal-Oriented execution, multi-document search engine, tools, SSE streaming, live progress logs, and Safety Approval Gate.

### 20.1 Workspace Multi-Document Engine & Streaming (Backend)
- [x] `WorkspaceRunnerService` created for multi-document workspace context injection, autonomous ReAct loop, and SSE streaming
- [x] Backend endpoint `POST /workspaces/:id/agent/stream` for real-time plan events, tool execution, and approval requests
- [x] Registered `WorkspaceRunnerService` in `WorkspaceModule`

### 20.2 Workspace Tools & Safety Approval Gate (Backend)
- [x] `WorkspaceToolsService` created with mature open-source tools:
  - `search_workspace` — FTS5 keyword & content search across all workspace files
  - `list_workspace_files` — Scan directory structure & file metadata
  - `read_workspace_file` — Extract text from PDF, Docx, XLSX, CSV, TXT files via `DocumentReaderTool`
  - `write_workspace_file` — Generate new workspace documents (Excel, PDF, Word, TXT, JSON) via `DocumentGeneratorTool`
- [x] Safety Approval Gate event handling (`approval_required`) for data-mutating tools (`write_workspace_file`, `update_workspace_file`, `delete_workspace_file`)

### 20.3 Autonomous Workspace Agent UI (Frontend)
- [x] Goal Input Prompt Bar in `WorkspaceDetailPage.tsx` for submitting high-level goals
- [x] Live Progress Log & Autonomous Plan display (`plan_created`, `thinking`, `tool_start`, `tool_done`, `done`)
- [x] Prominent Safety Approval Gate Alert Banner with `[Izinkan & Lanjutkan]` and `[Tolak]` buttons
- [x] Studio / Output Artifact Store list for generated workspace files (.xlsx, .pdf, .docx)

---

## Phase 21: Domain Config System (Plugin System for Business) ✅ DONE

**Goal:** Dynamic industry domain configuration engine replacing hardcoded rules with 15+ Indonesian business templates, DB storage, and Web UI builder.

### 21.1 Backend - Prisma Schema & Domain Module
- [x] Model `DomainConfig` in `schema.prisma` with SQLite & Prisma ORM generation
- [x] `DomainRegistryService` — Dynamic resolution of domain units, terminology, formulas, and report templates
- [x] `DomainController` — REST API (`GET /api/v1/domains`, `GET /api/v1/domains/:key`)
- [x] 15+ Indonesian Industry JSON Templates (`garment.json`, `restaurant.json`, `retail.json`, `manufaktur.json`, `apotek.json`, `bengkel.json`, `laundry.json`, `minimarket.json`, `distributor.json`, `percetakan.json`, `petshop.json`, `salon.json`, `kontraktor.json`, `ekspedisi.json`, `generic.json`)

### 21.2 Frontend - Workspace & Knowledge UI
- [x] `CreateWorkspaceModal.tsx` — Dynamic Industry Domain Selector (15 Indonesian industry options)
- [x] `KnowledgePage.tsx` — Domain System tab rendering active industry domain templates & specs

---

## Phase 22: Proactive Cron Scheduler & Automated Web Reports ✅ DONE

**Goal:** Background automated report generation engine for scheduled business reports (RUG, Laba Rugi, Neraca, Stok) saved to Workspace Artifact Store.

### 22.1 Backend - Cron Module & Database Schema
- [x] Model `ScheduledReport` in `schema.prisma` with SQLite & Prisma ORM generation
- [x] `CronService` — Interval scheduler executing automated report generation using `DocumentGeneratorTool`
- [x] `CronController` — REST API (`GET`, `POST`, `PATCH /toggle`, `DELETE`, `POST /run`)
- [x] Workspace Artifact Store Integration — Auto-save generated `.xlsx`, `.pdf`, `.csv` reports

### 22.2 Frontend - Workspace Studio UI
- [x] `ScheduledReportsPanel.tsx` — Web UI panel for viewing, adding, toggling, and testing scheduled reports
- [x] `WorkspaceDetailPage.tsx` — Integrated `ScheduledReportsPanel` into Studio Right Panel

---

## Phase 31: Browser Interaction Service ✅ DONE

**Goal:** Visible browser interaction — Playwright-based browser automation with CDP connection for Google Docs/Sheets and web navigation.

### 31.1 Backend - Interaction Module & Browser Service
- [x] Installed `playwright` v1.61.1 in `apps/api/package.json` — previously only in root devDependencies
- [x] Created `InteractionModule` (`@Global()`) with `BrowserInteractionService`
- [x] `BrowserInteractionService` — manages headed Chromium lifecycle, provides core methods:
  - `launch()` — launch visible Chromium
  - `navigate(url)` — go to URL, return title + url
  - `click(selector)` — click element via CSS selector
  - `type(selector, text)` / `typeSlowly()` — type text into element
  - `screenshot()` — return PNG as base64
  - `getContent()` / `getHtml()` — read page text/HTML
  - `pressKey(key)` — keyboard shortcuts
  - `goBack()` / `goForward()` — navigation
  - `onModuleDestroy()` — cleanup
- [x] Wired into `ToolsModule` (provider list + exports)
- [x] Wired into `AppModule` (imports)

### 31.2 Browser Interaction Tools (8 tools)
- [x] `browser_navigate` — open web page (Google Docs, Sheets, etc.)
- [x] `browser_click` — click element by CSS selector
- [x] `browser_type` — fill text (with optional `slowly` mode)
- [x] `browser_screenshot` — capture visible page as base64 image
- [x] `browser_get_content` — read visible text from page
- [x] `browser_press_key` — keyboard shortcuts (Enter, Tab, Ctrl+C, etc.)
- [x] `browser_go_back` — navigate back
- [x] `browser_go_forward` — navigate forward

### 31.3 Prompt Updates
- [x] `rules.md` — Updated Section 7.4 with Google Sheet example + tool names
- [x] `rules.md` — Updated Error Handling table (browser diagnostic + recovery)
- [x] `chat-rules.md` — Added Section 6.5 Visible Web Interaction
- [x] Tools auto-injected via `{TOOL_LIST}` (Phase 30 dynamic injection)

### 31.4 Technical Details
- [x] Build passes (`npx nest build` — 0 errors)
- [x] Pattern follows OpenClaw's architecture (pure function tools, CDP connection)
- [x] Uses `playwright` full package (includes Chromium browser binary)
- [x] Limited to browser automation — desktop COM follows in next iteration

---

## Phase 32: Desktop Bridge Service ✅ DONE

**Goal:** Desktop COM Automation — Excel/Word/PowerPoint via Electron bridge + WebSocket.

### 32.1 Backend — DesktopBridgeService
- [x] `DesktopBridgeService` — WebSocket server (`ws://127.0.0.1:31524`) with request/response pattern
- [x] `sendCommand(method, args, timeout)` — Promise-based with timeout, auto-reject on disconnect/shutdown
- [x] `@Global()` `InteractionModule` provides both `BrowserInteractionService` + `DesktopBridgeService`
- [x] `@types/ws` installed for TypeScript types

### 32.2 Desktop Electron Client
- [x] `main.cjs` — WebSocket client with auto-reconnect (5s interval)
- [x] Command handlers: `openFile` (shell.openPath), `openExcel`/`openWord`/`openPpt` (COM via winax), `screenshot` (desktopCapturer)
- [x] Cleanup on `window-all-closed`

### 32.3 Desktop Interaction Tools (5 tools)
- [x] `desktop_open_file` — open any file in default desktop app
- [x] `desktop_open_excel` — open `.xlsx`/`.xls` in Microsoft Excel via COM
- [x] `desktop_open_word` — open `.docx`/`.doc` in Microsoft Word via COM
- [x] `desktop_open_ppt` — open `.pptx`/`.ppt` in Microsoft PowerPoint via COM
- [x] `desktop_screenshot` — capture full desktop screen via Electron `desktopCapturer`

### 32.4 Prompt Updates
- [x] `rules.md` — Updated Section 7.4 with desktop tool list + examples + error handling
- [x] `chat-rules.md` — Added Section 6.6 Desktop Application Interaction

### 32.5 Technical Details
- [x] Build passes (`npx nest build` — 0 errors)
- [x] Protocol: `{ type: 'call', id, method, args }` ↔ `{ type: 'result', id, data, error }`
- [x] `ws` v8.21.1 installed in both `apps/api` and `apps/desktop`
- [x] Desktop bridge auto-reconnects every 5s; tools return clear "not connected" error if Electron is down

---

## Phase 33: Enhanced Desktop Interactive Automation ✅ DONE

**Goal:** Interactive Desktop Computer Use — Write cells in Excel, format cells, type text in Word, format Word documents, and send keyboard shortcuts to active desktop windows.

### 33.1 Backend — DesktopBridgeService Helpers
- [x] `excelWriteCell` — Write value/formula to Excel cell (`A1`, `B2`)
- [x] `excelSetFormat` — Format Excel cells (bold, color, alignment)
- [x] `wordType` — Type text in Word document
- [x] `wordFormat` — Apply heading or formatting in Word
- [x] `sendKeys` — Send keyboard shortcuts (`Ctrl+S`, `Enter`, `Tab`)

### 33.2 Desktop Electron Client (`main.cjs`)
- [x] Handler `excelWriteCell` — COM manipulation via `winax`
- [x] Handler `excelSetFormat` — COM formatting via `winax`
- [x] Handler `wordType` — COM document typing via `winax`
- [x] Handler `wordFormat` — COM document formatting via `winax`
- [x] Handler `sendKeys` — Keyboard automation via WScript.Shell SendKeys / Electron

### 33.3 Interactive Desktop Tools (5 tools)
- [x] `desktop_excel_write_cell` — write value/formula to Excel cell
- [x] `desktop_excel_set_format` — set formatting on Excel cell
- [x] `desktop_word_type` — type text in Word document
- [x] `desktop_word_format` — set heading/formatting in Word
- [x] `desktop_send_keys` — send keyboard shortcut to focused desktop app

### 33.4 Prompt Updates & Testing
- [x] `rules.md` — Section 7.4 updated with interactive desktop tools
- [x] `chat-rules.md` — Section 6.6 updated with interactive desktop tools
- [x] `desktop-bridge.service.spec.ts` — unit tests for interactive desktop commands
- [x] Build passes (`npx nest build` — 0 errors) & Vitest tests pass (`npx vitest run`)

---

## Phase 34: Live Execution Feedback & Canvas Mirroring UI ✅ DONE

**Goal:** Live Execution Mirroring — Stream real-time desktop & browser action status badges, render auto-screenshot preview cards in Chat UI, and sync live desktop edits into Canvas Panel.

### 34.1 Backend SSE & Live Status Events
- [x] SSE `tool_live_status` events emitted during desktop/browser tool executions
- [x] Base64 screenshot payload included in live status events for desktop & browser
- [x] Live execution action history tracker per session

### 34.2 Frontend Web UI Components (`apps/web`)
- [x] `LiveExecutionBadge.tsx` — Real-time animated status pill in Chat & Workspace UI
- [x] `LiveMirrorCard.tsx` — Embedded live desktop/browser screenshot preview card in Chat Message stream
- [x] Live Canvas Sync in `CanvasPanel.tsx` — Update spreadsheet/document view when desktop cell writes or formats execute

### 34.3 Testing & Documentation
- [x] System prompts (`rules.md`, `chat-rules.md`) updated with live execution feedback guidelines
- [x] Dev log `docs/dev-logs/dev-log-2026-07-30-desktop-live-mirror.md` created using template in `AGENTS.md`
- [x] Build passes (`npx nest build` — 0 errors) & Vitest tests pass (`npx vitest run`)

## Phase 35: Multi-Document Cross-Referencing & Batch Reconciliation Engine ✅ DONE

**Goal:** Cross-document intelligence — Audit and reconcile structured data across Excel, PDF, Word, and CSV files in the workspace, flagging discrepancies and generating audit reconciliation matrices.

### 35.1 Backend — DocumentReconciliationService
- [x] Create `DocumentReconciliationService` (`doc-reconciliation.service.ts`)
- [x] Implement `reconcileDocuments()` — cross-reference fields (Amount, Date, ID, Items) across multiple files
- [x] Implement discrepancy matrix calculation (missing entries, value variances, match confidence)

### 35.2 Reconciliation Tools
- [x] `doc_reconcile` — Compare & audit 2 or more workspace documents (Excel vs PDF vs Word)
- [x] `doc_cross_reference` — Find entity/invoice occurrences across all workspace files

### 35.3 Prompt Updates & Canvas Integration

## Phase 36: Smooth Live Typing & Visual Desktop Execution Stream ✅ DONE

**Goal:** Transparent Digital Employee — Render real-time live typing animations in Word & sequential cell population in Excel via COM API background streaming without touching user mouse/keyboard.

### 36.1 Desktop Electron Client (`main.cjs`)
- [x] Handler `wordType` — Add `smoothStream` & `delayMs` support for realistic word-by-word live typing in active Word window
- [x] Handler `excelWriteCell` — Add sequential row/cell fill animation support for Excel tables

### 36.2 Backend & Interactive Desktop Tools (`apps/api`)
- [x] Update `DesktopBridgeService.wordType()` to pass `smoothStream` and `delayMs` parameters
- [x] Update `desktop_word_type` tool parameters in `ToolsProviderModule`

### 36.3 Testing & Documentation
- [x] Update `rules.md` & `chat-rules.md` with live desktop typing guidelines
- [x] Unit tests in `desktop-bridge.service.spec.ts`
- [x] Dev log `docs/dev-logs/dev-log-2026-07-30-desktop-smooth-live-typing.md` created using template in `AGENTS.md`
- [x] Build passes (`npx nest build` — 0 errors) & Vitest tests pass (`npx vitest run`)

---

## Phase 37: Sub-Agent Delegation & Parallel Task Execution (`agent_spawn`) ✅ DONE

**Goal:** Sub-Agent Delegation Engine — Enable primary agent to spawn background sub-agents (`agent_spawn`) for parallel execution of complex sub-tasks, boosting multi-document and multi-source processing speed.

### 37.1 Backend — SubAgentRunnerService
- [x] Create `SubAgentRunnerService` (`sub-agent-runner.service.ts`)
- [x] Implement `spawnSubAgent()` — isolated execution loop with custom tool scoping and result aggregation

### 37.2 Sub-Agent Tool Registration
- [x] `agent_spawn` — tool for delegating sub-tasks (task description, task name, allowed tool list)

### 37.3 Prompt Updates & Web UI SSE Events
- [x] Update `rules.md` & `chat-rules.md` with sub-agent delegation guidelines
- [x] Emit SSE events `sub_agent_spawned` & `sub_agent_completed` for real-time Web UI progress tracking
- [x] Unit tests `sub-agent-runner.service.spec.ts` (6 tests passed)
- [x] Dev log `docs/dev-logs/dev-log-2026-07-30-sub-agent-delegation.md` created using template in `AGENTS.md`
- [x] Build passes (`npx nest build` — 0 errors) & Vitest tests pass (`npx vitest run` — 16/16)

---

## Phase 38: Multi-Model Auto-Failover & Production Packaging Readiness ✅ DONE

**Goal:** Production Readiness & Resilience — Verify multi-model failover under HTTP 429 rate limits, test model rotation fallback streams, write failover unit tests, and validate production desktop build scripts.

### 38.1 Multi-Model Failover Unit Testing
- [x] Add unit tests for `ProviderService` error classification (HTTP 429, 401, 403, 503, 500)
- [x] Add unit tests for `runWithModelFallback` & candidate pool rotation in `provider.service.spec.ts` (9 tests passed)

### 38.2 Desktop Production Packaging Verification
- [x] Verify production Electron main process initialization and packaging configuration (`apps/desktop`)
- [x] Verify environment templates (`.env.example`) and NestJS production build output

### 38.3 Testing & Documentation
- [x] Dev log `docs/dev-logs/dev-log-2026-07-30-phase-38-failover-packaging.md` created using template in `AGENTS.md`
- [x] Build passes (`npx nest build` — 0 errors) & Vitest tests pass (`npx vitest run` — 25/25)

---

## Phase 39: Enterprise Secrets Vault & Agent Trajectory Audit Engine ✅ DONE

**Goal:** Enterprise Security & Auditability — Implement AES-256-GCM encrypted local secrets vault for credential management, and step-by-step reasoning/tool execution trajectory audit engine with export capabilities.

### 39.1 Secrets Vault Engine (`secrets-vault.service.ts`)
- [x] Create `SecretsVaultService` — AES-256-GCM encryption/decryption for API keys & credentials (5 tests passed)
- [x] Integrate with `ProviderService` for secure credential resolution

### 39.2 Trajectory Audit Engine (`trajectory-audit.service.ts`)
- [x] Create `TrajectoryAuditService` — structured reasoning & tool execution trajectory recorder
- [x] Implement `exportTrajectoryJson()` for enterprise audit compliance reporting (4 tests passed)

### 39.3 Testing & Documentation
- [x] Unit tests in `secrets-vault.service.spec.ts` & `trajectory-audit.service.spec.ts`
- [x] Dev log `docs/dev-logs/dev-log-2026-07-30-phase-39-secrets-trajectory.md` created using template in `AGENTS.md`
- [x] Build passes (`npx nest build` — 0 errors) & Vitest tests pass (`npx vitest run` — 34/34)

---

## Phase 40: Autonomous Recurring Report Cron & Background Task Scheduler ✅ DONE

**Goal:** Autonomous Background Autonomy — Enable agent to schedule, list, and trigger recurring background document reports and agent tasks via cron expressions and interval timers.

### 40.1 Cron Tools Integration (`tools-provider.module.ts`)
- [x] Inject `CronService` into `ToolsProviderModule`
- [x] Register `schedule_cron_job` tool — schedule recurring report / agent run
- [x] Register `list_cron_jobs` tool — view active cron jobs in workspace
- [x] Register `delete_cron_job` tool — remove scheduled cron job

### 40.2 Testing & Documentation
- [x] Create unit tests `cron.service.spec.ts` (4 tests passed)
- [x] Dev log `docs/dev-logs/dev-log-2026-07-30-phase-40-cron-scheduler.md` created using template in `AGENTS.md`
- [x] Build passes (`npx nest build` — 0 errors) & Vitest tests pass (`npx vitest run` — 38/38)

---

## Phase 41: Security Audit Fixes (Layers 1-5) ✅ DONE

**Goal:** Address critical architecture and security gaps identified in the comprehensive 32-layer audit.

### 41.1 Layer 4: Persistence & Auth
- [x] Wire `SecretsVaultService` into `ProviderService` to encrypt API keys (Audit 4.1).
- [x] Implement Global `AuthGuard` for all API controllers (Audit 4.2).

### 41.2 Layer 5: Desktop Bridge Auth
- [x] Implement WebSocket connection validation with `token` on backend (Audit 5.4).
- [x] Send token via query parameter from Electron frontend.

---

## Phase 42: Referenced File Safety ✅ DONE

**Goal:** Make `@filename` a mandatory read-before-update reference instead of plain prompt text.

- [x] Detect explicit `@filename.ext` references before the LLM tool loop.
- [x] Read referenced document content and inject it as structured agent context.
- [x] Block writes to a different file during a referenced-file run.
- [x] Block saving raw `@filename` instructions as document content.
- [x] Add mention extraction unit tests and verify API build.
- [x] Guard delete globally: explicit delete intent plus exact filename required; referenced files cannot be deleted or renamed during edit runs.

---

## Phase 43: Preemptive Compaction & Aggregate Tool-Result Budget ✅ DONE

**Goal:** OpenClaw-inspired pre-prompt context guard — compact BEFORE sending instead of letting the provider reject an over-budget prompt, and cap the aggregate size of all tool results so they can't eat the whole context window.

### 43.1 Preemptive Pressure Estimation (`context-manager.ts`)
- [x] `estimatePromptTokens()` — message-boundary overhead (12 tokens/msg) + role-weighted chars-per-token (4 for prose, 2 for tool results, 3 for JSON tool-call args), mirroring OpenClaw `preemptive-compaction.ts`.
- [x] `compress(messages, contextLength?)` — optional real model context override so the 25% trigger threshold tracks the actual model window (e.g. 32K models) instead of the hardcoded 128K default.

### 43.2 Aggregate Tool-Result Budget (`context-manager.ts`)
- [x] `enforceAggregateToolResultBudget(messages, contextWindow)` — total tool-result chars ≤ 50% of context window (OpenClaw `AGGREGATE_TOOL_RESULT_CONTEXT_SHARE=0.5`); truncates OLDEST results first, keeps the last 3 intact.

### 43.3 Wiring (`ai.service.ts`)
- [x] `preemptivelyCompact()` private method — runs both guards before every `chat()` and `chatStream()` request; compacts only when estimated prompt tokens exceed `contextWindow − max_tokens` reserve.
- [x] Unit tests `context-manager.spec.ts` (4 tests) — aggregate truncation order, token-weighting, model-context compress override.

### 43.4 Route Decision & Thinking-Block Strip (OpenClaw round 2)
- [x] Route-based compaction — `estimateToolResultReduction()` estimates how many chars `truncateToolResultsOnly()` (Phase 1-only, history-preserving) could free; if it comfortably covers the overflow (buffer `max(overflow+2048, 1.5×overflow)`) use truncate-only, else full `compress()`. Mirrors OpenClaw `compact_only` / `truncate_tool_results_only` / `compact_then_truncate` routing.
- [x] `stripThinkingFromContext()` — removes `<think>...</think>` blocks from all assistant messages except the latest before sending (OpenClaw `dropThinkingBlocks`), so reasoning is never replayed to the provider.

### 43.5 Testing & Documentation
- [x] Build passes (`npx nest build` — 0 errors) & Vitest passes (`npx vitest run` — 89/89)
- [x] Dev log `docs/dev-logs/dev-log-2026-08-04-preemptive-compaction-aggregate-budget.md` created using template in `AGENTS.md`

---

## Phase 44: Desktop ↔ Web ↔ API Connectivity & Workspace Restore UX ✅ DONE

**Goal:** Fix broken folder connection flow in the Electron desktop app — desktop app couldn't reach the API (auth), and the web UI restored the wrong workspace on launch. Make folder opening VS Code-like: remembers last folder + one-click "Recent Folders".

### 44.1 Desktop Bridge Auth Fix
- [x] Root cause: `apps/desktop/main.cjs` env loader only read `apps/desktop/.env` (missing) → desktop sent empty token → `desktop-bridge.service.ts:41-49` rejected with `ws.close(1008,'Unauthorized')`. Log "Connected to backend" prints on `open` before server closes (misleading).
- [x] Fix: loader falls back to `apps/api/.env` (existing `process.env` wins). Requires desktop app restart. Commit `4c32bab`.

### 44.2 Web UI Auth Fix (`apps/web/.env`)
- [x] Root cause: API has global `AuthGuard` (`security/auth.guard.ts:17-21`) requiring `x-api-key` == `ARUNAKI_API_KEY`. Web UI only sends it when `VITE_ARUNAKI_API_KEY` is set, but `apps/web/.env` was missing → every API call 401 → folder list empty. (Also confirms: desktop and API were in fact connected — WS `OPEN`, `/workspaces` 200 with key.)
- [x] Fix: created `apps/web/.env` with matching key (gitignored, untracked). Requires Vite restart.

### 44.3 Workspace Restore Bug (`WorkspacePage.tsx:498`)
- [x] Root cause: restore ignored `arunaki_workspace_id` in localStorage and used `workspaces.find(ws => ws.rootPath)` — always the newest workspace (Rollover QA), never the last one the user connected.
- [x] Fix: prefer `localStorage.getItem('arunaki_workspace_id')` when it still exists with a `rootPath`, fall back to first-with-rootPath.

### 44.4 Recent Folders (VS Code-style open)
- [x] Added `useQuery(["workspaces"])` list + `handleReconnectFolder()`; the "Buka Folder" modal now shows a **Recent Folders** list — one click reconnects (sets workspace, loads tree, invalidates files, restores localStorage).

### 44.5 Workspace DB Cleanup
- [x] Deleted 4 junk workspaces via `DELETE /workspaces/:id` (all relations `onDelete: Cascade`): Rollover QA (pending, temp folder) + 3× duplicate `laporan-test`. DB now empty — user picks fresh folder on next launch.

### 44.6 Testing & Documentation
- [x] `npx tsc -b --noEmit` (apps/web) — exit 0; Vite dev server HMR picks up changes (Electron reload/restart needed).
- [x] Dev log `docs/dev-logs/dev-log-2026-08-04-connectivity-workspace-restore.md` created.

### 44.7 VS Code-style Alignment (`WorkspacePage.tsx`)
- [x] **Dedupe by folder path** — connecting a folder that already has a workspace reuses it (`handleReconnectFolder`) instead of creating a duplicate; path compared normalized (case/slash-insensitive). Prevents the 3× duplicate mess.
- [x] **Switch folder without disconnect** — "Terhubung: {name}" button now opens the "Buka Folder" modal (Recent Folders + picker) instead of disconnecting; added a "Putuskan Koneksi" action inside the modal.
- [x] **Folder path visible** — header subtitle shows `{fileCount} file terhubung — {rootPath}`; `document.title` = `{folderName} — Arunaki` (drives the Electron window title).
- [x] `handleReconnectFolder` moved before `handleConnectFolder`; `workspacesList` query hoisted above both (TS TDZ); workspaces query invalidated after every new connect.

### 44.8 Tool-Path Workspace Isolation Hardening
- [x] `document_reader` & `image_ocr` now require `workspaceId`; handler resolves filePath against workspace root via new `WorkspaceToolsService.resolveWithinWorkspace()`.
- [x] `WorkspaceToolsService.requirePathInWorkspace` & `SelfHealingService.validateWorkspacePath` switched to `path.relative` containment (fixes prefix-match flaw like `C:\ws` vs `C:\ws2`).
- [x] `SelfHealingService.validateToolPaths` made public + `AgentRunner` (sync & stream) merges trusted `workspaceId` from `ChatHistory` and validates path-like args before execution.
- [x] `AgentRunParams.workspaceId` threaded through `ChatController` (sync + stream).
- [x] Dev log `docs/dev-logs/dev-log-2026-08-04-apply-tool-middleware-pipeline.md` created.
- [x] Build passes (`npm run build` — 0 errors).

### 44.9 Tool Argument Schema Validation Hardening
- [x] Gap-analysis check: `validateArgs` (tool-registry.service.ts) hanya memeriksa string/number/array/enum/required — `boolean` & `object` tidak divalidasi (7+ param boolean di tools-provider module lolos tipe salah tanpa ketahuan).
- [x] `validateArgs` sekarang memeriksa `boolean` dan `object` (tolak array/null — null optional tetap dianggap absent).
- [x] Spec baru `tool-registry.service.spec.ts` — 4 test pass (valid args, boolean salah tipe, object salah tipe, null optional lolos).
- [x] Build passes (`npm run build` — 0 errors). Dev log `docs/dev-logs/dev-log-2026-08-05-tool-args-validation.md` created.

### 45.0 Parallel Tool Execution Consistency (Gap #1)
- [x] Sync path `runAgentSyncInternal` (agent-runner.service.ts) diubah dari `for...await` sequential ke `Promise.all` — konsisten dengan stream path; `onToolStart` semua dipanggil dulu, eksekusi paralel, hasil emit dalam urutan tool_calls asli (tool_call_id konsisten).
- [x] Read-only tools di workspace-runner.service.ts (mode utama: Excel/Word hosting) diubah dari `for` sequential ke `Promise.all` dengan urutan hasil dipertahankan. Mutating tools tetap sequential (dependensi antar tool).
- [x] Komentar menyesatkan `// Execute read-only tools in parallel with SelfHealing` diganti jadi akurat.
- [x] Test `workspace-runner.service.spec.ts`: 3 read-only calls independen → `maxActive > 1` (paralel), `tool_done` berurutan sesuai tool_calls, event `parallel (...)`.
- [x] Build passes (`npm run build` — 0 errors); semua test workspace + chat pass.

### 45.1 Explicit Todo/Plan Tool untuk LLM (Gap #6)
- [x] Gap-analysis check: tidak ada working-memory eksplisit untuk LLM. `workspace-runner.service.ts:941-961` hanya meng-infer event `plan_created` untuk UI — bukan tool yang bisa dipanggil LLM.
- [x] `TodoStoreService` (baru, `apps/api/src/modules/tools/services/todo-store.service.ts`) — per-run store: `set/get/clear/has/serialize`; interface `TodoItem { id, content, status: 'pending'|'in_progress'|'completed' }`; `serialize()` → blok `=== TODO LIST ===` untuk disisipkan ke system prompt.
- [x] Tool `todo_write` diregistrasi di `tools-provider.module.ts` via `ToolAdapter.from` (catalog-only; butuh array `todos` lengkap, bukan delta; schema status enum). `TodoStoreService` di-provide + export dari `ToolsProviderModule` & `ToolsModule`.
- [x] Workspace runner: `todoStore.clear(workspaceId)` di awal run; tiap round injeksi blok todo in-place (update satu pesan system, hapus jika kosong) sebelum `aiService.chat`.
- [x] Agent runner (sync + stream): inject todo per round dengan `todoRunId = idempotencyKey || 'chat:<chatId>'`, `runId` di-thread ke args tool agar tulis-ke-run yang benar.
- [x] `rules.md`: tugas >3 langkah wajib tulis plan via `todo_write`; 1-2 langkah tidak perlu.
- [x] Test: `todo-store.service.spec.ts` (3 test: set/get/clear, format serialize, serialize kosong) + test injeksi 2-round di `workspace-runner.service.spec.ts` (todo_write → read → cek pesan system round 2 berisi `- [in_progress] 1: Baca file`). Semua pass.
- [x] Build passes (`npm run build` — 0 errors).

### 45.2 Tokenizer Akurat (tiktoken) Dipakai untuk Keputusan (Gap #2)
- [x] Gap-analysis check: `estimateTokens()` (context-manager.ts:643) pakai heuristik char/4 untuk SEMUA keputusan compaction/budget; `countTokens()` tiktoken di ai.service.ts jadi dead code.
- [x] Util baru `apps/api/src/modules/ai/tokenizer.ts` — `countTokens(text)` pakai `encoding_for_model('gpt-4')` (cl100k_base) dengan fallback char/4 hanya saat tiktoken throw, + bounded string cache (10k entries) supaya tidak re-encode pesan yang sama tiap round.
- [x] `ContextManager.estimateTokens()` sekarang memakai tokenizer asli (bukan char/4) untuk content + tool_calls.
- [x] `AiService.countTokens()` delegasi ke util yang sama (tidak lagi dead code).
- [x] Test: 2 test baru di `context-manager.spec.ts` — teks Bahasa Indonesia panjang & JSON tool result dihitung exact dengan tiktoken (bukan heuristik).
- [x] Build passes (`npm run build` — 0 errors); semua test ai module pass (32/32).

### 45.3 Dedup/Cache Hasil Tool Call (Gap #3)
- [x] Gap-analysis check: `ToolLoopDetectorService` hanya mendeteksi loop, tidak menyimpan hasil; `executeTool()` tidak punya layer cache.
- [x] `Tool` interface + `ToolAdapter` + `ToolConfig` punya field `cacheable` (default false).
- [x] `executeTool()` cek cache dulu untuk tool `cacheable=true` — key `scope:name:hash(args)`, scope = `workspaceId || runId || 'default'`, TTL 60s, bounded 1000 entries.
- [x] Invalidasi otomatis per-scope saat tool mutating jalan (write/update/delete/rename/desktop write) — karena semua tool call lewat `executeTool`, satu guard cukup.
- [x] `cacheable: true` untuk `doc_search`, `search_workspace`, `list_workspace_files`, `read_workspace_file`. TIDAK untuk `web_search` (hasil berubah) & tool mutating.
- [x] Log `[CACHE HIT]` saat reuse untuk observability.
- [x] Test 3 kasus baru di `tool-registry.service.spec.ts`: cache hit (handler 1x), non-cacheable tidak di-cache (2x), invalidasi scope saat mutating tool (re-execute).
- [x] Build passes (`npm run build` — 0 errors); semua test tools module pass (19/19).

### 45.4 Context-Engine Baru Wired ke Chat Mode (Gap #4)
- [x] Gap-analysis check: `ContextQuarantine` (sanitasi prompt-injection) hanya dipakai workspace mode; chat mode inject `knowledgeContext` tanpa sanitasi; `ContextRegistry` di-`@Optional @Inject` di ai.service.ts tapi tidak dipanggil.
- [x] `AgentRunnerService` inject `ContextQuarantine`; `knowledgeContext` di-sanitize sebelum masuk `getSystemPrompt()` di jalur sync (`runAgentSyncInternal`) DAN stream (`runAgentStreamInternal`) — proteksi konsisten dengan workspace mode.
- [x] `sanitizeText` di-`ContextQuarantine` di-expose public (private method di-rename `sanitizeTextInternal`).
- [x] Dead injection dibersihkan: `@Optional() @Inject(ContextRegistry)` + import dihapus dari `ai.service.ts`.
- [x] Test baru `context-quarantine.service.spec.ts` (3 test): knowledge-context injection ter-quarantine, sanitasi via `sanitizeAssemblyParams`, teks bersih tidak berubah.
- [x] Build passes (`npm run build` — 0 errors); semua test chat + quarantine + ai service pass.

### 45.5 Rollback/Checkpoint Multi-Step Mutating Ops (Gap #8)
- [x] Gap-analysis check: loop `mutatingCalls` mengeksekusi mutasi satu-per-satu langsung tulis disk tanpa mekanisme "kalau langkah ke-N gagal, undo 1..N-1" → workspace bisa ditinggalkan dalam state inkonsisten.
- [x] Sebelum loop mutating dimulai, `snapshotFile()` (workspace-runner.service.ts) menyimpan isi file target (`filename`/`path` dari args, di-resolve via rootPath + validated) ke array `checkpoints` — compensating transaction (rekomendasi #2, lebih ringan dari snapshot penuh).
- [x] Jika satu mutasi di putaran gagal (`result.status === 'error'`), `rollbackSnapshots()` mengembalikan semua file yang disentuh putaran itu ke state sebelum putaran (write-back content lama, hapus file yang tadinya tidak ada) — sekali per putaran (`rollbackNotified`).
- [x] User diberi notifikasi jelas: `onEvent({ type: 'error', data: { message: 'Sebagian perubahan dibatalkan otomatis...' } })`.
- [x] Test 2 kasus baru di `workspace-runner.service.spec.ts`: (a) mutasi a.txt sukses lalu b.txt gagal → `writeBuffer(a.txt, v1)` dipanggil + event error rollback muncul; (b) seluruh mutasi sukses → tidak ada rollback (`writeBuffer`/`deleteFile` tidak dipanggil).
- [x] Build passes (`npm run build` — 0 errors); semua test workspace (9/9), chat, dan tools pass.

### 45.6 Run-Level Token Budget Enforcement (Gap #9)
- [x] Gap-analysis check: tidak ada enforcement cost/token budget — MAX_ROUNDS workspace (25) dan chat (5) membatasi jumlah putaran tapi bukan total token; sub-agent dapat di-spawn paralel tanpa akumulasi biaya.
- [x] `token-budget.service.ts` baru (AI module): `RunTokenBudget` (used/limit/remaining/exceeded, `consume()` abaikan non-finite/≤0), `createRunBudget()` (limit dari `RUN_TOKEN_BUDGET` env, default 200_000), `enterRunBudget()` / `currentRunBudget()` via `AsyncLocalStorage` — budget terikat ke run aktif.
- [x] `workspace-runner.service.ts`: budget dibuat + di-enter di awal generator; tiap `aiService.chat()` meng-consume `usage.totalTokens`; jika `exceeded`, run dihentikan dengan pesan jelas + `onEvent` error berisi `{ message, budget }`.
- [x] `agent-runner.service.ts` jalur sync & stream: budget dibuat + di-enter; consume tiap round; berhenti saat `exceeded` dengan pesan yang sama (sync: lewat `finalContent`, stream: + `onEvent` error).
- [x] Gap #11 – Self‑Healing fallback map & end‑to‑end test (self‑healing.service.ts)
- [x] Gap #12 – Adaptive retry loop (error reassign + guard) (self‑healing.service.ts)
- [x] Gap #13 – Path traversal hardening in validateToolPaths (self‑healing.service.ts)
- [x] Gap #14 – Token‑based compaction trigger (compaction.service.ts)
- [x] Gap #15 – LLM summary input cap (compaction.service.ts)
- [x] Gap #16 – Tool‑loop per‑run isolation (tool‑loop‑detector.service.ts)
- [x] Gap-analysis check: `SessionSearchService` hanya FTS5 keyword MATCH (+ fallback LIKE) — query sama-makna-bedakata (`"harga jual"` vs `"nilai penjualan"`) tidak match. FTS5 tetap pilihan masuk akal untuk local-first, jadi pendekatan hybrid (FTS5 lapisan pertama, semantic fallback lapisan kedua).
- [x] Dependency baru (disetujui user): `@xenova/transformers` v2 (transformers.js, ONNX on-device) + model `Xenova/all-MiniLM-L6-v2` (384-dim, quantized, ~90MB didownload sekali pada penggunaan pertama). Alternatif ditimbang: `sqlite-vec` — ditolak karena hanya menyimpan/hitung jarak, tetap butuh model embedding, plus native compile risk di Windows.
- [x] `semantic-search.service.ts` baru (memory module): lazy pipeline loading; `embed()` (mean pooling + normalize); `semanticSearch()` — cosine similarity atas embedding yang di-cache di tabel SQLite `message_embeddings`, filter skor ≤0.35, kembalikan `[]` (bukan throw) saat model gagal load agar layer FTS5 tidak pernah terdegradasi.
- [x] Backfill embedding on-demand per batch (LIMIT 200 messages per panggilan, batch embed 20) — model hanya dipanggil sekali per message, bukan per query.
- [x] `SessionSearchService.search()` hybrid: FTS5 primary; jika hasil <3, ambil semantic results, dedup by messageId, merge + sort by rank, potong ke limit.
- [x] `memory.module.ts`: `SemanticSearchService` didaftarkan sebagai provider + export.
- [x] Test baru: `semantic-search.service.spec.ts` (6 test: init table, embed single, kosong → `[]`, ranking cosine, filter skor rendah, swallow error pipeline) + `session-search.service.spec.ts` (5 test: FTS5 cukup, supplement sparse, dedup, respect limit, fallback LIKE saat FTS5 throw).
- [x] Fix bug: `new Float32Array(row.embedding)` memperlakukan Buffer sebagai array elemen → `bufferToFloat32()` reinterprets bytes sebagai Float32.
- [x] Build passes (`npm run build` — 0 errors); model diverifikasi load & embed (384-dim); semua test api pass (119/119).


## Phase 46: Exact UI Redesign & Popup Chat Docking ✅ DONE

**Goal:** Transform Arunaki Web/Desktop UI to match the user's reference mockup with exact color palette (Cream `#F4EFE6`, Dark Charcoal `#1A191B`, Coral Orange `#FF5E38`, Lilac Purple `#C4B5FD`), double-pill vertical sidebar with custom active tab notch, top WORKSPACE header bar with open folder button and docked `:chat` popup container.

### 46.1 Exact Color System & Styling
- [x] Implement exact color tokens (`bg-[#F4EFE6]`, `bg-[#1A191B]`, `text-[#FF5E38]`, `bg-[#C4B5FD]`)
- [x] Dual rounded cards design system (`rounded-[24px]`) with dark headers (`#1A191B`)

### 46.2 Top Workspace Header & Docked Chat (`:chat`)
- [x] Top dark capsule header bar with `WORKSPACE` label in Coral Orange
- [x] `:chat` Lilac capsule button acting as the dock/storage for popup chat
- [x] Floating Popup Chat component with close/minimize animation back to `:chat` button
- [x] Coral Orange `open folder` capsule button for workspace selection dialog

### 46.3 Vertical Double-Pill Sidebar
- [x] Standalone dark circular brand badge with logo at top left
- [x] Middle dark vertical capsule container with active tab notch indicator (orange circle logo `#FF5E38`) and purple icons (`#C4B5FD`)
- [x] Bottom dark vertical capsule container with action buttons

## Phase 47: Unified Document IDE Workstation Migration ✅ DONE

**Goal:** Unify Chat Mode and Workspace Mode into 1 Single Document IDE Workstation page (`/`) following `ui_wireframe_layout_v2.md` with IDE File Reader and Antigravity-style On-Demand Canvas calls.

### 47.1 Backend Unit Test Fixes (`apps/api`)
- [x] Fixed `tool-call-repair.integration.spec.ts` fetch mock and message structure assertion.
- [x] Added `todo_write` to `declaredTools` and core toolset in `workspace-runner.service.ts`.
- [x] Verified unit tests — 100% passed (30/30 test files, 144 unit tests).

### 47.2 Frontend Unified IDE Workstation (`apps/web`)
- [x] Created `UnifiedWorkstationPage.tsx` adhering to `ui_wireframe_layout_v2.md` and color system (`#F4EFE6`, `#1A191B`, `#FF5E38`, `#C4B5FD`).
- [x] **Left Panel**: Collapsible File Explorer `[=]` with search, folder tree, and Quick Connect modal dialog.
- [x] **Center Panel**: IDE File Reader (renders Excel grid, PDF, Word, TXT) + Antigravity-style On-Demand Canvas Panel (triggered by AI output or `[🎨 Canvas]` header button, closable with `✕`).
- [x] **Right Panel**: Integrated Chat Area & Capsule Input Box with `@filename` auto-complete and live execution badges.
- [x] **Footer Bar**: Workspace path, file count, active model, and Knowledge Base status bar.
- [x] Consolidated routes in `App.tsx` (`/` -> `UnifiedWorkstationPage`) and updated `Sidebar.tsx`.
- [x] Project typecheck clean (`npm run typecheck` — 0 errors).

---

## Phase 48: Large Files Clean Code Refactoring ✅ DONE

**Goal:** Refactor monolithic files (>1,000 lines) into modular, SRP-compliant services and strategy builders while preserving 100% backward compatibility and test coverage.

### 48.1 Monolithic Tools Module Refactoring (`tools-provider.module.ts`)
- [x] Reduced `tools-provider.module.ts` from **2,459 lines down to 176 lines**.
- [x] Created `WorkspaceFileToolsRegistrar` (`apps/api/src/modules/tools/services/registrars/workspace-file-tools.registrar.ts`).
- [x] Created `BusinessDomainToolsRegistrar` (`apps/api/src/modules/tools/services/registrars/business-domain-tools.registrar.ts`).
- [x] Created `HarnessMetaToolsRegistrar` (`apps/api/src/modules/tools/services/registrars/harness-meta-tools.registrar.ts`).

### 48.2 Document Generator Tool Decomposition (`document-generator.tool.ts`)
- [x] Reduced `document-generator.tool.ts` from **1,294 lines down to 169 lines**.
- [x] Created `ExcelReportBuilder` (`apps/api/src/modules/tools/services/generators/excel-report-builder.ts`).
- [x] Created `PdfReportBuilder` (`apps/api/src/modules/tools/services/generators/pdf-report-builder.ts`).
- [x] Created `DocxReportBuilder` (`apps/api/src/modules/tools/services/generators/docx-report-builder.ts`).

### 48.3 Workspace Runner Execution Phase Modularization (`workspace-runner.service.ts`)
- [x] Extracted `WorkspacePhaseTrackerService` (`apps/api/src/modules/workspace/services/workspace-phase-tracker.service.ts`).

### 48.4 Verification
- [x] `npm run typecheck` — **0 errors**.
- [x] `npx vitest run` — **30/30 passed (144 unit tests)**.

---

## Phase 49: Reasoning Pruning & Budgeting (Reasoning Effort Optimization) ✅ DONE

**Goal:** Cut the dominant latency source (LLM internal reasoning) via 3 levers: provider-level `reasoning_effort`/`budgetTokens` params, a `[REASONING EFFORT: LOW]` steering directive in the system prompt, and lean tool exposure.

### 49.1 Provider Parameter (reasoning_effort / budgetTokens)
- [x] `buildProviderOptions` (sdk-transformer.util.ts) now sends `reasoning_effort: 'low'` to **all** OpenAI-compatible reasoning models (o1/o3, gpt-oss via Kenari/vLLM, deepseek-reasoner, qwen thinking) — previously only o1/o3 got it, so gpt-oss-120b ran unconstrained (the ~270s final-round deliberation seen in `test-rekap-extended.ts`).
- [x] Anthropic thinking budget lowered 2048 → **1024** (`ANTHROPIC_THINKING_BUDGET_TOKENS` env, default 1024).
- [x] `model-capability.ts`: gpt-oss-20b/120b flagged `reasoningEffort: 'low'` + `supportsTools: true`; Claude thinking models (`claude-3-7-sonnet`, `claude-sonnet-4`, `claude-4-sonnet`) added; dynamic detection extended (gpt-oss, claude-3-7, claude-4).
- [x] Anthropic extended thinking forces `temperature=1` — `ai.service.ts` now omits `temperature` when thinking is enabled (would otherwise 400).

### 49.2 Steering Prompt Directive (Prompt-Level Budget)
- [x] `SystemPromptBuilderService.buildReasoningDirective()` injects `[REASONING EFFORT: LOW]` (concise <30-50 word reasoning, immediate tool call/response) into both chat & workspace system prompts — cached in stable prefix so prompt cache invalidates correctly.
- [x] Enabled by default for all models; flexible kill-switches: `ARUNAKI_CONCISE_REASONING=false` (skip directive) or `ARUNAKI_REASONING_EFFORT=off` (skip directive + all provider reasoning params).

### 49.3 Lean Tool Exposure (already present — verified)
- [x] Workspace mode: `selectToolsForGoal()` (workspace-runner.service.ts:593) — core file tools always + goal-keyword additions; never the full registry.
- [x] Chat mode: `getRelevantToolDefinitions()` Tool-RAG (tool-registry.service.ts:99) — core set + top-scoring tools, capped at 15.
- [x] Sub-agents: scoped by `allowedTools` list.

### 49.4 Testing & Documentation
- [x] New `sdk-transformer.util.spec.ts` — 5 tests (non-reasoning model → undefined, gpt-oss/deepseek → low, explicit override, anthropic budget env, `ARUNAKI_REASONING_EFFORT=off`).
- [x] Build passes (`npx tsc -p tsconfig.build.json --noEmit` — 0 errors); AI module tests pass (14/14).
- [x] `.env.example` documents the 3 new env vars.
- [x] Dev log `docs/dev-logs/dev-log-2026-08-16-reasoning-pruning-budgeting.md` created.

**Pre-existing (unrelated):** `context-manager.spec.ts` `estimateToolResultReduction` expects 14010 but code yields 14160 — test comment assumes `toolPreviewChars: 250`, default config is `200`. Confirmed failing on clean checkout; not touched.

---

## Current Status

**Phase:** 47 — Unified Document IDE Workstation Migration ✅ DONE
**Framework:** Digital Employee — visible interaction di browser (web) + desktop apps + sub-agent delegation + failover resilience + encrypted secrets vault + audit trajectory + background cron scheduler + hardened security + Unified 1 Mode Document IDE.
**Model Default:** `openrouter/free` dengan capability-aware request  
**Next:** Voice Interaction & Desktop Packaging  


---

## Phase 23: Session Admission & Safety Hardening 🔴 CRITICAL ✅ DONE

**Goal:** Implement session-level work admission queue, idempotent transcript recording, and input provenance tracking — critical for production-ready business autonomy.

**Source:** `docs/SESSIONS-LAYER-CRITICAL-FINDINGS.md` (based on OpenClaw source analysis)  
**Commit:** `54f3f1c` — completed Phase 1.2-1.5 critical path

### 23.1 Session Admission Queue (24h, P0) ✅
- [x] Create `SessionAdmissionService` (@Injectable)
  - Global state: `Map<sessionKey, AdmissionState>`
  - `beginAdmission(sessionKey, signal)` → lease or queue
  - 15s default timeout, AbortSignal support
- [x] Create `SessionAdmissionLease` class
  - `release(): Promise<void>`
  - `run<T>(fn): Promise<T>` wrapper
- [x] Integrate into `AgentRunnerService.runAgentStream()`
  - Wrap agent loop with `try { ... } finally { await lease.release() }`
- [ ] ~~Tests~~ (deferred — no test infrastructure)

### 23.2 Idempotent Transcript Recording (12h, P0) ✅
- [x] Prisma migration: Add `idempotencyKey` (nullable, unique index) to `Message` model
- [x] Generate idempotency keys: `run:${runId}` or `turn:${chatId}:${timestamp}`
- [x] Update `MessageService.createMessage()` to check before insert
  - `findFirst({ idempotencyKey })` → return existing if found
  - Skip duplicate insert
- [ ] ~~Tests~~ (deferred)

### 23.3 Input Provenance Tracking (8h, P0) ✅
- [x] Prisma migration: Add `provenance` JSON (nullable) to `Message` model
- [x] Track provenance on message creation
- [ ] ~~UI strip prefix~~ (not needed yet — inter-session not active)

### 23.4 Session State Events (16h, P1 - Optional)
- [ ] Create `SessionEvent` model (type, sessionKey, agentId, payload, timestamp)
- [ ] Event types: message, compaction, goal_changed, created, terminated
- [ ] Retention: 30 days / 50k rows per session

### 23.5 Turn Correlation (12h, P1 - Optional)
- [ ] In-memory pending turn registry
- [ ] Fast-path reply capture without second agent run

---

## Phase 24: Agent Loop Hardening 🔴 CRITICAL ✅ DONE

**Goal:** Fix critical architecture gaps — dual-loop agent with steering/abort, SelfHealing integration, PromptInjection scanning.

**Source:** `docs/FIXES-AND-GAPS.md`  
**Commit:** `2410c16`

### 24.1 Dual-Loop Agent (Steering + Abort/Cancel) ✅
- [x] Outer loop (max 5 turns): checks steering/follow-up queue between turns
- [x] Inner loop (max 25 rounds): tool execution + AI chat
- [x] `steeringQueue` Map with `addSteeringInput()` method
- [x] `POST /workspaces/:id/agent/steer` endpoint
- [x] Context refresh every 5 rounds via `prepareNextTurn()`

### 24.2 SelfHealingService Integration ✅
- [x] Read-only tools wrapped with `executeWithHealing()` (was mutating-only)
- [x] Sequential execution with fallback per tool

### 24.3 PromptInjectionDetector Integration ✅
- [x] High severity → blocks execution with error
- [x] Low/medium → sanitizes and continues

### 24.4 Execution Phase Tracking ✅
- [x] `ExecutionPhase` type: scanning → planning → reading → analyzing → generating → completed
- [x] `phase_changed` SSE events with Indonesian labels
- [x] Phase transitions at key points in agent loop

### 24.5 Streaming Modernization ✅
- [x] `runWorkspaceAgentGenerator()` async generator method
- [x] `POST /workspaces/:id/agent/stream/generator` endpoint
- [x] Backward compatible — callback-based method preserved

---

---

## Phase 25: Blueprint P0 Security Gaps 🔴 ✅ DONE

**Goal:** Implement 3 P0 security/idempotency gaps dari audit 32-layer.

### 25.1 Input Provenance (Layer 9) ✅
- [x] `input-provenance.ts` — tipe, factory, inter-session annotation/stripping
- [x] `message.service.ts` — pake `InputProvenanceFactory.fromRole()` untuk default
- [x] `chat.controller.ts` — semua message creation pake factory
- [x] `annotateInterSession()` + `stripInterSessionPrefix()` utility ready

### 25.2 User Turn Transcript (Layer 8) ✅
- [x] `user-turn-transcript.service.ts` — lifecycle tracking (created → sent_to_provider → runtime_persisted → approved)
- [x] `markSentToProvider()` / `markRuntimePersisted()` / `markApproved()` methods
- [x] `hasActiveTurn()` — late media detection di controller
- [x] Wired ke `AgentRunnerService.runAgentSync()` dan `runAgentStream()`

### 25.3 Merge Session Admission (Layer 6) ✅
- [x] `chat/session-admission.service.ts` — merged with `run<T>()` helper + `OnModuleDestroy`
- [x] Deleted orphaned `ai/session-admission.service.ts` (not imported anywhere)
- [x] Added `isAdmitted()` + `getQueueLength()` methods

---

## Phase 26: Blueprint P1 High ✅ DONE

**Goal:** Implement 2 P1 gaps from audit 32-layer — durable event log + plugin system.

### 26.1 Session State Events (Layer 7) ✅
- [x] `SessionEvent` model — SQLite table via raw SQL (CREATE TABLE IF NOT EXISTS)
- [x] `session-state-events.service.ts` — record(), getVersion(), listSince(), cleanup()
- [x] Event types: session_created, human_direct_message, agent_started, agent_completed, agent_response, session_terminated
- [x] Best-effort append (try/catch, never fails originating action)
- [x] Retention: 30 days or 50k rows per session (auto-cleanup every 100 records)
- [x] Wired into chat-history.service.ts (session_created)
- [x] Wired into chat.controller.ts (human_direct_message, agent_response, session_terminated)
- [x] Wired into agent-runner.service.ts (agent_started, agent_completed)
- [x] Registered in chat.module.ts

### 26.2 Harness Registry (Layer 5) ✅
- [x] Create `harness/` directory with `harness-plugin.interface.ts` + `harness-registry.service.ts`
- [x] `HarnessPlugin` interface: onAgentStart, onToolStart, onToolResult, onAgentComplete, onAgentError
- [x] `HarnessRegistryService` — register(), unregister(), getPlugins(), priority-based execution
- [x] Wired into `agent-runner.service.ts` — both sync and stream paths
- [x] Tool execution hooks: onToolStart before, onToolResult after each tool call
- [x] Registered in `chat.module.ts`

---

## Phase 27: Fix Broken Functionality ✅ DONE

**Goal:** Fix 3 operational issues — tiktoken, LLM summary, scrubber regex.

### 27.1 Fix tiktoken Encoding (#5) ✅
- [x] `getEncodingForModel()` — tries exact model match first, falls back to cl100k_base (gpt-4)
- [x] Constructor uses `getEncodingForModel(this.fallbackModel)` instead of hardcoded `'gpt-4'`

### 27.2 Disable LLM Summary in Compression (#7) ✅
- [x] Changed `useLlmSummary: true` → `false` in AiService constructor
- [x] Saves one LLM call per compression event

### 27.3 Fix StreamingContextScrubber Regex (#8) ✅
- [x] Removed Chinese characters (记忆, 偏好, 偏好设置, 技能) from LEAK_PATTERNS
- [x] Added Indonesian terms (memori, ingatan, catatan, kemampuan, keahlian)

---

## Phase 28: Fix Architecture Mistakes ✅ DONE

**Goal:** Remove wasteful separate LLM calls — self-evaluation, simplify model router.

### 28.1 Remove Separate Self-Evaluation Call (#11) ✅
- [x] Removed `selfEvaluationService.evaluate()` + `evaluateAndRetry()` block from workspace-runner.service.ts
- [x] Removed `SelfEvaluationService` import and injection

### 28.2 Simplify ModelRouter Additions (#12) ✅
- [x] Removed model-specific switch/case blocks (claude, openai, gemini, llama, mistral, deepseek, qwen)
- [x] Kept only universal rules (no system prompt leak, no fabricated calls, wait for results)

---

## Phase 6: Blueprint P2 Medium ✅ DONE

**Goal:** Extract runWithModelFallback factory, wire workspace heartbeat into connectFolder().

### F. runWithModelFallback (Layer 2) ✅
- [x] Created `apps/api/src/modules/ai/model-fallback.ts` — exported `runWithModelFallback()` function with FallbackOptions interface
- [x] Encapsulates retry (3x per provider, exponential backoff + jitter) + rotation (3 max, getNextAvailable)
- [x] Accepts callbacks: makeRequest, getNextProvider, classifyError, recordUsage, recordError, setCooldown
- [x] Refactored `AiService.chat()` to delegate fallback logic to runWithModelFallback
- [x] Clean response parsing remains in AiService (content extraction, think-tag stripping, tool_calls extraction)

### G. Wire Workspace Heartbeat (Layer 29) ✅
- [x] Injected `WorkspaceHeartbeatService` into `WorkspaceService`
- [x] Added `collectFileSnapshots()` private method — recursive file walker returning `FileSnapshot[]`
- [x] Called `heartbeatService.registerWorkspace(id, callback)` at end of `connectFolder()`
- [x] Excludes hidden files, node_modules, .git, build artifacts (same exclusions as scanFolder)

---

## Phase 7: Blueprint P3 Low ✅ DONE

**Goal:** Auto Memory Cron (Layer 25) + LLM Stream Inline (Layer 9d).

### H. Auto Memory Cron (Layer 25) ✅
- [x] Injected `AutoMemoryService` into `CronService`
- [x] Added `runAutoMemoryDistillation()` private method
- [x] Queries all `ready` workspaces and calls `checkAndDistill(workspaceId, businessType)`
- [x] Scheduled interval: every 5 minutes (300,000ms) via `setInterval` in `onModuleInit`
- [x] Logs distillation results per workspace
- [x] MemoryModule forwarded in CronModule imports (forwardRef)

### I. LLM Stream Inline (Layer 9d) ✅
- [x] Created `apps/api/src/modules/ai/stream-chat.ts` with `streamWithFallback()` async generator
- [x] Handles provider fallback (retry + rotation) during streaming
- [x] Yields `StreamChunk` objects: `content`, `tool_calls`, `done`, `error`
- [x] Added `chatStream()` method to `AiService` returning `AsyncGenerator<StreamChunk>`
- [x] Strips `think` tags from streamed content
- [x] Reusable across chat, agent-runner, workspace-runner

---

## Phase 9: Blueprint P4 ✅ DONE

**Goal:** Background Curator — Periodic skill review & maintenance.

### J. Background Curator ✅
- [x] Added `runBackgroundCurator()` private method to `CronService`
- [x] Scheduled interval: every 1 hour (3,600,000ms) via `setInterval` in `onModuleInit`
- [x] Deactivates skills with `usageCount === 0` and age > 30 days (using `createdAt` as proxy)
- [x] Auto-pins skills with `usageCount >= 50` (sets `pinned: true`)
- [x] Seeds missing starter skills for each active domain
- [x] SkillsModule forwarded in CronModule imports (forwardRef)

---

## AUTONOMY_ROADMAP Phase 7 ✅ DONE

**Goal:** Advanced Intelligence — self-evaluation, skill self-improve, smart recall.
- Self-evaluation ✅ — Already implemented in `self-evaluation.service.ts`
- Skill self-improve ✅ — Already implemented, wired via `BackgroundReviewService`
- Smart memory recall ✅ — Already implemented in `smart-recall.service.ts`
- Background curator ✅ — Implemented in `CronService.runBackgroundCurator()`

---

---

## Phase 30: System Prompt Maturity ✅ DONE

**Goal:** OpenClaw-inspired system prompt restructuring with dynamic tool injection, maturity hardening (Self-Correction, Numerical Accuracy, Error Handling, Output Contract), and token budget guard.

### 30.1 Prompt Files (Workspace Mode) ✅
- [x] `identity.md` — English, Digital Employee persona, operating environment (Web UI + Desktop/Electron), bilingual response rule
- [x] `rules.md` — 9 sections: Tooling (dynamic `{TOOL_LIST}`), Tool Call Style, Execution Bias, Self-Correction, Safety, Workspace, Interaction Guide (5 workflows with concrete examples), Error Handling table, Output Contract (with Numerical Accuracy + Failure Protocol)
- [x] `verification.md` — concise English checklist aligned with Output Contract
- [x] `memory-context.md` — cross-session memory guidance

### 30.2 Prompt Files (Chat Mode) ✅
- [x] `chat-identity.md` — aligned persona, chat-appropriate tone, knowledge base context
- [x] `chat-rules.md` — OpenClaw-inspired sections with `{TOOL_LIST}` and `{KNOWLEDGE_BASE}` placeholders
- [x] `chat-knowledge-builder.md` — focused `/knowledge` command workflow

### 30.3 Code Changes ✅
- [x] `ai.service.ts` — `ToolRegistryService` injection for dynamic tool list (`buildToolListSummary()`)
- [x] `ai.service.ts` — Tool category mapping data-driven from registry tags (not hardcoded names)
- [x] `ai.service.ts` — Token budget guard (`checkPromptBudget()`) — warns if prompt exceeds thresholds
- [x] `ai.service.ts` — `{TOOL_LIST}` injected in both workspace and chat modes
- [x] `ai.service.ts` — Fixed stale `rulesWithKB` variable reference

### 30.4 Technical Details
```
Tool list: Generated live from ToolRegistryService.getToolCapabilities()
Categories: Inferred from tags (workspace, data, export, memory, skills, etc.)
Budget guard: Warning at >6K tokens, log at >3K tokens
Self-Correction: Stop → Report → Retry from source data (never fabricate)
Numerical Accuracy: Traceable to tool, verify once more, "Approximately X" for uncertainty
```

---

## Phase 31: Rekapan Harness Hardening & Anti-Over-Engineering ✅ DONE

**Goal:** Zero over-engineering, 100% LLM mapping (tanpa interception regex), 9-chain auto-recovery, dan harness extended test untuk update laporan rekap harian.

### 31.1 Zero Over-Engineering — Rollback/Checkpoint (Gap #8) Dihapus ✅
- [x] `failAndRecover`, `snapshotFile`, `rollbackSnapshots`, `resolveWorkspaceFilePath`, dan interface `FileSnapshot` dilepas dari `workspace-runner.service.ts`
- [x] Test rollback 2 kasus dihapus dari `workspace-runner.service.spec.ts`
- [x] Mutasi gagal kini dikembalikan ke LLM sebagai tool result biasa (natural 1-turn feedback) — agent self-correct di turn berikutnya; path isolation tetap dijaga `SelfHealingService`

### 31.2 Eliminasi RegEx Interception ✅
- [x] `editFileWithRetry` di `workspace-tools.service.ts` memakai 100% LLM-generated diffs + fuzzy replacer (`fuzzyReplace`) — tanpa regex hardcode; dijalankan model `gpt-oss-120b`

### 31.3 9-Chain Auto-Recovery ✅
- [x] Mutasi bertahap: 3-step in-place edit → 3-step regenerated edit → full-regenerate write
- [x] Rollover prompt + minimal typing (update tanggal, reset data periode berjalan, pertahankan saldo kumulatif)

### 31.4 Harness Extended Test ✅
- [x] `apps/api/scripts/test-rekap-extended.ts` — modelId `gpt-oss-120b`, base URL `127.0.0.1:3000`
- [x] Fix check rapuh `LISTRIK 250` → `LISTRIK[\s=:]*250` (false negative karena format `LISTRIK = 250RB`)

### 31.5 Verifikasi ✅
- [x] `npx vitest run` — **29/29 test files, 141/141 unit tests passed**
- [x] `node --experimental-strip-types scripts/test-rekap-extended.ts` — **12/12 checks passed** (nama pemasukan, per-bank total BCA 825/BNI 200/CASH 150, pengeluaran 570, uang di laci 605, tanggal diperbarui)

---

## Phase 32: OpenCode-Style Patch Engine (Pengganti 9-Chain Fuzzy) ✅ DONE

**Goal:** Ganti edit tool (LLM-generated `{oldText,newText}` + 9-chain fuzzy replacer + full-write heuristic) dengan engine patch ketat port dari opencode (`apply-patch.ts`): LLM kirim patch text, engine dry-run validasi semua baris konteks, baru menulis. Anti-gagal = parse ketat + tolak total tanpa partial write + error dikembalikan ke LLM (self-correct loop).

### 32.1 Patch Engine (port dari opencode MIT) ✅
- [x] `apps/api/src/modules/tools/services/apply-patch.ts` — `parse()` (Add/Update/Delete/Move, heredoc), `derive()` (dry-run, throw `PatchError` jika baris konteks tak cocok), ladder fuzzy 4-level (exact → rstrip → trim → normalized typographic), BOM handling, `joinBom()`
- [x] `editWorkspaceFile` di `workspace-tools.service.ts` — input berubah dari `instructions` → `patchText`; parse → validasi hunk (delete/add ditolak, path wajib cocok dengan file yang diedit) → derive dry-run → tulis via StorageService; `estimatedLatency: 'fast'`, `timeoutMs: 60000`
- [x] Hapus ~260 baris: `generateEdits` (LLM call kedua), `fuzzyApplyEdit` (9-chain), `similarity`, injeksi `AiService`, fallback full-content write

### 32.2 Tool Schema & Prompt ✅
- [x] Deskripsi tool `edit` semua bahasa Inggris mengikuti `apply_patch.txt` opencode (format `*** Begin Patch` / `*** Update File:` / `@@` / `-` `+` ` `, aturan kontiguitas, rollover, retry)
- [x] `rules.md` §5 — "selalu pakai `write`" diganti "pakai `edit` patch untuk update file; `write` hanya untuk file baru/rewrite penuh"

### 32.3 Enforce Patch Path (write dibuang saat @file) ✅
- [x] `selectToolsForGoal` di `workspace-runner.service.ts` — saat goal mereferensikan `@file` yang ada, `write` dikeluarkan dari toolset sehingga model tidak bisa rewrite penuh; pakai `extractMentionedFilenames()` (mekanisme yang sama dengan `readMentionedFiles`) bukan regex ad-hoc

### 32.4 Test & Verifikasi ✅
- [x] `apply-patch.spec.ts` — 5 test: multi-chunk surgical, tolak-total tanpa partial write, BOM, whitespace drift, fenced empty patch
- [x] `npx tsc -p apps/api/tsconfig.build.json --noEmit` — clean
- [x] `npx vitest run` (tools + ai + workspace) — **89/89 passed**
- [x] Harness live `test-rekap-extended.ts` — **12/12 checks passed**, `[tool_call] edit` ×4 (patch path dipakai, bukan `write`)

---

## Phase 33: Tool-Call History Serialization untuk gpt-oss (Kenari 524/400) ✅ DONE

**Goal:** Perbaiki run rekap <60s dengan gpt-oss-120b. Root cause yang dibuktikan via probe langsung: Kenari/vLLM serving gpt-oss **menolak/menghang saat history request mengandung `tool_calls`/`tool` role** — gpt-oss-20b → HTTP 400 `upstream_rejected` (1.5s), gpt-oss-120b → HTTP 524 origin timeout (125s). Model tetap bisa *menghasilkan* tool call, hanya tidak bisa *menerima* history tool call native. Solusi: serialisasi tool activity jadi teks polos (pola kompaksi opencode).

### 33.1 Root Cause & Bukti ✅
- [x] Probe `threshold-test.mjs`: semua varian ukuran (4.4KB→3.6KB, 2 tool→1 tool, 8192→2048→512 token) tetap 524 — **ukuran bukan pemicu**
- [x] Probe `isolate-test.mjs`: 2-msg+tool 200/1.2s; 6-msg plain text 200/1.3s; 6-msg berisi tool_calls 524/125s — **pemicu = `tool_calls`/`tool` di history**
- [x] Probe `confirm-test.mjs`: 1 pasang tool call saja (1.2KB) tetap 524; serialisasi teks `[Assistant tool call]/[Tool result]` → 200/1.0s

### 33.2 Implementasi ✅
- [x] `model-capability.ts` — field `supportsToolCallHistory?: boolean` + helper `modelSupportsToolCallHistory()`; **default `false` — SEMUA model pakai tool history text (serialized), hanya yang eksplisit di-flag `true` yang native**; `gpt-oss-20b`/`gpt-oss-120b` tetap `false`
- [x] `sdk-transformer.util.ts` — `serializeToolCallHistory()` meratakan pasangan assistant tool_calls + tool result jadi satu pesan teks (role ordering tetap valid); dipakai di `makeSdkRequest` & `makeSdkRequestStream` bila model tidak support tool-call history

### 33.3 Verifikasi ✅
- [x] `npx nest build` + `npx tsc --noEmit` — clean
- [x] `npx vitest run src/modules/ai/sdk-transformer.util.spec.ts` — **10/10 passed** (tambah 4 test baru: flag gpt-oss, default false, flatten, untouched)
- [x] Harness live `test-rekap-extended.ts gpt-oss-120b` — **16/17 checks passed, run 31.8s** (dari ~253s round-3 saja); model pakai `patchText` diff `*** Begin Patch`; 1 gagal hanya "Tanggal diperbarui" (model tidak update header tanggal)
- [x] **Follow-up: invert default text-history untuk SEMUA model** — deepseek-v4-flash naik dari native 76.5s/125.7s → text **21.5s/24.9s** (3-5x lebih cepat), checks tetap **17/17** × 2 run

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

---

## Phase 45: Full AI SDK Migration ✅ DONE

**Goal:** Migrate all raw fetch endpoints communicating with AI providers to use Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`) perfectly mirroring Opencode's implementation.

### 45.1 AI Service Migration (`ai.service.ts`)
- [x] Replaced manual fetch with `generateText` and `streamText`.
- [x] Used `createOpenAI` and `createAnthropic` for respective model providers.
- [x] Refactored `toSdkMessages` and `toSdkTools` to match standard `ModelMessage` schemas (including `tool-result` and `tool-call`).

### 45.2 Provider Fallback & Tools (`model-fallback.ts`, `vision-ai.tool.ts`)
- [x] Handled `APICallError` inside `runWithModelFallback` for smooth token limits and failure rotation.
- [x] Stripped raw `fetch` out of `vision-ai.tool.ts` and migrated to `generateText` for multimodal inference.
- [x] Fixed decommissioned model (`deepseek-r1-distill-llama-70b`) in `provider-catalog.service.ts` to allow graceful fallback.

### 45.3 Verification
- [x] 100% of LLM communication logic now runs through Vercel AI SDK.
- [x] `test-rekap-extended.ts` passes the initial round using AI SDK tool format.

---

## Phase 46: Template Preservation & Surgical Edit Enforcement ✅ DONE

**Goal:** Enforce surgical patch editing (`edit`) over full-file overwriting (`write`) to protect business templates, standing balances, and historical notes from accidental deletions or LLM drift.

### 46.1 Strict Tool Registry & System Rules
- [x] Updated `WorkspaceFileToolsRegistrar` with explicit descriptions: `write` is only for brand new files, `edit` is mandatory for existing files.
- [x] Updated `prompts/rules.md` (Rule 4) forbidding `write` on pre-loaded/existing documents.
- [x] Added per-request 45s timeout (`AbortSignal.timeout(45000)`) in `makeSdkRequestStream` for resilient provider failover.
- [x] Mapped AI SDK `textDelta` and `args` in stream transformer to ensure tool call payloads and deltas flow cleanly without silent buffering.

### 46.2 Extended Autonomous Rekap Verification
- [x] Ran `apps/api/scripts/test-rekap-extended.ts` with `deepseek-v4-flash`.
- [x] 17/17 automated assertions passed:
  - 100% of accounting totals calculated correctly (Pemasukan: 1.175 RB, Pengeluaran: 570 RB, Laci: 605 RB, BCA: 825 RB, BNI: 200 RB, Cash: 150 RB).
  - 100% of standing template balance sections preserved (`PAK ARNOL = 402RB`, `BELANJAAN KE LABURA`, `TOTAL BELANJA KE BENDONG RP 98.000,-`, `SISA DEPOSIT RP 14.207.640,-`, `CI LISOI 10-02-2024`).
  - Strict tool integrity verified: Agent calls `edit` (surgical single-pass patch) and never overwrites with `write`.
  - Date rollover verified: Document title header automatically updated to today's date (`15 AGUSTUS 2026`).

---

## Phase 47: Universal Model Robustness & Self-Correction Harness ✅ DONE

**Goal:** Ensure Arunaki executes reliably and flexibly across all model tiers (small 7B/20B, cheap open-weights 120B, and frontier models) without hardcoded model assumptions.

### 47.1 Autonomous Self-Correction & Nudge Loop
- [x] In `workspace-runner.service.ts`, added early-round detection for tasks requiring file operations.
- [x] If a model returns 0 tool calls on Round 1-2 for a file mutation task, injected a high-priority `[System Action Required]` nudge and auto-continued the execution loop (up to 2 autonomous recovery attempts).
- [x] Added automatic streaming fallback in `sdk-transformer.util.ts` (`makeSdkRequest`) for streaming-only endpoints (e.g. Kenari) that reject non-streaming `generateText`.

### 47.2 Flexible Auto-Healing & Line-Number Stripper
- [x] In `edit-tool.service.ts`, implemented 4-tier match fallback: Exact Match → CRLF Normalized Match → Line-Number Stripped Match (`^\s*\d+:\s*`) → Whitespace-Tolerant Block Match.
- [x] In `model-router.service.ts`, added model-agnostic few-shot examples and strict line-number omission instructions for open-weights models.

### 47.3 Verification & Testing
- [x] Vitest tool-call repair test suite passed 7/7 tests in 13ms (`apps/api/test/tool-call-repair.spec.ts`).
- [x] TypeScript build completed with 0 errors (`npm run build -w apps/api`).
- [x] Verified autonomous nudge loop triggers and recovers empty/conversational turns without prematurely aborting the stream.

---

## Phase 48: Monolithic Codebase Modularization & Maintainability Refactoring ✅ DONE

**Goal:** Refactor massive monolithic files in backend and frontend to enhance modularity, testability, and long-term maintainability without breaking any existing features.

### 48.1 Backend Modularization (`apps/api`)
- [x] Extracted `tool-call-extractor.util.ts` containing pure regex and string parsing functions (`extractMentionedFilenames`, `hasExplicitDeleteIntent`, `extractLooseArguments`, `extractInlineFunctionCalls`).
- [x] Extracted `WorkspacePromptBuilderService` (`workspace-prompt-builder.service.ts`) containing prompt preparation, physical file scanning, tool routing, and context assembly.
- [x] Registered `WorkspacePromptBuilderService` into `WorkspaceModule` providers and exports.
- [x] Refactored `WorkspaceRunnerService` to delegate parsing and context preparation to the new service and utility.
- [x] Verified backend compilation: `npx nest build` succeeds with 0 errors.

### 48.2 Frontend Modularization (`apps/web`)
- [x] Extracted `ProviderCard.tsx` subcomponent for clean rendering of individual provider catalog cards.
- [x] Extracted `ProviderForm.tsx` subcomponent for provider creation, editing, connection testing, and model pool selection.
- [x] Refactored `ModelProviderSettings.tsx` to consume `ProviderCard` and `ProviderForm`.
- [x] Verified frontend compilation: `npx tsc --noEmit` (0 errors) and `npm run build` succeeds (built in 56.75s).

### 48.3 Verification & Benchmark
- [x] Ran autonomous benchmark test `scripts/test-rekap-extended.ts` after refactoring: finished in 29.5s with 15/17 automated assertions passed.

---

## Phase 49: Autonomous Living System Prompt (`ARUNAKI.md`) Engine & Desktop COM Registration ✅ DONE

**Goal:** Create an autonomous background cartography engine that scans connected workspace files, synthesizes an operating system prompt (`.arunaki/ARUNAKI.md`), syncs it to the UI Knowledge Base, dynamically self-updates on user corrections, and injects it at 0ms latency into runtime chat without becoming a bottleneck.

### 49.1 Desktop Tools Registration
- [x] Created `desktop-tools.registrar.ts` and registered all 9 Desktop COM automation tools (`desktop_open_excel`, `desktop_excel_edit`, `desktop_open_word`, `desktop_word_type`, `desktop_word_format`, `desktop_open_ppt`, `desktop_open_file`, `desktop_send_keys`, `desktop_screenshot`).
- [x] Registered `DesktopToolsRegistrar` into `ToolsProviderModule` and exported to global runtime registry.

### 49.2 WorkspaceCartographerService & Living ARUNAKI.md
- [x] Created `WorkspaceCartographerService` with non-blocking async scanning and 0ms in-memory cache.
- [x] Implemented intelligent file sampling (max 40 lines per file) to prevent memory & token bloat.
- [x] Implemented structured `ARUNAKI.md` synthesis (Domain profile, File Catalog & Relationships, Strict Syntax Invariants, User Preferences & Learned Corrections).
- [x] Implemented dual-sync: writes physical `.arunaki/ARUNAKI.md` and syncs to Prisma Knowledge Base for the UI Knowledge Page.

### 49.3 Runtime Injection & Dynamic Learning Loop
- [x] In `WorkspacePromptBuilderService`, injected `ARUNAKI.md` as `# LOCAL WORKSPACE OPERATING RULES` with 0ms RAM cache.
- [x] In `BackgroundReviewService`, added post-response learning hook to auto-patch `ARUNAKI.md` when user provides corrections in chat.

### 49.4 Verification & Benchmark
- [x] Build check: `npx nest build` passed with 0 errors.
- [x] Verified generated `ARUNAKI.md` in database: accurately synthesized all customer prefixes (`CK`, `BG`, `CI`, `PAK`), bank codes (`BCA`, `BNI`, `BRI`), section headers, and immutable balances.
- [x] End-to-end autonomous rekap benchmark passed successfully with surgical patch editing and template preservation.

---

## Phase 50: Workspace Rules Sentinel Agent & Isolated Sub-Agent Sandboxing ✅ DONE

**Goal:** Create a resident, event-driven guardian agent (`WorkspaceRulesSentinelService`) that silently monitors user conversation turns in the background (0% CPU when idle), compares user directives against `ARUNAKI.md`, autonomously evolves the living rulebook when new preferences or corrections arise, and sandboxes heavy cartography tasks into dedicated Sub-Agents.

### 50.1 Domain-Agnostic & Zero-Bias Prompt Synthesis
- [x] Refactored `WorkspaceCartographerService` prompt to eliminate any hardcoded domain bias, making rule synthesis 100% agnostic to any industry (accounting, legal, clinic, retail, logistics, manufacturing, education, software).
- [x] Refactored `buildDeterministicRules` fallback to dynamically discover file extensions and metadata without hardcoded strings.

### 50.2 Sub-Agent Delegation & Parallel Sandboxing
- [x] Integrated `SubAgentRunnerService` into `WorkspaceCartographerService` so heavy workspace cartography executes in an isolated sub-agent sandbox.
- [x] Added `agent_spawn` tool routing in `WorkspacePromptBuilderService` for multi-task, batch, and parallel operations.

### 50.3 Resident Workspace Rules Sentinel Daemon
- [x] Created `WorkspaceRulesSentinelService` listening to `@OnEvent('workspace.agent.completed')`.
- [x] Implemented fast-heuristic intent filtering (`INTENT_TRIGGER_REGEX`) to wake up only when corrections/rules are present (0ms overhead on normal turns).
- [x] Implemented intelligent diff analysis against current `ARUNAKI.md` and autonomous patching.
- [x] Registered `WorkspaceRulesSentinelService` in `WorkspaceModule`.

### 50.4 Verification & Benchmark
- [x] Build check: `npx nest build` passed with 0 errors.
- [x] Verified resident daemon initialization: `[WorkspaceRulesSentinelService] 🛡️ Workspace Rules Sentinel Agent initialized (Resident & Event-Driven).`
- [x] End-to-end autonomous rekap benchmark passed with surgical `edit` and background completion handling.

---

## Phase 51: Programmatic & Multi-Tool Batch Execution (PTC Engine) ✅ DONE

**Goal:** Implement DeepSeek Harness-inspired Programmatic Tool Calling (PTC) & atomic batch execution to reduce agent turnaround latency by ~70% (<10s) and prevent multi-round back-and-forth overhead.

### 51.1 Programmatic Tool Calling (PTC) Engine Service
- [x] Created `PtcExecutorService` in `apps/api/src/modules/tools/services/ptc-executor.service.ts` to parse, validate, and execute batched/scripted tool calls atomically.
- [x] Implemented rollback transaction semantics: if one tool in a multi-step operation fails, roll back file mutations to preserve document integrity.

### 51.2 Parallel & Chained Tool Invocations in WorkspaceRunner
- [x] Registered `batch_execute` tool in `HarnessMetaToolsRegistrar` and wired `PtcExecutorService` into `ToolsProviderModule`.
- [x] Added `batch_execute` tool routing in `WorkspacePromptBuilderService`.

### 51.3 Verification & Benchmark
- [x] Vitest unit test `src/modules/tools/services/ptc-executor.service.spec.ts` passed (2/2 tests passed, verifying multi-step execution & auto-rollback).
- [x] Ran autonomous benchmark `scripts/test-ptc-benchmark.ts`: 5/5 assertions passed with 100% template preservation.

---

## Phase 52: Append-Only Event-Stream Transcript & Time-Travel Engine ✅ DONE

**Goal:** Implement an append-only event stream transcript as the single source of truth for full replayability, auditability, and 1-click Undo/Rollback.

### 52.1 Append-Only Transcript Engine Service
- [x] Create `TranscriptEngineService` in `apps/api/src/modules/workspace/services/transcript-engine.service.ts` to log session events into `.arunaki/sessions/{sessionId}/transcript.jsonl`.
- [x] Automatically capture pre-mutation snapshots for all file mutating tools (`edit`, `write`, `delete`, `rename`).

### 52.2 Time-Travel Rollback Service & REST Controller
- [x] Create `TimeTravelService` in `apps/api/src/modules/workspace/services/time-travel.service.ts` to restore workspace files to previous checkpoints.
- [x] Expose rollback and transcript timeline endpoints in `WorkspaceController`.

### 52.3 Verification & Benchmark
- [x] Vitest unit tests for transcript append & rollback logic (`transcript-engine.service.spec.ts` — 2/2 passed).
- [x] End-to-end benchmark verifying 1-click rollback restores original document content with zero data corruption (`test-time-travel-benchmark.ts` — 5/5 passed).

---

## Phase 53: Model Normalization & Multi-Provider Resilient Adapter ✅ DONE

**Goal:** Standardize LLM reasoning streams (`<think>`, `reasoning_content`), normalize diverse tool call schemas, and build resilient SSE stream reconstruction across all AI providers.

### 53.1 Universal Stream & Reasoning Normalizer
- [x] Create `ModelStreamNormalizerService` to unify `reasoning_content`, `<think>`, and content deltas.
- [x] Separate thoughts from executable content to prevent reasoning leakage into chat prose and history.

### 53.2 Resilient Multi-Provider SSE Buffer & Fallback Engine
- [x] Implement SSE chunk reconstruction buffer for fragmented JSON lines and network stalls.
- [x] Unify multi-format tool call parsing (`[Assistant tool call]`, `<tool_call>`, `Action/Action Input`, XML format, relaxed JSON).

### 53.3 Verification & Multi-Model Benchmark
- [x] Unit tests for streaming reasoning separation and multi-format tool parsing (`model-stream-normalizer.service.spec.ts` — 4/4 passed).
- [x] End-to-end benchmark verifying resilient tool execution across reasoning and standard models (`test-model-normalization.ts` — 5/5 passed).

---

## Phase 54: Parallel Multi-Document Sub-Agent Orchestrator ✅ DONE

**Goal:** Scale office document operations across multiple parallel sandboxed sub-agent workers without main-chat context pollution.

### 54.1 Multi-Document Orchestrator Service
- [x] Create `MultiDocOrchestratorService` in `apps/api/src/modules/tools/services/multi-doc-orchestrator.service.ts` to manage parallel sub-agent task partitioning and aggregation.
- [x] Implement concurrency pool limiter to prevent 429 rate-limiting on bulk file operations.

## Phase 45: Full AI SDK Migration ✅ DONE

**Goal:** Migrate all raw fetch endpoints communicating with AI providers to use Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`) perfectly mirroring Opencode's implementation.

### 45.1 AI Service Migration (`ai.service.ts`)
- [x] Replaced manual fetch with `generateText` and `streamText`.
- [x] Used `createOpenAI` and `createAnthropic` for respective model providers.
- [x] Refactored `toSdkMessages` and `toSdkTools` to match standard `ModelMessage` schemas (including `tool-result` and `tool-call`).

### 45.2 Provider Fallback & Tools (`model-fallback.ts`, `vision-ai.tool.ts`)
- [x] Handled `APICallError` inside `runWithModelFallback` for smooth token limits and failure rotation.
- [x] Stripped raw `fetch` out of `vision-ai.tool.ts` and migrated to `generateText` for multimodal inference.
- [x] Fixed decommissioned model (`deepseek-r1-distill-llama-70b`) in `provider-catalog.service.ts` to allow graceful fallback.

### 45.3 Verification
- [x] 100% of LLM communication logic now runs through Vercel AI SDK.
- [x] `test-rekap-extended.ts` passes the initial round using AI SDK tool format.

---

## Phase 46: Template Preservation & Surgical Edit Enforcement ✅ DONE

**Goal:** Enforce surgical patch editing (`edit`) over full-file overwriting (`write`) to protect business templates, standing balances, and historical notes from accidental deletions or LLM drift.

### 46.1 Strict Tool Registry & System Rules
- [x] Updated `WorkspaceFileToolsRegistrar` with explicit descriptions: `write` is only for brand new files, `edit` is mandatory for existing files.
- [x] Updated `prompts/rules.md` (Rule 4) forbidding `write` on pre-loaded/existing documents.
- [x] Added per-request 45s timeout (`AbortSignal.timeout(45000)`) in `makeSdkRequestStream` for resilient provider failover.
- [x] Mapped AI SDK `textDelta` and `args` in stream transformer to ensure tool call payloads and deltas flow cleanly without silent buffering.

### 46.2 Extended Autonomous Rekap Verification
- [x] Ran `apps/api/scripts/test-rekap-extended.ts` with `deepseek-v4-flash`.
- [x] 17/17 automated assertions passed:
  - 100% of accounting totals calculated correctly (Pemasukan: 1.175 RB, Pengeluaran: 570 RB, Laci: 605 RB, BCA: 825 RB, BNI: 200 RB, Cash: 150 RB).
  - 100% of standing template balance sections preserved (`PAK ARNOL = 402RB`, `BELANJAAN KE LABURA`, `TOTAL BELANJA KE BENDONG RP 98.000,-`, `SISA DEPOSIT RP 14.207.640,-`, `CI LISOI 10-02-2024`).
  - Strict tool integrity verified: Agent calls `edit` (surgical single-pass patch) and never overwrites with `write`.
  - Date rollover verified: Document title header automatically updated to today's date (`15 AGUSTUS 2026`).

---

## Phase 47: Universal Model Robustness & Self-Correction Harness ✅ DONE

**Goal:** Ensure Arunaki executes reliably and flexibly across all model tiers (small 7B/20B, cheap open-weights 120B, and frontier models) without hardcoded model assumptions.

### 47.1 Autonomous Self-Correction & Nudge Loop
- [x] In `workspace-runner.service.ts`, added early-round detection for tasks requiring file operations.
- [x] If a model returns 0 tool calls on Round 1-2 for a file mutation task, injected a high-priority `[System Action Required]` nudge and auto-continued the execution loop (up to 2 autonomous recovery attempts).
- [x] Added automatic streaming fallback in `sdk-transformer.util.ts` (`makeSdkRequest`) for streaming-only endpoints (e.g. Kenari) that reject non-streaming `generateText`.

### 47.2 Flexible Auto-Healing & Line-Number Stripper
- [x] In `edit-tool.service.ts`, implemented 4-tier match fallback: Exact Match → CRLF Normalized Match → Line-Number Stripped Match (`^\s*\d+:\s*`) → Whitespace-Tolerant Block Match.
- [x] In `model-router.service.ts`, added model-agnostic few-shot examples and strict line-number omission instructions for open-weights models.

### 47.3 Verification & Testing
- [x] Vitest tool-call repair test suite passed 7/7 tests in 13ms (`apps/api/test/tool-call-repair.spec.ts`).
- [x] TypeScript build completed with 0 errors (`npm run build -w apps/api`).
- [x] Verified autonomous nudge loop triggers and recovers empty/conversational turns without prematurely aborting the stream.

---

## Phase 48: Monolithic Codebase Modularization & Maintainability Refactoring ✅ DONE

**Goal:** Refactor massive monolithic files in backend and frontend to enhance modularity, testability, and long-term maintainability without breaking any existing features.

### 48.1 Backend Modularization (`apps/api`)
- [x] Extracted `tool-call-extractor.util.ts` containing pure regex and string parsing functions (`extractMentionedFilenames`, `hasExplicitDeleteIntent`, `extractLooseArguments`, `extractInlineFunctionCalls`).
- [x] Extracted `WorkspacePromptBuilderService` (`workspace-prompt-builder.service.ts`) containing prompt preparation, physical file scanning, tool routing, and context assembly.
- [x] Registered `WorkspacePromptBuilderService` into `WorkspaceModule` providers and exports.
- [x] Refactored `WorkspaceRunnerService` to delegate parsing and context preparation to the new service and utility.
- [x] Verified backend compilation: `npx nest build` succeeds with 0 errors.

### 48.2 Frontend Modularization (`apps/web`)
- [x] Extracted `ProviderCard.tsx` subcomponent for clean rendering of individual provider catalog cards.
- [x] Extracted `ProviderForm.tsx` subcomponent for provider creation, editing, connection testing, and model pool selection.
- [x] Refactored `ModelProviderSettings.tsx` to consume `ProviderCard` and `ProviderForm`.
- [x] Verified frontend compilation: `npx tsc --noEmit` (0 errors) and `npm run build` succeeds (built in 56.75s).

### 48.3 Verification & Benchmark
- [x] Ran autonomous benchmark test `scripts/test-rekap-extended.ts` after refactoring: finished in 29.5s with 15/17 automated assertions passed.

---

## Phase 49: Autonomous Living System Prompt (`ARUNAKI.md`) Engine & Desktop COM Registration ✅ DONE

**Goal:** Create an autonomous background cartography engine that scans connected workspace files, synthesizes an operating system prompt (`.arunaki/ARUNAKI.md`), syncs it to the UI Knowledge Base, dynamically self-updates on user corrections, and injects it at 0ms latency into runtime chat without becoming a bottleneck.

### 49.1 Desktop Tools Registration
- [x] Created `desktop-tools.registrar.ts` and registered all 9 Desktop COM automation tools (`desktop_open_excel`, `desktop_excel_edit`, `desktop_open_word`, `desktop_word_type`, `desktop_word_format`, `desktop_open_ppt`, `desktop_open_file`, `desktop_send_keys`, `desktop_screenshot`).
- [x] Registered `DesktopToolsRegistrar` into `ToolsProviderModule` and exported to global runtime registry.

### 49.2 WorkspaceCartographerService & Living ARUNAKI.md
- [x] Created `WorkspaceCartographerService` with non-blocking async scanning and 0ms in-memory cache.
- [x] Implemented intelligent file sampling (max 40 lines per file) to prevent memory & token bloat.
- [x] Implemented structured `ARUNAKI.md` synthesis (Domain profile, File Catalog & Relationships, Strict Syntax Invariants, User Preferences & Learned Corrections).
- [x] Implemented dual-sync: writes physical `.arunaki/ARUNAKI.md` and syncs to Prisma Knowledge Base for the UI Knowledge Page.

### 49.3 Runtime Injection & Dynamic Learning Loop
- [x] In `WorkspacePromptBuilderService`, injected `ARUNAKI.md` as `# LOCAL WORKSPACE OPERATING RULES` with 0ms RAM cache.
- [x] In `BackgroundReviewService`, added post-response learning hook to auto-patch `ARUNAKI.md` when user provides corrections in chat.

### 49.4 Verification & Benchmark
- [x] Build check: `npx nest build` passed with 0 errors.
- [x] Verified generated `ARUNAKI.md` in database: accurately synthesized all customer prefixes (`CK`, `BG`, `CI`, `PAK`), bank codes (`BCA`, `BNI`, `BRI`), section headers, and immutable balances.
- [x] End-to-end autonomous rekap benchmark passed successfully with surgical patch editing and template preservation.

---

## Phase 50: Workspace Rules Sentinel Agent & Isolated Sub-Agent Sandboxing ✅ DONE

**Goal:** Create a resident, event-driven guardian agent (`WorkspaceRulesSentinelService`) that silently monitors user conversation turns in the background (0% CPU when idle), compares user directives against `ARUNAKI.md`, autonomously evolves the living rulebook when new preferences or corrections arise, and sandboxes heavy cartography tasks into dedicated Sub-Agents.

### 50.1 Domain-Agnostic & Zero-Bias Prompt Synthesis
- [x] Refactored `WorkspaceCartographerService` prompt to eliminate any hardcoded domain bias, making rule synthesis 100% agnostic to any industry (accounting, legal, clinic, retail, logistics, manufacturing, education, software).
- [x] Refactored `buildDeterministicRules` fallback to dynamically discover file extensions and metadata without hardcoded strings.

### 50.2 Sub-Agent Delegation & Parallel Sandboxing
- [x] Integrated `SubAgentRunnerService` into `WorkspaceCartographerService` so heavy workspace cartography executes in an isolated sub-agent sandbox.
- [x] Added `agent_spawn` tool routing in `WorkspacePromptBuilderService` for multi-task, batch, and parallel operations.

### 50.3 Resident Workspace Rules Sentinel Daemon
- [x] Created `WorkspaceRulesSentinelService` listening to `@OnEvent('workspace.agent.completed')`.
- [x] Implemented fast-heuristic intent filtering (`INTENT_TRIGGER_REGEX`) to wake up only when corrections/rules are present (0ms overhead on normal turns).
- [x] Implemented intelligent diff analysis against current `ARUNAKI.md` and autonomous patching.
- [x] Registered `WorkspaceRulesSentinelService` in `WorkspaceModule`.

### 50.4 Verification & Benchmark
- [x] Build check: `npx nest build` passed with 0 errors.
- [x] Verified resident daemon initialization: `[WorkspaceRulesSentinelService] 🛡️ Workspace Rules Sentinel Agent initialized (Resident & Event-Driven).`
- [x] End-to-end autonomous rekap benchmark passed with surgical `edit` and background completion handling.

---

## Phase 51: Programmatic & Multi-Tool Batch Execution (PTC Engine) ✅ DONE

**Goal:** Implement DeepSeek Harness-inspired Programmatic Tool Calling (PTC) & atomic batch execution to reduce agent turnaround latency by ~70% (<10s) and prevent multi-round back-and-forth overhead.

### 51.1 Programmatic Tool Calling (PTC) Engine Service
- [x] Created `PtcExecutorService` in `apps/api/src/modules/tools/services/ptc-executor.service.ts` to parse, validate, and execute batched/scripted tool calls atomically.
- [x] Implemented rollback transaction semantics: if one tool in a multi-step operation fails, roll back file mutations to preserve document integrity.

### 51.2 Parallel & Chained Tool Invocations in WorkspaceRunner
- [x] Registered `batch_execute` tool in `HarnessMetaToolsRegistrar` and wired `PtcExecutorService` into `ToolsProviderModule`.
- [x] Added `batch_execute` tool routing in `WorkspacePromptBuilderService`.

### 51.3 Verification & Benchmark
- [x] Vitest unit test `src/modules/tools/services/ptc-executor.service.spec.ts` passed (2/2 tests passed, verifying multi-step execution & auto-rollback).
- [x] Ran autonomous benchmark `scripts/test-ptc-benchmark.ts`: 5/5 assertions passed with 100% template preservation.

---

## Phase 52: Append-Only Event-Stream Transcript & Time-Travel Engine ✅ DONE

**Goal:** Implement an append-only event stream transcript as the single source of truth for full replayability, auditability, and 1-click Undo/Rollback.

### 52.1 Append-Only Transcript Engine Service
- [x] Create `TranscriptEngineService` in `apps/api/src/modules/workspace/services/transcript-engine.service.ts` to log session events into `.arunaki/sessions/{sessionId}/transcript.jsonl`.
- [x] Automatically capture pre-mutation snapshots for all file mutating tools (`edit`, `write`, `delete`, `rename`).

### 52.2 Time-Travel Rollback Service & REST Controller
- [x] Create `TimeTravelService` in `apps/api/src/modules/workspace/services/time-travel.service.ts` to restore workspace files to previous checkpoints.
- [x] Expose rollback and transcript timeline endpoints in `WorkspaceController`.

### 52.3 Verification & Benchmark
- [x] Vitest unit tests for transcript append & rollback logic (`transcript-engine.service.spec.ts` — 2/2 passed).
- [x] End-to-end benchmark verifying 1-click rollback restores original document content with zero data corruption (`test-time-travel-benchmark.ts` — 5/5 passed).

---

## Phase 53: Model Normalization & Multi-Provider Resilient Adapter ✅ DONE

**Goal:** Standardize LLM reasoning streams (`<think>`, `reasoning_content`), normalize diverse tool call schemas, and build resilient SSE stream reconstruction across all AI providers.

### 53.1 Universal Stream & Reasoning Normalizer
- [x] Create `ModelStreamNormalizerService` to unify `reasoning_content`, `<think>`, and content deltas.
- [x] Separate thoughts from executable content to prevent reasoning leakage into chat prose and history.

### 53.2 Resilient Multi-Provider SSE Buffer & Fallback Engine
- [x] Implement SSE chunk reconstruction buffer for fragmented JSON lines and network stalls.
- [x] Unify multi-format tool call parsing (`[Assistant tool call]`, `<tool_call>`, `Action/Action Input`, XML format, relaxed JSON).

### 53.3 Verification & Multi-Model Benchmark
- [x] Unit tests for streaming reasoning separation and multi-format tool parsing (`model-stream-normalizer.service.spec.ts` — 4/4 passed).
- [x] End-to-end benchmark verifying resilient tool execution across reasoning and standard models (`test-model-normalization.ts` — 5/5 passed).

---

## Phase 54: Parallel Multi-Document Sub-Agent Orchestrator ✅ DONE

**Goal:** Scale office document operations across multiple parallel sandboxed sub-agent workers without main-chat context pollution.

### 54.1 Multi-Document Orchestrator Service
- [x] Create `MultiDocOrchestratorService` in `apps/api/src/modules/tools/services/multi-doc-orchestrator.service.ts` to manage parallel sub-agent task partitioning and aggregation.
- [x] Implement concurrency pool limiter to prevent 429 rate-limiting on bulk file operations.

### 54.2 Tool Registration & Runtime Integration
- [x] Register `multi_doc_process` in `HarnessMetaToolsRegistrar` and expose to prompt builder.
- [x] Wire progress tracking and transcript event logging into sub-agent worker lifecycles.

### 54.3 Verification & Benchmark
- [x] Vitest unit tests for parallel task partitioning, concurrency throttling, and result aggregation (`multi-doc-orchestrator.service.spec.ts` — 3/3 passed).
- [x] End-to-end benchmark verifying parallel multi-file processing with zero parent context pollution (`test-multi-doc-subagents.ts` — 5/5 passed).

---

## Phase 55: Robust LLM-Based Intent Classification Engine ✅ DONE

**Goal:** Refactor rigid regex-based prompt tool routing to a dynamic LLM-driven intent classification engine, resolving brittle matching logic and multi-language variability.

### 55.1 Intent Classification Engine
- [x] Implemented classifyIntent in AiService to output strongly-typed intent flags (isMutation, isGui) and 	ools array.
- [x] Refactored WorkspacePromptBuilderService.buildInitialContext to await and integrate LLM classification asynchronously.

### 55.2 Workspace Runner Modernization
- [x] Cleaned up deprecated MUTATION_TOOLS and hardcoded regex nudges in WorkspaceRunnerService.
- [x] Fixed TS typing errors across runner boundaries.

### 55.3 E2E Verification
- [x] End-to-end testing verifying structure and merged cell preservation during data update (	est-excel-structure-preservation.ts).

---

## Phase 56: Critical Security & Production Optimization (PENDING)

**Goal:** Menambal celah keamanan kritis pada path traversal, mengoptimalkan konsumsi memori agen jangka panjang, dan memisahkan abstraksi event system.

### 56.1 Workspace Isolation Enforcement (Keamanan Kritis)
- [x] Refactor 
ead-tool.service.ts dan write-tool.service.ts agar menolak operasi baca/tulis di luar workspace.rootPath.
- [x] Gunakan fungsi resolusi path absolut yang memvalidasi bahwa 	argetPath.startsWith(workspace.rootPath) untuk memblokir prompt injection path traversal (seperti ../../Windows).

### 56.2 Memory Consolidation (Long-running Agent Context)
- [x] Implementasikan consolidateMemories() di memory.tool.ts atau memory.service.ts.
- [x] Ringkas riwayat pesan yang melebihi batas batas token/kepadatan agar tidak memicu context length exceeded.

### 56.3 Dedicated Agent Event System
- [x] Ekstrak abstraksi gent-event.service.ts untuk membungkus EventEmitter2.
- [x] Standarkan payload tipe event untuk *lifecycle* Agent (Started, Completed, Failed, dsb).c

---

## Phase 57: Voice Interaction & Desktop Packaging (DEFERRED)

**Goal:** Menjadikan Arunaki aplikasi Desktop *Native* dengan fitur asisten suara. **Fitur ini ditunda (dikerjakan nanti).**

### 57.1 Voice Interaction (Ditunda)
- [ ] Integrasi Speech-To-Text (STT) untuk input.
- [ ] Integrasi Text-To-Speech (TTS) untuk *streaming playback* suara AI.

### 57.2 Desktop Packaging 
- [ ] Matangkan integrasi Electron di  pps/desktop/main.cjs.
- [ ] Build installer Windows/Mac.

---

## Phase 58: Enterprise Document Suite, 50-Tool Batched Stress, Real LLM Benchmark & Tool Alias Resolver ✅

**Goal:** Menyatukan seluruh 50+ tool dokumen ke dalam sistem otomasi native COM, pengujian beban konkurensi (hammer test), dan verifikasi benchmark nyata ke LLM.

### 58.1 Native Office COM Suite (Headless & Interactive)
- [x] Otomasi penuh Microsoft Excel (`desktop_excel_edit`): Cell writing, Formula preservation, multi-sheet cloning, clear constants, PDF export.
- [x] Otomasi penuh Microsoft Word (`desktop_word_edit`): Template placeholder replacement, heading/paragraph append, table insertion, PDF export.
- [x] Otomasi penuh Microsoft PowerPoint (`desktop_ppt_edit`): Shape text editing, structured slide generation with bullets, PDF export.

### 58.2 Enterprise PDF & Redaction Pipeline
- [x] Tool `pdf_manage_pages` (Merge multi-file, slice/extract page range, diagonal text watermark).
- [x] Tool `pdf_stamp_image` (Anchor/coordinate digital signature & e-Materai stamping).
- [x] Tool `doc_redact_pii` (Deteksi & sensor otomatis NIK KTP, NPWP, Rekening, HP, Email).
- [x] Tool `doc_compare_versions` (Line-by-line diffing, similarity scoring, redline Markdown audit table).

### 58.3 50-Tool Batched Stress & Concurrency Hammer Suite
- [x] Pembuatan `test-all-50-tools-batched-stress.spec.ts` membagi 50 tool ke dalam 5 Batch terisolasi.
- [x] Pengujian beban konkurensi 15 tool paralel serentak tanpa race condition / crash.

### 58.4 Real LLM Benchmark & Autonomous Tool Alias Resolver
- [x] Pembuatan `test-real-llm-benchmark.spec.ts` menguji 7 skenario dokumen nyata langsung ke model LLM.
- [x] Implementasi `resolveToolAlias` di `ToolRegistryService` & `AgentRunnerService` untuk menormalkan variasi nama tool alami dari LLM (`read_file`, `write_file`, `edit_file`, `redact`, `diff`, `merge_pdf`, `excel`, `word`, `ppt`, `pdf_tool`, `compare_documents`).
- [x] Implementasi parser tag XML (`<tool name="...">`, `<arg name="...">`, `<tool_calls>`) di `tool-call-repair.ts`.

### 58.5 Documentation Standard Alignment
- [x] Restrukturisasi total `README.md` mengikuti standar dokumentasi aplikasi desktop modern (gaya `opencode.ai/docs`).
- [x] Penghapusan 100% kata "AI" dari `README.md` (reposisi sebagai *Desktop Document Agent & Automation Harness*).
- [x] Pembersihan perintah build/test developer dari dokumentasi end-user.

---

## Phase 59: Cross-Tool Stability Hardening, Free-Tier Routing & Multilingual Gates (DONE)

**Goal:** Menghapus seluruh kegagalan laten yang ditemukan lewat stress testing berbasis outcome pada model gratis terkecil (agnes-2-0-flash / glm-4-7-flash), menutup kebocoran rotasi ke model berbayar, dan membuat gerbang deterministik tahan campuran bahasa.

### 59.1 Provider Failover & Free-Tier Routing
- [x] Kenari preset fallbackModels diganti pool GRATIS saja (agnes/glm/step/deepseek:free) - menutup kebocoran tagihan deepseek-v4-flash berbayar.
- [x] getNextModelInPreset menjadi pool-aware terhadap triedProviderIds (rotasi maju antar model gratis, tidak stuck re-propose pool[0]).
- [x] AI_MODEL default dipindah ke agnes-2-0-flash:free.

### 59.2 Excel COM Hardening (desktop_excel_edit)
- [x] workspace-path.util.ts: path absolut dari model di-resolve relatif terhadap root workspace (+ blokir traversal) - unit 5/5.
- [x] write-tool memakai resolver tsb; append_row menerima varian payload row:[array].
- [x] Registrar excel: per-action failures kini status:error (menghilangkan fake success).
- [x] Label matching: dynamic header-row detection (baris header mana pun), layout Key-Value (label|nilai), UPSERT kolom kunci + cross-keyed lookup.
- [x] Delta guard non-numerik; atomic batch save (skip save bila ada aksi gagal).
- [x] Completeness nudge runner utk goal total/rekap/ringkasan/balance (ID+EN).

### 59.3 Word & PPT COM (proaktif, first-run pass)
- [x] word-com & ppt-com: atomic save + success flag jujur (failCount).
- [x] Registrar Word/PPT: surface per-action failures.
- [x] Suite office-stability-test.cjs: D 3/3, E1 1/1.

### 59.4 OCR / Vision Path Resolution
- [x] image_ocr & vision_ai handler resolve path via resolveWithinWorkspace (sebelumnya hanya cek cwd/uploads - file workspace selalu not found).
- [x] Verifikasi end-to-end fixture struk PNG (nama toko + nominal akurat).

### 59.5 Memory & doc_search Activation
- [x] Registrasi tool doc_search (knowledge+files+messages via DB).
- [x] Registrasi tool memory multi-action (remember/recall/search/list).
- [x] Pensiunkan skills_tool (tanpa konten) dari registrar + DI.
- [x] memory.repository.search ditulis ulang: any-keyword case-insensitive; ephemeral types (run_summary/workspace_history) dikecualikan.
- [x] Loop persistence terverifikasi E2E: store -> fresh-turn recall dijawab dari memori.

### 59.6 agent_spawn Repair
- [x] Perbaiki pemanggilan API yang salah nama (spawnSubAgents -> spawnParallel) + normalisasi bentuk task dari model; verifikasi hidup 1/1 sub-agent selesai.

### 59.7 Regex Audit & Multilingual Gates
- [x] Audit 4 kelas regex berisiko (stateful /g+.test, RegExp dinamis dari input, nested quantifier, escaping): bersih.
- [x] OFFICE_*_RE & MUTATION_KEYWORDS_RE simetris ID+EN; false positive hanya over-provision (aman).
- [x] smart-recall stopwords +30 kata fungsi Indonesia.

### 59.8 Test Artifacts (komit)
- [x] apps/api/test/tool-stability-test.cjs (v2, outcome-based, mode batch T1..T9).
- [x] apps/api/test/excel-stress-test.cjs (multi-sheet no-hints).
- [x] apps/api/test/office-stability-test.cjs (Word/PPT, fixture COM).
- [x] apps/api/test/backend-tools-stability.cjs + backend-tools-2.cjs + backend-tools-3.cjs.
- [x] Dev-log lengkap: docs/dev-logs/dev-log-2026-08-22-excel-stress-test.md.

### Known Limitations (bukan bug, terdokumentasi)
- agnes-2-0-flash kadang mengabaikan section meta pada prompt panjang (ask_user, Relevant Memory) - mitigasi failover otomatis ke glm+.
- desktop_screenshot/send_keys butuh Desktop Bridge Electron aktif.
- web_search deterministik tergantung jaringan; batch_execute PTC belum tereksekusi langsung oleh model mini.

---

## Phase 60: OpenCode Engine Migration ✅ DONE

**Goal:** Replace custom NestJS engine with rebranded OpenCode fork. React frontend + Electron desktop stay.

### 60.1 Fork & Rebrand
- [x] Clone OpenCode engine (10 packages) into `packages/engine/`
- [x] Rename `apps/api/` → `apps/api-legacy/` (reference only, not built)
- [x] Rebrand all `@opencode-ai/*` → `@arunaki/*` (704 files)
- [x] Strip TUI, SolidJS, CLI packages
- [x] Install dependencies (601 packages) with bun catalog

### 60.2 Entry Point
- [x] `@arunaki/engine` package (formerly opencode) — main CLI + server entry
- [x] SDK moved from `sdk/js/` to `sdk/` for proper workspace resolution

### 60.3 Document Tools (COM)
- [x] `@arunaki/tools` package with Excel COM tool
- [x] Word COM and PowerPoint COM tools
- [x] Registered in engine tool registry (`packages/engine/opencode/src/tool/registry.ts`)

### 60.4 Frontend Connection
- [x] Engine adapter (`apps/web/src/lib/engine.ts`) — maps old API to engine endpoints
- [x] Session creation: `POST /api/session`
- [x] Prompt: `POST /api/session/:id/prompt`
- [x] Event streaming: `GET /api/event` with event mapping
- [x] Removed `@microsoft/fetch-event-source` dependency

### 60.5 Database
- [x] Drizzle ORM (follow OpenCode), Prisma dropped
- [x] SQLite via `@arunaki/effect-drizzle-sqlite`

### Known Limitations
- Knowledge endpoints not yet mapped (deferred)
- Electron desktop process launcher not yet connected (deferred)
- Guided harness, post-run, todo memory deferred

---

## Phase 61: Workspace Entity Removal → Agent-per-Folder (DONE)

**Goal:** Hapus entitas `Workspace` dari UI + alur session/folder, ganti dengan model agent-per-folder (folder aktif = `cwd` VSCode). Semua rute `/api/**` lokal, tidak ada proxy eksternal.

### 61.1 Routing HTTP
- [x] `isLocalWorkspaceRoute` di `shared/workspace-routing.ts` kini memperlakukan semua `/api/*`, `/session/*`, `/console` sebagai rute lokal (bukan forward ke remote)
- [x] Update unit test `test/server/workspace-routing.test.ts`
- [x] Perbaiki `bunfig.toml` yang masih mereferensikan `@opentui/solid/preload` (paket TUI yang sudah dihapus)

### 61.2 Frontend (`apps/web`) — hapus Workspace
- [x] `UnifiedWorkstationPage` → konsep `activeFolder` (path nyata) menggantikan daftar `Workspace`; `createSession({ directory: activeFolder })` memakai path folder sebenarnya
- [x] File tree & konten dibaca via engine `/api/file?path=` & `/api/file/content?path=`
- [x] Chat history dibaca via engine `getMessages()` (`/api/session/:id/message`)
- [x] `ConnectFolderModal` → pemilih folder (Electron dialog / path), tanpa daftar workspace
- [x] `SearchSectionModal` & `HistoryPage` → `listSessions()` dari engine
- [x] `AppLayout` footer menampilkan `arunaki_active_folder` (path), bukan workspace; `Open Folder` mengatur folder aktif tanpa `POST /workspaces`
- [x] Hapus route `/workspace/:id` di `App.tsx`
- [x] `WorkstationRightChat` paste-image tidak lagi memanggil legacy `/api/files/upload`

### 61.3 Dokumentasi
- [x] Update `AGENTS.md`, `docs/VISION.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/BOUNDARIES.md`
- [x] `docs/REVISION-WORKSPACE-REMOVAL.md` ditandai DONE

### Catatan Scoping
- Tabel & kontrol-plane `Workspace` di engine (remote sandbox) TIDAK dihapus karena tidak dipakai jalur web dan berisiko tinggi; fokus pada penghapusan dari UI + routing + alur session.

## Phase 61.5: Chat E2E Fix + Vendor Auth Packages (DONE)

**Goal:** Verifikasi alur chat end-to-end (prompt → turn LLM → message persist) setelah Phase 61, dan perbaiki package auth hasil vendoring dari fase sebelumnya.

- [x] **Blocker start server** — `@arunaki/gitlab-auth` & `@arunaki/poe-auth` hasil commit `a30cbbe` hanya berisi `package.json` kosong (tanpa source), sehingga `plugin/index.ts` gagal resolve dan server tidak bisa start. Diisi ulang dari source npm asli (`opencode-gitlab-auth@2.1.0`, `opencode-poe-auth@0.0.1`); `.d.ts` di-rewire ke `@arunaki/plugin`. Konvensi: tambah `.gitignore` `!dist/` per-package karena `dist/` global di-ignore.
- [x] **E2E chat verified** — prompt sukses via `POST /api/session/:id/prompt` (payload SDK `{prompt:{type:"text",text}}`), turn LLM jalan, assistant message tersimpan & terbaca penuh di `GET /api/session/:id/message` (`parts/content` terisi). Route `POST /api/session/:id/message` (v2, `{parts:...}`) berbeda dan bukan jalur web.
- [x] `npm run build -w apps/web` — 0 error

## Phase 61.6: Rebrand Sisa — OpenAPI Spec, LLM Prompts, Provider, Skill Docs (DONE)

**Goal:** Tuntaskan rebranding 1-to-1: tidak ada lagi jejak identitas "opencode" yang bocor ke runtime/identitas, setelah previously hanya package names yang direbrand (Phase 60.1).

- [x] **`sdk/openapi.json` regenerated** — spec committed sebelumnya stale (601× "opencode", title "opencode", `createOpencodeClient`); source (`public.ts`, `generate.ts`) sudah bersih. `bun dev generate` dari `packages/opencode` → 0 "opencode", `title:"arunaki"`, `description:"Arunaki api"`, 188 operations, paths identik.
- [x] **LLM system prompts** — `opencode/src/session/prompt/*.txt` (default, beast, codex, copilot-gpt-5, gemini, gpt, kimi, meta, trinity, anthropic) rebrand ke "Arunaki"; URL → repo `JULIOSIRINGORINGO/Arunaki` & `arunaki.ai`.
- [x] **Tool/command templates** — `tool/lsp.txt`, `command/template/initialize.txt`, `core/src/plugin/command/initialize.txt` rebrand; konfigurasi `opencode.json` → `arunaki.json`.
- [x] **Provider rename** — `core/src/plugin/provider/opencode.ts` → `arunaki.ts` (+ import di `provider.ts:24`, test file → `provider-arunaki.test.ts`). Isi file sudah Arunaki sejak awal.
- [x] **Skill docs konsisten fakta** — `customize-arunaki.md` disamakan dengan loader nyata: project dir `.Arunaki/` (kapital, sesuai `config/paths.ts:29,35`), global `~/.config/arunaki/` (sesuai `core/global.ts:13`), `@arunaki/plugin`, `arunaki.ai/config.json`. Duplikat `customize-opencode.md` dihapus.
- [x] **Bersihkan scratch** — hapus `core/src/effect/dfdf` (file sampah).
- [x] `npm run build -w apps/web` — 0 error; typecheck engine bersih untuk perubahan (sisa error pre-existing `@Arunaki-ai/http-recorder`); test provider `provider-arunaki.test.ts` — 12 pass.
- [ ] **Sengaja dipertahankan (flag)** — `models-dev.ts:160-163` default `https://models.opencode.ai` (feed data live, overridable `Arunaki_MODELS_URL`); `opencode/bin/opencode` + `postinstall.mjs` + `Dockerfile` + `core/package.json` `bin` (`@arunaki/engine` → `./bin/opencode`, file belum ada) = mekanisme distribusi compiled-CLI masa depan, tidak dipakai jalur web/desktop run-from-source. Referensi di file docs/specs/fixtures/vendor adalah provenance. Di-skip karena menunggu keputusan MASTER PROMPT (single-harness .exe).
