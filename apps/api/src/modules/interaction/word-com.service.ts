import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

export interface WordAction {
  action: string;
  // Replace text / placeholders (e.g. {{NAMA}} -> Budi)
  findText?: string;
  replaceText?: string;
  matchCase?: boolean;
  matchWholeWord?: boolean;
  // Append paragraph / headings
  text?: string;
  style?: string; // 'Heading 1', 'Heading 2', 'Normal', 'Title'
  bold?: boolean;
  italic?: boolean;
  fontSize?: number;
  color?: string; // Hex or color name
  alignment?: 'left' | 'center' | 'right' | 'justify';
  // Insert table
  tableRows?: string[][];
  headers?: string[];
  // Export PDF
  exportPdfPath?: string;
}

export interface WordActionResult {
  action: string;
  success: boolean;
  error?: string;
  details?: Record<string, any>;
}

@Injectable()
export class WordComService {
  private readonly logger = new Logger(WordComService.name);

  get isAvailable(): boolean {
    return process.platform === 'win32';
  }

  /**
   * Execute headless COM actions on a Microsoft Word (.docx / .doc) document.
   */
  async editWord(
    filePath: string,
    actions: WordAction[],
  ): Promise<{
    success: boolean;
    actionsExecuted: number;
    results: WordActionResult[];
  }> {
    if (!this.isAvailable) {
      throw new Error('Word COM automation is only available on Windows OS');
    }

    const scriptPath = join(tmpdir(), `arunaki-word-${Date.now()}.ps1`);
    try {
      const psScript = this.buildPowerShellScript(filePath, actions);
      await writeFile(scriptPath, psScript, 'utf-8');

      const { stdout, stderr } = await execAsync(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
        { timeout: 45000, maxBuffer: 1024 * 1024 },
      );

      if (stderr && stderr.trim()) {
        this.logger.warn(`PowerShell Word stderr: ${stderr.trim()}`);
      }

      const output = stdout.trim();
      const jsonStart = output.indexOf('{');
      const jsonEnd = output.lastIndexOf('}');
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        return JSON.parse(output.substring(jsonStart, jsonEnd + 1));
      }
      throw new Error(`Unexpected Word COM output: ${output.substring(0, 200)}`);
    } catch (err: any) {
      this.logger.error(`Word COM error: ${err.message}`);
      throw new Error(`Word COM automation failed: ${err.message}`);
    } finally {
      try {
        await unlink(scriptPath);
      } catch {
        /* ignore */
      }
    }
  }

  private buildPowerShellScript(
    filePath: string,
    actions: WordAction[],
  ): string {
    const escapedPath = filePath.replace(/'/g, "''");

    const actionBlocks = actions
      .map((act) => {
        switch (act.action) {
          case 'replace_text':
          case 'fill_template': {
            const find = (act.findText || '').replace(/'/g, "''");
            const replace = (act.replaceText || '').replace(/'/g, "''");
            const matchCase = act.matchCase ? '$true' : '$false';
            const matchWhole = act.matchWholeWord ? '$true' : '$false';
            return [
              `        $findObj = $doc.Content.Find`,
              `        $findObj.ClearFormatting()`,
              `        $findObj.Replacement.ClearFormatting()`,
              `        $findObj.Text = '${find}'`,
              `        $findObj.Replacement.Text = '${replace}'`,
              `        $findObj.Forward = $true`,
              `        $findObj.Wrap = 1`, // wdFindContinue = 1
              `        $findObj.MatchCase = ${matchCase}`,
              `        $findObj.MatchWholeWord = ${matchWhole}`,
              `        $findResult = $findObj.Execute([System.Reflection.Missing]::Value, [System.Reflection.Missing]::Value, [System.Reflection.Missing]::Value, [System.Reflection.Missing]::Value, [System.Reflection.Missing]::Value, [System.Reflection.Missing]::Value, [System.Reflection.Missing]::Value, [System.Reflection.Missing]::Value, [System.Reflection.Missing]::Value, [System.Reflection.Missing]::Value, 2)`, // wdReplaceAll = 2
              `        $results += @{ action='replace_text'; success=$true; find='${find}'; replace='${replace}'; executed=$findResult }`,
            ].join('\n');
          }

          case 'append_paragraph':
          case 'append_text': {
            const txt = (act.text || '').replace(/'/g, "''");
            const style = (act.style || '').replace(/'/g, "''");
            const parts: string[] = [
              `$para = $doc.Content.Paragraphs.Add()`,
              `$para.Range.Text = '${txt}'`,
            ];
            if (style) {
              parts.push(`try { $para.Range.Style = '${style}' } catch {}`);
            }
            if (act.bold !== undefined) {
              parts.push(`$para.Range.Font.Bold = ${act.bold ? '$true' : '$false'}`);
            }
            if (act.italic !== undefined) {
              parts.push(`$para.Range.Font.Italic = ${act.italic ? '$true' : '$false'}`);
            }
            if (act.fontSize) {
              parts.push(`$para.Range.Font.Size = ${act.fontSize}`);
            }
            if (act.alignment) {
              // wdAlignParagraphLeft = 0, wdAlignParagraphCenter = 1, wdAlignParagraphRight = 2, wdAlignParagraphJustify = 3
              const alignVal =
                act.alignment === 'center'
                  ? 1
                  : act.alignment === 'right'
                    ? 2
                    : act.alignment === 'justify'
                      ? 3
                      : 0;
              parts.push(`$para.Range.ParagraphFormat.Alignment = ${alignVal}`);
            }
            parts.push(`$results += @{ action='append_paragraph'; success=$true; textLength=${txt.length} }`);
            return `        ${parts.join('; ')}`;
          }

          case 'insert_table': {
            const rows = act.tableRows || [];
            const headers = act.headers || [];
            const totalRows = headers.length > 0 ? rows.length + 1 : rows.length;
            const totalCols = headers.length > 0 ? headers.length : (rows[0]?.length || 1);

            const tableCode = [
              `        $range = $doc.Content.Paragraphs.Add().Range`,
              `        $table = $doc.Tables.Add($range, ${totalRows}, ${totalCols})`,
              `        $table.Borders.Enable = $true`,
            ];

            let rowIdx = 1;
            if (headers.length > 0) {
              for (let c = 0; c < headers.length; c++) {
                const headerText = headers[c].replace(/'/g, "''");
                tableCode.push(`        $table.Cell(1, ${c + 1}).Range.Text = '${headerText}'`);
                tableCode.push(`        $table.Cell(1, ${c + 1}).Range.Font.Bold = $true`);
              }
              rowIdx = 2;
            }

            for (let r = 0; r < rows.length; r++) {
              const rowData = rows[r];
              for (let c = 0; c < rowData.length; c++) {
                const cellText = (rowData[c] || '').replace(/'/g, "''");
                tableCode.push(`        $table.Cell(${rowIdx + r}, ${c + 1}).Range.Text = '${cellText}'`);
              }
            }

            tableCode.push(`        $results += @{ action='insert_table'; success=$true; rows=${totalRows}; cols=${totalCols} }`);
            return tableCode.join('\n');
          }

          case 'export_pdf': {
            const pdfOut = (act.exportPdfPath || filePath.replace(/\.docx?$/i, '.pdf')).replace(/'/g, "''");
            // wdExportFormatPDF = 17, wdExportOptimizeForPrint = 0
            return [
              `        try {`,
              `          $doc.ExportAsFixedFormat('${pdfOut}', 17, $false, 0, 0, 1, 1, 0, $true, $true, 0, $true, $true, $false)`,
              `          $results += @{ action='export_pdf'; success=$true; pdfPath='${pdfOut}' }`,
              `        } catch {`,
              `          $results += @{ action='export_pdf'; success=$false; error=$_.Exception.Message }`,
              `        }`,
            ].join('\n');
          }

          case 'save':
            return `        $doc.Save(); $results += @{ action='save'; success=$true }`;

          default:
            return `        $results += @{ action='${act.action}'; success=$false; error='Unknown Word action' }`;
        }
      })
      .join('\n');

    return `
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $doc = $word.Documents.Open('${escapedPath}')
  $results = @()
${actionBlocks}
  $hasSave = $false
  foreach ($a in @($results)) { if ($a.action -eq 'save') { $hasSave = $true } }
  # Atomic mutation: save nothing when any action failed (prevents half-applied docs)
  $failCount = 0
  foreach ($a in @($results)) { if ($a.success -eq $false) { $failCount++ } }
  if (-not $hasSave -and $failCount -eq 0) { try { $doc.Save() } catch {} }
  @{ success=($failCount -eq 0); actionsExecuted=$results.Length; failed=$failCount; results=$results } | ConvertTo-Json -Depth 5
} catch {
  @{ success=$false; error=$_.Exception.Message } | ConvertTo-Json
} finally {
  try { $doc.Close([System.Reflection.Missing]::Value, [System.Reflection.Missing]::Value, [System.Reflection.Missing]::Value) } catch {}
  try { $word.Quit() } catch {}
  try { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null } catch {}
}
`.trim();
  }
}
