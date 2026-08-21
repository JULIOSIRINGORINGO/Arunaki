import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  MessageSquare,
  BookOpen,
  History,
  Settings,
  User,
  Sun,
  Moon,
  Laptop,
  Check,
  Folder,
} from "lucide-react";
import { ArunakiLogo } from "../common/ArunakiLogo";
import { cn } from "../../lib/utils";
import { useTheme } from "../../lib/theme";
import { API_BASE, apiFetch } from "../../lib/api";
import { UnifiedWorkstationPage } from "../../pages/UnifiedWorkstationPage";
import { KnowledgePage } from "../../pages/KnowledgePage";
import { HistoryPage } from "../../pages/HistoryPage";
import { SettingsPage } from "../../pages/SettingsPage";

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme, isLight } = useTheme();

  const [workspaceInfo, setWorkspaceInfo] = useState<{ id: string; name: string; rootPath: string | null } | null>(null);
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadActiveWs() {
      const activeWsId = localStorage.getItem("arunaki_workspace_id");
      const cachedPath = localStorage.getItem("arunaki_workspace_path");

      try {
        const res = await apiFetch(`${API_BASE}/workspaces`);
        if (res.ok) {
          const json = await res.json();
          const list = json.data || [];
          if (list.length === 0) {
            setWorkspaceInfo(null);
            localStorage.removeItem("arunaki_workspace_id");
            localStorage.removeItem("arunaki_workspace_path");
            return;
          }
          const current =
            list.find((w: any) => w.id === activeWsId) ||
            list.find((w: any) => cachedPath && w.rootPath && w.rootPath.toLowerCase() === cachedPath.toLowerCase()) ||
            list[0];
          if (current) {
            setWorkspaceInfo(current);
            localStorage.setItem("arunaki_workspace_id", current.id);
            if (current.rootPath) {
              localStorage.setItem("arunaki_workspace_path", current.rootPath);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load workspace in footer:", err);
      }
    }
    loadActiveWs();

    const handleWsChange = () => loadActiveWs();
    window.addEventListener("arunaki-workspace-change", handleWsChange);
    window.addEventListener("storage", handleWsChange);
    return () => {
      window.removeEventListener("arunaki-workspace-change", handleWsChange);
      window.removeEventListener("storage", handleWsChange);
    };
  }, [location.pathname]);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (viewMenuRef.current && !viewMenuRef.current.contains(event.target as Node)) {
        setIsViewMenuOpen(false);
      }
    }
    if (isViewMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isViewMenuOpen]);

  const handleOpenFolder = async () => {
    const desktop = typeof window !== "undefined" && (window as any).arunakiDesktop;
    if (desktop?.pickFolder) {
      try {
        const result = await desktop.pickFolder();
        if (result?.path) {
          const folderPath = result.path;
          const folderName = folderPath.split(/[\\/]/).filter(Boolean).pop() || "workspace";
          try {
            const res = await apiFetch(`${API_BASE}/workspaces`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: folderName,
                rootPath: folderPath,
                businessType: "generic",
              }),
            });
            const json = await res.json();
            const ws = json.data;
            if (ws?.id) {
              localStorage.setItem("arunaki_workspace_id", ws.id);
              localStorage.setItem("arunaki_workspace_path", ws.rootPath || folderPath);
              setWorkspaceInfo(ws);
              window.dispatchEvent(new Event("arunaki-workspace-change"));
              navigate(`/?wsId=${ws.id}`);
              return;
            }
          } catch (apiErr) {
            console.error("Failed to register workspace:", apiErr);
          }
          localStorage.setItem("arunaki_workspace_path", folderPath);
          window.dispatchEvent(new Event("arunaki-workspace-change"));
          navigate(`/?openFolder=${encodeURIComponent(folderPath)}`);
          return;
        }
      } catch (err) {
        console.error("Select folder failed:", err);
      }
    } else {
      navigate("/");
    }
  };

  const toggleQuickTheme = () => {
    setTheme(isLight ? "dark" : "light");
  };

  const navItems = [
    { path: "/", label: "Workstation", icon: MessageSquare },
    { path: "/knowledge", label: "Knowledge", icon: BookOpen },
    { path: "/history", label: "History", icon: History },
    { path: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="flex flex-col h-screen w-screen bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden font-sans select-none transition-colors duration-150">
      {/* 1. HEADER ATAS (IDE TOPBAR): Logo 'A' + Menu Bar ("File", "Edit", "View", "Help") + Quick Theme Toggle */}
      <header
        className="h-11 bg-[var(--bg-header)] px-4 flex items-center justify-between shrink-0 border-b border-[var(--border-color)] transition-colors duration-150"
        style={{ WebkitAppRegion: "drag", paddingRight: "140px" } as React.CSSProperties}
      >
        <div
          className="flex items-center gap-3"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          {/* Logo 'A' di paling kiri */}
          <div className="w-6 h-6 rounded-full bg-[var(--bg-hover)] flex items-center justify-center border border-[var(--border-strong)] shrink-0">
            <ArunakiLogo className="w-3.5 h-3.5" fill={isLight ? "#18181B" : "#FFFFFF"} />
          </div>

          {/* Menu Header Teks Murni */}
          <nav className="flex items-center gap-1 relative">
            <button
              onClick={handleOpenFolder}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs font-semibold px-3 py-1 rounded-md hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            >
              File
            </button>
            <button
              onClick={() => navigate("/")}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs font-semibold px-3 py-1 rounded-md hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            >
              Edit
            </button>

            {/* View / Tampilan Dropdown */}
            <div className="relative" ref={viewMenuRef}>
              <button
                onClick={() => setIsViewMenuOpen(!isViewMenuOpen)}
                className={cn(
                  "text-xs font-semibold px-3 py-1 rounded-md transition-colors cursor-pointer",
                  isViewMenuOpen
                    ? "bg-[var(--bg-hover)] text-[var(--text-primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                )}
              >
                View
              </button>

              {/* View Dropdown Menu Popup */}
              {isViewMenuOpen && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-[var(--bg-card)] border border-[var(--border-strong)] rounded-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 font-sans">
                  <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
                    Theme
                  </div>

                  <button
                    onClick={() => {
                      setTheme("light");
                      setIsViewMenuOpen(false);
                    }}
                    className={cn(
                      "w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)]",
                      theme === "light"
                        ? "text-[var(--text-primary)] font-medium"
                        : "text-[var(--text-muted)]"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Sun className="w-3.5 h-3.5 text-[var(--text-primary)]" />
                      <span>Light Mode</span>
                    </div>
                    {theme === "light" && <Check className="w-3.5 h-3.5 text-blue-500" />}
                  </button>

                  <button
                    onClick={() => {
                      setTheme("dark");
                      setIsViewMenuOpen(false);
                    }}
                    className={cn(
                      "w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)]",
                      theme === "dark"
                        ? "text-[var(--text-primary)] font-medium"
                        : "text-[var(--text-muted)]"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Moon className="w-3.5 h-3.5 text-[var(--text-primary)]" />
                      <span>Dark Mode</span>
                    </div>
                    {theme === "dark" && <Check className="w-3.5 h-3.5 text-blue-500" />}
                  </button>

                  <button
                    onClick={() => {
                      setTheme("system");
                      setIsViewMenuOpen(false);
                    }}
                    className={cn(
                      "w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer hover:bg-[var(--bg-hover)]",
                      theme === "system"
                        ? "text-[var(--text-primary)] font-medium"
                        : "text-[var(--text-muted)]"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Laptop className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                      <span>System Default</span>
                    </div>
                    {theme === "system" && <Check className="w-3.5 h-3.5 text-blue-500" />}
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => navigate("/knowledge")}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs font-semibold px-3 py-1 rounded-md hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            >
              Help
            </button>
          </nav>
        </div>

        {/* Right side: Quick Theme Switch & User Avatar */}
        <div
          className="flex items-center gap-2"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          {/* Quick 1-Click Theme Switcher Button */}
          <button
            onClick={toggleQuickTheme}
            className="w-7 h-7 rounded-full bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-color)] transition-colors cursor-pointer"
            title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
          >
            {isLight ? (
              <Moon className="w-4 h-4 text-[var(--text-primary)]" strokeWidth={2.25} />
            ) : (
              <Sun className="w-4 h-4 text-[var(--text-primary)]" strokeWidth={2.25} />
            )}
          </button>

          <button
            onClick={() => navigate("/settings")}
            className="w-7 h-7 rounded-full bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-color)] transition-colors cursor-pointer"
            title="User Profile & Settings"
          >
            <User className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {/* 2. MAIN CONTENT CONTAINER WITH ZERO-LATENCY KEEP-ALIVE */}
      <main className="flex-1 min-h-0 w-full overflow-hidden flex flex-col relative bg-[var(--bg-app)]">
        {/* Workstation View: Kept alive in memory for instant 0ms switching & preserving tabs */}
        <div
          className={cn(
            "w-full h-full flex flex-col flex-1",
            !(location.pathname === "/" || location.pathname.startsWith("/workspace")) && "hidden"
          )}
        >
          <UnifiedWorkstationPage />
        </div>

        {/* Sub-pages: Fast render with subtle micro-transition */}
        {location.pathname === "/knowledge" && (
          <div className="w-full h-full flex flex-col flex-1 animate-in fade-in duration-100">
            <KnowledgePage />
          </div>
        )}
        {location.pathname === "/history" && (
          <div className="w-full h-full flex flex-col flex-1 animate-in fade-in duration-100">
            <HistoryPage />
          </div>
        )}
        {location.pathname === "/settings" && (
          <div className="w-full h-full flex flex-col flex-1 animate-in fade-in duration-100">
            <SettingsPage />
          </div>
        )}
      </main>

      {/* 3. FOOTER BAWAH: Left Path Info, Center Capsule Nav, Right Status */}
      <footer className="h-12 bg-[var(--bg-header)] px-4 flex items-center justify-between shrink-0 border-t border-[var(--border-color)] transition-colors duration-150 text-xs">
        {/* Left: Active Workspace Path Display (Read-Only Info) */}
        <div className="flex items-center gap-2 min-w-0 max-w-[280px] sm:max-w-[380px]">
          <div
            title={workspaceInfo?.rootPath ? `Folder Kerja Aktif: ${workspaceInfo.rootPath}` : "Tidak ada folder aktif"}
            className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] truncate max-w-full"
          >
            <Folder className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
            <span className="text-[11px] truncate text-[var(--text-primary)]">
              {workspaceInfo?.name || (workspaceInfo?.rootPath ? workspaceInfo.rootPath.split(/[\\/]/).pop() : "Belum ada folder aktif")}
            </span>
          </div>
        </div>

        {/* Center: Main Navigation Floating Capsule (Spacious & Modern) */}
        <div className="flex items-center gap-1.5 p-1 rounded-full bg-[var(--bg-card)] border border-[var(--border-strong)] shadow-sm">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.path === "/"
                ? location.pathname === "/" || location.pathname.startsWith("/workspace")
                : location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                title={item.label}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer",
                  isActive
                    ? "bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-strong)] shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                )}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span className="leading-none">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Status Indicator */}
        <div className="flex items-center gap-2 min-w-0 max-w-[280px] sm:max-w-[340px] justify-end">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[11px] text-[var(--text-muted)]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-medium text-[var(--text-muted)]">Arunaki Engine</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
