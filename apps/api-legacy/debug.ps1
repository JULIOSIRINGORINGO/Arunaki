try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $wb = $excel.Workbooks.Open('e:\JS\laporan-test\TABEL REKAPAN NEW2026-.xlsm')
  foreach ($s in 1..$wb.Worksheets.Count) { if ($wb.Worksheets.Item($s).Name -ieq 'AGUSTUS') { $wb.Worksheets.Item($s).Activate(); break } }
  $ws = $wb.ActiveSheet
  $results = @()
        $lastRow = [int]($ws.Cells.Item([int]$ws.Rows.Count, [int]1).End(-4162).Row)
        $targetRow = $lastRow + 1
        $arr = @()
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
        $results += @{ action='append_row'; success=$true; targetRow=$targetRow; columnStart=1 }
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