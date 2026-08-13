import { useState, useEffect } from "react";
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
  Edit2,
  Send,
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
  liveScreenshotUrl?: string | null;
  onSaveAndSendToAi?: (updatedContent: string) => void;
}

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
  onSaveAndSendToAi,
}: CanvasPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showArtifacts, setShowArtifacts] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");

  useEffect(() => {
    if (canvasData?.plainTextContent) {
      setEditedText(canvasData.plainTextContent);
    }
  }, [canvasData?.plainTextContent]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!canvasData) return;
    navigator.clipboard.writeText(isEditing ? editedText : canvasData.plainTextContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveAndSend = () => {
    if (onSaveAndSendToAi && editedText.trim()) {
      onSaveAndSendToAi(editedText);
      setIsEditing(false);
    }
  };

  const handleDownloadFile = () => {
    if (!pendingDownload) return;
    const element = document.createElement("a");
    element.href = `data:${pendingDownload.mimeType};base64,${pendingDownload.base64}`;
    element.download = pendingDownload.filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleDownloadArtifact = (art: Artifact) => {
    if (!art.preview) return;
    const element = document.createElement("a");
    element.href = `data:${art.mimeType};base64,${art.preview}`;
    element.download = art.filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleDownloadTxt = () => {
    const textToDownload = isEditing ? editedText : canvasData?.plainTextContent || "";
    if (!textToDownload) return;
    const element = document.createElement("a");
    const file = new Blob([textToDownload], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `rekap-${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setTimeout(() => URL.revokeObjectURL(element.href), 1000);
  };

  const handleDownloadCsv = () => {
    const textToDownload = isEditing ? editedText : canvasData?.plainTextContent || "";
    if (!textToDownload) return;
    const lines = textToDownload.split("\n");
    const csvContent = lines.map((l) => `"${l.replace(/"/g, '""')}"`).join("\n");
    const element = document.createElement("a");
    const file = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    element.href = URL.createObjectURL(file);
    element.download = `rekap-${Date.now()}.csv`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setTimeout(() => URL.revokeObjectURL(element.href), 1000);
  };

  return (
    <aside
      className={cn(
        "bg-[#171717] rounded-xl overflow-hidden flex flex-col h-full shrink-0 transition-all duration-200 shadow-none border border-[#2D2D2D] text-white",
        isExpanded ? "w-[480px] lg:w-[520px]" : "w-[340px] xl:w-[380px]"
      )}
    >
      {/* Top Header Bar */}
      <div className="bg-[#121212] h-10 px-4 flex items-center justify-between shrink-0 select-none border-b border-[#2D2D2D]">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-[#E5E5E5] shrink-0" />
          <h2 className="text-xs font-bold text-white tracking-wide truncate">
            {showArtifacts ? "Riwayat File" : canvasData?.title || "Canvas"}
          </h2>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {artifacts.length > 0 && (
            <button
              onClick={() => setShowArtifacts(!showArtifacts)}
              className={cn(
                "p-1 rounded transition-colors cursor-pointer text-xs",
                showArtifacts
                  ? "text-white bg-[#262626]"
                  : "text-[#A3A3A3] hover:text-white hover:bg-[#262626]"
              )}
              title="Riwayat File"
            >
              <History className="w-3.5 h-3.5" />
            </button>
          )}

          {canvasData && !showArtifacts && (
            <>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={cn(
                  "p-1 rounded transition-colors cursor-pointer text-xs",
                  isEditing
                    ? "text-white bg-[#262626]"
                    : "text-[#A3A3A3] hover:text-white hover:bg-[#262626]"
                )}
                title={isEditing ? "Mode Preview" : "Edit Canvas"}
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>

              {pendingDownload && (
                <button
                  onClick={handleDownloadFile}
                  className="p-1 rounded text-[#A3A3A3] hover:text-white hover:bg-[#262626] transition-colors cursor-pointer"
                  title={`Download ${getFileLabel(pendingDownload.mimeType)}`}
                >
                  <FileText className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={handleDownloadCsv}
                className="p-1 rounded text-[#A3A3A3] hover:text-white hover:bg-[#262626] transition-colors cursor-pointer"
                title="Download File CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDownloadTxt}
                className="p-1 rounded text-[#A3A3A3] hover:text-white hover:bg-[#262626] transition-colors cursor-pointer"
                title="Download File Teks (.txt)"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded text-[#A3A3A3] hover:text-white hover:bg-[#262626] transition-colors cursor-pointer"
            title={isExpanded ? "Kecilkan Canvas" : "Perbesar Canvas"}
          >
            {isExpanded ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#A3A3A3] hover:text-white hover:bg-[#262626] transition-colors cursor-pointer"
            title="Tutup Canvas"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas Body View */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center min-h-0 bg-[#171717]">
        {showArtifacts ? (
          <div className="w-full space-y-2 self-start">
            {artifacts.length === 0 ? (
              <div className="text-center space-y-2 text-[#737373] py-8">
                <History className="w-5 h-5 text-[#A3A3A3] mx-auto" />
                <p className="text-xs">Belum ada file yang di-generate</p>
              </div>
            ) : (
              artifacts.map((artifact) => {
                const Icon = getFileIcon(artifact.mimeType);
                const time = new Date(artifact.createdAt).toLocaleTimeString(
                  "id-ID",
                  { hour: "2-digit", minute: "2-digit" }
                );
                return (
                  <div
                    key={artifact.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[#1E1E1E] border border-[#2D2D2D] transition-colors group"
                  >
                    <div className="p-2 rounded bg-[#262626] text-white shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">
                        {artifact.filename}
                      </p>
                      <p className="text-[11px] text-[#A3A3A3] truncate">
                        {artifact.preview}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-[#737373]">{time}</span>
                      <button
                        onClick={() => handleDownloadArtifact(artifact)}
                        className="p-1 rounded text-[#A3A3A3] hover:text-white hover:bg-[#333333] transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
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
          <div className="relative w-full h-full flex flex-col justify-between p-4 rounded-xl bg-[#1E1E1E] border border-[#2D2D2D] space-y-4 overflow-y-auto">
            <button
              onClick={handleCopy}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-[#A3A3A3] hover:text-white hover:bg-[#262626] transition-all cursor-pointer border border-[#2D2D2D] z-10"
              title={copied ? "Tersalin!" : "Salin Teks (Copy)"}
            >
              {copied ? (
                <CopyCheck className="w-3.5 h-3.5 text-white" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>

            {isEditing ? (
              <div className="flex-1 flex flex-col space-y-3 min-h-0">
                <div className="flex items-center justify-between text-xs text-[#A3A3A3] font-medium">
                  <span>Edit Teks/Tabel Canvas</span>
                  <span className="text-white font-semibold">Mode Edit Aktif</span>
                </div>
                <textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="w-full flex-1 min-h-[240px] p-3 text-xs text-white font-mono bg-[#121212] border border-[#2D2D2D] rounded-lg focus:outline-none focus:border-[#525252] resize-none leading-relaxed"
                  placeholder="Ketik atau edit isi Canvas di sini..."
                />
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={handleSaveAndSend}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white text-black hover:bg-[#E5E5E5] text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Terapkan & Update AI</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditedText(canvasData.plainTextContent);
                      setIsEditing(false);
                    }}
                    className="px-3 py-2 rounded-lg bg-[#262626] hover:bg-[#333333] text-[#A3A3A3] hover:text-white text-xs font-medium transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-[#E5E5E5] leading-relaxed pr-6 [&_table]:w-full [&_table]:border-collapse [&_th]:text-left [&_th]:py-2 [&_th]:px-3 [&_th]:text-xs [&_th]:font-semibold [&_th]:text-[#A3A3A3] [&_td]:py-2 [&_td]:px-3 [&_td]:text-[#E5E5E5] [&_tr]:border-b [&_tr]:border-[#2D2D2D] [&_strong]:font-semibold [&_strong]:text-white">
                <Markdown>{canvasData.plainTextContent}</Markdown>
              </div>
            )}

            {pendingDownload && (
              <div className="pt-3 border-t border-[#2D2D2D]">
                <button
                  onClick={handleDownloadFile}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white text-black text-xs font-medium hover:bg-[#E5E5E5] transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download {getFileLabel(pendingDownload.mimeType)}</span>
                  <span className="text-[#525252] text-xs">
                    ({pendingDownload.filename})
                  </span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center space-y-2 text-[#737373]">
            <div className="w-10 h-10 rounded-xl bg-[#1E1E1E] border border-[#2D2D2D] flex items-center justify-center mx-auto mb-2">
              <Sparkles className="w-4 h-4 text-[#737373]" />
            </div>
            <p className="text-xs font-semibold text-[#737373]">Canvas Kosong</p>
          </div>
        )}
      </div>
    </aside>
  );
}
