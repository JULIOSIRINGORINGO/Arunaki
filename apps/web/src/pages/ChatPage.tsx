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

  let textToParse = llmText;

  // 1. If codeblock exists, extract inside
  const codeBlockMatch = llmText.match(/```(?:text|plain|markdown)?\s*\n([\s\S]*?)\n```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    textToParse = codeBlockMatch[1];
  }

  // 2. Filter lines to only include actual header or size recap lines
  const lines = textToParse
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const cleanLines = lines.filter((l) => {
    // Exclude any English reasoning/thinking lines
    if (
      /^\s*(The user|Let's|Let me|I need|Parsing|Looking at|First,|It seems|We need|In the input|Tokens:|Sizes set:|List of)/i.test(l)
    ) {
      return false;
    }
    // Only accept header (e.g. BRAND WARNA, KAOS JALAN2) or size lines (e.g. S 5, M 8, TOTAL 25 PCS)
    return /^(BRAND|MEREK|[A-Z0-9\s]{3,}|S\s+\d+|M\s+\d+|L\s+\d+|XL\s+\d+|2XL\s+\d+|3XL\s+\d+|4XL\s+\d+|TOTAL)/i.test(l);
  });

  if (cleanLines.length >= 2) {
    return cleanLines.join("\n").trim();
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

        const toolOutput = responseData?.data?.toolOutput;
        let canvasContent = "";

        if (toolOutput?.plainTextOutput) {
          canvasContent = toolOutput.plainTextOutput;
        } else {
          const assistantContent =
            responseData?.data?.message?.content ||
            responseData?.data?.content ||
            "";
          canvasContent = extractCanvasContentFromLLM(assistantContent);
        }

        if (canvasContent) {
          setActiveCanvasData({
            id: `canvas-${Date.now()}`,
            title: `Canvas`,
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

  const messages = [...serverMessages, ...optimisticMessages];

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
