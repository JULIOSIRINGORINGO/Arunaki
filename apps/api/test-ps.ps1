$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Open('E:\JS\laporan-test\TABEL REKAPAN NEW2026-.xlsm')
$ws = $wb.Worksheets.Item('AGUSTUS')
try {
    $arr = @('TOKO VIVI', 430, 'BCA', 'DTF', '', '', 'sisa deposit kurangi belanja Bendong Rp30.000')
    Write-Host "Setting integer value..."
    $ws.Cells.Item(84, 3).Value2 = $arr[1]
    Write-Host "Success!"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
} finally {
    $wb.Close($false)
    $excel.Quit()
}
