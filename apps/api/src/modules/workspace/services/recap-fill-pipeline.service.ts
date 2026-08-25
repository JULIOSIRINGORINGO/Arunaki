import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import { ExcelComService } from '../../interaction/excel-com.service';
import { request as httpsRequest } from 'https';

@Injectable()
export class RecapFillPipelineService {
  private readonly logger = new Logger(RecapFillPipelineService.name);

  constructor(
    @Inject(forwardRef(() => AiService)) private readonly aiService: AiService,
    @Inject(forwardRef(() => ExcelComService))
    private readonly excelComService: ExcelComService,
  ) {}

  /** Recap-fill goal: fill/catat/update + explicit date or "today" + a sheet/file target. */
  isRecapFillGoal(goal: string): boolean {
    return (
      /(?:isi|catat|input|update|rekap|fill|record)/i.test(goal || '') &&
      /(?:\b\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}\b|hari ini|today)/i.test(goal || '') &&
      /(?:\.xlsm|\.xlsx|sheet|laporan|rekap|excel)/i.test(goal || '')
    );
  }

  /**
   * RECAP-FILL PIPELINE (single-shot, opencode-style pipeline instead of an
   * agent loop): (1) read the template skeleton deterministically, (2) ONE
   * LLM extraction call producing semantic JSON against the real label list,
   * (3) execute fillTableColumn, (4) read-back verification. The model never
   * emits coordinates.
   */
  async runRecapFillPipeline(p: {
    workspaceId: string;
    workspaceRootPath: string;
    goal: string;
    sourceFiles: Map<string, string>;
    onEvent: (e: { type: string; data?: any }) => void;
  }): Promise<string> {
    const { onEvent } = p;
    onEvent({
      type: 'phase_changed',
      data: { label: 'Recap fill pipeline: reading template skeleton...' },
    });

    // 0. Resolve target workbook (the mentioned .xlsm/.xlsx)
    let targetFile = '';
    const sourceTexts: string[] = [];
    for (const [fname, content] of p.sourceFiles) {
      if (/\.(xlsm|xlsx)$/i.test(fname)) targetFile = fname;
      else sourceTexts.push(`=== ${fname} ===\n${content.slice(0, 6000)}`);
    }
    if (!targetFile) {
      for (const fname of p.sourceFiles.keys()) {
        if (/\.(xlsm|xlsx)$/i.test(fname)) targetFile = fname;
      }
    }
    if (!targetFile) throw new Error('No Excel target file found in mentions');

    const targetPath = `${p.workspaceRootPath}\\${targetFile}`;
    const sheetMatch = p.goal.match(/sheet\s+(\w+)/i);
    const skeleton = await this.excelComService.readTableSkeleton(
      targetPath,
      sheetMatch?.[1],
    );
    if ((skeleton as any).error) throw new Error((skeleton as any).error);

    // 1. Target date: explicit in goal, else today
    const dateMatch = p.goal.match(/\b(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})\b/);
    const targetDate = dateMatch
      ? dateMatch[1]
      : new Date().toLocaleDateString('id-ID', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });

    // 2. ONE extraction call (no tools, JSON only)
    onEvent({
      type: 'phase_changed',
      data: { label: 'Recap fill pipeline: extracting data (1 LLM call)...' },
    });
    
    const extraction = await (async () => {
      const sysMsg =
        'You are a financial data aggregator. Summarize the daily financial report into a valid JSON format. \n' +
        'Expected JSON structure: {"rows":[{"label":"<exact label from LABELS list>","value":<integer amount in IDR>}],"details":["<individual transaction lines>"]}. Important instructions: 1. Labels MUST perfectly match the provided LABELS list. 2. Convert shorthand units to full numbers (e.g. 5 RB = 5000, 1.5 JT = 1500000). 3. Dots in numbers are thousand separators. 4. Only include rows that the user explicitly requested. 5. The "details" array should only contain individual transaction descriptions, not summary or total lines. 6. VERY IMPORTANT: Do not correct spelling in the details array; copy all text exactly verbatim from the source (e.g. if the source has a typo, KEEP the typo).';
      const usrMsg = `SOURCE DATA:\n${[...p.sourceFiles].map(([f, c]) => `=== ${f} ===\n${c.slice(0, 6000)}`).join('\n\n')}\n\nAVAILABLE LABELS (copy verbatim):\n${skeleton.labels.join('\n')}\n\nDATE HEADERS: ${skeleton.dates.join(', ')}\nTARGET DATE: ${targetDate}\n\nUSER REQUEST: ${p.goal}`;

      const parseJsonLoose = (rawText: string): any | null => {
        let t = rawText.trim();
        const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (fence) t = fence[1].trim();
        const jm = t.match(/\{[\s\S]*\}/);
        if (!jm) return null;
        try {
          return JSON.parse(jm[0]);
        } catch {
          try {
            return JSON.parse(jm[0].replace(/,\s*([}\]])/g, '$1'));
          } catch {
            return null;
          }
        }
      };

      const rawKenariExtract = (
        model: string,
      ): Promise<{ ok: boolean; text: string }> =>
        new Promise((resolve) => {
          const payload = JSON.stringify({
            model,
            messages: [
              { role: 'system', content: sysMsg },
              { role: 'user', content: usrMsg },
            ],
            temperature: 0.2,
            max_tokens: 8192,
          });
          const req = httpsRequest(
            {
              host: 'kenari.id',
              path: '/v1/chat/completions',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.AI_API_KEY || ''}`,
                'Content-Length': Buffer.byteLength(payload),
              },
              timeout: 300000,
            },
            (res: any) => {
              let buf = '';
              res.setEncoding('utf8');
              res.on('data', (c: string) => (buf += c));
              res.on('end', () => {
                try {
                  const j = JSON.parse(buf);
                  const content = j.choices?.[0]?.message?.content;
                  if (content) {
                    resolve({ ok: !!content.trim(), text: content });
                  } else {
                    resolve({ ok: false, text: `API Error: ${JSON.stringify(j).slice(0, 200)}` });
                  }
                } catch {
                  resolve({ ok: false, text: buf.slice(0, 120) });
                }
              });
            },
          );
          req.on('timeout', () => {
            req.destroy();
            resolve({ ok: false, text: 'timeout' });
          });
          req.on('error', (e: any) =>
            resolve({ ok: false, text: e.message }),
          );
          req.write(payload);
          req.end();
        });

      let last = '';
      const extractionModels = [
        'gemini-1.5-flash',
        'deepseek-v4-flash',
      ];
      for (const model of extractionModels) {
        const direct = await rawKenariExtract(model);
        if (direct.ok) {
          const parsed = parseJsonLoose(direct.text);
          if (parsed) {
            this.logger.log(`[RecapFill] extraction OK via raw-kenari (${model})`);
            return parsed;
          }
          last = `unparseable: ${direct.text.slice(0, 100)}`;
        } else {
          last = direct.text;
        }
        this.logger.warn(`[RecapFill] raw-kenari extraction failed (${model}): ${last.slice(0, 100)}`);
        await new Promise((s) => setTimeout(s, 2000));
      }

      // Last resort: the AI-SDK path
      for (const preferred of [undefined, 'deepseek-v4-flash']) {
        const r = await this.aiService.chat(
          [
            { role: 'system', content: sysMsg },
            { role: 'user', content: usrMsg },
          ],
          undefined,
          {
            reasoningEffort: 'low',
            ...(preferred ? { preferredProviderId: preferred } : {}),
          },
        );
        last = (r.content || '').trim();
        const parsed = parseJsonLoose(last);
        if (parsed) return parsed;
        this.logger.warn(`[RecapFill] sdk extraction failed (${preferred || 'default'}): ${last.slice(0, 100)}`);
      }
      throw new Error(`Extraction failed: ${last.slice(0, 120)}`);
    })();

    if (!Array.isArray(extraction.rows) || extraction.rows.length === 0) {
      throw new Error('Extraction JSON has no rows');
    }

    // 3. Deterministic execution
    onEvent({
      type: 'phase_changed',
      data: { label: 'Recap fill pipeline: writing (deterministic)...' },
    });
    const res = await this.excelComService.fillTableColumn(
      targetPath,
      sheetMatch?.[1] || skeleton.activeSheet,
      targetDate,
      extraction.rows,
      Array.isArray(extraction.details) ? extraction.details.map(String) : [],
    );
    if (!res.success && res.itemsFailed === res.itemsTotal) {
      throw new Error('All fill items failed');
    }

    // 4. Read-back verification of the filled cells
    const okRows = (res.results || []).filter(
      (r: any) => r.success && r.item === 'row',
    );
    const summary =
      `Column ${targetDate} in ${targetFile} (${skeleton.activeSheet}) filled: ` +
      `${okRows.length}/${extraction.rows.length} label rows, ` +
      `${(res.results || []).filter((r: any) => r.success && r.item === 'detail').length} detail lines. ` +
      (res.itemsFailed > 0
        ? `Failed: ${(res.results || []).filter((r: any) => !r.success).map((r: any) => r.label || r.error).join(', ')}.`
        : 'All positions verified by harness.') +
      ` [pipeline: 1 LLM call]`;
    onEvent({ type: 'thinking', data: summary });
    return summary;
  }
}
