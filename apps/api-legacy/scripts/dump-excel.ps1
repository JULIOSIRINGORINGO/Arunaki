
try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $wb = $excel.Workbooks.Open('E:\ARUNAKI\apps\api\test\workspace-demo\Laporan Bengkel Januari.xlsx')
  
  $topFound = $false
foreach ($s in 1..$wb.Worksheets.Count) { if ($wb.Worksheets.Item($s).Name -ieq 'Penjualan Januari') { $wb.Worksheets.Item($s).Activate(); $topFound = $true; break } }
if (-not $topFound) { throw ("Sheet not found: 'Penjualan Januari'. Available sheets: " + ((1..$wb.Worksheets.Count | ForEach-Object { $wb.Worksheets.Item($_).Name }) -join ', ')) }
  $ws = $wb.ActiveSheet
  $results = @()
        $lastRow = [int]($ws.Cells.Item([int]$ws.Rows.Count, [int]1).End(-4162).Row)
        $targetRow = $lastRow + 1
        if ($lastRow -ge 2) {
          $ne = 0; $tx = 0
          for ($c = 1; $c -le [Math]::Min($ws.UsedRange.Columns.Count, 100); $c++) {
            $t = [string]$ws.Cells.Item($lastRow, $c).Text
            if ($t.Trim() -ne '') { $ne++; $d = 0.0; if (-not [double]::TryParse($t, [ref]$d)) { $tx++ } }
          }
          if ($ne -ge 1 -and $ne -le 2 -and $tx -ge 1) { $ws.Rows($lastRow).Insert() | Out-Null; $targetRow = $lastRow; $summaryShifted = $true }
        }
  $obj0 = @{ 'Tanggal' = '22/01/2026'; 'Barang' = 'Semen 40kg'; 'Jumlah' = 15; 'Harga' = 65000; 'Total' = 975000 }
  $arr = @()
  for ($hc = 1; $hc -le [Math]::Min($ws.UsedRange.Columns.Count, 100); $hc++) {
    $hh = [string]$ws.Cells.Item(1, $hc).Text
    foreach ($hk in $obj0.Keys) { if ($hh -ieq $hk) { $arr += $obj0[$hk]; break } }
  }
        for ($i = 0; $i -lt $arr.Length; $i++) {
          if ($arr[$i] -ne $null -and $arr[$i] -ne '') {
            $val = $arr[$i]
            $c = [int](1 + $i)
            $r = [int]$targetRow
            if ($val -is [int] -or $val -is [double]) {
              $ws.Cells.Item($r, $c).Value2 = [double]$val
            } elseif ($val -is [bool]) {
              $ws.Cells.Item($r, $c).Value2 = [bool]$val
            } else {
              $ws.Cells.Item($r, $c).Value2 = [string]$val
            }
          }
        }
        if ($summaryShifted) { $results += @{ action='append_row'; success=$true; targetRow=$targetRow; columnStart=1; note='a summary/total row was shifted down — recompute its totals now (rewrite its =SUM formula)' } } else { $results += @{ action='append_row'; success=$true; targetRow=$targetRow; columnStart=1 } }
        $lastRow = [int]($ws.Cells.Item([int]$ws.Rows.Count, [int]1).End(-4162).Row)
        $targetRow = $lastRow + 1
        if ($lastRow -ge 2) {
          $ne = 0; $tx = 0
          for ($c = 1; $c -le [Math]::Min($ws.UsedRange.Columns.Count, 100); $c++) {
            $t = [string]$ws.Cells.Item($lastRow, $c).Text
            if ($t.Trim() -ne '') { $ne++; $d = 0.0; if (-not [double]::TryParse($t, [ref]$d)) { $tx++ } }
          }
          if ($ne -ge 1 -and $ne -le 2 -and $tx -ge 1) { $ws.Rows($lastRow).Insert() | Out-Null; $targetRow = $lastRow; $summaryShifted = $true }
        }
  $obj0 = @{ 'Tanggal' = '22/01/2026'; 'Barang' = 'Besi beton 8mm'; 'Jumlah' = 7; 'Harga' = 98000; 'Total' = 686000 }
  $arr = @()
  for ($hc = 1; $hc -le [Math]::Min($ws.UsedRange.Columns.Count, 100); $hc++) {
    $hh = [string]$ws.Cells.Item(1, $hc).Text
    foreach ($hk in $obj0.Keys) { if ($hh -ieq $hk) { $arr += $obj0[$hk]; break } }
  }
        for ($i = 0; $i -lt $arr.Length; $i++) {
          if ($arr[$i] -ne $null -and $arr[$i] -ne '') {
            $val = $arr[$i]
            $c = [int](1 + $i)
            $r = [int]$targetRow
            if ($val -is [int] -or $val -is [double]) {
              $ws.Cells.Item($r, $c).Value2 = [double]$val
            } elseif ($val -is [bool]) {
              $ws.Cells.Item($r, $c).Value2 = [bool]$val
            } else {
              $ws.Cells.Item($r, $c).Value2 = [string]$val
            }
          }
        }
        if ($summaryShifted) { $results += @{ action='append_row'; success=$true; targetRow=$targetRow; columnStart=1; note='a summary/total row was shifted down — recompute its totals now (rewrite its =SUM formula)' } } else { $results += @{ action='append_row'; success=$true; targetRow=$targetRow; columnStart=1 } }
        $mCol = 0; $tCol = 0; $tgtRow = 0
        for ($c = 1; $c -le [Math]::Min($ws.UsedRange.Columns.Count, 100); $c++) {
          $h = [string]$ws.Cells.Item(1, $c).Text
          if ($h -ieq 'Barang') { $mCol = $c }
          if ($h -ieq 'Total') { $tCol = $c }
        }
        if ($mCol -gt 0) { for ($r = 2; $r -le [Math]::Min($ws.UsedRange.Rows.Count, 500); $r++) { if ([string]$ws.Cells.Item($r, $mCol).Text -ieq 'Grand Total') { $tgtRow = $r; break } } }
        else { for ($r = 1; $r -le [Math]::Min($ws.UsedRange.Rows.Count, 500) -and $tgtRow -eq 0; $r++) { for ($c = 1; $c -le [Math]::Min($ws.UsedRange.Columns.Count, 100); $c++) { if ([string]$ws.Cells.Item($r, $c).Text -ieq 'Grand Total') { $tgtRow = $r; break } } } }
        if ($tgtRow -gt 0 -and $tCol -gt 0) { $ws.Cells.Item($tgtRow, $tCol).Formula = '=SUM(E2:E8)'; $results += @{ action='write_cell'; success=$true; row=$tgtRow; column=$tCol } }
        else { $results += @{ action='write_cell'; success=$false; error='Match row or target column not found (matchColumn=Barang, matchValue=Grand Total)' } }
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
}