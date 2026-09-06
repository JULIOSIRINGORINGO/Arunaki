import { useState, useRef, useEffect } from "react";
import {
  MessageSquarePlus,
  FolderOpen,
  Save,
  Archive,
  FolderX,
  LogOut,
  Undo2,
  Redo2,
  Scissors,
  Copy,
  Clipboard,
  CheckSquare,
  Search,
  PanelLeft,
  PanelRight,
  Sun,
  Moon,
  Laptop,
  Maximize,
  RotateCcw,
  Check,
  BookOpen,
  Keyboard,
  Bug,
  Info,
  ExternalLink,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { toast } from "sonner";
import { useTheme } from "../../lib/theme";

interface TopMenuBarProps {
  activeFolder: string;
  onOpenFolder: () => void;
  onCloseFolder: () => void;
}

export function TopMenuBar({
  activeFolder,
  onOpenFolder,
  onCloseFolder,
}: TopMenuBarProps) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const menuBarRef = useRef<HTMLDivElement>(null);

  const { theme, setTheme } = useTheme();

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuBarRef.current && !menuBarRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    }
    if (activeMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeMenu]);

  // Close menu on Escape key & handle global shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setActiveMenu(null);
        setShowShortcutsModal(false);
        setShowAboutModal(false);
        return;
      }

      // Check if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (!isTyping && (e.ctrlKey || e.metaKey)) {
        if (e.key.toLowerCase() === "o") {
          e.preventDefault();
          onOpenFolder();
        } else if (e.key.toLowerCase() === "s") {
          e.preventDefault();
          handleSave();
        } else if (e.key.toLowerCase() === "n") {
          e.preventDefault();
          handleNewChat();
        } else if (e.key.toLowerCase() === "f") {
          e.preventDefault();
          handleFind();
        } else if (e.key === "/") {
          e.preventDefault();
          setShowShortcutsModal(true);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenFolder]);

  const toggleMenu = (menuName: string) => {
    setActiveMenu((prev) => (prev === menuName ? null : menuName));
  };

  const handleMouseEnter = (menuName: string) => {
    if (activeMenu && activeMenu !== menuName) {
      setActiveMenu(menuName);
    }
  };

  const handleNewChat = () => {
    window.dispatchEvent(new CustomEvent("arunaki-new-chat"));
    setActiveMenu(null);
  };

  const handleSave = () => {
    window.dispatchEvent(new CustomEvent("arunaki-save-file"));
    setActiveMenu(null);
  };

  const handleUndo = () => {
    document.execCommand("undo");
    setActiveMenu(null);
  };

  const handleRedo = () => {
    document.execCommand("redo");
    setActiveMenu(null);
  };

  const handleCut = () => {
    document.execCommand("cut");
    setActiveMenu(null);
  };

  const handleCopy = () => {
    document.execCommand("copy");
    setActiveMenu(null);
  };

  const handlePaste = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        document.execCommand("insertText", false, text);
      } else {
        document.execCommand("paste");
      }
    } catch {
      document.execCommand("paste");
    }
    setActiveMenu(null);
  };

  const handleSelectAll = () => {
    document.execCommand("selectAll");
    setActiveMenu(null);
  };

  const handleFind = () => {
    window.dispatchEvent(new CustomEvent("arunaki-search-session"));
    setActiveMenu(null);
  };

  const handleBackup = async () => {
    setActiveMenu(null);
    const desktop = typeof window !== "undefined" && (window as any).arunakiDesktop;
    if (desktop?.backupFolder) {
      try {
        const res = await desktop.backupFolder();
        if (res?.success) {
          toast.success(`Backup created: ${res.path}`);
        } else {
          toast.error(res?.error || "Failed to create backup");
        }
      } catch (err: any) {
        toast.error(err?.message || "Backup failed");
      }
    } else {
      toast.info("Workspace backup is active in Desktop mode.");
    }
  };

  const handleToggleExplorer = () => {
    window.dispatchEvent(new CustomEvent("arunaki-toggle-explorer"));
    setActiveMenu(null);
  };

  const handleToggleChat = () => {
    window.dispatchEvent(new CustomEvent("arunaki-toggle-chat"));
    setActiveMenu(null);
  };

  const handleToggleFullscreen = () => {
    setActiveMenu(null);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleResetZoom = () => {
    setActiveMenu(null);
    if (typeof document !== "undefined") {
      (document.body.style as any).zoom = "1";
    }
  };

  const handleExit = () => {
    setActiveMenu(null);
    if (typeof window !== "undefined" && window.close) {
      window.close();
    }
  };

  return (
    <>
      <nav
        ref={menuBarRef}
        className="flex items-center gap-1 relative select-none"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        {/* 1. FILE MENU */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu("file")}
            onMouseEnter={() => handleMouseEnter("file")}
            className={cn(
              "text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[13px] font-medium px-3 py-1.5 rounded-md transition-colors cursor-pointer",
              activeMenu === "file" && "bg-[var(--bg-hover)] text-[var(--text-primary)]"
            )}
          >
            File
          </button>

          {activeMenu === "file" && (
            <div className="absolute top-full left-0 mt-1 min-w-[245px] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                onClick={handleNewChat}
                className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
              >
                <div className="flex items-center gap-2.5">
                  <MessageSquarePlus className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
                  <span>New Session</span>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] font-mono">Ctrl+N</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveMenu(null);
                  onOpenFolder();
                }}
                className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
              >
                <div className="flex items-center gap-2.5">
                  <FolderOpen className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
                  <span>Open Folder...</span>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] font-mono">Ctrl+O</span>
              </button>

              <div className="h-px my-1.5 bg-[var(--border-color)]" />

              <button
                type="button"
                onClick={handleSave}
                className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
              >
                <div className="flex items-center gap-2.5">
                  <Save className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
                  <span>Save Document</span>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] font-mono">Ctrl+S</span>
              </button>

              <button
                type="button"
                onClick={handleBackup}
                disabled={!activeFolder}
                className={cn(
                  "w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]",
                  !activeFolder && "opacity-40 cursor-not-allowed pointer-events-none"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Archive className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
                  <span>Backup Workspace</span>
                </div>
              </button>

              <div className="h-px my-1.5 bg-[var(--border-color)]" />

              <button
                type="button"
                onClick={() => {
                  setActiveMenu(null);
                  onCloseFolder();
                }}
                disabled={!activeFolder}
                className={cn(
                  "w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-red-400 hover:text-red-300",
                  !activeFolder && "opacity-40 cursor-not-allowed pointer-events-none"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <FolderX className="w-4 h-4" strokeWidth={1.75} />
                  <span>Close Folder</span>
                </div>
              </button>

              <div className="h-px my-1.5 bg-[var(--border-color)]" />

              <button
                type="button"
                onClick={handleExit}
                className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
              >
                <div className="flex items-center gap-2.5">
                  <LogOut className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
                  <span>Exit Window</span>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] font-mono">Alt+F4</span>
              </button>
            </div>
          )}
        </div>

        {/* 2. EDIT MENU */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu("edit")}
            onMouseEnter={() => handleMouseEnter("edit")}
            className={cn(
              "text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[13px] font-medium px-3 py-1.5 rounded-md transition-colors cursor-pointer",
              activeMenu === "edit" && "bg-[var(--bg-hover)] text-[var(--text-primary)]"
            )}
          >
            Edit
          </button>

          {activeMenu === "edit" && (
            <div className="absolute top-full left-0 mt-1 min-w-[245px] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                onClick={handleUndo}
                className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
              >
                <div className="flex items-center gap-2.5">
                  <Undo2 className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
                  <span>Undo</span>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] font-mono">Ctrl+Z</span>
              </button>

              <button
                type="button"
                onClick={handleRedo}
                className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
              >
                <div className="flex items-center gap-2.5">
                  <Redo2 className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
                  <span>Redo</span>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] font-mono">Ctrl+Y</span>
              </button>

              <div className="h-px my-1.5 bg-[var(--border-color)]" />

              <button
                type="button"
                onClick={handleCut}
                className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
              >
                <div className="flex items-center gap-2.5">
                  <Scissors className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
                  <span>Cut</span>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] font-mono">Ctrl+X</span>
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
              >
                <div className="flex items-center gap-2.5">
                  <Copy className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
                  <span>Copy</span>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] font-mono">Ctrl+C</span>
              </button>

              <button
                type="button"
                onClick={handlePaste}
                className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
              >
                <div className="flex items-center gap-2.5">
                  <Clipboard className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
                  <span>Paste</span>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] font-mono">Ctrl+V</span>
              </button>

              <button
                type="button"
                onClick={handleSelectAll}
                className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
              >
                <div className="flex items-center gap-2.5">
                  <CheckSquare className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
                  <span>Select All</span>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] font-mono">Ctrl+A</span>
              </button>

              <div className="h-px my-1.5 bg-[var(--border-color)]" />

              <button
                type="button"
                onClick={handleFind}
                className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
              >
                <div className="flex items-center gap-2.5">
                  <Search className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
                  <span>Find in Session...</span>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] font-mono">Ctrl+F</span>
              </button>
            </div>
          )}
        </div>

        {/* 3. VIEW MENU */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu("view")}
            onMouseEnter={() => handleMouseEnter("view")}
            className={cn(
              "text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[13px] font-medium px-3 py-1.5 rounded-md transition-colors cursor-pointer",
              activeMenu === "view" && "bg-[var(--bg-hover)] text-[var(--text-primary)]"
            )}
          >
            View
          </button>

          {activeMenu === "view" && (
            <div className="absolute top-full left-0 mt-1 min-w-[245px] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                onClick={handleToggleExplorer}
                className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
              >
                <div className="flex items-center gap-2.5">
                  <PanelLeft className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
                  <span>Explorer Panel</span>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] font-mono">Ctrl+B</span>
              </button>

              <button
                type="button"
                onClick={handleToggleChat}
                className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
              >
                <div className="flex items-center gap-2.5">
                  <PanelRight className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
                  <span>Chat Panel</span>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] font-mono">Ctrl+J</span>
              </button>

              <div className="h-px my-1.5 bg-[var(--border-color)]" />

              <div className="px-3.5 py-1 text-xs font-medium text-[var(--text-muted)]">
                Theme
              </div>

              <button
                type="button"
                onClick={() => {
                  setTheme("light");
                  setActiveMenu(null);
                }}
                className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
              >
                <div className="flex items-center gap-2.5">
                  <Sun className="w-4 h-4 text-amber-500" strokeWidth={1.75} />
                  <span>Light</span>
                </div>
                {theme === "light" && <Check className="w-4 h-4 text-blue-500" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setTheme("dark");
                  setActiveMenu(null);
                }}
                className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
              >
                <div className="flex items-center gap-2.5">
                  <Moon className="w-4 h-4 text-indigo-400" strokeWidth={1.75} />
                  <span>Dark</span>
                </div>
                {theme === "dark" && <Check className="w-4 h-4 text-blue-500" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setTheme("system");
                  setActiveMenu(null);
                }}
                className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
              >
                <div className="flex items-center gap-2.5">
                  <Laptop className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
                  <span>System Theme</span>
                </div>
                {theme === "system" && <Check className="w-4 h-4 text-blue-500" />}
              </button>

              <div className="h-px my-1.5 bg-[var(--border-color)]" />

              <button
                type="button"
                onClick={handleToggleFullscreen}
                className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
              >
                <div className="flex items-center gap-2.5">
                  <Maximize className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
                  <span>Toggle Fullscreen</span>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] font-mono">F11</span>
              </button>

              <button
                type="button"
                onClick={handleResetZoom}
                className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
              >
                <div className="flex items-center gap-2.5">
                  <RotateCcw className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
                  <span>Reset Zoom</span>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] font-mono">Ctrl+0</span>
              </button>
            </div>
          )}
        </div>

        {/* 4. HELP MENU */}
        <div className="relative">
          <button
            type="button"
            onClick={() => toggleMenu("help")}
            onMouseEnter={() => handleMouseEnter("help")}
            className={cn(
              "text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[13px] font-medium px-3 py-1.5 rounded-md transition-colors cursor-pointer",
              activeMenu === "help" && "bg-[var(--bg-hover)] text-[var(--text-primary)]"
            )}
          >
            Help
          </button>

          {activeMenu === "help" && (
            <div className="absolute top-full left-0 mt-1 min-w-[245px] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                onClick={() => {
                  setActiveMenu(null);
                  window.location.hash = "/knowledge";
                }}
                className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
                  <span>Knowledge & Rules</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveMenu(null);
                  setShowShortcutsModal(true);
                }}
                className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
              >
                <div className="flex items-center gap-2.5">
                  <Keyboard className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
                  <span>Keyboard Shortcuts</span>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] font-mono">Ctrl+/</span>
              </button>

              <div className="h-px my-1.5 bg-[var(--border-color)]" />

              <button
                type="button"
                onClick={() => {
                  setActiveMenu(null);
                  window.open("https://github.com/JULIOSIRINGORINGO/Arunaki", "_blank");
                }}
                className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
              >
                <div className="flex items-center gap-2.5">
                  <ExternalLink className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
                  <span>GitHub Repository</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveMenu(null);
                  window.open("https://github.com/JULIOSIRINGORINGO/Arunaki/issues", "_blank");
                }}
                className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
              >
                <div className="flex items-center gap-2.5">
                  <Bug className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
                  <span>Report an Issue</span>
                </div>
              </button>

              <div className="h-px my-1.5 bg-[var(--border-color)]" />

              <button
                type="button"
                onClick={() => {
                  setActiveMenu(null);
                  setShowAboutModal(true);
                }}
                className="w-full px-3.5 py-2 text-[13px] flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
              >
                <div className="flex items-center gap-2.5">
                  <Info className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={1.75} />
                  <span>About Arunaki</span>
                </div>
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* KEYBOARD SHORTCUTS MODAL */}
      {showShortcutsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl max-w-md w-full p-5 flex flex-col gap-4 text-xs">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <h3 className="font-semibold text-sm text-[var(--text-primary)] flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-[var(--text-primary)]" />
                Keyboard Shortcuts
              </h3>
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-2.5 max-h-[360px] overflow-y-auto pr-1">
              {[
                { key: "Ctrl + O", desc: "Open workspace folder" },
                { key: "Ctrl + S", desc: "Save active document" },
                { key: "Ctrl + N", desc: "Start new chat session" },
                { key: "Ctrl + B", desc: "Toggle Explorer panel" },
                { key: "Ctrl + J", desc: "Toggle Chat panel" },
                { key: "Ctrl + F", desc: "Find session in history" },
                { key: "Ctrl + /", desc: "Show keyboard shortcuts" },
                { key: "F11", desc: "Toggle fullscreen mode" },
                { key: "Ctrl + 0", desc: "Reset display zoom" },
                { key: "Esc", desc: "Dismiss active modal or menu" },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-1 border-b border-[var(--border-color)]/40 last:border-0"
                >
                  <span className="text-[var(--text-primary)] text-xs">{item.desc}</span>
                  <span className="px-2 py-0.5 rounded bg-[var(--bg-hover)] border border-[var(--border-color)] text-[11px] font-mono text-[var(--text-primary)]">
                    {item.key}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="px-4 py-1.5 bg-[var(--bg-hover)] hover:bg-[var(--bg-panel)] text-[var(--text-primary)] font-medium rounded-lg text-xs transition-colors cursor-pointer border border-[var(--border-color)]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ABOUT ARUNAKI MODAL */}
      {showAboutModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl max-w-sm w-full p-5 flex flex-col gap-4 text-xs">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <h3 className="font-semibold text-sm text-[var(--text-primary)] flex items-center gap-2">
                <Info className="w-4 h-4 text-[var(--text-primary)]" />
                About Arunaki
              </h3>
              <button
                type="button"
                onClick={() => setShowAboutModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-center items-center py-2">
              <div className="w-12 h-12 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border-color)] flex items-center justify-center text-lg font-bold text-[var(--text-primary)]">
                A
              </div>
              <div>
                <h4 className="font-bold text-sm text-[var(--text-primary)]">Arunaki Desktop</h4>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  Sandboxed Computer Use Agent for Documents
                </p>
              </div>
              <div className="w-full bg-[var(--bg-hover)]/60 rounded-lg p-3 text-[11px] text-left text-[var(--text-muted)] flex flex-col gap-1.5 border border-[var(--border-color)]/50">
                <div className="flex justify-between">
                  <span>Version:</span>
                  <span className="font-mono text-[var(--text-primary)]">0.1.0 (Phase 68)</span>
                </div>
                <div className="flex justify-between">
                  <span>Environment:</span>
                  <span className="text-[var(--text-primary)]">Desktop (Electron)</span>
                </div>
                <div className="flex justify-between">
                  <span>Isolation:</span>
                  <span className="text-emerald-500 font-medium">Active Folder Sandbox</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowAboutModal(false)}
                className="px-4 py-1.5 bg-[var(--bg-hover)] hover:bg-[var(--bg-panel)] text-[var(--text-primary)] font-medium rounded-lg text-xs transition-colors cursor-pointer border border-[var(--border-color)]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
