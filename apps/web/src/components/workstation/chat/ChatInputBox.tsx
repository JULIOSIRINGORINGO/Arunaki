import {
  useRef,
  useLayoutEffect,
  useState,
  useMemo,
  useEffect,
  memo,
  type Dispatch,
  type SetStateAction,
  type KeyboardEvent,
  type ClipboardEvent,
} from "react";
import {
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
  Brain,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { getFileIcon } from "../../workspace/tree-utils";
import { toast } from "sonner";
import { AttachedImage } from "./types";

export const COMMANDS = [
  { name: "/thinking", description: "Collapse or expand model thinking process", icon: Brain },
  { name: "/grill-me", description: "Interview requirements deeply before executing", icon: Flame },
  { name: "/new", description: "Start a new conversation session", icon: Plus },
  { name: "/search-section", description: "Search topics across sessions", icon: FileSearch },
  { name: "/clear", description: "Clear current conversation", icon: Eraser },
];

export const EFFORT_OPTIONS = [
  { label: "Default", value: "" },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
];

interface ChatInputBoxProps {
  files?: { name: string }[];
  isStreaming: boolean;
  onSendMessage: (text: string) => void;
  onCancelStream?: () => void;
  onSearchSection?: () => void;
  onNewChat?: () => void;
  reasoningEffort?: string;
  setReasoningEffort?: (val: string) => void;
  collapseThinking: boolean;
  setCollapseThinking: Dispatch<SetStateAction<boolean>>;
  onPreviewImage: (url: string) => void;
}

export const ChatInputBox = memo(function ChatInputBox({
  files = [],
  isStreaming,
  onSendMessage,
  onCancelStream,
  onSearchSection,
  onNewChat,
  reasoningEffort = "",
  setReasoningEffort,
  collapseThinking,
  setCollapseThinking,
  onPreviewImage,
}: ChatInputBoxProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localPrompt, setLocalPrompt] = useState("");
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);

  // Mentions (@) popup
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);

  // Slash commands (/) popup
  const [showCommands, setShowCommands] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);

  // Reasoning effort dropdown
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

  useLayoutEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const nextHeight = Math.min(Math.max(textareaRef.current.scrollHeight, 24), 160);
      textareaRef.current.style.height = `${nextHeight}px`;
    }
  }, [localPrompt]);

  const currentEffortObj = EFFORT_OPTIONS.find((opt) => opt.value === reasoningEffort);
  const currentEffortLabel = currentEffortObj ? currentEffortObj.label : "Default";

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
        try {
          localStorage.setItem("arunaki_collapse_thinking", String(next));
        } catch {}
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
        try {
          localStorage.setItem("arunaki_collapse_thinking", String(next));
        } catch {}
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

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
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

  const handlePaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    const imageItems = Array.from(items).filter((item) => item.type.indexOf("image/") === 0);

    if (imageItems.length === 0) return;

    for (const item of imageItems) {
      const file = item.getAsFile();
      if (!file) continue;

      const localPreviewUrl = URL.createObjectURL(file);
      const timestamp = new Date().getTime();
      const ext = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "webp";
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
    <div className="relative bg-[var(--bg-card)] border border-[var(--border-color)] focus-within:border-[var(--border-strong)] rounded-2xl p-2.5 transition-colors">
      {/* File Mentions Popup */}
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
                  i === mentionIndex
                    ? "bg-[var(--bg-hover)] text-[var(--text-primary)] font-medium"
                    : "text-[var(--text-secondary)]"
                )}
              >
                {getFileIcon(name)}
                <span className="truncate">{name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Slash Commands Popup */}
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
                  <span className="text-xs font-medium text-[var(--text-primary)] whitespace-nowrap shrink-0">
                    {command.name}
                  </span>
                  <span className="text-[10px] text-[var(--text-dim)] truncate min-w-0">
                    {command.name === "/thinking"
                      ? collapseThinking
                        ? "Expand model thinking process (Currently Hidden)"
                        : "Collapse model thinking process (Currently Shown)"
                      : command.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Attached Images Preview Chips */}
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
                onClick={() => onPreviewImage(img.url)}
                title="Click to zoom preview"
              />
              <div className="flex flex-col min-w-0 max-w-[130px]">
                <span className="text-[11px] font-medium text-[var(--text-primary)] truncate">
                  {img.name}
                </span>
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
          {setReasoningEffort && (
            <div className="relative" ref={effortDropdownRef}>
              <button
                type="button"
                onClick={() => setIsEffortDropdownOpen(!isEffortDropdownOpen)}
                className="text-[10px] bg-[var(--bg-hover)] hover:bg-[var(--bg-panel)] text-[var(--text-primary)] px-2 py-0.5 rounded-full font-medium border border-[var(--border-color)] hover:border-[var(--border-strong)] flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                title="Reasoning Effort"
              >
                <span>{currentEffortLabel}</span>
                <ChevronDown
                  className={cn(
                    "w-2.5 h-2.5 text-[var(--text-muted)] transition-transform duration-150",
                    isEffortDropdownOpen && "rotate-180"
                  )}
                />
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
                        {isSelected && (
                          <Check className="w-2.5 h-2.5 text-[var(--text-primary)] shrink-0 stroke-[2.5]" />
                        )}
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
              {isStreaming ? <Clock className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" strokeWidth={1.5} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
