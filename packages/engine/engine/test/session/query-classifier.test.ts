import { describe, expect, it } from "bun:test"
import { isCasualGreetingOrChat } from "../../src/session/query-classifier"
import type { SessionV1 } from "@arunaki/core/v1/session"

function makeUserMsg(text: string, parts?: any[]): SessionV1.WithParts {
  return {
    info: {
      id: "msg_user_1",
      sessionID: "ses_test",
      role: "user",
      time: { created: Date.now() },
      agent: "default",
      model: { providerID: "test" as any, modelID: "test" as any },
    },
    parts: parts ?? [
      {
        id: "part_1",
        messageID: "msg_user_1",
        sessionID: "ses_test",
        type: "text",
        text,
      } as SessionV1.TextPart,
    ],
  }
}

describe("isCasualGreetingOrChat", () => {
  it("detects basic greetings as casual (step 1)", () => {
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
      expect(isCasualGreetingOrChat(makeUserMsg(g), 1)).toBe(true)
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
      expect(isCasualGreetingOrChat(makeUserMsg(st), 1)).toBe(true)
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
      expect(isCasualGreetingOrChat(makeUserMsg(dt), 1)).toBe(false)
    }
  })

  it("returns false when transaction numbers or amounts are present", () => {
    const rawData = [
      "catat ini 5 sak semen 300rb",
      "beli bensin Rp 50.000",
      "masukkan transaksi 50000",
    ]
    for (const rd of rawData) {
      expect(isCasualGreetingOrChat(makeUserMsg(rd), 1)).toBe(false)
    }
  })

  it("returns false when user pastes multiline data or notes", () => {
    const multiline = `Budi beli semen 5 sak
Bambang beli pasir 1 truk
Joko bayar kasbon`
    expect(isCasualGreetingOrChat(makeUserMsg(multiline), 1)).toBe(false)
  })

  it("returns false when user has attached files", () => {
    const withFile: SessionV1.WithParts = {
      info: {
        id: "msg_user_1",
        sessionID: "ses_test",
        role: "user",
        time: { created: Date.now() },
        agent: "default",
        model: { providerID: "test" as any, modelID: "test" as any },
      },
      parts: [
        {
          id: "part_1",
          messageID: "msg_user_1",
          sessionID: "ses_test",
          type: "text",
          text: "halo",
        } as SessionV1.TextPart,
        {
          id: "part_2",
          messageID: "msg_user_1",
          sessionID: "ses_test",
          type: "file",
          filename: "data.xlsx",
          mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          url: "file:///test/data.xlsx",
        } as SessionV1.FilePart,
      ],
    }
    expect(isCasualGreetingOrChat(withFile, 1)).toBe(false)
  })

  it("returns false when step > 1 (subsequent loop turns)", () => {
    expect(isCasualGreetingOrChat(makeUserMsg("halo"), 2)).toBe(false)
    expect(isCasualGreetingOrChat(makeUserMsg("halo"), 3)).toBe(false)
  })
})
