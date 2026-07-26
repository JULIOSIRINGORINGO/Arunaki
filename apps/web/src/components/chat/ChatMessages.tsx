import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import {
  BarChart3,
  FileCode,
  PenTool,
  Lightbulb,
  Sparkles,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

interface ChatMessagesProps {
  messages: Message[];
  isLoading?: boolean;
  onSelectPrompt?: (prompt: string) => void;
  onActionChipClick?: (prompt: string) => void;
}

const STARTER_CARDS = [
  {
    icon: BarChart3,
    title: "Analisis Laporan Keuangan",
    prompt: "Buatkan ringkasan tren pendapatan & pengeluaran dari data keuangan.",
  },
  {
    icon: FileCode,
    title: "Tinjau Kontrak Legal",
    prompt: "Cari risiko & klausa penting dari dokumen perjanjian kerja sama.",
  },
  {
    icon: PenTool,
    title: "Tulis Draf Dokumen",
    prompt: "Bantu buatkan draf proposal bisnis atau email profesional.",
  },
  {
    icon: Lightbulb,
    title: "Brainstorming Strategi",
    prompt: "Berikan ide & strategi pengembangan produk atau pemasaran.",
  },
];

export function ChatMessages({
  messages,
  isLoading,
  onSelectPrompt,
  onActionChipClick,
}: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-auto h-full flex flex-col justify-between">
      {messages.length === 0 && !isLoading ? (
        <div className="h-full flex flex-col items-center justify-center p-6 my-auto max-w-3xl mx-auto text-center space-y-8">
          {/* Logo & Heading */}
          <div className="space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-[#F8F9FA] border border-gray-200/90 shadow-2xs flex items-center justify-center mx-auto mb-3">
              <img
                src="/logo.svg"
                alt="Arunaki Logo"
                className="w-9 h-9 object-contain"
              />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Arunaki AI
            </h2>
            <p className="text-sm sm:text-base text-gray-500 max-w-md mx-auto">
              Ada yang bisa saya bantu hari ini? Silakan pilih topik rekomendasi di bawah ini atau langsung ketik instruksi Anda.
            </p>
          </div>

          {/* Starter Card Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full text-left">
            {STARTER_CARDS.map((card, idx) => {
              const IconComp = card.icon;
              return (
                <button
                  key={idx}
                  onClick={() => onSelectPrompt?.(card.prompt)}
                  className="bg-white border border-gray-200/90 hover:border-gray-300 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group active:scale-[0.98] flex flex-col justify-between space-y-2"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors shrink-0">
                      <IconComp className="w-4 h-4 text-gray-700 group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="font-bold text-sm text-gray-900 group-hover:text-black">
                      {card.title}
                    </h3>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed pl-0.5">
                    {card.prompt}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Footer Badge */}
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400 font-medium pt-2">
            <Sparkles className="w-3.5 h-3.5 text-gray-400" />
            <span>Kecerdasan Buatan Terenkripsi & Aman</span>
          </div>
        </div>
      ) : (
        <div className="w-full px-6 py-8 space-y-8 max-w-4xl mx-auto">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onActionChipClick={onActionChipClick}
            />
          ))}
        </div>
      )}

      {isLoading && (
        <div className="w-full px-6 py-8 max-w-4xl mx-auto">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-white border border-gray-200">
              <img src="/logo.svg" alt="Arunaki" className="w-5 h-5 object-contain" />
            </div>
            <div className="flex items-center gap-1.5 bg-gray-50 rounded-2xl rounded-tl-md px-4 py-3 border border-gray-100">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-sm text-gray-500 ml-1">Arunaki sedang berpikir...</span>
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
