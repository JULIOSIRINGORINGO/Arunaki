import { Injectable, Logger } from '@nestjs/common';
import { ToolResult } from '../interfaces/tool-result.interface.js';
import { ExcelComService } from '../../interaction/excel-com.service.js';
import { PrismaService } from '../../../common/providers/prisma.service.js';

interface FillRowInput {
  label: string;
  value: any;
}

/**
 * fill_table_column — domain-level tool for date-per-column recap templates
 * (a header row of dates + labeled rows). The model sends ONLY semantic data:
 * which date column, which labeled rows with which values, optional detail
 * lines. The tool resolves every position deterministically and writes
 * atomically — the model never touches coordinates.
 */
@Injectable()
export class FillTableColumnTool {
  private readonly logger = new Logger(FillTableColumnTool.name);

  constructor(
    private readonly excelCom: ExcelComService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(args: {
    workspaceId?: string;
    filePath?: string;
    sheetName?: string;
    date?: string;
    rows?: FillRowInput[];
    details?: string[];
  }): Promise<ToolResult> {
    const startTime = Date.now();
    try {
      if (!args.filePath || !args.date || !Array.isArray(args.rows) || args.rows.length === 0) {
        return this.err('filePath, date and rows[{label,value}] are required', startTime);
      }
      let pathStr = String(args.filePath).replace(/^@/, '').trim();
      if (args.workspaceId && this.prisma) {
        const ws = await this.prisma.workspace.findUnique({
          where: { id: args.workspaceId },
          select: { rootPath: true },
        });
        if (ws?.rootPath) {
          const pathMod = await import('path');
          const joined = pathMod.isAbsolute(pathStr)
            ? pathStr
            : pathMod.join(ws.rootPath, pathStr);
          if (joined.toLowerCase().startsWith(ws.rootPath.toLowerCase())) {
            pathStr = joined;
          }
        }
      }
      const res = await this.excelCom.fillTableColumn(
        pathStr,
        args.sheetName,
        String(args.date),
        args.rows,
        Array.isArray(args.details) ? args.details.map(String) : [],
      );
      const preview =
        res.results
          ?.map((r: any) =>
            r.success ? `✓ ${r.label ?? r.detail ?? 'col'}` : `✗ ${r.label ?? ''}: ${r.error}`,
          )
          .slice(0, 12)
          .join(' | ') ?? '';
      return {
        status: res.success ? 'success' : 'error',
        data: res as any,
        preview:
          (res.success
            ? `Filled ${res.itemsTotal - res.itemsFailed}/${res.itemsTotal} items in column ${args.date}`
            : `fill_table_column had ${res.itemsFailed} failures`) +
          (preview ? ` — ${preview}` : ''),
        metadata: {
          toolName: 'fill_table_column',
          displayName: 'Fill Table Column (date-matrix)',
          executionTime: Date.now() - startTime,
        },
        error: res.success
          ? undefined
          : { code: 'FILL_PARTIAL', message: `${res.itemsFailed} items failed` },
      };
    } catch (e: any) {
      return this.err(e.message, startTime);
    }
  }

  private err(message: string, startTime: number): ToolResult {
    return {
      status: 'error',
      data: {},
      preview: message,
      metadata: {
        toolName: 'fill_table_column',
        displayName: 'Fill Table Column (date-matrix)',
        executionTime: Date.now() - startTime,
      },
      error: { code: 'FILL_ERROR', message },
    };
  }
}
