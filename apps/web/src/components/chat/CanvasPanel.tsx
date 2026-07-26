import { useState } from "react";
import Markdown from "react-markdown";
import {
  Sparkles,
  X,
  Copy,
  CopyCheck,
  Maximize2,
  Minimize2,
  Download,
  FileSpreadsheet,
  FileText,
  File,
  History,
} from "lucide-react";
import { cn } from "../../lib/utils";

export interface CanvasData {
  id: string;
  title: string;
  brandColorHeader: string;
  plainTextContent: string;
  createdAt: string;
}

interface PendingDownload {
  filename: string;
  mimeType: string;
  base64: string;
}

interface Artifact {
  id: string;
  type: string;
  filename: string;
  mimeType: string;
  preview: string;
  status: string;
  createdAt: string;
}

interface CanvasPanelProps {
  isOpen: boolean;
  onClose: () => void;
  canvasData?: CanvasData | null;
  pendingDownload?: PendingDownload | null;
  artifacts?: Artifact[];
}

const API_BASE = "http://localhost:3000/api/v1";

function getFileLabel(mimeType: string): string {
  if (mimeType.includes("pdf")) return "PDF";
  if (mimeType.includes("wordprocessingml")) return "DOCX";
  if (mimeType.includes("presentationml")) return "PPTX";
  if (mimeType.includes("spreadsheetml")) return "XLSX";
  if (mimeType.includes("csv")) return "CSV";
  return "FILE";
}

function getFileIcon(mimeType: string) {
  if (mimeType.includes("spreadsheetml") || mimeType.includes("csv"))
    return FileSpreadsheet;
  if (mimeType.includes("presentationml")) return File;
  return FileText;
}

export function CanvasPanel({
  isOpen,
  onClose,
  canvasData,
  pendingDownload,
  artifacts = [],
}: CanvasPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showArtifacts, setShowArtifacts] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!canvasData) return;
    navigator.clipboard.writeText(canvasData.plainTextContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = () => {
    if (!pendingDownload) return;
    try {
      const byteString = atob(pendingDownload.base64);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: pendingDownload.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = pendingDownload.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      navigator.clipboard.writeText(pendingDownload.base64);
    }
  };

  const handleDownloadArtifact = (artifact: Artifact) => {
    const url = `${API_BASE}/chat/artifacts/${artifact.id}/download`;
    const a = document.createElement("a");
    a.href = url;
    a.download = artifact.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadTxt = () => {
    if (!canvasData) return;
    const element = document.createElement("a");
    const file = new Blob([canvasData.plainTextContent], {
      type: "text/plain",
    });
    element.href = URL.createObjectURL(file);
    element.download = `rekap-${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleDownloadCsv = () => {
    if (!canvasData) return;
    const lines = canvasData.plainTextContent.split("\n");
    const csvContent = lines
      .map((l) => `"${l.replace(/"/g, '""')}"`)
      .join("\n");
    const element = document.createElement("a");
    const file = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
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
        isExpanded ? "w-[480px] lg:w-[520px]" : "w-[340px] xl:w-[380px]",
      )}
    >
      {/* Canvas Header */}
      <div className="px-5 py-4 border-b border-gray-100 bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-gray-900 tracking-tight truncate">
            {showArtifacts ? "Riwayat File" : canvasData?.title || "Canvas"}
          </h2>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {artifacts.length > 0 && (
            <button
              onClick={() => setShowArtifacts(!showArtifacts)}
              className={cn(
                "p-1.5 rounded-lg transition-colors cursor-pointer",
                showArtifacts
                  ? "text-emerald-700 bg-emerald-50"
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-100",
              )}
              title="Riwayat File"
            >
              <History className="w-4 h-4" />
            </button>
          )}

          {canvasData && !showArtifacts && (
            <>
              {pendingDownload && (
                <button
                  onClick={handleDownloadFile}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                  title={`Download ${getFileLabel(pendingDownload.mimeType)}`}
                >
                  <FileText className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleDownloadCsv}
                className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                title="Download File CSV"
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
            {isExpanded ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
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

      {/* Canvas Body */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center min-h-0">
        {showArtifacts ? (
          <div className="w-full space-y-2">
            {artifacts.length === 0 ? (
              <div className="text-center space-y-2 text-gray-400 py-8">
                <History className="w-5 h-5 text-gray-300 mx-auto" />
                <p className="text-xs">Belum ada file yang di-generate</p>
              </div>
            ) : (
              artifacts.map((artifact) => {
                const Icon = getFileIcon(artifact.mimeType);
                const time = new Date(artifact.createdAt).toLocaleTimeString(
                  "id-ID",
                  { hour: "2-digit", minute: "2-digit" },
                );
                return (
                  <div
                    key={artifact.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-200/90 shadow-2xs hover:border-gray-300 transition-colors group"
                  >
                    <div className="p-2 rounded-lg bg-gray-50 text-gray-500 shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {artifact.filename}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {artifact.preview}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-300">{time}</span>
                      <button
                        onClick={() => handleDownloadArtifact(artifact)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                        title={`Download ${artifact.filename}`}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : canvasData ? (
          <div className="relative w-full h-full flex flex-col justify-between p-6 rounded-2xl bg-white border border-gray-200/90 shadow-2xs space-y-2 group overflow-y-auto">
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

            <div className="text-sm text-gray-900 leading-relaxed selection:bg-emerald-100 pr-8 [&_table]:w-full [&_table]:border-collapse [&_th]:text-left [&_th]:py-2 [&_th]:px-3 [&_th]:text-xs [&_th]:font-semibold [&_th]:text-gray-600 [&_td]:py-2 [&_td]:px-3 [&_td]:text-gray-800 [&_tr]:border-b [&_tr]:border-gray-100 [&_strong]:font-semibold [&_strong]:text-gray-900">
              <Markdown>{canvasData.plainTextContent}</Markdown>
            </div>

            {pendingDownload && (
              <div className="pt-3 border-t border-gray-100">
                <button
                  onClick={handleDownloadFile}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download {getFileLabel(pendingDownload.mimeType)}</span>
                  <span className="text-gray-400 text-xs">
                    ({pendingDownload.filename})
                  </span>
                </button>
              </div>
            )}
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
