import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  TableRow,
  TableCell,
  Table,
  WidthType,
} from 'docx';
import { ToolResult } from '../../interfaces/tool-result.interface.js';

@Injectable()
export class DocxReportBuilder {
  private readonly logger = new Logger(DocxReportBuilder.name);

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  async generateDocx(
    title: string,
    content: string,
    filename: string = 'document.docx',
    outputPath?: string,
  ): Promise<ToolResult> {
    const startTime = Date.now();
    const safeFilename = filename.endsWith('.docx')
      ? filename
      : `${filename}.docx`;

    try {
      const lines = content.split('\n').filter((l) => l.trim().length > 0);
      const children: any[] = [];

      children.push(
        new Paragraph({
          children: [new TextRun({ text: title, bold: true, size: 36 })],
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        }),
      );

      for (const line of lines) {
        if (line.startsWith('# ')) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line.replace(/^#\s*/, ''),
                  bold: true,
                  size: 32,
                }),
              ],
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 200, after: 100 },
            }),
          );
        } else if (line.startsWith('## ')) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line.replace(/^##\s*/, ''),
                  bold: true,
                  size: 26,
                }),
              ],
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 150, after: 80 },
            }),
          );
        } else if (line.startsWith('|') && line.includes('|')) {
          const cells = line
            .split('|')
            .filter((c) => c.trim().length > 0)
            .map((c) => c.trim());
          if (!cells.every((c) => /^[-:]+$/.test(c))) {
            const tableRow = new TableRow({
              children: cells.map(
                (cell) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: cell, size: 20 })],
                      }),
                    ],
                    width: {
                      size: Math.floor(100 / cells.length),
                      type: WidthType.PERCENTAGE,
                    },
                  }),
              ),
            });
            children.push(
              new Table({
                rows: [tableRow],
                width: { size: 100, type: WidthType.PERCENTAGE },
              }),
            );
          }
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `• ${line.replace(/^[-*]\s*/, '')}`,
                  size: 22,
                }),
              ],
              spacing: { before: 40, after: 40 },
            }),
          );
        } else {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: line, size: 22 })],
              spacing: { before: 40, after: 40 },
            }),
          );
        }
      }

      const doc = new Document({
        sections: [{ children }],
      });

      const buffer = await Packer.toBuffer(doc);
      const contentBase64 = buffer.toString('base64');

      const targetWritePath = outputPath;
      if (targetWritePath) {
        const resolvedTarget = path.resolve(targetWritePath);
        const parentDir = path.dirname(resolvedTarget);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        fs.writeFileSync(resolvedTarget, buffer);
        this.logger.log(`Wrote DOCX file physically to disk: ${resolvedTarget}`);
      }

      return {
        status: 'success',
        data: {
          title,
          paragraphCount: children.length,
          size: buffer.length,
          writtenToDisk: !!targetWritePath,
          filePath: targetWritePath ? path.resolve(targetWritePath) : undefined,
        },
        preview: `${title} — ${children.length} blok konten, ${this.formatBytes(buffer.length)}`,
        metadata: {
          toolName: 'generate_export',
          displayName: 'Dokumen Export',
          executionTime: Date.now() - startTime,
          format: 'docx',
          filename: safeFilename,
          mimeType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          contentBase64,
        },
      };
    } catch (e: any) {
      return {
        status: 'error',
        data: {},
        preview: `Gagal generate DOCX: ${e.message}`,
        metadata: {
          toolName: 'generate_export',
          displayName: 'Dokumen Export',
          executionTime: Date.now() - startTime,
          format: 'docx',
          filename: safeFilename,
        },
        error: { code: 'DOCX_FAILED', message: e.message },
      };
    }
  }
}
