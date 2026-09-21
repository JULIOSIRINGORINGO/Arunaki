import { useState, useEffect, useCallback, memo } from "react";
import {
  MessageSquare,
  ShieldCheck,
  Folder,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  RefreshCw,
  HelpCircle,
  Send,
  Sparkles,
  Info,
  BookOpen,
  Copy,
  Check,
  X,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { API_BASE, apiFetch } from "../../lib/api";
import { cn } from "../../lib/utils";

interface TelegramStatus {
  connected: boolean;
  botUsername?: string | null;
  botFirstName?: string | null;
  lastActive?: number | null;
  lastError?: string | null;
}

export const SettingsMessagingTab = memo(function SettingsMessagingTab() {
  // All React Hooks at the very top (Zero Violations of Rules of Hooks)
  const [enabled, setEnabled] = useState(false);
  const [botToken, setBotToken] = useState("");
  const [allowedUserId, setAllowedUserId] = useState("");
  const [targetFolder, setTargetFolder] = useState("");
  const [showToken, setShowToken] = useState(false);

  const [showGuideModal, setShowGuideModal] = useState(false);
  const [guideStep, setGuideStep] = useState(1);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [status, setStatus] = useState<TelegramStatus>({
    connected: false,
    botUsername: null,
    botFirstName: null,
    lastActive: null,
    lastError: null,
  });

  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    botUsername?: string;
    botFirstName?: string;
    error?: string;
  } | null>(null);

  const fetchConfigAndStatus = useCallback(async () => {
    try {
      setLoading(true);
      const [configRes, statusRes] = await Promise.all([
        apiFetch(`${API_BASE}/messaging/config`),
        apiFetch(`${API_BASE}/messaging/status`),
      ]);

      if (configRes.ok) {
        const configJson = await configRes.json();
        const tg = configJson?.data?.telegram || configJson?.telegram;
        if (tg) {
          setEnabled(Boolean(tg.enabled));
          setBotToken(tg.botToken || "");
          setAllowedUserId(tg.allowedUserId || "");
          setTargetFolder(
            tg.targetFolder || localStorage.getItem("arunaki_active_folder") || ""
          );
        }
      }

      if (statusRes.ok) {
        const statusJson = await statusRes.json();
        const st = statusJson?.data?.telegram || statusJson?.telegram;
        if (st) {
          setStatus({
            connected: Boolean(st.connected),
            botUsername: st.botUsername || null,
            botFirstName: st.botFirstName || null,
            lastActive: st.lastActive || null,
            lastError: st.lastError || null,
          });
        }
      }
    } catch (err) {
      console.error("Failed to load messaging settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigAndStatus();
    const interval = setInterval(fetchConfigAndStatus, 15000);
    return () => clearInterval(interval);
  }, [fetchConfigAndStatus]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    toast.success(`Disalin: ${text}`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleTestToken = async () => {
    if (!botToken.trim()) {
      toast.error("Masukkan token Telegram Bot terlebih dahulu.");
      return;
    }

    try {
      setTesting(true);
      setTestResult(null);
      const res = await apiFetch(`${API_BASE}/messaging/test`, {
        method: "POST",
        body: JSON.stringify({ botToken: botToken.trim() }),
      });

      const json = await res.json();
      const result = json?.data || json;

      if (res.ok && result?.success) {
        setTestResult(result);
        toast.success(
          `Token valid! Terhubung ke @${result.botUsername || "Telegram Bot"}`
        );
      } else {
        setTestResult({
          success: false,
          error: result?.error || "Gagal memverifikasi bot token ke Telegram.",
        });
        toast.error(result?.error || "Bot token tidak valid.");
      }
    } catch (err: any) {
      const errorMsg = err?.message || "Gagal menghubungi layanan verifikasi.";
      setTestResult({ success: false, error: errorMsg });
      toast.error(errorMsg);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    try {
      setSaving(true);
      const payload = {
        telegram: {
          enabled,
          botToken: botToken.trim(),
          allowedUserId: allowedUserId.trim(),
          targetFolder: targetFolder.trim(),
        },
      };

      const res = await apiFetch(`${API_BASE}/messaging/config`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        throw new Error(`Gagal menyimpan: ${res.status} ${errorText}`);
      }

      toast.success(
        enabled
          ? "Gateway Telegram tersimpan dan otomatis terhubung!"
          : "Pengaturan gateway disimpan (status nonaktif)."
      );

      // Refresh status after save
      setTimeout(fetchConfigAndStatus, 1000);
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyimpan konfigurasi.");
    } finally {
      setSaving(false);
    }
  };

  const handleUseCurrentFolder = () => {
    const active = localStorage.getItem("arunaki_active_folder");
    if (active) {
      setTargetFolder(active);
      toast.info(`Target folder diatur ke: ${active}`);
    } else {
      toast.error("Belum ada folder aktif yang terbuka di workspace.");
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-[var(--text-primary)] text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[var(--text-primary)]" />
            Messaging Apps
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
            Kendalikan Arunaki langsung dari Telegram di HP Anda. Kirim rekapan, forward pesan WhatsApp, atau catatan mentah ke bot Telegram Anda, dan Arunaki di laptop akan mengeksekusinya otomatis.
          </p>
        </div>

        {/* Action buttons: Guide & Refresh */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setGuideStep(1);
              setShowGuideModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 text-xs font-semibold transition-all cursor-pointer shadow-xs"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>📖 Panduan Pemula (3 Menit)</span>
          </button>

          <button
            type="button"
            onClick={() => fetchConfigAndStatus()}
            disabled={loading}
            className="p-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
            title="Muat ulang status"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Main Telegram Gateway Card */}
      <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-6 shadow-xs">
        {/* Top bar with Channel Info & Status */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--bg-hover)] flex items-center justify-center border border-[var(--border-strong)] text-[var(--text-primary)]">
              <Send className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-[var(--text-primary)]">
                  Telegram Bot Pribadi (BYOB)
                </h4>
                {/* Live Status Badge */}
                {enabled ? (
                  status.connected ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Terhubung {status.botUsername ? `@${status.botUsername}` : ""}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      {status.lastError ? "Perlu Pengecekan" : "Menghubungkan..."}
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-[var(--bg-panel)] text-[var(--text-muted)] border border-[var(--border-color)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]" />
                    Nonaktif
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                Koneksi langsung dari PC ke Telegram. 100% aman, gratis, dan tidak butuh sewa server VPS.
              </p>
            </div>
          </div>

          {/* Master Enable/Disable Switch */}
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border border-[var(--border-strong)] items-center p-0.5 transition-colors duration-200 ease-in-out focus:outline-none",
              enabled ? "bg-[var(--text-primary)]" : "bg-[var(--bg-panel)]"
            )}
            title={enabled ? "Nonaktifkan Gateway Telegram" : "Aktifkan Gateway Telegram"}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full shadow-sm ring-0 transition-transform duration-200 ease-in-out",
                enabled ? "translate-x-5 bg-[var(--bg-app)]" : "translate-x-0 bg-[var(--text-muted)]"
              )}
            />
          </button>
        </div>

        {/* Error Alert if connection error occurred */}
        {enabled && status.lastError && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2.5">
            <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Catatan Koneksi Gateway</p>
              <p className="text-[11px] opacity-90 mt-0.5 font-mono">{status.lastError}</p>
            </div>
          </div>
        )}

        {/* Configuration Form */}
        <form onSubmit={handleSave} className="space-y-4">
          {/* 1. Bot Token */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                Token Bot Telegram
              </label>
              <button
                type="button"
                onClick={() => {
                  setGuideStep(1);
                  setShowGuideModal(true);
                }}
                className="text-[11px] text-sky-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <HelpCircle className="w-3 h-3" />
                Belum punya token? Lihat caranya
              </button>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showToken ? "text" : "password"}
                  value={botToken}
                  onChange={(e) => {
                    setBotToken(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder="Contoh: 1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                  className="w-full px-3.5 py-2 pr-10 text-xs font-mono rounded-xl bg-[var(--bg-panel)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <button
                type="button"
                onClick={handleTestToken}
                disabled={testing || !botToken.trim()}
                className="px-3.5 py-2 text-xs font-medium rounded-xl border border-[var(--border-strong)] bg-[var(--bg-hover)] text-[var(--text-primary)] hover:bg-[var(--border-strong)] transition-colors disabled:opacity-50 cursor-pointer shrink-0 flex items-center gap-1.5"
              >
                {testing ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Memeriksa...
                  </>
                ) : (
                  "Test Token"
                )}
              </button>
            </div>

            {/* Test result feedback banner */}
            {testResult && (
              <div
                className={cn(
                  "p-2.5 rounded-lg text-xs flex items-center gap-2 mt-1.5",
                  testResult.success
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                )}
              >
                {testResult.success ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Token valid! Terhubung ke <b>@{testResult.botUsername}</b> ({testResult.botFirstName}).
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{testResult.error || "Gagal memverifikasi token."}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 2. Allowed User ID / Whitelist */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                ID Pengguna Telegram yang Diizinkan (Keamanan)
              </label>
              <button
                type="button"
                onClick={() => {
                  setGuideStep(3);
                  setShowGuideModal(true);
                }}
                className="text-[11px] text-sky-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <HelpCircle className="w-3 h-3" />
                Cara cek ID Telegram saya
              </button>
            </div>
            <input
              type="text"
              value={allowedUserId}
              onChange={(e) => setAllowedUserId(e.target.value)}
              placeholder="Contoh: 123456789, @juliosiringo (atau * untuk semua)"
              className="w-full px-3.5 py-2 text-xs font-mono rounded-xl bg-[var(--bg-panel)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
            />
            <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 leading-relaxed">
              <Info className="w-3 h-3 shrink-0 text-sky-400" />
              Mencegah orang asing mengendalikan PC Anda. Hanya akun Telegram di daftar ini yang direspon oleh Arunaki.
            </p>
          </div>

          {/* 3. Target Workspace Folder */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                Folder Proyek Tujuan di Komputer
              </label>
              <button
                type="button"
                onClick={handleUseCurrentFolder}
                className="text-[11px] text-sky-400 hover:underline cursor-pointer font-medium"
              >
                Gunakan Folder yang Sedang Aktif
              </button>
            </div>
            <input
              type="text"
              value={targetFolder}
              onChange={(e) => setTargetFolder(e.target.value)}
              placeholder="Contoh: E:\JS\Arunika atau C:\Users\Nama\Documents"
              className="w-full px-3.5 py-2 text-xs font-mono rounded-xl bg-[var(--bg-panel)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--text-primary)] transition-colors"
            />
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Folder tempat Arunaki akan membaca, membuat, dan mengedit berkas (Excel, Word, catatan) saat menerima perintah dari Telegram.
            </p>
          </div>

          {/* Submit Action */}
          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[var(--text-primary)] text-[var(--bg-app)] hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer flex items-center gap-2 shadow-xs"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Menyimpan Pengaturan...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Simpan & Hubungkan Gateway
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Clickable Banner to Open Setup Guide Popup */}
      <div
        onClick={() => {
          setGuideStep(1);
          setShowGuideModal(true);
        }}
        className="p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-sky-500/40 hover:bg-[var(--bg-hover)] transition-all cursor-pointer flex items-center justify-between group shadow-xs"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center group-hover:scale-105 transition-transform border border-sky-500/20 shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
              Panduan Bergambar: Cara Setup Bot Telegram (4 Langkah Cepat)
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-semibold">
                Mudah & Cepat
              </span>
            </h4>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">
              Klik di sini untuk membuka panduan langkah demi langkah cara membuat bot gratis di @BotFather dan mengambil Token API.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs font-semibold text-sky-400 group-hover:translate-x-1 transition-transform shrink-0 pl-2">
          <span>Buka Panduan</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>

      {/* Interactive Setup Wizard Modal (Popup Dokumentasi Ramah Pengguna Awam) */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-strong)] shadow-2xl p-6 space-y-5 select-none relative animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[var(--border-color)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[var(--text-primary)]">
                    Panduan Cepat: Menghubungkan Telegram ke Arunaki
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Ikuti 3 langkah mudah ini (hanya butuh 2-3 menit sekali saja)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stepper Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-[var(--bg-app)] rounded-xl border border-[var(--border-color)]">
              {[
                { step: 1, label: "1. Buat Bot" },
                { step: 2, label: "2. Salin Token" },
                { step: 3, label: "3. Cek ID Saya" },
                { step: 4, label: "4. Selesai" },
              ].map((s) => (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => setGuideStep(s.step)}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer text-center",
                    guideStep === s.step
                      ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-xs border border-[var(--border-strong)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Step Body Content */}
            <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] min-h-[220px] flex flex-col justify-between">
              {guideStep === 1 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-400">Langkah 1 dari 4</span>
                    <a
                      href="https://t.me/BotFather"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-sky-400 hover:underline inline-flex items-center gap-1 font-semibold"
                    >
                      Buka @BotFather di Telegram <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <h5 className="text-sm font-bold text-[var(--text-primary)]">
                    Buat Bot Baru di @BotFather
                  </h5>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    1. Buka aplikasi Telegram di HP/laptop Anda, cari bot resmi pembuat bot bernama{" "}
                    <b>@BotFather</b> (atau klik link biru di atas).
                  </p>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    2. Ketik perintah:{" "}
                    <span className="inline-flex items-center gap-1 font-mono bg-[var(--bg-panel)] px-2 py-0.5 rounded text-sky-400">
                      /newbot
                      <button
                        type="button"
                        onClick={() => handleCopy("/newbot", "newbot")}
                        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                        title="Salin perintah"
                      >
                        {copiedCode === "newbot" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </span>
                  </p>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    3. Beri nama bebas (misal: <i>Asisten Dokumen Saya</i>), lalu beri username yang diakhiri kata <b>bot</b> (contoh: <code>budi_arunaki_bot</code>).
                  </p>
                </div>
              )}

              {guideStep === 2 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-400">Langkah 2 dari 4</span>
                    <span className="text-[10px] text-[var(--text-muted)]">Token Rahasia Bot</span>
                  </div>
                  <h5 className="text-sm font-bold text-[var(--text-primary)]">
                    Salin Token API dari Balasan BotFather
                  </h5>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    Setelah memberi username bot, BotFather akan membalas pesan selamat beserta sebuah <b>HTTP API Token</b> yang panjang.
                  </p>
                  <div className="p-3 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-strong)] font-mono text-[11px] text-[var(--text-muted)] space-y-1">
                    <p className="text-[10px] text-emerald-400 font-sans font-semibold">Contoh pesan dari BotFather:</p>
                    <p className="text-[10px] opacity-75">Use this token to access the HTTP API:</p>
                    <p className="text-amber-300 font-bold bg-amber-500/10 p-1 rounded">
                      7821938210:AAEtvL2_xPQrstUVwXyZ1234
                    </p>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    Salin teks token tersebut dan tempelkan ke kolom <b>Token Bot Telegram</b> di halaman pengaturan ini.
                  </p>
                </div>
              )}

              {guideStep === 3 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-400">Langkah 3 dari 4</span>
                    <a
                      href="https://t.me/userinfobot"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-sky-400 hover:underline inline-flex items-center gap-1 font-semibold"
                    >
                      Buka @userinfobot di Telegram <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <h5 className="text-sm font-bold text-[var(--text-primary)]">
                    Cek Angka ID Telegram Anda (Keamanan)
                  </h5>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    Untuk memastikan <b>hanya akun Telegram Anda</b> yang boleh menyuruh Arunaki mengolah dokumen di komputer:
                  </p>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    1. Buka <b>@userinfobot</b> di Telegram (klik link di atas).
                  </p>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    2. Begitu Anda kirim pesan apa saja atau klik <code>/start</code>, bot tersebut akan membalas dengan angka ID Anda (contoh: <code>123456789</code>).
                  </p>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    3. Salin angka tersebut ke kolom <b>ID Pengguna Telegram yang Diizinkan</b>.
                  </p>
                </div>
              )}

              {guideStep === 4 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400">Langkah Terakhir</span>
                    <span className="text-[10px] text-emerald-400 font-semibold">Siap Digunakan!</span>
                  </div>
                  <h5 className="text-sm font-bold text-[var(--text-primary)]">
                    Simpan & Mulai Chat dari HP!
                  </h5>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    1. Pastikan tombol switch di atas berwarna aktif, lalu klik tombol <b>"Simpan & Hubungkan Gateway"</b>.
                  </p>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    2. Buka bot baru yang Anda buat di Telegram di HP Anda, lalu ketik <code>/start</code>.
                  </p>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    3. Sekarang Anda bisa langsung forward pesan WhatsApp atau mengetik:
                    <br />
                    <span className="font-mono text-[11px] text-sky-400 bg-[var(--bg-panel)] px-2 py-1 rounded inline-block mt-1">
                      "rekap catatan penjualan ini ke file rekap.xlsx"
                    </span>
                  </p>
                  <p className="text-[11px] text-emerald-400 font-semibold">
                    ✓ Arunaki di laptop Anda akan otomatis membuka file, menghitung, dan membalas laporannya ke HP Anda!
                  </p>
                </div>
              )}

              {/* Navigation Controls */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--border-color)] mt-3">
                {guideStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setGuideStep(guideStep - 1)}
                    className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-hover)] text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
                  </button>
                ) : (
                  <div />
                )}

                {guideStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => setGuideStep(guideStep + 1)}
                    className="px-4 py-1.5 rounded-lg bg-[var(--text-primary)] text-[var(--bg-app)] text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1"
                  >
                    Lanjut <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowGuideModal(false)}
                    className="px-4 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors cursor-pointer"
                  >
                    Selesai & Tutup Panduan
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
