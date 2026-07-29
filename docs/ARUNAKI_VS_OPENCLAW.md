# Arunaki vs OpenClaw: Enterprise-Ready Autonomous Workspace Agent

**Author:** Arunaki Development Team  
**Date:** 2026-07-29 (updated from 2025-07-27)  
**Status:** Analysis Document  
**Based on:** Reverse-engineering OpenClaw architecture patterns for enterprise adaptation

---

## 🎯 Executive Summary

Arunaki is **not** "Hermes for business" — it is a **fundamental re-architecture of OpenClaw patterns** that transforms a personal productivity assistant into an **enterprise-grade digital employee** for business operations.

**Core Thesis:** OpenClaw proved the pattern works. Arunaki makes it enterprise-viable.

| Dimension | OpenClaw (Personal) | Arunaki (Enterprise) |
|---|---|---|
| **Working Directory** | User's entire computer | **Workspace folder (sandboxed)** |
| **Interface** | WhatsApp/Telegram/Discord | **Web Dashboard App (Web UI Native)** |
| **Multi-user** | ❌ Single user | ✅ Multi-tenant, RBAC-ready |
| **OS Access** | Full (browser, shell, apps) | **Sandboxed (workspace only)** |
| **Business Context** | None | **Domain Config System** |
| **Reports** | Custom skills needed | **RUG, Laba Rugi, Neraca (built-in)** |
| **Compliance** | ❌ | ✅ Audit trail, approval gates |

---

## 🔑 Architecture Comparison

### OpenClaw Pattern (Personal)
```
┌─────────────────────────────────────┐
│  WhatsApp / Telegram / Discord      │  ← Interface
├─────────────────────────────────────┤
│  OpenClaw Core (Node.js)            │  ← Orchestrator
├─────────────────────────────────────┤
│  Plugins/Skills (Community)         │  ← Extensible
├─────────────────────────────────────┤
│  OS Access Layer                    │  ← Browser, Shell, Files, Apps
├─────────────────────────────────────┤
│  Local SQLite + Vector DB           │  ← Memory
└─────────────────────────────────────┘
Runs on YOUR machine. Single user. Full OS access.
```

### Arunaki Pattern (Enterprise)
```
┌─────────────────────────────────────┐
│  Web Dashboard (React + Vite)       │  ← Interface
├─────────────────────────────────────┤
│  API Gateway (NestJS)               │  ← Orchestrator
├─────────────────────────────────────┤
│  27 Enterprise Tools                │  ← Curated, business-focused
├─────────────────────────────────────┤
│  Domain Knowledge + Workspace KB    │  ← 3-Layer Knowledge
├─────────────────────────────────────┤
│  PostgreSQL + Prisma + SQLite FTS5  │  ← Persistence
└─────────────────────────────────────┘
Runs on server. Multi-tenant. Workspace sandbox.
```

---

## 🧬 Reverse-Engineered Patterns from OpenClaw

| OpenClaw Pattern | Arunaki Adaptation | Status |
|---|---|---|
| **Folder-based context** | **Workspace folder = business context** | ✅ Implemented |
| **File read/write/process** | **27 tools untuk dokumen bisnis** | ✅ Implemented |
| **Chat-native interface** | **Web Dashboard + Chat Gateway (planned)** | 🔄 Partial |
| **Plugin/Skill system** | **Domain Config + Skill Packs** | 🔄 In Progress |
| **Hot-reload skills** | **Live Domain Config Reload** | 🔄 Planned |
| **Self-writing skills** | **Domain Config Builder via Chat** | 🔄 Planned |
| **Cross-agent memory** | **Cross-workspace Domain Sharing** | 🔄 Planned |
| **Proactive/Background** | **Background Review + Cron** | ✅ Partial |
| **OS Control** | **❌ DILARANG — Safety First** | ✅ Enforced |
| **Personal/Single-user** | **❌ MULTI-TENANT — Team bisnis** | ✅ Implemented |

---

## 🏗️ Current Arunaki Implementation (Aligned with OpenClaw Patterns)

### ✅ Already Implemented (OpenClaw-equivalent)
- `WorkspaceRunnerService` — Folder scan → Plan → Execute tools
- `DocumentReaderTool` — Read PDF/Excel/Word/CSV from workspace
- `DocumentGeneratorTool` — Write reports to workspace
- `SearchService` (FTS5) — Search across entire workspace
- `ArtifactService` — Store outputs in workspace
- `ToolRegistryService` — Self-registering tools, parallel execution
- `Approval Gate` — Safety for write/delete operations
- `BackgroundReviewService` — Auto-learn from conversations
- `SmartRecallService` — Pre-fetch relevant context
- `SkillSelfImproveService` — Skills evolve from experience

### 🔄 In Progress (OpenClaw-advanced)
- **Domain Config System** — User-defined business domains (replaces hardcoded 3)
- **Proactive Scheduler** — Cron jobs for automated reports

### 📋 Planned (OpenClaw-community)
- Template Marketplace
- Skill/Plugin Marketplace
- Cross-workspace domain sharing

---

## 🎯 Domain Config System: The "Plugin System" for Business

OpenClaw uses **skills/plugins**. Arunaki uses **Domain Configs** — user-defined JSON that tells the agent how their business works.

```json
{
  "id": "manufaktur-baja",
  "name": "Manufaktur Baja",
  "category": "manufacturing",
  "units": { "weight": ["kg", "ton"], "currency": "IDR" },
  "terminology": { "product": "Produk Jadi", "bom": "Bill of Materials", "wip": "Work in Progress" },
  "formulas": { "hpp": "bahan_baku + tenaga_kerja + overhead_pabrik", "rendemen": "(berat_jadi / berat_baku) * 100" },
  "reports": { "templates": ["hpp_produksi", "rendemen_bulanan"], "kpi": ["yield_rate", "cost_per_unit"] },
  "skills": ["hpp-calculation", "bom-explosion", "production-scheduling"],
  "tools": ["enterprise-calculator", "document-generator"]
}
```

**User defines their business. Agent adapts.** No hardcoded domains.

---

## 🔒 Safety Model: The Critical Divergence

| OpenClaw | Arunaki |
|---|---|
| Full OS access (browser, shell, `rm -rf /`) | **Workspace sandbox only** |
| Personal risk — user owns it | **Enterprise compliance** — audit trail, approval gates, isolation |
| Local-first — data never leaves machine | **Server-side** — multi-tenant, backup, team collaboration |
| Single user | **Team workspace** — RBAC, sharing, artifacts |

**This is not a limitation. This is the product.**

---

## 📁 Workspace = Business Folder (Not Code Repo)

```
workspace/
├── laporan/
│   ├── penjualan-jan.xlsx
│   └── stok-maret.csv
├── keuangan/
│   ├── jurnal-umum.xlsx
│   └── piutang-aging.pdf
├── produksi/
│   ├── bom-produk-a.xlsx
│   └── work-order-001.pdf
└── referensi/
    ├── harga-bahan-baku.xlsx
    └── sop-produksi.pdf
```

Arunaki **reads, analyzes, cross-references, generates, updates** — exactly like OpenClaw works on your computer, but scoped to business documents.

---

## 🚀 Next Implementation Priority (Lihat FIXES-AND-GAPS.md untuk gap terkini)

| # | Task | OpenClaw Pattern | Prioritas |
|---|---|---|---|
| 1 | Input Provenance (Layer 9) | Provenance tracking | 🔴 P0 SECURITY |
| 2 | User Turn Transcript (Layer 8) | Idempotent recording | 🔴 P0 IDEMPOTEN |
| 3 | Merge Session Admission (Layer 6) | Work admission lock | 🔴 P0 KONSISTENSI |
| 4 | Session State Events (Layer 7) | Audit trail | 🟡 P1 AUDIT |
| 5 | Harness Registry (Layer 5) | Plugin system | 🟡 P1 PLUGIN |
| 6 | Cron Scheduler + Proactive Reports | Background tasks | 🟢 P2 |

---

## 💡 Key Insight

> **OpenClaw = Personal OS (Linux for AI)**
> **Arunaki = Business OS (Salesforce/ERP but AI-native)**

The pattern is the same: **folder-based context + file tools + chat interface + extensible skills**.

The difference: **Enterprise constraints** (multi-tenant, compliance, audit, RBAC, business templates) that OpenClaw explicitly avoids.

Arunaki doesn't compete with OpenClaw. **Arunaki completes OpenClaw for the enterprise market.**

---

## 📝 Related Files

- `docs/VISION.md` — Core philosophy (Workspace First, Safety First, Goal First)
- `docs/FIXES-AND-GAPS.md` — Gap tracker utama (Blueprint P0/P1/P2)
- `docs/GAP_CHECKLIST.md` — 10/10 OpenClaw core patterns completed (Phase 1)
- `apps/api/src/modules/domain/` — Domain Config implementation
- `apps/api/src/modules/workspace/workspace-runner.service.ts` — Agent loop (dual-loop sejak Phase 24)
- `apps/api/src/modules/ai/context/` — Context Engine Registry (6 files sejak Phase 24)