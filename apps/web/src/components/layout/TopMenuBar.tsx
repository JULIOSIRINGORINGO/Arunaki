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
} from "lucide-react";
import { cn } from "../../lib/utils";
import { toast } from "sonner";

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
  const menuBarRef = useRef<HTMLDivElement>(null);

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

  const handleExit = () => {
    setActiveMenu(null);
    if (typeof window !== "undefined" && window.close) {
      window.close();
    }
  };

  return (
    <nav
      ref={menuBarRef}
      className="flex items-center gap-0.5 relative select-none"
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      {/* 1. FILE MENU */}
      <div className="relative">
        <button
          type="button"
          onClick={() => toggleMenu("file")}
          onMouseEnter={() => handleMouseEnter("file")}
          className={cn(
            "text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs font-medium px-2.5 py-1 rounded transition-colors cursor-pointer",
            activeMenu === "file" && "bg-[var(--bg-hover)] text-[var(--text-primary)]"
          )}
        >
          File
        </button>

        {activeMenu === "file" && (
          <div className="absolute top-full left-0 mt-1 min-w-[220px] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
            <button
              type="button"
              onClick={handleNewChat}
              className="w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
            >
              <div className="flex items-center gap-2">
                <MessageSquarePlus className="w-3.5 h-3.5 text-[var(--text-muted)]" strokeWidth={1.75} />
                <span>New Session</span>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">Ctrl+N</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveMenu(null);
                onOpenFolder();
              }}
              className="w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
            >
              <div className="flex items-center gap-2">
                <FolderOpen className="w-3.5 h-3.5 text-[var(--text-muted)]" strokeWidth={1.75} />
                <span>Open Folder...</span>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">Ctrl+O</span>
            </button>

            <div className="h-px my-1 bg-[var(--border-color)]" />

            <button
              type="button"
              onClick={handleSave}
              className="w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
            >
              <div className="flex items-center gap-2">
                <Save className="w-3.5 h-3.5 text-[var(--text-muted)]" strokeWidth={1.75} />
                <span>Save Document</span>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">Ctrl+S</span>
            </button>

            <button
              type="button"
              onClick={handleBackup}
              disabled={!activeFolder}
              className={cn(
                "w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]",
                !activeFolder && "opacity-40 cursor-not-allowed pointer-events-none"
              )}
            >
              <div className="flex items-center gap-2">
                <Archive className="w-3.5 h-3.5 text-[var(--text-muted)]" strokeWidth={1.75} />
                <span>Backup Workspace</span>
              </div>
            </button>

            <div className="h-px my-1 bg-[var(--border-color)]" />

            <button
              type="button"
              onClick={() => {
                setActiveMenu(null);
                onCloseFolder();
              }}
              disabled={!activeFolder}
              className={cn(
                "w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-red-400 hover:text-red-300",
                !activeFolder && "opacity-40 cursor-not-allowed pointer-events-none"
              )}
            >
              <div className="flex items-center gap-2">
                <FolderX className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>Close Folder</span>
              </div>
            </button>

            <div className="h-px my-1 bg-[var(--border-color)]" />

            <button
              type="button"
              onClick={handleExit}
              className="w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
            >
              <div className="flex items-center gap-2">
                <LogOut className="w-3.5 h-3.5 text-[var(--text-muted)]" strokeWidth={1.75} />
                <span>Exit Window</span>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">Alt+F4</span>
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
            "text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs font-medium px-2.5 py-1 rounded transition-colors cursor-pointer",
            activeMenu === "edit" && "bg-[var(--bg-hover)] text-[var(--text-primary)]"
          )}
        >
          Edit
        </button>

        {activeMenu === "edit" && (
          <div className="absolute top-full left-0 mt-1 min-w-[200px] bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
            <button
              type="button"
              onClick={handleUndo}
              className="w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
            >
              <div className="flex items-center gap-2">
                <Undo2 className="w-3.5 h-3.5 text-[var(--text-muted)]" strokeWidth={1.75} />
                <span>Undo</span>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">Ctrl+Z</span>
            </button>

            <button
              type="button"
              onClick={handleRedo}
              className="w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
            >
              <div className="flex items-center gap-2">
                <Redo2 className="w-3.5 h-3.5 text-[var(--text-muted)]" strokeWidth={1.75} />
                <span>Redo</span>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">Ctrl+Y</span>
            </button>

            <div className="h-px my-1 bg-[var(--border-color)]" />

            <button
              type="button"
              onClick={handleCut}
              className="w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
            >
              <div className="flex items-center gap-2">
                <Scissors className="w-3.5 h-3.5 text-[var(--text-muted)]" strokeWidth={1.75} />
                <span>Cut</span>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">Ctrl+X</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className="w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
            >
              <div className="flex items-center gap-2">
                <Copy className="w-3.5 h-3.5 text-[var(--text-muted)]" strokeWidth={1.75} />
                <span>Copy</span>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">Ctrl+C</span>
            </button>

            <button
              type="button"
              onClick={handlePaste}
              className="w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
            >
              <div className="flex items-center gap-2">
                <Clipboard className="w-3.5 h-3.5 text-[var(--text-muted)]" strokeWidth={1.75} />
                <span>Paste</span>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">Ctrl+V</span>
            </button>

            <button
              type="button"
              onClick={handleSelectAll}
              className="w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
            >
              <div className="flex items-center gap-2">
                <CheckSquare className="w-3.5 h-3.5 text-[var(--text-muted)]" strokeWidth={1.75} />
                <span>Select All</span>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">Ctrl+A</span>
            </button>

            <div className="h-px my-1 bg-[var(--border-color)]" />

            <button
              type="button"
              onClick={handleFind}
              className="w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
            >
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-[var(--text-muted)]" strokeWidth={1.75} />
                <span>Find in Session...</span>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">Ctrl+F</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
