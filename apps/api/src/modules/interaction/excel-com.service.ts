import { Injectable, Logger } from '@nestjs/common';
import { exec, spawn } from 'child_process';
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
  /** Serializes COM access per workbook — two Excel instances on one file silently lose writes. */
  private readonly fileLocks = new Map<string, Promise<unknown>>();

  private async withFileLock<T>(
    filePath: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const key = filePath.toLowerCase();
    const prev = this.fileLocks.get(key) ?? Promise.resolve();
    const release = (() => {
      let releaseFn!: () => void;
      const gate = new Promise<void>((r) => (releaseFn = r));
      this.fileLocks.set(
        key,
        prev.then(() => gate),
      );
      return { gate, releaseFn };
    })();
    try {
      await prev;
      return await fn();
    } finally {
      release.releaseFn();
      // Drop the chain entry once it's the tail to avoid unbounded growth
      if ((this.fileLocks.get(key) ?? Promise.resolve()) === release.gate) {
        /* still referenced by next waiter; leave cleanup opportunistic */
      }
    }
  }

  /**
   * Runs the PS script, killing the whole process tree on timeout so the
   * COM-launched EXCEL.EXE cannot survive as a zombie holding the workbook.
   * Returns { stdout, stderr, timedOut, elapsedMs }.
   */
  private runPsScript(
    scriptPath: string,
    timeoutMs: number,
  ): Promise<{
    stdout: string;
    stderr: string;
    timedOut: boolean;
    elapsedMs: number;
  }> {
    return new Promise((resolve) => {
      const start = Date.now();
      const child = spawn('powershell', [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        scriptPath,
      ]);
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let settled = false;
      const timer = setTimeout(() => {
        timedOut = true;
        // /T kills the full tree (EXCEL.EXE included), /F forces
        try {
          exec(`taskkill /PID ${child.pid} /T /F`, () => {});
        } catch {
          /* ignore */
        }
      }, timeoutMs);
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ stdout, stderr, timedOut, elapsedMs: Date.now() - start });
      };
      child.stdout.on('data', (d) => (stdout += d.toString()));
      child.stderr.on('data', (d) => (stderr += d.toString()));
      child.on('close', () => finish());
      child.on('error', () => finish());
    });
  }

  get isAvailable(): boolean {
    return process.platform === 'win32';
  }

  private static readonly CELL_RE = /^\$?[A-Za-z]{1,3}\$?\d{1,7}$/;
  private static readonly RANGE_RE =
    /^\$?[A-Za-z]{1,3}\$?\d{0,7}(:\$?[A-Za-z]{1,3}\$?\d{1,7})?$/;

  /**
   * Validates LLM-supplied action fields that would otherwise be interpolated
   * raw into the generated PowerShell script (injection surface).
   */
  private sanitizeActions(
    actions: ExcelAction[],
  ): { clean: ExcelAction[]; rejected: Array<{ index: number; error: string }> } {
    const intIn = (v: any, min: number, max: number): number | null => {
      const n = Number(v);
      return Number.isInteger(n) && n >= min && n <= max ? n : null;
    };
    const clean: ExcelAction[] = [];
    const rejected: Array<{ index: number; error: string }> = [];
    for (let i = 0; i < actions.length; i++) {
      const raw = actions[i];
      let a: ExcelAction = { ...raw };
      const fail = (msg: string) =>
        rejected.push({
          index: i,
          error: `${msg} (action=${String(raw.action).slice(0, 24)})`,
        });
      switch (a.action) {
        case 'write_cell':
        case 'read_cell': {
          if (a.matchColumn && a.matchValue !== undefined) break;
          if (!a.cell || !ExcelComService.CELL_RE.test(a.cell.trim())) {
            fail(
              a.cell
                ? `Invalid cell reference "${String(a.cell).slice(0, 24)}"`
                : 'cell is required',
            );
            continue;
          }
          a.cell = a.cell.trim();
          break;
        }
        case 'read_range':
        case 'set_format':
        case 'clear_constants': {
          if (a.range && !ExcelComService.RANGE_RE.test(a.range.replace(/\s+/g, ''))) {
            fail(`Invalid range "${String(a.range).slice(0, 32)}"`);
            continue;
          }
          if (a.action === 'set_format') {
            if (a.fontSize !== undefined) {
              const fsz = intIn(a.fontSize, 1, 409);
              if (fsz === null) {
                fail('fontSize must be an integer between 1 and 409');
                continue;
              }
              a.fontSize = fsz;
            }
            if (a.bgColor !== undefined) {
              const bg = intIn(a.bgColor, 0, 16777215);
              if (bg === null) {
                fail('bgColor must be an integer color value');
                continue;
              }
              a.bgColor = bg;
            }
          }
          break;
        }
        case 'insert_row':
        case 'delete_row': {
          const r = intIn(a.row, 1, 1048576);
          if (r === null) {
            fail('row must be an integer between 1 and 1048576');
            continue;
          }
          a.row = r;
          break;
        }
        case 'insert_column':
        case 'delete_column': {
          const c = intIn(a.column, 1, 16384);
          if (c === null) {
            fail('column must be an integer between 1 and 16384');
            continue;
          }
          a.column = c;
          break;
        }
        case 'append_row': {
          if (a.column !== undefined) {
            const ci = intIn(a.column, 1, 16384);
            if (ci === null) {
              fail('column must be an integer between 1 and 16384');
              continue;
            }
            a.column = ci;
          }
          break;
        }
        case 'find_cell': {
          const needle = String(a.matchValue ?? a.value ?? '').trim();
          if (!needle || needle.length > 200) {
            fail('matchValue (search text) is required, max 200 chars');
            continue;
          }
          a.matchValue = needle;
          break;
        }
      }
      clean.push(a);
    }
    return { clean, rejected };
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

    // Security: strip actions whose fields would inject into the PS script
    const { clean: validActions, rejected } = this.sanitizeActions(actions);
    if (validActions.length === 0) {
      return {
        success: false,
        actionsExecuted: rejected.length,
        results: rejected.map((r) => ({
          action: 'validation',
          success: false,
          error: r.error,
        })),
      };
    }

    return this.withFileLock(filePath, async () => {
      const scriptPath = join(
        tmpdir(),
        `arunaki-excel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.ps1`,
      );
      try {
        const psScript = this.buildPowerShellScript(
          filePath,
          validActions,
          sheetName,
        );
        // BOM is required: PowerShell 5.1 reads BOM-less files in the system
        // ANSI codepage, corrupting any non-ASCII cell values.
        await writeFile(scriptPath, '\uFEFF' + psScript, 'utf-8');

        // Single retry ONLY for fast startup failures (<5s — COM instantiation
        // hiccups). Never retry slow/timeouts: the script may have partially
        // executed and saved; rerunning would duplicate mutations.
        let stdout = '';
        let stderr = '';
        for (let attempt = 0; attempt < 2; attempt++) {
          const { stdout: out, stderr: errOut, timedOut, elapsedMs } =
            await this.runPsScript(scriptPath, 30000);
          stdout = out;
          stderr = errOut;
          const hasJson = stdout.includes('{') && stdout.includes('}');
          if (hasJson) break;
          if (timedOut || elapsedMs >= 5000 || attempt === 1) {
            if (timedOut) {
              throw new Error(
                `Excel COM script timed out after ${elapsedMs}ms and was terminated`,
              );
            }
            if (attempt === 1) break;
          }
        }

        if (stderr && stderr.trim()) {
          this.logger.warn(`PowerShell stderr: ${stderr.trim()}`);
        }

      const output = stdout.trim();
      // Find JSON object in output (PowerShell may add extra lines)
      const jsonStart = output.indexOf('{');
      const jsonEnd = output.lastIndexOf('}');
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const parsed = JSON.parse(output.substring(jsonStart, jsonEnd + 1));
        if (rejected.length > 0 && Array.isArray(parsed.results)) {
          const rejectionResults = rejected.map((r) => ({
            action: 'validation',
            success: false,
            error: r.error,
          }));
          parsed.results = [...rejectionResults, ...parsed.results];
          parsed.actionsExecuted = parsed.results.length;
        }
        return parsed;
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
    });
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

    const sheetActivate = escapedSheet
      ? [
          `$topFound = $false`,
          `foreach ($s in 1..$wb.Worksheets.Count) { if ($wb.Worksheets.Item($s).Name -ieq '${escapedSheet}') { $wb.Worksheets.Item($s).Activate(); $topFound = $true; break } }`,
          `if (-not $topFound) { throw ("Sheet not found: '${escapedSheet}'. Available sheets: " + ((1..$wb.Worksheets.Count | ForEach-Object { $wb.Worksheets.Item($_).Name }) -join ', ')) }`,
        ].join('\n')
      : '';

    // Per-action error isolation: one failing action records a failure result
    // instead of aborting the whole batch (previous successes still save).
    const MUTATING = new Set([
      'write_cell', 'append_row', 'insert_row', 'delete_row',
      'insert_column', 'delete_column', 'set_format', 'clear_constants',
    ]);
    const hasMutating = actions.some((a) => MUTATING.has(a.action));
    const wrappedBlocks = actions
      .map((act, i) => {
        const block = this.buildActionBlock(act, filePath, i);
        const wrapped = [
          `  try {`,
          block,
          `  } catch {`,
          `    $results += @{ action='${act.action}'; success=$false; error=$_.Exception.Message }`,
          `  }`,
        ].join('\n');
        return [activateSheetLine(act.sheetName), wrapped]
          .filter(Boolean)
          .join('\n');
      })
      .join('\n');

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
${wrappedBlocks}
  $hasSave = $false
  foreach ($a in @($results)) { if ($a.action -eq 'save') { $hasSave = $true } }
  # Read-only batches must not rewrite the source file
  if (-not $hasSave -and ${hasMutating ? '$true' : '$false'}) { try { $wb.Save() } catch {} }
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
                `        if ($tgtRow -eq 0) { for ($r = 2; $r -le [Math]::Min($ws.UsedRange.Rows.Count, 500) -and $tgtRow -eq 0; $r++) { for ($c = 1; $c -le [Math]::Min($ws.UsedRange.Columns.Count, 100); $c++) { if ([string]$ws.Cells.Item($r, $c).Text -ieq '${mv}') { $tgtRow = $r; break } } } }`,
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
            // (`values` is a common plural alias models emit)
            const valueSrc =
              (act as any).value ??
              (act as any).values ??
              (act as any).data;
            const isHeaderObject =
              valueSrc !== null &&
              typeof valueSrc === 'object' &&
              !Array.isArray(valueSrc);
            let arrSource: string;
            if (isHeaderObject) {
              const entries = Object.entries(valueSrc as Record<string, any>).map(([k, v]) => {
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
                : typeof valueSrc === 'string' && valueSrc.includes(',')
                  ? (valueSrc as string).split(',').map(s => s.trim())
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
              `            if ($t.Trim() -ne '') {`,
              `              $ne++;`,
              `              $v = $ws.Cells.Item($lastRow, $c).Value2`,
              `              if (-not ($v -is [double] -or $v -is [int])) { $tx++ }`,
              `            }`,
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
                range: act.range ?? v.range,
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
            if (act.fontSize !== undefined)
              parts.push(`${rngExpr}.Font.Size = ${act.fontSize}`);
            if (act.bgColor !== undefined) {
              // ColorIndex is a 1-56 palette; larger values are RGB → OLE COLOR (BGR)
              const bg = act.bgColor;
              if (bg >= 1 && bg <= 56) {
                parts.push(`${rngExpr}.Interior.ColorIndex = ${bg}`);
              } else {
                const r = (bg >> 16) & 0xff;
                const g = (bg >> 8) & 0xff;
                const b = bg & 0xff;
                parts.push(`${rngExpr}.Interior.Color = ${b * 65536 + g * 256 + r}`);
              }
            }
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
          default: {
            const safeName = String(act.action || 'unknown')
              .replace(/[^A-Za-z0-9_-]/g, '')
              .slice(0, 40);
            return `        $results += @{ action='${safeName}'; success=$false; error='Unknown action' }`;
          }
    }
  }
}

