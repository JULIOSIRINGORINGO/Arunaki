import os
import re
import win32com.client

def parse_txt_report(txt_path):
    """Parses daily transaction text file and extracts structured data."""
    with open(txt_path, 'r', encoding='utf-8') as f:
        lines = [l.strip() for l in f.readlines() if l.strip()]

    data = {
        'date_day': None,
        'date_month_name': None,
        'date_year': None,
        'pemasukan_items': [],
        'total_pemasukan': 0,
        'total_bca': 0,
        'total_bni': 0,
        'total_bri': 0,
        'total_mandiri': 0,
        'total_cash': 0,
        'total_pengeluaran': 0,
        'pengeluaran_items': []
    }

    current_section = None

    for line in lines:
        date_match = re.search(r'(\d{1,2})\s+(AGUSTUS|JANUARI|FEBRUARI|MARET|APRIL|MEI|JUNI|JULI|SEPTEMBER|OKTOBER|NOVEMBER|DESEMBER)\s+(\d{4})', line, re.IGNORECASE)
        if date_match:
            data['date_day'] = int(date_match.group(1))
            data['date_month_name'] = date_match.group(2).upper()
            data['date_year'] = int(date_match.group(3))
            continue

        if 'PEMASUKAN :' in line:
            current_section = 'pemasukan'
            continue
        elif 'NOTE BELUM BAYAR :' in line or 'SISA PEMBAYARAN :' in line:
            current_section = 'other'
            continue
        elif 'PENGELUARAN :' in line:
            current_section = 'pengeluaran'
            continue
        elif 'BELANJAAN KE LABURA:' in line:
            current_section = 'other'
            continue

        if current_section == 'pemasukan':
            if 'TOTAL PEMASUKAN' in line or 'TOTAL TF' in line or 'TOTAL MANDIRI' in line:
                pass
            elif '=' in line and 'RB' in line:
                data['pemasukan_items'].append(line.replace('✅', '').strip())

        elif current_section == 'pengeluaran':
            if 'TOTAL PENGELUARAN' in line or 'TOTAL UANG' in line or 'SELISIH' in line:
                pass
            elif '=' in line and 'RB' in line:
                data['pengeluaran_items'].append(line.replace('✅', '').strip())

        if 'TOTAL PEMASUKAN:' in line:
            m = re.search(r'([\d\.]+)\s*RB', line)
            if m:
                data['total_pemasukan'] = float(m.group(1).replace('.', ''))
        elif 'TOTAL TF BCA :' in line:
            m = re.search(r'([\d\.]+)\s*RB', line)
            if m:
                data['total_bca'] = float(m.group(1).replace('.', ''))
        elif 'TOTAL TF BNI :' in line:
            m = re.search(r'([\d\.]+)\s*RB', line)
            if m:
                data['total_bni'] = float(m.group(1).replace('.', ''))
        elif 'TOTAL TF BRI :' in line:
            m = re.search(r'([\d\.]+)\s*RB', line)
            if m:
                data['total_bri'] = float(m.group(1).replace('.', ''))
        elif 'TOTAL MANDIRI :' in line:
            m = re.search(r'([\d\.]+)\s*RB', line)
            if m:
                data['total_mandiri'] = float(m.group(1).replace('.', ''))
        elif 'TOTAL CASH :' in line:
            m = re.search(r'([\d\.]+)\s*RB', line)
            if m:
                data['total_cash'] = float(m.group(1).replace('.', ''))
        elif 'TOTAL PENGELUARAN:' in line:
            m = re.search(r'([\d\.]+)\s*RB', line)
            if m:
                data['total_pengeluaran'] = float(m.group(1).replace('.', ''))

    return data


def update_excel_via_com(excel_abs_path, parsed_data):
    """Updates cell values via Native Windows Excel COM Engine to preserve 100% VBA macros and visual styles."""
    excel = None
    try:
        excel = win32com.client.Dispatch("Excel.Application")
        excel.Visible = False
        excel.DisplayAlerts = False

        wb = excel.Workbooks.Open(excel_abs_path)
        sheet_name = parsed_data['date_month_name'] or 'AGUSTUS'
        sheet = wb.Sheets(sheet_name)

        target_day = parsed_data['date_day'] or 10
        col_idx = target_day + 2  # Day 10 = Col 12 (L)

        # 1. Pemasukan Summary (Excel Row 4)
        sheet.Cells(4, col_idx).Value = parsed_data['total_pemasukan']

        # 2. Pemasukan Items (Excel Rows 5-9)
        for i, item in enumerate(parsed_data['pemasukan_items']):
            row_idx = 5 + i
            sheet.Cells(row_idx, col_idx).Value = item

        # 3. Totals (Excel Rows 14, 16, 17, 18, 19)
        sheet.Cells(14, col_idx).Value = f" Rp{parsed_data['total_pemasukan']:,.0f}.000 " if parsed_data['total_pemasukan'] else " Rp- "
        sheet.Cells(16, col_idx).Value = f" Rp{parsed_data['total_bni']:,.0f}.000 " if parsed_data['total_bni'] else None
        sheet.Cells(17, col_idx).Value = f" Rp{parsed_data['total_bca']:,.0f}.000 " if parsed_data['total_bca'] else None
        sheet.Cells(18, col_idx).Value = f" Rp{parsed_data['total_mandiri']:,.0f}.000 " if parsed_data['total_mandiri'] else None
        sheet.Cells(19, col_idx).Value = f" Rp{parsed_data['total_cash']:,.0f}.000 " if parsed_data['total_cash'] else None

        # 4. Total Pengeluaran (Excel Row 22)
        sheet.Cells(22, col_idx).Value = f" Rp{parsed_data['total_pengeluaran']:,.0f}.000 " if parsed_data['total_pengeluaran'] else " Rp- "

        wb.Save()
        wb.Close(SaveChanges=True)
        print(f"SUCCESS: Native Excel COM Engine updated {sheet_name} (Col {col_idx}) cleanly!")
    except Exception as e:
        print(f"ERROR in Excel COM Engine: {e}")
        raise e
    finally:
        if excel:
            excel.Quit()


if __name__ == '__main__':
    txt_path = os.path.abspath('e:/JS/laporan-test/REKAPAN TERBARU2.txt')
    excel_path = os.path.abspath('e:/JS/laporan-test/TABEL REKAPAN NEW2026-.xlsm')

    data = parse_txt_report(txt_path)
    print("Parsed Data from TXT:", data)
    update_excel_via_com(excel_path, data)
