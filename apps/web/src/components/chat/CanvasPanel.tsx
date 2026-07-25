import { useState } from "react";
import { Sparkles, X, Copy, CopyCheck, Maximize2, Minimize2, Download, FileSpreadsheet } from "lucide-react";
import { cn } from "../../lib/utils";

export interface CanvasData {
  id: string;
  title: string;
  brandColorHeader: string;
  plainTextContent: string;
  createdAt: string;
}

interface CanvasPanelProps {
  isOpen: boolean;
  onClose: () => void;
  canvasData?: CanvasData | null;
}

export function CanvasPanel({ isOpen, onClose, canvasData }: CanvasPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!canvasData) return;
    navigator.clipboard.writeText(canvasData.plainTextContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    if (!canvasData) return;
    const element = document.createElement("a");
    const file = new Blob([canvasData.plainTextContent], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `rekap-${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleDownloadCsv = () => {
    if (!canvasData) return;
    const lines = canvasData.plainTextContent.split("\n");
    const csvContent = lines.map((l) => `"${l.replace(/"/g, '""')}"`).join("\n");
    const element = document.createElement("a");
    const file = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    element.href = URL.createObjectURL(file);
    element.download = `rekap-${Date.now()}.csv`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-slate-50/40 border-l border-gray-200/80 shrink-0 transition-all duration-200 shadow-xs",
        isExpanded ? "w-[480px] lg:w-[520px]" : "w-[340px] xl:w-[380px]"
      )}
    >
      {/* Canvas Header */}
      <div className="px-5 py-4 border-b border-gray-100 bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-gray-900 tracking-tight truncate">
            {canvasData?.title || "Canvas"}
          </h2>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {canvasData && (
            <>
              <button
                onClick={handleDownloadCsv}
                className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                title="Download File CSV/Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
              </button>
              <button
                onClick={handleDownloadTxt}
                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                title="Download File Teks (.txt)"
              >
                <Download className="w-4 h-4" />
              </button>
            </>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            title={isExpanded ? "Kecilkan Canvas" : "Perbesar Canvas"}
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            title="Tutup Canvas"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas Body: Centered Box with Copy Icon Inside */}
      <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center min-h-0">
        {canvasData ? (
          <div className="relative w-full max-w-sm p-6 rounded-2xl bg-white border border-gray-200/90 shadow-2xs space-y-2 group my-auto max-h-[75%] overflow-y-auto">
            {/* Copy Icon Button inside top-right of plain text box */}
            <button
              onClick={handleCopy}
              className="absolute top-3.5 right-3.5 p-2 rounded-xl text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all cursor-pointer border border-transparent hover:border-gray-200 shadow-2xs"
              title={copied ? "Tersalin!" : "Salin Teks (Copy)"}
            >
              {copied ? (
                <CopyCheck className="w-4 h-4 text-emerald-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>

            {/* Plain Text Content */}
            <div className="font-mono text-sm text-gray-900 leading-relaxed whitespace-pre-wrap selection:bg-emerald-100 pr-8">
              {canvasData.plainTextContent}
            </div>
          </div>
        ) : (
          <div className="text-center space-y-2 text-gray-400">
            <Sparkles className="w-5 h-5 text-gray-300 mx-auto" />
            <p className="text-xs">Canvas Kosong</p>
          </div>
        )}
      </div>
    </aside>
  );
}
