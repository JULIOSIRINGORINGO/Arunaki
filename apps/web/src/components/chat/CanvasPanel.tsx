import { useState, useEffect } from "react";
import Markdown from "react-markdown";
import {
  Sparkles,
  Copy,
  CopyCheck,
  Download,
  FileSpreadsheet,
  History,
  Edit2,
  Send,
} from "lucide-react";
import { cn } from "../../lib/utils";

export interface CanvasData {
  id: string;
  title: string;
  plainTextContent: string;
  createdAt: string;
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
  isOpen?: boolean;
  onClose?: () => void;
  canvasData?: CanvasData | null;
  artifacts?: Artifact[];
  onSaveAndSendToAi?: (updatedContent: string) => void;
}

export function CanvasPanel({
  canvasData,
  artifacts = [],
  onSaveAndSendToAi,
}: CanvasPanelProps) {
  const [copied, setCopied] = useState(false);
  const [showArtifacts, setShowArtifacts] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");

  useEffect(() => {
    if (canvasData?.plainTextContent) {
      setEditedText(canvasData.plainTextContent);
    }
  }, [canvasData?.plainTextContent]);

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
    <div className="w-full h-full flex flex-col bg-[#0A0A0A] text-white overflow-hidden select-text">
      {/* Top Action Toolbar */}
      <div className="h-9 bg-[#121212] px-4 flex items-center justify-between shrink-0 select-none border-b border-[#262626]">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-[#A1A1AA] shrink-0" />
          <span className="text-xs font-medium text-[#E4E4E7] truncate">
            {showArtifacts ? "File History" : canvasData?.title || "Canvas Document"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {artifacts.length > 0 && (
            <button
              onClick={() => setShowArtifacts(!showArtifacts)}
              className={cn(
                "p-1.5 rounded text-xs transition-colors cursor-pointer flex items-center gap-1",
                showArtifacts
                  ? "text-white bg-[#262626]"
                  : "text-[#A1A1AA] hover:text-white hover:bg-[#262626]"
              )}
              title="History"
            >
              <History className="w-3.5 h-3.5" />
            </button>
          )}

          {canvasData && !showArtifacts && (
            <>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={cn(
                  "px-2 py-1 rounded text-xs transition-colors cursor-pointer flex items-center gap-1 font-medium",
                  isEditing
                    ? "text-white bg-[#27272A] border border-[#3F3F46]"
                    : "text-[#A1A1AA] hover:text-white hover:bg-[#262626]"
                )}
                title={isEditing ? "Preview Mode" : "Edit Canvas"}
              >
                <Edit2 className="w-3 h-3" />
                <span className="text-[11px]">{isEditing ? "Preview" : "Edit"}</span>
              </button>

              <button
                onClick={handleDownloadCsv}
                className="p-1.5 rounded text-[#A1A1AA] hover:text-white hover:bg-[#262626] transition-colors cursor-pointer"
                title="Download CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleDownloadTxt}
                className="p-1.5 rounded text-[#A1A1AA] hover:text-white hover:bg-[#262626] transition-colors cursor-pointer"
                title="Download TXT"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleCopy}
                className="p-1.5 rounded text-[#A1A1AA] hover:text-white hover:bg-[#262626] transition-colors cursor-pointer"
                title={copied ? "Copied!" : "Copy Text"}
              >
                {copied ? (
                  <CopyCheck className="w-3.5 h-3.5 text-[#4ADE80]" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Canvas Body */}
      <div className="flex-1 overflow-y-auto p-6 bg-[#0A0A0A]">
        {showArtifacts ? (
          <div className="max-w-3xl mx-auto space-y-2">
            {artifacts.length === 0 ? (
              <div className="text-center py-12 text-[#71717A] text-xs">
                No artifacts recorded
              </div>
            ) : (
              artifacts.map((artifact) => (
                <div
                  key={artifact.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-[#141414] border border-[#262626] hover:border-[#3F3F46] transition-colors"
                >
                  <div>
                    <p className="text-xs font-medium text-white">{artifact.filename}</p>
                    <p className="text-[11px] text-[#A1A1AA]">{artifact.preview}</p>
                  </div>
                  <button
                    onClick={() => handleDownloadArtifact(artifact)}
                    className="p-1.5 rounded text-[#A1A1AA] hover:text-white hover:bg-[#262626] transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        ) : canvasData ? (
          <div className="max-w-4xl mx-auto h-full flex flex-col">
            {isEditing ? (
              <div className="flex-1 flex flex-col space-y-3 min-h-[400px]">
                <textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="w-full flex-1 p-4 text-xs text-[#E4E4E7] font-mono bg-[#121212] border border-[#27272A] rounded-lg focus:outline-none focus:border-[#52525B] resize-none leading-relaxed"
                  placeholder="Edit deliverable content..."
                />
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleSaveAndSend}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black hover:bg-[#E4E4E7] text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Apply & Update AI</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditedText(canvasData.plainTextContent);
                      setIsEditing(false);
                    }}
                    className="px-3 py-2 rounded-lg bg-[#27272A] hover:bg-[#3F3F46] text-[#A1A1AA] hover:text-white text-xs font-medium transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="prose prose-invert max-w-none text-xs text-[#E4E4E7] leading-relaxed font-sans [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_th]:text-left [&_th]:py-2 [&_th]:px-3 [&_th]:text-xs [&_th]:font-semibold [&_th]:text-[#A1A1AA] [&_th]:border-b [&_th]:border-[#27272A] [&_td]:py-2 [&_td]:px-3 [&_td]:text-[#E4E4E7] [&_tr]:border-b [&_tr]:border-[#1F1F23] [&_strong]:font-semibold [&_strong]:text-white [&_pre]:bg-[#121212] [&_pre]:border [&_pre]:border-[#27272A] [&_pre]:rounded-lg [&_pre]:p-4">
                <Markdown>{canvasData.plainTextContent}</Markdown>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-2 text-[#71717A]">
            <Sparkles className="w-6 h-6 text-[#52525B]" />
            <p className="text-xs">No active canvas deliverable</p>
          </div>
        )}
      </div>
    </div>
  );
}
