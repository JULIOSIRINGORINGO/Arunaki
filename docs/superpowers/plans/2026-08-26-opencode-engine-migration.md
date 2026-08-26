# Arunaki Engine Migration — OpenCode Fork

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Arunaki's custom NestJS engine with a rebranded OpenCode fork. Keep engine + server + plugin system. Port COM document tools as OpenCode-compatible tools. React frontend + Electron desktop stay.

**Architecture:** Fork OpenCode source into Arunaki monorepo. Rebrand to `@arunaki/*`. Strip CLI/TUI/SolidJS. Port Excel/Word/PPT COM automation into `Tool.define()` pattern. Old code stays at `apps/api-legacy/` for reference. Database: Drizzle (follow OpenCode).

**Tech Stack:** Bun runtime, Effect-TS, Drizzle ORM + SQLite, Vercel AI SDK v6, React 19, Electron.

---

## Decisions (ADR)

| Decision | Choice |
|----------|--------|
| Engine | OpenCode fork → `@arunaki/*` |
| Old code | `apps/api/` → `apps/api-legacy/` (reference, not built) |
| Database | Drizzle (ikuti OpenCode), Prisma dihapus |
| UI | React 19 + Electron (tetap) |
| COM tools | Port ke OpenCode `Tool.define()` |
| Unique features | Ditunda (guided harness, post-run, todo memory) |
| Git | Langsung di main |

---

## Final Directory Structure

```
ARUNAKI/
├── apps/
│   ├── api-legacy/          ← OLD NestJS (reference only, not built)
│   ├── web/                 ← React frontend (keep, connect to engine API)
│   └── desktop/             ← Electron (keep, launch engine process)
├── packages/
│   ├── engine/              ← OpenCode fork (rebranded)
│   │   ├── core/            ← @arunaki/core (session, DB, domain)
│   │   ├── llm/             ← @arunaki/llm (provider abstraction)
│   │   ├── schema/          ← @arunaki/schema (shared types)
│   │   ├── protocol/        ← @arunaki/protocol (HTTP API defs)
│   │   ├── server/          ← @arunaki/server (HTTP server)
│   │   ├── plugin/          ← @arunaki/plugin (plugin SDK)
│   │   ├── sdk/             ← @arunaki/sdk (client SDK)
│   │   └── arunaki/         ← @arunaki/engine (main entry, config)
│   └── arunaki-tools/       ← Document domain tools
│       ├── excel-com/       ← Excel COM automation
│       ├── word-com/        ← Word COM automation
│       ├── ppt-com/         ← PPT COM automation
│       └── recap-pipeline/  ← Recap fill automation
├── package.json             ← root (bun workspaces)
├── turbo.json               ← engine build config
└── .arunaki/                ← workspace config
```

---

## Phase 1: Fork & Rebrand

### Task 1.1: Clone OpenCode Packages

- [ ] **Step 1:** Clone OpenCode to temp, copy needed packages

```bash
git clone --depth 1 https://github.com/anomalyco/opencode.git /tmp/opencode-source
mkdir -p packages/engine
for pkg in core llm schema protocol server plugin sdk opencode; do
  cp -r /tmp/opencode-source/packages/$pkg packages/engine/$pkg
done
cp /tmp/opencode-source/turbo.json packages/engine/
cp /tmp/opencode-source/tsconfig.json packages/engine/
cp /tmp/opencode-source/bunfig.toml packages/engine/
rm -rf /tmp/opencode-source
```

- [ ] **Step 2:** Commit

```bash
git add packages/engine/
git commit -m "chore: fork OpenCode engine packages"
```

### Task 1.2: Rename apps/api → apps/api-legacy

- [ ] **Step 1:** Rename directory

```bash
mv apps/api apps/api-legacy
```

- [ ] **Step 2:** Exclude from workspace in root package.json

Edit `package.json` — workspaces: `["apps/web", "apps/desktop"]` (explicit, not `apps/*`)

- [ ] **Step 3:** Commit

```bash
git add apps/api-legacy/ package.json
git commit -m "chore: rename apps/api to apps/api-legacy (reference only)"
```

### Task 1.3: Rebrand Package Names

- [ ] **Step 1:** Update all package.json `name` fields and `workspace:*` refs

| Old | New |
|-----|-----|
| `opencode` | `@arunaki/engine` |
| `@opencode-ai/core` | `@arunaki/core` |
| `@opencode-ai/llm` | `@arunaki/llm` |
| `@opencode-ai/schema` | `@arunaki/schema` |
| `@opencode-ai/protocol` | `@arunaki/protocol` |
| `@opencode-ai/server` | `@arunaki/server` |
| `@opencode-ai/plugin` | `@arunaki/plugin` |
| `@opencode-ai/sdk` | `@arunaki/sdk` |

- [ ] **Step 2:** Find-replace all `.ts` imports across `packages/engine/`

```bash
find packages/engine/ -name "*.ts" -exec sed -i \
  -e 's/@opencode-ai\/core/@arunaki\/core/g' \
  -e 's/@opencode-ai\/llm/@arunaki\/llm/g' \
  -e 's/@opencode-ai\/schema/@arunaki\/schema/g' \
  -e 's/@opencode-ai\/protocol/@arunaki\/protocol/g' \
  -e 's/@opencode-ai\/server/@arunaki\/server/g' \
  -e 's/@opencode-ai\/plugin/@arunaki\/plugin/g' \
  -e 's/@opencode-ai\/sdk/@arunaki\/sdk/g' \
  -e 's/@opencode\/engine/@arunaki\/engine/g' \
  {} +
```

- [ ] **Step 3:** Rename `.opencode` → `.arunaki` in config references

```bash
grep -rl "\.opencode" packages/engine/ --include="*.ts" | head -20
# Review each, replace with .arunaki
```

- [ ] **Step 4:** Commit

```bash
git add packages/engine/
git commit -m "chore: rebrand @opencode-ai to @arunaki scope"
```

### Task 1.4: Strip Unwanted Packages

- [ ] **Step 1:** Remove TUI, SolidJS, CLI-specific packages

```bash
rm -rf packages/engine/tui
rm -rf packages/engine/app
rm -rf packages/engine/web
rm -rf packages/engine/console
rm -rf packages/engine/storybook
rm -rf packages/engine/stats
rm -rf packages/engine/slack
```

- [ ] **Step 2:** Update root workspaces to include engine packages

```json
{
  "workspaces": [
    "apps/web",
    "apps/desktop",
    "packages/engine/*",
    "packages/arunaki-tools"
  ]
}
```

- [ ] **Step 3:** Commit

```bash
git add -A
git commit -m "chore: strip TUI, SolidJS, CLI from engine fork"
```

### Task 1.5: Install Dependencies

- [ ] **Step 1:** Add bun to root packageManager

```json
{ "packageManager": "bun@1.3.14" }
```

- [ ] **Step 2:** Install engine deps

```bash
cd packages/engine && bun install
```

- [ ] **Step 3:** Fix node-pty

```bash
cd packages/engine/core && bun run fix-node-pty
```

- [ ] **Step 4:** Commit

```bash
git add packages/engine/bun.lock
git commit -m "chore: install engine dependencies"
```

---

## Phase 2: Engine Entry Point

### Task 2.1: Create Arunaki Entry Package

- [ ] **Step 1:** Create `packages/engine/arunaki/package.json`

```json
{
  "name": "@arunaki/engine",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./server": "./src/server.ts"
  },
  "scripts": {
    "dev": "bun src/index.ts",
    "typecheck": "tsgo"
  },
  "dependencies": {
    "@arunaki/core": "workspace:*",
    "@arunaki/llm": "workspace:*",
    "@arunaki/server": "workspace:*",
    "@arunaki/plugin": "workspace:*",
    "@arunaki/schema": "workspace:*"
  }
}
```

- [ ] **Step 2:** Create `packages/engine/arunaki/src/server.ts`

```typescript
import { Server } from "@arunaki/server"

export async function startServer(port = 4096) {
  const listener = await Server.listen({ port })
  console.log(`Arunaki engine: ${listener.url}`)
  return listener
}
```

- [ ] **Step 3:** Create `packages/engine/arunaki/src/index.ts`

```typescript
import { startServer } from "./server"
const port = parseInt(process.env.PORT || "4096")
await startServer(port)
```

- [ ] **Step 4:** Test engine starts

```bash
cd packages/engine/arunaki && bun src/index.ts
# Expected: server starts on port 4096
```

- [ ] **Step 5:** Commit

```bash
git add packages/engine/arunaki/
git commit -m "feat: Arunaki engine entry point"
```

### Task 2.2: Create Config Files

- [ ] **Step 1:** Create `packages/engine/arunaki/arunaki.json`

```json
{
  "provider": {},
  "agent": { "build": { "model": {} } },
  "mcp": {}
}
```

- [ ] **Step 2:** Create `.arunaki/` workspace dir

```bash
mkdir -p .arunaki
```

- [ ] **Step 3:** Commit

```bash
git add packages/engine/arunaki/arunaki.json .arunaki/
git commit -m "chore: default Arunaki engine config"
```

---

## Phase 3: Port Document Tools

### Task 3.1: Create Tools Package

- [ ] **Step 1:** Create `packages/arunaki-tools/package.json`

```json
{
  "name": "@arunaki/tools",
  "version": "0.1.0",
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@arunaki/core": "workspace:*",
    "@arunaki/engine": "workspace:*",
    "effect": "catalog:"
  }
}
```

- [ ] **Step 2:** Commit

```bash
git add packages/arunaki-tools/
git commit -m "chore: create arunaki-tools package"
```

### Task 3.2: Port Excel COM Tool

- [ ] **Step 1:** Create `packages/arunaki-tools/src/excel-com/types.ts`

Port `ExcelAction` from `apps/api-legacy/src/modules/interaction/excel-com.service.ts` using Effect Schema.

- [ ] **Step 2:** Create `packages/arunaki-tools/src/excel-com/com-executor.ts`

Port `runPsScript()` and `withFileLock()` — remove NestJS `@Injectable()`.

- [ ] **Step 3:** Create `packages/arunaki-tools/src/excel-com/tool.ts`

```typescript
import { Tool } from "@arunaki/engine/tool"
// Port action dispatch from excel-com.service.ts executeAction()
export const ExcelComTool = Tool.define("excel_com", () => ({
  description: "Control Microsoft Excel via COM automation.",
  parameters: ExcelAction,
  async execute(args, ctx) {
    // Port full logic from apps/api-legacy/...
  }
}))
```

- [ ] **Step 4:** Commit

```bash
git add packages/arunaki-tools/src/excel-com/
git commit -m "feat: Excel COM tool in OpenCode tool system"
```

### Task 3.3: Port Word COM Tool

- [ ] **Step 1:** Same pattern as Excel — port from `apps/api-legacy/.../word-com.service.ts`

- [ ] **Step 2:** Commit

```bash
git add packages/arunaki-tools/src/word-com/
git commit -m "feat: Word COM tool in OpenCode tool system"
```

### Task 3.4: Port PPT COM Tool

- [ ] **Step 1:** Same pattern — port from `apps/api-legacy/.../ppt-com.service.ts`

- [ ] **Step 2:** Commit

```bash
git add packages/arunaki-tools/src/ppt-com/
git commit -m "feat: PPT COM tool in OpenCode tool system"
```

### Task 3.5: Port Recap-Fill Pipeline

- [ ] **Step 1:** Port from `apps/api-legacy/.../recap-fill-pipeline.service.ts`

- [ ] **Step 2:** Commit

```bash
git add packages/arunaki-tools/src/recap-pipeline/
git commit -m "feat: Recap-fill pipeline in OpenCode tool system"
```

### Task 3.6: Register Tools in Engine

- [ ] **Step 1:** Create barrel export `packages/arunaki-tools/src/index.ts`

```typescript
export { ExcelComTool } from "./excel-com/tool"
export { WordComTool } from "./word-com/tool"
export { PptComTool } from "./ppt-com/tool"
export { RecapFillTool } from "./recap-pipeline/tool"
```

- [ ] **Step 2:** Add to `packages/engine/opencode/src/tool/registry.ts` built-in tools

- [ ] **Step 3:** Verify tools appear

```bash
cd packages/engine/arunaki && bun src/index.ts
# curl localhost:4096/api/tools → excel_com, word_com, ppt_com, recap_fill
```

- [ ] **Step 4:** Commit

```bash
git add packages/arunaki-tools/ packages/engine/
git commit -m "feat: register all Arunaki document tools"
```

---

## Phase 4: Connect UI

### Task 4.1: Connect React Frontend

- [ ] **Step 1:** Create engine API client in `apps/web/src/services/engine.ts`

```typescript
import { createClient } from "@arunaki/sdk"
export const engine = createClient({ url: "http://localhost:4096" })
```

- [ ] **Step 2:** Update streaming hooks to use engine SDK

- [ ] **Step 3:** Commit

```bash
git add apps/web/
git commit -m "feat: React frontend connected to engine API"
```

### Task 4.2: Update Electron

- [ ] **Step 1:** In `apps/desktop/main.ts`, fork engine process on startup

```typescript
import { fork } from "child_process"
const engine = fork("packages/engine/arunaki/src/index.ts", {
  env: { ...process.env, PORT: "4096" }
})
```

- [ ] **Step 2:** Commit

```bash
git add apps/desktop/
git commit -m "feat: Electron launches engine on startup"
```

---

## Phase 5: Cleanup

### Task 5.1: Update Docs

- [ ] **Step 1:** Update WORKFLOW.md — mark migration ✅
- [ ] **Step 2:** Update ARCHITECTURE.md — new tech stack
- [ ] **Step 3:** Write dev-log

- [ ] **Step 4:** Commit

```bash
git add -A
git commit -m "docs: engine migration complete"
```

---

## Verification

- [ ] Engine starts: `cd packages/engine/arunaki && bun src/index.ts`
- [ ] Tools listed: `curl localhost:4096/api/tools`
- [ ] Frontend connects: `cd apps/web && npm run dev`
- [ ] Electron works: `cd apps/desktop && npm run dev`
- [ ] Excel COM test: open workbook, read/write cell
- [ ] No `@opencode-ai/*` imports remain
- [ ] `apps/api-legacy/` untouched and accessible
- [ ] Clean `git status`
