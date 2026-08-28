import { Effect, Schema } from "effect"
import * as Tool from "@arunaki/engine/tool"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

const WordActionSchema = Schema.Struct({
  action: Schema.String,
  filePath: Schema.optional(Schema.String),
  text: Schema.optional(Schema.String),
  paragraphIndex: Schema.optional(Schema.Number),
  cell: Schema.optional(Schema.String),
  findText: Schema.optional(Schema.String),
  replaceText: Schema.optional(Schema.String),
  bold: Schema.optional(Schema.Boolean),
  fontSize: Schema.optional(Schema.Number),
  alignment: Schema.optional(Schema.String),
})

type Metadata = Record<string, unknown>

async function runPowerShell(script: string): Promise<string> {
  const { stdout, stderr } = await execAsync(
    `powershell -NoProfile -NonInteractive -Command "${script.replace(/"/g, '\\"')}"`,
    { maxBuffer: 10 * 1024 * 1024, timeout: 60000 }
  )
  if (stderr && !stdout) throw new Error(stderr)
  return stdout.trim()
}

function buildWordScript(params: Schema.Schema.Type<typeof WordActionSchema>): string {
  const p = params as any
  const actions: string[] = []

  actions.push(`$word = $null`)
  actions.push(`try {`)
  actions.push(`  $word = [System.Runtime.InteropServices.Marshal]::GetActiveObject('Word.Application')`)
  actions.push(`} catch {`)
  actions.push(`  $word = New-Object -ComObject Word.Application`)
  actions.push(`}`)
  actions.push(`$word.Visible = $false`)
  actions.push(`$word.DisplayAlerts = 0`)

  if (p.filePath) {
    actions.push(`$doc = $word.Documents.Open('${p.filePath.replace(/'/g, "''")}')`)
  } else {
    actions.push(`$doc = $word.ActiveDocument`)
  }

  switch (p.action) {
    case "write_text":
      actions.push(`$doc.Content.InsertAfter('${p.text?.replace(/'/g, "''") ?? ""}')`)
      actions.push(`Write-Output "OK:write_text"`)
      break
    case "write_at_paragraph": {
      const idx = p.paragraphIndex ?? 1
      actions.push(`$target = $doc.Paragraphs.Item(${idx})`)
      actions.push(`$target.Range.InsertAfter('${(p.text ?? "").replace(/'/g, "''")}')`)
      actions.push(`Write-Output "OK:write_at_paragraph:${idx}"`)
      break
    }
    case "find_replace":
      actions.push(`$doc.Content.Find.Text = '${p.findText?.replace(/'/g, "''") ?? ""}'`)
      actions.push(`$doc.Content.Find.Replacement.Text = '${p.replaceText?.replace(/'/g, "''") ?? ""}'`)
      actions.push(`$doc.Content.Find.Execute()`)
      actions.push(`Write-Output "OK:find_replace"`)
      break
    case "format":
      if (p.bold) actions.push(`$doc.Content.Font.Bold = $true`)
      if (p.fontSize) actions.push(`$doc.Content.Font.Size = ${p.fontSize}`)
      if (p.alignment) actions.push(`$doc.Content.ParagraphFormat.Alignment = ${p.alignment === "center" ? 1 : p.alignment === "right" ? 2 : 0}`)
      actions.push(`Write-Output "OK:format"`)
      break
    default:
      actions.push(`Write-Output "ERROR:unknown action '${p.action}'"`)
  }

  actions.push(`$doc.Save()`)
  actions.push(`$doc.Close()`)
  actions.push(`[System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null`)
  actions.push(`[System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null`)
  actions.push(`[System.GC]::Collect()`)
  actions.push(`[System.GC]::WaitForPendingFinalizers()`)

  return actions.join("\n")
}

export const WordComTool = Tool.define(
  "word_com",
  Effect.succeed({
    description: `Word COM edit tool. Execute visible edits in Word with targets taken from a word_read map â€” never guess paragraph numbers. Actions: write_text (append at end), write_at_paragraph (paragraphIndex from map, text), find_replace (findText, replaceText), format (bold/fontSize/alignment).`,
    parameters: WordActionSchema,
    execute: (params: Schema.Schema.Type<typeof WordActionSchema>, ctx: Tool.Context) =>
      Effect.gen(function* () {
        yield* ctx.ask({
          permission: "word_com",
          patterns: ["*.docx", "*.docm"],
          always: ["*.docx", "*.docm"],
          metadata: {},
        })

        const script = buildWordScript(params)
        const output = yield* Effect.tryPromise({
          try: () => runPowerShell(script),
          catch: (e) => new Error(`Word COM failed: ${e}`),
        })

        return {
          title: `Word: ${(params as any).action}`,
          output,
          metadata: {},
        }
      }).pipe(Effect.orDie),
  }),
)