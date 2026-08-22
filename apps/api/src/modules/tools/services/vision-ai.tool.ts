import {
  Injectable,
  Logger,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import { ProviderService } from '../../provider/provider.service.js';

@Injectable()
export class VisionAiTool {
  private readonly logger = new Logger(VisionAiTool.name);

  constructor(
    @Optional() private readonly config?: ConfigService,
    @Optional()
    @Inject(forwardRef(() => ProviderService))
    private readonly providerService?: ProviderService,
  ) {}

  private resolveImagePath(imageSource: string): string | null {
    if (!imageSource) return null;
    const clean = imageSource.replace(/^@/, '').trim();
    if (!clean) return null;

    // 1. Direct path check
    if (fs.existsSync(clean)) return path.resolve(clean);
    const absPath = path.resolve(clean);
    if (fs.existsSync(absPath)) return absPath;

    // 2. Search in workspace-data/*/uploads/
    const baseUploads = path.join(process.cwd(), 'workspace-data');
    if (fs.existsSync(baseUploads)) {
      try {
        const wsDirs = fs.readdirSync(baseUploads);
        for (const ws of wsDirs) {
          const candidate = path.join(baseUploads, ws, 'uploads', path.basename(clean));
          if (fs.existsSync(candidate)) return candidate;
        }
      } catch {}
    }

    return null;
  }

  async analyzeImage(
    imageSource: string,
    prompt: string = 'Extract all text, table data, names, sizes, quantities, and key numbers from this image accurately.',
  ): Promise<ToolResult> {
    const startTime = Date.now();

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

    const resolvedPath = this.resolveImagePath(imageSource);

    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
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

    // 1. Fast LLM Vision Attempt (1-2s, 99.9% accuracy on tables & handwriting)
    if (this.providerService) {
      try {
        const activeProvider = await this.providerService.getActiveConfig();
        if (activeProvider && activeProvider.apiKey) {
          const buffer = fs.readFileSync(resolvedPath);
          const ext = path.extname(resolvedPath).toLowerCase().replace('.', '') || 'jpeg';
          const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
          const base64Data = buffer.toString('base64');
          const endpoint = activeProvider.baseUrl
            ? `${activeProvider.baseUrl.replace(/\/$/, '')}/chat/completions`
            : 'https://openrouter.ai/api/v1/chat/completions';

          this.logger.log(`Performing fast LLM Vision extraction via ${activeProvider.model || 'active provider'}...`);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);

          const response = await fetch(endpoint, {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${activeProvider.apiKey}`,
              'HTTP-Referer': 'https://arunaki.id',
              'X-Title': 'Arunaki Document Agent',
            },
            body: JSON.stringify({
              model: activeProvider.model || 'google/gemini-2.0-flash-001',
              messages: [
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: prompt || 'Extract all text, table data, names, sizes, quantities, and key numbers from this image accurately.',
                    },
                    {
                      type: 'image_url',
                      image_url: {
                        url: `data:${mimeType};base64,${base64Data}`,
                      },
                    },
                  ],
                },
              ],
              temperature: 0.1,
              max_tokens: 2048,
            }),
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            const text = data.choices?.[0]?.message?.content?.trim();
            if (text) {
              this.logger.log(`LLM Vision succeeded for ${path.basename(resolvedPath)} in ${Date.now() - startTime}ms`);
              return {
                status: 'success',
                data: {
                  imageSource: path.basename(resolvedPath),
                  analysis: text,
                  methodUsed: 'llm_vision',
                },
                preview: text,
                metadata: {
                  toolName: 'vision_ai',
                  displayName: 'Vision AI',
                  executionTime: Date.now() - startTime,
                  model: activeProvider.model,
                },
              };
            }
          }
        }
      } catch (llmErr: any) {
        this.logger.warn(`LLM Vision request bypassed or failed (${llmErr.message}), falling back to local OCR...`);
      }
    }

    // 2. Local OCR Fallback (Tesseract) directly reading from file path
    try {
      this.logger.log(`Running local OCR (Tesseract) on ${resolvedPath}...`);
      const Tesseract = await import('tesseract.js');
      const { data } = await Tesseract.recognize(resolvedPath, 'eng');
      const text = data.text.trim();

      return {
        status: 'success',
        data: {
          imageSource: path.basename(resolvedPath),
          analysis: text,
          methodUsed: 'local_ocr',
        },
        preview: text || '[No text detected in image]',
        metadata: {
          toolName: 'vision_ai',
          displayName: 'Local OCR Vision',
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error: any) {
      this.logger.error(`OCR analysis failed: ${error.message}`);
      return {
        status: 'error',
        data: {},
        preview: `OCR failed: ${error.message}`,
        metadata: {
          toolName: 'vision_ai',
          displayName: 'Vision AI',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'OCR_ANALYSIS_FAILED', message: error.message },
      };
    }
  }
}
