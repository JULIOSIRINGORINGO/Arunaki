import * as fs from "fs"
import JSZip from "jszip"
import { WordMap } from "./docmap"

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
