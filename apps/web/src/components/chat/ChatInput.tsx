import { useState, useRef, useEffect } from "react";
import { Paperclip, Send, BookOpen, FileText, Calculator, Search, X, Image as ImageIcon } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

const COMMANDS = [
  {
    name: "/knowledge",
    description: "Buat Knowledge Base baru",
    icon: BookOpen,
  },
  {
    name: "/search",
    description: "Cari dokumen atau knowledge",
    icon: Search,
  },
  {
    name: "/calculate",
    description: "Hitung harga/total",
    icon: Calculator,
  },
  {
    name: "/export",
    description: "Export ke PDF/Excel/Word",
    icon: FileText,
  },
];

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState(COMMANDS);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commandsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 180)}px`;
    }
  }, [message]);

  useEffect(() => {
    if (message.startsWith("/")) {
      const query = message.toLowerCase();
      const filtered = COMMANDS.filter(
        (cmd) =>
          cmd.name.toLowerCase().includes(query) ||
          cmd.description.toLowerCase().includes(query)
      );
      setFilteredCommands(filtered);
      setShowCommands(filtered.length > 0);
      setSelectedCommandIndex(0);
    } else {
      setShowCommands(false);
    }
  }, [message]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        commandsRef.current &&
        !commandsRef.current.contains(event.target as Node)
      ) {
        setShowCommands(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFile(file);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((message.trim() || attachedFile) && !disabled && !isReadingFile) {
      let finalPrompt = message.trim();

      if (attachedFile) {
        setIsReadingFile(true);
        try {
          const isImage = attachedFile.type.startsWith("image/");
          const isBinaryDoc =
            attachedFile.name.endsWith(".pdf") ||
            attachedFile.name.endsWith(".docx") ||
            attachedFile.name.endsWith(".xlsx") ||
            attachedFile.name.endsWith(".xls") ||
            attachedFile.type.includes("pdf") ||
            attachedFile.type.includes("wordprocessingml") ||
            attachedFile.type.includes("spreadsheetml");

          const reader = new FileReader();

          if (isImage || isBinaryDoc) {
            const base64Data = await new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(attachedFile);
            });
            const textIntro = finalPrompt || `Tolong baca dan analisis file terlampir ini (${attachedFile.name}).`;
            finalPrompt = `${textIntro}\n\n[Dokumen/Gambar Terlampir (${attachedFile.name})]: ${base64Data}`;
          } else {
            const textContent = await new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsText(attachedFile);
            });
            const textIntro = finalPrompt || `Berikut isi file ${attachedFile.name}:`;
            finalPrompt = `${textIntro}\n\n[Isi File Terlampir (${attachedFile.name})]:\n\`\`\`\n${textContent}\n\`\`\``;
          }
        } catch {
          finalPrompt += `\n[File terlampir: ${attachedFile.name}]`;
        } finally {
          setIsReadingFile(false);
          setAttachedFile(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      }

      onSend(finalPrompt);
      setMessage("");
      setShowCommands(false);
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
      }
    }
  };

  const handleCommandSelect = (command: string) => {
    setMessage(command + " ");
    setShowCommands(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showCommands) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedCommandIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedCommandIndex((prev) =>
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        );
      } else if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        handleCommandSelect(filteredCommands[selectedCommandIndex].name);
      } else if (e.key === "Escape") {
        setShowCommands(false);
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full px-6 pb-6 pt-2 bg-transparent relative">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.txt,.csv,.json,.md,.docx,.xlsx"
        onChange={handleFileChange}
        className="hidden"
      />

      {showCommands && filteredCommands.length > 0 && (
        <div
          ref={commandsRef}
          className="absolute bottom-full left-6 right-6 mb-2 bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden z-50 max-w-4xl mx-auto w-full"
        >
          <div className="px-3 py-2 border-b border-gray-100">
            <span className="text-xs font-medium text-gray-500">
              Slash Commands
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filteredCommands.map((command, index) => {
              const Icon = command.icon;
              return (
                <button
                  key={command.name}
                  type="button"
                  onClick={() => handleCommandSelect(command.name)}
                  onMouseEnter={() => setSelectedCommandIndex(index)}
                  className={`w-full px-3 py-2.5 flex items-center gap-3 transition-colors cursor-pointer ${
                    index === selectedCommandIndex
                      ? "bg-gray-50"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    <Icon size={16} className="text-gray-600" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-gray-900">
                      {command.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {command.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto w-full">
        {/* Attached File Preview Pill */}
        {attachedFile && (
          <div className="flex items-center justify-between gap-2 bg-white border border-gray-200/90 rounded-2xl px-4 py-2.5 mb-2 shadow-2xs max-w-md animate-fade-in">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                {attachedFile.type.startsWith("image/") ? (
                  <ImageIcon size={15} />
                ) : (
                  <Paperclip size={15} />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">
                  {attachedFile.name}
                </p>
                <p className="text-[11px] text-gray-400">
                  {Math.round(attachedFile.size / 1024)} KB
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setAttachedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 bg-white border border-gray-200/90 rounded-[28px] px-6 py-3.5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] focus-within:border-gray-300 focus-within:shadow-[0_6px_28px_rgba(0,0,0,0.07)] transition-all duration-200">
          <textarea
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ketik pesan atau / untuk commands..."
            rows={1}
            disabled={disabled || isReadingFile}
            className="flex-1 bg-transparent border-0 outline-hidden focus:outline-hidden text-gray-900 placeholder:text-gray-400 text-sm leading-relaxed min-h-[24px] max-h-[180px] py-1 resize-none disabled:opacity-40 overflow-y-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          />

          <div className="flex items-center gap-2 shrink-0 self-end pb-0.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isReadingFile}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-40"
              title="Lampirkan file (Foto, Struk, PDF, Excel, TXT)"
            >
              <Paperclip size={19} />
            </button>

            <button
              type="submit"
              disabled={(!message.trim() && !attachedFile) || disabled || isReadingFile}
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
