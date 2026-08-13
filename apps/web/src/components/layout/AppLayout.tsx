import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { MessageSquare, BookOpen, History, Settings, User } from "lucide-react";
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
    { path: "/", label: "Workstation", icon: MessageSquare },
    { path: "/knowledge", label: "Knowledge", icon: BookOpen },
    { path: "/history", label: "Riwayat", icon: History },
    { path: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0A0A0A] text-[#FFFFFF] overflow-hidden font-sans select-none">
      {/* 1. HEADER ATAS (IDE TOPBAR): Logo 'A' + Pure Text Menu ("File", "Edit", "Tampilan", "Bantuan") */}
      <header
        className="h-11 bg-[#121212] px-4 flex items-center justify-between shrink-0 border-b border-[#383838]"
        style={{ WebkitAppRegion: "drag", paddingRight: "140px" } as React.CSSProperties}
      >
        <div
          className="flex items-center gap-3"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          {/* Logo 'A' di paling kiri */}
          <div className="w-6 h-6 rounded-full bg-[#1E1E1E] flex items-center justify-center border border-[#383838] shrink-0">
            <ArunakiLogo className="w-3.5 h-3.5" fill="#FFFFFF" />
          </div>

          {/* Menu Header Teks Murni (Tanpa ikon folder) */}
          <nav className="flex items-center gap-1">
            <button
              onClick={handleOpenFolder}
              className="text-[#A3A3A3] hover:text-[#FFFFFF] text-xs font-semibold px-3 py-1 rounded-md hover:bg-[#262626] transition-colors cursor-pointer"
            >
              File
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

        {/* Right side: User Profile Avatar */}
        <div
          className="flex items-center gap-3"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <button
            onClick={() => navigate("/settings")}
            className="w-7 h-7 rounded-full bg-[#262626] flex items-center justify-center text-[#A3A3A3] hover:text-white border border-[#383838] transition-colors cursor-pointer"
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

      {/* 3. FOOTER BAWAH (MAIN MENU NAVIGATION): Single Center Capsule Container (Icons Only, No Text) */}
      <footer className="h-11 bg-[#121212] px-4 flex items-center justify-center shrink-0 border-t border-[#383838]">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1E1E1E] border border-[#383838] shadow-md">
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
                    ? "bg-[#262626] text-[#FFFFFF] border border-[#525252] shadow-xs"
                    : "text-[#A3A3A3] hover:text-[#FFFFFF] hover:bg-[#262626]"
                )}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>
      </footer>
    </div>
  );
}
