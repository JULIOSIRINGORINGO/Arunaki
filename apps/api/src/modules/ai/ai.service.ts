import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { encoding_for_model } from 'tiktoken';
import * as fs from 'fs';
import * as path from 'path';
import { ProviderService } from '../provider/provider.service.js';

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface AiResponse {
  content: string;
  model: string;
  toolCalls: ToolCall[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly enc: ReturnType<typeof encoding_for_model>;

  // Fallback values from .env (used if no provider configured in DB)
  private readonly fallbackApiKey: string;
  private readonly fallbackBaseUrl: string;
  private readonly fallbackModel: string;

  constructor(
    private readonly config: ConfigService,
    private readonly providerService: ProviderService,
  ) {
    this.fallbackApiKey =
      this.config.get<string>('AI_API_KEY') || '';
    this.fallbackBaseUrl =
      this.config.get<string>('AI_BASE_URL') || 'https://openrouter.ai/api/v1';
    this.fallbackModel =
      this.config.get<string>('AI_MODEL') || 'nvidia/nemotron-3-ultra-550b-a55b:free';
    this.enc = encoding_for_model('gpt-4' as any);
  }

  /**
   * Get active provider config from DB, fallback to .env
   */
  private async getProviderConfig(): Promise<{
    apiKey: string;
    baseUrl: string;
    model: string;
    providerId?: string;
    headerPrefix?: string;
    headerTitle?: string;
  }> {
    try {
      const dbConfig = await this.providerService.getActiveConfig();
      if (dbConfig) {
        return {
          apiKey: dbConfig.apiKey,
          baseUrl: dbConfig.baseUrl.replace(/\/$/, ''),
          model: dbConfig.model,
          providerId: dbConfig.id,
          headerPrefix: dbConfig.headerPrefix,
          headerTitle: dbConfig.headerTitle,
        };
      }
    } catch (err: any) {
      this.logger.warn(`Failed to load provider from DB: ${err.message}`);
    }

    // Fallback to .env
    return {
      apiKey: this.fallbackApiKey,
      baseUrl: this.fallbackBaseUrl.replace(/\/$/, ''),
      model: this.fallbackModel,
    };
  }

  /**
   * Count tokens in a string using tiktoken
   */
  countTokens(text: string): number {
    try {
      return this.enc.encode(text).length;
    } catch {
      // Fallback: rough estimate (4 chars per token)
      return Math.ceil(text.length / 4);
    }
  }

  /**
   * Count tokens in a message array
   */
  countMessageTokens(messages: ChatMessage[]): number {
    let total = 0;
    for (const msg of messages) {
      // Per-message overhead: ~4 tokens (role, separators)
      total += 4;
      if (msg.content) {
        total += this.countTokens(msg.content);
      }
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          total += this.countTokens(tc.function.name);
          total += this.countTokens(tc.function.arguments);
        }
      }
    }
    return total;
  }

  /**
   * Prune large tool results to save context space.
   * Replaces content > maxChars with a summary placeholder.
   */
  pruneToolResults(messages: ChatMessage[], maxChars = 2000): ChatMessage[] {
    return messages.map((msg) => {
      if (msg.role === 'tool' && msg.content && msg.content.length > maxChars) {
        const preview = msg.content.substring(0, 500);
        return {
          ...msg,
          content: `[Tool output dipangkas: ${msg.content.length} chars → 500 chars preview]\n${preview}\n...[dipotong]`,
        };
      }
      return msg;
    });
  }

  /**
   * Truncate history to fit within token budget.
   * Keeps: system message + last N messages within budget.
   */
  truncateHistory(
    messages: ChatMessage[],
    maxTokens: number,
  ): ChatMessage[] {
    if (messages.length === 0) return messages;

    const systemMessages: ChatMessage[] = [];
    const otherMessages: ChatMessage[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemMessages.push(msg);
      } else {
        otherMessages.push(msg);
      }
    }

    // System messages always stay
    const systemTokens = this.countMessageTokens(systemMessages);
    const budget = maxTokens - systemTokens;

    if (budget <= 0) {
      this.logger.warn('System messages exceed token budget, returning only system');
      return systemMessages;
    }

    // Keep most recent messages within budget
    const kept: ChatMessage[] = [];
    let usedTokens = 0;

    for (let i = otherMessages.length - 1; i >= 0; i--) {
      const msgTokens = this.countTokens(otherMessages[i].content || '');
      if (usedTokens + msgTokens > budget) break;
      usedTokens += msgTokens;
      kept.unshift(otherMessages[i]);
    }

    const totalMessages = systemMessages.length + kept.length;
    this.logger.log(
      `Context truncated: ${messages.length} → ${totalMessages} messages (${systemMessages.length} system + ${kept.length} history)`,
    );

    return [...systemMessages, ...kept];
  }

  /**
   * Prepare messages for API call with context management.
   * - Prunes large tool results
   * - Truncates history if needed
   */
  prepareMessages(
    messages: ChatMessage[],
    maxContextTokens = 120000,
  ): ChatMessage[] {
    // Step 1: Prune large tool results
    let prepared = this.pruneToolResults(messages);

    // Step 2: Check token count and truncate if needed
    const tokenCount = this.countMessageTokens(prepared);
    if (tokenCount > maxContextTokens) {
      this.logger.warn(
        `Context too large: ${tokenCount} tokens (max: ${maxContextTokens}). Truncating...`,
      );
      prepared = this.truncateHistory(prepared, maxContextTokens);
    }

    return prepared;
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    timeoutMs = 60000,
    maxRetries = 3,
  ): Promise<Response> {
    let attempt = 0;
    while (attempt < maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);

        if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          this.logger.warn(
            `AI request HTTP ${res.status}. Attempt ${attempt}/${maxRetries}. Retrying in ${backoffMs}ms...`,
          );
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }
        return res;
      } catch (err: any) {
        clearTimeout(timeoutId);
        const isAbort = err.name === 'AbortError';
        const errMsg = isAbort
          ? `Request timed out after ${timeoutMs}ms`
          : err.message;

        if (attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          this.logger.warn(
            `AI request error (${errMsg}). Attempt ${attempt}/${maxRetries}. Retrying in ${backoffMs}ms...`,
          );
          await new Promise((r) => setTimeout(r, backoffMs));
        } else {
          throw new Error(
            `AI request failed after ${maxRetries} attempts: ${errMsg}`,
          );
        }
      }
    }
    throw new Error(`AI request failed after ${maxRetries} attempts.`);
  }

  async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
  ): Promise<AiResponse> {
    // Get provider config from DB (or .env fallback)
    const provider = await this.getProviderConfig();

    if (!provider.apiKey) {
      throw new Error('No API key configured. Go to Settings → AI Models to add a provider.');
    }

    // Apply context management: prune large outputs + truncate if needed
    const preparedMessages = this.prepareMessages(messages);

    const body: Record<string, any> = {
      model: provider.model,
      messages: preparedMessages,
      temperature: 0.7,
      max_tokens: 4096,
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    // Build headers — support custom headers per provider
    const headers: Record<string, string> = {
      Authorization: `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
    };

    // OpenRouter requires HTTP-Referer
    if (provider.baseUrl.includes('openrouter.ai')) {
      headers['HTTP-Referer'] = 'https://arunaki.app';
      headers['X-Title'] = 'Arunaki AI Assistant';
    }

    // Custom headers from provider config
    if (provider.headerPrefix) {
      headers['HTTP-Referer'] = provider.headerPrefix;
    }
    if (provider.headerTitle) {
      headers['X-Title'] = provider.headerTitle;
    }

    const response = await this.fetchWithRetry(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`AI API error (${provider.baseUrl}): ${response.status} - ${error}`);

      // Record error for the provider
      if (provider.providerId) {
        await this.providerService.recordError(
          provider.providerId,
          `HTTP ${response.status}: ${error.substring(0, 200)}`,
        ).catch(() => {});
      }

      throw new Error(`AI request failed: ${response.status}`);
    }

    // Record successful usage
    if (provider.providerId) {
      await this.providerService.recordUsage(provider.providerId).catch(() => {});
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    if (!choice) {
      throw new Error('No response from AI');
    }

    let content = choice.message?.content || '';
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    if (!content && choice.message?.tool_calls?.length === 0) {
      content =
        'Maaf, saya tidak dapat memberikan jawaban saat ini. Silakan coba lagi.';
    }

    return {
      content,
      model: data.model,
      toolCalls: choice.message?.tool_calls || [],
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };
  }

  /**
   * Load a prompt file from the prompts directory.
   */
  private loadPrompt(filename: string): string {
    try {
      const promptsDir = path.join(__dirname, '..', '..', '..', 'prompts');
      const filePath = path.join(promptsDir, filename);
      return fs.readFileSync(filePath, 'utf-8').trim();
    } catch (err: any) {
      this.logger.error(`Failed to load prompt file "${filename}": ${err.message}`);
      return `<!-- Failed to load ${filename} -->`;
    }
  }

  getSystemPrompt(
    mode: 'chat' | 'workspace',
    workspaceContext?: string,
    knowledgeContext?: string,
  ): string {
    const basePrompt = `You are Arunaki AI Assistant.
Use the same language as the user's message.
Do not display internal reasoning.
You are a friendly, informative, and professional assistant.
Always greet the user and provide complete answers with context.`;

    if (mode === 'workspace' && workspaceContext) {
      // Load modular prompt files
      const identity = this.loadPrompt('identity.md');
      const rules = this.loadPrompt('rules.md');
      const workspaceRules = this.loadPrompt('workspace-rules.md');
      const workspaceFlow = this.loadPrompt('workspace-flow.md');
      const verification = this.loadPrompt('verification.md');
      const memoryContext = this.loadPrompt('memory-context.md');

      return `${identity}

${workspaceContext}

${rules}

${workspaceRules}

${workspaceFlow}

${memoryContext}

${verification}`;
    }

    return `${basePrompt}

=== KNOWLEDGE BASE ===
${knowledgeContext}
=== END KNOWLEDGE BASE ===

ATURAN:
1. Knowledge Base adalah referensi DATA, ATURAN, dan FORMAT OUTPUT perusahaan.
2. Ikuti format output yang ditulis di Knowledge Base — termasuk cara menyapa, struktur jawaban, dan format data.
3. Gunakan tools jika tersedia dan diperlukan (web_search untuk info internet real-time, vision_ai untuk baca foto nota/struk, calculate untuk kalkulasi numerik, generate_export untuk file).
4. Jika informasi tidak ada di Knowledge Base, katakan dengan jelas.

=== KECERDASAN PROAKTIF (PROACTIVE INTELLIGENCE) ===
1. Deteksi Ambigu & Duplikat: Jika input pengguna memiliki data yang mirip, duplikat, atau kurang jelas, jawab dengan ramah, sebutkan rekap yang berhasil diolah, lalu sertakan poin konfirmasi singkat.
2. Respons Otomatis & Terstruktur: Jika pengguna mengirimkan daftar pesanan/harga/data angka, otomatis sajikan rekapnya secara rapi agar muncul bersih di Canvas Panel.
3. Rekomendasi Ekspor: Jika rekap data sudah rapi dan final, tawarkan dengan ramah untuk mengunduhnya ke file Excel, PDF, atau Word.
=== END KECERDASAN PROAKTIF ===

=== KNOWLEDGE TUNING ===
Jika user memberikan feedback tentang format/cara jawab (contoh: "gini dong formatnya", "kurang pas, harusnya gini..."), lakukan:

1. Pahami perubahan yang diminta user.
2. Baca Knowledge Base yang sedang aktif.
3. Update Knowledge Base sesuai arahan user menggunakan tool save_knowledge (judul tetap sama, konten diupdate).
4. Konfirmasi ke user bahwa knowledge sudah diupdate, lalu tampilkan contoh hasil baru.

Contoh respons:
"Oke, sudah saya update knowledge-nya. Berikut contoh hasil baru: [tampilkan contoh]"

PENTING: Selalu update knowledge yang SUDAH ADA, jangan buat baru kecuali user minta.
=== END KNOWLEDGE TUNING ===

=== KNOWLEDGE BUILDER MODE ===
Ketika user mengirim pesan yang diawali dengan "/knowledge", masuk ke Knowledge Builder Mode.

Flow Knowledge Builder:
1. Tanyakan informasi dasar bisnis:
   - Nama bisnis/perusahaan
   - Jenis/lini bisnis (contoh: garment, restaurant, retail, finance, dll)
   - Deskripsi singkat bisnis

2. Setelah mendapat informasi dasar, generate template knowledge dalam format markdown:
   - Struktur harus sesuai dengan jenis bisnis
   - Contoh untuk garment: harga kain, ukuran, warna, minimal order
   - Contoh untuk restaurant: menu, harga, bahan, ukuran porsi
   - Contoh untuk retail: produk, harga, stok, satuan

3. Tampilkan template di chat untuk review user.

4. Jika user minta perubahan, update template sesuai permintaan.

5. Ketika user puas dan minta "simpan" atau "save", gunakan tool save_knowledge untuk menyimpan ke database.

6. Setelah tersimpan, tawarkan untuk export ke PDF/MD/Excel jika diperlukan.

Format template knowledge:
\`\`\`markdown
# [Nama Bisnis]

## Informasi Bisnis
- Jenis: [jenis bisnis]
- Deskripsi: [deskripsi]

## [Kategori 1 sesuai jenis bisnis]
| Kolom 1 | Kolom 2 | Kolom 3 |
|---------|---------|---------|
| Data    | Data    | Data    |

## [Kategori 2 sesuai jenis bisnis]
- Item 1: detail
- Item 2: detail
\`\`\`

Penting:
- Template harus RELEVAN dengan jenis bisnis yang disebutkan
- Gunakan pengetahuan umum tentang industri tersebut
- Minta user untuk detail spesifik perusahaan mereka
- Selalu tampilkan preview sebelum menyimpan

Setelah template selesai dan user sudah review/revise, WAJIB tampilkan pilihan aksi dengan format:
\`\`\`
Knowledge sudah siap! Pilih format export:

1. PDF
2. Markdown (.md)
3. Jawaban sendiri (ketik sendiri)
\`\`\`

Saat user memilih (kecuali "jawaban sendiri"), otomatis:
- Simpan ke Knowledge Base (save_knowledge)
- Generate file sesuai pilihan (generate_export)

Tunggu user memilih sebelum lanjut. Jangan asumsikan user ingin simpan tanpa konfirmasi.
=== END KNOWLEDGE BUILDER MODE ===`;
  }
}
