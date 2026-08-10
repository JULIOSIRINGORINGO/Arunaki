# PowerShell COM Excel Updater (Exact 1-indexed Row Mapping)
Param(
    [string]$FilePath = "e:\JS\laporan-test\TABEL REKAPAN NEW2026-.xlsm",
    [string]$SheetName = "AGUSTUS",
    [int]$Day = 10
)

try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false

    $workbook = $excel.Workbooks.Open($FilePath)
    $worksheet = $workbook.Sheets.Item($SheetName)

    # Column L is Col 12 (Day 10 = Col 12)
    $col = $Day + 2

    # Excel Row 4 (PEMASUKAN summary)
    $worksheet.Cells.Item(4, $col).Value2 = 1700

    # Excel Rows 5-9 (Transactions)
    $worksheet.Cells.Item(5, $col).Value2 = "TOKO HARAPAN = 600RB(BCA) [ DTF ]"
    $worksheet.Cells.Item(6, $col).Value2 = "KAK MELLY = 350RB(BNI) [ 15 PCS ]"
    $worksheet.Cells.Item(7, $col).Value2 = "PAK HENDRA = 150RB(MANDIRI) [ 2 PCS ]"
    $worksheet.Cells.Item(8, $col).Value2 = "WARUNG BERKAH = 500RB(BCA) [ 30 PCS ]"
    $worksheet.Cells.Item(9, $col).Value2 = "BU MARIAM = 100RB(CASH) [ DTF ]"

    # Excel Rows 14-19 (Totals)
    $worksheet.Cells.Item(14, $col).Value2 = " Rp1,700.000 "
    $worksheet.Cells.Item(16, $col).Value2 = " Rp350.000 "
    $worksheet.Cells.Item(17, $col).Value2 = " Rp1,100.000 "
    $worksheet.Cells.Item(18, $col).Value2 = " Rp150.000 "
    $worksheet.Cells.Item(19, $col).Value2 = " Rp100.000 "

    # Excel Row 22 (Pengeluaran total)
    $worksheet.Cells.Item(22, $col).Value2 = " Rp150.000 "

    $workbook.Save()
    $workbook.Close($true)
    $excel.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null

    Write-Host "SUCCESS: Excel COM automation updated cells in $SheetName Col $col preserving 100% formatting & colors!"
} catch {
    Write-Error $_.Exception.Message
}
