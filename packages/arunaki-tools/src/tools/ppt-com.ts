import { Effect, Schema } from "effect"
import * as Tool from "@arunaki/engine/tool"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

const PptActionSchema = Schema.Struct({
  action: Schema.String,
  filePath: Schema.optional(Schema.String),
  slideNumber: Schema.optional(Schema.Number),
  shapeIndex: Schema.optional(Schema.Number),
  shapeName: Schema.optional(Schema.String),
  text: Schema.optional(Schema.String),
  title: Schema.optional(Schema.String),
  layout: Schema.optional(Schema.Number),
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

function buildPptScript(params: Schema.Schema.Type<typeof PptActionSchema>): string {
  const p = params as any
  const actions: string[] = []

  actions.push(`$ppt = $null`)
  actions.push(`try {`)
  actions.push(`  $ppt = [System.Runtime.InteropServices.Marshal]::GetActiveObject('PowerPoint.Application')`)
  actions.push(`} catch {`)
  actions.push(`  $ppt = New-Object -ComObject PowerPoint.Application`)
  actions.push(`}`)
  actions.push(`$ppt.Visible = [Microsoft.Office.Interop.PowerPoint.MsoTriState]::msoTrue`)

  if (p.filePath) {
    actions.push(`$pres = $ppt.Presentations.Open('${p.filePath.replace(/'/g, "''")}')`)
  } else {
    actions.push(`$pres = $ppt.ActivePresentation`)
  }

  switch (p.action) {
    case "add_slide":
      actions.push(`$layout = $pres.SlideMaster.CustomLayouts.Item(${p.layout ?? 1})`)
      actions.push(`$slide = $pres.Slides.AddSlide($pres.Slides.Count + 1, $layout)`)
      if (p.title) actions.push(`$slide.Shapes.Title.TextFrame.TextRange.Text = '${p.title.replace(/'/g, "''")}'`)
      if (p.text) actions.push(`$slide.Shapes.Placeholders.Item(2).TextFrame.TextRange.Text = '${p.text.replace(/'/g, "''")}'`)
      actions.push(`Write-Output "OK:add_slide:$($pres.Slides.Count)"`)
      break
    case "set_shape_text":
      actions.push(`$slide = $pres.Slides.Item(${p.slideNumber ?? 1})`)
      if (p.shapeName) {
        actions.push(`foreach ($shape In $slide.Shapes) {`)
        actions.push(`  if ($shape.Name -eq '${p.shapeName.replace(/'/g, "''")}') {`)
        actions.push(`    $shape.TextFrame.TextRange.Text = '${(p.text ?? "").replace(/'/g, "''")}'`)
        actions.push(`    Write-Output "OK:set_shape_text:${p.shapeName}"`)
        actions.push(`  }`)
        actions.push(`}`)
      } else {
        actions.push(`$idx = ${p.shapeIndex ?? 1}`)
        actions.push(`$shape = $slide.Shapes.Item($idx)`)
        actions.push(`$shape.TextFrame.TextRange.Text = '${(p.text ?? "").replace(/'/g, "''")}'`)
        actions.push(`Write-Output "OK:set_shape_text:shape$($idx)"`)
      }
      break
    default:
      actions.push(`Write-Output "ERROR:unknown action '${p.action}'"`)
  }

  actions.push(`$pres.Save()`)
  actions.push(`$pres.Close()`)
  actions.push(`[System.Runtime.InteropServices.Marshal]::ReleaseComObject($pres) | Out-Null`)
  actions.push(`[System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null`)
  actions.push(`[System.GC]::Collect()`)
  actions.push(`[System.GC]::WaitForPendingFinalizers()`)

  return actions.join("\n")
}

export const PptComTool = Tool.define(
  "ppt_com",
  Effect.succeed({
    description: `PowerPoint COM edit tool. Execute visible edits in PowerPoint with targets taken from a ppt_read map. Actions: add_slide (layout, title, text), set_shape_text (slideNumber, then shapeName or shapeIndex from map, text).`,
    parameters: PptActionSchema,
    execute: (params: Schema.Schema.Type<typeof PptActionSchema>, ctx: Tool.Context) =>
      Effect.gen(function* () {
        yield* ctx.ask({
          permission: "ppt_com",
          patterns: ["*.pptx", "*.pptm"],
          always: ["*.pptx", "*.pptm"],
          metadata: {},
        })

        const script = buildPptScript(params)
        const output = yield* Effect.tryPromise({
          try: () => runPowerShell(script),
          catch: (e) => new Error(`PPT COM failed: ${e}`),
        })

        return {
          title: `PPT: ${(params as any).action}`,
          output,
          metadata: {},
        }
      }).pipe(Effect.orDie),
  }),
)