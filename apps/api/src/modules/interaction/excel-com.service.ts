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
  sheetName?: string;
  matchColumn?: string;
  matchValue?: string;
  targetColumn?: string;
  delta?: boolean;
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
  rowData?: any[];
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
    actions = Array.isArray(actions) ? actions : [actions];
    if (!this.isAvailable) {
      throw new Error('Excel COM automation only available on Windows');
    }

    const scriptPath = join(tmpdir(), `arunaki-excel-${Date.now()}.ps1`);
    try {
      const psScript = this.buildPowerShellScript(filePath, actions, sheetName);
      await writeFile(scriptPath, psScript, 'utf-8');

      // Single retry: first COM attempt can hang (e.g. a stale Excel.exe from a
      // previous run blocks Workbooks.Open) and succeed immediately afterwards.
      let stdout = '';
      let stderr = '';
      let lastErr: any;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const { stdout: out, stderr: errOut } = await execAsync(
            `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
            { timeout: 30000, maxBuffer: 1024 * 1024 },
          );
          stdout = out;
          stderr = errOut;
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
        }
      }
      if (lastErr) {
        throw lastErr;
      }

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

    // Guard: refuse untargeted mutations on multi-sheet workbooks — writing to
    // "whatever sheet is active" silently corrupts the wrong sheet.
    const MUTATING_ACTIONS = [
      'write_cell', 'append_row', 'insert_row', 'delete_row',
      'insert_column', 'delete_column', 'set_format', 'clear_constants',
    ];
    const needsSheetGuard =
      !escapedSheet &&
      !actions.every((a) => !MUTATING_ACTIONS.includes(a.action) || a.sheetName) &&
      actions.some((a) => MUTATING_ACTIONS.includes(a.action)) &&
      !actions.some((a) => a.action === 'clone_sheet' || a.action === 'delete_sheet');

    // Per-action sheet activation: an action may carry its own sheetName.
    // Unknown sheet names MUST fail loudly — falling back to the active sheet
    // silently writes data into the wrong sheet.
    const activateSheetLine = (name?: string): string => {
      if (!name) return '';
      const esc = name.replace(/'/g, "''");
      return [
        `        $sheetFound = $false`,
        `        foreach ($s in 1..$wb.Worksheets.Count) { if ($wb.Worksheets.Item($s).Name -ieq '${esc}') { $wb.Worksheets.Item($s).Activate(); $ws = $wb.Worksheets.Item($s); $sheetFound = $true; break } }`,
        `        if (-not $sheetFound) { throw ("Sheet not found: '${esc}'. Available sheets: " + ((1..$wb.Worksheets.Count | ForEach-Object { $wb.Worksheets.Item($_).Name }) -join ', ')) }`,
      ].join('\n');
    };

    const sheetGuardBlock = needsSheetGuard
      ? `if ($wb.Worksheets.Count -gt 1) { throw ('sheetName is required for this action because the workbook has multiple sheets: ' + ((1..$wb.Worksheets.Count | ForEach-Object { $wb.Worksheets.Item($_).Name }) -join ', ')) }`
      : '';

    const actionBlocks = actions
      .map((act, i) => {
        const block = this.buildActionBlock(act, filePath, i);
        return [activateSheetLine(act.sheetName), block]
          .filter(Boolean)
          .join('\n');
      })
      .join('\n');

    const sheetActivate = escapedSheet
      ? [
          `$topFound = $false`,
          `foreach ($s in 1..$wb.Worksheets.Count) { if ($wb.Worksheets.Item($s).Name -ieq '${escapedSheet}') { $wb.Worksheets.Item($s).Activate(); $topFound = $true; break } }`,
          `if (-not $topFound) { throw ("Sheet not found: '${escapedSheet}'. Available sheets: " + ((1..$wb.Worksheets.Count | ForEach-Object { $wb.Worksheets.Item($_).Name }) -join ', ')) }`,
        ].join('\n')
      : '';

    const scriptContent = `
try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $wb = $excel.Workbooks.Open('${escapedPath}')
  ${sheetGuardBlock}
  ${sheetActivate}
  $ws = $wb.ActiveSheet
  $results = @()
${actionBlocks}
  $hasSave = $false
  foreach ($a in @($results)) { if ($a.action -eq 'save') { $hasSave = $true } }
  if (-not $hasSave) { try { $wb.Save() } catch {} }
  $sheetList = @()
  foreach ($s in 1..$wb.Worksheets.Count) { $sheetList += $wb.Worksheets.Item($s).Name }
  $hdrList = @()
  try { for ($c = 1; $c -le [Math]::Min($ws.UsedRange.Columns.Count, 40); $c++) { $hdrList += [string]$ws.Cells.Item(1, $c).Text } } catch {}
  @{ success=$true; actionsExecuted=$results.Length; results=$results; sheets=($sheetList -join ', '); activeSheet=$ws.Name; headers=($hdrList -join ' | ') } | ConvertTo-Json -Depth 5
} catch {
  @{ success=$false; error=$_.Exception.Message } | ConvertTo-Json
} finally {
  try { $wb.Close($false) } catch {}
  try { $excel.Quit() } catch {}
  try { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($wb) | Out-Null } catch {}
  try { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null } catch {}
  try { [GC]::Collect(); [GC]::WaitForPendingFinalizers() } catch {}
}`;
    return scriptContent;
  }


  private buildActionBlock(
    act: ExcelAction,
    filePath: string,
    idx: number,
  ): string {
    switch (act.action) {
          case 'write_cell': {
            // Label-based write: resolve row by matching a column's header + value,
            // so the LLM never has to guess coordinates.
            if (act.matchColumn && act.matchValue !== undefined) {
              const mc = (act.matchColumn || '').replace(/'/g, "''");
              const tc = (act.targetColumn || act.matchColumn).replace(/'/g, "''");
              const mv = (act.matchValue ?? '').toString().replace(/'/g, "''");
              if (typeof act.value === 'string' && act.value.startsWith('=')) {
                return [
                  `        $mCol = 0; $tCol = 0; $tgtRow = 0`,
                  `        for ($c = 1; $c -le [Math]::Min($ws.UsedRange.Columns.Count, 100); $c++) {`,
                  `          $h = [string]$ws.Cells.Item(1, $c).Text`,
                  `          if ($h -ieq '${mc}') { $mCol = $c }`,
                  `          if ($h -ieq '${tc}') { $tCol = $c }`,
                  `        }`,
                `        if ($mCol -gt 0) { for ($r = 2; $r -le [Math]::Min($ws.UsedRange.Rows.Count, 500); $r++) { if ([string]$ws.Cells.Item($r, $mCol).Text -ieq '${mv}') { $tgtRow = $r; break } } }`,
                `        if ($tgtRow -eq 0) { for ($r = 1; $r -le [Math]::Min($ws.UsedRange.Rows.Count, 500) -and $tgtRow -eq 0; $r++) { for ($c = 1; $c -le [Math]::Min($ws.UsedRange.Columns.Count, 100); $c++) { if ([string]$ws.Cells.Item($r, $c).Text -ieq '${mv}') { $tgtRow = $r; break } } } }`,
                  `        if ($tgtRow -gt 0 -and $tCol -gt 0) { $ws.Cells.Item($tgtRow, $tCol).Formula = '${act.value.replace(/'/g, "''")}'; $results += @{ action='write_cell'; success=$true; row=$tgtRow; column=$tCol } }`,
                  `        else { $results += @{ action='write_cell'; success=$false; error='Match row or target column not found (matchColumn=${mc}, matchValue=${mv})' } }`,
                ].join('\n');
              }
              let mval: any;
              if (typeof act.value === 'string') {
                mval = `'${act.value.replace(/'/g, "''")}'`;
              } else if (typeof act.value === 'boolean') {
                mval = act.value ? '$true' : '$false';
              } else if (act.value === null || act.value === undefined) {
                mval = '$null';
              } else if (typeof act.value === 'number') {
                // PS COM binder mis-marshals raw Int32 vars; explicit Double is stable
                mval = `[double]${act.value}`;
              } else {
                mval = act.value;
              }
              return [
                `        $mCol = 0; $tCol = 0; $tgtRow = 0`,
                `        for ($c = 1; $c -le [Math]::Min($ws.UsedRange.Columns.Count, 100); $c++) {`,
                `          $h = [string]$ws.Cells.Item(1, $c).Text`,
                `          if ($h -ieq '${mc}') { $mCol = $c }`,
                `          if ($h -ieq '${tc}') { $tCol = $c }`,
                `        }`,
                `        if ($mCol -gt 0) { for ($r = 2; $r -le [Math]::Min($ws.UsedRange.Rows.Count, 500); $r++) { if ([string]$ws.Cells.Item($r, $mCol).Text -ieq '${mv}') { $tgtRow = $r; break } } }`,
                `        if ($tgtRow -gt 0 -and $tCol -gt 0) {`,
                `          if (${act.delta ? '$true' : '$false'}) { $d${idx} = [double]$ws.Cells.Item($tgtRow, $tCol).Value2 + ${mval}; Invoke-Expression ('$ws.Cells.Item(' + $tgtRow + ',' + $tCol + ').Value2 = ' + $d${idx}) }`,
                `          else { $ws.Cells.Item($tgtRow, $tCol).Value2 = ${mval} }`,
                `          $results += @{ action='write_cell'; success=$true; row=$tgtRow; column=$tCol }`,
                `        }`,
                `        else { $results += @{ action='write_cell'; success=$false; error='Match row or target column not found (matchColumn=${mc}, matchValue=${mv})' } }`,
              ].join('\n');
            }
            const cellCoord = act.cell || 'A1';
            if (typeof act.value === 'string' && act.value.startsWith('=')) {
              return `        $ws.Range('${cellCoord}').Formula = '${act.value.replace(/'/g, "''")}'; $results += @{ action='write_cell'; success=$true; cell='${cellCoord}' }`;
            }
            let val: any;
            if (typeof act.value === 'string') {
              val = `'${act.value.replace(/'/g, "''")}'`;
            } else if (typeof act.value === 'boolean') {
              val = act.value ? '$true' : '$false';
            } else if (act.value === null || act.value === undefined) {
              val = '$null';
            } else if (typeof act.value === 'number') {
              // PS COM binder mis-marshals raw Int32 vars; explicit Double is stable
              val = `[double]${act.value}`;
            } else {
              val = act.value;
            }
            return [
              `        if (${act.delta ? '$true' : '$false'}) { $d${idx} = [double]$ws.Range('${cellCoord}').Value2 + ${val}; Invoke-Expression ('$ws.Range(''${cellCoord}'').Value2 = ' + $d${idx}) }`,
              `        else { $ws.Range('${cellCoord}').Value2 = ${val} }`,
              `        $results += @{ action='write_cell'; success=$true; cell='${cellCoord}' }`,
            ].join('\n');
          }
          case 'find_cell': {
            // Locate the first cell whose text matches act.matchValue; returns its address
            const needle = ((act.matchValue ?? act.value ?? '') as string).toString().replace(/'/g, "''");
            return [
              `        $found${idx} = $null`,
              `        $ur${idx} = $ws.UsedRange`,
              `        for ($r = 1; $r -le [Math]::Min($ur${idx}.Rows.Count, 500); $r++) {`,
              `          for ($c = 1; $c -le [Math]::Min($ur${idx}.Columns.Count, 60); $c++) {`,
              `            if ([string]$ws.Cells.Item($r, $c).Text -ieq '${needle}') { $found${idx} = $ws.Cells.Item($r, $c).Address($false, $false); break }`,
              `          }`,
              `          if ($found${idx} -ne $null) { break }`,
              `        }`,
              `        if ($found${idx} -ne $null) { $results += @{ action='find_cell'; success=$true; search='${needle}'; cell=$found${idx}; row=$r; column=$c } }`,
              `        else { $results += @{ action='find_cell'; success=$false; error='Text not found: ${needle}' } }`,
            ].join('\n');
          }
          case 'read_cell': {
            const cellCoord = act.cell || 'A1';
            return `        $cellVal${idx} = $ws.Range('${cellCoord}').Text; $results += @{ action='read_cell'; success=$true; cell='${cellCoord}'; value=$cellVal${idx} }`;
          }
          case 'read_range': {
            const rangeRef = act.range ? act.range.replace(/'/g, "''") : '';
            const rngExpr = rangeRef ? `$ws.Range('${rangeRef}')` : `$ws.UsedRange`;
            return [
              `        $rowsArr${idx} = @()`,
              `        $maxR = [Math]::Min(${rngExpr}.Rows.Count, 150)`,
              `        $maxC = [Math]::Min(${rngExpr}.Columns.Count, 40)`,
              `        for ($rIdx = 1; $rIdx -le $maxR; $rIdx++) {`,
              `          $cVals${idx} = @()`,
              `          for ($cIdx = 1; $cIdx -le $maxC; $cIdx++) {`,
              `            $cVals${idx} += ${rngExpr}.Cells.Item($rIdx, $cIdx).Text`,
              `          }`,
              `          $rowsArr${idx} += ($cVals${idx} -join ' | ')`,
              `        }`,
              `        $results += @{ action='read_range'; success=$true; range='${rangeRef}'; rows=($rowsArr${idx} -join [Environment]::NewLine) }`,
            ].join('\n');
          }
          case 'append_row': {
            const colIndex = act.column || 1;
            // Models may send: rowData[] | comma string | single object keyed by header name
            const isHeaderObject =
              act.value !== null &&
              typeof act.value === 'object' &&
              !Array.isArray(act.value);
            let arrSource: string;
            if (isHeaderObject) {
              const entries = Object.entries(act.value as Record<string, any>).map(([k, v]) => {
                const kk = k.replace(/'/g, "''");
                if (typeof v === 'string') return `'${kk}' = '${v.replace(/'/g, "''")}'`;
                return `'${kk}' = ${v}`;
              });
              arrSource = [
                `  $obj${0} = @{ ${entries.join('; ')} }`,
                `  $arr = @()`,
                `  for ($hc = 1; $hc -le [Math]::Min($ws.UsedRange.Columns.Count, 100); $hc++) {`,
                `    $hh = [string]$ws.Cells.Item(1, $hc).Text`,
                `    foreach ($hk in $obj${0}.Keys) { if ($hh -ieq $hk) { $arr += $obj${0}[$hk]; break } }`,
                `  }`,
              ].join('\n');
            } else {
              // Models sometimes send a single comma-joined string instead of rowData[]
              const effectiveRowData = Array.isArray(act.rowData)
                ? act.rowData
                : typeof act.value === 'string' && act.value.includes(',')
                  ? (act.value as string).split(',').map(s => s.trim())
                  : act.rowData;
              const rowDataStr = Array.isArray(effectiveRowData)
                ? `@(${effectiveRowData.map(v => {
                   if (v === null || v === undefined) return '$null';
                   if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
                   return v;
                }).join(', ')})` : '@()';
              arrSource = `  $arr = ${rowDataStr}`;
            }

            return [
              `        $lastRow = [int]($ws.Cells.Item([int]$ws.Rows.Count, [int]${colIndex}).End(-4162).Row)`,
              `        $targetRow = $lastRow + 1`,
              `        if ($lastRow -ge 2) {`,
              `          $ne = 0; $tx = 0`,
              `          for ($c = 1; $c -le [Math]::Min($ws.UsedRange.Columns.Count, 100); $c++) {`,
              `            $t = [string]$ws.Cells.Item($lastRow, $c).Text`,
              `            if ($t.Trim() -ne '') { $ne++; $d = 0.0; if (-not [double]::TryParse($t, [ref]$d)) { $tx++ } }`,
              `          }`,
              `          if ($ne -ge 1 -and $ne -le 2 -and $tx -ge 1) { $ws.Rows($lastRow).Insert() | Out-Null; $targetRow = $lastRow; $summaryShifted = $true }`,
              `        }`,
              arrSource,
              `        for ($i = 0; $i -lt $arr.Length; $i++) {`,
              `          if ($arr[$i] -ne $null -and $arr[$i] -ne '') {`,
              `            $val = $arr[$i]`,
              `            $c = [int](${colIndex} + $i)`,
              `            $r = [int]$targetRow`,
              `            if ($val -is [int] -or $val -is [double]) {`,
              `              $ws.Cells.Item($r, $c).Value2 = [double]$val`,
              `            } elseif ($val -is [bool]) {`,
              `              $ws.Cells.Item($r, $c).Value2 = [bool]$val`,
              `            } else {`,
              `              $ws.Cells.Item($r, $c).Value2 = [string]$val`,
              `            }`,
              `          }`,
              `        }`,
              `        if ($summaryShifted) { $results += @{ action='append_row'; success=$true; targetRow=$targetRow; columnStart=${colIndex}; note='a summary/total row was shifted down - recompute its totals now (rewrite its =SUM formula)' } } else { $results += @{ action='append_row'; success=$true; targetRow=$targetRow; columnStart=${colIndex} } }`,
            ].join('\n');
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
            // Models sometimes nest format props inside value:{} — merge them
            if (act.value && typeof act.value === 'object' && !Array.isArray(act.value)) {
              const v = act.value as Record<string, any>;
              act = {
                ...act,
                bold: act.bold ?? v.bold,
                italic: act.italic ?? v.italic,
                fontSize: act.fontSize ?? v.fontSize,
                bgColor: act.bgColor ?? v.bgColor,
                alignment: act.alignment ?? v.alignment,
              };
            }
            const rangeRef = act.range || 'A1';
            const rngExpr = `$ws.Range('${rangeRef}')`;
            const parts: string[] = [];
            if (act.bold !== undefined)
              parts.push(`${rngExpr}.Font.Bold = ${act.bold ? '$true' : '$false'}`);
            if (act.italic !== undefined)
              parts.push(
                `${rngExpr}.Font.Italic = ${act.italic ? '$true' : '$false'}`,
              );
            if (act.fontSize) parts.push(`${rngExpr}.Font.Size = ${act.fontSize}`);
            if (act.bgColor)
              parts.push(`${rngExpr}.Interior.ColorIndex = ${act.bgColor}`);
            if (act.alignment) {
              const hAlign =
                act.alignment === 'center'
                  ? '-4108'
                  : act.alignment === 'right'
                    ? '-4152'
                    : '-4131';
              parts.push(`${rngExpr}.HorizontalAlignment = ${hAlign}`);
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
          case 'export_pdf': {
            const pdfOut = (act.range || filePath.replace(/\.xlsx?$/i, '.pdf')).replace(/'/g, "''");
            // xlTypePDF = 0, xlQualityStandard = 0
            return [
              `        try {`,
              `          $wb.ExportAsFixedFormat(0, '${pdfOut}')`,
              `          $results += @{ action='export_pdf'; success=$true; pdfPath='${pdfOut}' }`,
              `        } catch {`,
              `          $results += @{ action='export_pdf'; success=$false; error=$_.Exception.Message }`,
              `        }`,
            ].join('\n');
          }
          case 'save':
            return `        $wb.Save(); $results += @{ action='save'; success=$true }`;
          default:
            return `        $results += @{ action='${act.action}'; success=$false; error='Unknown action' }`;
    }
  }
}

