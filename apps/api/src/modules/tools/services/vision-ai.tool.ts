import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

@Injectable()
export class VisionAiTool {
  private readonly logger = new Logger(VisionAiTool.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://openrouter.ai/api/v1';
  private readonly visionModel: string;
  private readonly sdk: any;

  constructor(private readonly config?: ConfigService) {
    this.apiKey = this.config?.get<string>('AI_API_KEY') || process.env.AI_API_KEY || '';
    this.visionModel =
      this.config?.get<string>('VISION_MODEL') || process.env.VISION_MODEL || 'google/gemini-2.0-flash-001';
      
    this.sdk = createOpenAI({
      baseURL: this.baseUrl,
      apiKey: this.apiKey,
      headers: {
        'HTTP-Referer': 'https://arunaki.app',
        'X-Title': 'Arunaki Vision AI',
      },
    });
  }

  async analyzeImage(
    imageSource: string,
    prompt: string = 'Ekstrak semua teks, data tabel, angka, dan informasi penting dari gambar ini.',
  ): Promise<ToolResult> {
    const startTime = Date.now();
    try {
      if (!imageSource) {
        return {
          status: 'error',
          data: {},
          preview: 'Path atau URL gambar wajib diisi.',
          metadata: {
            toolName: 'vision_ai',
            displayName: 'Vision AI',
            executionTime: Date.now() - startTime,
          },
          error: {
            code: 'INVALID_IMAGE',
            message: 'Path atau URL gambar wajib diisi',
          },
        };
      }

      let imageUrl = imageSource;

      // Handle local file path
      if (
        !imageSource.startsWith('http://') &&
        !imageSource.startsWith('https://') &&
        !imageSource.startsWith('data:')
      ) {
        const absolutePath = path.isAbsolute(imageSource)
          ? imageSource
          : path.join(process.cwd(), imageSource);

        if (!fs.existsSync(absolutePath)) {
          return {
            status: 'error',
            data: {},
            preview: `File gambar tidak ditemukan: ${imageSource}`,
            metadata: {
              toolName: 'vision_ai',
              displayName: 'Vision AI',
              executionTime: Date.now() - startTime,
            },
            error: {
              code: 'FILE_NOT_FOUND',
              message: `File gambar tidak ditemukan: ${imageSource}`,
            },
          };
        }

        const buffer = fs.readFileSync(absolutePath);
        const ext =
          path.extname(absolutePath).toLowerCase().replace('.', '') || 'jpeg';
        const mimeType =
          ext === 'png'
            ? 'image/png'
            : ext === 'webp'
              ? 'image/webp'
              : 'image/jpeg';
        imageUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
      }

      const { text, usage } = await generateText({
        model: this.sdk.chat(this.visionModel),
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image', image: new URL(imageUrl) },
            ],
          },
        ],
        temperature: 0.2,
        maxOutputTokens: 2048,
      });

      return {
        status: 'success',
        data: {
          imageSource: imageSource.length > 100 ? '[Base64 Data]' : imageSource,
          analysis: text,
        },
        preview: text,
        metadata: {
          toolName: 'vision_ai',
          displayName: 'Vision AI',
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error: any) {
      this.logger.error(`Vision AI analysis failed: ${error.message}`);
      return {
        status: 'error',
        data: {},
        preview: `Vision AI gagal: ${error.message}`,
        metadata: {
          toolName: 'vision_ai',
          displayName: 'Vision AI',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'VISION_ANALYSIS_FAILED', message: error.message },
      };
    }
  }
}
