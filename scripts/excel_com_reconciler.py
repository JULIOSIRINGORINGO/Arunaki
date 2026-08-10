import os
import sys
import json
import win32com.client

def execute_excel_actions(excel_abs_path, actions):
    """
    Generic Windows Excel COM Engine Runner.
    Accepts arbitrary cell action payloads generated dynamically by Arunaki's LLM Agent.
    """
    excel = None
    try:
        excel = win32com.client.Dispatch("Excel.Application")
        excel.Visible = False
        excel.DisplayAlerts = False

        wb = excel.Workbooks.Open(excel_abs_path)
        
        for act in actions:
            sheet_name = act.get('sheet', 'AGUSTUS')
            sheet = wb.Sheets(sheet_name)
            action_type = act.get('action', 'write')
            cell = act.get('cell')
            value = act.get('value')

            if action_type in ['write', 'write_cell'] and cell:
                sheet.Range(cell).Value = value

        wb.Save()
        wb.Close(SaveChanges=True)
        print(f"SUCCESS: Executed {len(actions)} dynamic actions via Excel COM Engine!")
    except Exception as e:
        print(f"ERROR executing Excel actions via COM: {e}")
        sys.exit(1)
    finally:
        if excel:
            excel.Quit()

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python excel_com_reconciler.py <excel_file_path> <actions_json>")
        sys.exit(1)

    excel_path = os.path.abspath(sys.argv[1])
    actions_json = json.loads(sys.argv[2])
    execute_excel_actions(excel_path, actions_json)
