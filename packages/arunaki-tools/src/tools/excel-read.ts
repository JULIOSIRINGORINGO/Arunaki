import { Effect, Schema } from "effect"
import * as Tool from "@arunaki/engine/tool"
import * as XLSX from "xlsx"
import * as fs from "fs"
import * as path from "path"
import { ExcelMap } from "../docmap"

export const Parameters = Schema.Struct({
  filePath: Schema.String,
})

type Metadata = Record<string, unknown>

export function buildExcelMap(filePath: string): typeof ExcelMap.Type {
  const workbook = XLSX.readFile(filePath, {
    cellDates: false,
    cellNF: true,
    cellFormula: true,
    cellStyles: false,
  })

  const sheets = workbook.SheetNames.map((name) => {
    const ws = workbook.Sheets[name]
    const ref = ws["!ref"] ?? null
    const cells = []
    let rowCount = 0
    let colCount = 0

    if (ref) {
      const range = XLSX.utils.decode_range(ref)
      rowCount = range.e.r - range.s.r + 1
      colCount = range.e.c - range.s.c + 1
      for (let R = range.s.r; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
          const address = XLSX.utils.encode_cell({ r: R, c: C })
          const cell = ws[address]
          if (!cell) continue
          cells.push({
            ref: address,
            value: cell.v ?? null,
            text: cell.w ?? null,
            type: cell.t ?? null,
            formula: cell.f ?? null,
          })
        }
      }
    }

    return {
      name,
      range: ref,
      rowCount,
      colCount,
      cells,
      merges: (ws["!merges"] ?? []).map((m: XLSX.Range) => ({
        anchor: XLSX.utils.encode_cell({ r: m.s.r, c: m.s.c }),
        end: XLSX.utils.encode_cell({ r: m.e.r, c: m.e.c }),
      })),
    }
  })

  return { format: "excel", filePath, sheets }
}

export const ExcelReadTool = Tool.define(
  "excel_read",
  Effect.succeed({
    description: `Parse an Excel workbook (.xlsx/.xls) with the xlsx parser and return a deterministic Document Map (JSON): every sheet with its range, dimension, populated cells ({ref, value, text, type, formula}) and merged ranges. Use this INSTEAD of COM for reading â€” never guess cell addresses. Pipe the returned map to the LLM so subsequent excel_com edits can target exact refs.`,
    parameters: Parameters,
    execute: (params: Schema.Schema.Type<typeof Parameters>) =>
      Effect.gen(function* () {
        const filePath = path.resolve(params.filePath)
        if (!fs.existsSync(filePath)) {
          return { title: "Excel read: file not found", output: `ERROR: ${filePath} not found`, metadata: { cells: 0 } }
        }

        try {
          const map = buildExcelMap(filePath)
          return {
            title: `Excel map: ${filePath}`,
            output: JSON.stringify(map),
            metadata: { cells: map.sheets.reduce((n, s) => n + s.cells.length, 0) },
          }
        } catch (e) {
          return { title: "Excel read failed", output: `ERROR: ${e}`, metadata: { cells: 0 } }
        }
      }),
  }),
)