import { useState, useEffect, useRef } from "react";
import {
  FileSpreadsheet,
  FileText,
  Save,
  X,
  ExternalLink,
  Sparkles,
  RefreshCw,
} from "lucide-react";

export interface DocumentEngineProps {
  filePath: string;
  fileName: string;
  fileType: "xlsx" | "xlsm" | "xls" | "csv" | "docx" | "doc" | "pptx" | "ppt";
  onlyOfficeServerUrl?: string; // e.g. "http://localhost:8080" or custom OnlyOffice Document Server
  documentUrl?: string;
  onClose: () => void;
  onSave?: () => void;
  onAnalyzeAI?: () => void;
  onOpenNativeOS?: () => void;
}

declare global {
  interface Window {
    DocsAPI?: any;
  }
}

export default function DocumentEngineHost({
  filePath,
  fileName,
  fileType,
  onlyOfficeServerUrl = "http://localhost:8080",
  onClose,
  onSave,
  onAnalyzeAI,
  onOpenNativeOS,
}: DocumentEngineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isServerReady, setIsServerReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSpreadsheet = ["xlsx", "xlsm", "xls", "csv"].includes(fileType);
  const documentType = isSpreadsheet ? "cell" : ["docx", "doc"].includes(fileType) ? "word" : "slide";

  useEffect(() => {
    let docEditorInstance: any = null;
    let isMounted = true;

    const initOnlyOffice = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        // 1. Check if DocsAPI script is already loaded
        if (window.DocsAPI) {
          setIsServerReady(true);
          createEditorInstance();
          return;
        }

        // 2. Load DocsAPI script dynamically from OnlyOffice Server endpoint
        const scriptUrl = `${onlyOfficeServerUrl.replace(/\/$/, "")}/web-apps/apps/api/documents/api.js`;
        const script = document.createElement("script");
        script.src = scriptUrl;
        script.async = true;

        script.onload = () => {
          if (!isMounted) return;
          setIsServerReady(true);
          createEditorInstance();
        };

        script.onerror = () => {
          if (!isMounted) return;
          setIsLoading(false);
          setIsServerReady(false);
          setErrorMessage(
            `Server OnlyOffice Document (` + onlyOfficeServerUrl + `) tidak merespons. Menampilkan OnlyOffice Local Embedded Host Viewer...`
          );
        };

        document.body.appendChild(script);
      } catch (err: any) {
        if (!isMounted) return;
        setIsLoading(false);
        setErrorMessage(`Gagal menginisialisasi OnlyOffice Engine: ${err.message}`);
      }
    };

    const createEditorInstance = () => {
      if (!window.DocsAPI || !containerRef.current) {
        setIsLoading(false);
        return;
      }

      try {
        // Document config for OnlyOffice DocsAPI.DocEditor
        const config = {
          document: {
            fileType: fileType,
            key: `doc_${fileName}_${Date.now()}`,
            title: fileName,
            url: (window as any).arunakiDesktop?.getFileStreamUrl?.(filePath) || `file://${filePath}`,
            permissions: {
              edit: true,
              download: true,
              print: true,
            },
          },
          documentType: documentType, // "cell" | "word" | "slide"
          editorConfig: {
            mode: "edit",
            lang: "id",
            callbackUrl: "",
            customization: {
              autosave: true,
              compactHeader: true,
              toolbarNoTabs: false,
            },
          },
          height: "100%",
          width: "100%",
        };

        containerRef.current.innerHTML = "";
        const editorDiv = document.createElement("div");
        editorDiv.id = "onlyoffice-editor-placeholder";
        editorDiv.style.width = "100%";
        editorDiv.style.height = "100%";
        containerRef.current.appendChild(editorDiv);

        docEditorInstance = new window.DocsAPI.DocEditor("onlyoffice-editor-placeholder", config);
        setIsLoading(false);
      } catch (err: any) {
        console.error("OnlyOffice DocEditor init error:", err);
        setIsLoading(false);
      }
    };

    initOnlyOffice();

    return () => {
      isMounted = false;
      if (docEditorInstance?.destroyEditor) {
        try {
          docEditorInstance.destroyEditor();
        } catch {
          // cleanup
        }
      }
    };
  }, [filePath, fileName, fileType, onlyOfficeServerUrl]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-gray-900 rounded-2xl shadow-2xl border border-gray-800 w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* OnlyOffice Document Host Header Toolbar */}
        <div className="flex flex-wrap items-center justify-between px-4 py-3 bg-gray-950 text-white border-b border-gray-800 gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
              {isSpreadsheet ? (
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              ) : (
                <FileText className="w-4 h-4 text-blue-400" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-xs sm:text-sm truncate text-white">{fileName}</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-900/60 text-blue-300 border border-blue-700/50 uppercase">
                  OnlyOffice Engine
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
              <X className="w-4.4 h-4.4" />
            </button>
          </div>
        </div>

        {/* Editor Body Container */}
        <div className="flex-1 bg-gray-950 relative overflow-hidden flex flex-col">
          {isLoading && (
            <div className="absolute inset-0 bg-gray-950/90 z-20 flex flex-col items-center justify-center p-6 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
              <div className="space-y-1">
                <h4 className="font-semibold text-sm text-white">Memuat OnlyOffice Document Host...</h4>
                <p className="text-xs text-gray-400">Menyiapkan workspace editor untuk {fileName}</p>
              </div>
            </div>
          )}

          {/* OnlyOffice DocsAPI Container Element */}
          <div ref={containerRef} className="w-full h-full flex-1" />

          {/* Local Fallback View when OnlyOffice Server is Offline */}
          {!isLoading && !isServerReady && (
            <div className="flex-1 bg-gray-900 text-gray-100 p-8 flex flex-col items-center justify-center text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                {isSpreadsheet ? (
                  <FileSpreadsheet className="w-8 h-8 text-emerald-400" />
                ) : (
                  <FileText className="w-8 h-8 text-blue-400" />
                )}
              </div>

              <div className="max-w-md space-y-2">
                <h4 className="font-bold text-base text-white">{fileName}</h4>
                <p className="text-xs text-gray-300 leading-relaxed">
                  OnlyOffice Document Host Siap Digunakan. Anda dapat langsung mengedit file ini menggunakan OnlyOffice Server atau memprosesnya menggunakan Agen AI otonom Arunaki.
                </p>
                {errorMessage && (
                  <p className="text-[11px] text-amber-400/90 font-mono bg-amber-950/40 p-2.5 rounded-lg border border-amber-800/40">
                    {errorMessage}
                  </p>
                )}
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
                    <span>Minta AI Analisis / Sunting File Ini</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* OnlyOffice Footer Info Bar */}
        <div className="px-4 py-2 bg-gray-950 border-t border-gray-800 text-[11px] text-gray-400 flex items-center justify-between">
          <div className="flex items-center gap-2 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>OnlyOffice Document Engine Host (Tipe: {documentType.toUpperCase()})</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="hover:text-gray-200 text-xs font-medium"
          >
            Tutup Editor
          </button>
        </div>
      </div>
    </div>
  );
}
