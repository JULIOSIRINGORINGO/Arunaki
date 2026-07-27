# Arunaki vs OpenClaw — Reverse Engineering Checklist

Status: **Phase 1 Complete (10/10 core patterns)**  
**Phase 2 In Progress** — Domain Config System (the "Plugin System")

---

## 🎯 Phase 1: Core OpenClaw Patterns ✅ DONE

| # | OpenClaw Pattern | Arunaki Implementation | File |
|---|---|---|---|
| 1 | **Folder-based context** | Workspace folder as working directory | `workspace-runner.service.ts` |
| 2 | **File read/write/process** | 27 tools: read PDF/Excel/Word/CSV, write reports | `document-reader.tool.ts`, `document-generator.tool.ts` |
| 3 | **Search across folder** | FTS5 full-text search + metadata search | `search.service.ts`, `session-search.service.ts` |
| 4 | **Plugin/Skill system** | Self-registering ToolRegistry + SkillService | `tool-registry.service.ts`, `skill.service.ts` |
| 5 | **Hot-reload / live config** | Domain Config JSON (live reload planned) | `domain.registry.service.ts` (in progress) |
| 6 | **Self-writing skills** | SkillSelfImproveService (LLM updates skills) | `skill-self-improve.service.ts` |
| 7 | **Proactive/Background** | BackgroundReviewService (auto-learn per turn) | `background-review.service.ts` |
| 8 | **Memory persistence** | Cross-session Memory + Domain + Workspace KB | `memory.service.ts`, `smart-recall.service.ts` |
| 9 | **Chat-native interface** | Web Dashboard + Stream (Chat Gateway planned) | `chat.controller.ts`, `agent-runner.service.ts` |
| 10 | **OS Control → SANDBOXED** | Workspace sandbox only (enforced) | `storage.service.ts`, approval gate |

---

## ✅ Phase 2: Domain Config System (The "Plugin System") ✅ DONE

| # | Task | OpenClaw Equivalent | Status |
|---|---|---|---|
| 1 | DomainConfig Prisma Model | Plugin manifest | ✅ |
| 2 | DomainRegistryService (CRUD + resolve) | Plugin loader | ✅ |
| 3 | Seed 15+ Indonesian industry templates | Community skills | ✅ |
| 4 | Wire Domain Config → Tools/Reports/Skills | Skill binding | ✅ |
| 5 | Domain Config Builder UI | Skill marketplace UI | ✅ |
| 6 | Chat-based config ("Tambah unit...") | Self-writing skills | ✅ |

---

## 📋 Phase 3: OpenClaw-Advanced Features 📋 PLANNED

| # | Feature | OpenClaw Pattern | Priority |
|---|---|---|---|
| 1 | WhatsApp/Telegram Gateway | Chat-native interface | High |
| 2 | Cron Scheduler + Proactive Reports | Background tasks / heartbeats | High |
| 3 | Template Marketplace | Skill marketplace | Medium |
| 4 | Cross-workspace Domain Sharing | Cross-agent memory | Medium |
| 5 | Voice/Phone Integration | Twilio + TTS | Low |

---

## ❌ Explicitly NOT Implementing (OpenClaw Personal Features)

| OpenClaw Feature | Reason |
|---|---|
| Full OS access (browser, shell, apps) | **Safety violation** — Workspace sandbox only |
| Local-first / single-user | **Enterprise requirement** — Multi-tenant, team collaboration |
| No compliance / audit | **Enterprise requirement** — Audit trail, approval gates |
| Personal memory only | **Business requirement** — Domain + Workspace Knowledge separation |
| English only | **Indonesian market** — Full Indonesian UI + business terminology |

---

## 📁 Key Files Mapping

| OpenClaw Concept | Arunaki File(s) |
|---|---|
| Working Directory | `apps/api/src/modules/workspace/` |
| File Tools | `apps/api/src/modules/tools/services/document-*.tool.ts` |
| Search | `apps/api/src/modules/search/` |
| Plugin Loader | `apps/api/src/modules/tools/tool-registry.service.ts` |
| Skill System | `apps/api/src/modules/skills/` |
| Background Review | `apps/api/src/modules/memory/background-review.service.ts` |
| Memory | `apps/api/src/modules/memory/` |
| Chat Interface | `apps/api/src/modules/chat/` |
| Sandbox | `apps/api/src/modules/storage/storage.service.ts` |
| **Domain Config (NEW)** | `apps/api/src/modules/domain/` |

---

## 🎯 Success Criteria

- [ ] User creates workspace → picks/defines domain → agent works
- [ ] Domain config drives: units, terms, formulas, reports, skills, tools
- [ ] No hardcoded domains (garment/restaurant/retail removed)
- [ ] 15+ Indonesian industry templates seeded
- [ ] Chat can modify domain: "Tambah unit karung untuk tepung"
- [ ] WhatsApp/Telegram gateway functional
- [ ] Cron jobs generate RUG/Laba Rugi/Neraca automatically