import { afterEach, describe, expect } from "bun:test"
import { LayerNode } from "@arunaki/core/effect/layer-node"
import { FSUtil } from "@arunaki/core/fs-util"
import { CrossSpawnSpawner } from "@arunaki/core/cross-spawn-spawner"
import { Effect } from "effect"
import { ExcelComTool } from "@arunaki/tools/excel-com"
import { ExcelReadTool } from "@arunaki/tools/excel-read"
import { SessionID, MessageID } from "../../src/session/schema"
import { EventV2Bridge } from "../../src/event-v2-bridge"
import { Format } from "../../src/format"
import { Agent } from "../../src/agent/agent"
import { Truncate } from "@/tool/truncate"
import { Tool } from "@/tool/tool"
import { disposeAllInstances, TestInstance } from "../fixture/fixture"
import { testEffect } from "../lib/effect"
import fs from "node:fs"
import path from "path"

// Real-machine E2E: read REKAP 9-2026new.xlsx, map the 9/15 column (P) from the
// REKAPAN_10.txt business data, and persist the edit back to the .xlsx through
// Excel COM. Everything runs against a copy in the temp instance dir so the
// user's original files stay intact. Enable by setting ARUNAKI_E2E_EXCEL_DIR
// to the folder that holds REKAP 9-2026new.xlsx and REKAPAN_10.txt.

const excelRoot = process.env.ARUNAKI_E2E_EXCEL_DIR
const xlsxSource = excelRoot ? path.join(excelRoot, "REKAP 9-2026new.xlsx") : ""
const excelFixtureReady = !!excelRoot && fs.existsSync(xlsxSource)

const it = testEffect(
  LayerNode.compile(
    LayerNode.group([
      FSUtil.node,
      EventV2Bridge.node,
      Format.node,
      CrossSpawnSpawner.node,
      Truncate.node,
      Agent.node,
    ]),
  ),
)

const ctx: Tool.Context = {
  sessionID: SessionID.make("ses_test-excel-e2e"),
  messageID: MessageID.make("msg_test-excel-e2e"),
  callID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => Effect.void,
  ask: () => Effect.void,
}

afterEach(async () => {
  await disposeAllInstances()
})

describe("Excel edit E2E (real folder)", () => {
  const run = excelFixtureReady ? it.instance : it.instance.skip
  run(
    "reads the workbook, writes the 9/15 column from REKAPAN data, and persists the file",
    Effect.gen(function* () {
      const test = yield* TestInstance
      const xlsxPath = path.join(test.directory, "REKAP 9-2026new.xlsx")
      yield* Effect.promise(() => fs.promises.copyFile(xlsxSource, xlsxPath))
      const before = yield* Effect.promise(async () =>
        Buffer.from(await Bun.file(xlsxPath).arrayBuffer()).toString("base64"),
      )

      const read = yield* (yield* ExcelReadTool).init()
      const map = yield* read.execute({ filePath: xlsxPath }, ctx)
      const doc = JSON.parse(map.output)
      const sheet = doc.sheets.find((s: any) => s.name === "Sheet1")
      expect(sheet).toBeDefined()
      expect(sheet?.rowCount).toBeGreaterThan(23)

      // Sheet1: r1 = date headers (P = 9/15/26), r2 = PEMASUKAN, r13 = TOTAL
      // PEMASUKAN, r14-20 = BRI/BNI/BCA/MANDIRI/CASH/TOKOPEDIA/SHOOPE, r21-24 =
      // PENGELUARAN/GALON/BENSIN/BUS. Fill column P from the REKAPAN_10 data.
      const write = yield* (yield* ExcelComTool).init()
      const result = yield* write.execute(
        {
          action: "write_range",
          filePath: xlsxPath,
          sheetName: "Sheet1",
          cells: [
            { ref: "P2", value: "980000" },
            { ref: "P3", value: "CK FLORENSIA = 650RB(BCA) [ DTF ]" },
            { ref: "P4", value: "CK 10241 THEBEST = 160RB(BNI) [ 14 PCS ]" },
            { ref: "P5", value: "CK DEDY NAINGGOLAN = 170RB(CASH) [ 52 PCS ]" },
            { ref: "P6", value: "CI LISOI (15-9-2026) = 140RB" },
            { ref: "P7", value: "CI JOKO (15-9-2026) = 236RB" },
            { ref: "P8", value: "CI TESTBUYER (15-9-2026) = 100RB" },
            { ref: "P9", value: "CK HENNY = 549RB" },
            { ref: "P10", value: "BUS = 35" },
            { ref: "P11", value: "BENSIN = 55" },
            { ref: "P12", value: "GALON = 10" },
            { ref: "P13", value: "980000" },
            { ref: "P14", value: "0" },
            { ref: "P15", value: "160000" },
            { ref: "P16", value: "650000" },
            { ref: "P17", value: "0" },
            { ref: "P18", value: "170000" },
            { ref: "P19", value: "0" },
            { ref: "P20", value: "0" },
            { ref: "P21", value: "100000" },
            { ref: "P22", value: "10000" },
            { ref: "P23", value: "55000" },
            { ref: "P24", value: "35000" },
          ],
        },
        ctx,
      )
      expect(result.output).toContain("OK:write_range:23 cells")

      // Re-read through the tool and confirm the column landed in the file.
      const afterMap = yield* read.execute({ filePath: xlsxPath }, ctx)
      const afterDoc = JSON.parse(afterMap.output)
      const afterSheet = afterDoc.sheets.find((s: any) => s.name === "Sheet1")
      const cellOf = (ref: string) => {
        const cell = afterSheet.cells.find((c: any) => c.ref === ref)
        return cell ? String(cell.text ?? cell.value ?? "") : ""
      }
      expect(cellOf("P2")).toBe("980000")
      expect(cellOf("P3")).toContain("CK FLORENSIA")
      expect(cellOf("P13")).toBe("980000")
      expect(cellOf("P15")).toBe("160000")
      expect(cellOf("P16")).toBe("650000")
      expect(cellOf("P18")).toBe("170000")
      expect(cellOf("P21")).toBe("100000")
      expect(cellOf("P23")).toBe("55000")

      const after = yield* Effect.promise(async () => Buffer.from(await Bun.file(xlsxPath).arrayBuffer()).toString("base64"))
      expect(after).not.toBe(before)
      const original = yield* Effect.promise(async () =>
        Buffer.from(await Bun.file(xlsxSource).arrayBuffer()).toString("base64"),
      )
      expect(original).toBe(before)
    }),
    // Excel COM + PowerShell can exceed the default per-test timeout.
    { timeout: 120_000 },
  )
})