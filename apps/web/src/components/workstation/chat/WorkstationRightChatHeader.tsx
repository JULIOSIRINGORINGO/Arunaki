import { memo, useState, useEffect, type KeyboardEvent, type FocusEvent } from "react";
import { Bot, Plus, PanelRightClose } from "lucide-react";

interface WorkstationRightChatHeaderProps {
  activeChatId?: string;
  onNewChat?: () => void;
  onClose: () => void;
}

export const WorkstationRightChatHeader = memo(function WorkstationRightChatHeader({
  activeChatId,
  onNewChat,
  onClose,
}: WorkstationRightChatHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [chatTitle, setChatTitle] = useState("Chat");

  useEffect(() => {
    if (activeChatId) {
      const saved = localStorage.getItem(`arunaki_chat_name_${activeChatId}`);
      setChatTitle(saved || "Chat");
    } else {
      setChatTitle("New Chat");
    }
  }, [activeChatId]);

  const handleTitleSubmit = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  const handleTitleBlur = (e: FocusEvent<HTMLInputElement>) => {
    const newTitle = e.target.value.trim() || "Chat";
    setChatTitle(newTitle);
    setIsEditingTitle(false);
    if (activeChatId) {
      localStorage.setItem(`arunaki_chat_name_${activeChatId}`, newTitle);
    }
  };

  return (
    <div className="h-9 px-3 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-panel)] shrink-0 select-none">
      <div className="flex items-center gap-2 flex-1 min-w-0 pr-4">
        <Bot className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
        {isEditingTitle ? (
          <input
            type="text"
            defaultValue={chatTitle === "Chat" || chatTitle === "New Chat" ? "" : chatTitle}
            placeholder="Session Name..."
            autoFocus
            onKeyDown={handleTitleSubmit}
            onBlur={handleTitleBlur}
            className="bg-transparent border-none outline-none text-xs font-semibold text-[var(--text-primary)] w-full focus:ring-1 focus:ring-[var(--border-strong)] rounded px-1 -ml-1 transition-all placeholder-[var(--text-dim)]"
          />
        ) : (
          <span
            onClick={() => setIsEditingTitle(true)}
            className="text-xs font-semibold text-[var(--text-primary)] truncate cursor-pointer hover:bg-[var(--bg-hover)] px-1 py-0.5 -ml-1 rounded transition-colors"
            title="Click to rename session"
          >
            {chatTitle}
          </span>
        )}
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        {onNewChat && (
          <button
            type="button"
            onClick={onNewChat}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            title="New Chat Session"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          title="Close Panel"
        >
          <PanelRightClose className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
});
