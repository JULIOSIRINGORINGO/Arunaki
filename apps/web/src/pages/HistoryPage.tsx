import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Search, MessageSquare, Loader2, Sparkles } from "lucide-react";
import { API_BASE, apiFetch } from "../lib/api";

interface ChatSession {
  id: string;
  title: string;
  mode?: string;
  createdAt: string;
  updatedAt?: string;
}

export function HistoryPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await apiFetch(`${API_BASE}/chat`);
        if (res.ok) {
          const json = await res.json();
          setSessions(json.data || []);
        }
      } catch (err) {
        console.error("Failed to fetch chat history:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchSessions();
  }, []);

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, searchQuery]);

  const groupedSessions = useMemo(() => {
    const today: ChatSession[] = [];
    const yesterday: ChatSession[] = [];
    const older: ChatSession[] = [];

    const now = new Date();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayDate = todayDate - 86400000;

    for (const session of filteredSessions) {
      const time = new Date(session.createdAt || session.updatedAt || "").getTime();
      if (isNaN(time) || time >= todayDate) {
        today.push(session);
      } else if (time >= yesterdayDate) {
        yesterday.push(session);
      } else {
        older.push(session);
      }
    }

    const groups: Array<{ group: string; items: ChatSession[] }> = [];
    if (today.length > 0) groups.push({ group: "Hari Ini", items: today });
    if (yesterday.length > 0) groups.push({ group: "Kemarin", items: yesterday });
    if (older.length > 0) groups.push({ group: "Sebelumnya", items: older });
    return groups;
  }, [filteredSessions]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0A0A0A] text-[#FFFFFF] p-8 max-w-2xl mx-auto overflow-y-auto select-none">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-white tracking-tight">
          Riwayat Percakapan AI
        </h1>
        <p className="text-xs text-[#A3A3A3] mt-0.5">
          Lihat dan lanjutkan percakapan serta sesi workspace sebelumnya
        </p>
      </div>

      <div className="relative mb-6">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737373]"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari riwayat percakapan..."
          className="w-full pl-9 pr-3 py-2 bg-[#171717] border border-[#2D2D2D] rounded-xl text-xs text-white placeholder-[#737373] focus:outline-none focus:border-[#525252]"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-[#A3A3A3] gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">Memuat riwayat...</span>
        </div>
      ) : groupedSessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-10 h-10 rounded-full bg-[#1E1E1E] flex items-center justify-center mb-3">
            <Sparkles className="w-5 h-5 text-[#737373]" />
          </div>
          <p className="text-xs font-medium text-white mb-1">Belum Ada Riwayat Percakapan</p>
          <p className="text-[11px] text-[#737373] max-w-[240px]">
            Percakapan dan instruksi agen Anda akan otomatis tersimpan di sini.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedSessions.map((group) => (
            <div key={group.group} className="space-y-2">
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#A3A3A3] tracking-wide">
                  <Clock size={11} />
                  {group.group}
                </div>
                <div className="flex-1 h-px bg-[#2D2D2D]" />
              </div>

              <div className="space-y-2">
                {group.items.map((item) => {
                  const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                  return (
                    <div
                      key={item.id}
                      onClick={() => navigate(`/?chatId=${item.id}`)}
                      className="flex items-center justify-between p-3 rounded-xl bg-[#171717] border border-[#2D2D2D] hover:border-[#525252] hover:bg-[#1E1E1E] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-3">
                        <MessageSquare size={14} className="text-[#A3A3A3] shrink-0" />
                        <span className="text-xs text-white font-medium truncate">{item.title || "Percakapan Workspace"}</span>
                      </div>
                      <span className="text-[10px] text-[#737373] font-mono shrink-0">{dateStr}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
