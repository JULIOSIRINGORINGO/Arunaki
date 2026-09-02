// Arunaki living workspace memory: Workspace Cartographer + Rules Sentinel.
//
// Cartographer  : scans the active project folder and synthesizes
//                 `.arunaki/ARUNAKI.md` (the living operating rules).
// Sentinel      : a resident, event-driven daemon (per active folder) that
//                 re-runs cartography after turns complete so the rulebook
//                 stays in sync with workspace files and user corrections.
//
// Both are scoped to the active project folder (agent-per-folder isolation).
import { LayerNode } from "@arunaki/core/effect/layer-node"
import { BackgroundJob as CoreBackgroundJob } from "@arunaki/core/background-job"
import { EventV2 } from "@arunaki/core/event"
import { SessionEvent } from "@arunaki/schema/session-event"
import { FSUtil } from "@arunaki/core/fs-util"
import { InstanceState } from "@/effect/instance-state"
import { Context, Effect, Layer } from "effect"
import path from "path"

const ARUNAKI_REL = path.join(".arunaki", "ARUNAKI.md")
const KNOWLEDGE_FILE = path.join(".arunaki", "knowledge.json")
const MIN_REFRESH_GAP_MS = 30_000

export interface Interface {
  /** Scan the active folder and (re)generate `.arunaki/ARUNAKI.md`. */
  cartograph(): Effect.Effect<string, Error>
  /** Sentinel hook: rate-limited refresh after a completed turn. */
  onTurnCompleted(sessionID: string): Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@arunaki/Memory") {}

const SKIP_DIRS = new Set([".git", "node_modules", "dist", "build", ".next", ".arunaki", ".cache", "coverage"])

function isSkipped(pathSegments: string[]): boolean {
  return pathSegments.some((seg) => SKIP_DIRS.has(seg))
}

function inferDomain(topLevel: string[]): string {
  if (topLevel.length === 0) return "General workspace"
  return `Workspace focused on ${topLevel.slice(0, 6).join(", ")}`
}

/** Deterministic synthesizer (no LLM/credentials needed). Called on every scan. */
// ponytail: deterministic file-catalog synthesis. Swap in a cartographer
// sub-agent (TaskTool) that summarizes files and mines corrections when
// budgets allow; sentinel call sites and the file format are unchanged.
function synthesize(directory: string, files: string[]): string {
  const rel = files.map((f) => path.relative(directory, f)).sort()
  const topLevel = Array.from(new Set(rel.map((f) => f.split(path.sep)[0]!).filter(Boolean))).slice(0, 12)

  const catalog = rel
    .slice(0, 200)
    .map((f) => `- ${f}`)
    .join("\n")

  const extensions = Array.from(new Set(rel.map((f) => path.extname(f).toLowerCase()).filter(Boolean)))
    .sort()
    .join(", ")

  return [
    "# LOCAL WORKSPACE OPERATING RULES",
    "",
    "> Auto-maintained by the Arunaki Memory Cartographer. Do not edit by hand;",
    "> edits are regenerated from the workspace automatically.",
    "",
    "## Domain Profile",
    "",
    inferDomain(topLevel),
    "",
    "## File Catalog & Relationships",
    "",
    catalog || "_No files catalogued yet._",
    "",
    "## Strict Syntax Invariants",
    "",
    "- Preserve header rows, column ordering, and immutable totals in workbook/data files.",
    "- Never reinterpret or reformat data outside the active workspace folder.",
    "- Rules below are learned from user corrections and stay active until changed.",
    "",
    "## User Preferences & Learned Corrections",
    "",
    "_Populated automatically as you correct Arunaki in chat._",
    "",
    "---",
    "",
    `_Sources: ${rel.length} files. File types: ${extensions || "n/a"}._`,
    "",
  ].join("\n")
}

interface KnowledgeNode {
  id: string
  title: string
  content: string
  type: string
  active: boolean
  positionX: number
  positionY: number
  nodeColor: string
  icon: string
  city: string
  urls: string
  createdAt: string
  [k: string]: unknown
}

interface KnowledgeStore {
  nodes: KnowledgeNode[]
  nextId: number
}

/** Dual-sync: keep the ARUNAKI rulebook visible in the UI Knowledge graph. */
function syncKnowledge(fs: FSUtil.Service, directory: string, doc: string): Effect.Effect<void> {
  return Effect.gen(function* () {
    const raw = yield* fs
      .readFileStringSafe(path.join(directory, KNOWLEDGE_FILE))
      .pipe(Effect.orDie)
    if (!raw) return
    let store: KnowledgeStore
    try {
      store = JSON.parse(raw) as KnowledgeStore
    } catch {
      return
    }
    const nodes = Array.isArray(store.nodes) ? store.nodes : []
    const existing = nodes.find((n) => n.id === "arunaki-rulebook")
    const node: KnowledgeNode = {
      id: "arunaki-rulebook",
      title: "ARUNAKI.md (Living Rules)",
      content: doc,
      type: "rules",
      active: true,
      positionX: 60,
      positionY: 400,
      nodeColor: "#F59E0B",
      icon: "book-open",
      city: "",
      urls: "[]",
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    }
    if (existing) Object.assign(existing, node)
    else nodes.push(node)
    yield* fs
      .writeJson(path.join(directory, KNOWLEDGE_FILE), { nodes, edges: [], nextId: nodes.length + 2 }, 0o600)
      .pipe(Effect.orDie)
  }).pipe(Effect.catchAll(() => Effect.void))
}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const events = yield* EventV2.Service
    const background = yield* CoreBackgroundJob.Service

    const state = yield* InstanceState.make(
      Effect.gen(function* () {
        const directory = (yield* InstanceState.context).directory

        const cartographImpl = Effect.fn("Memory.cartograph")(function* () {
          const include = yield* fs
            .glob("**/*", { cwd: directory, include: "file", dot: true })
            .pipe(Effect.orDie)
          const files = include.filter((f) => !isSkipped(f.split(/[\\/]/)))
          const doc = synthesize(directory, files)

          const target = path.join(directory, ARUNAKI_REL)
          yield* fs.ensureDir(path.dirname(target)).pipe(Effect.orDie)
          yield* fs.writeFileString(target, doc).pipe(Effect.orDie)

          yield* syncKnowledge(fs, directory, doc)
          return doc
        })

        const startJob = (title: string, sessionID?: string) =>
          background
            .start({
              type: "memory-cartography",
              title,
              metadata: { sessionID },
              run: cartographImpl.pipe(Effect.catchAll(() => Effect.succeed(""))),
            })
            .pipe(Effect.as(void 0))

        let lastRefresh = 0

        const onTurnCompleted = Effect.fn("Memory.onTurnCompleted")(function* (sessionID: string) {
          const now = Date.now()
          if (now - lastRefresh < MIN_REFRESH_GAP_MS) return
          lastRefresh = now
          yield* startJob("Refresh workspace memory", sessionID)
        })

        const unsubscribe = yield* events.project(SessionEvent.Step.Ended, (event) =>
          onTurnCompleted(event.data.sessionID),
        )
        yield* Effect.addFinalizer(() => unsubscribe)

        return Service.of({
          cartograph: cartographImpl,
          onTurnCompleted,
        })
      }),
    )

    return Service.of({
      cartograph: () => InstanceState.useEffect(state, (s) => s.cartograph()),
      onTurnCompleted: (sessionID) => InstanceState.useEffect(state, (s) => s.onTurnCompleted(sessionID)),
    })
  }),
)

export const node = LayerNode.make({
  service: Service,
  layer,
  deps: [FSUtil.node, EventV2.node, CoreBackgroundJob.node],
})

export * as Memory from "./memory"
