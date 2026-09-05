import { memo, useState, useMemo, type MouseEvent } from "react";
import { Check, Copy, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../../lib/utils";
import { API_BASE } from "../../../lib/api";
import { MessageThoughtBadge, StepItem } from "../LiveExecutionBadge";
import { ChatMessageContent } from "./ChatMessageContent";
import { Message } from "./types";

interface ChatMessageBubbleProps {
  msg: Message;
  isUser: boolean;
  collapseThinking?: boolean;
  onPreviewImage?: (url: string) => void;
  onResend?: (content: string) => void;
}

export const ChatMessageBubble = memo(function ChatMessageBubble({
  msg,
  isUser,
  collapseThinking = true,
  onPreviewImage,
  onResend,
}: ChatMessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  let steps: StepItem[] | undefined = msg.executionSteps;
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
    return Array.from(new Set(matches.map((m) => m.replace(/^@/, ""))));
  }, [msg.content]);

  const displayContent = useMemo(() => {
    if (imageMentions.length === 0) return msg.content;
    return msg.content.replace(/(?:@)?([a-zA-Z0-9_.-]+\.(?:png|jpg|jpeg|webp|gif))\b/gi, "").trim();
  }, [msg.content, imageMentions]);

  const timeString = useMemo(() => {
    if (!msg.createdAt) return "";
    try {
      const date = new Date(msg.createdAt);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }, [msg.createdAt]);

  const handleCopy = (e: MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResend = (e: MouseEvent) => {
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

      {(displayContent || imageMentions.length > 0) && (
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
      )}

      {/* Action Toolbar & Timestamp */}
      <div
        className={cn(
          "flex items-center gap-2 px-1 select-none text-[10px] text-[var(--text-muted)] mt-0.5",
          isUser ? "flex-row-reverse" : "flex-row"
        )}
      >
        <span className="opacity-70">{timeString}</span>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
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
    </div>
  );
});
