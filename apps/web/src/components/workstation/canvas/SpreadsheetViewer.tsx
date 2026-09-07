import { useState, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  FileSpreadsheet,
  ExternalLink,
  Search,
  Copy,
  Check,
  ShieldCheck,
  X,
  Layers,
} from "lucide-react";
import { cn } from "../../../lib/utils";

interface SpreadsheetViewerProps {
  content: string;
  filePath?: string;
  title: string;
}

interface ParsedSheetData {
  name: string;
  rowCount: number;
  colCount: number;
  colHeaders: string[]; // ['A', 'B', 'C', ...]
  rows: Array<Array<{
    address: string;
    value: any;
    formatted: string;
    formula?: string;
    type?: string;
  }>>;
}

export function SpreadsheetViewer({ content, filePath, title }: SpreadsheetViewerProps) {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [selectedCell, setSelectedCell] = useState<{
    address: string;
    value: string;
    formula?: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);

  // Parse workbook in-memory without modifying original file
  const parsedWorkbook = useMemo(() => {
    if (!content || content.trim() === "" || content === "Empty document...") {
      return null;
    }

    try {
      let wb: XLSX.WorkBook | null = null;
      const isCsv = title.toLowerCase().endsWith(".csv");

      if (isCsv) {
        wb = XLSX.read(content, { type: "string" });
      } else if (content.startsWith("UEsDB") || /^[A-Za-z0-9+/=]{80,}/.test(content.slice(0, 100))) {
        wb = XLSX.read(content, {
          type: "base64",
          cellStyles: true,
          cellFormula: true,
          cellDates: true,
          cellNF: true,
        });
      } else {
        wb = XLSX.read(content, {
          type: "binary",
          cellStyles: true,
          cellFormula: true,
          cellDates: true,
          cellNF: true,
        });
      }

      if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
        return null;
      }

      const sheets: ParsedSheetData[] = wb.SheetNames.map((sheetName) => {
        const ws = wb!.Sheets[sheetName];
        if (!ws || !ws["!ref"]) {
          return {
            name: sheetName,
            rowCount: 0,
            colCount: 0,
            colHeaders: [],
            rows: [],
          };
        }

        const range = XLSX.utils.decode_range(ws["!ref"]);
        const maxCols = Math.min(range.e.c + 1, 100); // cap max visible columns for performance
        const maxRows = Math.min(range.e.r + 1, 1000); // cap max visible rows

        // Build column letter headers: A, B, C, ... AA, AB ...
        const colHeaders: string[] = [];
        for (let C = 0; C < maxCols; C++) {
          colHeaders.push(XLSX.utils.encode_col(C));
        }

        const rows: ParsedSheetData["rows"] = [];
        for (let R = 0; R < maxRows; R++) {
          const rowData: ParsedSheetData["rows"][0] = [];
          for (let C = 0; C < maxCols; C++) {
            const address = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = ws[address];
            if (!cell) {
              rowData.push({
                address,
                value: null,
                formatted: "",
              });
            } else {
              const formatted = cell.w !== undefined ? String(cell.w) : (cell.v !== undefined ? String(cell.v) : "");
              rowData.push({
                address,
                value: cell.v,
                formatted,
                formula: cell.f ? String(cell.f) : undefined,
                type: cell.t,
              });
            }
          }
          rows.push(rowData);
        }

        return {
          name: sheetName,
          rowCount: rows.length,
          colCount: colHeaders.length,
          colHeaders,
          rows,
        };
      });

      return {
        sheets,
        rawWorkbook: wb,
      };
    } catch (err) {
      console.error("[SpreadsheetViewer] Failed to parse Excel buffer:", err);
      return null;
    }
  }, [content, title]);

  const activeSheet = parsedWorkbook?.sheets[activeSheetIndex] || parsedWorkbook?.sheets[0] || null;

  // Open physical file directly in native desktop Microsoft Excel / WPS Office
  const handleOpenNative = useCallback(async () => {
    if (!filePath) return;
    const desktop = typeof window !== "undefined" && (window as any).arunakiDesktop;
    if (desktop?.openExcelNative) {
      await desktop.openExcelNative(filePath);
    } else if (desktop?.openPath) {
      await desktop.openPath(filePath);
    }
  }, [filePath]);

  // Export current sheet to CSV onto clipboard
  const handleCopySheetCsv = useCallback(() => {
    if (!parsedWorkbook?.rawWorkbook || !activeSheet) return;
    const ws = parsedWorkbook.rawWorkbook.Sheets[activeSheet.name];
    if (!ws) return;
    const csv = XLSX.utils.sheet_to_csv(ws);
    navigator.clipboard.writeText(csv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [parsedWorkbook, activeSheet]);

  const activeAddress = selectedCell?.address || (activeSheet?.rows[0]?.[0]?.address ?? "A1");
  const activeFormula = selectedCell?.formula
    ? `=${selectedCell.formula}`
    : selectedCell?.value ?? (activeSheet?.rows[0]?.[0]?.formatted ?? "");

  if (!parsedWorkbook || !activeSheet) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-[#1e1e1e] text-[#cccccc] p-8 text-center select-none">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 text-emerald-400">
          <FileSpreadsheet className="w-7 h-7" />
        </div>
        <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
        <p className="text-xs text-[#858585] max-w-md mb-6">
          Berkas spreadsheet biner telah dimuat. Anda dapat membukanya langsung di Microsoft Excel desktop atau memeriksa integritasnya.
        </p>
        <button
          onClick={handleOpenNative}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-medium transition-all shadow-md active:scale-95 cursor-pointer"
        >
          <ExternalLink className="w-4 h-4" />
          Buka di Microsoft Excel
        </button>
      </div>
    );
  }

  const query = searchQuery.trim().toLowerCase();

  return (
    <div className="h-full w-full flex flex-col bg-[#1e1e1e] text-[#cccccc] select-none overflow-hidden font-sans">
      {/* 1. TOP TOOLBAR & FORMULA BAR */}
      <div className="shrink-0 flex flex-col border-b border-[#2d2d2d] bg-[#1e1e1e]">
        {/* Row 1: Actions, Sheet details, Search */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#252526] gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium text-[11px]">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{activeSheet.name}</span>
            </div>
            <span className="text-[11px] text-[#858585] hidden sm:inline">
              {activeSheet.rowCount} baris × {activeSheet.colCount} kolom
            </span>
            <div
              className="flex items-center gap-1 text-[11px] text-emerald-400/80 bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-800/30"
              title="Berkas dibuka secara aman di memori (read-only) tanpa mengubah format asli OOXML Excel."
            >
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span className="hidden md:inline">Non-Destructive Embed</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick search */}
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-2 text-[#707070]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari di sheet..."
                className="pl-7 pr-6 py-1 bg-[#252526] border border-[#333333] focus:border-emerald-500 rounded text-[11px] text-white w-32 md:w-44 outline-none transition-all placeholder:text-[#666666]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-1.5 text-[#888888] hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Copy CSV */}
            <button
              onClick={handleCopySheetCsv}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#2a2a2b] hover:bg-[#333334] text-[#cccccc] hover:text-white text-[11px] transition-colors border border-[#333333] cursor-pointer"
              title="Salin isi sheet ini sebagai CSV ke clipboard"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span className="hidden lg:inline">{copied ? "Disalin" : "Salin CSV"}</span>
            </button>

            {/* Open in Microsoft Excel Native */}
            <button
              onClick={handleOpenNative}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-medium transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
              title="Buka dokumen ini langsung di aplikasi Microsoft Excel desktop asli"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Buka di Excel</span>
            </button>
          </div>
        </div>

        {/* Row 2: Excel Formula / Address Bar */}
        <div className="flex items-center px-2 py-1 bg-[#222222] font-mono text-[12px] gap-2">
          {/* Active cell indicator (e.g. A1, H21) */}
          <div className="w-14 shrink-0 px-2 py-0.5 text-center font-bold text-emerald-400 bg-[#1a1a1a] rounded border border-[#333333]">
            {activeAddress}
          </div>
          <div className="text-[#666666] select-none font-sans italic text-[11px] font-semibold px-1">
            fx
          </div>
          {/* Formula or value content */}
          <div className="flex-1 px-2 py-0.5 text-[#e0e0e0] bg-[#1a1a1a] rounded border border-[#2b2b2b] truncate text-[11px]">
            {activeFormula ? String(activeFormula) : <span className="text-[#555555] italic">Kosong</span>}
          </div>
        </div>
      </div>

      {/* 2. SPREADSHEET TABLE GRID VIEW */}
      <div className="flex-1 overflow-auto bg-[#181818] relative scrollbar-thin scrollbar-thumb-[#333] scrollbar-track-transparent">
        <table className="border-collapse w-max min-w-full text-[12px] font-mono">
          {/* Sticky Column Headers (A, B, C...) */}
          <thead className="sticky top-0 z-10 bg-[#252526]">
            <tr>
              {/* Top-left corner box */}
              <th className="sticky left-0 z-20 w-12 min-w-12 h-6 border-r border-b border-[#333333] bg-[#2d2d2d] text-[#888888] font-normal text-center select-none text-[11px]">
                #
              </th>
              {activeSheet.colHeaders.map((colHeader) => (
                <th
                  key={colHeader}
                  className="min-w-28 h-6 px-2 border-r border-b border-[#333333] bg-[#252526] text-[#999999] font-medium text-center select-none text-[11px]"
                >
                  {colHeader}
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Rows & Cells */}
          <tbody>
            {activeSheet.rows.map((row, rowIndex) => {
              const rowNum = rowIndex + 1;
              return (
                <tr key={rowNum} className="hover:bg-[#202022] transition-colors">
                  {/* Sticky Row Number (1, 2, 3...) */}
                  <th className="sticky left-0 z-0 w-12 min-w-12 h-6 px-1.5 border-r border-b border-[#2d2d2d] bg-[#252526] text-[#888888] font-normal text-right select-none text-[11px]">
                    {rowNum}
                  </th>

                  {/* Row Cells */}
                  {row.map((cell) => {
                    const isSelected = selectedCell?.address === cell.address;
                    const isMatch = query && cell.formatted.toLowerCase().includes(query);
                    const isNumeric = typeof cell.value === "number" || (!isNaN(Number(cell.formatted)) && cell.formatted.trim() !== "");

                    return (
                      <td
                        key={cell.address}
                        onClick={() =>
                          setSelectedCell({
                            address: cell.address,
                            value: cell.formatted,
                            formula: cell.formula,
                          })
                        }
                        className={cn(
                          "h-6 px-2 border-r border-b border-[#262626] whitespace-nowrap overflow-hidden text-ellipsis max-w-xs transition-colors cursor-cell",
                          isSelected
                            ? "bg-emerald-950/40 text-white outline outline-2 outline-emerald-500 z-1"
                            : isMatch
                            ? "bg-amber-950/40 text-amber-200"
                            : "text-[#d4d4d4]",
                          isNumeric ? "text-right" : "text-left"
                        )}
                        title={`${cell.address}: ${cell.formula ? `=${cell.formula}` : cell.formatted}`}
                      >
                        {cell.formatted}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 3. BOTTOM MULTI-SHEET TABS BAR */}
      {parsedWorkbook.sheets.length > 0 && (
        <div className="shrink-0 flex items-center px-2 py-1 bg-[#1e1e1e] border-t border-[#2d2d2d] gap-1 overflow-x-auto select-none">
          <div className="flex items-center gap-1 text-[11px] text-[#777777] px-2 py-0.5 font-medium">
            <Layers className="w-3 h-3 text-[#888888]" />
            <span>Sheets:</span>
          </div>
          {parsedWorkbook.sheets.map((sheet, index) => {
            const isActive = index === activeSheetIndex;
            return (
              <button
                key={sheet.name}
                onClick={() => {
                  setActiveSheetIndex(index);
                  setSelectedCell(null);
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all cursor-pointer",
                  isActive
                    ? "bg-[#2d2d2d] text-emerald-400 border-b-2 border-emerald-500 shadow-sm"
                    : "text-[#888888] hover:text-[#cccccc] hover:bg-[#252526]"
                )}
              >
                <FileSpreadsheet className="w-3 h-3" />
                <span>{sheet.name}</span>
                <span className="text-[10px] text-[#666666]">({sheet.rowCount})</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
