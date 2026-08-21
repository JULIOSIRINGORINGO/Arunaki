import { RefObject, useRef, useLayoutEffect, useState, useMemo, useEffect, memo } from "react";
import Markdown from "react-markdown";
import {
  Bot,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  Send,
  BookOpen,
  Search,
  Calculator,
  FileText,
  FilePlus,
  FileSearch,
  Eraser,
  Clock,
  X,
  ChevronDown,
  Check,
} from "lucide-react";
import { LiveExecutionBadge, LiveStatusData } from "./LiveExecutionBadge";
import { LiveMirrorCard } from "./LiveMirrorCard";
import { LiveDocumentPreview } from "./LiveDocumentPreview";
import { cn } from "../../lib/utils";
import { getFileIcon } from "../workspace/tree-utils";
import { apiFetch, API_BASE } from "../../lib/api";
import { toast } from "sonner";

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
  status: string;
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
  files?: { name: string }[];
  queuedPrompts?: string[];
  onRemoveQueuedPrompt?: (index: number) => void;
  onSearchSection?: () => void;
  reasoningEffort?: string;
  setReasoningEffort?: (val: string) => void;
}

const EFFORT_OPTIONS = [
  { label: "Default", value: "" },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
];

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
  width = 320,
  files = [],
  queuedPrompts = [],
  onRemoveQueuedPrompt,
  onSearchSection,
  reasoningEffort = "",
  setReasoningEffort = () => {},
}: WorkstationRightChatProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);

  const [showCommands, setShowCommands] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);

  const [isEffortDropdownOpen, setIsEffortDropdownOpen] = useState(false);
  const effortDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (effortDropdownRef.current && !effortDropdownRef.current.contains(event.target as Node)) {
        setIsEffortDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentEffortObj = EFFORT_OPTIONS.find((opt) => opt.value === reasoningEffort);
  const currentEffortLabel = currentEffortObj ? currentEffortObj.label : "Default";

  const allMessages = useMemo(() => {
    if (!optimisticMessages || optimisticMessages.length === 0) {
      return chatMessages;
    }
    const result: Message[] = [...chatMessages];
    const seenIds = new Set(chatMessages.map((m) => m.id));

    for (const opt of optimisticMessages) {
      if (seenIds.has(opt.id)) continue;
      const alreadyPersisted = chatMessages.some(
        (m) => m.role === opt.role && m.content.trim() === opt.content.trim() && opt.content.trim().length > 0
      );
      if (!alreadyPersisted) {
        result.push(opt);
      }
    }
    return result;
  }, [chatMessages, optimisticMessages]);

  useLayoutEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const nextHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 24), 160);
      textareaRef.current.style.height = `${nextHeight}px`;
    }
  }, [inputPrompt]);

  const mentionResults = useMemo(() => {
    if (!showMentions) return [];
    const q = mentionQuery.toLowerCase();
    return files
      .map((f) => f.name)
      .filter((name) => name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [showMentions, mentionQuery, files]);

  const filteredCommands = useMemo(() => {
    if (!showCommands) return [];
    const q = commandQuery.toLowerCase();
    return COMMANDS.filter((cmd) => cmd.name.toLowerCase().includes(q));
  }, [showCommands, commandQuery]);

  if (collapsed) {
    return (
      <aside className="w-10 bg-[var(--bg-panel)] border-l border-[var(--border-color)] flex flex-col items-center py-2 shrink-0 select-none transition-colors duration-150">
        <button
          onClick={onClose}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-md hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          title="Open Chat Panel"
        >
          <PanelRightOpen className="w-4 h-4 text-[var(--text-primary)]" />
        </button>
        <div className="mt-4 flex flex-col items-center gap-4 text-[var(--text-muted)]">
          <Bot className="w-4 h-4 opacity-40" />
        </div>
      </aside>
    );
  }

  const handleInputChange = (val: string) => {
    setInputPrompt(val);

    const mentionMatch = val.match(/@(\w*)$/);
    if (mentionMatch) {
      setShowMentions(true);
      setMentionQuery(mentionMatch[1] || "");
      setMentionIndex(0);
      setShowCommands(false);
      return;
    } else {
      setShowMentions(false);
    }

    const commandMatch = val.match(/^\/([\w-]*)$/);
    if (commandMatch) {
      setShowCommands(true);
      setCommandQuery(commandMatch[1] || "");
      setSelectedCommandIndex(0);
      return;
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

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!activeWorkspace) return;
    
    const items = e.clipboardData.items;
    const imageItems = Array.from(items).filter(item => item.type.indexOf('image/') === 0);
    
    if (imageItems.length === 0) return;

    for (const item of imageItems) {
      const file = item.getAsFile();
      if (!file) continue;

      const toastId = toast.loading("Uploading pasted image...");
      
      const formData = new FormData();
      const timestamp = new Date().getTime();
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpg' : 'webp';
      const fileName = `pasted_image_${timestamp}.${ext}`;
      
      const renamedFile = new File([file], fileName, { type: file.type });
      
      formData.append('files', renamedFile);
      formData.append('workspaceId', activeWorkspace.id);
      formData.append('sourceName', 'Uploads');

      try {
        const res = await apiFetch(`${API_BASE}/files/upload`, {
          method: 'POST',
          body: formData,
        });
        
        if (res.ok) {
           const json = await res.json();
           if (json.data && json.data.length > 0) {
             const uploadedName = json.data[0].name;
             setInputPrompt(inputPrompt + (inputPrompt && !inputPrompt.endsWith(' ') ? ' ' : '') + `@${uploadedName} `);
             toast.success(`Image uploaded as ${uploadedName}`, { id: toastId });
           } else {
             toast.error("Failed to parse upload response", { id: toastId });
           }
        } else {
           toast.error("Failed to upload image", { id: toastId });
        }
      } catch (err) {
        console.error('Paste upload failed', err);
        toast.error("Failed to upload image", { id: toastId });
      }
    }
  };

  return (
    <aside
      className="bg-[var(--bg-panel)] border-l border-[var(--border-color)] flex flex-col h-full shrink-0 select-text overflow-hidden transition-colors duration-150"
      style={{ width: width || 320 }}
    >
      {/* Panel Header */}
      <div className="h-9 px-3 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-panel)] shrink-0 select-none">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-xs font-semibold text-[var(--text-primary)]">Chat</span>
        </div>
        <button
          onClick={onClose}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          title="Close Panel"
        >
          <PanelRightClose className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages List Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 font-sans text-xs">
        {allMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 select-none">
            <div className="w-10 h-10 rounded-full bg-[var(--bg-card)] flex items-center justify-center mb-3 border border-[var(--border-color)]">
              <Sparkles className="w-5 h-5 text-[var(--text-muted)]" />
            </div>
            <p className="text-xs font-medium text-[var(--text-primary)] mb-1">Workspace Agent</p>
            <p className="text-[11px] text-[var(--text-muted)] max-w-[200px]">
              Ask anything or provide document instructions.
            </p>
          </div>
        ) : (
          allMessages.map((msg, idx) => {
            const isUser = msg.role === "user";
            
            if (!isUser && (!msg.content || msg.content.trim() === "")) {
              return null;
            }

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
                      ? "bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-br-xs border border-[var(--border-strong)]"
                      : "bg-[var(--bg-card)] text-[var(--text-secondary)] rounded-bl-xs border border-[var(--border-color)]"
                  )}
                >
                  <Markdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                      strong: ({ children }) => <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>,
                      ul: ({ children }) => <ul className="list-disc ml-4 my-1 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal ml-4 my-1 space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="leading-snug">{children}</li>,
                      code: ({ children }) => (
                        <code className="bg-[var(--bg-panel)] text-[var(--text-primary)] px-1.5 py-0.5 rounded font-mono text-[11px] border border-[var(--border-color)]">
                          {children}
                        </code>
                      ),
                      pre: ({ children }) => (
                        <pre className="bg-[var(--bg-panel)] p-2.5 rounded-lg overflow-x-auto my-2 font-mono text-[11px] border border-[var(--border-color)] text-[var(--text-primary)]">
                          {children}
                        </pre>
                      ),
                    }}
                  >
                    {msg.content ? msg.content.replace(/\[\/?CANVAS\]/gi, "").trim() : ""}
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
            <LiveDocumentPreview status={liveStatus} />
            <LiveMirrorCard screenshotUrl={liveStatus?.screenshot || ""} timestamp={liveStatus?.timestamp} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Prompt Box & Queued Messages Card Area */}
      <div className="p-3 bg-[var(--bg-panel)] border-t border-[var(--border-color)] shrink-0 select-none transition-colors duration-150">
        {queuedPrompts.length > 0 && (
          <div className="mb-2 px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl flex flex-col gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] font-mono">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-sky-500 animate-pulse" />
                <span className="font-semibold text-[var(--text-primary)]">Message Queue ({queuedPrompts.length})</span>
              </div>
              <span className="text-[10px] text-[var(--text-dim)]">Auto-processing</span>
            </div>
            {queuedPrompts.map((promptText, idx) => (
              <div key={idx} className="flex items-center justify-between bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-2.5 py-1 text-xs text-[var(--text-primary)]">
                <span className="truncate max-w-[210px] font-mono text-[11px]">{promptText}</span>
                <button
                  onClick={() => onRemoveQueuedPrompt?.(idx)}
                  className="text-[var(--text-dim)] hover:text-red-500 p-0.5 rounded transition-colors cursor-pointer"
                  title="Cancel queued message"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative bg-[var(--bg-card)] border border-[var(--border-color)] focus-within:border-[var(--border-strong)] rounded-2xl p-2.5 transition-colors">
          {showMentions && mentionResults.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-2 z-50 bg-[var(--bg-card)] border border-[var(--border-strong)] rounded-xl overflow-hidden">
              <div className="px-3 py-1.5 text-[10px] font-bold text-[var(--text-muted)] bg-[var(--bg-hover)] border-b border-[var(--border-color)]">
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
                      "w-full px-3 py-1.5 text-xs flex items-center gap-2 transition-colors cursor-pointer text-left",
                      i === mentionIndex ? "bg-[var(--bg-hover)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                    )}
                  >
                    {getFileIcon(name)}
                    <span className="truncate">{name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {showCommands && filteredCommands.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-2 z-50 bg-[var(--bg-card)] border border-[var(--border-strong)] rounded-xl overflow-hidden">
              <div className="px-3 py-1.5 text-[10px] font-bold text-[var(--text-muted)] bg-[var(--bg-hover)] border-b border-[var(--border-color)]">
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
                        index === selectedCommandIndex ? "bg-[var(--bg-hover)]" : "hover:bg-[var(--bg-hover)]"
                      )}
                    >
                      <Icon size={14} className="text-[var(--text-muted)] shrink-0" strokeWidth={1.5} />
                      <span className="text-xs font-medium text-[var(--text-primary)]">{command.name}</span>
                      <span className="text-[10px] text-[var(--text-dim)] truncate">{command.description}</span>
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
            onPaste={handlePaste}
            placeholder="Ask anything, type @ to mention files, / for commands..."
            rows={1}
            className="w-full bg-transparent text-xs text-[var(--text-primary)] placeholder-[var(--text-dim)] resize-none overflow-y-auto no-scrollbar focus:outline-none"
          />

          <div className="flex items-center justify-between pt-1 border-t border-[var(--border-color)] mt-1">
            <div className="flex items-center gap-2">
              {activeWorkspace && (
                <div className="relative" ref={effortDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsEffortDropdownOpen(!isEffortDropdownOpen)}
                    className="text-[10px] bg-[var(--bg-hover)] hover:bg-[var(--bg-panel)] text-[var(--text-primary)] px-2 py-0.5 rounded-full font-medium border border-[var(--border-color)] hover:border-[var(--border-strong)] flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                    title="Reasoning Effort"
                  >
                    <span>{currentEffortLabel}</span>
                    <ChevronDown className={cn("w-2.5 h-2.5 text-[var(--text-muted)] transition-transform duration-150", isEffortDropdownOpen && "rotate-180")} />
                  </button>

                  {isEffortDropdownOpen && (
                    <div className="absolute bottom-full mb-1.5 left-0 w-28 rounded-xl bg-[var(--bg-card)] border border-[var(--border-strong)] shadow-2xl p-1 space-y-0.5 z-50 animate-in fade-in duration-100">
                      <div className="px-2 py-1 text-[10px] font-medium text-[var(--text-muted)] border-b border-[var(--border-color)] mb-0.5">
                        Reasoning Effort
                      </div>
                      {EFFORT_OPTIONS.map((opt) => {
                        const isSelected = reasoningEffort === opt.value;
                        return (
                          <button
                            key={opt.value || "natural"}
                            type="button"
                            onClick={() => {
                              setReasoningEffort(opt.value);
                              setIsEffortDropdownOpen(false);
                            }}
                            className={cn(
                              "w-full text-left px-2 py-1 rounded-lg text-[10px] flex items-center justify-between cursor-pointer transition-colors",
                              isSelected
                                ? "bg-[var(--bg-hover)] text-[var(--text-primary)] font-bold"
                                : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                            )}
                          >
                            <span>{opt.label}</span>
                            {isSelected && <Check className="w-2.5 h-2.5 text-[var(--text-primary)] shrink-0 stroke-[2.5]" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => onSendMessage()}
              disabled={!inputPrompt.trim()}
              className="w-7 h-7 bg-[var(--text-primary)] hover:opacity-90 disabled:opacity-30 text-[var(--bg-app)] rounded-full flex items-center justify-center transition-colors cursor-pointer"
              title={isStreaming ? "Add to queue" : "Send message"}
            >
              {isStreaming ? (
                <Clock className="w-3.5 h-3.5" />
              ) : (
                <Send className="w-3.5 h-3.5" strokeWidth={1.5} />
              )}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

export const WorkstationRightChat = memo(WorkstationRightChatComponent);
