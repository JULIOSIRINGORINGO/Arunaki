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
const CORRECTIONS_FILE = path.join(".arunaki", "user-corrections.jsonl")
const MIN_REFRESH_GAP_MS = 5_000

export interface Interface {
  /** Scan the active folder and (re)generate `.arunaki/ARUNAKI.md`. */
  cartograph(): Effect.Effect<string, Error>
  /** Sentinel hook: rate-limited, token-gated correction learning after a turn. */
  onTurnCompleted(sessionID: string): Effect.Effect<void>
  /** Run the correction-learning pipeline for a single turn (cheap filter + LLM). */
  learnCorrection(sessionID: string): Effect.Effect<void>
  /** Activate the per-folder sentinel (subscribe Step.Ended) without rewriting ARUNAKI.md. */
  ensureActive(): Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@arunaki/Memory") {}

const SKIP_DIRS = new Set([".git", "node_modules", "dist", "build", ".next", ".arunaki", ".arunaki-backups", ".cache", "coverage", "-p", "--parents"])

function isSkipped(pathSegments: string[]): boolean {
  if (pathSegments.some((seg) => SKIP_DIRS.has(seg))) return true
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

function inferDomain(topLevel: string[], extensions: string[], relFiles: string[]): string {
  const fileNames = relFiles.map((f) => path.basename(f).toLowerCase())
  const hasRekap = fileNames.some((n) => n.includes("rekap") || n.includes("laporan") || n.includes("penjualan") || n.includes("transaksi"))
  const hasSpreadsheet = extensions.some((ext) => [".xlsx", ".xls", ".csv"].includes(ext))
  const hasDocs = extensions.some((ext) => [".docx", ".doc", ".pdf", ".txt", ".md"].includes(ext))

  if (hasRekap && hasSpreadsheet) {
    return "Rekapan Keuangan & Penjualan (Spreadsheet & Catatan Transaksi)"
  }
  if (hasSpreadsheet && hasDocs) {
    return "Manajemen Dokumen & Spreadsheet Keuangan / Operasional"
  }
  if (hasSpreadsheet) {
    return "Spreadsheet Data & Tabel Numerik"
  }
  if (topLevel.length === 0) return "General Document Workspace"
  return `Workspace focused on ${topLevel.slice(0, 6).join(", ")}`
}

function deriveSyntaxInvariants(extensions: string[], relFiles: string[]): string[] {
  const invariants: string[] = []
  const hasSpreadsheet = extensions.some((ext) => [".xlsx", ".xls", ".csv"].includes(ext))
  const hasTxt = extensions.some((ext) => [".txt", ".md"].includes(ext))

  if (hasSpreadsheet) {
    invariants.push("- File Spreadsheet (.xlsx, .csv): Wajib menjaga susunan header kolom, formula kalkulasi (SUM, TOTAL), dan urutan tanggal tanpa mengubah format sel yang sudah ada.")
    invariants.push("- Integritas OOXML: Saat memodifikasi file .xlsx, simpan langsung secara valid dan jangan merusak relasi file internal XML Excel.")
  }

  if (hasTxt) {
    invariants.push("- Catatan Dokumen Teks (.txt, .md): Pertahankan pola struktur laporan (Pemasukan, Pengeluaran, Detail Belanja, Catatan Pembayaran) agar konsisten dengan entri historis.")
  }

  if (hasSpreadsheet && hasTxt) {
    invariants.push("- Sinkronisasi Lintas Dokumen: Nilai transaksi pada catatan teks dan sel spreadsheet harian/bulanan harus selalu selaras dan diverifikasi setelah pengeditan.")
  }

  invariants.push("- Pembatasan Folder Aktif: Hanya operasikan file di dalam folder aktif yang sedang dibuka (Project Folder Isolation).")
  invariants.push("- Aturan di bawah ini otomatis dipelajari oleh Sentinel saat pengguna memberikan arahan/koreksi.")

  return invariants
}

/** Deterministic synthesizer (no LLM/credentials needed). Called on every scan. */
// ponytail: deterministic file-catalog synthesis. Swap in a cartographer
// sub-agent (TaskTool) that summarizes files and mines corrections when
// budgets allow; sentinel call sites and the file format are unchanged.
function synthesize(directory: string, files: string[], existingDoc?: string): string {
  const rel = files
    .map((f) => (path.isAbsolute(f) ? path.relative(directory, f) : f))
    .map((f) => f.replace(/\\/g, "/"))
    .filter((f) => Boolean(f) && f !== ".")
    .sort()
  const topLevel = Array.from(new Set(rel.map((f) => f.split("/")[0]!).filter(Boolean))).slice(0, 12)

  const catalog = rel
    .slice(0, 200)
    .map((f) => `- ${f}`)
    .join("\n")

  const extensions = Array.from(new Set(rel.map((f) => path.extname(f).toLowerCase()).filter(Boolean)))
    .sort()

  const domain = inferDomain(topLevel, extensions, rel)
  const invariants = deriveSyntaxInvariants(extensions, rel)
  const existingCorrections = extractExistingCorrections(existingDoc)

  const learnedSection = existingCorrections.length > 0
    ? ["### Learned by the Sentinel", ...existingCorrections.map((c) => `- ${c}`)].join("\n")
    : "_Populated automatically as you correct Arunaki in chat._"

  return [
    "# LOCAL WORKSPACE OPERATING RULES",
    "",
    "> Auto-maintained by the Arunaki Memory Cartographer. Do not edit by hand;",
    "> edits are regenerated from the workspace automatically.",
    "",
    "## Domain Profile",
    "",
    domain,
    "",
    "## File Catalog & Relationships",
    "",
    catalog || "_No files catalogued yet._",
    "",
    "## Strict Syntax Invariants",
    "",
    ...invariants,
    "",
    "## User Preferences & Learned Corrections",
    "",
    learnedSection,
    "",
    "---",
    "",
    `_Sources: ${rel.length} files. File types: ${extensions.join(", ") || "n/a"}._`,
    "",
  ].join("\n")
}

/**
 * Cheap, 0-token pre-filter that decides whether a turn *might* contain a
 * correction. An idle turn ("rekap ke excel", "halo") never matches, so the
 * LLM stays asleep and no tokens are spent. Only a positive match wakes it.
 */
const CORRECTION_HINTS =
  /\b(jangan|jangan lagi|harusnya|seharusnya|itu salah|salah|keliru|tapi|ubah|ganti|lupa|ingat|tolong (mulai|berhenti)|kalau bisa|mulai sekarang|ke depannya|nanti|aturan|rule|rules|selisih|tambah aturan|perbaiki|koreksi|catat|selalu|format|memory|memo|remember|always|never|instead|fix|correct|note|prefer|preference|keep|don't|should|must|wrong|mistake|error)\b/i

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
          const backupRoot = path.join(directory, ".arunaki-backups")

          const scratchRoot = path.join(directory, ".arunaki", "scratch")

          // Auto-quarantine: Keep root clean. Move .bak to backups, and stray scripts/dumps to .arunaki/scratch
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
          const current = yield* readRulebook()
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
                  entry.name === ".arunaki" ||
                  entry.name === ".arunaki-backups" ||
                  entry.name === ".git" ||
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

        const readRulebook = (): Effect.Effect<string> =>
          fs
            .readFileStringSafe(path.join(directory, ARUNAKI_REL))
            .pipe(Effect.map((raw) => raw ?? ""), Effect.orDie)

        const ensureActive = Effect.fn("Memory.ensureActive")(function* () {
          const target = path.join(directory, ARUNAKI_REL)
          const exists = yield* fs.existsSafe(target)
          const backupRoot = path.join(directory, ".arunaki-backups")
          const hasBackup = yield* fs.existsSafe(backupRoot)
          if (!exists || !hasBackup) {
            yield* cartographImpl()
          }
        })

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

          // 1) Universal Multilingual Intake: Never filter by rigid regex keywords.
          // Users may speak Arabic, Chinese, English, regional dialects, or natural conversational slang.
          // Only discard empty/whitespace turns. The Sentinel LLM (Step 3) autonomously decides whether
          // a message contains an operating rule or correction.
          if (!lastUser || lastUser.info.role !== "user") return
          const userInfo = lastUser.info
          const userText = lastUser.parts
            .map((p) => (p.type === "text" ? (p.text ?? "") : ""))
            .join("\n")
            .slice(0, 2000)
            .trim()
          if (!userText) return

          // 2) Rulebook + (best-effort) provider config; missing model = sleep.
          const current = yield* readRulebook()
          yield* appendCorrectionLog(sessionID, userText)

          const agentName =
            userInfo.agent ?? (yield* sessions.get(SessionID.make(sessionID)).pipe(Effect.orElseSucceed(() => undefined)))?.agent
          const ag = agentName ? yield* agents.get(agentName).pipe(Effect.orElseSucceed(() => undefined)) : undefined
          const modelRef = userInfo.model ??
            (yield* sessions.get(SessionID.make(sessionID)).pipe(Effect.orElseSucceed(() => undefined)))?.model
          if (!ag || !modelRef) return
          const model = yield* provider.getModel(modelRef.providerID, modelRef.modelID).pipe(
            Effect.orElseSucceed(() => undefined),
          )
          if (!model) return

          // 3) LLM reads the turn in ANY language and rewrites learned rules (1-shot).
          const userMsg: SessionV1.User = {
            id: MessageID.ascending(),
            role: "user",
            sessionID: SessionID.make(sessionID),
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
              sessionID: SessionID.make(sessionID),
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

          // 4) Rewrite ARUNAKI.md with the new learned rule + dual-sync.
          const next = applyCorrections(current || synthesize(directory, []), [rule])
          const target = path.join(directory, ARUNAKI_REL)
          yield* fs.writeFileString(target, next).pipe(Effect.orDie)
        })

        let lastRefresh = 0

        const onTurnCompleted = Effect.fn("Memory.onTurnCompleted")(function* (sessionID: string) {
          // Always refresh cartography on turn completion: 0-token local scan, updates catalog & sanitizes workspace
          yield* cartographImpl().pipe(Effect.catch(() => Effect.void))
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
              run: learnCorrection(sessionID).pipe(
                Effect.as("done"),
                Effect.catch(() => Effect.succeed("error")),
              ),
            })
            .pipe(Effect.as(void 0), Effect.catch(() => Effect.void))
        })

        yield* events.project(SessionEvent.Step.Ended, (event) =>
          onTurnCompleted(event.data.sessionID),
        )

        return Service.of({
          cartograph: cartographImpl,
          onTurnCompleted,
          learnCorrection,
          ensureActive,
        })
      }),
    )

    return Service.of({
      cartograph: () => InstanceState.useEffect(state, (s) => s.cartograph()),
      onTurnCompleted: (sessionID) => InstanceState.useEffect(state, (s) => s.onTurnCompleted(sessionID)),
      learnCorrection: (sessionID) => InstanceState.useEffect(state, (s) => s.learnCorrection(sessionID)),
      ensureActive: () => InstanceState.useEffect(state, (s) => s.ensureActive()),
    })
  }),
)

export const node = LayerNode.make({
  service: Service,
  layer,
  deps: [FSUtil.node, EventV2.node, CoreBackgroundJob.node, Session.node, LLM.node, Agent.node, Provider.node],
})

export * as Memory from "./memory"
