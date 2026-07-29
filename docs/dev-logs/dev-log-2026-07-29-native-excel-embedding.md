# Dev Log — Native Microsoft Excel Desktop Embedding in Arunaki Workspace

**Date:** 2026-07-29  
**Author:** Antigravity Agent  

## Summary
Memperbaiki bug utama pencarian Window Handle Excel di Windows 10/11 di mana `Process.MainWindowHandle` awal mengembalikan `IntPtr.Zero` atau hidden handle, sehingga Excel sempat melayang (*floating*) di luar Electron.

## Fixes Implemented

1. **Window Enumeration & Polling (`XLMAIN`)**:
   - Mengganti `excel.MainWindowHandle` dengan fungsi pencarian polling `EnumWindows` selama hingga 10 detik.
   - Mencari HWND yang terbukti `IsWindowVisible(hWnd) == true` dengan class name persis `"XLMAIN"` yang memiliki `ProcessId == excel.Id`.

2. **Extended Styles Removal (`GWL_EXSTYLE`)**:
   - Menghapus style extended `WS_EX_APPWINDOW` (`0x00040000`) dan menambahkan `WS_EX_TOOLWINDOW` (`0x00000080`).
   - Hal ini memaksa Windows OS mengunci window Excel sebagai child control murni dari parent HWND Electron, sehingga tidak bisa lagi dipindah-pindah atau melayang di luar layar Electron.

3. **PowerShell Fallback Sync**:
   - Mensinkronkan logika `EnumWindows` dan `GWL_EXSTYLE` pada PowerShell fallback script di `main.cjs`.

## Verification
- Window Excel `XLMAIN` berhasil dilacak dan dikunci (*reparented*) secara penuh di dalam viewport Electron BrowserWindow.
