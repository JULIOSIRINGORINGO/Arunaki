import { useState, useEffect, useRef, useCallback } from "react";
import {
  FileSpreadsheet,
  FileText,
  Save,
  X,
  ExternalLink,
  Sparkles,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

export interface DocumentEngineProps {
  filePath: string;
  fileName: string;
  fileType: "xlsx" | "xlsm" | "xls" | "csv" | "docx" | "doc" | "pptx" | "ppt";
  onClose: () => void;
  onSave?: () => void;
  onAnalyzeAI?: () => void;
  onOpenNativeOS?: () => void;
}



export default function DocumentEngineHost({
  filePath,
  fileName,
  fileType,
  onClose,
  onSave,
  onAnalyzeAI,
  onOpenNativeOS,
}: DocumentEngineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const univerAPIRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const isSpreadsheet = ["xlsx", "xlsm", "xls", "csv"].includes(fileType);
  const documentType = isSpreadsheet ? "cell" : ["docx", "doc"].includes(fileType) ? "word" : "slide";

  // Cleanup function for Univer instance
  const disposeUniver = useCallback(() => {
    if (univerAPIRef.current) {
      try {
        univerAPIRef.current.dispose();
      } catch {
        // silently cleanup
      }
      univerAPIRef.current = null;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initUniver = async () => {
      if (!containerRef.current) return;

      setIsLoading(true);
      setErrorMessage(null);
      setIsReady(false);

      try {
        // 1. Dynamic import Univer modules (code-split for performance)
        const [
          { createUniver, LocaleType, mergeLocales },
          { UniverSheetsCorePreset },
          sheetsLocaleIdID,
        ] = await Promise.all([
          import("@univerjs/presets"),
          import("@univerjs/preset-sheets-core"),
          import("@univerjs/preset-sheets-core/locales/id-ID"),
        ]);

        if (!isMounted) return;

        // 2. Import Univer CSS
        await import("@univerjs/preset-sheets-core/lib/index.css");

        if (!isMounted) return;

        // 3. Clear previous container content
        containerRef.current.innerHTML = "";

        // 4. Create Univer instance with Indonesian locale
        const { univerAPI } = createUniver({
          locale: LocaleType.ID_ID,
          locales: {
            [LocaleType.ID_ID]: mergeLocales(sheetsLocaleIdID.default || sheetsLocaleIdID),
          },
          presets: [
            UniverSheetsCorePreset({
              container: containerRef.current,
            }),
          ],
        });

        if (!isMounted) {
          univerAPI.dispose();
          return;
        }

        univerAPIRef.current = univerAPI;

        // 5. Read parsed Excel data from Electron IPC and inject into Univer
        const desktop = (window as any).arunakiDesktop;

        if (desktop?.parseExcel && isSpreadsheet) {
          try {
            const parseRes = await desktop.parseExcel(filePath);
            if (parseRes?.success && parseRes.rows?.length > 0) {
              // Convert parsed rows (array of arrays) into Univer IWorkbookData cellData format
              const cellData: Record<number, Record<number, { v: string | number | boolean }>> = {};
              const rows = parseRes.rows as (string | number | boolean | null | undefined)[][];
              let maxCol = 0;

              for (let r = 0; r < rows.length; r++) {
                const row = rows[r];
                if (!row) continue;
                cellData[r] = {};
                for (let c = 0; c < row.length; c++) {
                  const cell = row[c];
                  if (cell !== null && cell !== undefined) {
                    if (typeof cell === "object" && cell !== null) {
                      const displayValue = (cell as any).w !== undefined && (cell as any).w !== "" ? (cell as any).w : (cell as any).v;
                      if (displayValue !== null && displayValue !== undefined && displayValue !== "") {
                        cellData[r][c] = { v: displayValue };
                      }
                    } else if (cell !== "") {
                      cellData[r][c] = { v: cell as string | number | boolean };
                    }
                  }
                }
                if (row.length > maxCol) maxCol = row.length;
              }

              // Build sheets object — one sheet per parsed sheet
              const sheetId = "sheet_main";
              const workbookData = {
                id: `workbook_${Date.now()}`,
                name: fileName,
                sheetOrder: [sheetId],
                sheets: {
                  [sheetId]: {
                    id: sheetId,
                    name: parseRes.sheetName || "Sheet1",
                    rowCount: Math.max(rows.length + 50, 200),
                    columnCount: Math.max(maxCol + 10, 26),
                    cellData,
                  },
                },
              };

              (univerAPI as any).createWorkbook(workbookData);
            } else {
              // No data parsed, create empty workbook
              (univerAPI as any).createWorkbook({});
            }
          } catch (importErr) {
            console.warn("Excel parse fallback — creating empty workbook:", importErr);
            (univerAPI as any).createWorkbook({});
          }
        } else {
          // Non-spreadsheet or no desktop bridge — create empty workbook
          (univerAPI as any).createWorkbook({});
        }

        if (isMounted) {
          setIsReady(true);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error("Univer init error:", err);
        if (isMounted) {
          setIsLoading(false);
          setErrorMessage(`Gagal memuat Univer Spreadsheet Engine: ${err.message}`);
        }
      }
    };

    initUniver();

    return () => {
      isMounted = false;
      disposeUniver();
    };
  }, [filePath, fileName, fileType, isSpreadsheet, disposeUniver]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-gray-900 rounded-2xl shadow-2xl border border-gray-800 w-full max-w-7xl h-[93vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Univer Document Host Header Toolbar */}
        <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-gray-950 text-white border-b border-gray-800 gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
              {isSpreadsheet ? (
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              ) : (
                <FileText className="w-4 h-4 text-blue-400" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-xs sm:text-sm truncate text-white">{fileName}</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 uppercase">
                  Univer Engine
                </span>
              </div>
              <p className="text-[10px] text-gray-400 font-mono truncate">{filePath}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onSave && (
              <button
                type="button"
                onClick={onSave}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all shadow-xs cursor-pointer active:scale-98"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan</span>
              </button>
            )}

            {onAnalyzeAI && (
              <button
                type="button"
                onClick={onAnalyzeAI}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium transition-all shadow-xs cursor-pointer active:scale-98"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Analisis AI</span>
              </button>
            )}

            {onOpenNativeOS && (
              <button
                type="button"
                onClick={onOpenNativeOS}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl border border-gray-700 font-medium transition-all shadow-xs cursor-pointer"
                title="Buka di Aplikasi OS bawaan"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Buka di OS</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-gray-800 text-gray-400 hover:text-white rounded-xl transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Editor Body Container */}
        <div className="flex-1 bg-white relative overflow-hidden flex flex-col">
          {isLoading && (
            <div className="absolute inset-0 bg-gray-950/90 z-20 flex flex-col items-center justify-center p-6 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
              <div className="space-y-1">
                <h4 className="font-semibold text-sm text-white">Memuat Univer Spreadsheet Engine...</h4>
                <p className="text-xs text-gray-400">Menyiapkan editor untuk {fileName}</p>
              </div>
            </div>
          )}

          {/* Error state */}
          {errorMessage && !isLoading && (
            <div className="absolute inset-0 bg-gray-950/90 z-20 flex flex-col items-center justify-center p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <div className="max-w-md space-y-2">
                <h4 className="font-bold text-base text-white">Gagal Memuat Editor</h4>
                <p className="text-[11px] text-amber-400/90 font-mono bg-amber-950/40 p-2.5 rounded-lg border border-amber-800/40">
                  {errorMessage}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {onOpenNativeOS && (
                  <button
                    type="button"
                    onClick={onOpenNativeOS}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-all active:scale-98 cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Buka File di Aplikasi OS Bawaan</span>
                  </button>
                )}
                {onAnalyzeAI && (
                  <button
                    type="button"
                    onClick={onAnalyzeAI}
                    className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-all active:scale-98 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Minta AI Analisis File Ini</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Univer Spreadsheet Container — Univer renders directly into this div */}
          <div
            ref={containerRef}
            className="w-full h-full flex-1"
            style={{ minHeight: 0 }}
          />
        </div>

        {/* Univer Footer Info Bar */}
        <div className="px-4 py-2 bg-gray-950 border-t border-gray-800 text-[11px] text-gray-400 flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono">
            <span className={`w-2 h-2 rounded-full ${isReady ? "bg-emerald-500" : "bg-amber-500"} animate-pulse`} />
            <span>Univer Document Engine (Tipe: {documentType.toUpperCase()})</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="hover:text-gray-200 text-xs font-medium cursor-pointer"
          >
            Tutup Editor
          </button>
        </div>
      </div>
    </div>
  );
}
