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
  /** Label-based targeting: text of the row label (searched in the first 3 columns). */
  rowLabel?: string;
  /** Target column letter when using rowLabel (e.g. "Z"). */
  columnLetter?: string;
  /** Target column by date header text (e.g. "24/08/2026") when using rowLabel. */
  columnDate?: string;
  /** fill_table_column: the date identifying the target column. */
  date?: string;
  /** fill_table_column: labelâ†’value pairs written onto their labeled rows. */
  rows?: Array<{ label: string; value: any }>;
  /** fill_table_column: free-text detail lines appended into the section's empty rows. */
  details?: string[];
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
  /** Serializes COM access per workbook â€” two Excel instances on one file silently lose writes. */
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
          // Label-row targeting: rowLabel + (columnDate | columnLetter) is a
          // complete, coordinate-free specification â€” no cell required.
          if (
            a.action === 'write_cell' &&
            a.rowLabel &&
            (a.columnDate || a.columnLetter)
          ) {
            break;
          }
          if (
            a.action === 'write_cell' &&
            a.rowLabel &&
            !a.columnDate &&
            !a.columnLetter
          ) {
            fail(
              'rowLabel targeting also needs columnDate (date header text) or columnLetter â€” e.g. the date column matching the target day',
            );
            continue;
          }
          if (!a.cell || !ExcelComService.CELL_RE.test(a.cell.trim())) {
            fail(
              a.cell
                ? `Invalid cell reference "${String(a.cell).slice(0, 24)}"`
                : a.rowLabel
                  ? 'rowLabel targeting needs columnDate or columnLetter'
                  : 'cell is required â€” or better: use rowLabel + columnDate targeting on labeled templates',
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

        // Single retry ONLY for fast startup failures (<5s â€” COM instantiation
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

  /**
   * fill_table_column â€” domain-level, position-deterministic fill for
   * date-per-column recap templates. The model sends ONLY semantic data
   * (date + labelâ†’value rows + optional detail texts); this method resolves
   * the date column and every label row, writes atomically, and reports
   * per-item results.
   */
  async fillTableColumn(
    filePath: string,
    sheetName: string | undefined,
    date: string,
    rows: Array<{ label: string; value: any }>,
    details: string[] = [],
  ): Promise<{
    success: boolean;
    itemsTotal: number;
    itemsFailed: number;
    results: ExcelActionResult[];
  }> {
    if (!this.isAvailable) {
      throw new Error('Excel COM automation only available on Windows');
    }
    return this.withFileLock(filePath, async () => {
      const scriptPath = join(
        tmpdir(),
        `arunaki-fillcol-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.ps1`,
      );
      const esc = (s: string) => String(s).replace(/'/g, "''");
      const marshal = (raw: any): string => {
        if (typeof raw === 'number') return `[double]${raw}`;
        if (typeof raw !== 'string') return `'${String(raw).replace(/'/g, "''")}'`;
        const idm = raw.trim().match(/^([\d.,\s]+?)\s*(RB|JT)?$/i);
        if (idm && /\d/.test(idm[1])) {
          const mult =
            idm[2]?.toUpperCase() === 'JT' ? 1000000 : idm[2]?.toUpperCase() === 'RB' ? 1000 : 1;
          const n = Number(idm[1].replace(/[.\s]/g, '').replace(',', '.'));
          if (!Number.isNaN(n)) return `[double]${n * mult}`;
        }
        return `'${raw.replace(/'/g, "''")}'`;
      };

      const rowBlocks = (rows || []).map((rw, i) => {
        const lbl = esc(String(rw?.label ?? `row${i}`));
        const v = marshal(rw?.value);
        return [
          `  $lbl = '${lbl}'`,
          `  $tR = 0`,
          `  for ($r = 1; $r -le [Math]::Min($ws.UsedRange.Rows.Count, 500); $r++) {`,
          `    for ($c = 1; $c -le [Math]::Min($ws.UsedRange.Columns.Count, 4); $c++) {`,
          `      if ([string]$ws.Cells.Item($r, $c).Text.Trim() -ieq $lbl) { $tR = $r; break }`,
          `    }`,
          `    if ($tR -gt 0) { break }`,
          `  }`,
          `  if ($tR -gt 0 -and $tCol -gt 0) {`,
          `    $ws.Cells.Item($tR, $tCol).Value2 = ${v}`,
          `    $results += @{ item='row'; label=$lbl; success=$true; row=$tR; column=$tCol }`,
          `  } else {`,
          `    $results += @{ item='row'; label=$lbl; success=$false; error='Row label not found' }`,
          `  }`,
        ].join('\n');
      });

      const detStrings = (details || []).map((d) => `'${esc(String(d))}'`);
      const detBlock = detStrings.length
        ? [
            `  # Detail band: below the date row until the first label starting with TOTAL`,
            `  $detStart = $hdrRow + 1; $detEnd = 0`,
            `  for ($r = $detStart; $r -le [Math]::Min($ws.UsedRange.Rows.Count, 500); $r++) {`,
            `    $lt = ([string]$ws.Cells.Item($r, 1).Text + [string]$ws.Cells.Item($r, 2).Text)`,
            `    if ($lt -match '^\\s*TOTAL') { $detEnd = $r - 1; break }`,
            `  }`,
            `  if ($detEnd -eq 0) { $detEnd = [Math]::Min($detStart + 20, $ws.UsedRange.Rows.Count) }`,
            `  $dr = $detStart`,
            `  foreach ($dtx in @(${detStrings.join(', ')})) {`,
            `    while ($dr -le $detEnd -and ($ws.Cells.Item($dr, $tCol).Value2 -ne $null)) { $dr++ }`,
            `    if ($dr -gt $detEnd) { break }`,
            `    $ws.Cells.Item($dr, $tCol).Value2 = $dtx`,
            `    $results += @{ item='detail'; success=$true; row=$dr }`,
            `    $dr++`,
            `  }`,
          ].join('\n')
        : '';

      const psScript = `
$ErrorActionPreference = 'Stop'
try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $wb = $excel.Workbooks.Open('${esc(filePath)}')
  ${sheetName ? this.buildSheetActivate(esc(sheetName)) : ''}
  $ws = $wb.ActiveSheet
  $results = @()
  $tCol = 0; $hdrRow = 0
  $dg = [regex]::Matches('${esc(date)}', '\\d+') | ForEach-Object { [int]$_.Value }
  if ($dg.Count -ge 3) {
    for ($r = 1; $r -le [Math]::Min($ws.UsedRange.Rows.Count, 30) -and $tCol -eq 0; $r++) {
      for ($c = 1; $c -le [Math]::Min($ws.UsedRange.Columns.Count, 100); $c++) {
        $v = $ws.Cells.Item($r, $c).Value2
        if ($v -is [double] -and $v -gt 20000 -and $v -lt 80000) {
          $dt = [DateTime]::FromOADate($v)
          $dd = $dt.Day; $mm = $dt.Month; $yy = $dt.Year
          if (($yy -eq $dg[2] -and $mm -eq $dg[1] -and $dd -eq $dg[0]) -or ($yy -eq $dg[2] -and $mm -eq $dg[0] -and $dd -eq $dg[1])) { $tCol = $c; $hdrRow = $r; break }
        }
      }
    }
  }
        $results += @{ item='debug'; success=$true; tCol=$tCol; hdrRow=$hdrRow; sheet=$ws.Name }
        if ($tCol -eq 0) {
          $results += @{ item='column'; success=$false; error='Date column not found: ${esc(date)}' }
  } else {
${rowBlocks}
${detBlock}
  }
  $failCount = 0
  foreach ($a in @($results)) { if ($a.success -eq $false) { $failCount++ } }
  if ($failCount -eq 0) { try { $wb.Save() } catch {} }
  @{ success=($failCount -eq 0); itemsTotal=$results.Length; itemsFailed=$failCount; results=$results } | ConvertTo-Json -Depth 5
} catch {
  @{ success=$false; error=$_.Exception.Message } | ConvertTo-Json -Depth 5
} finally {
  try { $wb.Close($false) } catch {}
  try { $excel.Quit() } catch {}
  try { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($wb) | Out-Null } catch {}
  try { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null } catch {}
  try { [GC]::Collect(); [GC]::WaitForPendingFinalizers() } catch {}
}`;
      await writeFile(scriptPath, '\uFEFF' + psScript, 'utf-8');
      const { stdout } = await this.runPsScript(scriptPath, 120000);
      const output = stdout.trim();
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          success: false,
          itemsTotal: 1,
          itemsFailed: 1,
          results: [
            {
              action: 'fill_table_column',
              success: false,
              error: `Unexpected fill output: ${output.slice(0, 200)}`,
            },
          ],
        } as any;
      }
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        success: !!parsed.success,
        itemsTotal: parsed.itemsTotal ?? 0,
        itemsFailed: parsed.itemsFailed ?? 0,
        results: parsed.results ?? [],
      } as any;
    });
  }

  /** Sheet activation snippet shared by fill script (falls back to active sheet). */
  /**
   * Read the structural skeleton of a sheet for the recap-fill pipeline:
   * date headers (column letter + text) and row labels. One COM round-trip.
   */
  async readTableSkeleton(
    filePath: string,
    sheetName?: string,
  ): Promise<{
    sheets: string[];
    activeSheet: string;
    dates: string[];
    labels: string[];
  }> {
    if (!this.isAvailable) {
      throw new Error('Excel COM automation only available on Windows');
    }
    return this.withFileLock(filePath, async () => {
      const scriptPath = join(
        tmpdir(),
        `arunaki-skel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.ps1`,
      );
      const sheetLine = sheetName
        ? `if ($wb.Worksheets.Item($s).Name -ieq '${sheetName.replace(/'/g, "''")}') { $ws = $wb.Worksheets.Item($s) }`
        : `$ws = $wb.ActiveSheet`;
      const ps = `
$ErrorActionPreference = 'Stop'
try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $wb = $excel.Workbooks.Open('${filePath.replace(/'/g, "''")}')
  $sheetNames = (1..$wb.Worksheets.Count | ForEach-Object { $wb.Worksheets.Item($_).Name }) -join ','
  $ws = $null
  foreach ($s in 1..$wb.Worksheets.Count) { ${sheetLine} }
  if (-not $ws) { $ws = $wb.ActiveSheet }
  function ColLetter([int]$n) { $s2=''; while ($n -gt 0) { $m = ($n - 1) % 26; $s2 = [char](65 + $m) + $s2; $n = [int](($n - $m - 1) / 26) }; return $s2 }
  $dates = @(); $labels = @()
  $maxR = [Math]::Min($ws.UsedRange.Rows.Count, 120)
  $maxC = [Math]::Min($ws.UsedRange.Columns.Count, 60)
  for ($r = 1; $r -le 10; $r++) {
    for ($c = 1; $c -le $maxC; $c++) {
      $v = $ws.Cells.Item($r, $c).Value2
      if ($v -is [double] -and $v -gt 20000 -and $v -lt 80000) { $dates += ((ColLetter $c) + '=' + $ws.Cells.Item($r, $c).Text) }
    }
  }
  for ($r = 1; $r -le $maxR; $r++) {
    for ($c = 1; $c -le [Math]::Min($maxC, 4); $c++) {
      $t = [string]$ws.Cells.Item($r, $c).Text
      if ($t.Trim() -ne '') { $labels += ('R' + $r + ': ' + $t.Trim()); break }
    }
  }
  @{ sheets=$sheetNames; activeSheet=$ws.Name; dates=$dates; labels=$labels } | ConvertTo-Json -Depth 4
} catch {
  @{ error=$_.Exception.Message } | ConvertTo-Json -Depth 4
} finally {
  try { $wb.Close($false) } catch {}
  try { $excel.Quit() } catch {}
  try { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($wb) | Out-Null } catch {}
  try { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null } catch {}
  try { [GC]::Collect(); [GC]::WaitForPendingFinalizers() } catch {}
}`;
      await writeFile(scriptPath, '\uFEFF' + ps, 'utf-8');
      const { stdout } = await this.runPsScript(scriptPath, 60000);
      const m = stdout.trim().match(/\{[\s\S]*\}/);
      if (!m) throw new Error(`Skeleton read failed: ${stdout.slice(0, 200)}`);
      return JSON.parse(m[0]);
    });
  }

  private buildSheetActivate(escapedSheet: string): string {
    return [
      `  $sheetFound = $false`,
      `  foreach ($s in 1..$wb.Worksheets.Count) { if ($wb.Worksheets.Item($s).Name -ieq '${escapedSheet}') { $wb.Worksheets.Item($s).Activate(); $wb.Worksheets.Item($s).Select() | Out-Null; $sheetFound = $true; break } }`,
      `  if (-not $sheetFound) { throw ("Sheet not found: '${escapedSheet}'. Available: " + ((1..$wb.Worksheets.Count | ForEach-Object { $wb.Worksheets.Item($_).Name }) -join ', ')) }`,
    ].join('\n');
  }

  private buildPowerShellScript(
    filePath: string,
    actions: ExcelAction[],
    sheetName?: string,
  ): string {
    const escapedPath = filePath.replace(/'/g, "''");
    const escapedSheet = sheetName ? sheetName.replace(/'/g, "''") : '';

    // Guard: refuse untargeted mutations on multi-sheet workbooks â€” writing to
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
    // Unknown sheet names MUST fail loudly â€” falling back to the active sheet
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
  # Labeled-template detection (generic structure, content-agnostic):
  # a date header row (>=3 date cells in the top region) + a label column
  # (>=5 non-empty rows in the first column) => coordinate writes are unsafe.
  $labeledTemplate = $false
  $dateCells = 0; $labelRows = 0
  $maxDetR = [Math]::Min($ws.UsedRange.Rows.Count, 30)
  $maxDetC = [Math]::Min($ws.UsedRange.Columns.Count, 60)
  for ($r = 1; $r -le $maxDetR; $r++) {
    for ($c = 1; $c -le $maxDetC; $c++) {
      $v = $ws.Cells.Item($r, $c).Value2
      if ($v -is [double] -and $v -gt 20000 -and $v -lt 80000) { $dateCells++ }
    }
  }
  for ($r = 1; $r -le [Math]::Min($ws.UsedRange.Rows.Count, 80); $r++) {
    $t = [string]$ws.Cells.Item($r, 1).Text
    if ($t.Trim() -ne '') { $labelRows++ }
  }
  if ($dateCells -ge 3 -and $labelRows -ge 5) { $labeledTemplate = $true }
  $results = @()
${wrappedBlocks}
  $hasSave = $false
  foreach ($a in @($results)) { if ($a.action -eq 'save') { $hasSave = $true } }
  # Read-only batches must not rewrite the source file.
  # Atomic mutation: if ANY action failed, save NOTHING â€” a retried batch
  # must never double-apply deltas on top of a half-applied state.
  $failCount = 0
  foreach ($a in @($results)) { if ($a.success -eq $false) { $failCount++ } }
  if (-not $hasSave -and ${hasMutating ? '$true' : '$false'} -and $failCount -eq 0) { try { $wb.Save() } catch {} }
  $sheetList = @()
  foreach ($s in 1..$wb.Worksheets.Count) { $sheetList += $wb.Worksheets.Item($s).Name }
  $hdrList = @()
  try { for ($c = 1; $c -le [Math]::Min($ws.UsedRange.Columns.Count, 40); $c++) { $hdrList += [string]$ws.Cells.Item(1, $c).Text } } catch {}
  @{ success=($failCount -eq 0); actionsExecuted=$results.Length; failed=$failCount; results=$results; sheets=($sheetList -join ', '); activeSheet=$ws.Name; headers=($hdrList -join ' | ') } | ConvertTo-Json -Depth 5
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
          case 'fill_table_column': {
          // Domain-level action for date-per-column templates: the model sends
          // semantic data (date + labelâ†’value rows + optional detail texts);
          // the harness resolves EVERY position deterministically.
          const dtv = (act.date || '').replace(/'/g, "''");
          if (!dtv) {
            return `        $results += @{ action='fill_table_column'; success=$false; error='date is required' }`;
          }
          const marshalV = (raw: any): string => {
            if (typeof raw === 'number') return `[double]${raw}`;
            if (typeof raw !== 'string') return `${JSON.stringify(raw) ?? "''"}`;
            const idm = raw.trim().match(/^([\d.,\s]+?)\s*(RB|JT)?$/i);
            if (idm && /\d/.test(idm[1])) {
              const mult = idm[2]?.toUpperCase() === 'JT' ? 1000000 : idm[2]?.toUpperCase() === 'RB' ? 1000 : 1;
              const n = Number(idm[1].replace(/[.\s]/g, '').replace(',', '.'));
              if (!Number.isNaN(n)) return `[double]${n * mult}`;
            }
            return `'${raw.replace(/'/g, "''")}'`;
          };
          const rowBlocks = (act.rows || [])
            .map((rw: any, i: number) => {
              const lbl = String(rw?.label ?? '').replace(/'/g, "''");
              const v = marshalV(rw?.value);
              return [
                `  $lbl${i} = '${lbl}'`,
                `  $tR${i} = 0`,
                `  if ($tCol -gt 0) {`,
                `    for ($r = 1; $r -le [Math]::Min($ws.UsedRange.Rows.Count, 500); $r++) {`,
                `      for ($c = 1; $c -le [Math]::Min($ws.UsedRange.Columns.Count, 4); $c++) {`,
                `        if ([string]$ws.Cells.Item($r, $c).Text.Trim() -ieq $lbl${i}) { $tR${i} = $r; break }`,
                `      }`,
                `      if ($tR${i} -gt 0) { break }`,
                `    }`,
                `  }`,
                `  if ($tR${i} -gt 0 -and $tCol -gt 0) {`,
                `    $ws.Cells.Item($tR${i}, $tCol).Value2 = ${v}`,
                `    $results += @{ action='fill_table_column'; success=$true; label=$lbl${i}; row=$tR${i} }`,
                `  } else {`,
                `    $results += @{ action='fill_table_column'; success=$false; label=$lbl${i}; error='Row label not found' }`,
                `  }`,
              ].join('\n');
            })
            .join('\n');
          const detStrings = (act.details || []).map(
            (d: string) => `'${String(d).replace(/'/g, "''")}'`,
          );
          const detBlock = detStrings.length
            ? [
                `  # Detail band: rows below the date row until the first TOTAL label`,
                `  $detStart = $hdrRow + 1; $detEnd = 0`,
                `  for ($r = $detStart; $r -le [Math]::Min($ws.UsedRange.Rows.Count, 500); $r++) {`,
                `    $lt = ([string]$ws.Cells.Item($r, 1).Text + [string]$ws.Cells.Item($r, 2).Text)`,
                `    if ($lt -match '^\\s*TOTAL') { $detEnd = $r - 1; break }`,
                `  }`,
                `  if ($detEnd -eq 0) { $detEnd = [Math]::Min($detStart + 20, $ws.UsedRange.Rows.Count) }`,
                `  $dr = $detStart`,
                `  foreach ($dtx in @(${detStrings.join(', ')})) {`,
                `    while ($dr -le $detEnd -and $ws.Cells.Item($dr, $tCol).Value2 -ne $null) { $dr++ }`,
                `    if ($dr -gt $detEnd) { break }`,
                `    $ws.Cells.Item($dr, $tCol).Value2 = $dtx`,
                `    $results += @{ action='fill_table_column'; success=$true; detail=$dtx; row=$dr }`,
                `    $dr++`,
                `  }`,
              ].join('\n')
            : '';
          return [
            `        # fill_table_column: resolve the date column deterministically`,
            `        $tCol = 0; $hdrRow = 0`,
            `        $dgF = [regex]::Matches('${dtv}', '\\d+') | ForEach-Object { [int]$_.Value }`,
            `        if ($dgF.Count -ge 3) {`,
            `          for ($r = 1; $r -le [Math]::Min($ws.UsedRange.Rows.Count, 30) -and $tCol -eq 0; $r++) {`,
            `            for ($c = 1; $c -le [Math]::Min($ws.UsedRange.Columns.Count, 100); $c++) {`,
            `              $v = $ws.Cells.Item($r, $c).Value2`,
            `              if ($v -is [double] -and $v -gt 20000 -and $v -lt 80000) {`,
            `                $dt = [DateTime]::FromOADate($v)`,
            `                $dd = $dt.Day; $mm = $dt.Month; $yy = $dt.Year`,
            `                if (($yy -eq $dgF[2] -and $mm -eq $dgF[1] -and $dd -eq $dgF[0]) -or ($yy -eq $dgF[2] -and $mm -eq $dgF[0] -and $dd -eq $dgF[1])) { $tCol = $c; $hdrRow = $r; break }`,
            `              }`,
            `            }`,
            `          }`,
            `        }`,
            `        if ($tCol -eq 0) {`,
            `          $results += @{ action='fill_table_column'; success=$false; error='Date column not found: ${dtv}' }`,
            `        } else {`,
            rowBlocks,
            detBlock,
            `        }`,
          ]
            .filter(Boolean)
            .join('\n');
        }
        case 'write_cell': {
            // Row-label targeting: "write VALUE on the row labeled X, column Y".
            // Fully deterministic â€” the model never computes coordinates.
            if (act.rowLabel) {
              const rl = (act.rowLabel || '').replace(/'/g, "''");
              const colLetter = (act.columnLetter || '')
                .replace(/[^A-Za-z]/g, '')
                .toUpperCase();
              const cdate = (act.columnDate || '').trim();
              let mval: any;
              if (typeof act.value === 'string') {
                const idm = act.value
                  .trim()
                  .match(/^([\d.,\s]+?)\s*(RB|JT)?$/i);
                if (idm && /\d/.test(idm[1])) {
                  const mult = idm[2]?.toUpperCase() === 'JT' ? 1000000 : idm[2]?.toUpperCase() === 'RB' ? 1000 : 1;
                  const n = Number(idm[1].replace(/[.\s]/g, '').replace(',', '.'));
                  if (!Number.isNaN(n)) {
                    mval = `[double]${n * mult}`;
                  } else {
                    mval = `'${act.value.replace(/'/g, "''")}'`;
                  }
                } else {
                  mval = `'${act.value.replace(/'/g, "''")}'`;
                }
              } else if (typeof act.value === 'number') {
                mval = `[double]${act.value}`;
              } else if (act.value === null || act.value === undefined) {
                mval = '$null';
              } else {
                mval = act.value;
              }
              const colPart = colLetter
                ? `        $tCol = $ws.Range('${colLetter}1').Column`
                : cdate
                  ? [
                      `        $tCol = 0; $hdrRow = 0`,
                      `        # Component-based date compare: tolerant of ANY display format`,
                      `        $digits = ([regex]::Matches('${cdate}', '\\d+') | ForEach-Object { [int]$_.Value })`,
                      `        if ($digits.Count -ge 3) {`,
                      `          $cands = @(`,
                      `            @{ y = $digits[2]; m = $digits[1]; d = $digits[0] },`,
                      `            @{ y = $digits[2]; m = $digits[0]; d = $digits[1] }`,
                      `          )`,
                      `          for ($r = 1; $r -le [Math]::Min($ws.UsedRange.Rows.Count, 30); $r++) {`,
                      `            for ($c = 1; $c -le [Math]::Min($ws.UsedRange.Columns.Count, 100); $c++) {`,
                      `              $v = $ws.Cells.Item($r, $c).Value2`,
                      `              if ($v -is [double] -and $v -gt 20000 -and $v -lt 80000) {`,
                      `                $dt = [DateTime]::FromOADate($v)`,
                      `                foreach ($cd in $cands) {`,
                      `                  if ($dt.Year -eq $cd.y -and $dt.Month -eq $cd.m -and $dt.Day -eq $cd.d) { $tCol = $c; $hdrRow = $r; break }`,
                      `                }`,
                      `                if ($tCol -gt 0) { break }`,
                      `              }`,
                      `            }`,
                      `            if ($tCol -gt 0) { break }`,
                      `          }`,
                      `        }`,
                    ].join('\n')
                  : `        $tCol = 0`;
              return [
                `        $tRow = 0; $tCol = 0`,
                colPart,
                `        if ($tCol -gt 0) {`,
                `          for ($r = 1; $r -le [Math]::Min($ws.UsedRange.Rows.Count, 500); $r++) {`,
                `            for ($c = 1; $c -le [Math]::Min($ws.UsedRange.Columns.Count, 4); $c++) {`,
                `              if ([string]$ws.Cells.Item($r, $c).Text.Trim() -ieq '${rl}') { $tRow = $r; break }`,
                `            }`,
                `            if ($tRow -gt 0) { break }`,
                `          }`,
                `        }`,
                `        if ($tRow -gt 0 -and $tCol -gt 0) {`,
                `          $existing = $ws.Cells.Item($tRow, $tCol)`,
                `          $isDateCell = $false`,
                `          try { $nf = [string]$existing.NumberFormat; if ($nf -match 'yy' -and $existing.Value2 -is [double] -and $existing.Value2 -gt 20000) { $isDateCell = $true } } catch {}`,
                `          if ($isDateCell) {`,
                `            $results += @{ action='write_cell'; success=$false; error='Refusing to overwrite date header cell ${colLetter || cdate} row ${rl}' }`,
                `          } else {`,
                `            if (${act.delta ? '$true' : '$false'}) { $d${idx} = [double]$existing.Value2 + ${mval}; Invoke-Expression ('$ws.Cells.Item(' + $tRow + ',' + $tCol + ').Value2 = ' + $d${idx}) }`,
                `            else { $existing.Value2 = ${mval} }`,
                `            $results += @{ action='write_cell'; success=$true; row=$tRow; column=$tCol }`,
                `          }`,
                `        } else {`,
                `          $results += @{ action='write_cell'; success=$false; error='Row label or target column not found (rowLabel=${rl}, col=${colLetter || cdate})' }`,
                `        }`,
              ].join('\n');
            }
            // Label-based write: resolve row by matching a column's header + value,
            // so the LLM never has to guess coordinates.
            if (act.matchColumn && act.matchValue !== undefined) {
              const mc = (act.matchColumn || '').replace(/'/g, "''");
              const tc = (act.targetColumn || act.matchColumn).replace(/'/g, "''");
              const mv = (act.matchValue ?? '').toString().replace(/'/g, "''");
              // Shared label-resolution preamble.
              // Supports two real-world layouts:
              //  A) Table: header row + data rows â†’ find row where matchColumn == matchValue
              //  B) Key-Value: label cell in col A, value in the next empty cell to its
              //     right (matchValue repeats the label itself) â†’ write beside the label
              const resolveBlock = [
                `        $mCol = 0; $tCol = 0; $tgtRow = 0; $hdrRow = 0; $keyCol = 0`,
                `        for ($hr = 1; $hr -le [Math]::Min($ws.UsedRange.Rows.Count, 5); $hr++) {`,
                `          for ($c = 1; $c -le [Math]::Min($ws.UsedRange.Columns.Count, 100); $c++) {`,
                `            $h = [string]$ws.Cells.Item($hr, $c).Text`,
                `            if ($h -ieq '${mc}') { $mCol = $c; $hdrRow = $hr }`,
                `            if ($h -ieq '${tc}') { $tCol = $c }`,
                `            if ($h.Trim() -ne '' -and $keyCol -eq 0) { $keyCol = $c }`,
                `          }`,
                `          if ($mCol -gt 0) { break }`,
                `        }`,
                `        if ($mCol -gt 0 -and '${mv}' -ieq '${mc}') {`,
                `          $tgtRow = $hdrRow`,
                `          if ($tCol -le $mCol) {`,
                `            $tCol = 0`,
                `            for ($c = $mCol + 1; $c -le [Math]::Min($mCol + 6, $ws.UsedRange.Columns.Count); $c++) { if ([string]$ws.Cells.Item($hdrRow, $c).Text -eq '') { $tCol = $c; break } }`,
                `            if ($tCol -eq 0) { $tCol = $mCol + 1 }`,
                `          }`,
                `        } elseif ($mCol -gt 0) {`,
                `          for ($r = $hdrRow + 1; $r -le [Math]::Min($ws.UsedRange.Rows.Count, 500); $r++) { if ([string]$ws.Cells.Item($r, $mCol).Text -ieq '${mv}') { $tgtRow = $r; break } }`,
                `          if ($tgtRow -eq 0) {`,
                `            # Date-matrix TRANSPOSE: matchValue is a DATE (column header) and`,
                `            # targetColumn is a ROW LABEL - resolve their intersection.`,
                `            $dg${idx} = [regex]::Matches('${mv}', '\\d+') | ForEach-Object { [int]$_.Value }`,
                `            if ($dg${idx}.Count -ge 3) {`,
                `              for ($r = 1; $r -le [Math]::Min($ws.UsedRange.Rows.Count, 30) -and $tCol -eq 0; $r++) {`,
                `                for ($c = 1; $c -le [Math]::Min($ws.UsedRange.Columns.Count, 100); $c++) {`,
                `                  $v = $ws.Cells.Item($r, $c).Value2`,
                `                  if ($v -is [double] -and $v -gt 20000 -and $v -lt 80000) {`,
                `                    $dt = [DateTime]::FromOADate($v)`,
                `                    $dd = $dt.Day; $mm = $dt.Month; $yy = $dt.Year`,
                `                    if (($yy -eq $dg${idx}[2] -and $mm -eq $dg${idx}[1] -and $dd -eq $dg${idx}[0]) -or ($yy -eq $dg${idx}[2] -and $mm -eq $dg${idx}[0] -and $dd -eq $dg${idx}[1])) { $tCol = $c; break }`,
                `                  }`,
                `                }`,
                `              }`,
                `              if ($tCol -gt 0) {`,
                `                for ($r = 1; $r -le [Math]::Min($ws.UsedRange.Rows.Count, 500) -and $tgtRow -eq 0; $r++) {`,
                `                  for ($c = 1; $c -le [Math]::Min($ws.UsedRange.Columns.Count, 4); $c++) {`,
                `                    if ([string]$ws.Cells.Item($r, $c).Text.Trim() -ieq '${tc}') { $tgtRow = $r; break }`,
                `                  }`,
                `                }`,
                `              }`,
                `            }`,
                `          }`,
                `          if ($tgtRow -eq 0 -and $tCol -eq 0 -and '${tc}' -match '^[A-Za-z]{1,3}$') {`,
                `            # targetColumn given as a COLUMN LETTER (e.g. "Z")`,
                `            $tCol = $ws.Range('${tc}1').Column`,
                `          }`,
                `          if ($tgtRow -eq 0 -and $mCol -eq 0 -and $tCol -gt 0 -and '${mv}' -ne '') {`,
                `            # Section-append: matchColumn named a SECTION (not a header) and the`,
                `            # detail is new â€” place it in the first empty cell of the target column`,
                `            # below the header region (fresh date column fill).`,
                `            for ($r = 2; $r -le [Math]::Min($ws.UsedRange.Rows.Count, 500) -and $tgtRow -eq 0; $r++) {`,
                `              if ([string]$ws.Cells.Item($r, $tCol).Text.Trim() -eq '') { $tgtRow = $r }`,
                `            }`,
                `            if ($tgtRow -eq 0) { $tgtRow = $ws.UsedRange.Rows.Count + 1 }`,
                `          }`,
                `          if ($tgtRow -eq 0 -and $keyCol -gt 0 -and $keyCol -ne $mCol) {`,
                `            # Cross-keyed lookup: matchValue lives in the key column â†’ write into target column of that row`,
                `            for ($r = $hdrRow + 1; $r -le [Math]::Min($ws.UsedRange.Rows.Count, 500); $r++) { if ([string]$ws.Cells.Item($r, $keyCol).Text -ieq '${mv}') { $tgtRow = $r; break } }`,
                `          }`,
                `          if ($tgtRow -eq 0 -and $mCol -eq $keyCol) {`,
                `            # UPSERT (key column only): no matching row â†’ append into table, above a trailing summary row when present`,
                `            $lastRow = [int]($ws.Cells.Item([int]$ws.Rows.Count, $mCol).End(-4162).Row)`,
                `            if ($lastRow -le $hdrRow) { $tgtRow = $hdrRow + 1 }`,
                `            else {`,
                `              for ($r = $hdrRow + 1; $r -le $lastRow -and $tgtRow -eq 0; $r++) { if ([string]$ws.Cells.Item($r, $mCol).Text.Trim() -eq '') { $tgtRow = $r } }`,
                `              if ($tgtRow -eq 0) {`,
                `                $ne = 0; $tx = 0`,
                `                for ($c = 1; $c -le [Math]::Min($ws.UsedRange.Columns.Count, 100); $c++) { $t = [string]$ws.Cells.Item($lastRow, $c).Text; if ($t.Trim() -ne '') { $ne++; $v2 = $ws.Cells.Item($lastRow, $c).Value2; if (-not ($v2 -is [double] -or $v2 -is [int])) { $tx++ } } }`,
                `                if ($ne -ge 1 -and $ne -le 2 -and $tx -ge 1) { $ws.Rows($lastRow).Insert() | Out-Null; $tgtRow = $lastRow } else { $tgtRow = $lastRow + 1 }`,
                `              }`,
                `            }`,
                `            $ws.Cells.Item($tgtRow, $mCol).Value2 = '${mv}'`,
                `          }`,
                `        }`,
              ].join('\n');
              const missBlock =
                `        else { $results += @{ action='write_cell'; success=$false; error='Match row or target column not found (matchColumn=${mc}, matchValue=${mv})' } }`;
              if (typeof act.value === 'string' && act.value.startsWith('=')) {
                return [
                  resolveBlock,
                  `        if ($tgtRow -gt 0 -and $tCol -gt 0) { $ws.Cells.Item($tgtRow, $tCol).Formula = '${act.value.replace(/'/g, "''")}'; $results += @{ action='write_cell'; success=$true; row=$tgtRow; column=$tCol } }`,
                  missBlock,
                ].join('\n');
              }
              let mval: any;
              if (typeof act.value === 'string') {
                // Indonesian business units: "281 RB" -> 281000, "2.771 RB" ->
                // 2771000, "1,5 JT" -> 1500000, "3.052" (dot-grouped) -> 3052.
                const idm = act.value
                  .trim()
                  .match(/^([\d.,\s]+?)\s*(RB|JT)?$/i);
                if (idm && /[\d]/.test(idm[1])) {
                  const mult = idm[2]?.toUpperCase() === 'JT' ? 1000000 : idm[2]?.toUpperCase() === 'RB' ? 1000 : 1;
                  const digits = idm[1].replace(/[.\s]/g, '').replace(',', '.');
                  const n = Number(digits);
                  if (!Number.isNaN(n)) mval = `[double]${n * mult}`;
                  else mval = `'${act.value.replace(/'/g, "''")}'`;
                } else {
                  mval = `'${act.value.replace(/'/g, "''")}'`;
                }
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
                resolveBlock,
                `        if ($tgtRow -gt 0 -and $tCol -gt 0) {`,
                `          $cur${idx} = $ws.Cells.Item($tgtRow, $tCol).Value2`,
                `          if (${act.delta ? '$true' : '$false'} -and ($cur${idx} -is [double] -or $cur${idx} -is [int])) { $d${idx} = [double]$cur${idx} + ${mval}; Invoke-Expression ('$ws.Cells.Item(' + $tgtRow + ',' + $tCol + ').Value2 = ' + $d${idx}) }`,
                `          else { $ws.Cells.Item($tgtRow, $tCol).Value2 = ${mval} }`,
                `          $results += @{ action='write_cell'; success=$true; row=$tgtRow; column=$tCol }`,
                `        }`,
                missBlock,
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
              `        if ($labeledTemplate) {`,
              `          $results += @{ action='write_cell'; success=$false; error='Coordinate writes are disabled on labeled templates (date header + label column detected) â€” this protects row alignment. Use write_cell with rowLabel + columnDate (or columnLetter) targeting instead.' }`,
              `        } else {`,
              `          if (${act.delta ? '$true' : '$false'}) { $d${idx} = [double]$ws.Range('${cellCoord}').Value2 + ${val}; Invoke-Expression ('$ws.Range(''${cellCoord}'').Value2 = ' + $d${idx}) }`,
              `          else { $ws.Range('${cellCoord}').Value2 = ${val} }`,
              `          $results += @{ action='write_cell'; success=$true; cell='${cellCoord}' }`,
              `        }`,
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
              `        function ColLetter([int]$n) { $s=''; while ($n -gt 0) { $m = ($n - 1) % 26; $s = [char](65 + $m) + $s; $n = [int](($n - $m - 1) / 26) }; return $s }`,
              `        $rowsArr${idx} = @()`,
              `        $baseRow = ${rngExpr}.Row`,
              `        $baseCol = ${rngExpr}.Column`,
              `        $maxR = [Math]::Min(${rngExpr}.Rows.Count, 150)`,
              `        $maxC = [Math]::Min(${rngExpr}.Columns.Count, 40)`,
              `        $colHeader = (1..$maxC | ForEach-Object { ColLetter ($baseCol + $_ - 1) }) -join ' '`,
              `        $rowsArr${idx} += ('COLUMNS: ' + $colHeader)`,
              `        for ($rIdx = 1; $rIdx -le $maxR; $rIdx++) {`,
              `          $cVals${idx} = @()`,
              `          for ($cIdx = 1; $cIdx -le $maxC; $cIdx++) {`,
              `            $cVals${idx} += ${rngExpr}.Cells.Item($rIdx, $cIdx).Text`,
              `          }`,
              `          $rowsArr${idx} += ('Row ' + ($baseRow + $rIdx - 1) + ': ' + ($cVals${idx} -join ' | '))`,
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
              (act as any).data ??
              // Some models put the row payload in `row` (an insert_row leftover).
              // Accept an array there instead of silently appending nothing.
              (Array.isArray((act as any).row) ? (act as any).row : undefined);
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
            // Models sometimes nest format props inside value:{} â€” merge them
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
              // ColorIndex is a 1-56 palette; larger values are RGB â†’ OLE COLOR (BGR)
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


