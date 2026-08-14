import { Monitor, Camera, Globe, Loader2, FileSpreadsheet, FileText, Keyboard, Sparkles, Cpu } from "lucide-react";

export interface LiveStatusData {
  type?: 'thinking' | 'tool_start' | 'tool_live_status' | 'tool_done' | 'text_delta';
  toolName?: string;
  preview?: string;
  screenshot?: string;
  timestamp?: string;
}

interface LiveExecutionBadgeProps {
  status: LiveStatusData | null;
  active?: boolean;
}

export function LiveExecutionBadge({ status, active = true }: LiveExecutionBadgeProps) {
  if (!status || !active) return null;

  const type = status.type || (status.toolName ? 'tool_start' : 'thinking');
  const toolName = status.toolName || '';
  const preview = status.preview || '';

  // Stage 1: Analyzing Phase
  if (type === 'thinking') {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-mono bg-[#18181b] text-zinc-300 border border-zinc-800 shadow-md transition-all animate-fade-in my-1.5">
        <Sparkles size={13} className="text-zinc-400 animate-spin" />
        <span className="text-zinc-200 font-semibold">Analyzing...</span>
        <span className="text-zinc-600">•</span>
        <span className="text-zinc-400 text-[10px]">{preview || "Understanding intent & context"}</span>
        <Loader2 size={11} className="animate-spin text-zinc-500 ml-1" />
      </div>
    );
  }

  // Stage 3: Synthesizing / Responding Phase
  if (type === 'text_delta') {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-mono bg-[#18181b] text-zinc-300 border border-zinc-800 shadow-md transition-all animate-fade-in my-1.5">
        <Cpu size={13} className="text-emerald-400 animate-pulse" />
        <span className="text-zinc-200 font-semibold">Synthesizing...</span>
        <span className="text-zinc-600">•</span>
        <span className="text-zinc-400 text-[10px]">Generating response</span>
        <Loader2 size={11} className="animate-spin text-zinc-500 ml-1" />
      </div>
    );
  }

  // Stage 2: Tool Execution Phase (Working / Desktop Action)
  let icon = <Monitor size={12} className="text-zinc-300 animate-pulse" />;
  let categoryLabel = "Desktop";

  if (toolName.includes("excel")) {
    icon = <FileSpreadsheet size={12} className="text-zinc-300 animate-pulse" />;
    categoryLabel = "Excel";
  } else if (toolName.includes("word")) {
    icon = <FileText size={12} className="text-zinc-300 animate-pulse" />;
    categoryLabel = "Word";
  } else if (toolName.includes("browser")) {
    icon = <Globe size={12} className="text-zinc-300 animate-pulse" />;
    categoryLabel = "Web";
  } else if (toolName.includes("screenshot")) {
    icon = <Camera size={12} className="text-zinc-300 animate-pulse" />;
    categoryLabel = "Shot";
  } else if (toolName.includes("send_keys") || toolName.includes("key")) {
    icon = <Keyboard size={12} className="text-zinc-300 animate-pulse" />;
    categoryLabel = "Keys";
  }

  const rawPreview = preview || `Executing ${toolName}...`;
  const shortPreview = rawPreview.length > 25 ? rawPreview.slice(0, 25) + "..." : rawPreview;

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-mono bg-[#18181b] text-zinc-200 border border-zinc-700/80 shadow-md transition-all animate-fade-in my-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
      {icon}
      <span className="font-semibold text-zinc-200">Working: {categoryLabel}</span>
      <span className="text-zinc-600">•</span>
      <span className="truncate max-w-[170px] text-zinc-400">{shortPreview}</span>
      <Loader2 size={11} className="animate-spin text-zinc-400 ml-1" />
    </div>
  );
}
