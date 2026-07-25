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

function MarkdownContent({ content }: { content: string }) {
  return (
    <Markdown
      components={{
        table: ({ children }) => (
          <div className="overflow-x-auto my-3">
            <table className="w-full text-sm border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="border-b border-gray-200">{children}</thead>
        ),
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => (
          <tr className="border-b border-gray-100 last:border-0">{children}</tr>
        ),
        th: ({ children }) => (
          <th className="text-left py-2 px-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="py-2 px-3 text-gray-800">{children}</td>
        ),
        p: ({ children }) => (
          <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold text-gray-900">{children}</strong>
        ),
        code: ({ children, className }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-xs font-mono">
                {children}
              </code>
            );
          }
          return (
            <code className="block bg-gray-900 text-gray-100 p-4 rounded-xl text-xs font-mono overflow-x-auto mb-3">
              {children}
            </code>
          );
        },
        pre: ({ children }) => <pre className="mb-3">{children}</pre>,
        h1: ({ children }) => (
          <h1 className="text-lg font-bold text-gray-900 mb-2">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-bold text-gray-900 mb-2">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-bold text-gray-900 mb-1">{children}</h3>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-3 border-gray-300 pl-4 italic text-gray-600 my-2">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="border-gray-200 my-4" />,
      }}
    >
      {content}
    </Markdown>
  );
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
            <MarkdownContent content={message.content} />
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
          <MarkdownContent content={message.content} />
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
