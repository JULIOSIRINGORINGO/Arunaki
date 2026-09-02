import { Effect, Schema } from "effect"
import * as Tool from "@arunaki/engine/tool"
import * as fs from "fs"
import * as path from "path"
import JSZip from "jszip"
import { PptMap } from "./docmap"

export const Parameters = Schema.Struct({
  filePath: Schema.String,
})

type Metadata = Record<string, unknown>

export async function buildPptMap(filePath: string): Promise<typeof PptMap.Type> {
  const buf = await fs.promises.readFile(filePath)
  const zip = await JSZip.loadAsync(buf)

  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))

  const slides = []
  for (const name of slideNames) {
    const xml = await zip.file(name)!.async("string")
    const shapes = []
    const spRe = /<p:sp\b[\s\S]*?<\/p:sp>/g
    let m: RegExpExecArray | null
    while ((m = spRe.exec(xml)) !== null) {
      const block = m[0]
      const idMatch = block.match(/<p:cNvPr\b[^>]*\bid="(\d+)"/)
      const nameMatch = block.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)
      const text = (block.match(/<a:t>([\s\S]*?)<\/a:t>/g) ?? [])
        .map((t) => t.replace(/<\/?a:t>/g, ""))
        .join("\n")
        .trim()
      shapes.push({
        id: idMatch ? Number(idMatch[1]) : -1,
        name: nameMatch ? nameMatch[1] : null,
        text: text || null,
      })
    }
    const number = Number(name.match(/\d+/)![0])
    slides.push({ number, shapes })
  }

  return { format: "ppt", filePath, slides }
}

export const PptReadTool = Tool.define(
  "ppt_read",
  Effect.succeed({
    description: `Parse a PowerPoint presentation (.pptx) and return a deterministic Document Map (JSON): each slide {number, shapes:[{id, name, text}]}. Use this INSTEAD of COM for reading. Shape id/name in the map lets ppt_com edits target exact shapes.`,
    parameters: Parameters,
    execute: (params: Schema.Schema.Type<typeof Parameters>) =>
      Effect.gen(function* () {
        const filePath = path.resolve(params.filePath)
        if (!fs.existsSync(filePath)) {
          return { title: "PPT read: file not found", output: `ERROR: ${filePath} not found`, metadata: { slides: 0 } }
        }
        const map = yield* Effect.tryPromise({ try: () => buildPptMap(filePath), catch: (e) => new Error(String(e)) })
        return {
          title: `PPT map: ${filePath}`,
          output: JSON.stringify(map),
          metadata: { slides: map.slides.length },
        }
      }).pipe(Effect.orDie),
  }),
)