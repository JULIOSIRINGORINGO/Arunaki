// Arunaki living workspace memory: Workspace Cartographer + Rules Sentinel.
//
// Layer 3 Session Service (matching SessionSummary, SessionCompaction, Instruction).
// - Cartographer : Scans active folder and synthesizes `.arunaki/ARUNAKI.md`.
// - Sentinel     : Autonomous post-turn background learning (forked in prompt scope).
//
// Both operate strictly within active folder boundaries (Project Folder Isolation).
import { LayerNode } from "@arunaki/core/effect/layer-node"
import { BackgroundJob as CoreBackgroundJob } from "@arunaki/core/background-job"
import { EventV2Bridge } from "@/event-v2-bridge"
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
const CORRECTIONS_FILE = path.join(".arunaki", "user-corrections.jsonl")
const MIN_REFRESH_GAP_MS = 5_000

export interface Interface {
  /** Scan the active folder and (re)generate `.arunaki/ARUNAKI.md`. */
  readonly cartograph: (directory?: string) => Effect.Effect<string, Error>
  /** Sentinel hook: rate-limited, autonomous correction learning after a turn. */
  readonly onTurnCompleted: (sessionID: SessionID | string, directory?: string) => Effect.Effect<void>
  /** Run the correction-learning pipeline for a single turn (substantive check + Sentinel LLM). */
  readonly learnCorrection: (sessionID: SessionID | string, directory?: string) => Effect.Effect<void>
  /** Activate the per-folder sentinel without rewriting ARUNAKI.md. */
  readonly ensureActive: (directory?: string) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@arunaki/SessionMemory") {}

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".arunaki",
  ".arunaki-backups",
  ".cache",
  "coverage",
  "-p",
  "--parents",
])

function isSkipped(pathSegments: string[]): boolean {
  if (pathSegments.some((seg) => seg.startsWith(".") || SKIP_DIRS.has(seg))) return true
  const filename = pathSegments[pathSegments.length - 1]
  if (filename && filename.toLowerCase().endsWith(".bak")) return true
  return false
}

function extractExistingCorrections(doc?: string): string[] {
  if (!doc) return []
  const matches = Array.from(
    doc.matchAll(/## User Preferences & Learned Corrections[\s\S]*?### Learned by the Sentinel\s*\n([\s\S]*?)(?=\n## |\n---|$)/g),
    (m) =>
      m[1]
        .split("\n")
        .map((l) => l.trim().replace(/^[-\*#\s]+/, ""))
        .filter(Boolean),
  ).flat()
  return Array.from(new Set(matches))
}

export function inferDomain(topLevel: string[], extensions: string[]): string {
  const types: string[] = []
  if (extensions.some((ext) => [".xlsx", ".xls", ".csv", ".tsv"].includes(ext))) {
    types.push("Spreadsheets & Tabular Data")
  }
  if (extensions.some((ext) => [".docx", ".doc", ".pdf", ".rtf", ".odt"].includes(ext))) {
    types.push("Documents & Reports")
  }
  if (extensions.some((ext) => [".txt", ".md"].includes(ext))) {
    types.push("Text Notes & Markdown")
  }
  if (types.length > 0) {
    return types.join(" | ")
  }
  if (topLevel.length > 0) {
    return `Workspace: ${topLevel.slice(0, 5).join(", ")}`
  }
  return "General Document Workspace"
}

export function deriveSyntaxInvariants(extensions: string[]): string[] {
  const invariants: string[] = []
  const hasSpreadsheet = extensions.some((ext) => [".xlsx", ".xls", ".csv", ".tsv"].includes(ext))
  const hasDocs = extensions.some((ext) => [".docx", ".doc", ".pdf", ".txt", ".md"].includes(ext))

  if (hasSpreadsheet) {
    invariants.push("- Tabular & Spreadsheet Files: Preserve existing sheet structures, column headers, and calculation formulas (SUM, TOTAL, math formulas) without altering unedited cells or formatting.")
    invariants.push("- Workbook Integrity: When editing spreadsheets, save valid structures and verify all calculated values.")
  }

  if (hasDocs) {
    invariants.push("- Document Files: Maintain the existing heading hierarchy, layout structure, and tone established in existing notes and reports.")
  }

  if (hasSpreadsheet && hasDocs) {
    invariants.push("- Cross-Document Consistency: Ensure referenced data, dates, and metrics match across spreadsheets and summary reports.")
  }

  invariants.push("- Active Folder Isolation: Only inspect and operate on files within the currently opened active folder.")
  invariants.push("- Continuous Learning: Operating rules are automatically maintained by the Sentinel based on user instructions and corrections.")

  return invariants
}

export function synthesize(directory: string, files: string[], existingRulebook?: string): string {
  const folderName = path.basename(directory) || "Active Folder"
  const topLevel = Array.from(new Set(files.map((f) => f.split(/[/\\]/)[0]))).filter(Boolean)
  const extensions = Array.from(
    new Set(
      files
        .map((f) => path.extname(f).toLowerCase())
        .filter((e) => e && e !== ".bak" && e.length < 10),
    ),
  )

  const domain = inferDomain(topLevel, extensions)
  const invariants = deriveSyntaxInvariants(extensions)

  const fileCatalog =
    files.length === 0
      ? "_No document files detected in the active folder yet._"
      : files
          .slice(0, 50)
          .map((f) => `- ${f}`)
          .join("\n") + (files.length > 50 ? `\n- ... (${files.length - 50} more files)` : "")

  const learnedRules = extractExistingCorrections(existingRulebook)
  const learnedSection =
    learnedRules.length > 0
      ? learnedRules.map((r) => `- ${r}`).join("\n")
      : "_No learned preferences yet._"

  return [
    `# LOCAL WORKSPACE OPERATING RULES (${folderName})`,
    "",
    "<!-- AUTO-GENERATED BY ARUNAKI CARTOGRAPHER & SENTINEL. DO NOT DELETE. -->",
    "<!-- These living rules govern how Arunaki operates inside this folder. -->",
    "",
    "## Domain Profile",
    domain,
    "",
    "## Workspace Catalog",
    fileCatalog,
    "",
    "## Operating Invariants",
    invariants.join("\n"),
    "",
    "## User Preferences & Learned Corrections",
    "### Learned by the Sentinel",
    learnedSection,
    "",
    "---",
    "_Generated automatically. Arunaki self-corrects and learns from user feedback._",
    "",
  ].join("\n")
}

export function applyCorrections(doc: string, corrections: string[]): string {
  const clean = corrections
    .map((c) => c.trim().replace(/^[-\*#\s]+/, ""))
    .filter(Boolean)
  if (clean.length === 0) return doc

  const existing = extractExistingCorrections(doc)
  const merged = Array.from(new Set([...existing, ...clean]))

  const newSection = [
    "## User Preferences & Learned Corrections",
    "### Learned by the Sentinel",
    ...merged.map((r) => `- ${r}`),
  ].join("\n")

  if (/## User Preferences & Learned Corrections/.test(doc)) {
    return doc.replace(
      /## User Preferences & Learned Corrections[\s\S]*?(?=\n## |\n---|$)/,
      newSection,
    )
  }

  return `${doc.trimEnd()}\n\n${newSection}\n`
}

export function mightBeCorrection(text: string): boolean {
  if (!text) return false
  const trimmed = text.trim()
  return trimmed.length > 0
}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const sessions = yield* Session.Service
    const llm = yield* LLM.Service
    const agents = yield* Agent.Service
    const provider = yield* Provider.Service
    const events = yield* EventV2Bridge.Service
    const background = yield* CoreBackgroundJob.Service

    const lastRefreshes = new Map<string, number>()

    const readRulebook = (directory: string): Effect.Effect<string> =>
      fs
        .readFileStringSafe(path.join(directory, ARUNAKI_REL))
        .pipe(Effect.map((raw) => raw ?? ""), Effect.orDie)

    const appendCorrectionLog = (directory: string, sessionID: string, userText: string) =>
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

    const cartograph = Effect.fn("SessionMemory.cartograph")(function* (dir?: string) {
      const directory =
        dir ??
        (yield* InstanceState.directory.pipe(Effect.orElseSucceed(() => undefined))) ??
        process.cwd()
      const backupRoot = path.join(directory, ".arunaki-backups")
      const scratchRoot = path.join(directory, ".arunaki", "scratch")

      // Auto-quarantine: keep root clean, move .bak to backups and stray dumps to scratch
      yield* Effect.tryPromise(async () => {
        const fsPromises = await import("fs/promises")
        await fsPromises.mkdir(scratchRoot, { recursive: true })
        const entries = await fsPromises.readdir(directory, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.isDirectory() && (entry.name === "-p" || entry.name === "--parents")) {
            await fsPromises.rm(path.join(directory, entry.name), { recursive: true, force: true })
          } else if (entry.isFile()) {
            const lower = entry.name.toLowerCase()
            if (lower.endsWith(".bak")) {
              await fsPromises.mkdir(backupRoot, { recursive: true })
              await fsPromises.rename(path.join(directory, entry.name), path.join(backupRoot, entry.name))
            } else if (
              lower.endsWith(".py") ||
              lower.endsWith(".sh") ||
              lower.endsWith(".bat") ||
              lower.startsWith("dump") ||
              lower.startsWith("hex_dump") ||
              lower.startsWith("temp_")
            ) {
              await fsPromises.rename(path.join(directory, entry.name), path.join(scratchRoot, entry.name))
            }
          }
        }
      }).pipe(Effect.catch(() => Effect.void))

      const include = yield* fs
        .glob("**/*", { cwd: directory, include: "file", dot: true })
        .pipe(Effect.orDie)
      const files = include.filter((f) => {
        const normalized = f.replace(/\\/g, "/")
        return !isSkipped(normalized.split("/"))
      })
      const current = yield* readRulebook(directory)
      const doc = synthesize(directory, files, current)

      const target = path.join(directory, ARUNAKI_REL)
      yield* fs.ensureDir(path.dirname(target)).pipe(Effect.orDie)
      yield* fs.writeFileString(target, doc).pipe(Effect.orDie)

      // Initial workspace snapshot into .arunaki-backups if not already present
      const hasBackup = yield* fs.existsSafe(backupRoot)
      if (!hasBackup && files.length > 0) {
        const stamp = new Date().toISOString().replace(/[:.]/g, "-")
        const dest = path.join(backupRoot, `initial-${stamp}`)
        yield* fs.ensureDir(dest).pipe(Effect.catch(() => Effect.void))
        yield* Effect.tryPromise(async () => {
          const fsPromises = await import("fs/promises")
          const entries = await fsPromises.readdir(directory, { withFileTypes: true })
          for (const entry of entries) {
            if (
              entry.name.startsWith(".") ||
              entry.name === "node_modules"
            ) {
              continue
            }
            const srcPath = path.join(directory, entry.name)
            const destPath = path.join(dest, entry.name)
            await fsPromises.cp(srcPath, destPath, { recursive: true, force: true })
          }
        }).pipe(Effect.catch(() => Effect.void))
      }

      return doc
    })

    const ensureActive = Effect.fn("SessionMemory.ensureActive")(function* (dir?: string) {
      const directory =
        dir ??
        (yield* InstanceState.directory.pipe(Effect.orElseSucceed(() => undefined))) ??
        process.cwd()
      const target = path.join(directory, ARUNAKI_REL)
      const exists = yield* fs.existsSafe(target)
      const backupRoot = path.join(directory, ".arunaki-backups")
      const hasBackup = yield* fs.existsSafe(backupRoot)
      if (!exists || !hasBackup) {
        yield* cartograph(directory)
      }
    })

    const learnCorrection = Effect.fn("SessionMemory.learnCorrection")(function* (
      sessionID: SessionID | string,
      dir?: string,
    ) {
      const sid = typeof sessionID === "string" ? SessionID.make(sessionID) : sessionID
      const session = yield* sessions.get(sid).pipe(Effect.orElseSucceed(() => undefined))
      const directory =
        dir ??
        session?.directory ??
        (yield* InstanceState.directory.pipe(Effect.orElseSucceed(() => undefined))) ??
        process.cwd()
      const msgs = yield* sessions
        .messages({ sessionID: sid, limit: 4 })
        .pipe(Effect.orElseSucceed(() => []))
      const lastUser = [...msgs]
        .reverse()
        .find((m) => m.info.role === "user" && m.parts[0]?.type !== "subtask")

      // Universal intake: accept non-empty turns in any language
      if (!lastUser || lastUser.info.role !== "user") return
      const userInfo = lastUser.info
      const userText = lastUser.parts
        .map((p) => (p.type === "text" ? (p.text ?? "") : ""))
        .join("\n")
        .slice(0, 2000)
        .trim()
      if (!mightBeCorrection(userText)) return

      const current = yield* readRulebook(directory)
      yield* appendCorrectionLog(directory, sid, userText)

      const agentName =
        userInfo.agent ?? (yield* sessions.get(sid).pipe(Effect.orElseSucceed(() => undefined)))?.agent
      const ag = agentName ? yield* agents.get(agentName).pipe(Effect.orElseSucceed(() => undefined)) : undefined
      const modelRef =
        userInfo.model ?? (yield* sessions.get(sid).pipe(Effect.orElseSucceed(() => undefined)))?.model
      if (!ag || !modelRef) return
      const model = yield* provider.getModel(modelRef.providerID, modelRef.modelID).pipe(
        Effect.orElseSucceed(() => undefined),
      )
      if (!model) return

      // Multilingual Sentinel LLM prompt
      const userMsg: SessionV1.User = {
        id: MessageID.ascending(),
        role: "user",
        sessionID: sid,
        time: { created: Date.now() },
        tools: {},
        agent: ag.name,
        model: { providerID: model.providerID, modelID: model.id },
        system:
          "You are the Arunaki memory sentinel. Read the last user message (which may be in any language, including Indonesian, English, Arabic, Chinese, regional dialects, etc.). " +
          "If it states a correction, preference, or operating rule about how documents, data, or files are handled, " +
          "rewrite it as ONE concise imperative rule in Indonesian. Output ONLY the rule " +
          "bullet text (no markdown, no explanation). If there is no real correction or preference, output nothing.",
        format: { type: "text" },
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
          sessionID: sid,
          toolChoice: "none",
          messages: [{ role: "user", content: `Last user message:\n${userText}` }],
        })
        .pipe(
          Stream.filter(LLMEvent.is.textDelta),
          Stream.map((e) => e.text),
          Stream.mkString,
          Effect.orDie,
          Effect.orElseSucceed(() => ""),
        )

      const rule = reply
        .replace(/^[-\*#\s]+/, "")
        .replace(/<\/?think>/g, "")
        .trim()
      if (!rule) return

      const next = applyCorrections(current || synthesize(directory, []), [rule])
      const target = path.join(directory, ARUNAKI_REL)
      yield* fs.writeFileString(target, next).pipe(Effect.orDie)
    })

    const onTurnCompleted = Effect.fn("SessionMemory.onTurnCompleted")(function* (
      sessionID: SessionID | string,
      dir?: string,
    ) {
      const sid = typeof sessionID === "string" ? SessionID.make(sessionID) : sessionID
      const session = yield* sessions.get(sid).pipe(Effect.orElseSucceed(() => undefined))
      const directory =
        dir ??
        session?.directory ??
        (yield* InstanceState.directory.pipe(Effect.orElseSucceed(() => undefined)))
      if (!directory) return

      // 0-token instant local scan updates workspace catalog
      yield* cartograph(directory).pipe(Effect.catch(() => Effect.void))

      const now = Date.now()
      const last = lastRefreshes.get(directory) ?? 0
      if (now - last < MIN_REFRESH_GAP_MS) return
      lastRefreshes.set(directory, now)

      yield* background
        .start({
          type: "memory-correction-learning",
          title: "Learn correction",
          metadata: { sessionID: sid },
          run: learnCorrection(sid, directory).pipe(
            Effect.as("done"),
            Effect.catch(() => Effect.succeed("error")),
          ),
        })
        .pipe(Effect.as(void 0), Effect.catch(() => Effect.void))
    })

    // Subscribe to Step.Ended event as a secondary fallback
    yield* events.project(SessionEvent.Step.Ended, (event) =>
      Effect.gen(function* () {
        // Only run memory/sentinel on actual completion of the turn, not intermediate tool steps!
        if (event.data.finish === "tool-calls") return
        yield* onTurnCompleted(event.data.sessionID)
      }).pipe(
        Effect.catchCause((cause) =>
          Effect.logDebug("SessionMemory onTurnCompleted ignored defect in projector", cause),
        ),
      ),
    )

    return Service.of({
      cartograph,
      onTurnCompleted,
      learnCorrection,
      ensureActive,
    })
  }),
)

export const node = LayerNode.make({
  service: Service,
  layer,
  deps: [
    FSUtil.node,
    Session.node,
    LLM.node,
    Agent.node,
    Provider.node,
    EventV2Bridge.node,
    CoreBackgroundJob.node,
  ],
})

export * as SessionMemory from "./memory"
export { Service as MemoryService, node as memoryNode }
