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

    // Model Provider Settings & Routing
    modelRoutingCatalogTitle: "Language Model Routing & Provider Catalogs",
    modelRoutingCatalogSubtitle: "Manage provider credentials, API endpoints, and fallback model priority order.",
    addProvider: "Add Provider",
    automaticFallbackTitle: "Automatic Fallback Routing",
    automaticFallbackDesc: "When executing document tasks, Arunaki routes to the primary active model. If an endpoint encounters rate limits or errors, it automatically falls back sequentially to subsequent models in the pool without interrupting your workflow.",
    loadingProviders: "Loading provider configurations...",
    noProvidersConfigured: "No model providers configured yet.",
    addFirstProvider: "+ Add First Provider",

    // Provider Card
    moveProviderUp: "Move provider up in routing priority",
    moveProviderDown: "Move provider down in routing priority",
    primaryActive: "Primary Active",
    setPrimary: "Set Primary",
    primaryActiveTooltip: "Primary active provider",
    setPrimaryTooltip: "Set as primary routing provider",
    defaultEndpoint: "Default Endpoint",
    modelPool: "Model Pool",
    testPing: "Test Ping",
    testing: "Testing...",
    configure: "Configure",
    deleteProvider: "Delete provider",
    clickToViewPing: "Click to view ping payload & LLM response details",
    failed: "Failed",
    pingInspectionDetails: "Live Ping Inspection Details",
    promptSent: "Prompt Sent:",
    llmReplyReceived: "LLM Reply Received:",
    latency: "Latency:",
    status: "Status:",
    endpoint: "Endpoint:",

    // Provider Form
    configureProvider: "Configure Provider",
    addNewProviderConnection: "Add New Provider Connection",
    noEndpointSpecified: "No endpoint specified",
    selectActiveModels: "Select Active Models & Routing",
    endpointCredentials: "Endpoint & Credentials",
    providerType: "Provider Type",
    displayName: "Display Name",
    baseUrlEndpoint: "Base URL / Endpoint",
    apiKeyToken: "API Key / Token",
    apiKeyPlaceholder: "sk-... (Leave blank if local gateway)",
    activeModelRoutingPriority: "Active Model Routing Priority",
    selectedCount: "selected",
    dragDotsOrArrows: "Drag dots or use arrows to adjust priority order",
    primary: "Primary",
    fallback: "Fallback",
    availableModels: "Available Models",
    filterModels: "Filter Models",
    allModels: "All Models",
    freeModelsOnly: "Free Models Only",
    selectedInPool: "Selected in Pool",
    modelFamilies: "Model Families",
    selectAllFree: "Select All Free",
    searchModels: "Search models...",
    syncFromApi: "Sync from API",
    syncing: "Syncing...",
    resetFilters: "Reset Filters",
    clickToSelect: "Click to select",
    customModel: "+ Custom Model",
    add: "Add",
    testConnection: "Test Connection",
    testingPing: "Testing Ping...",
    cancel: "Cancel",
    saveProvider: "Save Provider",

    // Automation Tab
    desktopAutomationTitle: "Desktop Automation & OS Behavior",
    desktopAutomationSubtitle: "Configure desktop Office automation (Word, Excel, PowerPoint), document application interaction, and operating system notifications.",
    launchOfficeTitle: "Launch Microsoft Office on Edit",
    launchOfficeDesc: "Opens native desktop Office applications (Word, Excel, PowerPoint, etc.) visibly on screen when executing document tasks. If disabled, all document modifications are performed silently in headless background mode.",
    autoBackupTitle: "Automatic Snapshot Backup Before Modifications",
    autoBackupDesc: "Creates an immutable local backup (.bak) in .arunaki/backups/ before mutating files for 100% data recovery.",
    desktopNotificationsTitle: "Desktop OS Notifications",
    desktopNotificationsDesc: "Displays native desktop notifications when document and ledger tasks complete.",
    testDesktopNotification: "Test Desktop Notification",
    electronShellTitle: "Electron Native Desktop Shell",
    electronShellDesc: "Native OS filesystem, window overlay, and IPC bridge",

    // Account Tab
    userAccountLicenseTitle: "User Account & License",
    userAccountLicenseSubtitle: "Manage your workstation profile, encrypted cloud sync, and multi-device workstation license.",
    proLicense: "Pro License",
    fullNameBusiness: "Full Name / Business Identity",
    save: "Save",
    signOut: "Sign Out",
    licenseDetails: "License Details",
    verificationStatus: "Verification Status",
    activeVerified: "Active & Verified",
    connectedClient: "Connected Client",
    windowsDesktopWorkstation: "Windows Desktop Workstation",
    cloudWorkspaceSync: "Cloud Workspace Sync",
    aesEncryption: "AES-256 local encryption",
    active: "Active",
    createAccount: "Create New Arunaki Account",
    signInAccount: "Sign In to Arunaki",
    createAccountDesc: "Register to enable workspace cloud synchronization and multi-device pro licensing.",
    signInAccountDesc: "Connect your account to synchronize workspace configurations across devices.",
    continueGoogle: "Continue with Google",
    continueGithub: "Continue with GitHub",
    orContinueEmail: "or continue with email",
    emailAddress: "Email Address",
    password: "Password",
    registerAndSignIn: "Register & Sign In",
    signIn: "Sign In",
    alreadyHaveAccount: "Already have an account? Sign In",
    dontHaveAccount: "Don't have an account? Register",
    privacyGuaranteeTitle: "Privacy & Offline Guarantee:",
    privacyGuaranteeDesc: "Arunaki operates fully offline in local mode without requiring an active account or internet login.",
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

    // Model Provider Settings & Routing
    modelRoutingCatalogTitle: "Katalog Provider & Routing Model Bahasa",
    modelRoutingCatalogSubtitle: "Kelola kredensial provider, endpoint API, dan urutan prioritas model cadangan.",
    addProvider: "Tambah Provider",
    automaticFallbackTitle: "Routing Cadangan Otomatis",
    automaticFallbackDesc: "Saat mengeksekusi tugas dokumen, Arunaki mengarahkan ke model aktif utama. Jika endpoint mengalami batasan kuota atau error, sistem otomatis beralih secara berurutan ke model berikutnya dalam daftar tanpa mengganggu alur kerja Anda.",
    loadingProviders: "Memuat konfigurasi provider...",
    noProvidersConfigured: "Belum ada provider model yang dikonfigurasi.",
    addFirstProvider: "+ Tambah Provider Pertama",

    // Provider Card
    moveProviderUp: "Pindahkan prioritas provider ke atas",
    moveProviderDown: "Pindahkan prioritas provider ke bawah",
    primaryActive: "Aktif Utama",
    setPrimary: "Jadikan Utama",
    primaryActiveTooltip: "Provider aktif utama",
    setPrimaryTooltip: "Jadikan provider routing utama",
    defaultEndpoint: "Endpoint Bawaan",
    modelPool: "Daftar Model",
    testPing: "Uji Koneksi",
    testing: "Menguji...",
    configure: "Konfigurasi",
    deleteProvider: "Hapus provider",
    clickToViewPing: "Klik untuk melihat payload ping & detail balasan LLM",
    failed: "Gagal",
    pingInspectionDetails: "Detail Pemeriksaan Ping Langsung",
    promptSent: "Prompt Terkirim:",
    llmReplyReceived: "Balasan LLM Diterima:",
    latency: "Latensi:",
    status: "Status:",
    endpoint: "Endpoint:",

    // Provider Form
    configureProvider: "Konfigurasi Provider",
    addNewProviderConnection: "Tambah Sambungan Provider Baru",
    noEndpointSpecified: "Endpoint belum ditentukan",
    selectActiveModels: "Pilih Model Aktif & Routing",
    endpointCredentials: "Endpoint & Kredensial",
    providerType: "Tipe Provider",
    displayName: "Nama Tampilan",
    baseUrlEndpoint: "Base URL / Endpoint",
    apiKeyToken: "Kunci API / Token",
    apiKeyPlaceholder: "sk-... (Kosongkan jika gateway lokal)",
    activeModelRoutingPriority: "Prioritas Routing Model Aktif",
    selectedCount: "dipilih",
    dragDotsOrArrows: "Tarik titik atau gunakan panah untuk mengatur urutan prioritas",
    primary: "Utama",
    fallback: "Cadangan",
    availableModels: "Model Tersedia",
    filterModels: "Filter Model",
    allModels: "Semua Model",
    freeModelsOnly: "Hanya Model Gratis",
    selectedInPool: "Dipilih di Daftar",
    modelFamilies: "Keluarga Model",
    selectAllFree: "Pilih Semua Gratis",
    searchModels: "Cari model...",
    syncFromApi: "Sinkron dari API",
    syncing: "Menyinkronkan...",
    resetFilters: "Reset Filter",
    clickToSelect: "Klik untuk memilih",
    customModel: "+ Model Kustom",
    add: "Tambah",
    testConnection: "Uji Sambungan",
    testingPing: "Menguji Ping...",
    cancel: "Batal",
    saveProvider: "Simpan Provider",

    // Automation Tab
    desktopAutomationTitle: "Otomasi Desktop & Perilaku OS",
    desktopAutomationSubtitle: "Atur otomasi Office desktop (Word, Excel, PowerPoint), interaksi aplikasi dokumen, dan notifikasi sistem operasi.",
    launchOfficeTitle: "Buka Microsoft Office Saat Mengedit",
    launchOfficeDesc: "Membuka aplikasi desktop Office (Word, Excel, PowerPoint, dll.) secara visual di layar saat menjalankan tugas dokumen. Jika dinonaktifkan, semua modifikasi dokumen dilakukan di latar belakang tanpa membuka jendela.",
    autoBackupTitle: "Cadangan Snapshot Otomatis Sebelum Modifikasi",
    autoBackupDesc: "Membuat cadangan lokal (.bak) di folder .arunaki/backups/ sebelum mengubah berkas demi pemulihan data 100% aman.",
    desktopNotificationsTitle: "Notifikasi Sistem Desktop",
    desktopNotificationsDesc: "Menampilkan notifikasi desktop bawaan saat tugas dokumen dan pembukuan selesai.",
    testDesktopNotification: "Uji Notifikasi Desktop",
    electronShellTitle: "Shell Desktop Native Electron",
    electronShellDesc: "Sistem berkas OS native, overlay jendela, dan jembatan IPC",

    // Account Tab
    userAccountLicenseTitle: "Akun Pengguna & Lisensi",
    userAccountLicenseSubtitle: "Kelola profil workstation, sinkronisasi cloud terenkripsi, dan lisensi workstation multi-perangkat.",
    proLicense: "Lisensi Pro",
    fullNameBusiness: "Nama Lengkap / Identitas Bisnis",
    save: "Simpan",
    signOut: "Keluar Akun",
    licenseDetails: "Rincian Lisensi",
    verificationStatus: "Status Verifikasi",
    activeVerified: "Aktif & Terverifikasi",
    connectedClient: "Klien Terhubung",
    windowsDesktopWorkstation: "Workstation Desktop Windows",
    cloudWorkspaceSync: "Sinkronisasi Cloud Ruang Kerja",
    aesEncryption: "Enkripsi lokal AES-256",
    active: "Aktif",
    createAccount: "Buat Akun Arunaki Baru",
    signInAccount: "Masuk ke Arunaki",
    createAccountDesc: "Daftar untuk mengaktifkan sinkronisasi cloud ruang kerja dan lisensi pro multi-perangkat.",
    signInAccountDesc: "Hubungkan akun Anda untuk menyinkronkan konfigurasi ruang kerja di berbagai perangkat.",
    continueGoogle: "Lanjutkan dengan Google",
    continueGithub: "Lanjutkan dengan GitHub",
    orContinueEmail: "atau lanjutkan dengan email",
    emailAddress: "Alamat Email",
    password: "Kata Sandi",
    registerAndSignIn: "Daftar & Masuk",
    signIn: "Masuk",
    alreadyHaveAccount: "Sudah punya akun? Masuk",
    dontHaveAccount: "Belum punya akun? Daftar",
    privacyGuaranteeTitle: "Jaminan Privasi & Mode Offline:",
    privacyGuaranteeDesc: "Arunaki beroperasi penuh secara lokal offline tanpa memerlukan akun aktif ataupun login internet.",
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
