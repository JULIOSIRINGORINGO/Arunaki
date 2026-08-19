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
    if (today.length > 0) groups.push({ group: "Today", items: today });
    if (yesterday.length > 0) groups.push({ group: "Yesterday", items: yesterday });
    if (older.length > 0) groups.push({ group: "Previous", items: older });
    return groups;
  }, [filteredSessions]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-app)] text-[var(--text-primary)] p-8 max-w-2xl mx-auto overflow-y-auto select-none transition-colors duration-150">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
          Chat History
        </h1>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          View and resume previous conversations and workspace sessions
        </p>
      </div>

      <div className="relative mb-6">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search chat history..."
          className="w-full pl-9 pr-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-primary)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--border-strong)] font-sans"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-[var(--text-muted)] gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">Loading history...</span>
        </div>
      ) : groupedSessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-10 h-10 rounded-full bg-[var(--bg-hover)] flex items-center justify-center mb-3 border border-[var(--border-color)]">
            <Sparkles className="w-5 h-5 text-[var(--text-muted)]" />
          </div>
          <p className="text-xs font-medium text-[var(--text-primary)] mb-1">No Chat History Yet</p>
          <p className="text-[11px] text-[var(--text-muted)] max-w-[240px]">
            Your conversations and workspace interactions will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedSessions.map((group) => (
            <div key={group.group} className="space-y-2">
              <h2 className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider px-1">
                {group.group}
              </h2>
              <div className="space-y-1.5">
                {group.items.map((session) => {
                  const dateStr = session.createdAt
                    ? new Date(session.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "";
                  return (
                    <div
                      key={session.id}
                      onClick={() => navigate(`/?chatId=${session.id}`)}
                      className="group flex items-center justify-between p-3.5 bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] hover:border-[var(--border-strong)] rounded-xl cursor-pointer transition-all duration-150"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[var(--bg-hover)] flex items-center justify-center shrink-0 border border-[var(--border-color)]">
                          <MessageSquare className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                            {session.title || "Untitled Conversation"}
                          </p>
                          <p className="text-[11px] text-[var(--text-dim)] flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>{dateStr || "Just now"}</span>
                          </p>
                        </div>
                      </div>
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
