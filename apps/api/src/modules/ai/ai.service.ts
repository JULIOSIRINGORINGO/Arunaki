import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
  private readonly apiKey: string;
  private readonly baseUrl = 'https://openrouter.ai/api/v1';
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey =
      this.config.get<string>('OPENROUTER_API_KEY') ||
      this.config.get<string>('AI_API_KEY') ||
      '';
    this.model =
      this.config.get<string>('OPENROUTER_MODEL') ||
      this.config.get<string>('AI_MODEL') ||
      'nvidia/nemotron-3-ultra-550b-a55b:free';
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
    const body: Record<string, any> = {
      model: this.model,
      messages,
      temperature: 0.7,
      max_tokens: 4096,
    };

    if (tools && tools.length > 0) {
      body.tools = tools;
    }

    const response = await this.fetchWithRetry(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://arunaki.app',
        'X-Title': 'Arunaki AI Assistant',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`OpenRouter API error: ${response.status} - ${error}`);
      throw new Error(`AI request failed: ${response.status}`);
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

  getSystemPrompt(
    mode: 'chat' | 'workspace',
    workspaceContext?: string,
    knowledgeContext?: string,
  ): string {
    const basePrompt = `Anda adalah Arunaki AI Assistant.
Gunakan bahasa yang sama dengan pesan pengguna.
Jangan tampilkan pemikiran internal.
Anda adalah asisten yang ramah, informatif, dan profesional.
Selalu sapa pengguna dan berikan jawaban yang lengkap dengan konteks.`;

    if (mode === 'workspace' && workspaceContext) {
      return `${basePrompt}

KONTEKS WORKSPACE:
${workspaceContext}

Mode: Workspace Agent.`;
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
