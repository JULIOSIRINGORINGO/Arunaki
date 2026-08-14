import { RefObject, useRef, useLayoutEffect, useState, useMemo, memo } from "react";
import Markdown from "react-markdown";
import { Bot, PanelRightClose, PanelRightOpen, Sparkles, Paperclip, Send, BookOpen, Search, Calculator, FileText, FilePlus, FileSearch, Eraser, Clock, X } from "lucide-react";
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
  rootPath: string | null;
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
  width?: number | string;
  files?: WorkspaceFile[];
  queuedPrompts?: string[];
  onRemoveQueuedPrompt?: (index: number) => void;
  onSearchSection?: () => void;
}

function WorkstationRightChatComponent({
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
  queuedPrompts = [],
  onRemoveQueuedPrompt,
  onSearchSection,
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

  const allMessages = useMemo(() => {
    if (optimisticMessages.length === 0) return chatMessages;
    if (chatMessages.length === 0) return optimisticMessages;

    const dbIds = new Set(chatMessages.map((m) => m.id));
    const dbKeys = new Set(chatMessages.map((m) => `${m.role}:${m.content.trim()}`));

    const uniqueOptimistic = optimisticMessages.filter((m) => {
      if (m.id && dbIds.has(m.id)) return false;
      if (m.content.trim() && dbKeys.has(`${m.role}:${m.content.trim()}`)) return false;
      return true;
    });

    return [...chatMessages, ...uniqueOptimistic];
  }, [chatMessages, optimisticMessages]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showCommands, setShowCommands] = useState(false);
  const [commandFilter, setCommandFilter] = useState("");
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);

  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);

  const filteredCommands = useMemo(() => {
    if (!commandFilter) return COMMANDS;
    return COMMANDS.filter((cmd) => cmd.name.toLowerCase().includes(commandFilter.toLowerCase()));
  }, [commandFilter]);

  const mentionResults = useMemo(() => {
    const names = files.map((f) => f.name).filter(Boolean);
    if (!mentionFilter) return names.slice(0, 8);
    return names
      .filter((n) => n.toLowerCase().includes(mentionFilter.toLowerCase()))
      .slice(0, 8);
  }, [files, mentionFilter]);

  useLayoutEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputPrompt]);

  const handleInputChange = (val: string) => {
    setInputPrompt(val);

    const mentionMatch = val.match(/@(\w*)$/);
    if (mentionMatch) {
      setShowMentions(true);
      setMentionFilter(mentionMatch[1]);
      setMentionIndex(0);
    } else {
      setShowMentions(false);
    }

    if (val.startsWith("/")) {
      setShowCommands(true);
      setCommandFilter(val);
      setSelectedCommandIndex(0);
    } else {
      setShowCommands(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && mentionResults.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % mentionResults.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + mentionResults.length) % mentionResults.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mentionResults[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        setShowMentions(false);
        return;
      }
    }

    if (showCommands && filteredCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedCommandIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedCommandIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        handleCommandSelect(filteredCommands[selectedCommandIndex].name);
        return;
      }
      if (e.key === "Escape") {
        setShowCommands(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  const insertMention = (filename: string) => {
    const updated = inputPrompt.replace(/@\w*$/, `@${filename} `);
    setInputPrompt(updated);
    setShowMentions(false);
    if (textareaRef.current) textareaRef.current.focus();
  };

  const handleCommandSelect = (cmdName: string) => {
    if (cmdName === "/search-section") {
      setInputPrompt("");
      setShowCommands(false);
      onSearchSection?.();
      return;
    }
    setInputPrompt(`${cmdName} `);
    setShowCommands(false);
    if (textareaRef.current) textareaRef.current.focus();
  };

  return (
    <aside
      className="bg-[#121212] border-l border-border-strong flex flex-col h-full shrink-0 select-text overflow-hidden"
      style={{ width: width || 320 }}
    >
      {/* Panel Header */}
      <div className="h-9 px-3 border-b border-border-strong flex items-center justify-between bg-[#121212] shrink-0 select-none">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-[#A3A3A3]" />
          <span className="text-xs font-semibold text-[#FFFFFF]">Chat</span>
        </div>
        <button
          onClick={onClose}
          className="text-[#A3A3A3] hover:text-white p-1 rounded hover:bg-[#1E1E1E] transition-colors cursor-pointer"
          title="Close Panel"
        >
          <PanelRightClose className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages List Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 font-sans text-xs">
        {allMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 select-none">
            <div className="w-10 h-10 rounded-full bg-[#1E1E1E] flex items-center justify-center mb-3">
              <Sparkles className="w-5 h-5 text-[#A3A3A3]" />
            </div>
            <p className="text-xs font-medium text-white mb-1">Workspace Agent</p>
            <p className="text-[11px] text-[#A3A3A3] max-w-[200px]">
              Tanyakan sesuatu atau berikan instruksi dokumen.
            </p>
          </div>
        ) : (
          allMessages.map((msg, idx) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id || idx}
                className={cn(
                  "flex flex-col gap-1 max-w-[92%]",
                  isUser ? "ml-auto items-end" : "mr-auto items-start"
                )}
              >
                <div
                  className={cn(
                    "p-3 rounded-2xl text-xs leading-relaxed overflow-hidden break-words font-sans",
                    isUser
                      ? "bg-[#262626] text-white rounded-br-xs border border-[#333333]"
                      : "bg-[#18181B] text-[#E4E4E7] rounded-bl-xs border border-[#27272A] shadow-sm"
                  )}
                >
                  <Markdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                      strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                      ul: ({ children }) => <ul className="list-disc ml-4 my-1 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal ml-4 my-1 space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="leading-snug">{children}</li>,
                      code: ({ children }) => (
                        <code className="bg-[#121212] text-white px-1.5 py-0.5 rounded font-mono text-[11px] border border-[#262626]">
                          {children}
                        </code>
                      ),
                      pre: ({ children }) => (
                        <pre className="bg-[#121212] p-2.5 rounded-lg overflow-x-auto my-2 font-mono text-[11px] border border-[#262626] text-white">
                          {children}
                        </pre>
                      ),
                    }}
                  >
                    {msg.content}
                  </Markdown>
                </div>
              </div>
            );
          })
        )}

        {/* Live Execution Telemetry Badge & Mirror Card */}
        {isStreaming && (
          <div className="mr-auto items-start max-w-[92%] space-y-2">
            <LiveExecutionBadge status={liveStatus} />
            <LiveMirrorCard screenshotUrl={liveStatus?.screenshot || ""} timestamp={liveStatus?.timestamp} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Prompt Box & Queued Messages Card Area */}
      <div className="p-3 bg-[#121212] border-t border-border-strong shrink-0 select-none">
        {/* Antigravity Queued Messages Card */}
        {queuedPrompts.length > 0 && (
          <div className="mb-2 px-3 py-2 bg-[#18181B] border border-[#27272A] rounded-xl flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between text-[11px] text-[#A1A1AA] font-mono">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#38BDF8] animate-pulse" />
                <span className="font-semibold text-white">Antrian Pesan ({queuedPrompts.length})</span>
              </div>
              <span className="text-[10px] text-[#71717A]">Diproses otomatis</span>
            </div>
            {queuedPrompts.map((promptText, idx) => (
              <div key={idx} className="flex items-center justify-between bg-[#121212] border border-[#262626] rounded-lg px-2.5 py-1 text-xs text-[#E4E4E7]">
                <span className="truncate max-w-[210px] font-mono text-[11px] text-[#D4D4D8]">{promptText}</span>
                <button
                  onClick={() => onRemoveQueuedPrompt?.(idx)}
                  className="text-[#71717A] hover:text-red-400 p-0.5 rounded transition-colors"
                  title="Batalkan antrian"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative bg-[#1E1E1E] border border-border-strong focus-within:border-[#777777] rounded-2xl p-2.5 transition-colors">
          {showMentions && mentionResults.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-2 z-50 bg-[#1E1E1E] border border-border-strong rounded-xl shadow-2xl overflow-hidden">
              <div className="px-3 py-1.5 text-[10px] font-bold text-[#A3A3A3] bg-[#262626] border-b border-border-strong">
                Select file to attach
              </div>
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
              disabled={!inputPrompt.trim()}
              className="w-7 h-7 bg-white hover:bg-[#E5E5E5] disabled:opacity-30 text-black rounded-full flex items-center justify-center transition-colors cursor-pointer"
              title={isStreaming ? "Tambah ke antrian" : "Kirim pesan"}
            >
              {isStreaming ? (
                <Clock className="w-3.5 h-3.5 text-black" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

export const WorkstationRightChat = memo(WorkstationRightChatComponent);
