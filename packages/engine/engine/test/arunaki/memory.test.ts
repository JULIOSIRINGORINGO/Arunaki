import { describe, expect, test } from "vitest"
import { applyCorrections, deriveSyntaxInvariants, inferDomain, mightBeCorrection } from "../../src/arunaki/memory"

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
