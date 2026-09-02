import { Effect, Schema } from "effect"
import * as Tool from "@arunaki/engine/tool"
import * as fs from "fs"
import * as path from "path"
import JSZip from "jszip"
import { WordMap } from "./docmap"

export const Parameters = Schema.Struct({
  filePath: Schema.String,
})

type Metadata = Record<string, unknown>

function stripXml(xml: string): string {
  return xml
    .replace(/<w:tab[^>]*\/>/g, " ")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .trim()
}

export async function buildWordMap(filePath: string): Promise<typeof WordMap.Type> {
  const buf = await fs.promises.readFile(filePath)
  const zip = await JSZip.loadAsync(buf)
  const docFile = zip.file("word/document.xml")
  if (!docFile) throw new Error("not a .docx (no word/document.xml)")
  const xml = await docFile.async("string")
  const body = xml.slice(xml.indexOf("<w:body>") + 8, xml.lastIndexOf("</w:body>"))

  const paraRe = /<w:p(?![^>]*tblPr)[^>]*>([\s\S]*?)<\/w:p>/g
  const tableRe = /<w:tbl[^>]*>([\s\S]*?)<\/w:tbl>/g

  const events: Array<{ pos: number; end: number; kind: "p" | "tbl"; content: string }> = []
  let m: RegExpExecArray | null
  while ((m = paraRe.exec(body)) !== null) events.push({ pos: m.index, end: m.index + m[0].length, kind: "p", content: m[1] })
  while ((m = tableRe.exec(body)) !== null) events.push({ pos: m.index, end: m.index + m[0].length, kind: "tbl", content: m[1] })
  events.sort((a, b) => a.pos - b.pos)

  const paragraphs = []
  const tables = []
  let paraIndex = 0
  let tableIndex = 0

  for (const ev of events) {
    if (ev.kind === "p") {
      // Skip paragraphs that live inside a table (already captured as table cells).
      const insideTable = events.some((t) => t.kind === "tbl" && ev.pos > t.pos && ev.end < t.end)
      if (insideTable) continue
      const text = stripXml(ev.content)
      if (text) paragraphs.push({ index: ++paraIndex, text })
      continue
    }
    const rows = []
    const trRe = /<w:tr[^>]*>([\s\S]*?)<\/w:tr>/g
    let rm: RegExpExecArray | null
    while ((rm = trRe.exec(ev.content)) !== null) {
      const row = []
      const tcRe = /<w:tc[^>]*>([\s\S]*?)<\/w:tc>/g
      let cm: RegExpExecArray | null
      while ((cm = tcRe.exec(rm[1])) !== null) {
        row.push(stripXml(cm[1]))
      }
      rows.push(row)
    }
    tables.push({ index: ++tableIndex, rows })
  }

  return { format: "word", filePath, paragraphs, tables }
}

export const WordReadTool = Tool.define(
  "word_read",
  Effect.succeed({
    description: `Parse a Word document (.docx) and return a deterministic Document Map (JSON): paragraphs ({index, text}) and tables ({index, rows}). Use this INSTEAD of COM for reading. The returned paragraph/table indices let word_com edits target exact positions.`,
    parameters: Parameters,
    execute: (params: Schema.Schema.Type<typeof Parameters>) =>
      Effect.gen(function* () {
        const filePath = path.resolve(params.filePath)
        if (!fs.existsSync(filePath)) {
          return {
            title: "Word read: file not found",
            output: `ERROR: ${filePath} not found`,
            metadata: { paragraphs: 0, tables: 0 },
          }
        }

        const map = yield* Effect.tryPromise({ try: () => buildWordMap(filePath), catch: (e) => new Error(String(e)) })
        return {
          title: `Word map: ${filePath}`,
          output: JSON.stringify(map),
          metadata: { paragraphs: map.paragraphs.length, tables: map.tables.length },
        }
      }).pipe(Effect.orDie),
  }),
)