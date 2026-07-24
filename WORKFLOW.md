# WORKFLOW.md - Development Roadmap

**Version:** 1.0  
**Last Updated:** 2026-07-24

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

## Phase 4: File Module 🔲

**Goal:** File metadata and content storage.

### 4.1 File Repository & Service
- [ ] `FileModule` with CRUD
- [ ] `findBySourceId(sourceId)` — List files in a source
- [ ] `findByWorkspaceId(workspaceId)` — List all files in workspace
- [ ] Store file metadata (name, path, type, size, mimeType)
- [ ] Store extracted text content for search

### 4.2 FileMetadata
- [ ] `FileMetadataRepository` & `FileMetadataService`
- [ ] Store parsed metadata (title, author, pageCount, etc.)

**Endpoints:**
```
GET /files/source/:sourceId
GET /files/workspace/:workspaceId
GET /files/:id
```

---

## Phase 5: Parser Service 🔲

**Goal:** Extract text and metadata from documents.

### 5.1 Parser Providers
- [ ] `ParserProvider` interface (abstraction)
- [ ] `TxtParser` — Plain text files
- [ ] `MdParser` — Markdown files
- [ ] `CsvParser` — CSV files
- [ ] `PdfParser` — PDF extraction (pdf-parse)
- [ ] `DocxParser` — Word documents (mammoth)
- [ ] `XlsxParser` — Excel files (xlsx)

### 5.2 Parser Service
- [ ] Route file to correct parser based on type
- [ ] Extract text content
- [ ] Extract metadata
- [ ] Store results in File + FileMetadata

**Note:** Parser does NOT save directly — passes results to FileService.

---

## Phase 6: Storage Service 🔲

**Goal:** Local file system abstraction.

### 6.1 Storage Service
- [ ] `StorageService` — Only module that reads/writes filesystem
- [ ] `readFile(path)` — Read file content
- [ ] `writeFile(path, content)` — Write file
- [ ] `getFileInfo(path)` — Get size, dates, type
- [ ] Path traversal protection (validate paths stay within workspace)

**Note:** AI Engine and other services NEVER touch filesystem directly.

---

## Phase 7: Search Service 🔲

**Goal:** Search files by metadata and content.

### 7.1 Search Providers
- [ ] `SearchProvider` interface (abstraction)
- [ ] `MetadataSearchProvider` — Filter by file type, name, date
- [ ] `FtsSearchProvider` — SQLite FTS5 full-text search
- [ ] `VectorSearchProvider` — Stub only (V2)

### 7.2 Search Service
- [ ] `searchFiles(workspaceId, query)` — Combined search
- [ ] Return ranked results with relevance score
- [ ] AI Engine only calls SearchService, never providers directly

---

## Phase 8: Artifact Service 🔲

**Goal:** Manage AI-generated outputs.

### 8.1 Artifact Repository & Service
- [ ] `ArtifactModule` with CRUD
- [ ] `createArtifact(workspaceId, data)` — Save new artifact
- [ ] `findByWorkspaceId(workspaceId)` — List workspace artifacts
- [ ] `getArtifactContent(id)` — Read artifact file

### 8.2 Artifact Storage
- [ ] Artifacts saved to workspace-specific folder
- [ ] Separate from source files
- [ ] Support multiple formats (md, html, pdf, xlsx)

---

## Phase 9: Workspace Initialization 🔲

**Goal:** Automatic workspace setup when created.

### 9.1 Initialization Flow
```
Create Workspace → Scan Files → Parse Documents → Extract Metadata → Index FTS → Ready
```

### 9.2 Implementation
- [ ] `WorkspaceService.initialize(workspaceId)` — Orchestrate full flow
- [ ] Stage 1: Scan — Count files, detect types
- [ ] Stage 2: Parse — Extract text from all files
- [ ] Stage 3: Metadata — Extract metadata from files
- [ ] Stage 4: Index — Build FTS5 index
- [ ] Stage 5: Profile — Generate workspace profile summary
- [ ] Update workspace status at each stage (pending → processing → ready)
- [ ] Handle partial failures (one file fails ≠整个 workspace fails)

---

## Phase 10: Frontend - Layout & Navigation 🔲

**Goal:** Basic UI shell with sidebar.

### 10.1 Layout Components
- [ ] `AppLayout` — Sidebar + Main content
- [ ] `Sidebar` — Navigation (Chat, Workspace, History, Settings)
- [ ] `SidebarItem` — Individual nav item
- [ ] Responsive behavior (collapsible on mobile)

### 10.2 Routing
- [ ] `/` → Chat Mode (default)
- [ ] `/workspace` → Workspace List
- [ ] `/workspace/:id` → Workspace Detail
- [ ] `/settings` → Settings
- [ ] `/history` → Chat History

---

## Phase 11: Frontend - Chat UI 🔲

**Goal:** Chat interface for AI Assistant mode.

### 11.1 Chat Components
- [ ] `ChatPage` — Main chat layout
- [ ] `ChatMessages` — Message list (scrollable)
- [ ] `MessageBubble` — User/AI message display
- [ ] `ChatInput` — Text input + send button
- [ ] `WelcomeMessage` — Empty state with suggestions

### 11.2 Chat Features
- [ ] Create new chat
- [ ] Send message → Get AI response
- [ ] Display messages with timestamps
- [ ] Copy AI response
- [ ] Loading state while AI responds
- [ ] Auto-scroll to bottom

### 11.3 State Management
- [ ] `ChatProvider` — Manage chat state
- [ ] Use TanStack Query for API calls
- [ ] Optimistic updates for messages

---

## Phase 12: Frontend - Workspace UI 🔲

**Goal:** Workspace management interface.

### 12.1 Workspace List
- [ ] `WorkspaceListPage` — Grid of workspace cards
- [ ] `WorkspaceCard` — Name, stats, last action
- [ ] Create workspace button
- [ ] Search/filter workspaces

### 12.2 Create Workspace Flow
- [ ] `CreateWorkspaceModal` — Multi-step form
- [ ] Step 1: Name + description
- [ ] Step 2: Select sources (folder/upload)
- [ ] Step 3: Review + create
- [ ] Progress indicator during initialization

### 12.3 Workspace Detail
- [ ] `WorkspaceDetailPage` — Three-panel layout
- [ ] Left: Sources panel
- [ ] Center: Workspace chat
- [ ] Right: Studio (quick actions)
- [ ] Initialize workspace on first open

---

## Phase 13: Frontend - Settings 🔲

**Goal:** User preferences.

### 13.1 Settings Page
- [ ] Profile settings (name, email)
- [ ] AI model selection
- [ ] Domain knowledge management
- [ ] Theme toggle (light/dark)

---

## Phase 14: Integration & Testing 🔲

**Goal:** End-to-end testing and polish.

### 14.1 E2E Testing
- [ ] Full chat flow (create → send → receive)
- [ ] Workspace creation flow
- [ ] File upload and parsing
- [ ] AI response in workspace context

### 14.2 Bug Fixes & Polish
- [ ] Error handling
- [ ] Loading states
- [ ] Empty states
- [ ] Responsive design

---

## Development Rules

1. **Backend first, Frontend second** — Always complete backend API before building frontend.
2. **Module isolation** — Each module has its own folder with repository, service, controller, DTOs.
3. **Repository Pattern** — Never call Prisma directly from services.
4. **AI Engine never touches Storage/DB directly** — Always through Service layer.
5. **API response format** — Always `{ data, error, meta }`.
6. **API key security** — AI keys stay in backend `.env`, never exposed to frontend.
7. **Commit after each module** — Small, focused commits.

---

## Testing Rules (MANDATORY)

**Every phase MUST pass all testing steps before moving to next phase.**

### Testing Checklist Per Phase

```
□ Build succeeds (npm run build — 0 errors)
□ All endpoints tested manually (curl/PowerShell)
□ Response format correct ({ data, error, meta })
□ Error handling works (invalid input, missing data)
□ Database operations work (create, read, update, delete)
□ No regressions (existing modules still work)
```

### Testing Process

1. **Build test** — `npm run build` must pass with 0 errors.
2. **Unit test per endpoint** — Test each endpoint individually.
3. **Integration test** — Test endpoints together (e.g., create workspace → create source → get by workspace).
4. **Error test** — Test with invalid data, missing fields, non-existent IDs.
5. **Regression test** — Run all previous module tests to ensure nothing broke.
6. **Document results** — Write test results in completion report.

### Phase Completion Criteria

A phase is ONLY marked ✅ when:
- All tasks in the phase are completed
- All testing steps pass
- No known bugs or issues remain
- Code is committed

**Do NOT mark phase as ✅ if any test fails. Fix first, then mark.**

---

## Current Status

**Phase:** 4 - File Module  
**Next:** Build FileModule for file metadata and content storage

---

## File Structure

```
apps/api/src/
├── common/
│   ├── base.service.ts
│   ├── dtos/api-response.dto.ts
│   ├── interfaces/base-repository.interface.ts
│   └── providers/
│       ├── prisma.module.ts
│       ├── prisma.service.ts
│       └── prisma-base.repository.ts
├── config/config.module.ts
├── logger/logger.module.ts
├── modules/
│   ├── workspace/     ✅
│   ├── source/        ✅
│   ├── chat/          ✅
│   ├── ai/            ✅
│   ├── file/          🔲 NEXT
│   ├── parser/        🔲
│   ├── storage/       🔲
│   ├── search/        🔲
│   └── artifact/      🔲
├── app.module.ts
└── main.ts

apps/web/src/
├── components/        🔲
├── pages/             🔲
├── providers/         🔲
├── hooks/             🔲
├── App.tsx
└── main.tsx
```
