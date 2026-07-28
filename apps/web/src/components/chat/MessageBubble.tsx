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
  onActionChipClick?: (prompt: string) => void;
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="overflow-hidden min-w-0 break-words" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
    <Markdown
      components={{
        table: ({ children }) => (
          <div className="overflow-x-auto my-3 max-w-full">
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
          <td className="py-2 px-3 text-gray-800 break-words">{children}</td>
        ),
        p: ({ children }) => (
          <p className="mb-2 last:mb-0 leading-relaxed break-words">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside mb-2 space-y-0.5 break-words">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside mb-2 space-y-0.5 break-words">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed break-words">{children}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold text-gray-900">{children}</strong>
        ),
        code: ({ children, className }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-xs font-mono break-all">
                {children}
              </code>
            );
          }
          return (
            <code className="block bg-gray-900 text-gray-100 p-4 rounded-xl text-xs font-mono overflow-x-auto mb-3 whitespace-pre-wrap break-all">
              {children}
            </code>
          );
        },
        pre: ({ children }) => <pre className="mb-3 overflow-x-auto max-w-full whitespace-pre-wrap">{children}</pre>,
        h1: ({ children }) => (
          <h1 className="text-lg font-bold text-gray-900 mb-2 break-words">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-base font-bold text-gray-900 mb-2 break-words">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-bold text-gray-900 mb-1 break-words">{children}</h3>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-3 border-gray-300 pl-4 italic text-gray-600 my-2 break-words">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="border-gray-200 my-4" />,
      }}
    >
      {content}
    </Markdown>
    </div>
  );
}

export function MessageBubble({ message, onActionChipClick }: MessageBubbleProps) {
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
        <div className="flex items-start gap-3 max-w-[75%] min-w-0">
          <div className="bg-gray-100 rounded-2xl rounded-br-md px-4 py-3 text-base text-gray-800 leading-relaxed overflow-hidden break-words min-w-0 flex-1">
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

  // Only show chips when there is ACTUAL structured data, table, or explicit tool recommendation
  const hasStructuredTable =
    message.content.includes("|---") ||
    message.content.includes("| ---") ||
    (message.content.includes("[CANVAS]") && message.content.includes("TOTAL"));

  const isKnowledgeCommand =
    message.content.toLowerCase().includes("/knowledge") ||
    message.content.toLowerCase().includes("simpan ke knowledge base");

  const hasChips = hasStructuredTable || isKnowledgeCommand;

  return (
    <div className="flex flex-col items-start group animate-fade-in space-y-2">
      <div className="flex items-start gap-3 max-w-[85%] min-w-0">
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-white border border-gray-200 shadow-2xs">
          <img src="/logo.svg" alt="Arunaki" className="w-5 h-5 object-contain" />
        </div>
        <div className="text-base text-gray-700 leading-relaxed bg-white border border-gray-100/80 rounded-2xl p-4 shadow-2xs overflow-hidden break-words min-w-0 flex-1">
          <MarkdownContent content={message.content} />

          {/* Smart Action Chips — Only rendered when genuinely relevant */}
          {onActionChipClick && hasChips && (
            <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
              {hasStructuredTable && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      onActionChipClick(
                        "Tolong buatkan file Excel (.xlsx) dari rekap data ini agar bisa di-download."
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-medium border border-emerald-200 transition-colors cursor-pointer"
                  >
                    <span>📊 Unduh File Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onActionChipClick(
                        "Tolong buatkan file PDF (.pdf) resmi dari rekap data ini."
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium border border-blue-200 transition-colors cursor-pointer"
                  >
                    <span>📄 Unduh File PDF</span>
                  </button>
                </>
              )}

              {isKnowledgeCommand && (
                <button
                  type="button"
                  onClick={() =>
                    onActionChipClick(
                      "Simpan format dan aturan dari percakapan ini ke Knowledge Base saya."
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-medium border border-amber-200 transition-colors cursor-pointer"
                >
                  <span>💾 Simpan ke Knowledge</span>
                </button>
              )}
            </div>
          )}
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
