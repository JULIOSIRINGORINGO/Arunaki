import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KnowledgeService } from './knowledge.service.js';
import { KnowledgeCrawlerService } from './services/knowledge-crawler.service.js';
import {
  successResponse,
  errorResponse,
} from '../../common/dtos/api-response.dto.js';
import * as path from 'path';

/**
 * Discovers product URLs from the site's sitemap.xml so the user only needs
 * to provide a single base URL. Prefers the /id/ locale and drops
 * color/size query variants (they all point to the same product page).
 */
async function fetchSitemapProductUrls(baseUrl: string): Promise<string[]> {
  try {
    const base = new URL(baseUrl);
    const res = await fetch(`${base.origin}/sitemap.xml`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    const out = new Set<string>();
    for (const loc of locs) {
      try {
        const u = new URL(loc);
        if (u.hostname !== base.hostname) continue;
        if (!/\/product\//i.test(u.pathname)) continue;
        if (!u.pathname.startsWith('/id/')) continue;
        u.search = '';
        u.hash = '';
        out.add(u.toString());
      } catch {
        // ignore malformed loc entries
      }
    }
    return [...out].slice(0, 40);
  } catch {
    return [];
  }
}

/**
 * Collects internal links (same host) from raw HTML so a node can hold
 * homepage + discovered category/product URLs without the user typing them.
 */
function extractInternalLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const hrefs = [...html.matchAll(/href="([^"]+)"/gi)].map((m) => m[1]);
  const out = new Set<string>();
  for (const h of hrefs) {
    try {
      const u = new URL(h, base);
      if (u.hostname !== base.hostname) continue;
      if (/\.(jpg|jpeg|png|gif|webp|css|js|svg|ico|woff2?|pdf|zip)$/i.test(u.pathname)) continue;
      u.hash = '';
      out.add(u.toString());
    } catch {
      // ignore malformed hrefs
    }
  }
  return [...out].slice(0, 30);
}

@Controller('knowledge')
export class KnowledgeController {
  constructor(
    private readonly knowledgeService: KnowledgeService,
    private readonly crawler: KnowledgeCrawlerService,
  ) {}

  @Post('compose')
  async compose(@Body() body: { url: string }) {
    try {
      let result = await this.crawler.fetchLiveKnowledge({
        url: body.url,
        format: 'html',
        browser: false,
      });
      if (!result.extractedContent || result.extractedContent.length < 100) {
        result = await this.crawler.fetchLiveKnowledge({
          url: body.url,
          format: 'html',
          browser: true,
        });
      }
      const content = result.extractedContent
        ? `# ${result.title}\n\n${result.extractedContent}`
        : `# ${result.title}\n\n${body.url}`;
      const links = extractInternalLinks(result.extractedContent || '', body.url);
      const productUrls = await fetchSitemapProductUrls(body.url);
      const urls = [...new Set([...links, ...productUrls])].slice(0, 60);
      return successResponse({ title: result.title, content, urls });
    } catch (error) {
      return errorResponse('COMPOSE_FAILED', (error as Error).message);
    }
  }

  @Get()
  async findAll() {
    try {
      const items = await this.knowledgeService.findAll();
      return successResponse(items);
    } catch (error) {
      return errorResponse('FETCH_FAILED', error.message);
    }
  }

  @Get('active')
  async findActive() {
    try {
      const items = await this.knowledgeService.findActive();
      return successResponse(items);
    } catch (error) {
      return errorResponse('FETCH_FAILED', error.message);
    }
  }

  @Get('edges')
  async findAllEdges() {
    try {
      const edges = await this.knowledgeService.findAllEdges();
      return successResponse(edges);
    } catch (error) {
      return errorResponse('FETCH_FAILED', error.message);
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const item = await this.knowledgeService.findById(id);
      return successResponse(item);
    } catch (error) {
      return errorResponse('NOT_FOUND', error.message);
    }
  }

  @Post()
  async create(
    @Body()
    body: {
      title: string;
      content: string;
      urls?: string[];
      city?: string;
      type?: string;
      positionX?: number;
      positionY?: number;
      nodeColor?: string;
      icon?: string;
    },
  ) {
    try {
      const item = await this.knowledgeService.create({
        title: body.title,
        content: body.content,
        urls: body.urls ? JSON.stringify(body.urls) : '[]',
        city: body.city ?? '',
        type: body.type || 'custom',
        positionX: body.positionX ?? 0,
        positionY: body.positionY ?? 0,
        nodeColor: body.nodeColor ?? '#3B82F6',
        icon: body.icon ?? 'file-text',
      });
      return successResponse(item);
    } catch (error) {
      return errorResponse('CREATE_FAILED', error.message);
    }
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      content?: string;
      urls?: string[];
      city?: string;
      type?: string;
      nodeColor?: string;
      icon?: string;
    },
  ) {
    try {
      const data: Record<string, any> = { ...body };
      if (body.urls !== undefined) data.urls = JSON.stringify(body.urls);
      const item = await this.knowledgeService.update(id, data);
      return successResponse(item);
    } catch (error) {
      return errorResponse('UPDATE_FAILED', error.message);
    }
  }

  @Patch(':id/toggle')
  async toggleActive(@Param('id') id: string) {
    try {
      const item = await this.knowledgeService.toggleActive(id);
      return successResponse(item);
    } catch (error) {
      return errorResponse('UPDATE_FAILED', error.message);
    }
  }

  @Patch(':id/position')
  async updatePosition(
    @Param('id') id: string,
    @Body() body: { positionX: number; positionY: number },
  ) {
    try {
      const item = await this.knowledgeService.updatePosition(
        id,
        body.positionX,
        body.positionY,
      );
      return successResponse(item);
    } catch (error) {
      return errorResponse('UPDATE_FAILED', error.message);
    }
  }

  @Patch('positions/batch')
  async updatePositions(
    @Body()
    body: {
      positions: Array<{ id: string; positionX: number; positionY: number }>;
    },
  ) {
    try {
      await this.knowledgeService.updatePositions(body.positions);
      return successResponse({ updated: body.positions.length });
    } catch (error) {
      return errorResponse('UPDATE_FAILED', error.message);
    }
  }

  // ─── Edge CRUD ────────────────────────────────────────

  @Post('edges')
  async createEdge(
    @Body() body: { sourceId: string; targetId: string; label?: string },
  ) {
    try {
      const edge = await this.knowledgeService.createEdge(
        body.sourceId,
        body.targetId,
        body.label,
      );
      return successResponse(edge);
    } catch (error) {
      return errorResponse('CREATE_FAILED', error.message);
    }
  }

  @Delete('edges/:id')
  async deleteEdge(@Param('id') id: string) {
    try {
      await this.knowledgeService.deleteEdge(id);
      return successResponse({ deleted: true });
    } catch (error) {
      return errorResponse('DELETE_FAILED', error.message);
    }
  }

  // ─── File Upload ──────────────────────────────────────

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['.pdf', '.docx', '.txt', '.md', '.csv'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `Format ${ext} is not supported. Use: PDF, DOCX, TXT, Markdown, CSV`,
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { positionX?: string; positionY?: string },
  ) {
    if (!file) {
      return errorResponse('NO_FILE', 'No file was uploaded');
    }

    try {
      const ext = path.extname(file.originalname).toLowerCase();
      let text = '';

      switch (ext) {
        case '.pdf': {
          const PDFParser = (await import('pdf2json')).default;
          text = await new Promise<string>((resolve, reject) => {
            const parser = new PDFParser();
            parser.on('pdfParser_dataError', (errData: any) =>
              reject(new Error(errData.parserError || 'PDF parse error')),
            );
            parser.on('pdfParser_dataReady', (pdfData: any) => {
              const parts = (pdfData.Pages || []).map((page: any) =>
                (page.Texts || [])
                  .flatMap((t: any) =>
                    (t.R || []).map((r: any) => decodeURIComponent(r.T || '')),
                  )
                  .join(' '),
              );
              resolve(parts.join('\n\n'));
            });
            parser.parseBuffer(file.buffer);
          });
          break;
        }
        case '.docx': {
          const mammoth = await import('mammoth');
          const result = await mammoth.extractRawText({ buffer: file.buffer });
          text = result.value;
          break;
        }
        case '.csv': {
          const csvParse = await import('csv-parse/sync');
          const records = csvParse.parse(file.buffer.toString(), {
            columns: true,
            skip_empty_lines: true,
            trim: true,
          });
          text = records
            .map((r: Record<string, string>) => Object.values(r).join(' | '))
            .join('\n');
          break;
        }
        case '.txt':
        case '.md':
          text = file.buffer.toString('utf-8');
          break;
        default:
          return errorResponse('UNSUPPORTED', `Format ${ext} is not supported`);
      }

      const title = path.basename(file.originalname, ext);

      const item = await this.knowledgeService.create({
        title,
        content: text,
        type: ext.replace('.', ''),
        positionX: body.positionX ? parseFloat(body.positionX) : 0,
        positionY: body.positionY ? parseFloat(body.positionY) : 0,
      });

      return successResponse(item);
    } catch (error) {
      return errorResponse('UPLOAD_FAILED', error.message);
    }
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    try {
      await this.knowledgeService.delete(id);
      return successResponse({ deleted: true });
    } catch (error) {
      return errorResponse('DELETE_FAILED', error.message);
    }
  }
}
