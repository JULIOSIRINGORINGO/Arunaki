import path from "path";
import fs from "fs/promises";
import { Global } from "@arunaki/core/global";
import { ServerAuth } from "../server/auth";

export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  allowedUserId: string; // comma-separated user IDs or @usernames, or "*"
  targetFolder?: string; // folder where Arunaki executes document operations
}

export interface MessagingConfig {
  telegram: TelegramConfig;
}

export interface TelegramStatus {
  connected: boolean;
  botUsername?: string | null;
  botFirstName?: string | null;
  lastActive?: number | null;
  lastError?: string | null;
}

export interface MessagingStatus {
  telegram: TelegramStatus;
}

export interface TestResult {
  success: boolean;
  botUsername?: string;
  botFirstName?: string;
  error?: string;
}

const DEFAULT_CONFIG: MessagingConfig = {
  telegram: {
    enabled: false,
    botToken: "",
    allowedUserId: "",
    targetFolder: "",
  },
};

/**
 * Checks whether an incoming sender is permitted based on the configured whitelist.
 */
export function isSenderAllowed(whitelist: string, senderId: string, senderUsername?: string): boolean {
  if (!whitelist) return false;
  const trimmed = whitelist.trim();
  if (trimmed === "*") return true;
  if (!trimmed) return false;

  const allowedItems = trimmed
    .split(",")
    .map((item) => item.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);

  const cleanSenderId = senderId.trim().toLowerCase();
  const cleanUsername = senderUsername ? senderUsername.trim().toLowerCase().replace(/^@/, "") : "";

  return allowedItems.includes(cleanSenderId) || (cleanUsername !== "" && allowedItems.includes(cleanUsername));
}

/**
 * Splits a long text message into safe chunks for Telegram (max 4096 chars, default 4000 chars).
 */
export function splitTelegramMessage(text: string, maxLength = 4000): string[] {
  if (!text) return [];
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    let splitIndex = remaining.lastIndexOf("\n\n", maxLength);
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = remaining.lastIndexOf("\n", maxLength);
    }
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = remaining.lastIndexOf(" ", maxLength);
    }
    if (splitIndex === -1 || splitIndex === 0) {
      splitIndex = maxLength;
    }

    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  return chunks.filter(Boolean);
}

export function normalizeFolderPath(dir: string): string {
  if (!dir) return "";
  let normalized = path.normalize(dir).replace(/\\/g, "/");
  normalized = normalized.replace(/\/+/g, "/");
  if (normalized.length > 3 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * Robustly extracts assistant response text and tool execution summary from engine message.
 */
export function extractAssistantReply(messageData: any): string {
  if (!messageData) return "";
  const content = messageData.content || messageData.parts || [];
  const texts: string[] = [];
  const tools: string[] = [];

  if (Array.isArray(content)) {
    for (const item of content) {
      if (item.type === "text" && item.text && typeof item.text === "string") {
        texts.push(item.text.trim());
      } else if (item.type === "tool" || item.name) {
        const name = item.name || item.tool || "action";
        const file = item.state?.input?.path || item.state?.input?.filepath || "";
        tools.push(file ? `${name} (${file})` : name);
      }
    }
  } else if (typeof content === "string" && content.trim()) {
    texts.push(content.trim());
  }

  if (texts.length > 0) {
    return texts.join("\n\n");
  }

  if (tools.length > 0) {
    return "✅ Berhasil memproses dokumen:\n" + tools.map((t) => `• ${t}`).join("\n");
  }

  return "";
}

export class TelegramService {
  private static instance: TelegramService | null = null;

  private running = false;
  private abortController: AbortController | null = null;
  private chatSessionMap = new Map<number, string>();
  private activeFolderSessionMap = new Map<string, string>();
  private status: TelegramStatus = {
    connected: false,
    botUsername: null,
    botFirstName: null,
    lastActive: null,
    lastError: null,
  };

  private constructor() {}

  public static getInstance(): TelegramService {
    if (!TelegramService.instance) {
      TelegramService.instance = new TelegramService();
    }
    return TelegramService.instance;
  }

  public setActiveSession(directory: string, sessionID: string): void {
    if (!directory || !sessionID) return;
    const clean = normalizeFolderPath(directory);
    this.activeFolderSessionMap.set(clean, sessionID);
  }

  private getConfigFilePath(): string {
    return path.join(Global.Path.data, "messaging.json");
  }

  public async getConfig(): Promise<MessagingConfig> {
    try {
      const filePath = this.getConfigFilePath();
      const content = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(content);
      return {
        telegram: {
          enabled: Boolean(parsed?.telegram?.enabled),
          botToken: String(parsed?.telegram?.botToken || ""),
          allowedUserId: String(parsed?.telegram?.allowedUserId || ""),
          targetFolder: parsed?.telegram?.targetFolder ? normalizeFolderPath(String(parsed.telegram.targetFolder)) : "",
        },
      };
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  public async saveConfig(newConfig: MessagingConfig): Promise<MessagingConfig> {
    const configToSave: MessagingConfig = {
      telegram: {
        enabled: Boolean(newConfig.telegram?.enabled),
        botToken: String(newConfig.telegram?.botToken || "").trim(),
        allowedUserId: String(newConfig.telegram?.allowedUserId || "").trim(),
        targetFolder: newConfig.telegram?.targetFolder ? normalizeFolderPath(String(newConfig.telegram.targetFolder)) : "",
      },
    };

    const filePath = this.getConfigFilePath();
    await fs.writeFile(filePath, JSON.stringify(configToSave, null, 2), "utf-8");

    // Hot reload service loop
    await this.restart();
    return configToSave;
  }

  public getStatus(): MessagingStatus {
    return {
      telegram: {
        connected: Boolean(this.status.connected),
        botUsername: this.status.botUsername ?? null,
        botFirstName: this.status.botFirstName ?? null,
        lastActive: this.status.lastActive ?? null,
        lastError: this.status.lastError ?? null,
      },
    };
  }

  public async testToken(botToken: string): Promise<TestResult> {
    const token = botToken.trim();
    if (!token) {
      return { success: false, error: "Bot token is empty." };
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
        signal: AbortSignal.timeout(10000),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        return {
          success: false,
          error: data.description || `HTTP ${res.status}: Failed to authenticate with Telegram.`,
        };
      }

      return {
        success: true,
        botUsername: data.result?.username,
        botFirstName: data.result?.first_name,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || "Network error while connecting to Telegram API.",
      };
    }
  }

  public async startIfEnabled(): Promise<void> {
    const config = await this.getConfig();
    if (config.telegram.enabled && config.telegram.botToken) {
      await this.start();
    }
  }

  public async start(): Promise<void> {
    if (this.running) return;

    const config = await this.getConfig();
    if (!config.telegram.enabled || !config.telegram.botToken) {
      this.status.connected = false;
      return;
    }

    // Validate bot token
    const test = await this.testToken(config.telegram.botToken);
    if (!test.success) {
      this.status.connected = false;
      this.status.lastError = test.error || "Invalid token";
      return;
    }

    this.running = true;
    this.abortController = new AbortController();
    this.status.connected = true;
    this.status.botUsername = test.botUsername || null;
    this.status.botFirstName = test.botFirstName || null;
    this.status.lastError = null;

    // Launch polling loop in background
    this.pollLoop(this.abortController.signal).catch((err) => {
      this.status.connected = false;
      this.status.lastError = err?.message || String(err);
      this.running = false;
    });
  }

  public async stop(): Promise<void> {
    this.running = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.status.connected = false;
  }

  public async restart(): Promise<void> {
    await this.stop();
    await this.startIfEnabled();
  }

  private getLocalServerUrl(): string {
    try {
      // Dynamically resolve Server.url if running inside engine
      // oxlint-disable-next-line @typescript-eslint/no-var-requires
      const { url } = require("../server/server");
      if (url) return url.toString().replace(/\/$/, "");
    } catch {}
    return "http://127.0.0.1:4096";
  }

  private async sendTelegramMessage(
    botToken: string,
    chatId: number | string,
    text: string,
    replyToMessageId?: number
  ): Promise<boolean> {
    try {
      // First attempt with Markdown formatting
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "Markdown",
          ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
        }),
      });

      if (res.ok) return true;

      // If Markdown parsing fails, fall back to plain text
      const fallbackRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
        }),
      });

      return fallbackRes.ok;
    } catch {
      return false;
    }
  }

  private async sendChatAction(botToken: string, chatId: number | string, action = "typing"): Promise<void> {
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, action }),
      });
    } catch {}
  }

  private async pollLoop(signal: AbortSignal): Promise<void> {
    let offset = 0;

    while (this.running && !signal.aborted) {
      const config = await this.getConfig();
      if (!config.telegram.enabled || !config.telegram.botToken) {
        this.status.connected = false;
        break;
      }

      try {
        const fetchUrl = `https://api.telegram.org/bot${config.telegram.botToken}/getUpdates?offset=${offset}&timeout=25`;
        const res = await fetch(fetchUrl, {
          signal: AbortSignal.any([signal, AbortSignal.timeout(35000)]),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          this.status.lastError = `Telegram error: HTTP ${res.status} ${errText}`;
          await new Promise((r) => setTimeout(r, 4000));
          continue;
        }

        const data = await res.json();
        if (!data.ok || !Array.isArray(data.result)) {
          this.status.lastError = data.description || "Invalid getUpdates response format.";
          await new Promise((r) => setTimeout(r, 4000));
          continue;
        }

        this.status.connected = true;
        this.status.lastError = null;

        for (const update of data.result) {
          offset = Math.max(offset, update.update_id + 1);

          const message = update.message;
          if (!message) continue;

          const text = (message.text || message.caption || "").trim();
          if (!text) continue;

          this.status.lastActive = Date.now();
          await this.handleIncomingMessage(config, message, text);
        }
      } catch (err: any) {
        if (signal.aborted) break;
        this.status.lastError = err?.message || String(err);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  private async handleIncomingMessage(
    config: MessagingConfig,
    message: any,
    text: string
  ): Promise<void> {
    const senderId = String(message.from?.id ?? "");
    const senderUsername = message.from?.username ? String(message.from.username).toLowerCase() : "";
    const senderName = message.from?.first_name || senderUsername || senderId;
    const chatId = message.chat.id;
    const botToken = config.telegram.botToken;

    // 1. Whitelist Verification
    const isAllowed = isSenderAllowed(config.telegram.allowedUserId, senderId, senderUsername);
    if (!isAllowed) {
      const unauthorizedMsg =
        `⚠️ *Akses Ditolak / Unauthorized*\n\n` +
        `Telegram User ID Anda: \`${senderId}\`\n` +
        `Username: @${senderUsername || "tidak ada"}\n\n` +
        `Untuk mengizinkan akses kendali ke Arunaki di PC, tambahkan User ID Anda ke:\n` +
        `⚙️ *Arunaki Settings -> Messaging Apps* pada whitelist User ID.`;

      await this.sendTelegramMessage(botToken, chatId, unauthorizedMsg, message.message_id);
      return;
    }

    // 2. Command Handling
    if (text === "/start" || text === "/help") {
      const targetDir = config.telegram.targetFolder || "Default Project Workspace";
      const welcomeMsg =
        `👋 *Halo ${senderName}! Arunaki Gateway siap melayani.*\n\n` +
        `Kirimkan instruksi dokumen, catatan mentah, atau forward pesan WhatsApp ke bot ini. ` +
        `Arunaki di komputer Anda akan otomatis mengeksekusinya langsung di folder proyek aktif.\n\n` +
        `📁 *Target Folder:* \`${targetDir}\`\n\n` +
        `*Perintah yang tersedia:*\n` +
        `• Kirim teks langsung (contoh: _"rekap data berikut ke excel: ..."_)\n` +
        `• \`/new\` — Reset / mulai sesi percakapan baru\n` +
        `• \`/status\` — Cek status Arunaki dan folder kerja saat ini\n` +
        `• \`/help\` — Panduan bantuan`;

      await this.sendTelegramMessage(botToken, chatId, welcomeMsg, message.message_id);
      return;
    }

    if (text === "/new" || text === "/reset") {
      this.chatSessionMap.delete(chatId);
      await this.sendTelegramMessage(
        botToken,
        chatId,
        `🔄 *Sesi baru dimulai.* Silakan kirim instruksi dokumen Anda selanjutnya.`,
        message.message_id
      );
      return;
    }

    if (text === "/status") {
      const rawTargetDir = config.telegram.targetFolder || process.cwd();
      const targetDir = normalizeFolderPath(rawTargetDir);
      const statusMsg =
        `🟢 *Arunaki Gateway Status: Online*\n\n` +
        `💻 *Host:* PC Desktop Aktif\n` +
        `📁 *Target Folder:* \`${targetDir}\`\n` +
        `👤 *Pengguna Terotorisasi:* ${senderName} (\`${senderId}\`)\n` +
        `🤖 *Bot:* @${this.status.botUsername || "connected"}`;

      await this.sendTelegramMessage(botToken, chatId, statusMsg, message.message_id);
      return;
    }

    // 3. Document / Chat Instruction Execution
    await this.sendChatAction(botToken, chatId, "typing");

    // Continuous typing indicator interval while Arunaki processes
    const typingInterval = setInterval(() => {
      this.sendChatAction(botToken, chatId, "typing");
    }, 4000);

    try {
      const reply = await this.executeArunakiPrompt(config, chatId, text, senderName);
      clearInterval(typingInterval);

      // Split and send chunks if response exceeds Telegram max message length
      const chunks = splitTelegramMessage(reply);
      for (let i = 0; i < chunks.length; i++) {
        await this.sendTelegramMessage(
          botToken,
          chatId,
          chunks[i],
          i === 0 ? message.message_id : undefined
        );
      }
    } catch (err: any) {
      clearInterval(typingInterval);
      await this.sendTelegramMessage(
        botToken,
        chatId,
        `❌ *Gagal memproses permintaan:*\n${err?.message || String(err)}`,
        message.message_id
      );
    }
  }

  private async executeArunakiPrompt(
    config: MessagingConfig,
    chatId: number,
    promptText: string,
    senderName: string
  ): Promise<string> {
    const serverUrl = this.getLocalServerUrl();
    const rawTargetDir = config.telegram.targetFolder || process.cwd();
    const targetDir = normalizeFolderPath(rawTargetDir);
    const authHeaders = ServerAuth.headers() || {};

    // 1. Session Discovery: Prefer active desktop workstation session for this folder
    let sessionID = this.activeFolderSessionMap.get(targetDir);

    if (!sessionID) {
      sessionID = this.chatSessionMap.get(chatId);
    }

    // Verify cached session is still active and valid in the engine
    if (sessionID) {
      try {
        const checkRes = await fetch(`${serverUrl}/api/session/${sessionID}?directory=${encodeURIComponent(targetDir)}`, {
          headers: { "x-arunaki-directory": targetDir, ...authHeaders },
        });
        if (!checkRes.ok) {
          sessionID = undefined;
          this.chatSessionMap.delete(chatId);
        }
      } catch {
        sessionID = undefined;
        this.chatSessionMap.delete(chatId);
      }
    }

    // If still no session, connect to the most recently active session of targetDir
    if (!sessionID) {
      try {
        const listRes = await fetch(`${serverUrl}/api/session?directory=${encodeURIComponent(targetDir)}&limit=1`, {
          headers: { "x-arunaki-directory": targetDir, ...authHeaders },
        });
        if (listRes.ok) {
          const listJson = await listRes.json();
          const sessions = listJson?.data || listJson;
          if (Array.isArray(sessions) && sessions.length > 0 && sessions[0]?.id) {
            sessionID = sessions[0].id;
            this.chatSessionMap.set(chatId, sessionID);
          }
        }
      } catch (err) {
        console.warn("[TelegramGateway] Could not check existing sessions:", err);
      }
    }

    // If still no session exists (brand new project folder), create a new one
    if (!sessionID) {
      const snippet = promptText.length > 30 ? promptText.slice(0, 30) + "..." : promptText;
      const createRes = await fetch(`${serverUrl}/api/session?directory=${encodeURIComponent(targetDir)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-arunaki-directory": targetDir,
          ...authHeaders,
        },
        body: JSON.stringify({
          title: `Telegram (${senderName}): ${snippet}`,
          location: { directory: targetDir },
        }),
      });

      if (!createRes.ok) {
        const errText = await createRes.text().catch(() => "");
        throw new Error(`Failed to create Arunaki session: ${createRes.status} ${errText}`);
      }

      const sessionJson = await createRes.json();
      sessionID = sessionJson?.data?.id || sessionJson?.id;
      if (sessionID) {
        this.chatSessionMap.set(chatId, sessionID);
      } else {
        throw new Error("Invalid session response from Arunaki engine.");
      }
    }

    // 2. Send prompt to session (engine route is POST /api/session/:sessionID/prompt)
    const promptStartTime = Date.now();
    let promptRes = await fetch(
      `${serverUrl}/api/session/${sessionID}/prompt?directory=${encodeURIComponent(targetDir)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-arunaki-directory": targetDir,
          ...authHeaders,
        },
        body: JSON.stringify({
          prompt: { text: promptText },
        }),
      }
    );

    // If session was invalid / 404, retry once with a brand new session
    if (promptRes.status === 404) {
      this.chatSessionMap.delete(chatId);
      this.activeFolderSessionMap.delete(targetDir);
      return this.executeArunakiPrompt(config, chatId, promptText, senderName);
    }

    if (!promptRes.ok) {
      const errBody = await promptRes.text().catch(() => "");
      throw new Error(`Session execution error: ${promptRes.status} ${errBody}`);
    }

    // 3. Poll for Assistant Reply
    // Arunaki v2 executes the agent loop asynchronously. Wait for completion up to 90 seconds.
    let reply = "";
    const pollIntervalMs = 1200;
    const maxPollAttempts = 75; // ~90 seconds
    let typingTick = 0;

    for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
      await new Promise((r) => setTimeout(r, pollIntervalMs));
      typingTick++;
      if (typingTick % 3 === 0) {
        this.sendChatAction(config.telegram.botToken, chatId, "typing").catch(() => {});
      }

      try {
        const msgsRes = await fetch(
          `${serverUrl}/api/session/${sessionID}/message?limit=10&directory=${encodeURIComponent(targetDir)}`,
          {
            headers: { "x-arunaki-directory": targetDir, ...authHeaders },
          }
        );
        if (!msgsRes.ok) continue;

        const msgsJson = await msgsRes.json();
        const msgs: any[] = msgsJson?.data || msgsJson;
        if (!Array.isArray(msgs) || msgs.length === 0) continue;

        // Find the newest assistant message created after our prompt
        const newest = msgs[0];
        if (newest && (newest.type === "assistant" || newest.role === "assistant")) {
          const assistantReply = extractAssistantReply(newest);
          if (assistantReply && assistantReply.trim().length > 0) {
            reply = assistantReply;
            break;
          }
        }
      } catch (err) {
        console.warn("[TelegramGateway] Polling error:", err);
      }
    }

    // Auto-update generic session title to clean snippet if needed
    try {
      const snippet = promptText.length > 35 ? promptText.slice(0, 35) + "..." : promptText;
      fetch(`${serverUrl}/api/session/${sessionID}?directory=${encodeURIComponent(targetDir)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-arunaki-directory": targetDir,
          ...authHeaders,
        },
        body: JSON.stringify({ title: `Telegram: ${snippet}` }),
      }).catch(() => {});
    } catch {}

    if (!reply) {
      reply = "✅ Permintaan telah diproses oleh Arunaki di komputer Anda.";
    }

    return reply;
  }
}

export const telegramService = TelegramService.getInstance();
