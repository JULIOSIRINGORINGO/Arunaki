import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { ProviderService } from '../../provider/provider.service.js';

@Injectable()
export class VisionAiTool {
  private readonly logger = new Logger(VisionAiTool.name);

  constructor(
    @Optional() private readonly config?: ConfigService,
    @Optional() @Inject(forwardRef(() => ProviderService)) private readonly providerService?: ProviderService,
  ) {}

  async analyzeImage(
    imageSource: string,
    prompt: string = 'Extract all text, table data, numbers, and key information from this image.',
  ): Promise<ToolResult> {
    const startTime = Date.now();
    try {
      let finalApiKey = this.config?.get<string>('VISION_API_KEY') || process.env.VISION_API_KEY;
      let finalBaseUrl = this.config?.get<string>('VISION_BASE_URL') || process.env.VISION_BASE_URL;
      let finalModel = this.config?.get<string>('VISION_MODEL') || process.env.VISION_MODEL;

      if (!finalApiKey && this.providerService) {
        const activeConfig = await this.providerService.getActiveConfig();
        if (activeConfig) {
          finalApiKey = activeConfig.apiKey;
          if (!finalBaseUrl) finalBaseUrl = activeConfig.baseUrl;
          if (!finalModel) {
            finalModel = activeConfig.baseUrl.includes('openrouter') ? 'google/gemini-2.0-flash-001' : activeConfig.model;
          }
        }
      }

      if (!finalApiKey) finalApiKey = this.config?.get<string>('AI_API_KEY') || process.env.AI_API_KEY || '';
      if (!finalBaseUrl) finalBaseUrl = 'https://openrouter.ai/api/v1';
      if (!finalModel) finalModel = 'google/gemini-2.0-flash-001';

      const sdk = createOpenAI({
        baseURL: finalBaseUrl,
        apiKey: finalApiKey,
        headers: {
          'HTTP-Referer': 'https://arunaki.app',
          'X-Title': 'Arunaki Vision AI',
        },
      });
      if (!imageSource) {
        return {
          status: 'error',
          data: {},
          preview: 'Image path or URL is required.',
          metadata: {
            toolName: 'vision_ai',
            displayName: 'Vision AI',
            executionTime: Date.now() - startTime,
          },
          error: {
            code: 'INVALID_INPUT',
            message: 'Image path or URL is required',
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
            preview: `Image file not found: ${imageSource}`,
            metadata: {
              toolName: 'vision_ai',
              displayName: 'Vision AI',
              executionTime: Date.now() - startTime,
            },
            error: {
              code: 'FILE_NOT_FOUND',
              message: `Image file not found: ${imageSource}`,
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

      const { text } = await generateText({
        model: sdk.chat(finalModel),
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
        preview: `Vision AI failed: ${error.message}`,
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
