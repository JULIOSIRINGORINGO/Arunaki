import { RefObject, useState, useMemo, memo } from "react";
import { ArunakiLogo } from "../common/ArunakiLogo";
import {
  Bot,
  PanelRightOpen,
} from "lucide-react";
import { LiveExecutionBadge, LiveStatusData } from "./LiveExecutionBadge";
import { LiveMirrorCard } from "./LiveMirrorCard";
import { LiveDocumentPreview } from "./LiveDocumentPreview";
import { Message } from "./chat/types";
import { ChatMessageBubble } from "./chat/ChatMessageBubble";
import { ChatInputBox } from "./chat/ChatInputBox";
import { ChatQueuedPrompts } from "./chat/ChatQueuedPrompts";
import { ChatImageLightbox } from "./chat/ChatImageLightbox";
import { WorkstationRightChatHeader } from "./chat/WorkstationRightChatHeader";

interface Workspace {
  id: string;
  name: string;
  rootPath: string | null;
  status: string;
}

export interface WorkstationRightChatProps {
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
  activeChatId?: string;
}

function WorkstationRightChatComponent({
  collapsed,
  onClose,
  chatMessages,
  optimisticMessages,
  liveStatus,
  messagesEndRef,
  isStreaming,
  onSendMessage,
  width = 320,
  files = [],
  queuedPrompts = [],
  onRemoveQueuedPrompt,
  onSearchSection,
  reasoningEffort = "",
  setReasoningEffort,
  onNewChat,
  onCancelStream,
  activeChatId,
}: WorkstationRightChatProps) {
  // CRITICAL: React Rules of Hooks - all hooks declared unconditionally at top
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [showThinking, setShowThinking] = useState<boolean>(() => {
    const saved = localStorage.getItem("arunaki_show_thinking");
    if (saved !== null) return saved === "true";
    return true;
  });

  const allMessages = useMemo(() => {
    if (!optimisticMessages || optimisticMessages.length === 0) {
      return chatMessages;
    }
    const result: Message[] = [...chatMessages];
    const seenIds = new Set(chatMessages.map((m) => m.id));

    for (const opt of optimisticMessages) {
      if (seenIds.has(opt.id)) continue;
      const optText = (opt.content || "").trim();
      const optReasoning = (opt.reasoning || "").trim();

      const alreadyPersisted = chatMessages.some((m) => {
        if (m.role !== opt.role) return false;
        const mContent = (m.content || "").trim();
        const mReasoning = (m.reasoning || "").trim();

        // 1. Exact content match
        if (optText.length > 0 && mContent === optText) return true;

        // 2. Exact reasoning match (same turn reasoning)
        if (optReasoning.length > 0 && mReasoning.length > 0 && (mReasoning === optReasoning || mReasoning.includes(optReasoning) || optReasoning.includes(mReasoning))) return true;

        // 3. If turn is no longer streaming, do not keep stale assistant optimistic bubbles if persisted message exists
        if (!isStreaming && opt.role === "assistant" && mContent.length > 0) return true;

        return false;
      });

      if (!alreadyPersisted) {
        result.push(opt);
      }
    }
    return result;
  }, [chatMessages, optimisticMessages, isStreaming]);

  if (collapsed) {
    return (
      <aside className="w-10 bg-[var(--bg-panel)] border-l border-[var(--border-color)] flex flex-col items-center py-2 shrink-0 select-none transition-colors duration-150">
        <button
          type="button"
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

  return (
    <aside
      className="relative bg-[var(--bg-panel)] border-l border-[var(--border-color)] flex flex-col h-full shrink-0 select-text overflow-hidden transition-colors duration-150"
      style={{ width: width || 320 }}
    >
      {/* Panel Header */}
      <WorkstationRightChatHeader
        activeChatId={activeChatId}
        onNewChat={onNewChat}
        onClose={onClose}
      />

      {/* Messages List Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-4 font-sans text-xs min-w-0">
        {allMessages.length === 0 && !isStreaming ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 select-none">
            <div className="w-10 h-10 rounded-full bg-[var(--bg-card)] flex items-center justify-center mb-3 border border-[var(--border-color)]">
              <ArunakiLogo size={20} className="text-[var(--text-muted)]" />
            </div>
            <p className="text-xs font-medium text-[var(--text-primary)] mb-1">Workspace Agent</p>
            <p className="text-[11px] text-[var(--text-muted)] max-w-[200px]">
              Ask anything or provide document instructions.
            </p>
          </div>
        ) : (
          allMessages.map((msg, idx) => {
            const isUser = msg.role === "user";
            const isMsgStreaming = isStreaming && !isUser && idx === allMessages.length - 1;

            return (
              <ChatMessageBubble
                key={msg.id || idx}
                msg={msg}
                isUser={isUser}
                isStreaming={isMsgStreaming}
                showThinking={showThinking}
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
            <LiveMirrorCard
              screenshotUrl={liveStatus?.screenshot || ""}
              timestamp={liveStatus?.timestamp}
            />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Prompt Box & Queued Messages Card Area */}
      <div className="p-3 bg-[var(--bg-panel)] border-t border-[var(--border-color)] shrink-0 select-none transition-colors duration-150">
        <ChatQueuedPrompts
          queuedPrompts={queuedPrompts}
          onRemoveQueuedPrompt={onRemoveQueuedPrompt}
        />

        <ChatInputBox
          files={files}
          isStreaming={isStreaming}
          onSendMessage={onSendMessage}
          onCancelStream={onCancelStream}
          onSearchSection={onSearchSection}
          onNewChat={onNewChat}
          reasoningEffort={reasoningEffort}
          setReasoningEffort={setReasoningEffort}
          showThinking={showThinking}
          setShowThinking={setShowThinking}
          onPreviewImage={(url) => setLightboxUrl(url)}
        />
      </div>

      {/* Scoped Chat-Only Image Preview Modal */}
      <ChatImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </aside>
  );
}

export const WorkstationRightChat = memo(WorkstationRightChatComponent);
