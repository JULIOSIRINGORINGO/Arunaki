import { RefObject, useRef, useLayoutEffect, useState, useMemo, useEffect, memo } from "react";
import Markdown from "react-markdown";
import {
  Bot,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  Send,
  FileSearch,
  Eraser,
  Clock,
  X,
  ChevronDown,
  Check,
  Plus,
  Flame,
  Square,
  Copy,
  RotateCcw,
  Brain,
} from "lucide-react";
import { LiveExecutionBadge, MessageThoughtBadge, LiveStatusData, StepItem } from "./LiveExecutionBadge";
import { LiveMirrorCard } from "./LiveMirrorCard";
import { LiveDocumentPreview } from "./LiveDocumentPreview";
import { cn } from "../../lib/utils";
import { getFileIcon } from "../workspace/tree-utils";
import { API_BASE } from "../../lib/api";
import { toast } from "sonner";

const COMMANDS = [
  { name: "/thinking", description: "Collapse or expand model thinking process", icon: Brain },
  { name: "/grill-me", description: "Interview requirements deeply before executing", icon: Flame },
  { name: "/new", description: "Start a new conversation session", icon: Plus },
  { name: "/search-section", description: "Search topics across sessions", icon: FileSearch },
  { name: "/clear", description: "Clear current conversation", icon: Eraser },
];

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  executionSteps?: StepItem[];
  thoughtSec?: number;
  metadata?: string | Record<string, any>;
  reasoning?: string;
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
  isStreaming: boolean;
  onSendMessage: (text: string) => void;
  width?: number | string;
  files?: { name: string }[];
  queuedPrompts?: string[];
  onRemoveQueuedPrompt?: (index: number) => void;
  onSearchSection?: () => void;
  reasoningEffort?: string;
  setReasoningEffort?: (val: string) => void;
  onNewChat?: () => void;
  onCancelStream?: () => void;
}

const EFFORT_OPTIONS = [
  { label: "Default", value: "" },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
];

interface TableBlock {
  type: "table";
  headers: string[];
  rows: string[][];
}

interface TextBlock {
  type: "text";
  content: string;
}

type ContentBlock = TableBlock | TextBlock;

function parseContentBlocks(rawContent: string): ContentBlock[] {
  const content = rawContent.replace(/\[\/?CANVAS\]/gi, "").trim();
  if (!content.includes("|")) {
    return [{ type: "text", content }];
  }

  const lines = content.split("\n");
  const blocks: ContentBlock[] = [];
  let currentTextLines: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith("|") && line.endsWith("|") && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      const isSeparator =
        nextLine.startsWith("|") &&
        nextLine.endsWith("|") &&
        /^\|[\s\-:]+(\|[\s\-:]+)+\|$/.test(nextLine);

      if (isSeparator) {
        if (currentTextLines.length > 0) {
          const text = currentTextLines.join("\n").trim();
          if (text) blocks.push({ type: "text", content: text });
          currentTextLines = [];
        }

        const headers = line
          .slice(1, -1)
          .split("|")
          .map((h) => h.trim());

        i += 2;
        const rows: string[][] = [];

        while (
          i < lines.length &&
          lines[i].trim().startsWith("|") &&
          lines[i].trim().endsWith("|")
        ) {
          const rowLine = lines[i].trim();
          const cells = rowLine
            .slice(1, -1)
            .split("|")
            .map((c) => c.trim());
          rows.push(cells);
          i++;
        }

        blocks.push({ type: "table", headers, rows });
        continue;
      }
    }

    currentTextLines.push(lines[i]);
    i++;
  }

  if (currentTextLines.length > 0) {
    const remainingText = currentTextLines.join("\n").trim();
    if (remainingText) {
      blocks.push({ type: "text", content: remainingText });
    }
  }

  return blocks.length > 0 ? blocks : [{ type: "text", content }];
}

const ChatMessageContent = memo(function ChatMessageContent({ content }: { content: string; isUser: boolean }) {
  const blocks = useMemo(() => parseContentBlocks(content), [content]);

  return (
    <div className="space-y-2 font-sans min-w-0 max-w-full break-words [word-break:break-word] [overflow-wrap:anywhere]">
      {blocks.map((block, bIdx) => {
        if (block.type === "table") {
          return (
            <div
              key={bIdx}
              className="my-2 max-w-full overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--bg-panel)] select-text shadow-xs"
            >
              <div className="overflow-x-auto no-scrollbar max-w-full">
                <table className="w-full text-left border-collapse font-sans text-xs">
                  <thead>
                    <tr className="bg-[var(--bg-panel-sub)] border-b border-[var(--border-color)]">
                      {block.headers.map((h, hIdx) => (
                        <th
                          key={hIdx}
                          className="px-3 py-2 font-semibold text-[var(--text-primary)] border-r last:border-r-0 border-[var(--border-color)] text-[11px] tracking-wide whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {block.rows.map((row, rIdx) => {
                      const isTotal = row.some((c) => c.toLowerCase().includes("total"));
                      return (
                        <tr
                          key={rIdx}
                          className={cn(
                            "transition-colors",
                            isTotal
                              ? "bg-[var(--bg-card)] font-semibold text-[var(--text-primary)]"
                              : "hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
                          )}
                        >
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className="px-3 py-1.5 border-r last:border-r-0 border-[var(--border-color)] text-xs font-normal"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }

        return (
          <Markdown
            key={bIdx}
            components={{
              p: ({ children }) => (
                <p className="mb-2 last:mb-0 leading-relaxed whitespace-pre-wrap break-words [word-break:break-word] [overflow-wrap:anywhere]">
                  {children}
                </p>
              ),
              hr: () => <hr className="my-2.5 border-t border-[var(--border-color)] w-full" />,
              strong: ({ children }) => (
                <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>
              ),
              ul: ({ children }) => (
                <ul className="list-disc ml-4 my-1 space-y-1 break-words [word-break:break-word]">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal ml-4 my-1 space-y-1 break-words [word-break:break-word]">{children}</ol>
              ),
              li: ({ children }) => <li className="leading-snug break-words [word-break:break-word]">{children}</li>,
              code: ({ children }) => (
                <code className="bg-[var(--bg-panel)] text-[var(--text-primary)] px-1.5 py-0.5 rounded font-mono text-[11px] border border-[var(--border-color)] break-words [word-break:break-word]">
                  {children}
                </code>
              ),
              pre: ({ children }) => (
                <pre className="bg-[var(--bg-panel)] p-2.5 rounded-lg overflow-x-auto max-w-full my-2 font-mono text-[11px] border border-[var(--border-color)] text-[var(--text-primary)]">
                  {children}
                </pre>
              ),
            }}
          >
            {block.content}
          </Markdown>
        );
      })}
    </div>
  );
});

interface AttachedImage {
  id: string;
  name: string;
  url: string;
}

const ChatMessageBubble = memo(function ChatMessageBubble({
  msg,
  isUser,
  collapseThinking = true,
  onPreviewImage,
  onResend,
}: {
  msg: Message;
  isUser: boolean;
  collapseThinking?: boolean;
  onPreviewImage?: (url: string) => void;
  onResend?: (content: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  let steps = msg.executionSteps;
  let thoughtSec = msg.thoughtSec;
  if (!steps && msg.metadata) {
    try {
      const meta = typeof msg.metadata === "string" ? JSON.parse(msg.metadata) : msg.metadata;
      if (meta?.executionSteps) steps = meta.executionSteps;
      if (meta?.thoughtSec) thoughtSec = meta.thoughtSec;
    } catch {}
  }

  const imageMentions = useMemo(() => {
    const matches = msg.content?.match(/(?:@)?([a-zA-Z0-9_.-]+\.(?:png|jpg|jpeg|webp|gif))\b/gi) || [];
    return Array.from(new Set(matches.map((m) => m.replace(/^@/, ''))));
  }, [msg.content]);

  const displayContent = useMemo(() => {
    if (imageMentions.length === 0) return msg.content;
    return msg.content.replace(/(?:@)?([a-zA-Z0-9_.-]+\.(?:png|jpg|jpeg|webp|gif))\b/gi, "").trim();
  }, [msg.content, imageMentions]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResend = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onResend && msg.content) {
      onResend(msg.content);
    }
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-1 w-full max-w-[96%] min-w-0",
        isUser ? "ml-auto items-end" : "mr-auto items-start"
      )}
    >
      {!isUser && (
        <MessageThoughtBadge
          steps={steps}
          thoughtSec={thoughtSec}
          reasoning={msg.reasoning}
          defaultExpanded={!collapseThinking}
        />
      )}

      <div
        className={cn(
          "p-3 rounded-2xl text-xs leading-relaxed w-full min-w-0 max-w-full break-words [word-break:break-word] [overflow-wrap:anywhere] overflow-hidden font-sans relative",
          isUser
            ? "bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-br-xs border border-[var(--border-strong)]"
            : "bg-[var(--bg-card)] text-[var(--text-secondary)] rounded-bl-xs border border-[var(--border-color)]"
        )}
      >
        {imageMentions.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {imageMentions.map((imgName, i) => (
              <div
                key={i}
                className="group/img relative rounded-xl overflow-hidden border border-[var(--border-color)] bg-black/15 shadow-xs cursor-pointer hover:border-[var(--border-strong)] transition-all p-1"
                onClick={() => onPreviewImage?.(`${API_BASE}/files/raw/${encodeURIComponent(imgName)}`)}
                title="Click to view full image"
              >
                <img
                  src={`${API_BASE}/files/raw/${encodeURIComponent(imgName)}`}
                  alt={imgName}
                  className="max-w-[220px] max-h-[160px] rounded-lg object-contain group-hover/img:scale-102 transition-transform duration-150"
                  onError={(e) => {
                    const parent = (e.target as HTMLElement).parentElement;
                    if (parent) {
                      parent.innerHTML = `<div class="flex items-center gap-1.5 px-2 py-1 text-xs text-[var(--text-primary)] bg-[var(--bg-panel)] rounded-lg"><span class="text-[11px] font-medium">📎 ${imgName}</span></div>`;
                    }
                  }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/25 transition-colors flex items-end p-1.5 pointer-events-none">
                  <span className="text-[10px] text-white bg-black/70 backdrop-blur-xs px-1.5 py-0.5 rounded truncate max-w-full opacity-0 group-hover/img:opacity-100 transition-opacity">
                    {imgName}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        {displayContent ? (
          <ChatMessageContent content={displayContent} isUser={isUser} />
        ) : null}
      </div>

      {/* Antigravity-Style Hover Action Toolbar (Copy & Resend) */}
      <div
        className={cn(
          "flex items-center gap-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 select-none text-[10px] text-[var(--text-muted)]",
          isUser ? "flex-row-reverse" : "flex-row"
        )}
      >
        <button
          type="button"
          onClick={handleCopy}
          className="p-1 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          title="Copy message"
        >
          {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
        </button>

        {isUser && onResend && (
          <button
            type="button"
            onClick={handleResend}
            className="p-1 rounded-md hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center gap-0.5"
            title="Resend prompt"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
});

function WorkstationRightChatComponent({
  collapsed,
  onClose,
  chatMessages,
  optimisticMessages,
  liveStatus,
  messagesEndRef,
  activeWorkspace,
  isStreaming,
  onSendMessage,
  width = 320,
  files = [],
  queuedPrompts = [],
  onRemoveQueuedPrompt,
  onSearchSection,
  reasoningEffort = "",
  setReasoningEffort = () => {},
  onNewChat,
  onCancelStream,
}: WorkstationRightChatProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localPrompt, setLocalPrompt] = useState("");
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
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

  const [collapseThinking, setCollapseThinking] = useState<boolean>(() => {
    return localStorage.getItem("arunaki_collapse_thinking") !== "false";
  });

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
  }, [localPrompt]);

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
    setLocalPrompt(val);

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

  const submitPrompt = () => {
    const promptTrimmed = localPrompt.trim();
    if (promptTrimmed === "/thinking") {
      setCollapseThinking((prev) => {
        const next = !prev;
        try { localStorage.setItem("arunaki_collapse_thinking", String(next)); } catch {}
        toast.info(next ? "Thinking process collapsed" : "Thinking process expanded (showing dimmed reasoning)");
        return next;
      });
      setLocalPrompt("");
      setAttachedImages([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      return;
    }

    const imageTags = attachedImages.map((img) => `@${img.name}`).join(" ");
    const fullText = [promptTrimmed, imageTags].filter(Boolean).join(" ");
    if (!fullText) return;

    onSendMessage(fullText);
    setLocalPrompt("");
    setAttachedImages([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
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
      submitPrompt();
    }
  };

  const insertMention = (filename: string) => {
    const updated = localPrompt.replace(/@\w*$/, `@${filename} `);
    setLocalPrompt(updated);
    setShowMentions(false);
    if (textareaRef.current) textareaRef.current.focus();
  };

  const handleCommandSelect = (cmdName: string) => {
    if (cmdName === "/thinking") {
      setLocalPrompt("");
      setShowCommands(false);
      setCollapseThinking((prev) => {
        const next = !prev;
        try { localStorage.setItem("arunaki_collapse_thinking", String(next)); } catch {}
        toast.info(next ? "Thinking process collapsed" : "Thinking process expanded (showing dimmed reasoning)");
        return next;
      });
      return;
    }
    if (cmdName === "/search-section") {
      setLocalPrompt("");
      setShowCommands(false);
      onSearchSection?.();
      return;
    }
    if (cmdName === "/new" || cmdName === "/clear") {
      setLocalPrompt("");
      setShowCommands(false);
      onNewChat?.();
      return;
    }
    setLocalPrompt(`${cmdName} `);
    setShowCommands(false);
    if (textareaRef.current) textareaRef.current.focus();
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    const imageItems = Array.from(items).filter(item => item.type.indexOf('image/') === 0);

    if (imageItems.length === 0) return;

    for (const item of imageItems) {
      const file = item.getAsFile();
      if (!file) continue;

      const localPreviewUrl = URL.createObjectURL(file);
      const timestamp = new Date().getTime();
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpg' : 'webp';
      const fileName = `pasted_image_${timestamp}.${ext}`;

      setAttachedImages((prev) => [
        ...prev,
        {
          id: fileName,
          name: fileName,
          url: localPreviewUrl,
        },
      ]);
    }
  };

  return (
    <aside
      className="relative bg-[var(--bg-panel)] border-l border-[var(--border-color)] flex flex-col h-full shrink-0 select-text overflow-hidden transition-colors duration-150"
      style={{ width: width || 320 }}
    >
      {/* Panel Header */}
      <div className="h-9 px-3 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-panel)] shrink-0 select-none">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-xs font-semibold text-[var(--text-primary)]">Chat</span>
        </div>
        <div className="flex items-center gap-0.5">
          {onNewChat && (
            <button
              onClick={onNewChat}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
              title="New Chat Session"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            title="Close Panel"
          >
            <PanelRightClose className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages List Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-4 font-sans text-xs min-w-0">
        {allMessages.length === 0 && !isStreaming ? (
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
              <ChatMessageBubble
                key={msg.id || idx}
                msg={msg}
                isUser={isUser}
                collapseThinking={collapseThinking}
                onPreviewImage={(url) => setLightboxUrl(url)}
                onResend={(content) => onSendMessage(content)}
              />
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
            <div className="absolute bottom-full left-0 right-0 mb-2 z-50 bg-[var(--bg-card)] border border-[var(--border-strong)] rounded-xl overflow-hidden shadow-2xl transform-gpu will-change-transform">
              <div className="px-3 py-1.5 text-[10px] font-bold text-[var(--text-muted)] bg-[var(--bg-hover)] border-b border-[var(--border-color)]">
                Select file to attach
              </div>
              <div className="max-h-44 overflow-y-auto">
                {mentionResults.map((name, i) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => insertMention(name)}
                    className={cn(
                      "w-full px-3 py-1.5 text-xs flex items-center gap-2 transition-colors cursor-pointer text-left hover:bg-[var(--bg-hover)]",
                      i === mentionIndex ? "bg-[var(--bg-hover)] text-[var(--text-primary)] font-medium" : "text-[var(--text-secondary)]"
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
            <div className="absolute bottom-full left-0 right-0 mb-2 z-50 bg-[var(--bg-card)] border border-[var(--border-strong)] rounded-xl overflow-hidden shadow-2xl transform-gpu will-change-transform">
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
                      className={cn(
                        "w-full px-3 py-2 flex items-center gap-2 transition-colors cursor-pointer hover:bg-[var(--bg-hover)]",
                        index === selectedCommandIndex ? "bg-[var(--bg-hover)] font-medium" : ""
                      )}
                    >
                      <Icon size={14} className="text-[var(--text-muted)] shrink-0" strokeWidth={1.5} />
                      <span className="text-xs font-medium text-[var(--text-primary)] whitespace-nowrap shrink-0">{command.name}</span>
                      <span className="text-[10px] text-[var(--text-dim)] truncate min-w-0">{command.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Visual Attached Image Chips Preview */}
          {attachedImages.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 animate-in fade-in zoom-in-95 duration-150">
              {attachedImages.map((img, idx) => (
                <div
                  key={img.id || idx}
                  className="group relative flex items-center gap-2 bg-[var(--bg-hover)] border border-[var(--border-strong)] rounded-xl p-1.5 pr-2.5 shadow-xs"
                >
                  <img
                    src={img.url}
                    alt={img.name}
                    className="w-10 h-10 rounded-lg object-cover border border-[var(--border-color)] bg-black/20 shrink-0 cursor-pointer"
                    onClick={() => setLightboxUrl(img.url)}
                    title="Click to zoom preview"
                  />
                  <div className="flex flex-col min-w-0 max-w-[130px]">
                    <span className="text-[11px] font-medium text-[var(--text-primary)] truncate">{img.name}</span>
                    <span className="text-[9px] text-[var(--text-dim)] font-mono">Image attached</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachedImages((prev) => prev.filter((_, i) => i !== idx))}
                    className="ml-1 w-4 h-4 rounded-full bg-[var(--bg-panel)] hover:bg-red-500/20 hover:text-red-500 text-[var(--text-muted)] flex items-center justify-center transition-colors cursor-pointer"
                    title="Remove image"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={localPrompt}
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

            <div className="flex items-center gap-1.5">
              {isStreaming && (
                <button
                  type="button"
                  onClick={onCancelStream}
                  className="w-7 h-7 bg-red-500/15 hover:bg-red-500/25 active:bg-red-500/35 text-red-500 border border-red-500/30 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-xs animate-in fade-in zoom-in duration-150"
                  title="Stop generating"
                >
                  <Square className="w-2.5 h-2.5 fill-current" />
                </button>
              )}

              {(!isStreaming || localPrompt.trim() || attachedImages.length > 0) && (
                <button
                  type="button"
                  onClick={submitPrompt}
                  disabled={!localPrompt.trim() && attachedImages.length === 0}
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer",
                    isStreaming
                      ? "bg-[var(--bg-hover)] hover:bg-[var(--bg-panel)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-color)]"
                      : "bg-[var(--text-primary)] hover:opacity-90 disabled:opacity-30 text-[var(--bg-app)]"
                  )}
                  title={isStreaming ? "Add to queue" : "Send message"}
                >
                  {isStreaming ? (
                    <Clock className="w-3.5 h-3.5" />
                  ) : (
                    <Send className="w-3.5 h-3.5" strokeWidth={1.5} />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scoped Chat-Only Image Preview Modal */}
      {lightboxUrl && (
        <div
          className="absolute inset-0 z-50 bg-[var(--bg-card)]/95 backdrop-blur-sm flex flex-col p-3 animate-in fade-in duration-150"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-color)] shrink-0 select-none">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              <span className="text-xs font-semibold text-[var(--text-primary)]">Image Preview</span>
            </div>
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              className="w-6 h-6 rounded-full bg-[var(--bg-hover)] hover:bg-[var(--bg-panel)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer border border-[var(--border-color)]"
              title="Close preview"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div
            className="flex-1 min-h-0 flex items-center justify-center overflow-auto p-1 rounded-xl bg-[var(--bg-panel)] border border-[var(--border-color)]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxUrl}
              alt="Preview"
              className="max-w-full max-h-full rounded-lg object-contain shadow-sm"
            />
          </div>
        </div>
      )}
    </aside>
  );
}

export const WorkstationRightChat = memo(WorkstationRightChatComponent);
