import { useState } from "react";
import {
  BookOpen,
  Plus,
  Search,
  FileText,
  Trash2,
  Eye,
  UploadCloud,
  CheckCircle2,
  XCircle,
  Sparkles,
  X,
  FileCode,
  FileSpreadsheet,
  FileCheck,
  Info,
} from "lucide-react";
import { cn } from "../lib/utils";

interface KnowledgeDoc {
  id: string;
  title: string;
  description: string;
  fileName: string;
  fileType: "pdf" | "docx" | "txt" | "md" | "csv";
  fileSize: string;
  active: boolean;
  uploadedAt: string;
  contentSnippet: string;
}

const INITIAL_DOCS: KnowledgeDoc[] = [
  {
    id: "doc-garment",
    title: "GARMENT ORDER KNOWLEDGE",
    description: "Pedoman format otomatis penulisan pesanan garmen, urutan ukuran, header merek/warna, dan kalkulasi total PCS.",
    fileName: "garment.md",
    fileType: "md",
    fileSize: "1.2 KB",
    active: true,
    uploadedAt: "Hari ini",
    contentSnippet:
      "# GARMENT ORDER KNOWLEDGE\n\n## Tujuan\nUbah pesanan garmen menjadi format yang rapi, konsisten, dan mudah dibaca.\n\n## HEADER\nSecara default gunakan: **<MEREK> <WARNA>**\n\n## FORMAT OUTPUT TABEL\n| UKURAN | PCS |\n|---------|----:|\n| M | 5 |\n| L | 3 |\n| XL | 2 |\n| **TOTAL PCS** | **10** |\n\n## ATURAN URUTAN UKURAN:\nUrutan ukuran harus selalu: S, M, L, XL, 2XL, 3XL, 4XL, 5XL.\nBaris terakhir wajib TOTAL PCS.",
  },
  {
    id: "doc-1",
    title: "SOP Layanan & Garansi Produk 2026",
    description: "Prosedur standar penanganan garansi, syarat pengembalian barang, dan ketentuan klaim pelanggan.",
    fileName: "SOP_Garansi_2026_v2.pdf",
    fileType: "pdf",
    fileSize: "1.4 MB",
    active: true,
    uploadedAt: "24 Juli 2026",
    contentSnippet:
      "1. Ketentuan Garansi Utama: Produk dilindungi garansi 12 bulan sejak tanggal pembelian. Klaim garansi memerlukan bukti pembelian sah (Invoice/Resi). 2. Prosedur Klaim: Pelanggan mengajukan klaim melalui customer service...",
  },
  {
    id: "doc-2",
    title: "Standar Perhitungan Costing & HPP Garment",
    description: "Rumus kalkulasi penggunaan kain, biaya jahit, overhead pabrik, dan margin keuntungan bersih.",
    fileName: "Garment_Costing_Standard.xlsx",
    fileType: "csv",
    fileSize: "680 KB",
    active: true,
    uploadedAt: "22 Juli 2026",
    contentSnippet:
      "Rumus HPP = (Konsumsi Kain x Harga per Meter) + Biaya CMT + Trimming + Accessories + Overhead (8%). Margin standar retail adalah 35% di atas HPP bersih.",
  },
  {
    id: "doc-3",
    title: "Panduan Gaya Bahasa & Tonality Brand",
    description: "Pedoman komunikasi, aturan penulisan email resmi, dan tata bahasa profesional Arunaki.",
    fileName: "Brand_Voice_Guide.md",
    fileType: "md",
    fileSize: "240 KB",
    active: false,
    uploadedAt: "20 Juli 2026",
    contentSnippet:
      "Gaya bahasa Arunaki harus: 1. Solutif dan empatik. 2. Menggunakan bahasa Indonesia yang baik tanpa istilah yang terlalu kaku. 3. Selalu memberikan struktur langkah yang jelas.",
  },
];

export function KnowledgePage() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>(INITIAL_DOCS);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [previewDoc, setPreviewDoc] = useState<KnowledgeDoc | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // File Upload Demo State
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const toggleActive = (id: string) => {
    setDocs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, active: !d.active } : d))
    );
  };

  const deleteDoc = (id: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== id));
  };

  const filteredDocs = docs.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description.toLowerCase().includes(searchQuery.toLowerCase());
    if (filterStatus === "active") return matchesSearch && doc.active;
    if (filterStatus === "inactive") return matchesSearch && !doc.active;
    return matchesSearch;
  });

  const activeCount = docs.filter((d) => d.active).length;

  const handleCreateMockDoc = () => {
    if (!newTitle.trim()) return;
    const newDoc: KnowledgeDoc = {
      id: `doc-${Date.now()}`,
      title: newTitle,
      description: newDesc || "Dokumen acuan acuan AI Assistant.",
      fileName: selectedFile ? selectedFile.name : `${newTitle.toLowerCase().replace(/\s+/g, "_")}.pdf`,
      fileType: selectedFile?.name.endsWith(".md") ? "md" : selectedFile?.name.endsWith(".txt") ? "txt" : "pdf",
      fileSize: selectedFile ? `${(selectedFile.size / 1024).toFixed(0)} KB` : "512 KB",
      active: true,
      uploadedAt: "Hari ini",
      contentSnippet: `Konten acuan dari dokumen ${newTitle}. Dokumen ini digunakan oleh AI Assistant saat menjawab percakapan pengguna.`,
    };
    setDocs([newDoc, ...docs]);
    setNewTitle("");
    setNewDesc("");
    setSelectedFile(null);
    setUploadOpen(false);
  };

  const getFileIcon = (type: KnowledgeDoc["fileType"]) => {
    switch (type) {
      case "pdf":
        return <FileText className="w-5 h-5 text-rose-500" />;
      case "csv":
        return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
      case "md":
        return <FileCode className="w-5 h-5 text-sky-500" />;
      default:
        return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gray-900 text-white shadow-sm">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                  Knowledge Base
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Sparkles className="w-3 h-3" /> AI Assistant Context
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Kelola basis dokumen acuan dan SOP khusus yang digunakan oleh <strong className="text-gray-700 font-medium">AI Assistant Mode</strong>.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setUploadOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white hover:bg-gray-800 text-sm font-semibold transition-all duration-150 shadow-xs cursor-pointer active:scale-[0.98] shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Dokumen</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-gray-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Dokumen</span>
            <div className="p-2 rounded-xl bg-gray-50 text-gray-600">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-gray-900">{docs.length}</span>
            <span className="text-xs text-gray-500 font-medium">file tersimpan</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-gray-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Aktif untuk AI</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-600">{activeCount}</span>
            <span className="text-xs text-emerald-700 font-medium">dokumen terhubung</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-gray-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Status Proteksi</span>
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-base font-bold text-gray-900">Terisolasi</span>
            <span className="text-xs text-gray-500">Khusus AI Assistant</span>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-sky-50/60 border border-sky-100 text-sky-900 text-xs md:text-sm">
        <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-sky-950">Bagaimana Knowledge ini bekerja?</span>
          <p className="text-sky-800 mt-0.5 leading-relaxed">
            Dokumen yang berstatus <strong className="font-semibold text-emerald-700">"Aktif"</strong> akan dibaca dan dijadikan rujukan utama oleh <strong>AI Assistant Mode</strong> saat menjawab percakapan Anda di halaman Chat.
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari dokumen acuan..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-hidden focus:border-gray-400 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-gray-100 border border-gray-200/80 w-full sm:w-auto">
          {(["all", "active", "inactive"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer flex-1 sm:flex-none text-center",
                filterStatus === status
                  ? "bg-white text-gray-900 shadow-2xs font-bold"
                  : "text-gray-500 hover:text-gray-800"
              )}
            >
              {status === "all" ? "Semua" : status === "active" ? "Aktif" : "Non-Aktif"}
            </button>
          ))}
        </div>
      </div>

      {/* Document List */}
      {filteredDocs.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-white border border-dashed border-gray-200">
          <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-800">
            {searchQuery ? "Tidak ada dokumen yang sesuai" : "Belum Ada Dokumen Knowledge"}
          </h3>
          <p className="text-xs md:text-sm text-gray-500 max-w-md mx-auto mt-1">
            {searchQuery
              ? `Tidak ditemukan dokumen acuan dengan kata kunci "${searchQuery}".`
              : "Unggah dokumen SOP, panduan, atau acuan internal agar AI Assistant dapat merujuknya."}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setUploadOpen(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Unggah Dokumen Pertama</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className={cn(
                "p-4 md:p-5 rounded-2xl bg-white border transition-all duration-150 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs",
                doc.active ? "border-gray-200/90" : "border-gray-200/50 bg-gray-50/50 opacity-80"
              )}
            >
              <div className="flex items-start gap-4 min-w-0 flex-1">
                <div
                  className={cn(
                    "p-3 rounded-2xl border shrink-0",
                    doc.active ? "bg-gray-50 border-gray-200/80" : "bg-gray-100 border-gray-200/50"
                  )}
                >
                  {getFileIcon(doc.fileType)}
                </div>

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-base font-bold text-gray-900 truncate">
                      {doc.title}
                    </h3>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border",
                        doc.active
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-gray-100 text-gray-500 border-gray-200"
                      )}
                    >
                      {doc.active ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Aktif di AI
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 text-gray-400" /> Non-Aktif
                        </>
                      )}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 line-clamp-1">{doc.description}</p>

                  <div className="flex items-center gap-3 text-[11px] text-gray-400 pt-0.5">
                    <span className="font-mono text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded-sm">{doc.fileName}</span>
                    <span>•</span>
                    <span>{doc.fileSize}</span>
                    <span>•</span>
                    <span>Diunggah {doc.uploadedAt}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-gray-100 shrink-0 justify-end">
                <button
                  onClick={() => setPreviewDoc(doc)}
                  className="p-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
                  title="Lihat teks hasil parsing"
                >
                  <Eye className="w-4 h-4" />
                </button>

                <button
                  onClick={() => toggleActive(doc.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border",
                    doc.active
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                      : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200"
                  )}
                >
                  {doc.active ? "Nonaktifkan" : "Aktifkan"}
                </button>

                <button
                  onClick={() => deleteDoc(doc.id)}
                  className="p-2 rounded-xl text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="Hapus dokumen"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-5 border border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-gray-100 text-gray-700">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Tambah Dokumen Knowledge</h3>
                  <p className="text-xs text-gray-500">Khusus digunakan sebagai rujukan AI Assistant</p>
                </div>
              </div>
              <button
                onClick={() => setUploadOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  setSelectedFile(e.dataTransfer.files[0]);
                  if (!newTitle) setNewTitle(e.dataTransfer.files[0].name.split(".")[0]);
                }
              }}
              className={cn(
                "p-6 rounded-2xl border-2 border-dashed text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2",
                isDragging
                  ? "border-gray-900 bg-gray-50"
                  : selectedFile
                  ? "border-emerald-300 bg-emerald-50/50"
                  : "border-gray-200 hover:border-gray-400 bg-gray-50/30"
              )}
            >
              <UploadCloud className={cn("w-8 h-8", selectedFile ? "text-emerald-600" : "text-gray-400")} />
              {selectedFile ? (
                <div>
                  <p className="text-sm font-bold text-emerald-800">{selectedFile.name}</p>
                  <p className="text-xs text-emerald-600 mt-0.5">
                    {(selectedFile.size / 1024).toFixed(0)} KB • Siap diproses
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-gray-700">
                    Klik atau seret file dokumen ke sini
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Mendukung PDF, DOCX, TXT, Markdown, CSV
                  </p>
                </div>
              )}
              <input
                type="file"
                className="hidden"
                id="file-upload-input"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSelectedFile(e.target.files[0]);
                    if (!newTitle) setNewTitle(e.target.files[0].name.split(".")[0]);
                  }
                }}
              />
              <label
                htmlFor="file-upload-input"
                className="mt-1 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer shadow-2xs"
              >
                Pilih File Dokumen
              </label>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Judul Acuan</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Misal: SOP Garansi Pelanggan 2026"
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-hidden focus:border-gray-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Deskripsi Singkat</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Penjelasan ringkas isi dokumen..."
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-hidden focus:border-gray-400 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => setUploadOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
              >
                Batal
              </button>
              <button
                onClick={handleCreateMockDoc}
                disabled={!newTitle.trim()}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-semibold bg-gray-900 text-white hover:bg-gray-800 shadow-2xs transition-all",
                  !newTitle.trim() && "opacity-50 cursor-not-allowed"
                )}
              >
                Simpan ke Knowledge Base
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-gray-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gray-100 text-gray-700">
                  {getFileIcon(previewDoc.fileType)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">{previewDoc.title}</h3>
                  <p className="text-xs font-mono text-gray-400">{previewDoc.fileName}</p>
                </div>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-gray-50/80 p-4 rounded-2xl border border-gray-200/80 text-xs md:text-sm font-mono text-gray-800 leading-relaxed space-y-2">
              <div className="text-[11px] font-sans text-gray-400 uppercase tracking-wider font-semibold border-b border-gray-200 pb-1">
                Teks Hasil Ekstraksi Parser:
              </div>
              <p className="whitespace-pre-wrap">{previewDoc.contentSnippet}</p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-100 shrink-0">
              <span className="text-xs text-gray-500">
                Status: <strong className={previewDoc.active ? "text-emerald-600" : "text-gray-400"}>{previewDoc.active ? "Aktif di AI Assistant" : "Non-Aktif"}</strong>
              </span>
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800"
              >
                Tutup Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
