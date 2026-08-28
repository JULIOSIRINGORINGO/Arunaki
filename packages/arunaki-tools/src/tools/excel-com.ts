import { Effect, Schema } from "effect"
import * as Tool from "@arunaki/engine/tool"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

const ExcelActionSchema = Schema.Struct({
  action: Schema.String,
  filePath: Schema.optional(Schema.String),
  cell: Schema.optional(Schema.String),
  value: Schema.optional(Schema.Unknown),
  sheetName: Schema.optional(Schema.String),
  range: Schema.optional(Schema.String),
  cells: Schema.optional(Schema.Array(Schema.Struct({
    ref: Schema.String,
    value: Schema.Unknown,
  }))),
  bold: Schema.optional(Schema.Boolean),
  italic: Schema.optional(Schema.Boolean),
  fontSize: Schema.optional(Schema.Number),
  bgColor: Schema.optional(Schema.Number),
  alignment: Schema.optional(Schema.String),
  sourceSheet: Schema.optional(Schema.String),
  newSheetName: Schema.optional(Schema.String),
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

function buildExcelScript(params: Schema.Schema.Type<typeof ExcelActionSchema>): string {
  const p = params as any
  const actions: string[] = []

  actions.push(`$excel = $null`)
  actions.push(`try {`)
  actions.push(`  $excel = [System.Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application')`)
  actions.push(`} catch {`)
  actions.push(`  $excel = New-Object -ComObject Excel.Application`)
  actions.push(`}`)
  actions.push(`$excel.Visible = $false`)
  actions.push(`$excel.DisplayAlerts = $false`)

  if (p.filePath) {
    actions.push(`$wb = $excel.Workbooks.Open('${p.filePath.replace(/'/g, "''")}')`)
  } else {
    actions.push(`$wb = $excel.ActiveWorkbook`)
  }

  if (p.sheetName) {
    actions.push(`$ws = $wb.Sheets.Item('${p.sheetName.replace(/'/g, "''")}')`)
    actions.push(`$ws.Activate()`)
  } else {
    actions.push(`$ws = $wb.ActiveSheet`)
  }

  switch (p.action) {
    case "write_cell":
      actions.push(`$ws.Range('${p.cell}').Value2 = '${String(p.value ?? "").replace(/'/g, "''")}'`)
      actions.push(`Write-Output "OK:write_cell:${p.cell}"`)
      break
    case "write_range":
      for (const c of p.cells ?? []) {
        actions.push(`$ws.Range('${c.ref}').Value2 = '${String(c.value ?? "").replace(/'/g, "''")}'`)
      }
      actions.push(`Write-Output "OK:write_range:${(p.cells ?? []).length} cells"`)
      break
    case "format_cell":
      if (p.bold) actions.push(`$ws.Range('${p.cell}').Font.Bold = $true`)
      if (p.italic) actions.push(`$ws.Range('${p.cell}').Font.Italic = $true`)
      if (p.fontSize) actions.push(`$ws.Range('${p.cell}').Font.Size = ${p.fontSize}`)
      if (p.bgColor) actions.push(`$ws.Range('${p.cell}').Interior.ColorIndex = ${p.bgColor}`)
      if (p.alignment) actions.push(`$ws.Range('${p.cell}').HorizontalAlignment = ${p.alignment === "center" ? -4108 : p.alignment === "right" ? -4152 : -4131}`)
      actions.push(`Write-Output "OK:format:${p.cell}"`)
      break
    case "clone_sheet":
      actions.push(`$srcSheet = $wb.Sheets.Item('${p.sourceSheet?.replace(/'/g, "''")}')`)
      actions.push(`$srcSheet.Copy([System.Reflection.Missing]::Value, $wb.Sheets.Item($wb.Sheets.Count))`)
      actions.push(`$newSheet = $wb.Sheets.Item($wb.Sheets.Count)`)
      if (p.newSheetName) actions.push(`$newSheet.Name = '${p.newSheetName.replace(/'/g, "''")}'`)
      actions.push(`Write-Output "OK:clone_sheet:${p.newSheetName ?? "Copy"}"`)
      break
    case "delete_sheet":
      actions.push(`$wb.Sheets.Item('${p.sheetName?.replace(/'/g, "''")}').Delete()`)
      actions.push(`Write-Output "OK:delete_sheet:${p.sheetName}"`)
      break
    default:
      actions.push(`Write-Output "ERROR:unknown action '${p.action}'"`)
  }

  actions.push(`$wb.Save()`)
  actions.push(`$wb.Close()`)
  actions.push(`[System.Runtime.InteropServices.Marshal]::ReleaseComObject($wb) | Out-Null`)
  actions.push(`[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null`)
  actions.push(`[System.GC]::Collect()`)
  actions.push(`[System.GC]::WaitForPendingFinalizers()`)

  return actions.join("\n")
}

export const ExcelComTool = Tool.define(
  "excel_com",
  Effect.succeed({
    description: `Excel COM edit tool. Execute visible edits in Excel with targets taken from an excel_read map -- never guess cell addresses. Actions: write_cell (cell:ref, value), write_range (cells:[{ref,value}]), format_cell (cell, bold/italic/fontSize/bgColor/alignment), clone_sheet (sourceSheet, newSheetName), delete_sheet (sheetName). The ref must come from the map returned by excel_read; write_range is for a full column of a report table.`,
    parameters: ExcelActionSchema,
    execute: (params: Schema.Schema.Type<typeof ExcelActionSchema>, ctx: Tool.Context) =>
      Effect.gen(function* () {
        yield* ctx.ask({
          permission: "excel_com",
          patterns: ["*.xlsm", "*.xlsx"],
          always: ["*.xlsm", "*.xlsx"],
          metadata: {},
        })

        const script = buildExcelScript(params)
        const output = yield* Effect.tryPromise({
          try: () => runPowerShell(script),
          catch: (e) => new Error(`Excel COM failed: ${e}`),
        })

        return {
          title: `Excel: ${(params as any).action}`,
          output,
          metadata: {},
        }
      }).pipe(Effect.orDie),
  }),
)