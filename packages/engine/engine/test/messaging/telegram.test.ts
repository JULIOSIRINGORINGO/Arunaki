import { describe, expect, test } from "bun:test";
import {
  isSenderAllowed,
  splitTelegramMessage,
  telegramService,
  normalizeFolderPath,
  extractAssistantReply,
} from "../../src/messaging/telegram";

describe("Telegram BYOB Gateway", () => {
  describe("isSenderAllowed (Whitelist Check)", () => {
    test("rejects when whitelist is empty or whitespace", () => {
      expect(isSenderAllowed("", "123456")).toBe(false);
      expect(isSenderAllowed("   ", "123456")).toBe(false);
      expect(isSenderAllowed("", "123456", "myuser")).toBe(false);
    });

    test("allows anyone when wildcard * is used", () => {
      expect(isSenderAllowed("*", "999999")).toBe(true);
      expect(isSenderAllowed("*", "123456", "random_user")).toBe(true);
    });

    test("matches numeric telegram user ID", () => {
      const whitelist = "123456789, 987654321";
      expect(isSenderAllowed(whitelist, "123456789")).toBe(true);
      expect(isSenderAllowed(whitelist, "987654321")).toBe(true);
      expect(isSenderAllowed(whitelist, "555555555")).toBe(false);
    });

    test("matches username with or without @ symbol (case-insensitive)", () => {
      const whitelist = "123456789, @juliosiringo, admin_user";
      expect(isSenderAllowed(whitelist, "000", "juliosiringo")).toBe(true);
      expect(isSenderAllowed(whitelist, "000", "@juliosiringo")).toBe(true);
      expect(isSenderAllowed(whitelist, "000", "JulioSiringo")).toBe(true);
      expect(isSenderAllowed(whitelist, "000", "Admin_User")).toBe(true);
      expect(isSenderAllowed(whitelist, "000", "hacker")).toBe(false);
    });
  });

  describe("splitTelegramMessage", () => {
    test("returns single element if message fits within limit", () => {
      const short = "Hello Arunaki! Rekap excel berhasil.";
      expect(splitTelegramMessage(short, 4000)).toEqual([short]);
    });

    test("splits message into chunks respecting double newlines", () => {
      const para1 = "Paragraph 1: " + "a".repeat(100);
      const para2 = "Paragraph 2: " + "b".repeat(100);
      const text = `${para1}\n\n${para2}`;

      const chunks = splitTelegramMessage(text, 150);
      expect(chunks.length).toBe(2);
      expect(chunks[0]).toBe(para1);
      expect(chunks[1]).toBe(para2);
    });

    test("handles empty string gracefully", () => {
      expect(splitTelegramMessage("", 4000)).toEqual([]);
    });
  });

  describe("TelegramService instance", () => {
    test("provides singleton instance with initial disconnected status", () => {
      const instance = telegramService;
      expect(instance).toBeDefined();

      const status = instance.getStatus();
      expect(status.telegram).toBeDefined();
      expect(status.telegram.connected).toBe(false);
    });

    test("returns default config when no config exists", async () => {
      const config = await telegramService.getConfig();
      expect(config.telegram).toBeDefined();
      expect(typeof config.telegram.enabled).toBe("boolean");
      expect(typeof config.telegram.botToken).toBe("string");
      expect(typeof config.telegram.allowedUserId).toBe("string");
    });
  });

  describe("normalizeFolderPath", () => {
    test("normalizes Windows backslashes and double backslashes", () => {
      expect(normalizeFolderPath("E:\\\\REKAPAN")).toBe("E:/REKAPAN");
      expect(normalizeFolderPath("E:\\REKAPAN\\")).toBe("E:/REKAPAN");
      expect(normalizeFolderPath("E:/REKAPAN//")).toBe("E:/REKAPAN");
      expect(normalizeFolderPath("")).toBe("");
    });
  });

  describe("extractAssistantReply", () => {
    test("extracts text from content array", () => {
      const msg = {
        content: [
          { type: "reasoning", text: "Thinking..." },
          { type: "text", text: "Halo! Ada yang bisa saya bantu?" },
        ],
      };
      expect(extractAssistantReply(msg)).toBe("Halo! Ada yang bisa saya bantu?");
    });

    test("extracts text from legacy parts array", () => {
      const msg = {
        parts: [
          { type: "text", text: "Rekap berhasil diselesaikan." },
        ],
      };
      expect(extractAssistantReply(msg)).toBe("Rekap berhasil diselesaikan.");
    });

    test("extracts tool summary if only tools were executed without text", () => {
      const msg = {
        content: [
          {
            type: "tool",
            name: "edit_file",
            state: { input: { path: "ORDER.txt" } },
          },
        ],
      };
      expect(extractAssistantReply(msg)).toContain("edit_file (ORDER.txt)");
    });

    test("handles empty or malformed message safely", () => {
      expect(extractAssistantReply(null)).toBe("");
      expect(extractAssistantReply({})).toBe("");
    });
  });
});
