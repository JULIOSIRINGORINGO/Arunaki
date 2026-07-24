import { useState, useEffect } from "react";
import {
  Folder,
  FolderCheck,
  Settings,
  MessageSquare,
  Paperclip,
  SlidersHorizontal,
  Sparkles,
  ArrowUp,
  RefreshCw,
  Calendar,
  MapPin,
  UserCheck,
  FileText,
  FileSpreadsheet,
  Search,
  ShieldCheck,
  BarChart3,
  FileCode,
  Info,
  X,
  Plus,
} from "lucide-react";

export function WorkspacePage() {
  const [isConnected, setIsConnected] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [promptInput, setPromptInput] = useState("");

  // Automatically open popup modal on first visit if not connected
  useEffect(() => {
    if (!isConnected) {
      setIsModalOpen(true);
    }
  }, []);

  const handleConnectFolder = () => {
    setIsConnected(true);
    setIsModalOpen(false);
  };

  const handleDisconnectFolder = () => {
    setIsConnected(false);
  };

  const quickPrompts = [
    { icon: BarChart3, text: "Analisis Tren Laporan Keuangan FY24" },
    { icon: FileCode, text: "Ekstrak Klausa & Risiko Kontrak Vendor" },
    { icon: FileText, text: "Buat Eksekutif Summary 42 Dokumen" },
    { icon: Search, text: "Bandingkan Invoice & Rekap Pembayaran" },
  ];

  const metadataItemsConnected = [
    { icon: Calendar, label: "Tanggal Pembuatan", value: "24 Juli 2026, 09:15" },
    { icon: RefreshCw, label: "Terakhir Diperbarui", value: "24 Juli 2026, 18:45" },
    { icon: Folder, label: "Sumber Data", value: "Direktori Lokal Korporat" },
    { icon: MapPin, label: "Jalur Penyimpanan", value: "/Data/Arunaki/Enterprise_Workspace" },
    { icon: UserCheck, label: "Pemilik Akses", value: "Julio Siringoringo (Admin)" },
  ];

  const metadataItemsInitial = [
    { icon: Calendar, label: "Tanggal Pembuatan", value: "24 Juli 2026, 09:15" },
    { icon: RefreshCw, label: "Terakhir Diperbarui", value: "Belum Ada Aktivitas" },
    { icon: Folder, label: "Sumber Data", value: "Belum Terhubung" },
    { icon: MapPin, label: "Jalur Penyimpanan", value: "-" },
    { icon: UserCheck, label: "Pemilik Akses", value: "Julio Siringoringo (Admin)" },
  ];

  const recentActivitiesConnected = [
    { icon: ShieldCheck, title: "42 file berhasil diindeks & dianalisis AI", time: "18:42" },
    { icon: FileText, title: "Audit_Keuangan_FY2024.pdf ditambahkan", time: "18:35" },
    { icon: FileCode, title: "Draf_Kontrak_Vendor_2026.docx ditambahkan", time: "18:29" },
    { icon: FileSpreadsheet, title: "Matrix_Analisis_Pasar_Q2.xlsx ditambahkan", time: "18:15" },
    { icon: ShieldCheck, title: "Pengecekan privasi & enkripsi data selesai", time: "18:00" },
  ];

  const recentActivitiesInitial = [
    { icon: Info, title: "Workspace siap untuk pengindeksan awal", time: "09:15" },
  ];

  return (
    <div className="flex-1 overflow-y-auto h-full bg-[#FAFAFA] p-6 lg:p-8 space-y-6 flex flex-col relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-white border border-gray-200/90 shadow-2xs flex items-center justify-center text-gray-800 shrink-0">
            <Folder className="w-5 h-5 text-gray-800" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
              Workspace Strategis & Analisis
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Pusat pengelolaan dokumen korporat, otomatisasi ekstraksi data, dan intelijen berbasis AI.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {!isConnected ? (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-black text-white hover:bg-gray-800 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-xs cursor-pointer transition-all active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>Hubungkan Folder</span>
            </button>
          ) : (
            <button
              onClick={handleDisconnectFolder}
              className="flex items-center gap-2 border border-gray-200/90 bg-white hover:bg-gray-50 rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-700 shadow-2xs cursor-pointer transition-all active:scale-98"
            >
              <FolderCheck className="w-4 h-4 text-emerald-600" />
              <span>Terhubung: /Data/Arunaki</span>
            </button>
          )}

          <button className="flex items-center gap-2 border border-gray-200/90 bg-white hover:bg-gray-50 rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-800 shadow-2xs cursor-pointer transition-all active:scale-98">
            <Settings className="w-4 h-4 text-gray-600" />
            <span>Kelola Workspace</span>
          </button>
        </div>
      </div>

      {/* Main Grid Section (Fills remaining height) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Left Main Content (8 cols) - Full height Chat Area */}
        <div className="lg:col-span-8 flex flex-col h-full space-y-6 min-h-[550px]">
          {/* Arunaki AI Interaction Panel - Full Height Flex Container */}
          <div className="bg-white rounded-2xl border border-gray-200/90 p-6 shadow-2xs flex-1 flex flex-col justify-between space-y-6">
            {/* Top Header */}
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <MessageSquare className="w-5 h-5 text-gray-900" />
                <h3 className="font-bold text-base text-gray-900">Asisten Intelijen Arunaki AI</h3>
              </div>

              {isConnected && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  42 Dokumen Aktif
                </span>
              )}
            </div>

            {/* Middle AI Welcome Message Area (Flex-1 scrollable) */}
            <div className="flex-1 overflow-y-auto min-h-0 py-2">
              {!isConnected ? (
                <div className="bg-[#F8F9FA] border border-gray-200/70 rounded-2xl p-6 text-xs sm:text-sm text-gray-700 space-y-3.5 max-w-2xl">
                  <div className="flex items-center gap-2 text-gray-900 font-bold text-base sm:text-lg">
                    <span>Selamat Datang di Workspace Arunaki!</span>
                    <span>👋</span>
                  </div>
                  <p className="text-gray-600 leading-relaxed">
                    Belum ada direktori folder yang terhubung ke workspace ini. Hubungkan folder bisnis Anda untuk mulai mengindeks dokumen, menganalisis risiko, serta mengekstrak informasi secara otomatis.
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="inline-flex items-center gap-2 bg-black text-white hover:bg-gray-800 px-5 py-3 rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-xs active:scale-98"
                    >
                      <Folder className="w-4 h-4" />
                      <span>Hubungkan Folder Sekarang</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-[#F8F9FA] border border-gray-100 rounded-2xl p-5 text-xs sm:text-sm text-gray-800 space-y-3.5 max-w-2xl animate-fade-in">
                  <p className="font-bold text-gray-900 text-base">Workspace Berhasil Diinisialisasi! 🚀</p>
                  <p className="text-gray-600 leading-relaxed">
                    AI telah mengindeks <strong className="font-semibold text-gray-900">42 berkas bisnis</strong> dari direktori terhubung (termasuk laporan keuangan, kontrak kerja sama, dan dokumen legal). Anda dapat menanyakan analisis risiko, perbandingan tren Q1–Q4, ekstraksi klausa, hingga pembuatan eksekutif summary.
                  </p>
                  <p className="text-gray-700 font-medium pt-0.5">
                    Silakan pilih analisis cepat di bawah ini atau ketik instruksi spesifik Anda.
                  </p>
                  <div className="text-[11px] text-gray-400 text-right pt-1 font-mono">10:32</div>
                </div>
              )}
            </div>

            {/* Bottom Actions Area (Shrink-0) */}
            <div className="space-y-4 pt-2 shrink-0 border-t border-gray-100">
              {/* Quick Action Prompt Chips */}
              <div className={`flex flex-wrap gap-2 transition-opacity ${!isConnected ? "opacity-50 pointer-events-none" : ""}`}>
                {quickPrompts.map((prompt, idx) => {
                  const IconComponent = prompt.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => isConnected && setPromptInput(prompt.text)}
                      disabled={!isConnected}
                      className="border border-gray-200/90 bg-white hover:bg-gray-50 px-3.5 py-2 rounded-xl text-xs text-gray-700 font-medium flex items-center gap-2 cursor-pointer transition-all shadow-2xs active:scale-98"
                    >
                      <IconComponent className="w-3.5 h-3.5 text-gray-500" />
                      <span>{prompt.text}</span>
                    </button>
                  );
                })}
              </div>

              {/* Input composer */}
              <div>
                <div className={`bg-white border border-gray-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs focus-within:border-gray-300 focus-within:shadow-sm transition-all ${!isConnected ? "bg-gray-50/50" : ""}`}>
                  <div className="flex items-center gap-2 pl-1">
                    <button disabled={!isConnected} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40" title="Lampirkan Dokumen">
                      <Paperclip className="w-4.5 h-4.5" />
                    </button>
                    <button disabled={!isConnected} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40" title="Filter Parameter Analisis">
                      <SlidersHorizontal className="w-4.5 h-4.5" />
                    </button>
                    <button disabled={!isConnected} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40" title="Mode Analisis Mendalam AI">
                      <Sparkles className="w-4.5 h-4.5" />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={promptInput}
                    disabled={!isConnected}
                    onChange={(e) => setPromptInput(e.target.value)}
                    placeholder={
                      !isConnected
                        ? "Hubungkan folder direktori terlebih dahulu untuk mulai bertanya..."
                        : "Tanyakan analisis dokumen, korelasi data, atau draf laporan bisnis..."
                    }
                    className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:ring-0 px-2 disabled:cursor-not-allowed"
                  />

                  <button
                    disabled={!isConnected}
                    className="w-10 h-10 rounded-full bg-black text-white hover:bg-gray-800 flex items-center justify-center shrink-0 cursor-pointer transition-colors shadow-xs disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ArrowUp className="w-4.5 h-4.5" />
                  </button>
                </div>

                <p className="text-[11px] text-gray-400 text-center mt-2.5">
                  Arunaki AI memproses dokumen secara terenkripsi. Selalu verifikasi data krusial sebelum pengambilan keputusan.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar Info Panel (4 cols) */}
        <div className="lg:col-span-4 space-y-6 flex flex-col">
          {/* Card A: Ringkasan Workspace */}
          <div className="bg-white rounded-2xl border border-gray-200/90 p-5 space-y-3 shadow-2xs">
            <h3 className="font-bold text-sm sm:text-base text-gray-900">Ringkasan Direktori Dokumen</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              {!isConnected
                ? "Belum ada dokumen yang terhubung. Klik tombol Hubungkan Folder untuk mengaktifkan ringkasan dan ekstraksi data otomatis."
                : "Workspace ini mengonsolidasi 42 berkas strategis meliputi laporan audit keuangan FY2024, draf perjanjian kerja sama PT ABC, rekapan KPI operasional, serta analisis riset pasar Q2."}
            </p>
            <div className="pt-1">
              <button
                disabled={!isConnected}
                className="border border-gray-200/90 bg-white hover:bg-gray-50 px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-700 flex items-center gap-2 ml-auto cursor-pointer transition-all shadow-2xs active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
                <span>Sinkronkan & Perbarui Ringkasan</span>
              </button>
            </div>
          </div>

          {/* Card B: Informasi Workspace */}
          <div className="bg-white rounded-2xl border border-gray-200/90 p-5 space-y-3.5 shadow-2xs">
            <h3 className="font-bold text-sm sm:text-base text-gray-900">Spesifikasi & Informasi Workspace</h3>
            <div className="space-y-2.5 pt-1">
              {(isConnected ? metadataItemsConnected : metadataItemsInitial).map((item, idx) => {
                const IconComp = item.icon;
                return (
                  <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-2.5 text-gray-500">
                      <IconComp className="w-3.5 h-3.5 text-gray-400" />
                      <span>{item.label}</span>
                    </div>
                    <span className="font-medium text-gray-800">{item.value}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card C: Aktivitas Terbaru */}
          <div className="bg-white rounded-2xl border border-gray-200/90 p-5 space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm sm:text-base text-gray-900">Log Aktivitas Terakhir</h3>
              <button className="text-xs font-medium text-gray-500 hover:text-gray-800 hover:underline cursor-pointer">
                Lihat Semua Log
              </button>
            </div>

            <div className="space-y-2.5 pt-1">
              {(isConnected ? recentActivitiesConnected : recentActivitiesInitial).map((act, idx) => {
                const ActIcon = act.icon;
                return (
                  <div key={idx} className="flex items-center justify-between text-xs py-1">
                    <div className="flex items-center gap-2.5 text-gray-700 min-w-0 flex-1">
                      <ActIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="truncate font-medium">{act.title}</span>
                    </div>
                    <span className="text-[11px] text-gray-400 shrink-0 ml-2 font-mono">{act.time}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* POPUP MODAL: Folder Connection Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-gray-200/90 shadow-2xl w-full max-w-lg p-6 sm:p-8 flex flex-col items-center justify-center relative">
            {/* Close Button */}
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Inner Content */}
            <div className="bg-[#F8F9FA] rounded-2xl p-6 sm:p-8 w-full flex flex-col items-center text-center gap-4 mb-6 border border-gray-100 mt-2">
              <Folder className="w-16 h-16 text-gray-900 stroke-[1.5]" />
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1.5">
                  Pilih folder sebagai sumber
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
                  Semua file dalam folder akan diproses dan siap dipahami oleh AI Arunaki.
                </p>
              </div>
            </div>

            {/* Connect Action Button */}
            <button
              onClick={handleConnectFolder}
              className="w-full py-3.5 bg-black text-white font-bold uppercase tracking-wider rounded-xl hover:bg-gray-800 transition-all text-xs cursor-pointer shadow-xs active:scale-98"
            >
              HUBUNGKAN DIREKTORI FOLDER
            </button>

            <button
              onClick={() => setIsModalOpen(false)}
              className="text-xs text-gray-400 hover:text-gray-600 font-medium cursor-pointer pt-4"
            >
              Nanti saja
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
