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

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 180)}px`;
    }
  }, [message]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage("");
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
      }
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
        <div className="flex items-center gap-3 bg-white border border-gray-200/90 rounded-[28px] px-6 py-3.5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] focus-within:border-gray-300 focus-within:shadow-[0_6px_28px_rgba(0,0,0,0.07)] transition-all duration-200">
          <textarea
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ketik pesan Anda..."
            rows={1}
            disabled={disabled}
            className="flex-1 bg-transparent border-0 outline-hidden focus:outline-hidden text-gray-900 placeholder:text-gray-400 text-sm leading-relaxed min-h-[24px] max-h-[180px] py-1 resize-none disabled:opacity-40 overflow-y-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          />

          <div className="flex items-center gap-2 shrink-0 self-end pb-0.5">
            <button
              type="button"
              className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              title="Lampirkan file"
            >
              <Paperclip size={19} />
            </button>

            <button
              type="submit"
              disabled={!message.trim() || disabled}
              className="w-10 h-10 rounded-full bg-black text-white hover:bg-gray-800 transition-all flex items-center justify-center disabled:opacity-25 disabled:hover:bg-black disabled:cursor-not-allowed active:scale-95 shadow-xs cursor-pointer"
            >
              <Send size={15} className="ml-0.5 text-white" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
