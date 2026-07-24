import { Bot, User } from "lucide-react";
import { cn } from "../../lib/utils";

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

  return (
    <div
      className={cn(
        "flex gap-3 max-w-3xl",
        isUser ? "ml-auto flex-row-reverse" : ""
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
          isUser
            ? "bg-purple-100 dark:bg-purple-900/30"
            : "bg-gray-100 dark:bg-gray-800"
        )}
      >
        {isUser ? (
          <User
            size={16}
            className="text-purple-600 dark:text-purple-400"
          />
        ) : (
          <Bot size={16} className="text-gray-600 dark:text-gray-400" />
        )}
      </div>

      {/* Content */}
      <div
        className={cn(
          "px-4 py-2 rounded-lg",
          isUser
            ? "bg-purple-600 text-white"
            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
        )}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        {message.createdAt && (
          <p
            className={cn(
              "text-xs mt-1",
              isUser
                ? "text-purple-200"
                : "text-gray-500 dark:text-gray-500"
            )}
          >
            {new Date(message.createdAt).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );
}
