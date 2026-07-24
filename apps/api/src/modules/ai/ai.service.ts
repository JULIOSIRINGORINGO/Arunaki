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
    this.model = this.config.get<string>('AI_MODEL') || 'nvidia/nemotron-3-ultra-550b-a55b:free';
  }

  async chat(messages: ChatMessage[]): Promise<AiResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
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

    return {
      content: choice.message.content,
      model: data.model,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };
  }

  getSystemPrompt(mode: 'chat' | 'workspace', workspaceContext?: string): string {
    const basePrompt = `You are Arunaki AI Assistant. You help users with their work.
Be helpful, professional, and concise.
Respond in the same language as the user's message.`;

    if (mode === 'workspace' && workspaceContext) {
      return `${basePrompt}

WORKSPACE CONTEXT:
${workspaceContext}

You are currently in Workspace mode. You can help analyze documents, create reports, and perform tasks related to this workspace.`;
    }

    return `${basePrompt}

You are in Chat mode. Help users with general questions, writing, brainstorming, and analysis.`;
  }
}
