import { useState } from "react";
import { User, Copy, Check } from "lucide-react";
import Markdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  async function copyMessage() {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  const time = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  if (isUser) {
    return (
      <div className="flex flex-col items-end group animate-fade-in">
        <div className="flex items-start gap-3 max-w-[75%]">
          <div className="bg-gray-100 rounded-2xl rounded-br-md px-4 py-3 text-base text-gray-800 leading-relaxed">
            <Markdown>{message.content}</Markdown>
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-200">
            <User size={16} className="text-gray-600" />
          </div>
        </div>
        {time && (
          <span className="text-xs text-gray-400 mr-11">{time}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start group animate-fade-in">
      <div className="flex items-start gap-3 max-w-[75%]">
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-white border border-gray-200">
          <img src="/logo.svg" alt="Arunaki" className="w-5 h-5 object-contain" />
        </div>
        <div className="text-base text-gray-700 leading-relaxed">
          <Markdown>{message.content}</Markdown>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-11">
        {time && (
          <span className="text-xs text-gray-400">{time}</span>
        )}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            type="button"
            aria-label={copied ? "Copied" : "Copy message"}
            onClick={copyMessage}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}
