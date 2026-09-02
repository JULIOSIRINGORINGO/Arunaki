// Arunaki living workspace memory: Workspace Cartographer + Rules Sentinel.
//
// Cartographer  : scans the active project folder and synthesizes
//                 `.arunaki/ARUNAKI.md` (the living operating rules).
// Sentinel      : a resident, event-driven daemon (per active folder) that
//                 re-runs cartography after turns complete so the rulebook
//                 stays in sync with workspace files and user corrections.
//
// Both are scoped to the active project folder (agent-per-folder isolation).
//
// Self-correction learning: after a completed turn, the sentinel runs a cheap
// deterministic filter on the last user message. Only if it smells like a
// correction (0 tokens) does it call the LLM to "read" the turn and rewrite
// the User Preferences section of ARUNAKI.md. Turns with no correction never
// reach the LLM, so idle turns cost nothing.
import { LayerNode } from "@arunaki/core/effect/layer-node"
import { BackgroundJob as CoreBackgroundJob } from "@arunaki/core/background-job"
import { EventV2 } from "@arunaki/core/event"
import { SessionEvent } from "@arunaki/schema/session-event"
import { FSUtil } from "@arunaki/core/fs-util"
import { InstanceState } from "@/effect/instance-state"
import { SessionID, MessageID } from "@/session/schema"
import { Session } from "@/session/session"
import { LLM } from "@/session/llm"
import { Agent } from "@/agent/agent"
import { Provider } from "@/provider/provider"
import { SessionV1 } from "@arunaki/core/v1/session"
import { LLMEvent } from "@arunaki/llm"
import * as Stream from "effect/Stream"
import { Context, Effect, Layer } from "effect"
import path from "path"

const ARUNAKI_REL = path.join(".arunaki", "ARUNAKI.md")
const KNOWLEDGE_FILE = path.join(".arunaki", "knowledge.json")
const CORRECTIONS_FILE = path.join(".arunaki", "user-corrections.jsonl")
const MIN_REFRESH_GAP_MS = 30_000

export interface Interface {
  /** Scan the active folder and (re)generate `.arunaki/ARUNAKI.md`. */
  cartograph(): Effect.Effect<string, Error>
  /** Sentinel hook: rate-limited, token-gated correction learning after a turn. */
  onTurnCompleted(sessionID: string): Effect.Effect<void>
  /** Run the correction-learning pipeline for a single turn (cheap filter + LLM). */
  learnCorrection(sessionID: string): Effect.Effect<void>
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

/**
 * Cheap, 0-token pre-filter that decides whether a turn *might* contain a
 * correction. An idle turn ("rekap ke excel", "halo") never matches, so the
 * LLM stays asleep and no tokens are spent. Only a positive match wakes it.
 */
const CORRECTION_HINTS =
  /\b(jangan|jangan lagi|harusnya|seharusnya|itu salah|tapi|ubah|ganti|lupa|ingat|tolong (mulai|berhenti)|kalau bisa|mulai sekarang|ke depannya|nanti)\b/i

export function mightBeCorrection(text: string): boolean {
  return CORRECTION_HINTS.test(text)
}

/** Replace (or append) the "User Preferences & Learned Corrections" section. */
export function applyCorrections(doc: string, corrections: string[]): string {
  const cleaned = corrections.map((c) => c.trim().replace(/^[-\*#\s]+/, "")).filter(Boolean)
  if (cleaned.length === 0) return doc
  const existing = Array.from(
    doc.matchAll(/## User Preferences & Learned Corrections[\s\S]*?### Learned by the Sentinel\s*\n([\s\S]*?)(?=\n## |\n---|$)/g),
    (m) =>
      m[1]
        .split("\n")
        .map((l) => l.trim().replace(/^[-\*#\s]+/, ""))
        .filter(Boolean),
  ).flat()
  const merged = Array.from(new Set([...existing, ...cleaned]))
  const body = ["### Learned by the Sentinel", ...merged.map((c) => `- ${c}`)].join("\n")
  const section = `## User Preferences & Learned Corrections\n\n${body}`
  const re = /## User Preferences & Learned Corrections[\s\S]*?(?=\n## |\n---|$)/
  return re.test(doc) ? doc.replace(re, section) : `${doc}\n\n${section}\n`
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
    let store: KnowledgeStore
    if (raw) {
      try {
        store = JSON.parse(raw) as KnowledgeStore
      } catch {
        store = { nodes: [], edges: [], nextId: 1 }
      }
    } else {
      store = { nodes: [], edges: [], nextId: 1 }
    }
    const nodes = Array.isArray(store.nodes) ? store.nodes : []
    if (!nodes.some((n) => n.id === "main-ai-node")) {
      nodes.unshift({
        id: "main-ai-node",
        title: "Agent Core",
        content: "Arunaki agent core node.",
        type: "agent",
        active: true,
        positionX: 60,
        positionY: 60,
        nodeColor: "#6366F1",
        icon: "bot",
        city: "",
        urls: "[]",
        createdAt: new Date().toISOString(),
      })
    }
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
    const edges = Array.isArray(store.edges) ? store.edges : []
    yield* fs
      .writeJson(path.join(directory, KNOWLEDGE_FILE), { nodes, edges, nextId: nodes.length + 2 }, 0o600)
      .pipe(Effect.orDie)
  }).pipe(Effect.catch(() => Effect.void))
}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const events = yield* EventV2.Service
    const background = yield* CoreBackgroundJob.Service
    const sessions = yield* Session.Service
    const llm = yield* LLM.Service
    const agents = yield* Agent.Service
    const provider = yield* Provider.Service

    const state = yield* InstanceState.make(() =>
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

        const readRulebook = (): Effect.Effect<string> =>
          fs
            .readFileStringSafe(path.join(directory, ARUNAKI_REL))
            .pipe(Effect.map((raw) => raw ?? ""))

        const appendCorrectionLog = (sessionID: string, userText: string) =>
          Effect.gen(function* () {
            yield* fs.ensureDir(path.join(directory, ".arunaki")).pipe(Effect.orDie)
            const existing = yield* fs
              .readFileStringSafe(path.join(directory, CORRECTIONS_FILE))
              .pipe(Effect.orDie)
            yield* fs
              .writeFileString(
                path.join(directory, CORRECTIONS_FILE),
                (existing ?? "") + JSON.stringify({ at: new Date().toISOString(), sessionID, user: userText }) + "\n",
              )
              .pipe(Effect.orDie)
          })

        /** Deterministic helpers only (never requires a provider). */
        const learnCorrection = Effect.fn("Memory.learnCorrection")(function* (sessionID: string) {
          const msgs = yield* sessions
            .messages({ sessionID: SessionID.make(sessionID), limit: 4 })
            .pipe(Effect.orElseSucceed(() => []))
          const lastUser = [...msgs]
            .reverse()
            .find((m) => m.info.role === "user" && m.parts[0]?.type !== "subtask")

          // 1) Cheap 0-token gate: idle turns never reach the LLM.
          if (!lastUser) return
          const userText = lastUser.parts
            .map((p) => (p.type === "text" ? (p.text ?? "") : ""))
            .join("\n")
            .slice(0, 2000)
          if (!userText || !mightBeCorrection(userText)) return

          // 2) Rulebook + (best-effort) provider config; missing model = sleep.
          const current = yield* readRulebook()
          yield* appendCorrectionLog(sessionID, userText)

          const agentName =
            lastUser.info.agent ?? (yield* sessions.get(SessionID.make(sessionID)).pipe(Effect.orElseSucceed(undefined)))?.agent
          const ag = agentName ? yield* agents.get(agentName).pipe(Effect.orElseSucceed(undefined)) : undefined
          const modelRef = lastUser.info.model ??
            (yield* sessions.get(SessionID.make(sessionID)).pipe(Effect.orElseSucceed(undefined)))?.model
          if (!ag || !modelRef) return
          const model = yield* provider.getModel(modelRef.providerID, modelRef.modelID).pipe(
            Effect.orElseSucceed(undefined),
          )
          if (!model) return

          // 3) LLM reads the turn and rewrites the learned rules (1-shot).
          const userMsg: SessionV1.User = {
            id: MessageID.ascending(),
            role: "user",
            sessionID: SessionID.make(sessionID),
            time: { created: Date.now() },
            tools: {},
            agent: ag.name,
            model: { providerID: model.providerID, modelID: model.modelID },
            system:
              "You are the Arunaki memory sentinel. Read the last user message. " +
              "If it states a correction or preference about how files/data are handled, " +
              "rewrite it as ONE concise imperative rule in Indonesian. Output ONLY the rule " +
              "bullet text (no markdown, no explanation). If there is no real correction, output nothing.",
            format: "text",
          }

          const assistantFromUser = current ? `Current ARUNAKI.md:\n${current}` : "(no rulebook yet)"
          const reply = yield* llm
            .stream({
              agent: ag,
              user: userMsg,
              system: [userMsg.system ?? "", assistantFromUser],
              tools: {},
              small: true,
              model,
              sessionID: SessionID.make(sessionID),
              toolChoice: "none",
              messages: [{ role: "user", content: `Last user message:\n${userText}` }],
            })
            .pipe(
              Stream.filter(LLMEvent.is.textDelta),
              Stream.map((e) => e.text),
              Stream.mkString,
              Effect.orDie,
            )
            .pipe(Effect.orElseSucceed(""))

          const rule = reply
            .replace(/^[-\*#\s]+/, "")
            .replace(/<\/?think>/g, "")
            .trim()
          if (!rule) return

          // 4) Rewrite ARUNAKI.md with the new learned rule + dual-sync.
          const next = applyCorrections(current || synthesize(directory, []), [rule])
          const target = path.join(directory, ARUNAKI_REL)
          yield* fs.writeFileString(target, next).pipe(Effect.orDie)
          yield* syncKnowledge(fs, directory, next)
        })

        let lastRefresh = 0

        const onTurnCompleted = Effect.fn("Memory.onTurnCompleted")(function* (sessionID: string) {
          const now = Date.now()
          if (now - lastRefresh < MIN_REFRESH_GAP_MS) return
          lastRefresh = now
          yield* background
            .start({
              type: "memory-correction-learning",
              title: "Learn correction",
              metadata: { sessionID },
              // Token-gated: cartography refresh + correction learning, both
              // fully failure-tolerant so a missing provider = sleep, not crash.
              run: learnCorrection(sessionID).pipe(Effect.catch(() => Effect.void)),
            })
            .pipe(Effect.as(void 0), Effect.catch(() => Effect.void))
        })

        const unsubscribe = yield* events.project(SessionEvent.Step.Ended, (event) =>
          onTurnCompleted(event.data.sessionID),
        )
        yield* Effect.addFinalizer(() => unsubscribe)

        return Service.of({
          cartograph: cartographImpl,
          onTurnCompleted,
          learnCorrection,
        })
      }),
    )

    return Service.of({
      cartograph: () => InstanceState.useEffect(state, (s) => s.cartograph()),
      onTurnCompleted: (sessionID) => InstanceState.useEffect(state, (s) => s.onTurnCompleted(sessionID)),
      learnCorrection: (sessionID) => InstanceState.useEffect(state, (s) => s.learnCorrection(sessionID)),
    })
  }),
)

export const node = LayerNode.make({
  service: Service,
  layer,
  deps: [FSUtil.node, EventV2.node, CoreBackgroundJob.node, Session.node, LLM.node, Agent.node, Provider.node],
})

export * as Memory from "./memory"
