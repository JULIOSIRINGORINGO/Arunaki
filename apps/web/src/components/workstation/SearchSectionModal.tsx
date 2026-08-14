import { useState, useEffect } from "react";
import { Search, MessageSquare, Clock, X, Bot } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { API_BASE, apiFetch } from "../../lib/api";
import { cn } from "../../lib/utils";

interface ChatSession {
  id: string;
  title: string | null;
  mode: string;
  workspaceId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SearchSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSession: (chatId: string) => void;
  workspaceId?: string | null;
}

export function SearchSectionModal({
  isOpen,
  onClose,
  onSelectSession,
  workspaceId,
}: SearchSectionModalProps) {
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const { data: sessions = [], isLoading } = useQuery<ChatSession[]>({
    queryKey: ["chat-sessions-search-section", workspaceId],
    queryFn: async () => {
      const url = workspaceId
        ? `${API_BASE}/chat/workspace/${workspaceId}`
        : `${API_BASE}/chat`;
      const response = await apiFetch(url);
      const json = await response.json();
      return json.data || [];
    },
    enabled: isOpen,
  });

  if (!isOpen) return null;

  const filteredSessions = sessions.filter((s) => {
    const title = s.title || "Percakapan Baru";
    return title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-lg bg-[#141414] border border-[#27272A] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header Search Bar */}
        <div className="p-3.5 border-b border-[#27272A] flex items-center gap-3 bg-[#18181B]">
          <Search className="w-4 h-4 text-[#A1A1AA] shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari sesi chat atau topik dokumen..."
            autoFocus
            className="w-full bg-transparent text-sm text-white placeholder-[#71717A] focus:outline-none font-sans"
          />
          <button
            onClick={onClose}
            className="text-[#71717A] hover:text-white p-1 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-[#71717A]">
              Memuat sesi chat...
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#71717A]">
              Tidak ada sesi chat yang ditemukan
            </div>
          ) : (
            filteredSessions.map((session) => {
              const displayTitle = session.title || "Percakapan Baru";
              const isWorkspace = session.mode === "workspace";
              const dateStr = session.updatedAt
                ? new Date(session.updatedAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "";

              return (
                <button
                  key={session.id}
                  onClick={() => {
                    onSelectSession(session.id);
                    onClose();
                  }}
                  className="w-full text-left p-3 rounded-xl hover:bg-[#27272A]/60 transition-colors flex items-center justify-between group cursor-pointer border border-transparent hover:border-[#3F3F46]"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="w-8 h-8 rounded-lg bg-[#27272A] flex items-center justify-center shrink-0 group-hover:bg-[#3F3F46] transition-colors">
                      {isWorkspace ? (
                        <Bot className="w-4 h-4 text-[#38BDF8]" />
                      ) : (
                        <MessageSquare className="w-4 h-4 text-[#A1A1AA]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate group-hover:text-[#38BDF8] transition-colors">
                        {displayTitle}
                      </p>
                      <p className="text-[10px] text-[#71717A] flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{dateStr}</span>
                      </p>
                    </div>
                  </div>

                  <span
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-mono shrink-0 border",
                      isWorkspace
                        ? "bg-[#0284C7]/10 text-[#38BDF8] border-[#0284C7]/30"
                        : "bg-[#27272A] text-[#A1A1AA] border-[#3F3F46]"
                    )}
                  >
                    {isWorkspace ? "Workspace" : "Chat"}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 border-t border-[#27272A] bg-[#18181B] flex items-center justify-between text-[11px] text-[#71717A]">
          <span>Pilih sesi chat untuk membuka ulang</span>
          <span className="font-mono text-[10px] bg-[#27272A] text-[#A1A1AA] px-1.5 py-0.5 rounded">
            ESC untuk tutup
          </span>
        </div>
      </div>
    </div>
  );
}
