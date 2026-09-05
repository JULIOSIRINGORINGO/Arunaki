import { memo } from "react";
import { MessageSquare, Clock } from "lucide-react";
import { ChatSession } from "./historyUtils";

interface HistorySessionItemProps {
  session: ChatSession;
  onClick: () => void;
}

export const HistorySessionItem = memo(function HistorySessionItem({
  session,
  onClick,
}: HistorySessionItemProps) {
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
      onClick={onClick}
      className="group flex items-center justify-between p-3.5 bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)] hover:border-[var(--border-strong)] rounded-xl cursor-pointer transition-all duration-150"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-[var(--bg-hover)] flex items-center justify-center shrink-0 border border-[var(--border-color)]">
          <MessageSquare
            className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors"
            strokeWidth={1.5}
          />
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
});
