import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import { Loader2 } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

interface ChatMessagesProps {
  messages: Message[];
  isLoading?: boolean;
}

export function ChatMessages({ messages, isLoading }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-auto p-6 space-y-4">
      {messages.length === 0 && !isLoading ? (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4">
            <span className="text-3xl">🤖</span>
          </div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Start a Conversation
          </h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-md">
            Ask Arunaki to help you analyze documents, create reports, or answer
            questions about your workspace.
          </p>
        </div>
      ) : (
        messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
      )}

      {isLoading && (
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <Loader2
              size={16}
              className="text-gray-600 dark:text-gray-400 animate-spin"
            />
          </div>
          <div className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Thinking...
            </p>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
