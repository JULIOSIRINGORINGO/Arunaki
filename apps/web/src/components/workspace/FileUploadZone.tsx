/* Hallmark · component: file-upload-zone · genre: atmospheric · theme: Studio */
import { useState, useCallback, useRef } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, X } from "lucide-react";
import { API_BASE } from "../../lib/api";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
}

interface FileUploadZoneProps {
  workspaceId: string;
  onUploadComplete: () => void;
}

export function FileUploadZone({ workspaceId, onUploadComplete }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const uploadFiles = async (files: FileList | File[]) => {
    if (files.length === 0) return;

    setIsUploading(true);
    setError(null);
    setUploadedFiles([]);

    const formData = new FormData();
    formData.append("workspaceId", workspaceId);
    formData.append("sourceName", "Uploads");

    Array.from(files).forEach((file) => {
      formData.append("files", file);
    });

    try {
      const res = await fetch(`${API_BASE}/files/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error.message || "Upload failed");
      } else {
        setUploadedFiles(data.data || []);
        onUploadComplete();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        uploadFiles(e.dataTransfer.files);
      }
    },
    [workspaceId]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
    }
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border border-dashed rounded-lg p-3 text-center cursor-pointer transition-all duration-150
          ${
            isDragging
              ? "border-accent/50 bg-accent/5"
              : "border-surface-300 hover:border-surface-400 hover:bg-surface-200/50"
          }
          ${isUploading ? "opacity-40 pointer-events-none" : ""}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <Upload
          size={16}
          className={`mx-auto mb-1 ${isDragging ? "text-accent" : "text-surface-500"}`}
        />
        <p className="text-[11px] font-medium text-surface-600">
          {isUploading ? "Uploading..." : "Drop files or click"}
        </p>
        <p className="text-[9px] text-surface-500 mt-0.5">
          PDF, DOCX, XLSX, CSV, TXT, MD
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-[11px] text-error bg-error/10 rounded px-2.5 py-1.5">
          <AlertCircle size={11} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-error/60 hover:text-error"
          >
            <X size={11} />
          </button>
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="space-y-px">
          {uploadedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-success/10 rounded"
            >
              <CheckCircle size={10} className="text-success shrink-0" />
              <FileText size={10} className="text-surface-500 shrink-0" />
              <span className="text-[10px] text-surface-700 truncate flex-1">
                {file.name}
              </span>
              <span className="text-[9px] text-surface-500">
                {formatSize(file.size)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
