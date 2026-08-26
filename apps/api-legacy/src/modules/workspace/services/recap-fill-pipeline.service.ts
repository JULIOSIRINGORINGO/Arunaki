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
        'You are an intelligent data extraction engine. Extract and summarize the provided source data into a valid JSON format. \n' +
        'Expected JSON structure: {"rows":[{"label":"<exact label from LABELS list, including the prefix like R10: TARGET_LABEL>","value":<integer amount or number>}],"details":["<individual data/log lines>"]}. Important instructions: \n' +
        '1. Labels MUST perfectly match the provided LABELS list. Keep the "Rxxx:" prefix (e.g. "R10: TARGET_LABEL" or "R5: HEADER_LABEL"). Do NOT strip it.\n' +
        '2. Convert shorthand units to full numbers (e.g. 5 RB = 5000, 1.5 JT = 1500000) if applicable to the domain. \n' +
        '3. Dots in numbers are thousand separators. \n' +
        '4. Only include rows that the user explicitly requested or are relevant to the source data. \n' +
        '5. The "details" array should contain individual logs, notes, or descriptions, not summary lines. \n' +
        '6. VERY IMPORTANT: Do not correct spelling in the details array; copy verbatim. \n' +
        '7. CRITICAL MAPPING: If a section in the source text contains a total and several sub-items, you must map the section total to its matching parent label in the LABELS list, and map its sub-items to their specific sub-labels. \n' +
        '8. Observe any WORKSPACE RULES (ARUNAKI.md) provided in the prompt to resolve ambiguities, determine whether to extract quantities vs amounts, and apply format preferences specific to this workspace. \n' +
        '9. STRICT FORMATTING: You must output ONLY valid JSON. Do NOT include any markdown blocks (```), do NOT include any explanations, do NOT output reasoning, and keep your output as short as possible to avoid truncation.\n' +
        '10. TARGET DATE FILTERING: For accounts, outstanding bills, or receivables (like PIUTANG or BELUM BAYAR), you MUST only extract items whose dates in the source text explicitly match the TARGET DATE (e.g. 24/08/2026). If an item has a past date (e.g. "10-02-2024"), or has no date specified at all (e.g. "CK HENNY = 549RB"), you MUST ignore it and do NOT extract it as a row.\n' +
        '11. DUPLICATE LABELS RESOLUTION: If a text label appears multiple times in the LABELS list with different row numbers (e.g. "TARGET_LABEL" at R37 and R75), check the surrounding section headers and context in the source text, as well as the ARUNAKI.md rules, to choose the correct row prefix (e.g. mapping "SECTION B -> TARGET_LABEL" to R75 instead of R37).';

      let workspaceRules = '';
      try {
        const arunakiPath = require('path').join(p.workspaceRootPath, '.arunaki', 'ARUNAKI.md');
        if (require('fs').existsSync(arunakiPath)) {
          workspaceRules = require('fs').readFileSync(arunakiPath, 'utf8');
        }
      } catch (e) {
        // Ignore errors if ARUNAKI.md doesn't exist
      }

      const rulesSection = workspaceRules ? `\n\nWORKSPACE RULES (ARUNAKI.md):\n${workspaceRules}` : '';
      const usrMsg = `SOURCE DATA:\n${[...p.sourceFiles].map(([f, c]) => `=== ${f} ===\n${c.slice(0, 6000)}`).join('\n\n')}\n\nAVAILABLE LABELS (copy verbatim):\n${skeleton.labels.join('\n')}\n\nDATE HEADERS: ${skeleton.dates.join(', ')}\nTARGET DATE: ${targetDate}\n\nUSER REQUEST: ${p.goal}${rulesSection}`;

      const parseJsonLoose = (rawText: string): any | null => {
        let t = rawText.trim();
        const fence = t.match(/```(?:json)?\s*([\s\S]*?)(```|$)/i);
        if (fence) t = fence[1].trim();
        
        const tryParse = (str: string) => {
          try { return JSON.parse(str); } catch { return null; }
        };
        
        const jm = t.match(/\{[\s\S]*/);
        if (!jm) return null;
        let s = jm[0];
        
        let p = tryParse(s);
        if (p) return p;
        p = tryParse(s + '}');
        if (p) return p;
        p = tryParse(s + ']}');
        if (p) return p;
        p = tryParse(s + '}]}');
        if (p) return p;
        p = tryParse(s + '"}]}');
        if (p) return p;
        
        try {
          return JSON.parse(s.replace(/,\s*([}\]])/g, '$1'));
        } catch {
          return null;
        }
      };

      let last = '';
      this.logger.log('--- USER MSG ---');
      this.logger.log(usrMsg);
      this.logger.log('----------------');

      const r = await this.aiService.chat(
        [
          { role: 'system', content: sysMsg },
          { role: 'user', content: usrMsg },
        ],
        undefined,
        {
          reasoningEffort: 'low',
        },
      );

      last = (r.content || '').trim();
      const parsed = parseJsonLoose(last);
      if (parsed) {
        this.logger.log(`[RecapFill] Extracted JSON: ${JSON.stringify(parsed)}`);
        return parsed;
      }

      this.logger.warn(`[RecapFill] SDK extraction failed: ${last.slice(0, 100)}`);
      throw new Error(`Extraction failed: ${last.slice(0, 120)}`);
    })();

    if (!Array.isArray(extraction.rows) || extraction.rows.length === 0) {
      throw new Error('Extraction JSON has no rows');
    }

    // 3. Map extracted 'Rxxx' labels back to actual text and row numbers from the skeleton
    const mappedRows = extraction.rows.map((r: any) => {
      const rawLabel = skeleton.labels.find((l: string) => {
        const lNum = l.match(/^R(\d+):/)?.[1];
        const rNum = r.label.match(/^R(\d+)/)?.[1];
        if (lNum && rNum) {
          return lNum === rNum;
        }
        const lText = l.replace(/^R\d+:\s*/, '').trim().toLowerCase();
        const rText = r.label.replace(/^R\d+:\s*/, '').trim().toLowerCase();
        return lText === rText;
      });
      const rowNum = rawLabel ? parseInt(rawLabel.match(/^R(\d+):/)?.[1] || '0', 10) : undefined;
      return {
        label: rawLabel ? rawLabel.replace(/^R\d+:\s*/, '') : r.label,
        row: rowNum,
        value: r.value,
      };
    });
    // 3.5. Post-process mappedRows to filter out past/undated Piutang/Belum Bayar (R58, R82, R45, etc.)
    const filteredMappedRows = mappedRows.map((r: any) => {
      const isPiutang = r.row === 58 || r.row === 82 || r.row === 45 || 
        (r.label && (r.label.toLowerCase().includes('belum bayar') || r.label.toLowerCase().includes('piutang')));
      if (isPiutang) {
        if (!r.value || r.value === 0) return r;
        
        const valShort = Math.floor(r.value / 1000).toString(); // e.g. 572
        const valFull = r.value.toString(); // e.g. 572000
        
        let hasTargetDate = false;
        let foundLine = false;
        
        for (const [file, content] of p.sourceFiles) {
          const lines = content.split('\n');
          for (const line of lines) {
            const cleanLine = line.toLowerCase();
            if (cleanLine.includes(valShort) || cleanLine.includes(valFull)) {
              foundLine = true;
              
              const parts = targetDate.split('/'); // ["24", "08", "2026"]
              if (parts.length === 3) {
                const day = parts[0];
                const dayInt = parseInt(day, 10).toString();
                const month = parts[1];
                const monthInt = parseInt(month, 10).toString();
                const year = parts[2];
                const yearShort = year.slice(-2);
                
                const formats = [
                  `${day}-${month}-${year}`,
                  `${dayInt}-${monthInt}-${year}`,
                  `${dayInt}-${monthInt}-${yearShort}`,
                  `${day}-${month}-${yearShort}`,
                  `${day}/${month}/${year}`,
                  `${dayInt}/${monthInt}/${year}`,
                  `${dayInt}/${monthInt}/${yearShort}`,
                  `${day}/${month}/${yearShort}`
                ];
                
                for (const fmt of formats) {
                  if (cleanLine.includes(fmt)) {
                    hasTargetDate = true;
                    break;
                  }
                }
                
                const monthsIndo = [
                  'januari', 'februari', 'maret', 'april', 'mei', 'juni',
                  'juli', 'agustus', 'september', 'oktober', 'november', 'desember'
                ];
                const mIndo = monthsIndo[parseInt(month, 10) - 1];
                if (mIndo && cleanLine.includes(mIndo) && (cleanLine.includes(dayInt) || cleanLine.includes(day))) {
                  hasTargetDate = true;
                }
              }
            }
          }
        }
        
        if (foundLine && !hasTargetDate) {
          this.logger.log(`[RecapFill] Filtering out row ${r.row} (${r.label}) with value ${r.value} because no matching target date line was found.`);
          return { ...r, value: 0 };
        }
      }
      return r;
    });

    this.logger.log(`[RecapFill] Mapped rows (${filteredMappedRows.length}): ${JSON.stringify(filteredMappedRows.slice(0, 5))}...`);
    this.logger.log(`[RecapFill] Target: file=${targetPath}, sheet=${sheetMatch?.[1] || skeleton.activeSheet}, date=${targetDate}`);

    // 4. Deterministic execution
    onEvent({
      type: 'phase_changed',
      data: { label: 'Recap fill pipeline: writing (deterministic)...' },
    });
    const res = await this.excelComService.fillTableColumn(
      targetPath,
      sheetMatch?.[1] || skeleton.activeSheet,
      targetDate,
      filteredMappedRows,
      Array.isArray(extraction.details) ? extraction.details.map(String) : [],
    );
    this.logger.log(`[RecapFill] Fill result: success=${res.success}, total=${res.itemsTotal}, failed=${res.itemsFailed}`);
    this.logger.log(`[RecapFill] Fill details: ${JSON.stringify(res.results?.slice(0, 10))}`);
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
