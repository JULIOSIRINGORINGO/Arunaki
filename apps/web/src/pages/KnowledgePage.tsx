import { useState, useEffect, useCallback, useRef } from "react";
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
  Info,
} from "lucide-react";
import { cn } from "../lib/utils";
import { API_BASE } from "../lib/api";

interface KnowledgeDoc {
  id: string;
  title: string;
  content: string;
  type: string;
  active: boolean;
  createdAt: string;
}

interface DomainTemplate {
  id: string;
  name: string;
  description: string;
}

export function KnowledgePage() {
  const [activeTab, setActiveTab] = useState<"knowledge" | "domains">("knowledge");
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [domains, setDomains] = useState<DomainTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [previewDoc, setPreviewDoc] = useState<KnowledgeDoc | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [extractStep, setExtractStep] = useState<"idle" | "uploading" | "extracting" | "saving" | "done">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/knowledge`);
      const data = await res.json();
      setDocs(data.data || []);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDomains = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/domains`);
      const data = await res.json();
      setDomains(data.data || []);
    } catch {
      setDomains([]);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
    fetchDomains();
  }, [fetchDocs, fetchDomains]);

  const toggleActive = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/knowledge/${id}/toggle`, { method: "PATCH" });
      const data = await res.json();
      setDocs((prev) => prev.map((d) => (d.id === id ? data.data : d)));
    } catch {
      // ignore
    }
  };

  const deleteDoc = async (id: string) => {
    try {
      await fetch(`${API_BASE}/knowledge/${id}`, { method: "DELETE" });
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch {
      // ignore
    }
  };

  const createDoc = async () => {
    if (!selectedFile) return;
    setCreating(true);
    setExtractStep("uploading");
    try {
      // Simulasi step upload
      await new Promise((r) => setTimeout(r, 600));
      setExtractStep("extracting");

      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await fetch(`${API_BASE}/knowledge/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      setExtractStep("saving");
      await new Promise((r) => setTimeout(r, 400));

      if (data.data) {
        setDocs((prev) => [data.data, ...prev]);
      }
      setExtractStep("done");
      await new Promise((r) => setTimeout(r, 800));

      setSelectedFile(null);
      setUploadOpen(false);
    } catch {
      // ignore
    } finally {
      setCreating(false);
      setExtractStep("idle");
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const filteredDocs = docs.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.content.toLowerCase().includes(searchQuery.toLowerCase());
    if (filterStatus === "active") return matchesSearch && doc.active;
    if (filterStatus === "inactive") return matchesSearch && !doc.active;
    return matchesSearch;
  });

  const activeCount = docs.filter((d) => d.active).length;

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return dateStr;
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
                Kelola basis pengetahuan perusahaan: aturan, harga, data produk, dan SOP yang digunakan oleh <strong className="text-gray-700 font-medium">AI Assistant Mode</strong>.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setUploadOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white hover:bg-gray-800 text-sm font-semibold transition-all duration-150 shadow-xs cursor-pointer active:scale-[0.98] shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Knowledge</span>
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("knowledge")}
          className={cn(
            "px-4 py-2 text-sm font-semibold transition-all duration-150 border-b-2 -mb-px",
            activeTab === "knowledge"
              ? "border-gray-900 text-gray-900"
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          Basis Pengetahuan Perusahaan ({docs.length})
        </button>
        <button
          onClick={() => setActiveTab("domains")}
          className={cn(
            "px-4 py-2 text-sm font-semibold transition-all duration-150 border-b-2 -mb-px flex items-center gap-2",
            activeTab === "domains"
              ? "border-gray-900 text-gray-900"
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          <span>Templat Industri Bisnis ({domains.length})</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent/15 text-accent">
            Domain System
          </span>
        </button>
      </div>

      {activeTab === "domains" && (
        <div className="space-y-6 animate-fade-in">
          <div className="p-4 rounded-xl bg-surface-100 border border-surface-200 text-xs text-surface-600 leading-relaxed">
            💡 <strong>Domain Config System</strong> mengatur secara otomatis istilah industri, satuan (*units*), rumus kalkulasi (*formulas*), dan format laporan (*report templates*) untuk AI Agent Anda tanpa hardcoded rules.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {domains.map((domain) => (
              <div
                key={domain.id}
                className="p-5 rounded-2xl bg-white border border-gray-200/80 shadow-2xs hover:border-accent/40 transition-all duration-150 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-900 text-sm">{domain.name}</h3>
                  <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                    {domain.id}
                  </span>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2">{domain.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "knowledge" && (
      <>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-gray-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Knowledge</span>
            <div className="p-2 rounded-xl bg-gray-50 text-gray-600">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-gray-900">{docs.length}</span>
            <span className="text-xs text-gray-500 font-medium">entri tersimpan</span>
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
              <BookOpen className="w-4 h-4" />
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
            Knowledge berisi <strong>aturan format, harga barang, data produk, rumus kalkulasi, dan SOP</strong> perusahaan. Entri yang <strong className="font-semibold text-emerald-700">"Aktif"</strong> akan dibaca oleh AI Assistant saat menjawab percakapan Anda — sehingga AI bisa menghitung harga, menerapkan aturan format, dan merujuk data perusahaan secara otomatis.
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
            placeholder="Cari knowledge..."
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
      {loading ? (
        <div className="py-16 text-center rounded-2xl bg-white border border-gray-200/80">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Memuat knowledge...</p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-white border border-dashed border-gray-200">
          <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-800">
            {searchQuery ? "Tidak ada knowledge yang sesuai" : "Belum Ada Knowledge"}
          </h3>
          <p className="text-xs md:text-sm text-gray-500 max-w-md mx-auto mt-1">
            {searchQuery
              ? `Tidak ditemukan entri dengan kata kunci "${searchQuery}".`
              : "Tambahkan aturan, harga, data produk, atau SOP agar AI Assistant dapat merujuknya saat bekerja."}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setUploadOpen(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Knowledge Pertama</span>
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
                  <BookOpen className={cn("w-5 h-5", doc.active ? "text-gray-700" : "text-gray-400")} />
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
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Aktif
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 text-gray-400" /> Non-Aktif
                        </>
                      )}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 line-clamp-1">
                    {doc.content.substring(0, 120)}...
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-gray-400 pt-0.5">
                    <span className="font-mono text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded-sm">{doc.type}</span>
                    <span>•</span>
                    <span>{formatDate(doc.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-gray-100 shrink-0 justify-end">
                <button
                  onClick={() => setPreviewDoc(doc)}
                  className="p-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
                  title="Lihat isi knowledge"
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
                  title="Hapus knowledge"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-5 border border-gray-100">
            {creating ? (
              /* Loading State */
              <div className="py-10 space-y-6">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
                  <span className="text-sm font-semibold text-gray-900">
                    {extractStep === "uploading" && "Mengunggah file..."}
                    {extractStep === "extracting" && "Sedang mengekstraksi teks dari dokumen..."}
                    {extractStep === "saving" && "Menyimpan ke Knowledge Base..."}
                    {extractStep === "done" && "Berhasil disimpan!"}
                  </span>
                </div>

                <div className="space-y-2.5 px-4">
                  {(["uploading", "extracting", "saving", "done"] as const).map((step, i) => {
                    const steps = ["uploading", "extracting", "saving", "done"] as const;
                    const currentIdx = steps.indexOf(extractStep as typeof steps[number]);
                    const stepIdx = i;
                    const isDone = stepIdx < currentIdx;
                    const isCurrent = stepIdx === currentIdx;

                    return (
                      <div key={step} className="flex items-center gap-3">
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border shrink-0",
                          isDone
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : isCurrent
                              ? "border-gray-900 text-gray-900 bg-gray-50"
                              : "border-gray-200 text-gray-400 bg-gray-50"
                        )}>
                          {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                        </div>
                        <span className={cn(
                          "text-xs font-medium",
                          isDone ? "text-emerald-600" : isCurrent ? "text-gray-900" : "text-gray-400"
                        )}>
                          {step === "uploading" && "Upload file"}
                          {step === "extracting" && "Ekstraksi teks"}
                          {step === "saving" && "Simpan ke database"}
                          {step === "done" && "Selesai"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Upload Form */
              <>
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
                    onClick={() => { setUploadOpen(false); setSelectedFile(null); }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all",
                    dragOver
                      ? "border-gray-900 bg-gray-50"
                      : selectedFile
                        ? "border-emerald-300 bg-emerald-50/50"
                        : "border-gray-200 hover:border-gray-400 hover:bg-gray-50/50"
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt,.md,.csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {selectedFile ? (
                    <>
                      <FileText className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-gray-900">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                        className="mt-2 text-xs text-gray-500 hover:text-gray-700 underline"
                      >
                        Ganti file
                      </button>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-gray-700">
                        Klik atau seret file dokumen ke sini
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Mendukung PDF, DOCX, TXT, Markdown, CSV
                      </p>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => { setUploadOpen(false); setSelectedFile(null); }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
                  >
                    Batal
                  </button>
                  <button
                    onClick={createDoc}
                    disabled={!selectedFile}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-semibold bg-gray-900 text-white hover:bg-gray-800 shadow-2xs transition-all",
                      !selectedFile && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    Simpan ke Knowledge Base
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      </>
      )}

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-gray-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gray-100 text-gray-700">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">{previewDoc.title}</h3>
                  <p className="text-xs font-mono text-gray-400">{previewDoc.type}</p>
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
                Isi Knowledge:
              </div>
              <p className="whitespace-pre-wrap">{previewDoc.content}</p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-100 shrink-0">
              <span className="text-xs text-gray-500">
                Status: <strong className={previewDoc.active ? "text-emerald-600" : "text-gray-400"}>{previewDoc.active ? "Aktif di AI Assistant" : "Non-Aktif"}</strong>
              </span>
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
