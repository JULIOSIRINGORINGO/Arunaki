import { LayerNode } from "@arunaki/core/effect/layer-node"
import { Context, Effect, Layer } from "effect"
import * as path from "node:path"
import * as fsSync from "node:fs"

import { InstanceState } from "@/effect/instance-state"

import PROMPT_DEFAULT from "./prompt/default.txt"
import PROMPT_KIMI from "./prompt/kimi.txt"
import PROMPT_META from "./prompt/meta.txt"
import type { Provider } from "@/provider/provider"
import type { Agent } from "@/agent/agent"
import { Permission } from "@/permission"
import { Skill } from "@/skill"
import { AbsolutePath } from "@arunaki/core/schema"
import { Location } from "@arunaki/core/location"
import { LocationServiceMap, locationServiceMapLayer } from "@arunaki/core/location-services"
import { Reference } from "@arunaki/core/reference"
import { MCP } from "@/mcp"
import { PermissionV1 } from "@arunaki/core/v1/permission"

const CANVAS_INSTRUCTION = `
# Canvas
When the user asks you to "buat di canvas", "make in canvas", or wants the output in the Canvas, do NOT create a file or use any tools!
Instead, you must wrap your final output with [CANVAS]...[/CANVAS] tags.
Arunaki's UI will automatically extract everything inside the [CANVAS]...[/CANVAS] block and display it in the user's Canvas editor.
Example:
[CANVAS]
# <Title of Document>

<Any markdown content, text, tables, lists, or structured data goes here>
[/CANVAS]
`;

export function provider(model: Provider.Model) {
  let prompt = PROMPT_DEFAULT
  if (model.api.id.includes("muse")) {
    const name = model.api.id.includes("muse-glimmer") ? "Muse Glimmer" : "Muse Spark"
    prompt = PROMPT_META.replaceAll("{{MODEL_NAME}}", name)
  } else if (
    model.api.id.toLowerCase().includes("kimi") ||
    ["kimi-for-coding", "moonshotai", "moonshotai-cn"].includes(model.providerID)
  ) {
    prompt = PROMPT_KIMI
  }
  return [prompt, CANVAS_INSTRUCTION]
}

export interface Interface {
  readonly environment: (model: Provider.Model) => Effect.Effect<string[]>
  readonly skills: (agent: Agent.Info) => Effect.Effect<string | undefined>
  readonly mcp: (agent: Agent.Info, permission?: PermissionV1.Ruleset) => Effect.Effect<string | undefined>
}

export class Service extends Context.Service<Service, Interface>()("@arunaki/SystemPrompt") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const skill = yield* Skill.Service
    const mcp = yield* MCP.Service
    const locations = yield* LocationServiceMap.Service

    return Service.of({
      environment: Effect.fn("SystemPrompt.environment")(function* (model: Provider.Model) {
        const ctx = yield* InstanceState.context
        const references = yield* Effect.gen(function* () {
          return (yield* (yield* Reference.Service).list()).filter((reference) => reference.description !== undefined)
        }).pipe(Effect.provide(locations.get(Location.Ref.make({ directory: AbsolutePath.make(ctx.directory) }))))

        const normalizedDir = ctx.directory.toLowerCase().replace(/\\/g, "/")
        const isScratch =
          normalizedDir.includes("/.arunaki/scratch") ||
          normalizedDir.endsWith("/.arunaki/scratch") ||
          normalizedDir.includes(".arunaki/scratch")

        const envLines = isScratch
          ? [
              `You are powered by the model named ${model.api.id}. The exact model ID is ${model.providerID}/${model.api.id}`,
              `Here is some useful information about the environment you are running in:`,
              `<env>`,
              `  Workspace status: No project folder opened (unconnected scratchpad)`,
              `  Is folder connected: no`,
              `  Platform: ${process.platform}`,
              `  Today's date: ${new Date().toDateString()}`,
              `</env>`,
              ``,
              `CRITICAL INSTRUCTION — NO WORKSPACE FOLDER CONNECTED:`,
              `The user has NOT opened or connected any document or project folder yet.`,
              `- You do NOT have access to a user project folder.`,
              `- You must NEVER mention or expose internal sandbox paths (such as .arunaki/scratch or system user directory paths) to the user.`,
              `- If the user asks to check files, list folder contents, or work on documents in their folder, DO NOT run directory listing tools and DO NOT say you checked a scratch folder.`,
              `- Instead, inform the user clearly and politely that no document/project folder has been opened yet. Advise them to click the "Open Folder" button in the top bar or sidebar to connect their folder, or invite them to paste raw text/notes directly here into the chat for immediate processing.`,
            ]
          : [
              `You are powered by the model named ${model.api.id}. The exact model ID is ${model.providerID}/${model.api.id}`,
              `Here is some useful information about the environment you are running in:`,
              `<env>`,
              `  Working directory: ${ctx.directory}`,
              `  Workspace root folder: ${ctx.worktree}`,
              `  Agent scope: Document & Data Processing (confined to Working directory)`,
              `  Platform: ${process.platform}`,
              `  Today's date: ${new Date().toDateString()}`,
              `</env>`,
            ]

        // Inject active Knowledge nodes as context for the AI
        let knowledgeContext: string | undefined = undefined
        try {
          const paths = [
            path.join(ctx.directory, ".arunaki", "knowledge.json"),
            path.join(ctx.worktree, ".arunaki", "knowledge.json"),
          ]

          let raw: string | undefined = undefined
          for (const knowledgePath of paths) {
            if (fsSync.existsSync(knowledgePath)) {
              try {
                raw = fsSync.readFileSync(knowledgePath, "utf-8")
                if (raw) break
              } catch {}
            }
          }

          if (raw) {
            const store = JSON.parse(raw) as { nodes?: Array<{ id: string; title: string; content: string; active: boolean; type: string; urls?: string }> }
            const activeNodes = (store.nodes || []).filter(
              (n) =>
                n.active &&
                n.id !== "main-ai-node" &&
                ((n.content && n.content.trim().length > 0 && n.content.trim() !== "Enter knowledge content here...") ||
                  (n.urls && n.urls !== "[]" && n.urls.length > 2)),
            )

            if (activeNodes.length > 0) {
              const knowledgeLines = [
                "<knowledge_base>",
                "The following knowledge nodes are connected by the user as official data sources (e.g. Google Sheets, product catalog, inventory databases, guidelines):",
                ...activeNodes.flatMap((node) => {
                  const lines = [
                    `  <knowledge title="${node.title}" type="${node.type}">`,
                  ]
                  const hasRealContent = node.content && node.content.trim().length > 0 && node.content.trim() !== "Enter knowledge content here..."
                  if (hasRealContent) {
                    lines.push(`    ${node.content}`)
                  }
                  if (node.urls) {
                    try {
                      const urls = JSON.parse(node.urls) as string[]
                      if (urls.length > 0) {
                        lines.push(`    <urls>${urls.join(", ")}</urls>`)
                        lines.push(`    Data Source URL: ${urls.join(", ")}`)
                      }
                    } catch {}
                  }
                  lines.push(`  </knowledge>`)
                  return lines
                }),
                "</knowledge_base>",
                "",
                "CRITICAL KNOWLEDGE BASE INSTRUCTIONS:",
                "- The user has connected external knowledge nodes (e.g. Google Sheets, product catalog, price lists).",
                "- When the user asks about stock, inventory, products, prices, or data related to any connected node:",
                "  1. ALWAYS check the <knowledge_base> first. If the data is present in a knowledge node above, use it directly.",
                "  2. If a knowledge node has a Data Source URL (such as a Google Sheets link) and the requested item is not found in local workspace files, YOU MUST USE the browse_website tool on that URL to inspect the live sheet/data!",
                "  3. NEVER claim that data or stock is missing from the workspace without checking these connected knowledge nodes and their URLs first!",
              ]
              knowledgeContext = knowledgeLines.join("\n")
            }
          }
        } catch {}

        return [
          envLines.join("\n"),
          references.length === 0
            ? undefined
            : [
                "Project references provide additional directories that can be accessed when relevant.",
                "<available_references>",
                ...references
                  .toSorted((a, b) => a.name.localeCompare(b.name))
                  .flatMap((reference) => [
                    "  <reference>",
                    `    <name>${reference.name}</name>`,
                    `    <path>${reference.path}</path>`,
                    ...(reference.description === undefined
                      ? []
                      : [`    <description>${reference.description}</description>`]),
                    "  </reference>",
                  ]),
                "</available_references>",
              ].join("\n"),
          knowledgeContext,
          [
            "CRITICAL INSTRUCTION FOR DATA AND DOCUMENTS:",
            "If the user asks you to create, format, or organize data (like a table, report, list, plain text, or document), you MUST wrap the ENTIRE result inside a markdown code block (e.g. ```text ... ``` or ```markdown ... ```). Do NOT output raw markdown tables or text directly in the chat. Wrap it in a code block so it can be extracted to the Canvas.",
          ].join("\n"),
        ].filter((part): part is string => part !== undefined)
      }),

      skills: Effect.fn("SystemPrompt.skills")(function* (agent: Agent.Info) {
        if (Permission.disabled(["skill"], agent.permission).has("skill")) return

        const list = yield* skill.available(agent)

        return [
          "Skills provide specialized instructions and workflows for specific tasks.",
          "Use the skill tool to load a skill when a task matches its description.",
          // the agents seem to ingest the information about skills a bit better if we present a more verbose
          // version of them here and a less verbose version in tool description, rather than vice versa.
          Skill.fmt(list, { verbose: true }),
        ].join("\n")
      }),

      mcp: Effect.fn("SystemPrompt.mcp")(function* (agent: Agent.Info, permission?: PermissionV1.Ruleset) {
        const ruleset = Permission.merge(agent.permission, permission ?? [])
        const instructions = (yield* mcp.instructions()).filter(
          (item) => item.tools.length === 0 || Permission.disabled(item.tools, ruleset).size < item.tools.length,
        )
        if (instructions.length === 0) return

        return [
          "<mcp_instructions>",
          ...instructions.flatMap((item) => [
            `  <server name="${item.name}">`,
            ...item.instructions.split("\n").map((line) => `    ${line}`),
            "  </server>",
          ]),
          "</mcp_instructions>",
        ].join("\n")
      }),
    })
  }),
)

const locationServiceMapNode = LayerNode.make({
  service: LocationServiceMap.Service,
  layer: locationServiceMapLayer,
  deps: [],
})

export const node = LayerNode.make({
  service: Service,
  layer: layer,
  deps: [Skill.node, MCP.node, locationServiceMapNode],
})

export * as SystemPrompt from "./system"
