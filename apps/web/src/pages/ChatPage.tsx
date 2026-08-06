import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { ChatMessages } from "../components/chat/ChatMessages";
import { ChatInput } from "../components/chat/ChatInput";
import type { CanvasData } from "../components/chat/CanvasPanel";
import { CanvasPanel } from "../components/chat/CanvasPanel";
import { LiveExecutionBadge, LiveStatusData } from "../components/chat/LiveExecutionBadge";
import { LiveMirrorCard } from "../components/chat/LiveMirrorCard";
import { cn } from "../lib/utils";
import { API_BASE, apiFetch } from "../lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
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
  const [liveStatus, setLiveStatus] = useState<LiveStatusData | null>(null);
  const [liveScreenshotUrl, setLiveScreenshotUrl] = useState<string | null>(null);

  const pathParam = searchParams.get("path");

  // Connect folder when path parameter is passed in URL (e.g. from open folder button)
  useEffect(() => {
    if (pathParam) {
      const connectSelectedFolder = async () => {
        try {
          const folderName = pathParam.split(/[/\\]/).pop() || pathParam;
          const wsRes = await apiFetch(`${API_BASE}/workspaces`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: folderName, rootPath: pathParam }),
          });
          const wsJson = await wsRes.json();
          const newId = wsJson.data?.id;
          if (newId) {
            localStorage.setItem("arunaki_workspace_id", newId);
            queryClient.invalidateQueries({ queryKey: ["files", newId] });
            toast.success(`Folder "${folderName}" terhubung!`);
          }
        } catch (err) {
          console.error("Connect folder failed:", err);
        }
      };
      connectSelectedFolder();
    }
  }, [pathParam, queryClient]);

  // Clear local state whenever chatId URL parameter changes (e.g. switching chats or creating a new chat)
  useEffect(() => {
    setOptimisticMessages([]);
    setActiveCanvasData(null);
    setPendingDownload(null);
    setArtifacts([]);
    setLiveStatus(null);
    setLiveScreenshotUrl(null);
    if (!chatId) {
      setPendingChatId(null);
    }
  }, [chatId]);


  const effectiveChatId = chatId || pendingChatId;

  const createChat = useMutation({
    mutationFn: async () => {
      try {
        const res = await apiFetch(`${API_BASE}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "chat" }),
        });
        const data = await res.json();
        if (!data.data?.id) {
          throw new Error("Gagal membuat chat");
        }
        return data.data.id;
      } catch (e) {
        throw e; // no fabricated id — surface the failure instead of sending to a dead chat
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
        const res = await apiFetch(`${API_BASE}/chat/${effectiveChatId}/messages`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.data || [];
      } catch {
        return [];
      }
    },
    enabled: !!effectiveChatId,
  });

  // Automatically restore Canvas content & reset optimistic messages when chat history arrives
  useEffect(() => {
    if (messagesData && messagesData.length > 0) {
      setOptimisticMessages([]);
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
        const res = await apiFetch(`${API_BASE}/chat/${effectiveChatId}/artifacts`);
        if (!res.ok) return [];
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

      const tempUserMsgId = `temp-user-${Date.now()}`;
      const tempAssistantMsgId = `temp-assistant-${Date.now()}`;

      const userMsg: Message = {
        id: tempUserMsgId,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };

      setOptimisticMessages((prev) => [...prev, userMsg]);

      try {
        let fullStreamedContent = "";

        await fetchEventSource(`${API_BASE}/chat/${activeId}/stream`, {
        fetch: apiFetch,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
          onmessage(msg) {
            if (!msg.data) return;
            try {
              const event = JSON.parse(msg.data);
              if (event.type === "tool_live_status" && event.data) {
                setLiveStatus({
                  toolName: event.data.toolName,
                  preview: event.data.preview,
                  screenshot: event.data.screenshot,
                  timestamp: event.data.timestamp,
                });
                if (event.data.screenshot) {
                  setLiveScreenshotUrl(event.data.screenshot);
                }
              } else if (event.type === "text_delta" && typeof event.data === "string") {
                fullStreamedContent += event.data;
                setOptimisticMessages((prev) => {
                  const filtered = prev.filter((m) => m.id !== tempAssistantMsgId);
                  return [
                    ...filtered,
                    {
                      id: tempAssistantMsgId,
                      role: "assistant",
                      content: fullStreamedContent,
                      createdAt: new Date().toISOString(),
                    },
                  ];
                });
                const extracted = extractCanvasContentFromLLM(fullStreamedContent);
                if (extracted) {
                  setActiveCanvasData({
                    id: `canvas-${Date.now()}`,
                    title: "Hasil",
                    brandColorHeader: "",
                    plainTextContent: extracted,
                    createdAt: new Date().toLocaleTimeString(),
                  });
                  setCanvasOpen(true);
                }
              } else if (event.type === "tool_done" && event.data?.result?.preview) {
                if (event.data.result.data?.screenshot) {
                  setLiveScreenshotUrl(event.data.result.data.screenshot);
                }
                setActiveCanvasData({
                  id: `canvas-tool-${Date.now()}`,
                  title: event.data.result.metadata?.displayName || event.data.toolName.replace(/_/g, " "),
                  brandColorHeader: "",
                  plainTextContent: event.data.result.preview,
                  createdAt: new Date().toLocaleTimeString(),
                });
                setCanvasOpen(true);
              }
            } catch {
              // ignore parse errors
            }
          },
          onclose() {
            // Stream closed gracefully by server
          },
          onerror(err) {
            console.error("SSE stream error:", err);
            throw err; // Stop automatic retries
          },
        });

        await queryClient.invalidateQueries({ queryKey: ["messages", activeId] });
        queryClient.invalidateQueries({ queryKey: ["chats"] });
        queryClient.invalidateQueries({ queryKey: ["artifacts", activeId] });
      } catch (e) {
        setOptimisticMessages((prev) => prev.filter((m) => m.id !== tempUserMsgId && m.id !== tempAssistantMsgId));
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
    // ponytail: dedupe on temp-id prefix, not content, so identical sends don't hide each other
    (m) => m.id.startsWith("temp-") && !serverContentSet.has(m.content),
  );
  const messages = [...serverMessages, ...filteredOptimistic];

  const allArtifacts = [
    ...artifacts,
    ...artifactsData.filter(
      (a: Artifact) => !artifacts.some((pa) => pa.id === a.id),
    ),
  ];

  const handleSend = (content: string) => {
    if (sendMessage.isPending) return; // no double-send while a turn is in flight
    sendMessage.mutate(content, {
      onError: (err) => {
        try {
          const parsed = JSON.parse(err.message);
          if (parsed?.error?.code === "TURN_IN_PROGRESS") {
            toast.error("Agent masih bekerja, tunggu sampai selesai.");
            return;
          }
        } catch {
          // plain message
        }
        toast.error(err.message || "Gagal mengirim pesan.");
      },
    });
  };

  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) {
      setIsDraggingFile(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      const isImage = file.type.startsWith("image/");
      const reader = new FileReader();

      if (isImage) {
        reader.readAsDataURL(file);
        reader.onload = () => {
          handleSend(`Tolong analisis foto/struk ini (${file.name}):\n\n[Foto/Gambar Terlampir]: ${reader.result}`);
        };
      } else {
        reader.readAsText(file);
        reader.onload = () => {
          handleSend(`Berikut isi file ${file.name}:\n\n[Isi File Terlampir (${file.name})]:\n\`\`\`\n${reader.result}\n\`\`\``);
        };
      }
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex h-full w-full gap-4 min-w-0 overflow-hidden"
    >
      {/* Drag & Drop File Overlay Backdrop */}
      {isDraggingFile && (
        <div className="absolute inset-0 bg-emerald-900/60 backdrop-blur-xs z-50 flex flex-col items-center justify-center text-white space-y-3 animate-fade-in border-4 border-dashed border-emerald-300 pointer-events-none rounded-[24px]">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center shadow-lg">
            <Sparkles className="w-8 h-8 text-white animate-bounce" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Lepas File di Sini</h2>
          <p className="text-sm text-emerald-100 font-medium">
            AI Assistant akan membaca & mengolah isi file secara instant
          </p>
        </div>
      )}

      {/* Main Workspace White Card with Dark Top Header Bar */}
      <div className="bg-white rounded-[24px] overflow-hidden flex flex-col flex-1 h-full min-w-0 shadow-sm border border-stone-200/50">
        {/* Dark Top Header Bar */}
        <div className="bg-[#1A191B] h-11 min-h-[44px] px-5 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-3">
            <span className="text-white font-bold text-xs tracking-wide">
              Chat & Workspace Assistant
            </span>
            <LiveExecutionBadge status={liveStatus} active={sendMessage.isPending} />
          </div>

          <button
            onClick={() => setCanvasOpen(!canvasOpen)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer shadow-xs active:scale-95",
              canvasOpen
                ? "bg-[#C4B5FD] text-[#1A191B]"
                : "bg-stone-800 text-stone-300 hover:text-white"
            )}
          >
            <Sparkles className="w-3 h-3 text-[#FF5E38]" />
            <span>{canvasOpen ? "Sembunyikan Canvas" : "Buka Canvas"}</span>
          </button>
        </div>

        {/* White Chat Messages View */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 min-w-0 px-6 py-4 bg-white">
          <ChatMessages
            messages={messages}
            isLoading={sendMessage.isPending}
            onSelectPrompt={handleSend}
            onActionChipClick={handleSend}
          />
          {liveScreenshotUrl && (
            <LiveMirrorCard screenshotUrl={liveScreenshotUrl} />
          )}
        </div>

        {/* Input Footer */}
        <div className="shrink-0 bg-white border-t border-stone-100">
          <ChatInput
            onSend={handleSend}
            disabled={sendMessage.isPending}
          />
        </div>
      </div>

      {/* Canvas Panel */}
      <CanvasPanel
        isOpen={canvasOpen}
        onClose={() => setCanvasOpen(false)}
        canvasData={activeCanvasData}
        pendingDownload={pendingDownload}
        artifacts={allArtifacts}
        liveScreenshotUrl={liveScreenshotUrl}
        onSaveAndSendToAi={(updatedContent) =>
          handleSend(
            "Saya telah mengedit data di Canvas secara manual menjadi sebagai berikut:\n\n" +
              updatedContent +
              "\n\nTolong hitung ulang & update rekapnya berdasarkan editan terbaru saya ini."
          )
        }
      />
    </div>
  );
}

