import { useState, useCallback, useRef } from "react";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";

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

  const API_BASE = "http://localhost:3000/api/v1";

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
    } catch (err) {
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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  }, [workspaceId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
    }
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
          ${isDragging
            ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
            : "border-gray-300 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-600"
          }
          ${isUploading ? "opacity-50 pointer-events-none" : ""}
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
          size={24}
          className={`mx-auto mb-2 ${isDragging ? "text-purple-500" : "text-gray-400"}`}
        />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {isUploading ? "Uploading..." : "Drop files or click to upload"}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          PDF, DOCX, XLSX, CSV, TXT, MD
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="space-y-1">
          {uploadedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 rounded-lg"
            >
              <CheckCircle size={14} className="text-green-500 shrink-0" />
              <FileText size={14} className="text-gray-400 shrink-0" />
              <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
                {file.name}
              </span>
              <span className="text-xs text-gray-400">{formatSize(file.size)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
