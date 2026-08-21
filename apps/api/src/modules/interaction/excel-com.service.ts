import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

export interface ExcelAction {
  action: string;
  cell?: string;
  value?: any;
  row?: number;
  column?: number;
  range?: string;
  bold?: boolean;
  italic?: boolean;
  fontSize?: number;
  bgColor?: number;
  alignment?: string;
  // Sheet management (clone, rename, delete)
  sourceSheet?: string;
  newSheetName?: string;
  clearConstants?: boolean;
}

export interface ExcelActionResult {
  action: string;
  success: boolean;
  error?: string;
  cell?: string;
  row?: number;
  column?: number;
  range?: string;
}

@Injectable()
export class ExcelComService {
  private readonly logger = new Logger(ExcelComService.name);

  get isAvailable(): boolean {
    return process.platform === 'win32';
  }

  async editExcel(
    filePath: string,
    actions: ExcelAction[],
    sheetName?: string,
  ): Promise<{
    success: boolean;
    actionsExecuted: number;
    results: ExcelActionResult[];
  }> {
    if (!this.isAvailable) {
      throw new Error('Excel COM automation only available on Windows');
    }

    const scriptPath = join(tmpdir(), `arunaki-excel-${Date.now()}.ps1`);
    try {
      const psScript = this.buildPowerShellScript(filePath, actions, sheetName);
      await writeFile(scriptPath, psScript, 'utf-8');

      const { stdout, stderr } = await execAsync(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
        { timeout: 30000, maxBuffer: 1024 * 1024 },
      );

      if (stderr && stderr.trim()) {
        this.logger.warn(`PowerShell stderr: ${stderr.trim()}`);
      }

      const output = stdout.trim();
      // Find JSON object in output (PowerShell may add extra lines)
      const jsonStart = output.indexOf('{');
      const jsonEnd = output.lastIndexOf('}');
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        return JSON.parse(output.substring(jsonStart, jsonEnd + 1));
      }
      throw new Error(`Unexpected output: ${output.substring(0, 200)}`);
    } catch (err: any) {
      this.logger.error(`Excel COM error: ${err.message}`);
      throw new Error(`Excel COM automation failed: ${err.message}`);
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
    actions: ExcelAction[],
    sheetName?: string,
  ): string {
    const escapedPath = filePath.replace(/'/g, "''");
    const escapedSheet = sheetName ? sheetName.replace(/'/g, "''") : '';

    const actionBlocks = actions
      .map((act, i) => {
        switch (act.action) {
          case 'write_cell': {
            const val =
              typeof act.value === 'string'
                ? `'${act.value.replace(/'/g, "''")}'`
                : act.value;
            return `        $cell = $ws.Range('${act.cell}'); $cell.Value2 = ${val}; $results += @{ action='write_cell'; success=$true; cell='${act.cell}' }`;
          }
          case 'insert_row':
            return `        $ws.Rows(${act.row}).Insert(); $results += @{ action='insert_row'; success=$true; row=${act.row} }`;
          case 'delete_row':
            return `        $ws.Rows(${act.row}).Delete(); $results += @{ action='delete_row'; success=$true; row=${act.row} }`;
          case 'insert_column':
            return `        $ws.Columns(${act.column}).Insert(); $results += @{ action='insert_column'; success=$true; column=${act.column} }`;
          case 'delete_column':
            return `        $ws.Columns(${act.column}).Delete(); $results += @{ action='delete_column'; success=$true; column=${act.column} }`;
          case 'set_format': {
            const rangeRef = act.range || 'A1';
            const parts: string[] = [`$rng = $ws.Range('${rangeRef}')`];
            if (act.bold !== undefined)
              parts.push(`$rng.Font.Bold = ${act.bold ? '$true' : '$false'}`);
            if (act.italic !== undefined)
              parts.push(
                `$rng.Font.Italic = ${act.italic ? '$true' : '$false'}`,
              );
            if (act.fontSize) parts.push(`$rng.Font.Size = ${act.fontSize}`);
            if (act.bgColor)
              parts.push(`$rng.Interior.ColorIndex = ${act.bgColor}`);
            if (act.alignment) {
              const hAlign =
                act.alignment === 'center'
                  ? '-4108'
                  : act.alignment === 'right'
                    ? '-4152'
                    : '-4131';
              parts.push(`$rng.HorizontalAlignment = ${hAlign}`);
            }
            parts.push(
              `$results += @{ action='set_format'; success=$true; range='${rangeRef}' }`,
            );
            return `        ${parts.join('; ')}`;
          }
          case 'clone_sheet': {
            const src = (act.sourceSheet || '').replace(/'/g, "''");
            const dst = (act.newSheetName || 'Copy').replace(/'/g, "''");
            const clearConst = act.clearConstants !== false;
            // Clone sheet: find source, copy after last sheet, rename, optionally clear constants
            return [
              `        $srcWs = $null`,
              `        foreach ($s in 1..$wb.Worksheets.Count) { if ($wb.Worksheets.Item($s).Name -ieq '${src}') { $srcWs = $wb.Worksheets.Item($s); break } }`,
              `        if ($srcWs -eq $null) { $results += @{ action='clone_sheet'; success=$false; error='Source sheet not found: ${src}' } }`,
              `        else {`,
              `          $srcWs.Copy([System.Reflection.Missing]::Value, $wb.Worksheets.Item($wb.Worksheets.Count))`,
              `          $newWs = $wb.Worksheets.Item($wb.Worksheets.Count)`,
              `          $newWs.Name = '${dst}'`,
              clearConst ? `          try { $constCells = $newWs.UsedRange.SpecialCells(2); if ($constCells -ne $null) { $constCells.ClearContents() } } catch {}` : '',
              `          $results += @{ action='clone_sheet'; success=$true; sourceSheet='${src}'; newSheet='${dst}'; clearedConstants=${clearConst ? '$true' : '$false'} }`,
              `        }`,
            ].filter(Boolean).join('\n');
          }
          case 'rename_sheet': {
            const oldName = (act.sourceSheet || '').replace(/'/g, "''");
            const newName = (act.newSheetName || '').replace(/'/g, "''");
            return [
              `        $renWs = $null`,
              `        foreach ($s in 1..$wb.Worksheets.Count) { if ($wb.Worksheets.Item($s).Name -ieq '${oldName}') { $renWs = $wb.Worksheets.Item($s); break } }`,
              `        if ($renWs -eq $null) { $results += @{ action='rename_sheet'; success=$false; error='Sheet not found: ${oldName}' } }`,
              `        else { $renWs.Name = '${newName}'; $results += @{ action='rename_sheet'; success=$true; oldName='${oldName}'; newName='${newName}' } }`,
            ].join('\n');
          }
          case 'delete_sheet': {
            const delName = (act.sourceSheet || act.newSheetName || '').replace(/'/g, "''");
            return [
              `        $delWs = $null`,
              `        foreach ($s in 1..$wb.Worksheets.Count) { if ($wb.Worksheets.Item($s).Name -ieq '${delName}') { $delWs = $wb.Worksheets.Item($s); break } }`,
              `        if ($delWs -eq $null) { $results += @{ action='delete_sheet'; success=$false; error='Sheet not found: ${delName}' } }`,
              `        else { $delWs.Delete(); $results += @{ action='delete_sheet'; success=$true; sheet='${delName}' } }`,
            ].join('\n');
          }
          case 'clear_constants': {
            // Clear numeric/text constants in active sheet (or specified range), preserving all formulas
            const clearRange = act.range ? `$ws.Range('${act.range}')` : '$ws.UsedRange';
            return `        try { $constCells = ${clearRange}.SpecialCells(2); if ($constCells -ne $null) { $constCells.ClearContents() } } catch {}; $results += @{ action='clear_constants'; success=$true }`;
          }
          case 'list_sheets': {
            return [
              `        $sheetList = @()`,
              `        foreach ($s in 1..$wb.Worksheets.Count) { $sheetList += $wb.Worksheets.Item($s).Name }`,
              `        $results += @{ action='list_sheets'; success=$true; sheets=($sheetList -join ','); count=$wb.Worksheets.Count }`,
            ].join('\n');
          }
          case 'save':
            return `        $wb.Save(); $results += @{ action='save'; success=$true }`;
          default:
            return `        $results += @{ action='${act.action}'; success=$false; error='Unknown action' }`;
        }
      })
      .join('\n');

    const sheetActivate = escapedSheet
      ? `foreach ($s in 1..$wb.Worksheets.Count) { if ($wb.Worksheets.Item($s).Name -ieq '${escapedSheet}') { $wb.Worksheets.Item($s).Activate(); break } }`
      : '';

    return `
try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $wb = $excel.Workbooks.Open('${escapedPath}')
  ${sheetActivate}
  $ws = $wb.ActiveSheet
  $results = @()
${actionBlocks}
  $hasSave = $false
  foreach ($a in @($results)) { if ($a.action -eq 'save') { $hasSave = $true } }
  if (-not $hasSave) { try { $wb.Save() } catch {} }
  @{ success=$true; actionsExecuted=$results.Length; results=$results } | ConvertTo-Json -Depth 5
} catch {
  @{ success=$false; error=$_.Exception.Message } | ConvertTo-Json
} finally {
  try { $wb.Close($false) } catch {}
  try { $excel.Quit() } catch {}
  try { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null } catch {}
}
`.trim();
  }
}
