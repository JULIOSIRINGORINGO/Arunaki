import { useState, useEffect, useCallback } from "react";

export type Language = "en" | "id";

export const LANGUAGE_STORAGE_KEY = "arunaki_language";

export const translations = {
  en: {
    // Menu Bar
    file: "File",
    edit: "Edit",
    view: "View",
    help: "Help",

    // File Menu
    newSession: "New Session",
    openFolder: "Open Folder...",
    saveDocument: "Save Document",
    backupWorkspace: "Backup Workspace",
    closeFolder: "Close Folder",
    preferencesSettings: "Preferences / Settings",
    exitWindow: "Exit Window",

    // Edit Menu
    undo: "Undo",
    redo: "Redo",
    cut: "Cut",
    copy: "Copy",
    paste: "Paste",
    selectAll: "Select All",
    findInSession: "Find in Session...",
    keyboardShortcuts: "Keyboard Shortcuts",

    // View Menu
    explorerPanel: "Explorer Panel",
    chatPanel: "Chat Panel",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    systemTheme: "System Theme",
    language: "Language",
    english: "English",
    indonesian: "Bahasa Indonesia",
    toggleFullscreen: "Toggle Fullscreen",
    resetZoom: "Reset Zoom",

    // Help Menu
    knowledgeRules: "Knowledge & Rules",
    githubRepo: "GitHub Repository",
    reportIssue: "Report an Issue",
    aboutArunaki: "About Arunaki",

    // Settings Navigation
    settingsTitle: "Workstation System Settings",
    settingsSubtitle: "Configure model routing, desktop office automation behavior, and user account licensing.",
    modelRouting: "Model Routing & Providers",
    desktopAutomation: "Desktop Automation & Office",
    messagingApps: "Messaging Apps",
    accountLicense: "Account & License",

    // Common Actions
    saveChanges: "Save Changes",
    saving: "Saving...",
    setupGuide: "Setup Guide",
    refresh: "Refresh",
    connected: "Connected",
    inactive: "Inactive",
    connecting: "Connecting...",
    warning: "Warning",
    testToken: "Test Token",
    useActiveFolder: "Use Active Workspace Folder",

    // Messaging Tab
    messagingSubtitle: "Control Arunaki remotely from Telegram. Forward WhatsApp messages, raw notes, or document tasks to your bot, and Arunaki executes them locally on this computer.",
    telegramGateway: "Telegram BYOB Gateway",
    telegramGatewayDesc: "Direct outward long-polling connection from your PC to Telegram. Free, private, and zero VPS hosting required.",
    botTokenLabel: "Telegram Bot Token",
    botTokenHelp: "Need a token? View guide",
    botTokenPlaceholder: "e.g. 1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ",
    whitelistLabel: "Allowed Sender Whitelist (Security)",
    whitelistHelp: "How to check my Telegram ID",
    whitelistPlaceholder: "e.g. 123456789, @username (or * for all)",
    whitelistDesc: "Protects your computer. Only Telegram accounts registered in this whitelist can execute document instructions.",
    targetFolderLabel: "Target Project Folder",
    targetFolderDesc: "The directory on this computer where Arunaki will read, modify, and create document files when receiving instructions from Telegram.",

    // Setup Guide Modal
    guideModalTitle: "Telegram Bot Setup Guide",
    guideModalSubtitle: "Connect your Telegram bot in 4 simple steps (takes 2-3 minutes)",
    step1Title: "1. Create Bot",
    step2Title: "2. Copy Token",
    step3Title: "3. Whitelist ID",
    step4Title: "4. Ready",
    previous: "Previous",
    next: "Next",
    doneClose: "Done & Close Guide",

    // Main Navigation Tabs
    navWorkstation: "Workstation",
    navKnowledge: "Knowledge",
    navHistory: "History",
    navSettings: "Settings",

    // Footer & Status Bar
    noFolderOpened: "No folder opened",
    online: "Online",
    offline: "Offline",
    networkConnected: "Network connected",
    networkOffline: "Network offline",
    switchToDark: "Switch to Dark Mode",
    switchToLight: "Switch to Light Mode",
    userProfileSettings: "User Profile & Settings",

    // Workstation Explorer
    explorer: "Explorer",
    refreshExplorer: "Refresh Explorer",
    closeFolderTooltip: "Close Folder",
    closeExplorer: "Close Explorer",
    openExplorer: "Open Explorer Panel",
    failedToReadFolder: "Failed to read folder",
    tryAgain: "Try again",
    recentCanvases: "Recent Documents",

    // Workstation Chat
    chat: "Chat",
    newChat: "New Chat",
    sessionNamePlaceholder: "Session Name...",
    clickToRenameSession: "Click to rename session",
    newChatSession: "New Chat Session",
    closePanel: "Close Panel",
    askPlaceholder: "Ask anything, type @ to mention files, / for commands...",
    reasoningEffort: "Reasoning Effort",
    effortDefault: "Default",
    effortLow: "Low",
    effortMedium: "Medium",
    effortHigh: "High",
    addToQueue: "Add to queue",
    stopGenerating: "Stop generating",
    selectFileToAttach: "Select file to attach",
    slashCommands: "Slash Commands",
    imageAttached: "Image attached",
    workWithAgent: "Work with Agent",
    thinking: "Thinking...",
    executingTasks: "Executing document tasks",

    // Modals
    aboutDesktopTitle: "Arunaki Desktop",
    aboutSubtitle: "Sandboxed Computer Use Agent for Documents",
    version: "Version",
    environment: "Environment",
    isolation: "Isolation",
    activeFolderSandbox: "Active Folder Sandbox",
    done: "Done",
    searchShortcuts: "Search shortcuts...",
    resetAllShortcuts: "Reset All",
    pressDesiredKeys: "Press desired key combo...",
  },
  id: {
    // Menu Bar
    file: "Berkas",
    edit: "Edit",
    view: "Tampilan",
    help: "Bantuan",

    // File Menu
    newSession: "Sesi Baru",
    openFolder: "Buka Folder...",
    saveDocument: "Simpan Dokumen",
    backupWorkspace: "Cadangkan Ruang Kerja",
    closeFolder: "Tutup Folder",
    preferencesSettings: "Pengaturan / Preferensi",
    exitWindow: "Keluar",

    // Edit Menu
    undo: "Urungkan",
    redo: "Ulangi",
    cut: "Potong",
    copy: "Salin",
    paste: "Tempel",
    selectAll: "Pilih Semua",
    findInSession: "Cari di Sesi...",
    keyboardShortcuts: "Pintasan Keyboard",

    // View Menu
    explorerPanel: "Panel Berkas",
    chatPanel: "Panel Percakapan",
    theme: "Tema Tampilan",
    light: "Terang",
    dark: "Gelap",
    systemTheme: "Ikuti Sistem",
    language: "Bahasa",
    english: "English",
    indonesian: "Bahasa Indonesia",
    toggleFullscreen: "Layar Penuh",
    resetZoom: "Reset Zoom",

    // Help Menu
    knowledgeRules: "Pengetahuan & Aturan",
    githubRepo: "Repositori GitHub",
    reportIssue: "Laporkan Masalah",
    aboutArunaki: "Tentang Arunaki",

    // Settings Navigation
    settingsTitle: "Pengaturan Sistem Workstation",
    settingsSubtitle: "Atur routing model AI, perilaku otomasi Microsoft Office desktop, dan lisensi akun pengguna.",
    modelRouting: "Routing Model & Provider",
    desktopAutomation: "Otomasi Desktop & Office",
    messagingApps: "Aplikasi Pesan (Messaging)",
    accountLicense: "Akun & Lisensi",

    // Common Actions
    saveChanges: "Simpan Perubahan",
    saving: "Menyimpan...",
    setupGuide: "Panduan Setup",
    refresh: "Muat Ulang",
    connected: "Terhubung",
    inactive: "Nonaktif",
    connecting: "Menghubungkan...",
    warning: "Peringatan",
    testToken: "Test Token",
    useActiveFolder: "Gunakan Folder Aktif",

    // Messaging Tab
    messagingSubtitle: "Kendalikan Arunaki langsung dari Telegram di HP Anda. Kirim rekapan, forward pesan WhatsApp, atau catatan mentah ke bot Telegram Anda, dan Arunaki di laptop akan mengeksekusinya otomatis.",
    telegramGateway: "Telegram Bot Pribadi (BYOB)",
    telegramGatewayDesc: "Koneksi langsung dari PC ke Telegram. 100% aman, gratis, dan tidak butuh sewa server VPS.",
    botTokenLabel: "Token Bot Telegram",
    botTokenHelp: "Belum punya token? Lihat caranya",
    botTokenPlaceholder: "Contoh: 1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ",
    whitelistLabel: "ID Pengguna Telegram yang Diizinkan (Keamanan)",
    whitelistHelp: "Cara cek ID Telegram saya",
    whitelistPlaceholder: "Contoh: 123456789, @juliosiringo (atau * untuk semua)",
    whitelistDesc: "Mencegah orang asing mengendalikan PC Anda. Hanya akun Telegram di daftar ini yang direspon oleh Arunaki.",
    targetFolderLabel: "Folder Proyek Tujuan di Komputer",
    targetFolderDesc: "Folder tempat Arunaki akan membaca, membuat, dan mengedit berkas (Excel, Word, catatan) saat menerima perintah dari Telegram.",

    // Setup Guide Modal
    guideModalTitle: "Panduan Cepat: Menghubungkan Telegram ke Arunaki",
    guideModalSubtitle: "Ikuti 4 langkah mudah ini (hanya butuh 2-3 menit sekali saja)",
    step1Title: "1. Buat Bot",
    step2Title: "2. Salin Token",
    step3Title: "3. Cek ID Saya",
    step4Title: "4. Selesai",
    previous: "Sebelumnya",
    next: "Lanjut",
    doneClose: "Selesai & Tutup Panduan",

    // Main Navigation Tabs
    navWorkstation: "Workstation",
    navKnowledge: "Pengetahuan",
    navHistory: "Riwayat",
    navSettings: "Pengaturan",

    // Footer & Status Bar
    noFolderOpened: "Tidak ada folder terbuka",
    online: "Online",
    offline: "Offline",
    networkConnected: "Jaringan terhubung",
    networkOffline: "Jaringan terputus",
    switchToDark: "Beralih ke Mode Gelap",
    switchToLight: "Beralih ke Mode Terang",
    userProfileSettings: "Profil Pengguna & Pengaturan",

    // Workstation Explorer
    explorer: "Penjelajah Berkas",
    refreshExplorer: "Muat Ulang Berkas",
    closeFolderTooltip: "Tutup Folder",
    closeExplorer: "Tutup Panel Berkas",
    openExplorer: "Buka Panel Berkas",
    failedToReadFolder: "Gagal membaca folder",
    tryAgain: "Coba lagi",
    recentCanvases: "Dokumen Terakhir",

    // Workstation Chat
    chat: "Percakapan",
    newChat: "Sesi Baru",
    sessionNamePlaceholder: "Nama Sesi...",
    clickToRenameSession: "Klik untuk ganti nama sesi",
    newChatSession: "Sesi Percakapan Baru",
    closePanel: "Tutup Panel",
    askPlaceholder: "Tanyakan apa saja, ketik @ untuk pilih file, / untuk perintah...",
    reasoningEffort: "Tingkat Penalaran",
    effortDefault: "Bawaan",
    effortLow: "Rendah",
    effortMedium: "Sedang",
    effortHigh: "Tinggi",
    addToQueue: "Tambah ke antrean",
    stopGenerating: "Hentikan pembuatan",
    selectFileToAttach: "Pilih berkas untuk dilampirkan",
    slashCommands: "Perintah Cepat (/)",
    imageAttached: "Gambar dilampirkan",
    workWithAgent: "Mulai bekerja dengan agen dokumen",
    thinking: "Sedang berpikir...",
    executingTasks: "Mengeksekusi tugas dokumen",

    // Modals
    aboutDesktopTitle: "Arunaki Desktop",
    aboutSubtitle: "Agen Otomasi Komputer & Dokumen Terisolasi",
    version: "Versi",
    environment: "Lingkungan",
    isolation: "Isolasi",
    activeFolderSandbox: "Sandbox Folder Aktif",
    done: "Selesai",
    searchShortcuts: "Cari pintasan...",
    resetAllShortcuts: "Reset Semua",
    pressDesiredKeys: "Tekan kombinasi tombol...",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

export function getStoredLanguage(): Language {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null;
  if (stored === "en" || stored === "id") {
    return stored;
  }
  return "en";
}

export function setStoredLanguage(lang: Language): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  window.dispatchEvent(new CustomEvent("arunaki-language-change", { detail: lang }));
}

export function t(key: TranslationKey, fallback?: string): string {
  const currentLang = getStoredLanguage();
  const dict = translations[currentLang] || translations.en;
  return (dict as any)[key] || fallback || (translations.en as any)[key] || key;
}

export function useI18n() {
  const [language, setLanguageState] = useState<Language>(() => getStoredLanguage());

  useEffect(() => {
    const handleLanguageChange = (e: Event) => {
      const customEvent = e as CustomEvent<Language>;
      if (customEvent.detail && customEvent.detail !== language) {
        setLanguageState(customEvent.detail);
      }
    };

    window.addEventListener("arunaki-language-change", handleLanguageChange);
    return () => {
      window.removeEventListener("arunaki-language-change", handleLanguageChange);
    };
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setStoredLanguage(lang);
    setLanguageState(lang);
  }, []);

  const translate = useCallback(
    (key: TranslationKey, fallback?: string) => {
      const dict = translations[language] || translations.en;
      return (dict as any)[key] || fallback || (translations.en as any)[key] || key;
    },
    [language]
  );

  return {
    language,
    setLanguage,
    t: translate,
  };
}
