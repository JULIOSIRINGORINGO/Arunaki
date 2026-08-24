import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

export interface PptAction {
  action: string;
  // Replace text across slides
  findText?: string;
  replaceText?: string;
  // Add slide
  title?: string;
  content?: string[]; // Bullet points or paragraphs
  slideIndex?: number;
  // Export PDF
  exportPdfPath?: string;
}

export interface PptActionResult {
  action: string;
  success: boolean;
  error?: string;
  details?: Record<string, any>;
}

@Injectable()
export class PptComService {
  private readonly logger = new Logger(PptComService.name);

  get isAvailable(): boolean {
    return process.platform === 'win32';
  }

  /**
   * Execute headless COM actions on a Microsoft PowerPoint (.pptx / .ppt) presentation.
   */
  async editPpt(
    filePath: string,
    actions: PptAction[],
  ): Promise<{
    success: boolean;
    actionsExecuted: number;
    results: PptActionResult[];
  }> {
    if (!this.isAvailable) {
      throw new Error('PowerPoint COM automation is only available on Windows OS');
    }

    const scriptPath = join(tmpdir(), `arunaki-ppt-${Date.now()}.ps1`);
    try {
      const psScript = this.buildPowerShellScript(filePath, actions);
      await writeFile(scriptPath, psScript, 'utf-8');

      const { stdout, stderr } = await execAsync(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
        { timeout: 45000, maxBuffer: 1024 * 1024 },
      );

      if (stderr && stderr.trim()) {
        this.logger.warn(`PowerShell PPT stderr: ${stderr.trim()}`);
      }

      const output = stdout.trim();
      const jsonStart = output.indexOf('{');
      const jsonEnd = output.lastIndexOf('}');
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        return JSON.parse(output.substring(jsonStart, jsonEnd + 1));
      }
      throw new Error(`Unexpected PPT COM output: ${output.substring(0, 200)}`);
    } catch (err: any) {
      this.logger.error(`PPT COM error: ${err.message}`);
      throw new Error(`PowerPoint COM automation failed: ${err.message}`);
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
    actions: PptAction[],
  ): string {
    const escapedPath = filePath.replace(/'/g, "''");

    const actionBlocks = actions
      .map((act) => {
        switch (act.action) {
          case 'replace_text':
          case 'fill_template': {
            const find = (act.findText || '').replace(/'/g, "''");
            const replace = (act.replaceText || '').replace(/'/g, "''");
            return [
              `        $replacedCount = 0`,
              `        foreach ($slide in $pres.Slides) {`,
              `          foreach ($shape in $slide.Shapes) {`,
              `            if ($shape.HasTextFrame -and $shape.TextFrame.HasText) {`,
              `              $tr = $shape.TextFrame.TextRange`,
              `              if ($tr.Text -match '${find}') {`,
              `                $tr.Replace('${find}', '${replace}') | Out-Null`,
              `                $replacedCount++`,
              `              }`,
              `            }`,
              `          }`,
              `        }`,
              `        $results += @{ action='replace_text'; success=$true; find='${find}'; replace='${replace}'; count=$replacedCount }`,
            ].join('\n');
          }

          case 'add_slide': {
            const titleText = (act.title || 'Slide Baru').replace(/'/g, "''");
            const bullets = (act.content || []).map((b) => b.replace(/'/g, "''")).join('`n');
            // ppLayoutText = 2
            return [
              `        $slideCount = $pres.Slides.Count`,
              `        $newSlide = $pres.Slides.Add($slideCount + 1, 2)`,
              `        if ($newSlide.Shapes.HasTitle) { $newSlide.Shapes.Title.TextFrame.TextRange.Text = '${titleText}' }`,
              bullets ? `        if ($newSlide.Shapes.Count -ge 2) { $newSlide.Shapes.Item(2).TextFrame.TextRange.Text = '${bullets}' }` : '',
              `        $results += @{ action='add_slide'; success=$true; title='${titleText}'; slideNumber=($slideCount + 1) }`,
            ].filter(Boolean).join('\n');
          }

          case 'export_pdf': {
            const pdfOut = (act.exportPdfPath || filePath.replace(/\.pptx?$/i, '.pdf')).replace(/'/g, "''");
            // ppSaveAsPDF = 32
            return [
              `        try {`,
              `          $pres.SaveAs('${pdfOut}', 32)`,
              `          $results += @{ action='export_pdf'; success=$true; pdfPath='${pdfOut}' }`,
              `        } catch {`,
              `          $results += @{ action='export_pdf'; success=$false; error=$_.Exception.Message }`,
              `        }`,
            ].join('\n');
          }

          case 'save':
            return `        $pres.Save(); $results += @{ action='save'; success=$true }`;

          default:
            return `        $results += @{ action='${act.action}'; success=$false; error='Unknown PPT action' }`;
        }
      })
      .join('\n');

    return `
try {
  $ppt = New-Object -ComObject PowerPoint.Application
  $pres = $ppt.Presentations.Open('${escapedPath}', [Microsoft.Office.Core.MsoTriState]::msoFalse, [Microsoft.Office.Core.MsoTriState]::msoFalse, [Microsoft.Office.Core.MsoTriState]::msoFalse)
  $results = @()
${actionBlocks}
  $hasSave = $false
  foreach ($a in @($results)) { if ($a.action -eq 'save') { $hasSave = $true } }
  # Atomic mutation: save nothing when any action failed (prevents half-applied decks)
  $failCount = 0
  foreach ($a in @($results)) { if ($a.success -eq $false) { $failCount++ } }
  if (-not $hasSave -and $failCount -eq 0) { try { $pres.Save() } catch {} }
  @{ success=($failCount -eq 0); actionsExecuted=$results.Length; failed=$failCount; results=$results } | ConvertTo-Json -Depth 5
} catch {
  @{ success=$false; error=$_.Exception.Message } | ConvertTo-Json
} finally {
  try { $pres.Close() } catch {}
  try { $ppt.Quit() } catch {}
  try { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($ppt) | Out-Null } catch {}
}
`.trim();
  }
}
