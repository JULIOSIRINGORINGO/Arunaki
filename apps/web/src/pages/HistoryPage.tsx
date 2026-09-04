import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Search, MessageSquare, Loader2, Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import { listSessions } from "../lib/engine";

interface ChatSession {
  id: string;
  title: string;
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
        const raw = await listSessions({ limit: 50 });
        setSessions(
          (raw || []).map((s: any) => ({
            id: s.id,
            title: s.title || "",
            createdAt: s.time?.created || "",
            updatedAt: s.time?.updated || s.time?.created || "",
          }))
        );
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

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const groupedSessions = useMemo(() => {
    const today: ChatSession[] = [];
    const thisWeek: ChatSession[] = [];
    const thisMonth: ChatSession[] = [];
    const older: ChatSession[] = [];

    const now = new Date();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekDate = todayDate - 7 * 86400000;
    const monthDate = todayDate - 30 * 86400000;

    for (const session of filteredSessions) {
      const time = new Date(session.createdAt || session.updatedAt || "").getTime();
      if (isNaN(time) || time >= todayDate) {
        today.push(session);
      } else if (time >= weekDate) {
        thisWeek.push(session);
      } else if (time >= monthDate) {
        thisMonth.push(session);
      } else {
        older.push(session);
      }
    }

    const groups: Array<{ group: string; items: ChatSession[] }> = [];
    if (today.length > 0) groups.push({ group: "Today", items: today });
    if (thisWeek.length > 0) groups.push({ group: "This Week", items: thisWeek });
    if (thisMonth.length > 0) groups.push({ group: "This Month", items: thisMonth });
    if (older.length > 0) groups.push({ group: "Older", items: older });
    return groups;
  }, [filteredSessions]);

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden select-none transition-colors duration-150">
      {/* Sticky Top Header & Search */}
      <div className="w-full max-w-4xl mx-auto px-8 pt-8 pb-4 shrink-0">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
            Chat History
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            View and resume previous conversations and sessions
          </p>
        </div>

        <div className="relative">
          <Search
            size={14}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)]"
            strokeWidth={1.5}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chat history..."
            className="w-full pl-9 pr-3.5 py-2.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--border-strong)] font-sans transition-colors"
          />
        </div>
      </div>

      {/* Scrollable History List */}
      <div className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto px-8 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[var(--text-muted)] gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Loading history...</span>
          </div>
        ) : groupedSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-10 h-10 rounded-full bg-[var(--bg-hover)] flex items-center justify-center mb-3 border border-[var(--border-color)]">
              <Sparkles className="w-5 h-5 text-[var(--text-muted)]" strokeWidth={1.5} />
            </div>
            <p className="text-xs font-medium text-[var(--text-primary)] mb-1">No Chat History Yet</p>
            <p className="text-[11px] text-[var(--text-muted)] max-w-[260px]">
              Your conversations and project folder sessions will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-6 pt-2">
            {groupedSessions.map((group) => {
              const isCollapsed = collapsedGroups[group.group];
              return (
                <div key={group.group} className="space-y-2">
                  <button
                    onClick={() => toggleGroup(group.group)}
                    className="flex items-center gap-1.5 px-1 cursor-pointer group/header w-full text-left"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover/header:text-[var(--text-primary)] transition-colors" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover/header:text-[var(--text-primary)] transition-colors" />
                    )}
                    <h2 className="text-[11px] font-semibold text-[var(--text-dim)] tracking-wider">
                      {group.group}
                    </h2>
                  </button>
                  
                  {!isCollapsed && (
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
                                <MessageSquare className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" strokeWidth={1.5} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                                  {session.title || "Untitled Conversation"}
                                </p>
                                <p className="text-[11px] text-[var(--text-dim)] flex items-center gap-1 mt-0.5">
                                  <Clock className="w-3 h-3" strokeWidth={1.5} />
                                  <span>{dateStr || "Just now"}</span>
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
