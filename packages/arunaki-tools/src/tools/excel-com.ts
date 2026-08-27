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
  rowLabel: Schema.optional(Schema.String),
  columnLetter: Schema.optional(Schema.String),
  columnDate: Schema.optional(Schema.String),
  date: Schema.optional(Schema.String),
  rows: Schema.optional(Schema.Array(Schema.Struct({
    label: Schema.String,
    value: Schema.Unknown,
  }))),
  details: Schema.optional(Schema.Array(Schema.String)),
  bold: Schema.optional(Schema.Boolean),
  italic: Schema.optional(Schema.Boolean),
  fontSize: Schema.optional(Schema.Number),
  bgColor: Schema.optional(Schema.Number),
  alignment: Schema.optional(Schema.String),
  sourceSheet: Schema.optional(Schema.String),
  newSheetName: Schema.optional(Schema.String),
  matchColumn: Schema.optional(Schema.String),
  matchValue: Schema.optional(Schema.String),
  targetColumn: Schema.optional(Schema.String),
  delta: Schema.optional(Schema.Boolean),
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
    case "read_cell":
      actions.push(`$val = $ws.Range('${p.cell}').Value2`)
      actions.push(`Write-Output ("CELL:" + $val)`)
      break
    case "write_cell":
      actions.push(`$ws.Range('${p.cell}').Value2 = '${String(p.value).replace(/'/g, "''")}'`)
      actions.push(`Write-Output "OK:write_cell:${p.cell}"`)
      break
    case "read_range":
      actions.push(`$rng = $ws.Range('${p.range}')`)
      actions.push(`$rows = $rng.Rows.Count`)
      actions.push(`$cols = $rng.Columns.Count`)
      actions.push(`for ($r = 1; $r -le $rows; $r++) {`)
      actions.push(`  $line = @()`)
      actions.push(`  for ($c = 1; $c -le $cols; $c++) {`)
      actions.push(`    $line += $rng.Cells($r,$c).Text`)
      actions.push(`  }`)
      actions.push(`  Write-Output ($line -join "\`t")`)
      actions.push(`}`)
      break
    case "fill_table_column": {
      if (p.rowLabel && p.columnDate) {
        actions.push(`$found = $false`)
        actions.push(`$searchRange = $ws.Range("A1:Z50")`)
        actions.push(`foreach ($cell In $searchRange.Cells) {`)
        actions.push(`  if ($cell.Text -match [regex]::Escape('${p.rowLabel.replace(/'/g, "''")}')) {`)
        actions.push(`    $targetCol = $ws.Range('${p.columnDate}1').Column`)
        actions.push(`    $ws.Cells($cell.Row, $targetCol).Value2 = '${String(p.value ?? "").replace(/'/g, "''")}'`)
        actions.push(`    Write-Output ("OK:fill:" + $cell.Address() + "->col" + $targetCol)`)
        actions.push(`    $found = $true`)
        actions.push(`    break`)
        actions.push(`  }`)
        actions.push(`}`)
        actions.push(`if (-not $found) { Write-Output "ERROR:label '${p.rowLabel}' not found" }`)
      } else if (p.rows) {
        actions.push(`foreach ($item in @(${p.rows.map((r: any) => `@{label='${r.label.replace(/'/g, "''")}';value='${String(r.value).replace(/'/g, "''")}'}` ).join(", ")})) {`)
        actions.push(`  $searchRange = $ws.Range("A1:Z100")`)
        actions.push(`  foreach ($cell In $searchRange.Cells) {`)
        actions.push(`    if ($cell.Text -match [regex]::Escape($item.label)) {`)
        actions.push(`      $col = $ws.Range('${p.columnDate ?? "A"}1').Column`)
        actions.push(`      $ws.Cells($cell.Row, $col).Value2 = $item.value`)
        actions.push(`      break`)
        actions.push(`    }`)
        actions.push(`  }`)
        actions.push(`}`)
        actions.push(`Write-Output "OK:fill_table_column:${p.rows.length} rows"`)
      }
      break
    }
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
    case "read_sheet_names":
      actions.push(`foreach ($s in $wb.Sheets) { Write-Output $s.Name }`)
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

export const ExcelComTool = Tool.define<typeof ExcelActionSchema, Metadata>(
  "excel_com",
  Effect.succeed({
    description: `Excel COM automation tool. Actions: read_cell, write_cell, read_range, fill_table_column, format_cell, clone_sheet, delete_sheet, read_sheet_names. Uses Windows COM to control Excel directly.`,
    parameters: ExcelActionSchema,
    execute: (params, ctx) =>
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
      }),
  }),
)
