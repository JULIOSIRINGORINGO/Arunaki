import { useState } from "react";
import { NavLink, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Folder,
  MessageSquare,
  MoreVertical,
  Settings,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { cn } from "../../lib/utils";

const API_BASE = "http://localhost:3000/api/v1";

interface Chat {
  id: string;
  title: string | null;
  mode: string;
  createdAt: string;
}

const PROFESSIONAL_SAMPLE_CHATS: Chat[] = [
  { id: "sample-1", title: "Analisis Laporan Keuangan FY2024", mode: "chat", createdAt: new Date().toISOString() },
  { id: "sample-2", title: "Draf Perjanjian Kerjasama PT ABC", mode: "chat", createdAt: new Date().toISOString() },
  { id: "sample-3", title: "Evaluasi Matriks Riset Pasar Q2", mode: "chat", createdAt: new Date().toISOString() },
  { id: "sample-4", title: "Rekapitulasi Invoice & Vendor 2026", mode: "chat", createdAt: new Date().toISOString() },
  { id: "sample-5", title: "Strategi Operasional & Rekap KPI", mode: "chat", createdAt: new Date().toISOString() },
];

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile menu toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 p-2.5 rounded-xl bg-white border border-gray-200 shadow-sm text-gray-700 hover:bg-gray-50 transition-colors lg:hidden"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col h-screen w-[260px] min-w-[260px] max-w-[260px] bg-[#F8F9FA] border-r border-gray-200/80 shrink-0"
        style={{ backgroundColor: "#F8F9FA", width: "260px" }}
      >
        <SidebarContent onClose={() => setMobileOpen(false)} />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="fixed inset-y-0 left-0 z-50 flex flex-col h-full w-[260px] bg-[#F8F9FA] border-r border-gray-200 lg:hidden shadow-2xl"
            style={{ backgroundColor: "#F8F9FA", width: "260px" }}
          >
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </aside>
        </>
      )}
    </>
  );
}

function SidebarContent({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentChatId = searchParams.get("chat");
  const queryClient = useQueryClient();

  const { data: fetchedChats = [] } = useQuery<Chat[]>({
    queryKey: ["chats"],
    queryFn: async () => {
      try {
        const res = await fetch(`${API_BASE}/chat`);
        const data = await res.json();
        return data.data || [];
      } catch (e) {
        return [];
      }
    },
  });

  const displayChats = fetchedChats.length > 0 ? fetchedChats : PROFESSIONAL_SAMPLE_CHATS;

  const createChat = useMutation({
    mutationFn: async () => {
      try {
        const res = await fetch(`${API_BASE}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "chat" }),
        });
        const data = await res.json();
        return data.data.id;
      } catch (e) {
        return `chat-${Date.now()}`;
      }
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      navigate(`/?chat=${id}`);
      onClose();
    },
  });

  return (
    <div className="flex flex-col h-full w-full justify-between">
      {/* Top area */}
      <div className="flex flex-col min-h-0 flex-1">
        {/* Mobile close button */}
        <div className="flex items-center justify-end p-3 lg:hidden">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Top Brand Logo with Text */}
        <div className="px-5 pt-6 pb-5 flex items-center gap-3">
          <img
            src="/logo.svg"
            alt="Arunaki Logo"
            className="h-7 w-auto object-contain text-black"
            style={{ height: "28px" }}
          />
          <span className="text-lg font-bold text-gray-900 tracking-tight">Arunaki</span>
        </div>

        {/* Action Buttons */}
        <div className="px-3.5 space-y-2">
          {/* Chat Baru Button - Filled Black Button */}
          <button
            onClick={() => {
              createChat.mutate();
            }}
            disabled={createChat.isPending}
            className={cn(
              "flex items-center justify-center gap-2.5 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer shadow-xs",
              "bg-black text-white hover:bg-gray-800 active:scale-[0.99]",
              createChat.isPending && "opacity-60 cursor-not-allowed"
            )}
          >
            <Plus className="w-4 h-4 text-white shrink-0" />
            <span>Chat Baru</span>
          </button>

          {/* Workspace Nav Link */}
          <NavLink
            to="/workspace"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer border",
                isActive
                  ? "bg-gray-200/80 border-gray-300/40 text-gray-900 font-semibold"
                  : "border-transparent text-gray-700 hover:bg-gray-200/50"
              )
            }
          >
            <Folder className="w-4 h-4 text-gray-700 shrink-0" />
            <span>Workspace</span>
          </NavLink>
        </div>

        {/* Horizontal Divider */}
        <div className="px-3.5 my-3">
          <div className="border-t border-gray-200/80" />
        </div>

        {/* Recent Chats Section Header */}
        <div className="px-5 pb-2 pt-1">
          <p className="text-xs font-semibold text-gray-400">Riwayat Chat</p>
        </div>

        {/* Chat List Scrollable */}
        <div className="flex-1 overflow-y-auto px-3.5 space-y-1 min-h-0">
          {displayChats.map((chat) => {
            const isActive = currentChatId === chat.id;
            return (
              <NavLink
                key={chat.id}
                to={`/?chat=${chat.id}`}
                onClick={onClose}
                className={cn(
                  "group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all duration-150 cursor-pointer border",
                  isActive
                    ? "bg-white border-gray-200/90 shadow-2xs text-gray-900 font-semibold"
                    : "border-transparent text-gray-700 hover:bg-gray-200/50"
                )}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <MessageSquare className="w-4 h-4 text-gray-600 shrink-0" />
                  <span className="truncate text-sm">{chat.title || "Chat Baru"}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className="p-1 rounded-md text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Bottom Footer Section */}
      <div className="px-3.5 pb-4 pt-2 border-t border-gray-200/80 shrink-0">
        <NavLink
          to="/settings"
          onClick={onClose}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 mb-1 cursor-pointer border",
              isActive
                ? "bg-white border-gray-200/90 shadow-2xs text-gray-900 font-semibold"
                : "border-transparent text-gray-700 hover:bg-gray-200/50"
            )
          }
        >
          <Settings className="w-4 h-4 text-gray-700 shrink-0" />
          <span>Pengaturan</span>
        </NavLink>

        <div className="border-t border-gray-200/80 my-2" />

        {/* User Profile Card */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-gray-200/50 cursor-pointer transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gray-300/80 text-gray-700 font-bold text-xs flex items-center justify-center shrink-0">
              J
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-gray-900 truncate leading-tight">
                Julio Siringoringo
              </span>
              <span className="text-xs text-gray-500 font-normal">
                Premium
              </span>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
        </div>
      </div>
    </div>
  );
}
