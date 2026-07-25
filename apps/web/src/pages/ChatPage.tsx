import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { ChatMessages } from "../components/chat/ChatMessages";
import { ChatInput } from "../components/chat/ChatInput";
import { CanvasPanel, CanvasData } from "../components/chat/CanvasPanel";
import { cn } from "../lib/utils";

const API_BASE = "http://localhost:3000/api/v1";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

function extractCanvasContentFromLLM(llmText: string): string {
  if (!llmText) return "";

  // 1. Extract from code blocks (most reliable - universal)
  const codeBlockMatch = llmText.match(/```[\w]*\n([\s\S]*?)\n```/);
  if (codeBlockMatch?.[1]) {
    const content = codeBlockMatch[1].trim();
    if (content.length > 5) return content;
  }

  // 2. Extract markdown tables
  const tableLines = llmText.split("\n").filter((l) => l.includes("|") && l.trim().length > 3);
  if (tableLines.length >= 3) {
    const cleaned = tableLines
      .filter((l) => !/^\s*\|[\s\-:|]+\|\s*$/.test(l))
      .map((l) => l.replace(/^\|/, "").replace(/\|$/, "").trim());
    if (cleaned.length >= 2) return cleaned.join("\n");
  }

  // 3. Extract structured lists (bullet/numbered) with 3+ items
  const listLines = llmText.split("\n").filter((l) => /^\s*[-*•]\s+/.test(l) || /^\s*\d+[.)]\s+/.test(l));
  if (listLines.length >= 3) {
    return listLines.map((l) => l.trim()).join("\n");
  }

  return "";
}

export function ChatPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const chatId = searchParams.get("chat");
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [canvasOpen, setCanvasOpen] = useState<boolean>(true);
  const [activeCanvasData, setActiveCanvasData] = useState<CanvasData | null>(null);

  const createChat = useMutation({
    mutationFn: async () => {
      try {
        const res = await fetch(`${API_BASE}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "chat" }),
        });
        const data = await res.json();
        return data.data.id;
      } catch (e) {
        return `chat-${Date.now()}`;
      }
    },
    onSuccess: (id) => {
      setSearchParams({ chat: id });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });

  const { data: messagesData = [] } = useQuery({
    queryKey: ["messages", chatId],
    queryFn: async () => {
      if (!chatId) return [];
      try {
        const res = await fetch(`${API_BASE}/chat/${chatId}/messages`);
        const data = await res.json();
        return data.data || [];
      } catch (e) {
        return [];
      }
    },
    enabled: !!chatId,
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      let activeId = chatId;
      if (!activeId) {
        activeId = await createChat.mutateAsync();
      }

      const tempId = `temp-${Date.now()}`;
      const userMsg: Message = {
        id: tempId,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };
      setOptimisticMessages((prev) => [...prev, userMsg]);

      try {
        const res = await fetch(`${API_BASE}/chat/${activeId}/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
        const responseData = await res.json();

        const toolOutputs = responseData?.data?.toolOutputs || [];
        let canvasContent = "";

        const preferredTools = ["calculate", "generate_export", "extract_structured_data"];
        for (const toolName of preferredTools) {
          const toolOutput = toolOutputs.find((t: any) => t.toolName === toolName && t.result?.plainTextOutput);
          if (toolOutput) {
            canvasContent = toolOutput.result.plainTextOutput;
            break;
          }
        }

        if (!canvasContent) {
          const fallback = toolOutputs.find((t: any) => t.result?.plainTextOutput);
          if (fallback) canvasContent = fallback.result.plainTextOutput;
        }

        if (!canvasContent) {
          const assistantContent =
            responseData?.data?.message?.content ||
            responseData?.data?.content ||
            "";
          canvasContent = extractCanvasContentFromLLM(assistantContent);
        }

        if (canvasContent) {
          const firstTool = toolOutputs[0];
          const title = firstTool?.toolName
            ? firstTool.toolName.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
            : "Hasil";

          setActiveCanvasData({
            id: `canvas-${Date.now()}`,
            title,
            brandColorHeader: "",
            plainTextContent: canvasContent,
            createdAt: new Date().toLocaleTimeString(),
          });
          setCanvasOpen(true);
        }

        queryClient.invalidateQueries({ queryKey: ["messages", activeId] });
        queryClient.invalidateQueries({ queryKey: ["chats"] });

        return responseData;
      } catch (e) {
        return { success: true };
      } finally {
        setOptimisticMessages([]);
      }
    },
  });

  const serverMessages: Message[] =
    messagesData?.map((msg: any) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt,
    })) || [];

  const serverContentSet = new Set(serverMessages.map((m) => m.content));
  const filteredOptimistic = optimisticMessages.filter(
    (m) => !serverContentSet.has(m.content)
  );
  const messages = [...serverMessages, ...filteredOptimistic];

  const handleSend = (content: string) => {
    sendMessage.mutate(content);
  };

  return (
    <div className="flex h-full w-full bg-white min-w-0 overflow-hidden">
      {/* Kolom 2: Chat Area Utama */}
      <div className="flex flex-col flex-1 h-full min-w-0 bg-white">
        {/* Header Chat */}
        <div className="shrink-0 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Chat</h1>

          <button
            onClick={() => setCanvasOpen(!canvasOpen)}
            className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-2xs active:scale-[0.98]",
              canvasOpen
                ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
            )}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>{canvasOpen ? "Sembunyikan Canvas" : "Buka Canvas"}</span>
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-auto min-h-0 px-6">
          <ChatMessages
            messages={messages}
            isLoading={sendMessage.isPending}
            onSelectPrompt={handleSend}
          />
        </div>

        {/* Input Composer */}
        <div className="shrink-0">
          <ChatInput
            onSend={handleSend}
            disabled={sendMessage.isPending}
          />
        </div>
      </div>

      {/* Kolom 3: Canvas Panel Clean */}
      <CanvasPanel
        isOpen={canvasOpen}
        onClose={() => setCanvasOpen(false)}
        canvasData={activeCanvasData}
      />
    </div>
  );
}
