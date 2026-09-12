import { memo, useState, useEffect, useMemo, type MouseEvent } from "react";
import { Check, Copy, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../../lib/utils";
import { API_BASE } from "../../../lib/api";
import { MessageThoughtBadge, StepItem, LiveActionIndicator, getActiveActionText } from "../LiveExecutionBadge";
import { ChatMessageContent } from "./ChatMessageContent";
import { Message } from "./types";

interface ChatMessageBubbleProps {
  msg: Message;
  isUser: boolean;
  isStreaming?: boolean;
  showThinking?: boolean;
  onPreviewImage?: (url: string) => void;
  onResend?: (content: string) => void;
}

export const ChatMessageBubble = memo(function ChatMessageBubble({
  msg,
  isUser,
  isStreaming = false,
  showThinking = true,
  onPreviewImage,
  onResend,
}: ChatMessageBubbleProps) {
  // CRITICAL: React Rules of Hooks - all hooks unconditionally declared at the top before any condition or early return!
  const [copied, setCopied] = useState(false);
  const [liveElapsedSec, setLiveElapsedSec] = useState(0);

  useEffect(() => {
    if (!isStreaming) return;
    setLiveElapsedSec(0);
    const start = Date.now();
    const interval = setInterval(() => {
      setLiveElapsedSec(Math.max(1, Math.floor((Date.now() - start) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [isStreaming]);

  const imageMentions = useMemo(() => {
    const contentStr = msg?.content || "";
    const matches = contentStr.match(/(?:@)?([a-zA-Z0-9_.-]+\.(?:png|jpg|jpeg|webp|gif))\b/gi) || [];
    return Array.from(new Set(matches.map((m) => m.replace(/^@/, ""))));
  }, [msg?.content]);

  const displayContent = useMemo(() => {
    const raw = msg?.content || "";
    if (imageMentions.length === 0) return isStreaming ? raw : raw.trim();
    return raw.replace(/(?:@)?([a-zA-Z0-9_.-]+\.(?:png|jpg|jpeg|webp|gif))\b/gi, "").trim();
  }, [msg?.content, imageMentions, isStreaming]);

  const timeString = useMemo(() => {
    if (!msg?.createdAt) return "";
    try {
      const date = new Date(msg.createdAt);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }, [msg?.createdAt]);

  let steps: StepItem[] | undefined = msg?.executionSteps;
  let thoughtSec = msg?.thoughtSec;
  let thoughtMs = msg?.thoughtMs;

  if (!steps && msg?.metadata) {
    try {
      const meta = typeof msg.metadata === "string" ? JSON.parse(msg.metadata) : msg.metadata;
      if (meta?.executionSteps) steps = meta.executionSteps;
      if (meta?.thoughtSec) thoughtSec = meta.thoughtSec;
      if (meta?.thoughtMs) thoughtMs = meta.thoughtMs;
    } catch {}
  }

  type PartGroup =
    | { type: "thought"; id: string; text: string; durationSec?: number; durationMs?: number; isLast: boolean }
    | { type: "tools"; id: string; steps: StepItem[]; isRunning: boolean; isLast: boolean }
    | { type: "text"; id: string; text: string; isLast: boolean };

  const partGroups = useMemo<PartGroup[]>(() => {
    if (!msg?.parts || msg.parts.length === 0) return [];
    const groups: PartGroup[] = [];
    for (let i = 0; i < msg.parts.length; i++) {
      const part = msg.parts[i];
      const isLast = i === msg.parts.length - 1;
      if (part.type === "thought") {
        const text = (part.text || "").trim();
        if (text || isStreaming) {
          groups.push({
            type: "thought",
            id: `thought-${i}`,
            text,
            durationSec: part.durationSec,
            durationMs: part.durationMs,
            isLast,
          });
        }
      } else if (part.type === "tool") {
        const lastGroup = groups[groups.length - 1];
        if (lastGroup && lastGroup.type === "tools") {
          lastGroup.steps.push(part.step);
          if (part.step.status === "running") lastGroup.isRunning = true;
          if (isLast) lastGroup.isLast = true;
        } else {
          groups.push({
            type: "tools",
            id: `tools-${i}`,
            steps: [part.step],
            isRunning: part.step.status === "running",
            isLast,
          });
        }
      } else if (part.type === "text" && part.text.trim().length > 0) {
        groups.push({
          type: "text",
          id: `text-${i}`,
          text: part.text,
          isLast,
        });
      }
    }
    return groups;
  }, [msg?.parts, isStreaming]);

  const hasPartsContent = !isUser && Boolean(partGroups.length > 0);
  const hasVisibleContent = hasPartsContent || displayContent.length > 0 || imageMentions.length > 0;
  const isThinkingActive = !isUser && Boolean(isStreaming && !hasVisibleContent);

  const activeActionText = useMemo(() => {
    if (!isStreaming) return "";
    return getActiveActionText(steps, undefined, Boolean(isThinkingActive || (msg?.reasoning && !hasVisibleContent)), hasVisibleContent);
  }, [isStreaming, steps, isThinkingActive, msg?.reasoning, hasVisibleContent]);

  const hasThoughtOrSteps =
    !isUser &&
    (Boolean(showThinking && (msg?.reasoning || isThinkingActive || msg?.thoughtSec || thoughtSec || msg?.thoughtMs || thoughtMs)) ||
      Boolean(steps && steps.length > 0) ||
      hasPartsContent);

  if (!hasVisibleContent && !hasThoughtOrSteps) {
    return null;
  }

  const handleCopy = (e: MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(msg.content || "");
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
      {!isUser && partGroups.length > 0 ? (
        <div className="flex flex-col gap-1.5 w-full min-w-0">
          {partGroups.map((group) => {
            if (group.type === "thought") {
              if (!group.text && !isStreaming) return null;
              return (
                <MessageThoughtBadge
                  key={group.id}
                  thoughtSec={group.durationSec}
                  thoughtMs={group.durationMs}
                  reasoning={group.text}
                  showThinking={showThinking}
                  isStreaming={isStreaming && group.isLast}
                />
              );
            }
            if (group.type === "tools") {
              return (
                <MessageThoughtBadge
                  key={group.id}
                  steps={group.steps}
                  showThinking={false}
                  isStreaming={isStreaming && group.isLast && group.isRunning}
                />
              );
            }
            if (group.type === "text") {
              return (
                <div
                  key={group.id}
                  className={cn(
                    "p-3 rounded-2xl text-xs leading-relaxed w-full min-w-0 max-w-full break-words [word-break:break-word] [overflow-wrap:anywhere] overflow-hidden font-sans relative",
                    "bg-[var(--bg-card)] text-[var(--text-secondary)] rounded-bl-xs border border-[var(--border-color)]"
                  )}
                >
                  <ChatMessageContent content={group.text} isUser={false} />
                  {isStreaming && group.isLast && (
                    <span className="inline-block w-1.5 h-3.5 bg-[var(--text-primary)]/80 ml-0.5 animate-pulse align-middle" />
                  )}
                </div>
              );
            }
            return null;
          })}
        </div>
      ) : (
        <>
          {!isUser && ((msg.reasoning && msg.reasoning.trim().length > 0) || (steps && steps.length > 0)) && (
            <MessageThoughtBadge
              steps={steps}
              thoughtSec={thoughtSec}
              thoughtMs={thoughtMs}
              reasoning={msg.reasoning}
              showThinking={showThinking}
              isStreaming={isStreaming}
            />
          )}

          {hasVisibleContent ? (
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
                <div className="relative">
                  <ChatMessageContent content={displayContent} isUser={isUser} />
                  {isStreaming && !isUser && (
                    <span className="inline-block w-1.5 h-3.5 bg-[var(--text-primary)]/80 ml-0.5 animate-pulse align-middle" />
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      {/* Dynamic active indicator while streaming - active, transparent, never passive */}
      {!isUser && isStreaming && (
        <div className="py-0.5 px-1">
          <LiveActionIndicator
            action={activeActionText}
            elapsedSec={liveElapsedSec}
          />
        </div>
      )}

      {/* Action Toolbar & Timestamp - only rendered when there is visible bubble content */}
      {hasVisibleContent && (
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
              {copied ? <Check className="w-3 h-3 text-[var(--text-primary)]" /> : <Copy className="w-3 h-3" />}
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
      )}
    </div>
  );
});
