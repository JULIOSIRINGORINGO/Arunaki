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

  async analyzeImage(
    imageSource: string,
    prompt: string = 'Extract all text, table data, numbers, and key information from this image.',
  ): Promise<ToolResult> {
    const startTime = Date.now();

    if (!imageSource) {
      return {
        status: 'error',
        data: {},
        preview: 'Image path or URL is required.',
        metadata: {
          toolName: 'vision_ai',
          displayName: 'Local OCR Vision',
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
            displayName: 'Local OCR Vision',
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

    try {
      this.logger.log(
        `Processing local OCR (Tesseract) for: ${imageSource.substring(0, 50)}...`,
      );
      const Tesseract = await import('tesseract.js');
      const { data } = await Tesseract.recognize(imageUrl, 'eng');
      const text = data.text.trim();

      return {
        status: 'success',
        data: {
          imageSource: imageSource.length > 100 ? '[Base64 Data]' : imageSource,
          analysis: text,
          methodUsed: 'local_ocr',
        },
        preview: text || '[No text detected]',
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
          displayName: 'Local OCR Vision',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'OCR_ANALYSIS_FAILED', message: error.message },
      };
    }
  }
}
