import { useState, useRef, useEffect } from "react";
import { Paperclip, Send } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full px-6 pb-6 pt-2 bg-transparent">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-3 bg-white border border-gray-200/90 rounded-2xl px-5 py-3.5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] focus-within:border-gray-300 focus-within:shadow-[0_4px_24px_rgba(0,0,0,0.08)] transition-all duration-150">
          <textarea
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ketik pesan Anda..."
            rows={1}
            disabled={disabled}
            className="flex-1 bg-transparent border-0 outline-none focus:outline-none focus:ring-0 text-gray-900 placeholder:text-gray-400 text-sm leading-relaxed min-h-[24px] max-h-[150px] py-1 resize-none disabled:opacity-40"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />

          <button
            type="button"
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 transition-colors shrink-0 cursor-pointer"
            title="Lampirkan file"
          >
            <Paperclip size={20} />
          </button>

          <button
            type="submit"
            disabled={!message.trim() || disabled}
            className="w-10 h-10 rounded-full bg-black text-white hover:bg-gray-800 transition-all flex items-center justify-center shrink-0 disabled:opacity-30 disabled:hover:bg-black disabled:cursor-not-allowed active:scale-95 shadow-xs cursor-pointer"
          >
            <Send size={15} className="ml-0.5 text-white" />
          </button>
        </div>
      </form>
    </div>
  );
}
