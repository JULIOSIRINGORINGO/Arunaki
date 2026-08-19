import { useState, useRef, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
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
} from "lucide-react";
import { ArunakiLogo } from "../common/ArunakiLogo";
import { cn } from "../../lib/utils";
import { useTheme } from "../../lib/theme";

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme, isLight } = useTheme();

  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement>(null);

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
          navigate(`/?openFolder=${encodeURIComponent(result.path)}`);
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
                      <Sun className="w-3.5 h-3.5 text-amber-500" />
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
                      <Moon className="w-3.5 h-3.5 text-indigo-400" />
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
              <Moon className="w-3.5 h-3.5 text-indigo-500" strokeWidth={1.5} />
            ) : (
              <Sun className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.5} />
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

      {/* 2. MAIN CONTENT CONTAINER (3-PANEL LAYOUT) */}
      <main className="flex-1 min-h-0 w-full overflow-hidden flex flex-col relative bg-[var(--bg-app)]">
        <Outlet />
      </main>

      {/* 3. FOOTER BAWAH (MAIN MENU NAVIGATION): Single Center Capsule Container */}
      <footer className="h-14 bg-[var(--bg-header)] px-4 py-2 flex items-center justify-center shrink-0 border-t border-[var(--border-color)] transition-colors duration-150">
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-strong)]">
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
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer",
                  isActive
                    ? "bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-strong)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                )}
              >
                <Icon className="w-4 h-4" strokeWidth={1.5} />
              </button>
            );
          })}
        </div>
      </footer>
    </div>
  );
}
