import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { MessageSquare, BookOpen, History, Settings, FolderOpen } from "lucide-react";
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
    <div className="flex flex-col h-screen w-screen bg-[#1A191B] text-[#F4EFE6] overflow-hidden font-sans select-none">
      {/* 1. TOP HEADER MENU (FILE DAN YANG LAIN) + LOGO */}
      <header className="h-12 bg-[#1A191B] px-4 flex items-center justify-between shrink-0 border-b border-stone-800/80">
        <div className="flex items-center gap-4">
          <span className="text-[#FF5E38] font-bold text-xs tracking-wider uppercase pr-3 border-r border-stone-800">
            ARUNAKI WORKSTATION
          </span>

          <nav className="flex items-center gap-1">
            <button
              onClick={handleOpenFolder}
              className="text-stone-300 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-stone-800 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <FolderOpen className="w-3.5 h-3.5 text-[#FF5E38]" />
              <span>File</span>
            </button>
            <button
              onClick={() => navigate("/")}
              className="text-stone-300 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Edit
            </button>
            <button
              onClick={() => navigate("/")}
              className="text-stone-300 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Tampilan
            </button>
            <button
              onClick={() => navigate("/knowledge")}
              className="text-stone-300 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Bantuan
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-[#252428] flex items-center justify-center border border-stone-700">
            <ArunakiLogo className="w-4 h-4" fill="#FF5E38" />
          </div>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE / EDITOR CONTENT AREA (3-PANEL SPLIT) */}
      <main className="flex-1 min-h-0 w-full overflow-hidden flex flex-col relative">
        <Outlet />
      </main>

      {/* 3. FOOTER MAIN MENU (KNOWLEDGE) DAN YANG LAIN */}
      <footer className="h-10 bg-[#1A191B] px-4 flex items-center justify-between shrink-0 border-t border-stone-800/80 text-xs">
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
                    ? "bg-[#FF5E38] text-white border-[#FF5E38] shadow-sm"
                    : "bg-[#252428] text-stone-300 border-stone-700/60 hover:text-white hover:bg-stone-800"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4 text-[11px] text-stone-400">
          <span className="flex items-center gap-1 text-[#C4B5FD]">
            <BookOpen className="w-3.5 h-3.5" />
            Knowledge Base Active
          </span>
          <span>• Arunaki Desktop AI v1.0</span>
        </div>
      </footer>
    </div>
  );
}
