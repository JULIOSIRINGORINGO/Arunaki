using System;
using System.Runtime.InteropServices;
using System.Diagnostics;

public class ExcelSandbox {
    [DllImport("user32.dll")]
    static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

    [DllImport("user32.dll", SetLastError = true)]
    static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll")]
    static extern IntPtr SetParent(IntPtr hWndChild, IntPtr hWndNewParent);

    [DllImport("user32.dll")]
    static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    const int GWL_STYLE = -16;
    const int WS_CHILD = 0x40000000;
    const int WS_POPUP = unchecked((int)0x80000000);
    const int WS_CAPTION = 0x00C00000;
    const uint SWP_NOZORDER = 0x0004;
    const uint SWP_FRAMECHANGED = 0x0020;

    public async Task<object> LaunchAndReparent(dynamic input) {
        string filePath = input.filePath;
        IntPtr containerHwnd = (IntPtr)Convert.ToInt64(input.containerHwnd);

        Process excel = new Process();
        excel.StartInfo.FileName = "excel.exe";
        excel.StartInfo.Arguments = "\"" + filePath + "\"";
        excel.Start();
        excel.WaitForInputIdle(5000);

        IntPtr hwnd = excel.MainWindowHandle;
        
        // Strip chrome
        int style = GetWindowLong(hwnd, GWL_STYLE);
        style &= ~(WS_POPUP | WS_CAPTION);
        style |= WS_CHILD;
        SetWindowLong(hwnd, GWL_STYLE, style);

        // Reparent
        SetParent(hwnd, containerHwnd);
        SetWindowPos(hwnd, IntPtr.Zero, 0, 0, (int)input.width, (int)input.height, SWP_NOZORDER | SWP_FRAMECHANGED);

        return hwnd.ToInt64();
    }
}
