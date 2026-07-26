import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { ChatMessages } from "../components/chat/ChatMessages";
import { ChatInput } from "../components/chat/ChatInput";
import type { CanvasData } from "../components/chat/CanvasPanel";
import { CanvasPanel } from "../components/chat/CanvasPanel";
import { cn } from "../lib/utils";

const API_BASE = "http://localhost:3000/api/v1";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

interface ToolOutput {
  toolName: string;
  args: Record<string, any>;
  result: {
    status: "success" | "error" | "partial";
    data: Record<string, any>;
    preview: string;
    metadata: {
      toolName: string;
      displayName: string;
      executionTime: number;
      format?: string;
      filename?: string;
      mimeType?: string;
      contentBase64?: string;
    };
    error?: {
      code: string;
      message: string;
    };
  };
}

interface Artifact {
  id: string;
  type: string;
  filename: string;
  mimeType: string;
  preview: string;
  status: string;
  createdAt: string;
}

function extractCanvasContentFromLLM(llmText: string): string {
  if (!llmText) return "";

  // 1. Priority: [CANVAS]...[/CANVAS] marker
  const canvasMatch = llmText.match(/\[CANVAS\]\s*([\s\S]*?)\s*\[\/CANVAS\]/i);
  if (canvasMatch?.[1]) {
    const content = canvasMatch[1].trim();
    if (content.length > 3) return content;
  }

  // 2. Fallback: code block
  const codeBlockMatch = llmText.match(/```[\w]*\n([\s\S]*?)\n```/);
  if (codeBlockMatch?.[1]) {
    const content = codeBlockMatch[1].trim();
    if (content.length > 5) return content;
  }

  // 3. Fallback: markdown table
  const tableLines = llmText
    .split("\n")
    .filter((l) => l.includes("|") && l.trim().length > 3);
  if (tableLines.length >= 3) {
    const cleaned = tableLines
      .filter((l) => !/^\s*\|[\s\-:|]+\|\s*$/.test(l))
      .map((l) => l.replace(/^\|/, "").replace(/\|$/, "").trim());
    if (cleaned.length >= 2) return cleaned.join("\n");
  }

  // 4. Fallback: structured block (header + list + total as one unit)
  const lines = llmText.split("\n");
  const structuredLines: string[] = [];
  let inBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inBlock) structuredLines.push("");
      continue;
    }

    const isHeader = /^(\*\*[^*]+\*\*|[A-Z][A-Z\s\d/]{2,})$/.test(trimmed);
    const isList = /^\d+[.)]\s+/.test(trimmed) || /^[-*•]\s+/.test(trimmed);
    const isTotal = /total/i.test(trimmed) && /\d/.test(trimmed);

    if (isHeader || isList || isTotal) {
      inBlock = true;
      structuredLines.push(trimmed);
    } else if (inBlock) {
      // Stop collecting when we hit a non-structural line after data
      const dataLines = structuredLines.filter((l) => l.length > 0);
      if (dataLines.length >= 3) break;
      // Not enough data yet, reset
      structuredLines.length = 0;
      inBlock = false;
    }
  }

  const finalLines = structuredLines
    .join("\n")
    .trim()
    .split("\n")
    .filter((_, i, arr) => {
      // Trim trailing empty lines
      if (arr.slice(i).every((l) => l.trim() === "")) return false;
      return true;
    });

  if (finalLines.filter((l) => l.length > 0).length >= 3) {
    return finalLines.join("\n");
  }

  return "";
}

export function ChatPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const chatId = searchParams.get("chat");
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [canvasOpen, setCanvasOpen] = useState<boolean>(true);
  const [activeCanvasData, setActiveCanvasData] = useState<CanvasData | null>(
    null,
  );
  const [pendingDownload, setPendingDownload] = useState<{
    filename: string;
    mimeType: string;
    base64: string;
  } | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [pendingChatId, setPendingChatId] = useState<string | null>(null);

  // Clear local state whenever chatId URL parameter changes (e.g. switching chats or creating a new chat)
  useEffect(() => {
    setOptimisticMessages([]);
    setActiveCanvasData(null);
    setPendingDownload(null);
    setArtifacts([]);
    if (!chatId) {
      setPendingChatId(null);
    }
  }, [chatId]);

  const effectiveChatId = chatId || pendingChatId;

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
      } catch {
        return `chat-${Date.now()}`;
      }
    },
    onSuccess: (id) => {
      setPendingChatId(id);
      setSearchParams({ chat: id });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });

  const { data: messagesData = [] } = useQuery({
    queryKey: ["messages", effectiveChatId],
    queryFn: async () => {
      if (!effectiveChatId) return [];
      try {
        const res = await fetch(`${API_BASE}/chat/${effectiveChatId}/messages`);
        const data = await res.json();
        return data.data || [];
      } catch {
        return [];
      }
    },
    enabled: !!effectiveChatId,
  });

  // Automatically restore Canvas content from chat history when opening an existing chat
  useEffect(() => {
    if (messagesData && messagesData.length > 0) {
      const assistantMessages = messagesData.filter((m: any) => m.role === "assistant");
      for (let i = assistantMessages.length - 1; i >= 0; i--) {
        const msg = assistantMessages[i];
        if (msg.content) {
          const extracted = extractCanvasContentFromLLM(msg.content);
          if (extracted) {
            setActiveCanvasData({
              id: `canvas-${msg.id}`,
              title: "Hasil",
              brandColorHeader: "",
              plainTextContent: extracted,
              createdAt: msg.createdAt || new Date().toLocaleTimeString(),
            });
            break;
          }
        }
      }
    }
  }, [messagesData]);

  const { data: artifactsData = [] } = useQuery({
    queryKey: ["artifacts", effectiveChatId],
    queryFn: async () => {
      if (!effectiveChatId) return [];
      try {
        const res = await fetch(`${API_BASE}/chat/${effectiveChatId}/artifacts`);
        const data = await res.json();
        return data.data || [];
      } catch {
        return [];
      }
    },
    enabled: !!effectiveChatId,
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      let activeId = effectiveChatId;
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

        if (responseData?.error) {
          throw new Error(responseData.error.message || "Gagal mengirim pesan");
        }

        const toolOutputs: ToolOutput[] =
          responseData?.data?.toolOutputs || [];
        const responseArtifacts: Artifact[] =
          responseData?.data?.artifacts || [];

        let canvasContent = "";
        let canvasTitle = "Hasil";
        let downloadInfo: typeof pendingDownload = null;

        const previewPriorities = [
          "calculate",
          "generate_export",
          "extract_structured_data",
        ];

        for (const toolName of previewPriorities) {
          const toolOutput = toolOutputs.find(
            (t) => t.toolName === toolName && t.result?.preview,
          );
          if (toolOutput) {
            canvasContent = toolOutput.result.preview;
            canvasTitle =
              toolOutput.result.metadata?.displayName ||
              toolName.replace(/_/g, " ");
            break;
          }
        }

        if (!canvasContent) {
          const anyWithPreview = toolOutputs.find(
            (t) => t.result?.preview,
          );
          if (anyWithPreview) {
            canvasContent = anyWithPreview.result.preview;
            canvasTitle =
              anyWithPreview.result.metadata?.displayName ||
              anyWithPreview.toolName.replace(/_/g, " ");
          }
        }

        if (!canvasContent) {
          const assistantContent =
            responseData?.data?.message?.content ||
            responseData?.data?.content ||
            "";
          canvasContent = extractCanvasContentFromLLM(assistantContent);
        }

        const downloadable = toolOutputs.find(
          (t) => t.result?.metadata?.contentBase64,
        );
        if (downloadable) {
          downloadInfo = {
            filename:
              downloadable.result.metadata.filename || "export.file",
            mimeType:
              downloadable.result.metadata.mimeType || "application/octet-stream",
            base64: downloadable.result.metadata.contentBase64!,
          };
        }

        if (canvasContent) {
          setActiveCanvasData({
            id: `canvas-${Date.now()}`,
            title: canvasTitle,
            brandColorHeader: "",
            plainTextContent: canvasContent,
            createdAt: new Date().toLocaleTimeString(),
          });
          setCanvasOpen(true);
        }

        setPendingDownload(downloadInfo);

        if (responseArtifacts.length > 0) {
          setArtifacts((prev) => [...responseArtifacts, ...prev]);
        }

        await queryClient.invalidateQueries({
          queryKey: ["messages", activeId],
        });
        queryClient.invalidateQueries({ queryKey: ["chats"] });
        queryClient.invalidateQueries({
          queryKey: ["artifacts", activeId],
        });

        return responseData;
      } catch (e) {
        setOptimisticMessages((prev) => prev.filter((m) => m.id !== tempId));
        throw e;
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
    (m) => !serverContentSet.has(m.content),
  );
  const messages = [...serverMessages, ...filteredOptimistic];

  const allArtifacts = [
    ...artifacts,
    ...artifactsData.filter(
      (a: Artifact) => !artifacts.some((pa) => pa.id === a.id),
    ),
  ];

  const handleSend = (content: string) => {
    sendMessage.mutate(content);
  };

  return (
    <div className="flex h-full w-full bg-white min-w-0 overflow-hidden">
      <div className="flex flex-col flex-1 h-full min-w-0 bg-white">
        <div className="shrink-0 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight">
            Chat
          </h1>

          <button
            onClick={() => setCanvasOpen(!canvasOpen)}
            className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-2xs active:scale-[0.98]",
              canvasOpen
                ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50",
            )}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>{canvasOpen ? "Sembunyikan Canvas" : "Buka Canvas"}</span>
          </button>
        </div>

        <div className="flex-1 overflow-auto min-h-0 px-6">
          <ChatMessages
            messages={messages}
            isLoading={sendMessage.isPending}
            onSelectPrompt={handleSend}
          />
        </div>

        <div className="shrink-0">
          <ChatInput
            onSend={handleSend}
            disabled={sendMessage.isPending}
          />
        </div>
      </div>

      <CanvasPanel
        isOpen={canvasOpen}
        onClose={() => setCanvasOpen(false)}
        canvasData={activeCanvasData}
        pendingDownload={pendingDownload}
        artifacts={allArtifacts}
      />
    </div>
  );
}
