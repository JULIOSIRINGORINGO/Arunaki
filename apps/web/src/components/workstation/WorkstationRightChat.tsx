import { RefObject, useRef, useLayoutEffect, useState, useEffect, useMemo, useCallback } from "react";
import Markdown from "react-markdown";
import { Bot, PanelRightClose, PanelRightOpen, Sparkles, Paperclip, Send, Loader2, BookOpen, Search, Calculator, FileText, FilePlus, FileSearch, Eraser } from "lucide-react";
import { LiveExecutionBadge, LiveStatusData } from "../chat/LiveExecutionBadge";
import { LiveMirrorCard } from "../chat/LiveMirrorCard";
import { cn } from "../../lib/utils";

const COMMANDS = [
  { name: "/new-section", description: "Create a new document section", icon: FilePlus },
  { name: "/search-section", description: "Search within a document section", icon: FileSearch },
  { name: "/knowledge", description: "Create new Knowledge Base", icon: BookOpen },
  { name: "/search", description: "Search documents or knowledge", icon: Search },
  { name: "/calculate", description: "Calculate prices/totals", icon: Calculator },
  { name: "/export", description: "Export to PDF/Excel/Word", icon: FileText },
  { name: "/clear", description: "Clear the current conversation", icon: Eraser },
];

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

interface Workspace {
  id: string;
  name: string;
}

interface WorkspaceFile {
  name: string;
  path?: string;
}

interface WorkstationRightChatProps {
  collapsed: boolean;
  onClose: () => void;
  chatMessages: Message[];
  optimisticMessages: Message[];
  liveStatus: LiveStatusData | null;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  activeWorkspace: Workspace | null;
  inputPrompt: string;
  setInputPrompt: (val: string) => void;
  isStreaming: boolean;
  onSendMessage: () => void;
  width?: number;
  files?: WorkspaceFile[];
}

export function WorkstationRightChat({
  collapsed,
  onClose,
  chatMessages,
  optimisticMessages,
  liveStatus,
  messagesEndRef,
  activeWorkspace,
  inputPrompt,
  setInputPrompt,
  isStreaming,
  onSendMessage,
  width,
  files = [],
}: WorkstationRightChatProps) {
  /* Thin Icon Strip when Collapsed (Clicking re-opens the panel) */
  if (collapsed) {
    return (
      <aside className="w-10 bg-[#121212] border-l border-border-strong flex flex-col items-center py-2 shrink-0 select-none">
        <button
          onClick={onClose}
          className="text-[#A3A3A3] hover:text-white p-1.5 rounded-md hover:bg-[#1E1E1E] transition-colors cursor-pointer"
          title="Open Chat Panel"
        >
          <PanelRightOpen className="w-4 h-4 text-[#FFFFFF]" />
        </button>
        <div className="mt-4 flex flex-col items-center gap-4 text-[#A3A3A3]">
          <Bot className="w-4 h-4 opacity-40" />
        </div>
      </aside>
    );
  }

  const allMessages = [...chatMessages, ...optimisticMessages];
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [inputPrompt]);

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [showCommands, setShowCommands] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState(COMMANDS);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const inputWrapperRef = useRef<HTMLDivElement>(null);

  const mentionResults = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return files.map((f) => f.name).filter((n) => n.toLowerCase().includes(q)).slice(0, 12);
  }, [mentionQuery, files]);

  useEffect(() => setMentionIndex(0), [mentionResults.length, mentionQuery]);

  useEffect(() => {
    if (inputPrompt.startsWith("/")) {
      const query = inputPrompt.toLowerCase();
      const filtered = COMMANDS.filter(
        (cmd) =>
          cmd.name.toLowerCase().includes(query) ||
          cmd.description.toLowerCase().includes(query)
      );
      setFilteredCommands(filtered);
      setShowCommands(filtered.length > 0);
      setSelectedCommandIndex(0);
    } else {
      setShowCommands(false);
    }
  }, [inputPrompt]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputWrapperRef.current &&
        !inputWrapperRef.current.contains(event.target as Node)
      ) {
        setShowCommands(false);
        setMentionQuery(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = useCallback(
    (value: string) => {
      setInputPrompt(value);
      const atIndex = value.lastIndexOf("@");
      if (atIndex !== -1) {
        const query = value.slice(atIndex + 1);
        if (/^[\w.\- ]*$/.test(query)) {
          setMentionQuery(query);
          setShowCommands(false);
          return;
        }
      }
      setMentionQuery(null);
    },
    [setInputPrompt]
  );

  const insertMention = useCallback(
    (fileName: string) => {
      if (mentionQuery === null) return;
      const atIndex = inputPrompt.lastIndexOf("@");
      const before = inputPrompt.slice(0, atIndex);
      const next = `${before}@${fileName} `;
      setInputPrompt(next);
      setMentionQuery(null);
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        const len = next.length;
        textareaRef.current?.setSelectionRange(len, len);
      });
    },
    [mentionQuery, inputPrompt, setInputPrompt]
  );

  const handleCommandSelect = useCallback(
    (command: string) => {
      setInputPrompt(command + " ");
      setShowCommands(false);
      textareaRef.current?.focus();
    },
    [setInputPrompt]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionQuery !== null && mentionResults.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionResults.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + mentionResults.length) % mentionResults.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mentionResults[mentionIndex]);
      } else if (e.key === "Escape") {
        setMentionQuery(null);
      }
    } else if (showCommands) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedCommandIndex((prev) => (prev < filteredCommands.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedCommandIndex((prev) => (prev > 0 ? prev - 1 : filteredCommands.length - 1));
      } else if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        handleCommandSelect(filteredCommands[selectedCommandIndex].name);
      } else if (e.key === "Escape") {
        setShowCommands(false);
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  return (
    <aside className="bg-[#121212] text-[#FFFFFF] border-l border-border-strong flex flex-col shrink-0" style={{ width }}>
      <div className="h-9 px-3 box-border border-b border-border-strong flex items-center justify-between shrink-0">
        <span className="text-xs font-semibold text-[#E5E5E5] flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-[#A3A3A3]" />
          Chat
        </span>
        <button
          onClick={onClose}
          className="text-[#A3A3A3] hover:text-white p-1 rounded-md hover:bg-[#1E1E1E] transition-colors cursor-pointer"
          title="Close Chat Panel"
        >
          <PanelRightClose className="w-4 h-4" />
        </button>
      </div>

      {/* Chat Stream Messages */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3">
        {allMessages.length === 0 ? (
          <div className="flex flex-col items-center text-center">
            <Sparkles className="w-5 h-5 text-[#E5E5E5] mx-auto mb-2" />
            <p className="serif-italic text-[20px] text-white leading-snug">
              Working Automation<br />with Arunaki
            </p>
          </div>
        ) : (
          allMessages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex flex-col gap-1 text-xs",
                msg.role === "user" ? "items-end" : "items-start"
              )}
            >
              <div
                className={cn(
                  "p-3 rounded-xl max-w-[90%] leading-relaxed border",
                  msg.role === "user"
                    ? "bg-[#262626] text-white border-border-strong rounded-tr-none"
                    : "bg-[#1E1E1E] text-[#E5E5E5] border-border-strong rounded-tl-none"
                )}
              >
                <Markdown>{msg.content}</Markdown>
              </div>
            </div>
          ))
        )}

        {/* Live Execution Status Badge */}
        {liveStatus && <LiveExecutionBadge status={liveStatus} />}
        {liveStatus?.screenshot && (
          <LiveMirrorCard screenshotUrl={liveStatus.screenshot} title="Live Desktop Execution" />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Capsule Chat Input Box */}
      <div className="p-3 border-t border-border-strong bg-[#121212]">
        <div ref={inputWrapperRef} className="bg-[#1E1E1E] rounded-xl p-2.5 border border-border-strong focus-within:border-border-strong transition-colors relative">
          {mentionQuery !== null && (
            <div className="absolute bottom-full left-0 right-0 mb-2 z-50 bg-[#1E1E1E] border border-border-strong rounded-xl shadow-2xl overflow-hidden">
              <div className="px-3 py-1.5 text-[10px] font-bold text-[#A3A3A3] bg-[#262626] border-b border-border-strong">
                Select file to attach
              </div>
              {mentionResults.length === 0 ? (
                <div className="px-3 py-2.5 text-[11px] text-[#777777]">No matching files</div>
              ) : (
                <div className="max-h-44 overflow-y-auto">
                  {mentionResults.map((name, i) => (
                    <button
                      key={name}
                      type="button"
                      onMouseEnter={() => setMentionIndex(i)}
                      onClick={() => insertMention(name)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-[11px] font-medium truncate cursor-pointer transition-colors flex items-center gap-1.5",
                        i === mentionIndex ? "bg-[#262626] text-white" : "text-[#E5E5E5] hover:bg-[#1E1E1E]"
                      )}
                    >
                      <FileText className="w-3.5 h-3.5 shrink-0 text-[#A3A3A3]" />
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {showCommands && filteredCommands.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-2 z-50 bg-[#1E1E1E] border border-border-strong rounded-xl shadow-2xl overflow-hidden">
              <div className="px-3 py-1.5 text-[10px] font-bold text-[#A3A3A3] bg-[#262626] border-b border-border-strong">
                Slash Commands
              </div>
              <div className="max-h-64 overflow-y-auto">
                {filteredCommands.map((command, index) => {
                  const Icon = command.icon;
                  return (
                    <button
                      key={command.name}
                      type="button"
                      onClick={() => handleCommandSelect(command.name)}
                      onMouseEnter={() => setSelectedCommandIndex(index)}
                      className={cn(
                        "w-full px-3 py-2 flex items-center gap-2 transition-colors cursor-pointer",
                        index === selectedCommandIndex ? "bg-[#262626]" : "hover:bg-[#262626]"
                      )}
                    >
                      <Icon size={14} className="text-[#A3A3A3] shrink-0" />
                      <span className="text-xs font-medium text-white">{command.name}</span>
                      <span className="text-[10px] text-[#777777] truncate">{command.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={inputPrompt}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              activeWorkspace
                ? "ask anyting @ to mantion and. / for actions"
                : "ask anyting @ to mantion and. / for actions"
            }
            rows={1}
            className="w-full bg-transparent text-xs text-[#FFFFFF] placeholder-[#777777] resize-none overflow-y-auto no-scrollbar focus:outline-none"
          />

          <div className="flex items-center justify-between pt-1 border-t border-border-strong mt-1">
            <div className="flex items-center gap-2">
              <button className="text-[#A3A3A3] hover:text-white p-1 rounded transition-colors cursor-pointer">
                <Paperclip className="w-3.5 h-3.5" />
              </button>
              {activeWorkspace && (
                <span className="text-[10px] bg-[#262626] text-[#E5E5E5] px-2 py-0.5 rounded-full font-medium border border-border-strong">
                  Workspace Agent
                </span>
              )}
            </div>

            <button
              onClick={onSendMessage}
              disabled={!inputPrompt.trim() || isStreaming}
              className="w-7 h-7 bg-white hover:bg-[#E5E5E5] disabled:opacity-30 text-black rounded-full flex items-center justify-center transition-colors cursor-pointer"
            >
              {isStreaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
