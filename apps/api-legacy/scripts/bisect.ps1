$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$wb = $excel.Workbooks.Open('E:\ARUNAKI\apps\api\test\workspace-demo\Laporan Bengkel Januari.xlsx')
$ws = $wb.ActiveSheet
$act = { foreach ($s in 1..$wb.Worksheets.Count) { if ($wb.Worksheets.Item($s).Name -ieq 'Penjualan Januari') { $wb.Worksheets.Item($s).Activate(); $ws = $wb.Worksheets.Item($s); break } } }
& $act; $ws.Rows(7).Insert()
& $act; $ws.Rows(7).Insert()
& $act
$ws.Range("A7").Value2 = "22/01/2026"
$ws.Range("B7").Value2 = "Semen 40kg"
$ws.Range("C7").Value2 = [double]15
Write-Host ("inline-double C7 = " + $ws.Range("C7").Value2)
$d = [double]$ws.Range("D7").Value2 + 27
Invoke-Expression ('$ws.Range("D7").Value2 = ' + $d)
Write-Host ("iex D7 = " + $ws.Range("D7").Value2)
$wb.Save(); $wb.Close($false); $excel.Quit()
