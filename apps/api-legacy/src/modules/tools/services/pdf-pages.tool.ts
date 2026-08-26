import { Injectable, Logger } from '@nestjs/common';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PdfPagesTool {
  private readonly logger = new Logger(PdfPagesTool.name);

  /**
   * Merge multiple PDF files into a single output PDF.
   */
  async merge(
    filePaths: string[],
    outputPath: string,
  ): Promise<ToolResult> {
    const startTime = Date.now();

    if (!filePaths || filePaths.length < 2) {
      return {
        status: 'error',
        data: {},
        preview: 'At least 2 PDF files are required for merging.',
        metadata: {
          toolName: 'pdf_manage_pages',
          displayName: 'PDF Merge',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'INSUFFICIENT_FILES', message: 'Need at least 2 PDF files to merge' },
      };
    }

    try {
      const { PDFDocument } = await import('pdf-lib');
      const merged = await PDFDocument.create();

      for (const fp of filePaths) {
        if (!fs.existsSync(fp)) {
          return {
            status: 'error',
            data: {},
            preview: `File not found: ${fp}`,
            metadata: {
              toolName: 'pdf_manage_pages',
              displayName: 'PDF Merge',
              executionTime: Date.now() - startTime,
            },
            error: { code: 'FILE_NOT_FOUND', message: `File not found: ${fp}` },
          };
        }
        const pdfBytes = fs.readFileSync(fp);
        const doc = await PDFDocument.load(pdfBytes);
        const pages = await merged.copyPages(doc, doc.getPageIndices());
        for (const page of pages) {
          merged.addPage(page);
        }
      }

      const mergedBytes = await merged.save();
      const resolvedOutput = path.resolve(outputPath);
      const parentDir = path.dirname(resolvedOutput);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(resolvedOutput, mergedBytes);

      return {
        status: 'success',
        data: {
          outputPath: resolvedOutput,
          totalPages: merged.getPageCount(),
          sourceFiles: filePaths.map((f) => path.basename(f)),
          sizeBytes: mergedBytes.length,
        },
        preview: `Merged ${filePaths.length} PDF files into ${path.basename(resolvedOutput)} (${merged.getPageCount()} pages)`,
        metadata: {
          toolName: 'pdf_manage_pages',
          displayName: 'PDF Merge',
          executionTime: Date.now() - startTime,
          filename: path.basename(resolvedOutput),
        },
      };
    } catch (e: any) {
      this.logger.error(`PDF merge failed: ${e.message}`);
      return {
        status: 'error',
        data: {},
        preview: `PDF merge failed: ${e.message}`,
        metadata: {
          toolName: 'pdf_manage_pages',
          displayName: 'PDF Merge',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'PDF_MERGE_FAILED', message: e.message },
      };
    }
  }

  /**
   * Extract specific pages from a PDF into a new file.
   * Pages can be specified as individual numbers [1, 3, 5] or a range string "1-4".
   */
  async extractPages(
    sourcePath: string,
    pages: number[],
    outputPath: string,
  ): Promise<ToolResult> {
    const startTime = Date.now();

    if (!sourcePath || !fs.existsSync(sourcePath)) {
      return {
        status: 'error',
        data: {},
        preview: `Source file not found: ${sourcePath}`,
        metadata: {
          toolName: 'pdf_manage_pages',
          displayName: 'PDF Extract Pages',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'FILE_NOT_FOUND', message: `Source file not found: ${sourcePath}` },
      };
    }

    if (!pages || pages.length === 0) {
      return {
        status: 'error',
        data: {},
        preview: 'No page numbers specified for extraction.',
        metadata: {
          toolName: 'pdf_manage_pages',
          displayName: 'PDF Extract Pages',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'NO_PAGES', message: 'Page numbers array is required' },
      };
    }

    try {
      const { PDFDocument } = await import('pdf-lib');
      const pdfBytes = fs.readFileSync(sourcePath);
      const sourceDoc = await PDFDocument.load(pdfBytes);
      const totalSourcePages = sourceDoc.getPageCount();

      // Convert 1-based page numbers to 0-based indices and validate
      const validIndices: number[] = [];
      const invalidPages: number[] = [];
      for (const p of pages) {
        const idx = p - 1;
        if (idx >= 0 && idx < totalSourcePages) {
          validIndices.push(idx);
        } else {
          invalidPages.push(p);
        }
      }

      if (validIndices.length === 0) {
        return {
          status: 'error',
          data: {},
          preview: `No valid pages found. Source has ${totalSourcePages} pages. Invalid: [${invalidPages.join(', ')}]`,
          metadata: {
            toolName: 'pdf_manage_pages',
            displayName: 'PDF Extract Pages',
            executionTime: Date.now() - startTime,
          },
          error: { code: 'INVALID_PAGES', message: `All page numbers are out of range (1-${totalSourcePages})` },
        };
      }

      const newDoc = await PDFDocument.create();
      const copiedPages = await newDoc.copyPages(sourceDoc, validIndices);
      for (const page of copiedPages) {
        newDoc.addPage(page);
      }

      const newBytes = await newDoc.save();
      const resolvedOutput = path.resolve(outputPath);
      const parentDir = path.dirname(resolvedOutput);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(resolvedOutput, newBytes);

      return {
        status: 'success',
        data: {
          outputPath: resolvedOutput,
          extractedPages: validIndices.map((i) => i + 1),
          totalExtracted: validIndices.length,
          sourcePages: totalSourcePages,
          sizeBytes: newBytes.length,
          invalidPages: invalidPages.length > 0 ? invalidPages : undefined,
        },
        preview: `Extracted pages [${validIndices.map((i) => i + 1).join(', ')}] from ${path.basename(sourcePath)} → ${path.basename(resolvedOutput)} (${validIndices.length} pages)`,
        metadata: {
          toolName: 'pdf_manage_pages',
          displayName: 'PDF Extract Pages',
          executionTime: Date.now() - startTime,
          filename: path.basename(resolvedOutput),
        },
      };
    } catch (e: any) {
      this.logger.error(`PDF extract failed: ${e.message}`);
      return {
        status: 'error',
        data: {},
        preview: `PDF extract failed: ${e.message}`,
        metadata: {
          toolName: 'pdf_manage_pages',
          displayName: 'PDF Extract Pages',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'PDF_EXTRACT_FAILED', message: e.message },
      };
    }
  }

  /**
   * Apply a diagonal text watermark across all (or specified) pages.
   */
  async watermark(
    sourcePath: string,
    text: string,
    outputPath: string,
    options?: {
      opacity?: number;
      fontSize?: number;
      color?: { r: number; g: number; b: number };
      pages?: number[];
    },
  ): Promise<ToolResult> {
    const startTime = Date.now();

    if (!sourcePath || !fs.existsSync(sourcePath)) {
      return {
        status: 'error',
        data: {},
        preview: `Source file not found: ${sourcePath}`,
        metadata: {
          toolName: 'pdf_manage_pages',
          displayName: 'PDF Watermark',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'FILE_NOT_FOUND', message: `Source file not found: ${sourcePath}` },
      };
    }

    if (!text || text.trim().length === 0) {
      return {
        status: 'error',
        data: {},
        preview: 'Watermark text cannot be empty.',
        metadata: {
          toolName: 'pdf_manage_pages',
          displayName: 'PDF Watermark',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'EMPTY_TEXT', message: 'Watermark text is required' },
      };
    }

    try {
      const { PDFDocument, rgb, degrees, StandardFonts } = await import('pdf-lib');
      const pdfBytes = fs.readFileSync(sourcePath);
      const doc = await PDFDocument.load(pdfBytes);
      const font = await doc.embedFont(StandardFonts.HelveticaBold);

      const opacity = options?.opacity ?? 0.15;
      const fontSize = options?.fontSize ?? 60;
      const colorVal = options?.color ?? { r: 0.5, g: 0.5, b: 0.5 };
      const watermarkColor = rgb(colorVal.r, colorVal.g, colorVal.b);

      const allPages = doc.getPages();
      const targetPageIndices = options?.pages
        ? options.pages.map((p) => p - 1).filter((i) => i >= 0 && i < allPages.length)
        : allPages.map((_, i) => i);

      for (const idx of targetPageIndices) {
        const page = allPages[idx];
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(text, fontSize);

        page.drawText(text, {
          x: width / 2 - textWidth / 2 * Math.cos(Math.PI / 4),
          y: height / 2 - textWidth / 2 * Math.sin(Math.PI / 4),
          size: fontSize,
          font,
          color: watermarkColor,
          opacity,
          rotate: degrees(45),
        });
      }

      const watermarkedBytes = await doc.save();
      const resolvedOutput = path.resolve(outputPath);
      const parentDir = path.dirname(resolvedOutput);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(resolvedOutput, watermarkedBytes);

      return {
        status: 'success',
        data: {
          outputPath: resolvedOutput,
          watermarkText: text,
          pagesWatermarked: targetPageIndices.length,
          totalPages: allPages.length,
          sizeBytes: watermarkedBytes.length,
        },
        preview: `Applied watermark "${text}" to ${targetPageIndices.length} pages → ${path.basename(resolvedOutput)}`,
        metadata: {
          toolName: 'pdf_manage_pages',
          displayName: 'PDF Watermark',
          executionTime: Date.now() - startTime,
          filename: path.basename(resolvedOutput),
        },
      };
    } catch (e: any) {
      this.logger.error(`PDF watermark failed: ${e.message}`);
      return {
        status: 'error',
        data: {},
        preview: `PDF watermark failed: ${e.message}`,
        metadata: {
          toolName: 'pdf_manage_pages',
          displayName: 'PDF Watermark',
          executionTime: Date.now() - startTime,
        },
        error: { code: 'PDF_WATERMARK_FAILED', message: e.message },
      };
    }
  }
}
