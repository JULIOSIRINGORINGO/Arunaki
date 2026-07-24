import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AiResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://openrouter.ai/api/v1';
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('AI_API_KEY') || '';
    this.model =
      this.config.get<string>('AI_MODEL') ||
      'nvidia/nemotron-3-ultra-550b-a55b:free';
  }

  async chat(messages: ChatMessage[]): Promise<AiResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://arunaki.app',
        'X-Title': 'Arunaki AI Assistant',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 2048,
      }),
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

    // Strip <think>...</think> tags if model includes reasoning tags
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    // Strip internal chain-of-thought paragraphs if model leaked reasoning
    if (
      /^\s*(The user|Let's|Let me|I need|Parsing|Looking at|First,|It seems|We need|In the input|Tokens:)/i.test(
        content,
      )
    ) {
      if (content.includes('```')) {
        content = content.substring(content.indexOf('```')).trim();
      } else {
        const paragraphs = content.split(/\n\s*\n/);
        const cleanParagraphs = paragraphs.filter(
          (p: string) =>
            !/^\s*(The user|Let's|Let me|I need|Parsing|Looking at|First,|It seems|We need|In the input|Tokens:|Sizes set:|List of)/i.test(
              p.trim(),
            ),
        );
        content = cleanParagraphs.join('\n\n').trim();
      }
    }

    return {
      content,
      model: data.model,
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
    const basePrompt = `Anda adalah Arunaki AI Assistant, asisten AI profesional yang membantu pengguna menyelesaikan pekerjaan mereka secara cerdas dan akurat.
ATURAN MULTI-BAHASA: Anda WAJIB SELALU merespons dan menjawab menggunakan BAHASA YANG SAMA DENGAN PESAN PENGGUNA (Auto-Detect Language). Jika pengguna bertanya dalam Bahasa Indonesia, jawab dalam Bahasa Indonesia. Jika pengguna bertanya dalam Bahasa Inggris atau bahasa lain, jawab dalam bahasa tersebut.
DILARANG KERAS mencetak draf pemikiran internal atau proses berpikir (seperti "The user wants me to..."). Berikan langsung jawaban akhir Anda secara rapi.`;

    if (mode === 'workspace' && workspaceContext) {
      return `${basePrompt}

KONTEKS WORKSPACE:
${workspaceContext}

Anda saat ini berada dalam mode Workspace Agent.`;
    }

    return `${basePrompt}

Anda saat ini berada dalam mode AI Assistant (Chat Mode) yang terhubung dengan dokumen rujukan Knowledge Base.
${
  knowledgeContext
    ? `\n\n=== DOKUMEN ACUAN KNOWLEDGE BASE ===\n${knowledgeContext}\n=== AKHIR DOKUMEN ACUAN ===\nPatuhi dan gunakan seluruh aturan dari dokumen Knowledge Base di atas saat merespons permintaan pengguna.`
    : ''
}`;
  }
}
