import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { MessageSquare, Folder, BookOpen, History, User, Settings } from "lucide-react";
import { ArunakiLogo } from "../common/ArunakiLogo";
import { cn } from "../../lib/utils";

interface SidebarProps {
  onOpenChatPopup?: () => void;
  isChatOpen?: boolean;
}

export function Sidebar({ onOpenChatPopup: _onOpenChatPopup, isChatOpen: _isChatOpen }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const isChatActive = location.pathname === "/";
  const isWorkspaceActive = location.pathname.startsWith("/workspace");
  const isKnowledgeActive = location.pathname === "/knowledge";
  const isHistoryActive = location.pathname === "/history";
  const isProfileActive = location.pathname === "/profile";
  const isSettingsActive = location.pathname === "/settings";

  return (
    <aside className="flex flex-col items-center h-full px-3 select-none shrink-0 z-30">
      {/* 1. Top Standalone Circular Brand Badge - Exact 56px (w-14) diameter */}
      <div className="h-14 flex items-center justify-center mb-4 shrink-0">
        <button
          onClick={() => navigate("/")}
          className="w-14 h-14 rounded-full bg-[#1A191B] flex items-center justify-center shadow-md transition-transform hover:scale-105 active:scale-95 cursor-pointer border border-stone-800/50"
          title="Arunaki Brand Home"
        >
          <ArunakiLogo className="w-6 h-6 shrink-0" fill="#C4B5FD" />
        </button>
      </div>

      {/* 2. Middle Main Navigation Vertical Pill - Exact 56px (w-14) width, stretches flex-1 */}
      <div className="w-14 flex-1 bg-[#1A191B] rounded-full py-4 flex flex-col items-center gap-3.5 shadow-lg border border-stone-800/50 relative">
        {/* Chat AI Tab Button */}
        <NavLink
          to="/"
          className="w-14 h-10 flex items-center justify-center cursor-pointer group relative"
          title="Chat AI Utama"
        >
          {/* Bleeding Cream Tab Background with Vector-Perfect SVG Fillet Curves */}
          <div
            className={cn(
              "absolute left-2 top-1 bottom-1 right-[-24px] bg-[#F4EFE6] rounded-l-full transition-all duration-200 z-10 pointer-events-none",
              isChatActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          >
            {/* Top Vector Concave Curve SVG */}
            <svg
              className="absolute -top-3 right-6 w-3 h-3 text-[#F4EFE6] fill-current pointer-events-none"
              viewBox="0 0 12 12"
            >
              <path d="M12 0 v12 H0 a12 12 0 0 0 12-12Z" />
            </svg>
            {/* Bottom Vector Concave Curve SVG */}
            <svg
              className="absolute -bottom-3 right-6 w-3 h-3 text-[#F4EFE6] fill-current pointer-events-none"
              viewBox="0 0 12 12"
            >
              <path d="M12 12 v-12 H0 a12 12 0 0 1 12 12Z" />
            </svg>
          </div>

          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200 z-20 shrink-0",
              isChatActive
                ? "text-[#FF5E38]"
                : "bg-[#252428] text-[#C4B5FD] group-hover:bg-transparent group-hover:text-[#FF5E38]"
            )}
          >
            <MessageSquare className="w-4 h-4" />
          </div>
        </NavLink>

        {/* Workspace Tab Button */}
        <NavLink
          to="/workspace"
          className="w-14 h-10 flex items-center justify-center cursor-pointer group relative"
          title="Workspace"
        >
          <div
            className={cn(
              "absolute left-2 top-1 bottom-1 right-[-24px] bg-[#F4EFE6] rounded-l-full transition-all duration-200 z-10 pointer-events-none",
              isWorkspaceActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          >
            <svg
              className="absolute -top-3 right-6 w-3 h-3 text-[#F4EFE6] fill-current pointer-events-none"
              viewBox="0 0 12 12"
            >
              <path d="M12 0 v12 H0 a12 12 0 0 0 12-12Z" />
            </svg>
            <svg
              className="absolute -bottom-3 right-6 w-3 h-3 text-[#F4EFE6] fill-current pointer-events-none"
              viewBox="0 0 12 12"
            >
              <path d="M12 12 v-12 H0 a12 12 0 0 1 12 12Z" />
            </svg>
          </div>

          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200 z-20 shrink-0",
              isWorkspaceActive
                ? "text-[#FF5E38]"
                : "bg-[#252428] text-[#C4B5FD] group-hover:bg-transparent group-hover:text-[#FF5E38]"
            )}
          >
            <Folder className="w-4 h-4 fill-current" />
          </div>
        </NavLink>

        {/* Knowledge Base Tab Button */}
        <NavLink
          to="/knowledge"
          className="w-14 h-10 flex items-center justify-center cursor-pointer group relative"
          title="Knowledge Base"
        >
          <div
            className={cn(
              "absolute left-2 top-1 bottom-1 right-[-24px] bg-[#F4EFE6] rounded-l-full transition-all duration-200 z-10 pointer-events-none",
              isKnowledgeActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          >
            <svg
              className="absolute -top-3 right-6 w-3 h-3 text-[#F4EFE6] fill-current pointer-events-none"
              viewBox="0 0 12 12"
            >
              <path d="M12 0 v12 H0 a12 12 0 0 0 12-12Z" />
            </svg>
            <svg
              className="absolute -bottom-3 right-6 w-3 h-3 text-[#F4EFE6] fill-current pointer-events-none"
              viewBox="0 0 12 12"
            >
              <path d="M12 12 v-12 H0 a12 12 0 0 1 12 12Z" />
            </svg>
          </div>

          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200 z-20 shrink-0",
              isKnowledgeActive
                ? "text-[#FF5E38]"
                : "bg-[#252428] text-[#C4B5FD] group-hover:bg-transparent group-hover:text-[#FF5E38]"
            )}
          >
            <BookOpen className="w-4 h-4" />
          </div>
        </NavLink>

        {/* History Tab Button */}
        <NavLink
          to="/history"
          className="w-14 h-10 flex items-center justify-center cursor-pointer group relative"
          title="Riwayat Chat"
        >
          <div
            className={cn(
              "absolute left-2 top-1 bottom-1 right-[-24px] bg-[#F4EFE6] rounded-l-full transition-all duration-200 z-10 pointer-events-none",
              isHistoryActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          >
            <svg
              className="absolute -top-3 right-6 w-3 h-3 text-[#F4EFE6] fill-current pointer-events-none"
              viewBox="0 0 12 12"
            >
              <path d="M12 0 v12 H0 a12 12 0 0 0 12-12Z" />
            </svg>
            <svg
              className="absolute -bottom-3 right-6 w-3 h-3 text-[#F4EFE6] fill-current pointer-events-none"
              viewBox="0 0 12 12"
            >
              <path d="M12 12 v-12 H0 a12 12 0 0 1 12 12Z" />
            </svg>
          </div>

          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200 z-20 shrink-0",
              isHistoryActive
                ? "text-[#FF5E38]"
                : "bg-[#252428] text-[#C4B5FD] group-hover:bg-transparent group-hover:text-[#FF5E38]"
            )}
          >
            <History className="w-4 h-4" />
          </div>
        </NavLink>
      </div>

      {/* 3. Bottom Utility Vertical Pill - Exact 56px (w-14) width matching top & middle */}
      <div className="w-14 bg-[#1A191B] rounded-full py-4 flex flex-col items-center gap-3.5 shadow-lg mt-4 shrink-0 border border-stone-800/50 relative">
        {/* Settings Button */}
        <NavLink
          to="/settings"
          className="w-14 h-10 flex items-center justify-center cursor-pointer group relative"
          title="Pengaturan"
        >
          <div
            className={cn(
              "absolute left-2 top-1 bottom-1 right-[-24px] bg-[#F4EFE6] rounded-l-full transition-all duration-200 z-10 pointer-events-none",
              isSettingsActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          >
            <svg
              className="absolute -top-3 right-6 w-3 h-3 text-[#F4EFE6] fill-current pointer-events-none"
              viewBox="0 0 12 12"
            >
              <path d="M12 0 v12 H0 a12 12 0 0 0 12-12Z" />
            </svg>
            <svg
              className="absolute -bottom-3 right-6 w-3 h-3 text-[#F4EFE6] fill-current pointer-events-none"
              viewBox="0 0 12 12"
            >
              <path d="M12 12 v-12 H0 a12 12 0 0 1 12 12Z" />
            </svg>
          </div>

          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200 z-20 shrink-0",
              isSettingsActive
                ? "text-[#FF5E38]"
                : "bg-[#252428] text-[#C4B5FD] group-hover:bg-transparent group-hover:text-[#FF5E38]"
            )}
          >
            <Settings className="w-4 h-4" />
          </div>
        </NavLink>

        {/* Profile Button */}
        <NavLink
          to="/profile"
          className="w-14 h-10 flex items-center justify-center cursor-pointer group relative"
          title="Profil Pengguna"
        >
          <div
            className={cn(
              "absolute left-2 top-1 bottom-1 right-[-24px] bg-[#F4EFE6] rounded-l-full transition-all duration-200 z-10 pointer-events-none",
              isProfileActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          >
            <svg
              className="absolute -top-3 right-6 w-3 h-3 text-[#F4EFE6] fill-current pointer-events-none"
              viewBox="0 0 12 12"
            >
              <path d="M12 0 v12 H0 a12 12 0 0 0 12-12Z" />
            </svg>
            <svg
              className="absolute -bottom-3 right-6 w-3 h-3 text-[#F4EFE6] fill-current pointer-events-none"
              viewBox="0 0 12 12"
            >
              <path d="M12 12 v-12 H0 a12 12 0 0 1 12 12Z" />
            </svg>
          </div>

          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-200 z-20 shrink-0",
              isProfileActive
                ? "text-[#FF5E38]"
                : "bg-[#252428] text-[#C4B5FD] group-hover:bg-transparent group-hover:text-[#FF5E38]"
            )}
          >
            <User className="w-4 h-4" />
          </div>
        </NavLink>
      </div>
    </aside>
  );
}
