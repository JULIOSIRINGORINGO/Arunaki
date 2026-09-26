import * as XLSX from "xlsx"
import { ExcelMap } from "./docmap"

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
