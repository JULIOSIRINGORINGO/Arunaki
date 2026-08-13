import { RefObject } from "react";
import Markdown from "react-markdown";
import { Bot, PanelRightClose, PanelRightOpen, Sparkles, Paperclip, Send, Loader2 } from "lucide-react";
import { LiveExecutionBadge, LiveStatusData } from "../chat/LiveExecutionBadge";
import { LiveMirrorCard } from "../chat/LiveMirrorCard";
import { cn } from "../../lib/utils";

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
}: WorkstationRightChatProps) {
  /* Thin Icon Strip when Collapsed (Clicking re-opens the panel) */
  if (collapsed) {
    return (
      <aside className="w-10 bg-[#121212] border-l border-[#383838] flex flex-col items-center py-2 shrink-0 select-none">
        <button
          onClick={onClose}
          className="text-[#A3A3A3] hover:text-white p-1.5 rounded-md hover:bg-[#1E1E1E] transition-colors cursor-pointer"
          title="Buka Panel Chat"
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

  return (
    <aside className="w-80 bg-[#121212] text-[#FFFFFF] border-l border-[#383838] flex flex-col shrink-0">
      <div className="px-3 py-2.5 border-b border-[#383838] flex items-center justify-between">
        <span className="text-xs font-semibold text-[#E5E5E5] flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-[#A3A3A3]" />
          Chat
        </span>
        <button
          onClick={onClose}
          className="text-[#A3A3A3] hover:text-white p-1 rounded-md hover:bg-[#1E1E1E] transition-colors cursor-pointer"
          title="Tutup Panel Chat"
        >
          <PanelRightClose className="w-4 h-4" />
        </button>
      </div>

      {/* Chat Stream Messages */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3">
        {allMessages.length === 0 ? (
          <div className="p-4 bg-[#1E1E1E] rounded-xl border border-[#383838] text-center">
            <Sparkles className="w-5 h-5 text-[#E5E5E5] mx-auto mb-2" />
            <p className="text-xs font-semibold text-white mb-1">
              {activeWorkspace ? "Workspace Agent Ready" : "AI Assistant Ready"}
            </p>
            <p className="text-[11px] text-[#A3A3A3] leading-relaxed">
              Ketik perintah atau tanya seputar dokumen. Gunakan <code className="text-white bg-[#262626] px-1 py-0.5 rounded">@filename</code> untuk mereferensikan file.
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
                    ? "bg-[#262626] text-white border-[#525252] rounded-tr-none"
                    : "bg-[#1E1E1E] text-[#E5E5E5] border-[#383838] rounded-tl-none"
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
      <div className="p-3 border-t border-[#383838] bg-[#121212]">
        <div className="bg-[#1E1E1E] rounded-xl p-2.5 border border-[#383838] focus-within:border-[#666666] transition-colors relative">
          <textarea
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSendMessage();
              }
            }}
            placeholder={
              activeWorkspace
                ? "Beri tugas (contoh: Rekap @Laporan.xlsx ke Excel)..."
                : "Ketik pertanyaan atau tugas di sini..."
            }
            rows={2}
            className="w-full bg-transparent text-xs text-[#FFFFFF] placeholder-[#737373] resize-none focus:outline-none"
          />

          <div className="flex items-center justify-between pt-1 border-t border-[#383838] mt-1">
            <div className="flex items-center gap-2">
              <button className="text-[#A3A3A3] hover:text-white p-1 rounded transition-colors cursor-pointer">
                <Paperclip className="w-3.5 h-3.5" />
              </button>
              {activeWorkspace && (
                <span className="text-[10px] bg-[#262626] text-[#E5E5E5] px-2 py-0.5 rounded-full font-medium border border-[#383838]">
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
