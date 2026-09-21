import { describe, expect, test } from "vitest"
import { applyCorrections, deriveSyntaxInvariants, inferDomain, mightBeCorrection, synthesize, updateWorkspaceCatalog } from "../../src/arunaki/memory"

describe("memory: mightBeCorrection", () => {
  test("accepts substantive messages across all languages (Arabic, Chinese, English, Indonesian, dialects)", () => {
    expect(mightBeCorrection("jangan ubah nominal ke rupiah")).toBe(true)
    expect(mightBeCorrection("tambah aturan format tanggal YYYY-MM-DD")).toBe(true)
    expect(mightBeCorrection("remember this rule: always round up")).toBe(true)
    expect(mightBeCorrection("يرجى عدم تغيير هذا العمود")).toBe(true) // Arabic
    expect(mightBeCorrection("请记住总计必须四舍五入")).toBe(true) // Chinese
    expect(mightBeCorrection("ojo lali format tanggal")).toBe(true) // Javanese
  })

  test("ignores empty or whitespace turns", () => {
    expect(mightBeCorrection("")).toBe(false)
    expect(mightBeCorrection("   ")).toBe(false)
  })
})

describe("memory: dynamic cartography", () => {
  test("infers domain dynamically based on actual scanned file extensions", () => {
    expect(inferDomain(["finance"], [".xlsx", ".csv"])).toBe("Spreadsheets & Tabular Data")
    expect(inferDomain(["legal"], [".docx", ".pdf"])).toBe("Documents & Reports")
    expect(inferDomain(["hybrid"], [".xlsx", ".docx"])).toBe("Spreadsheets & Tabular Data | Documents & Reports")
    expect(inferDomain([], [])).toBe("General Document Workspace")
  })

  test("derives universal syntax invariants without hardcoded test assumptions", () => {
    const invariants = deriveSyntaxInvariants([".xlsx", ".txt"])
    const text = invariants.join("\n")
    expect(text).toContain("Tabular & Spreadsheet Files")
    expect(text).toContain("Document Files")
    expect(text).toContain("Active Folder Isolation")
    expect(text).not.toContain("Pemasukan, Pengeluaran")
    expect(text).not.toContain("Labura")
  })
})

describe("memory: applyCorrections", () => {
  const doc = ["# LOCAL WORKSPACE OPERATING RULES", "", "## Domain Profile", "", "Workspace focused on data.", ""].join(
    "\n",
  )

  test("appends a section when the rulebook has no User Preferences yet", () => {
    const out = applyCorrections(doc, ["Simpan nominal tanpa konversi mata uang."])
    expect(out).toContain("## User Preferences & Learned Corrections")
    expect(out).toContain("- Simpan nominal tanpa konversi mata uang.")
  })

  test("replaces the existing User Preferences section instead of duplicating", () => {
    const first = applyCorrections(doc, ["Rule A."])
    const second = applyCorrections(first, ["Rule B."])
    expect(second.match(/## User Preferences & Learned Corrections/g)).toHaveLength(1)
    expect(second).toContain("- Rule A.")
    expect(second).toContain("- Rule B.")
  })

  test("returns the doc untouched when there are no corrections", () => {
    expect(applyCorrections(doc, ["  ", ""])).toBe(doc)
  })
})

describe("memory: synthesize rule preservation", () => {
  test("preserves existing learned preferences across cartography re-runs", () => {
    const existing = [
      "# LOCAL WORKSPACE OPERATING RULES",
      "",
      "## User Preferences & Learned Corrections",
      "### Learned by the Sentinel",
      "- Orderan dicatat di ORDER.txt",
      "- REKAP HANYA untuk UANG MASUK",
      "",
      "---",
    ].join("\n")

    const resynth = synthesize("/test", ["ORDER.txt", "REKAP.xlsx"], existing)
    expect(resynth).toContain("- Orderan dicatat di ORDER.txt")
    expect(resynth).toContain("- REKAP HANYA untuk UANG MASUK")
    expect(resynth).not.toContain("_No learned preferences yet._")
  })

  test("ignores '_No learned preferences yet._' placeholder and allows clean rulebook state", () => {
    const existingWithPlaceholder = [
      "# LOCAL WORKSPACE OPERATING RULES",
      "",
      "## User Preferences & Learned Corrections",
      "### Learned by the Sentinel",
      "- _No learned preferences yet._",
      "",
      "---",
    ].join("\n")

    const resynth = synthesize("/test", ["file.txt"], existingWithPlaceholder)
    expect(resynth).toContain("_No learned preferences yet._")
    // Should NOT have rendered "- _No learned preferences yet._" as an actual bullet item
    expect(resynth).not.toContain("- _No learned preferences yet._")
  })

  test("preserves custom user guides and sections across cartography re-runs and catalog updates", () => {
    const existingWithCustomSections = [
      "# LOCAL WORKSPACE OPERATING RULES (REKAPAN)",
      "",
      "## Workspace Catalog",
      "- OLD_FILE.txt",
      "",
      "## User Preferences & Learned Corrections",
      "### Learned by the Sentinel",
      "- Orderan dicatat di ORDER.txt",
      "",
      "========================================",
      "PANDUAN RINGKAS",
      "========================================",
      "",
      "## 1. ORDER.TXT",
      "Format: [NAMA BARANG]",
      "",
      "---",
      "_Generated automatically. Arunaki self-corrects and learns from user feedback._",
    ].join("\n")

    // Test 1: updateWorkspaceCatalog
    const updated = updateWorkspaceCatalog(existingWithCustomSections, ["NEW_FILE.xlsx", "ORDER.txt"])
    expect(updated).toContain("- NEW_FILE.xlsx")
    expect(updated).toContain("- Orderan dicatat di ORDER.txt")
    expect(updated).toContain("PANDUAN RINGKAS")
    expect(updated).toContain("## 1. ORDER.TXT")

    // Test 2: synthesize preservation
    const resynth = synthesize("/test", ["NEW_FILE.xlsx", "ORDER.txt"], existingWithCustomSections)
    expect(resynth).toContain("- NEW_FILE.xlsx")
    expect(resynth).toContain("- Orderan dicatat di ORDER.txt")
    expect(resynth).toContain("PANDUAN RINGKAS")
    expect(resynth).toContain("## 1. ORDER.TXT")

    // Test 3: applyCorrections preservation
    const withCorrection = applyCorrections(existingWithCustomSections, ["Rule baru: jangan edit rumus"])
    expect(withCorrection).toContain("- Rule baru: jangan edit rumus")
    expect(withCorrection).toContain("- Orderan dicatat di ORDER.txt")
    expect(withCorrection).toContain("PANDUAN RINGKAS")
    expect(withCorrection).toContain("## 1. ORDER.TXT")
  })
})

