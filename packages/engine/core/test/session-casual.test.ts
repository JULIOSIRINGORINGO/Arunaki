import { describe, expect, it } from "bun:test"
import { isCasualText } from "../src/session/runner/casual"

describe("isCasualText", () => {
  it("detects basic greetings as casual", () => {
    const greetings = [
      "halo",
      "halo!",
      "Halo",
      "hai",
      "hi",
      "hey",
      "hello",
      "p",
      "tes",
      "test",
      "assalamualaikum",
      "selamat pagi",
      "selamat siang",
      "selamat malam",
      "halo arunaki",
      "hai bot",
      "selamat pagi arunaki!",
    ]
    for (const g of greetings) {
      expect(isCasualText(g)).toBe(true)
    }
  })

  it("detects small talk, identity questions, and gratitude as casual", () => {
    const smallTalk = [
      "apa kabar?",
      "kamu siapa",
      "siapa kamu?",
      "kamu bisa apa?",
      "bisa apa kamu",
      "terima kasih",
      "makasih",
      "thanks!",
      "ok",
      "oke",
      "sip",
      "mantap",
      "ceritakan lelucon",
    ]
    for (const st of smallTalk) {
      expect(isCasualText(st)).toBe(true)
    }
  })

  it("returns false for document and file requests", () => {
    const docTasks = [
      "rekap ke excel",
      "baca file laporan.xlsx",
      "buka file word",
      "ada file apa saja di sini?",
      "cek folder laporan",
      "hitung total pengeluaran",
      "update saldo kas",
      "buatkan invoice baru",
      "tampilkan data pelanggan",
      "export laporan ke pdf",
      "edit tabel keuangan",
    ]
    for (const dt of docTasks) {
      expect(isCasualText(dt)).toBe(false)
    }
  })

  it("returns false when transaction numbers or amounts are present", () => {
    const rawData = [
      "catat ini 5 sak semen 300rb",
      "beli bensin Rp 50.000",
      "masukkan transaksi 50000",
    ]
    for (const rd of rawData) {
      expect(isCasualText(rd)).toBe(false)
    }
  })

  it("returns false when user pastes multiline data or notes", () => {
    const multiline = `Budi beli semen 5 sak
Bambang beli pasir 1 truk
Joko bayar kasbon`
    expect(isCasualText(multiline)).toBe(false)
  })
})
