import { describe, expect, test } from "bun:test"
import { applyCorrections, mightBeCorrection } from "../../src/arunaki/memory"

describe("memory: mightBeCorrection", () => {
  test("flags negative/corrective messages without spending tokens on idle turns", () => {
    expect(mightBeCorrection("jangan ubah nominal ke rupiah")).toBe(true)
    expect(mightBeCorrection("harusnya kolom total di akhir")).toBe(true)
    expect(mightBeCorrection("itu salah, pakai tanggal kemarin")).toBe(true)
    expect(mightBeCorrection("lupa totalnya belum dihitung ulang")).toBe(true)
    expect(mightBeCorrection("mulai sekarang formatnya pakai koma")).toBe(true)
  })

  test("ignores neutral document tasks", () => {
    expect(mightBeCorrection("rekap data penjualan ke excel")).toBe(false)
    expect(mightBeCorrection("halo")).toBe(false)
    expect(mightBeCorrection("update ini ke laporan harian")).toBe(false)
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
