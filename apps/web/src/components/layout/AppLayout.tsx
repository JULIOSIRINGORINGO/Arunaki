import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { MessageSquare, BookOpen, History, Settings, FolderOpen, User } from "lucide-react";
import { ArunakiLogo } from "../common/ArunakiLogo";
import { cn } from "../../lib/utils";

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

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

  const navItems = [
    { path: "/", label: "WORKSTATION", icon: MessageSquare },
    { path: "/knowledge", label: "KNOWLEDGE", icon: BookOpen },
    { path: "/history", label: "RIWAYAT", icon: History },
    { path: "/settings", label: "SETTINGS", icon: Settings },
  ];

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0A0A0A] text-[#FFFFFF] overflow-hidden font-sans select-none">
      {/* 1. HEADER ATAS (IDE TOPBAR): Integrated Window Drag Titlebar + IDE Menu + Logo Avatar */}
      <header
        className="h-11 bg-[#121212] px-4 flex items-center justify-between shrink-0 border-b border-[#2D2D2D]"
        style={{ WebkitAppRegion: "drag", paddingRight: "140px" } as React.CSSProperties}
      >
        <div
          className="flex items-center gap-4"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <span className="text-[#FFFFFF] font-bold text-xs tracking-wider uppercase pr-3 border-r border-[#2D2D2D]">
            ARUNAKI IDE
          </span>

          <nav className="flex items-center gap-1">
            <button
              onClick={handleOpenFolder}
              className="text-[#A3A3A3] hover:text-[#FFFFFF] text-xs font-semibold px-3 py-1 rounded-md hover:bg-[#262626] transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <FolderOpen className="w-3.5 h-3.5 text-[#E5E5E5]" />
              <span>File</span>
            </button>
            <button
              onClick={() => navigate("/")}
              className="text-[#A3A3A3] hover:text-[#FFFFFF] text-xs font-semibold px-3 py-1 rounded-md hover:bg-[#262626] transition-colors cursor-pointer"
            >
              Edit
            </button>
            <button
              onClick={() => navigate("/")}
              className="text-[#A3A3A3] hover:text-[#FFFFFF] text-xs font-semibold px-3 py-1 rounded-md hover:bg-[#262626] transition-colors cursor-pointer"
            >
              Tampilan
            </button>
            <button
              onClick={() => navigate("/knowledge")}
              className="text-[#A3A3A3] hover:text-[#FFFFFF] text-xs font-semibold px-3 py-1 rounded-md hover:bg-[#262626] transition-colors cursor-pointer"
            >
              Bantuan
            </button>
          </nav>
        </div>

        {/* Right side: Logo & Avatar */}
        <div
          className="flex items-center gap-3"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <div className="w-7 h-7 rounded-full bg-[#1E1E1E] flex items-center justify-center border border-[#2D2D2D]">
            <ArunakiLogo className="w-4 h-4" fill="#FFFFFF" />
          </div>
          <button
            onClick={() => navigate("/settings")}
            className="w-7 h-7 rounded-full bg-[#262626] flex items-center justify-center text-[#A3A3A3] hover:text-white border border-[#2D2D2D] transition-colors cursor-pointer"
            title="User Profile & Settings"
          >
            <User className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* 2. MAIN CONTENT CONTAINER (3-PANEL LAYOUT) */}
      <main className="flex-1 min-h-0 w-full overflow-hidden flex flex-col relative bg-[#0A0A0A]">
        <Outlet />
      </main>

      {/* 3. FOOTER BAWAH (MAIN MENU NAVIGATION): Horizontal Curved Capsule Bar */}
      <footer className="h-10 bg-[#121212] px-4 flex items-center justify-between shrink-0 border-t border-[#2D2D2D] text-xs">
        <div className="flex items-center gap-2">
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
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer border",
                  isActive
                    ? "bg-[#262626] text-[#FFFFFF] border-[#525252] shadow-sm font-bold"
                    : "bg-[#181818] text-[#A3A3A3] border-[#2D2D2D] hover:text-[#FFFFFF] hover:bg-[#262626]"
                )}
              >
                <Icon className="w-3.5 h-3.5 text-[#E5E5E5]" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4 text-[11px] text-[#A3A3A3]">
          <span className="flex items-center gap-1 text-[#E5E5E5]">
            <BookOpen className="w-3.5 h-3.5" />
            Knowledge Active
          </span>
          <span>• Arunaki IDE v1.0</span>
        </div>
      </footer>
    </div>
  );
}
