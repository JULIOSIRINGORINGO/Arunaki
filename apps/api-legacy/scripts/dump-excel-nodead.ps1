
try {
  $excel = New-Object -ComObject Excel.Application
  $excel.Visible = $false
  $excel.DisplayAlerts = $false
  $wb = $excel.Workbooks.Open('E:\ARUNAKI\apps\api\test\workspace-demo\Laporan Bengkel Januari.xlsx')
  
  
  $ws = $wb.ActiveSheet
  $results = @()
        foreach ($s in 1..$wb.Worksheets.Count) { if ($wb.Worksheets.Item($s).Name -ieq 'Penjualan Januari') { $wb.Worksheets.Item($s).Activate(); $ws = $wb.Worksheets.Item($s); break } }
        $ws.Rows(7).Insert(); $results += @{ action='insert_row'; success=$true; row=7 }
        foreach ($s in 1..$wb.Worksheets.Count) { if ($wb.Worksheets.Item($s).Name -ieq 'Penjualan Januari') { $wb.Worksheets.Item($s).Activate(); $ws = $wb.Worksheets.Item($s); break } }
        $ws.Rows(7).Insert(); $results += @{ action='insert_row'; success=$true; row=7 }
        foreach ($s in 1..$wb.Worksheets.Count) { if ($wb.Worksheets.Item($s).Name -ieq 'Penjualan Januari') { $wb.Worksheets.Item($s).Activate(); $ws = $wb.Worksheets.Item($s); break } }
        $newVal2 = '22/01/2026'; ; $ws.Range('A7').Value2 = $newVal2; $results += @{ action='write_cell'; success=$true; cell='A7' }
        foreach ($s in 1..$wb.Worksheets.Count) { if ($wb.Worksheets.Item($s).Name -ieq 'Penjualan Januari') { $wb.Worksheets.Item($s).Activate(); $ws = $wb.Worksheets.Item($s); break } }
        $newVal3 = 'Semen 40kg'; ; $ws.Range('B7').Value2 = $newVal3; $results += @{ action='write_cell'; success=$true; cell='B7' }
        foreach ($s in 1..$wb.Worksheets.Count) { if ($wb.Worksheets.Item($s).Name -ieq 'Penjualan Januari') { $wb.Worksheets.Item($s).Activate(); $ws = $wb.Worksheets.Item($s); break } }
        $newVal4 = [double]15; ; $ws.Range('C7').Value2 = $newVal4; $results += @{ action='write_cell'; success=$true; cell='C7' }
  $hasSave = $false
  foreach ($a in @($results)) { if ($a.action -eq 'save') { $hasSave = $true } }
  if (-not $hasSave) { try { $wb.Save() } catch {} }
  $sheetList = @()
  foreach ($s in 1..$wb.Worksheets.Count) { $sheetList += $wb.Worksheets.Item($s).Name }
  $hdrList = @()
  try { for ($c = 1; $c -le [Math]::Min($ws.UsedRange.Columns.Count, 40); $c++) { $hdrList += [string]$ws.Cells.Item(1, $c).Text } } catch {}
  @{ success=$true; actionsExecuted=$results.Length; results=$results; sheets=($sheetList -join ', '); activeSheet=$ws.Name; headers=($hdrList -join ' | ') } | ConvertTo-Json -Depth 5
} catch {
  @{ success=$false; error=($_.Exception.Message + " AT LINE " + $_.InvocationInfo.ScriptLineNumber + ": " + $_.InvocationInfo.Line.Trim()); } | ConvertTo-Json
} finally {
  try { $wb.Close($false) } catch {}
  try { $excel.Quit() } catch {}
  try { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($wb) | Out-Null } catch {}
  try { [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null } catch {}
  try { [GC]::Collect(); [GC]::WaitForPendingFinalizers() } catch {}
}
