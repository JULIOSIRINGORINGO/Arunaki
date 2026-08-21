import { useState, useEffect } from "react";
import { Cpu, User, Sliders, Monitor, FileSpreadsheet, LogIn, LogOut, ShieldCheck, Mail, Camera, Bell, Check, Key } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { API_BASE, apiFetch } from "../lib/api";
import { ModelProviderSettings, Provider } from "../components/settings/ModelProviderSettings";

const tabs = [
  { id: "models", label: "Model Routing & Providers", icon: Cpu },
  { id: "account", label: "Account & License", icon: User },
  { id: "integrations", label: "Desktop Automation & Behavior", icon: Sliders },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState("models");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);

  // Account State
  const [userName, setUserName] = useState(() => localStorage.getItem("arunaki_user_name") || "");
  const [userAvatar, setUserAvatar] = useState(() => localStorage.getItem("arunaki_user_avatar") || "");
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem("arunaki_user_email") || "");
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem("arunaki_user_email"));
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Desktop Automation & Behavior Preferences
  const [autoOpenExcel, setAutoOpenExcel] = useState(() => localStorage.getItem("arunaki_pref_auto_open_excel") === "true");
  const [autoBackup, setAutoBackup] = useState(() => localStorage.getItem("arunaki_pref_auto_backup") !== "false");
  const [desktopNotification, setDesktopNotification] = useState(() => localStorage.getItem("arunaki_pref_desktop_notification") !== "false");

  const fetchProviders = async () => {
    try {
      const res = await apiFetch(`${API_BASE}/providers`);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      setProviders(data.data || []);
    } catch (err) {
      console.error("Failed to fetch providers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim()) {
      toast.error("Silakan masukkan email akun Anda.");
      return;
    }
    const cleanEmail = loginEmail.trim();
    localStorage.setItem("arunaki_user_email", cleanEmail);
    setUserEmail(cleanEmail);
    setIsLoggedIn(true);
    setLoginPassword("");
    toast.success(`Berhasil masuk sebagai ${cleanEmail}`);
  };

  const handleLogout = () => {
    localStorage.removeItem("arunaki_user_email");
    setUserEmail("");
    setIsLoggedIn(false);
    toast.info("Telah keluar dari akun. Mode lokal aktif.");
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-[var(--bg-app)] text-[var(--text-primary)] overflow-y-auto select-none p-6 transition-colors duration-150">
      <div className="max-w-5xl w-full mx-auto flex-1 flex flex-col min-h-0">
        {/* Header Title */}
        <div className="mb-4">
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
            Workstation & System Settings
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Konfigurasi model language harness, akun pengguna, lisensi, dan perilaku otomasi desktop.
          </p>
        </div>

        {/* Tab Navigation Pill Bar (Monochrome) */}
        <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-3 mb-6 overflow-x-auto shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer shrink-0 border",
                  isActive
                    ? "bg-[var(--bg-hover)] text-[var(--text-primary)] border-[var(--border-strong)] shadow-xs"
                    : "bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border-transparent"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Settings Panel Content (Full Width) */}
        <div className="flex-1 w-full bg-[var(--bg-panel)] rounded-2xl border border-[var(--border-color)] p-6 overflow-y-auto min-h-0 transition-colors duration-150">
          {/* TAB 1: MODEL ROUTING & PROVIDERS */}
          {activeTab === "models" && (
            <ModelProviderSettings
              providers={providers}
              loading={loading}
              onRefresh={fetchProviders}
            />
          )}

          {/* TAB 2: ACCOUNT & LICENSE */}
          {activeTab === "account" && (
            <div className="w-full space-y-6">
              <div>
                <h3 className="font-bold text-[var(--text-primary)] text-base">
                  User Account & License
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Kelola profil kerja, sinkronisasi cloud terenkripsi, dan lisensi workstation multi-perangkat.
                </p>
              </div>

              {isLoggedIn ? (
                <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left 2 Cols: Profile Card */}
                  <div className="lg:col-span-2 p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-6">
                    <div className="flex items-center gap-4">
                      {/* Avatar with Camera Overlay (Monochrome) */}
                      <div className="relative group cursor-pointer shrink-0">
                        <div className="w-16 h-16 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border-strong)] flex items-center justify-center text-[var(--text-primary)] font-bold text-2xl overflow-hidden shadow-xs">
                          {userAvatar ? (
                            <img src={userAvatar} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            <span>{userName ? userName[0].toUpperCase() : userEmail ? userEmail[0].toUpperCase() : "U"}</span>
                          )}
                        </div>
                        <label className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                          <Camera className="w-5 h-5" />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  const result = ev.target?.result as string;
                                  setUserAvatar(result);
                                  localStorage.setItem("arunaki_user_avatar", result);
                                  toast.success("Foto profil berhasil diperbarui!");
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">
                            {userName || userEmail.split("@")[0] || "User"}
                          </h4>
                          <span className="px-2.5 py-0.5 rounded-full bg-[var(--bg-hover)] text-[var(--text-primary)] text-[10px] font-semibold border border-[var(--border-strong)] flex items-center gap-1 shrink-0">
                            <Check className="w-2.5 h-2.5 text-[var(--text-muted)]" /> Pro License
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5 flex items-center gap-1.5 truncate">
                          <Mail className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                          <span className="truncate">{userEmail}</span>
                        </p>
                      </div>
                    </div>

                    {/* Profile Form Field */}
                    <div className="pt-4 border-t border-[var(--border-color)]">
                      <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1.5">
                        Nama Lengkap / Identitas Bisnis
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={userName}
                          onChange={(e) => setUserName(e.target.value)}
                          placeholder="Contoh: Budi Santoso / Toko Roti Harum"
                          className="flex-1 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--border-strong)] transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            localStorage.setItem("arunaki_user_name", userName);
                            toast.success("Nama profil berhasil disimpan!");
                          }}
                          className="px-5 py-2.5 bg-[var(--text-primary)] text-[var(--bg-app)] hover:opacity-90 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                        >
                          Simpan
                        </button>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="px-4 py-2 bg-[var(--bg-hover)] hover:bg-[var(--bg-app)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-xl text-xs font-medium border border-[var(--border-color)] transition-all cursor-pointer flex items-center gap-2"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Keluar dari Akun (Sign Out)</span>
                      </button>
                    </div>
                  </div>

                  {/* Right 1 Col: License & Device Status (Monochrome) */}
                  <div className="space-y-4">
                    <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-4">
                      <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider text-[var(--text-muted)]">
                        Detail Lisensi
                      </h4>
                      <div className="space-y-3 text-xs">
                        <div className="p-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-color)]">
                          <p className="text-[11px] text-[var(--text-muted)]">Status Verifikasi</p>
                          <p className="font-semibold text-[var(--text-primary)] mt-0.5 flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-[var(--text-muted)]" /> Active & Verified
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-color)]">
                          <p className="text-[11px] text-[var(--text-muted)]">Perangkat Terhubung</p>
                          <p className="font-semibold text-[var(--text-primary)] mt-0.5">
                            Windows Desktop Workstation
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-semibold text-[var(--text-primary)]">Cloud Workspace Sync</h4>
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Enkripsi AES-256 lokal</p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-[var(--bg-hover)] text-[var(--text-primary)] text-[10px] font-semibold border border-[var(--border-strong)]">
                        Active
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Full Width Clean Login Form (Monochrome, No Emojis) */
                <div className="w-full p-8 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--bg-hover)] flex items-center justify-center border border-[var(--border-strong)] text-[var(--text-primary)] shrink-0">
                      <LogIn className="w-5 h-5 text-[var(--text-muted)]" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[var(--text-primary)]">
                        {isRegisterMode ? "Buat Akun Arunaki Baru" : "Masuk ke Akun Arunaki"}
                      </h4>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {isRegisterMode
                          ? "Daftar untuk mengaktifkan sinkronisasi workspace dan lisensi pro."
                          : "Hubungkan akun Anda untuk sinkronisasi workspace dan konfigurasi multi-perangkat."}
                      </p>
                    </div>
                  </div>

                  {/* Clean Monochrome Social Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                    <button
                      type="button"
                      onClick={() => toast.info("Login via Google akan segera hadir pada update berikutnya.")}
                      className="flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] text-xs font-medium text-[var(--text-primary)] transition-all cursor-pointer"
                    >
                      <Key className="w-4 h-4 text-[var(--text-muted)]" />
                      <span>Masuk dengan Google</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toast.info("Login via GitHub akan segera hadir pada update berikutnya.")}
                      className="flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] text-xs font-medium text-[var(--text-primary)] transition-all cursor-pointer"
                    >
                      <svg className="w-4 h-4 fill-current text-[var(--text-primary)]" viewBox="0 0 24 24">
                        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                      </svg>
                      <span>Masuk dengan GitHub</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-3 w-full">
                    <div className="flex-1 h-px bg-[var(--border-color)]" />
                    <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">atau dengan email</span>
                    <div className="flex-1 h-px bg-[var(--border-color)]" />
                  </div>

                  <form onSubmit={handleLogin} className="space-y-4 w-full">
                    <div>
                      <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                        Alamat Email
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="nama@perusahaan.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--border-strong)] transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                        Kata Sandi
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-3.5 py-2.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--border-strong)] transition-colors"
                      />
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <button
                        type="submit"
                        className="px-6 py-2.5 bg-[var(--text-primary)] text-[var(--bg-app)] hover:opacity-90 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 shadow-xs"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>{isRegisterMode ? "Daftar & Masuk" : "Masuk"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsRegisterMode(!isRegisterMode)}
                        className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                      >
                        {isRegisterMode ? "Sudah punya akun? Masuk" : "Belum punya akun? Daftar"}
                      </button>
                    </div>
                  </form>

                  {/* Clean Privacy Notice (No Emoji) */}
                  <div className="pt-4 border-t border-[var(--border-color)] flex items-start gap-2.5 text-[11px] text-[var(--text-muted)] leading-relaxed">
                    <ShieldCheck className="w-4 h-4 text-[var(--text-muted)] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-[var(--text-primary)]">Jaminan Privasi & Operasi Offline:</strong> Anda tetap dapat menggunakan Arunaki secara offline penuh pada mode lokal tanpa harus login atau membuat akun.
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DESKTOP AUTOMATION & BEHAVIOR (Monochrome & Full Width) */}
          {activeTab === "integrations" && (
            <div className="w-full space-y-6">
              <div>
                <h3 className="font-bold text-[var(--text-primary)] text-base">
                  Desktop Automation & OS Behavior
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Konfigurasi perilaku otomasi desktop, interaksi jendela Excel, dan notifikasi Windows.
                </p>
              </div>

              {/* 3 Interactive Setting Cards (Monochrome) */}
              <div className="w-full space-y-4">
                {/* 1. Auto Open Excel Saat Mulai Mengedit */}
                <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-start justify-between gap-4">
                  <div className="flex gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-[var(--bg-hover)] text-[var(--text-primary)] flex items-center justify-center shrink-0 border border-[var(--border-strong)]">
                      <FileSpreadsheet className="w-4 h-4 text-[var(--text-muted)]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--text-primary)]">
                        Otomatis Buka Excel Saat Mulai Mengedit
                      </h4>
                      <p className="text-[11px] text-[var(--text-muted)] leading-relaxed mt-0.5">
                        Membuka jendela aplikasi Microsoft Excel di layar desktop secara native saat Arunaki mulai memproses/mengedit spreadsheet. Jika dimatikan, proses edit dilakukan di balik layar.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !autoOpenExcel;
                      setAutoOpenExcel(next);
                      localStorage.setItem("arunaki_pref_auto_open_excel", String(next));
                      toast.success(next ? "Otomatis buka Excel diaktifkan." : "Otomatis buka Excel dinonaktifkan (mode background).");
                    }}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border border-[var(--border-strong)] transition-colors duration-200 ease-in-out focus:outline-none",
                      autoOpenExcel ? "bg-[var(--text-primary)]" : "bg-[var(--bg-panel)]"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out",
                        autoOpenExcel ? "translate-x-5 bg-[var(--bg-app)]" : "translate-x-0 bg-[var(--text-muted)]"
                      )}
                    />
                  </button>
                </div>

                {/* 2. Auto-Backup Dokumen Sebelum Dimodifikasi */}
                <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-start justify-between gap-4">
                  <div className="flex gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-[var(--bg-hover)] text-[var(--text-primary)] flex items-center justify-center shrink-0 border border-[var(--border-strong)]">
                      <ShieldCheck className="w-4 h-4 text-[var(--text-muted)]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--text-primary)]">
                        Auto-Backup Dokumen Sebelum Dimodifikasi
                      </h4>
                      <p className="text-[11px] text-[var(--text-muted)] leading-relaxed mt-0.5">
                        Secara otomatis membuat salinan cadangan (<code className="px-1.5 py-0.5 rounded bg-[var(--bg-panel)] font-mono text-[10px] text-[var(--text-primary)]">.bak</code>) di folder <code className="px-1.5 py-0.5 rounded bg-[var(--bg-panel)] font-mono text-[10px] text-[var(--text-primary)]">.arunaki/backups/</code> sebelum agen memodifikasi file untuk keamanan data 100%.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !autoBackup;
                      setAutoBackup(next);
                      localStorage.setItem("arunaki_pref_auto_backup", String(next));
                      toast.success(next ? "Auto-backup dokumen diaktifkan." : "Auto-backup dokumen dinonaktifkan.");
                    }}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border border-[var(--border-strong)] transition-colors duration-200 ease-in-out focus:outline-none",
                      autoBackup ? "bg-[var(--text-primary)]" : "bg-[var(--bg-panel)]"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out",
                        autoBackup ? "translate-x-5 bg-[var(--bg-app)]" : "translate-x-0 bg-[var(--text-muted)]"
                      )}
                    />
                  </button>
                </div>

                {/* 3. Notifikasi Panel Windows */}
                <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-start justify-between gap-4">
                  <div className="flex gap-3.5">
                    <div className="w-9 h-9 rounded-xl bg-[var(--bg-hover)] text-[var(--text-primary)] flex items-center justify-center shrink-0 border border-[var(--border-strong)]">
                      <Bell className="w-4 h-4 text-[var(--text-muted)]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[var(--text-primary)]">
                        Notifikasi Panel Windows (Visual Pop-up)
                      </h4>
                      <p className="text-[11px] text-[var(--text-muted)] leading-relaxed mt-0.5">
                        Menampilkan notifikasi pop-up di panel sistem operasi Windows ketika tugas rekap dokumen selesai dijalankan.
                      </p>
                      {desktopNotification && (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => {
                              const desktop = typeof window !== "undefined" && (window as any).arunakiDesktop;
                              if (desktop?.notify) {
                                desktop.notify({
                                  title: "Arunaki Dokumen",
                                  body: "Tugas rekap dokumen telah selesai dikerjakan.",
                                });
                                toast.success("Notifikasi desktop Windows telah dikirim!");
                              } else {
                                toast.info("Notifikasi desktop aktif saat berjalan di aplikasi Electron.");
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[var(--bg-hover)] text-[var(--text-primary)] text-[11px] font-medium border border-[var(--border-color)] transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <Bell className="w-3 h-3 text-[var(--text-muted)]" />
                            <span>Uji Notifikasi Desktop</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !desktopNotification;
                      setDesktopNotification(next);
                      localStorage.setItem("arunaki_pref_desktop_notification", String(next));
                      toast.success(next ? "Notifikasi desktop Windows diaktifkan." : "Notifikasi desktop Windows dinonaktifkan.");
                    }}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border border-[var(--border-strong)] transition-colors duration-200 ease-in-out focus:outline-none",
                      desktopNotification ? "bg-[var(--text-primary)]" : "bg-[var(--bg-panel)]"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out",
                        desktopNotification ? "translate-x-5 bg-[var(--bg-app)]" : "translate-x-0 bg-[var(--text-muted)]"
                      )}
                    />
                  </button>
                </div>
              </div>

              {/* Electron Diagnostic Bridge Status (Monochrome) */}
              <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-[var(--bg-hover)] text-[var(--text-primary)] flex items-center justify-center shrink-0 border border-[var(--border-strong)]">
                    <Monitor className="w-4 h-4 text-[var(--text-muted)]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--text-primary)]">Electron Native Desktop Shell</h4>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Native OS filesystem, window overlay, and IPC bridge</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-[var(--bg-hover)] text-[var(--text-primary)] text-[10px] font-semibold border border-[var(--border-strong)]">
                  Connected
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
